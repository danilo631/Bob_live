#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict");
const brain=require("../brain");
const handler=require("../api/brain");
const m=brain.stats();
assert.equal(m.intents,49);
assert.equal(m.trainingExamples,251);
assert.equal(m.answers,147);
assert(m.params<15000,"classificador excessivamente grande");
const checks=[
  ["qual é seu nome","identidade"],
  ["me conta uma piada","piada"],
  ["o que faz a rosa","rosa"],
  ["quantas letras tem o alfabeto","alfabeto"],
  ["você gosta de jogos","jogos"],
  ["qual a capital do Brasil","brasil"],
  ["qual seu emoji favorito","emoji"],
  ["como faz o gato","gato"],
  ["onde você mora","local"],
  ["sabe programar","tecnologia"],
  ["para que servem as curtidas","curtidas"],
  ["quem te criou","criador"]
];
let matched=0;
for (const [q,intent] of checks) {
  const p=brain.answer(q);
  if(p?.intent===intent)matched++;
  else console.warn("Treino falhou",q,p?.intent||"null",intent);
}
assert(matched>=9,"qualidade do modelo insuficiente: "+matched+"/"+checks.length);
assert.equal(brain.answer(""),null);
assert.equal(brain.answer("vou me matar"),null);
assert.equal(brain.answer("xxxxxxxxxxxx qwertyzzzz oiob"),null);
const secret="test-secret-with-at-least-twenty-characters";
process.env.BRAIN_API_KEY=secret;
async function request(method,body,key) {
  const req={method,body,headers:{"x-brain-key":key||""}};
  const res={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;return this;},
    status(c){this.statusCode=c;return this;},json(x){this.value=x;return this;}};
  await handler(req,res);
  return res;
}
(async()=>{
  const health=await request("GET");
  assert.equal(health.statusCode,200);
  assert.equal(health.value.stats.intents,49);
  const noKey=await request("POST",{question:"oi"});
  assert.equal(noKey.statusCode,401);
  const ok=await request("POST",{question:"gosta de pizza?",nickname:"Pessoa"},secret);
  assert.equal(ok.statusCode,200);
  assert.equal(ok.value.answer.intent,"pizza");
  const bad=await request("POST",{question:"x".repeat(351)},secret);
  assert.equal(bad.statusCode,400);
  console.log("Neural PT-BR: "+matched+"/"+checks.length+" intencoes, "+m.trainingExamples+" perguntas, "+m.answers+" respostas, "+m.params+" parametros");
})().catch(e=>{console.error(e);process.exitCode=1;});
