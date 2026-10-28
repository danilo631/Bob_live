#!/usr/bin/env node
"use strict";
const fs=require("node:fs");
const vm=require("node:vm");
const assert=require("node:assert/strict");
let played=[], spoken=0, completed=0;
function Utterance(text){this.text=text;this.lang="";this.pitch=1;this.rate=1;}
const speech={
 getVoices(){return [{lang:"pt-BR",name:"ptbr"}]},
 cancel(){},
 speak(u){spoken++;played.push(u);u.onend?.();}
};
const window={speechSynthesis:speech};
const document={getElementById(){return {textContent:""};}};
const code=fs.readFileSync("site/voice.js","utf8");
vm.runInNewContext(code,{window,document,SpeechSynthesisUtterance:Utterance,console,Float32Array,AbortSignal});
assert(window.BobVoice,"API BobVoice missing");
assert.equal(window.BobVoice.setMode("system"),"system");
window.BobVoice.speak("Oi, pessoal!",()=>completed++);
assert.equal(spoken,1);
assert.equal(completed,1);
assert.equal(played[0].lang,"pt-BR");
assert(played[0].pitch>1.3);
(async()=>{
 const result=await window.BobVoice.activate();
 assert.equal(result.neural,false);
 assert.equal(spoken,2);
 console.log("Voz cartoon: pt-BR, fala/termino, ativacao OK. Kokoro opcional nao executado no CI.");
})().catch(e=>{console.error(e);process.exitCode=1;});
