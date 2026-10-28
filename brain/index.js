"use strict";
/**
 * Tiny Portuguese intent model:
 * deterministic hashed word/character features -> 24 tanh neurons -> softmax.
 * Training and inference are local, dependency-free and CPU-only.
 * It classifies configured intents; it is NOT a generative language model.
 */
const dataset = require("./intents.json");
const INPUT = 256;
const HIDDEN = 24;
const CLASSES = dataset.intents.length;
const examples = dataset.intents.flatMap((intent, classId) =>
  intent.questions.map(q => ({ classId, question:q })));
const names = dataset.intents.map(i=>i.id);
let seed=0x12345678;
function random() {seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;}
function clean(s) {
  return String(s||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"")
    .toLowerCase().replace(/[^a-z0-9 ]+/g," ").replace(/\s+/g," ").trim().slice(0,240);
}
const stopwords = new Set("eu voce vc meu minha a o os as um uma de da do e em por para como me que qual quais eh é no na tem seu sua isso esta está".split(" "));
function tokens(s){return clean(s).split(" ").filter(w=>w.length>=2&&!stopwords.has(w)).slice(0,48);}
function hash(s) {
  let h=2166136261;
  for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}
  return h>>>0;
}
function features(s) {
  const words=tokens(s);
  const sparse=new Map();
  function add(term, val){
    const i=hash(term)%INPUT;
    sparse.set(i,(sparse.get(i)||0)+val);
  }
  for(const w of words){
    add("w:"+w,1);
    if(w.length>=5) {
      for(let j=0;j<=w.length-3;j++)add("c:"+w.slice(j,j+3),0.16);
    }
  }
  for(let j=1;j<words.length;j++)add("b:"+words[j-1]+"/"+words[j],0.7);
  let len=0; for(const v of sparse.values())len+=v*v;
  len=Math.sqrt(len)||1;
  return [...sparse].map(([i,v])=>[i,v/len]);
}
const samples=examples.map(e=>({...e,vec:features(e.question),words:new Set(tokens(e.question))}));
const w1=new Float32Array(HIDDEN*INPUT);
const b1=new Float32Array(HIDDEN);
const w2=new Float32Array(CLASSES*HIDDEN);
const b2=new Float32Array(CLASSES);
for(let i=0;i<w1.length;i++)w1[i]=(random()-.5)*.08;
for(let i=0;i<w2.length;i++)w2[i]=(random()-.5)*.08;
const act=new Float32Array(HIDDEN), probs=new Float32Array(CLASSES);
function forward(vec) {
  for(let h=0;h<HIDDEN;h++){
    let x=b1[h],offset=h*INPUT;
    for(const [j,v] of vec)x+=w1[offset+j]*v;
    act[h]=Math.tanh(x);
  }
  let max=-Infinity;
  for(let k=0;k<CLASSES;k++){
    let x=b2[k],offset=k*HIDDEN;
    for(let h=0;h<HIDDEN;h++)x+=w2[offset+h]*act[h];
    probs[k]=x;
    if(x>max)max=x;
  }
  let total=0;
  for(let k=0;k<CLASSES;k++){probs[k]=Math.exp(probs[k]-max);total+=probs[k];}
  for(let k=0;k<CLASSES;k++)probs[k]/=total;
  return probs;
}
function train() {
  const hiddenGrad=new Float32Array(HIDDEN);
  const classGrad=new Float32Array(CLASSES);
  // Fixed number of passes ensures deterministic deployments and cold starts.
  for(let epoch=0;epoch<28;epoch++){
    const lr=.19*(1-epoch/37);
    for(let index=0;index<samples.length;index++){
      const sample=samples[(index*37+epoch*19)%samples.length];
      forward(sample.vec);
      for(let k=0;k<CLASSES;k++)classGrad[k]=probs[k]-(k===sample.classId?1:0);
      hiddenGrad.fill(0);
      for(let k=0;k<CLASSES;k++){
        const d=classGrad[k];
        for(let h=0;h<HIDDEN;h++)hiddenGrad[h]+=w2[k*HIDDEN+h]*d;
      }
      for(let k=0;k<CLASSES;k++){
        const d=classGrad[k];
        for(let h=0;h<HIDDEN;h++)w2[k*HIDDEN+h]-=lr*d*act[h];
        b2[k]-=lr*d;
      }
      for(let h=0;h<HIDDEN;h++){
        const d=hiddenGrad[h]*(1-act[h]*act[h]);
        for(const [j,v] of sample.vec)w1[h*INPUT+j]-=lr*d*v;
        b1[h]-=lr*d;
      }
    }
  }
}
train();
const protectedTopics = /\b(suicid|me matar|quero morrer|automutil|me cortar|estupr|abus|violencia domestica|depress|desesper|me bate|apanh|nao aguento mais)\w*/;
function similarity(a,b) {
  if(!a.size||!b.size)return 0;
  let both=0;
  for(const word of a)if(b.has(word))both++;
  return both/Math.sqrt(a.size*b.size);
}
function classify(query) {
  const normalized=clean(query);
  if(!normalized||protectedTopics.test(normalized))return null;
  const vec=features(normalized), words=new Set(tokens(normalized));
  if(!vec.length)return null;
  const p=forward(vec);
  let topProb=0,topIndex=-1;
  for(let i=0;i<CLASSES;i++)if(p[i]>topProb){topProb=p[i];topIndex=i;}
  let best={score:0,classId:-1,lexical:0,neural:0};
  for(const example of samples){
    const lex=similarity(words,example.words);
    const nn=p[example.classId];
    const score=lex*.83+nn*.17;
    if(score>best.score)best={score,classId:example.classId,lexical:lex,neural:nn};
  }
  // Unknown questions should defer to configured Ollama/OpenRouter, never bluff.
  if(best.lexical<.37||best.score<.42)return null;
  return {...best,intent:names[best.classId],confidence:Math.round(best.score*1000)/1000,
    neuralTop:names[topIndex],neuralConfidence:Math.round(topProb*1000)/1000};
}
function answer(query,{nickname=""}={}) {
  const c=classify(query);
  if(!c)return null;
  const options=dataset.intents[c.classId].answers;
  const index=hash(clean(query)+"|"+clean(nickname))%options.length;
  return {text:options[index].trim(),intent:c.intent,confidence:c.confidence,
    neuralConfidence:c.neuralConfidence,source:"tiny-neural-ptbr"};
}
function stats(){return {intents:CLASSES,trainingExamples:examples.length,
  answers:dataset.intents.reduce((n,i)=>n+i.answers.length,0),
  input:INPUT,hidden:HIDDEN,params:w1.length+b1.length+w2.length+b2.length};}
module.exports={answer,classify,stats,clean};
