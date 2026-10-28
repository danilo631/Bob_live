#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const http=require("node:http");
const {spawn}=require("node:child_process");
const secret=crypto.randomBytes(30).toString("hex");
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const backend=http.createServer(async (req,res)=>{
  assert.equal(req.url,"/v1/chat/completions");
  let raw="";
  for await (const chunk of req)raw+=chunk;
  const obj=JSON.parse(raw);
  assert.equal(obj.model,"qwen2.5:0.5b");
  assert.equal(obj.stream,true);
  res.writeHead(200,{"Content-Type":"text/event-stream"});
  res.end('data: {"choices":[{"delta":{"content":"Olá!"}}]}\n\ndata: [DONE]\n\n');
});
(async()=>{
  await new Promise(resolve=>backend.listen(9552,"127.0.0.1",resolve));
  const child=spawn(process.execPath,["scripts/ollama_relay.js"],{
    env:{...process.env,OLLAMA_RELAY_PORT:"9551",OLLAMA_BACKEND_PORT:"9552",BOB_OLLAMA_RELAY_KEY:secret},
    stdio:"ignore",
  });
  try{
    for(let i=0;i<30;i++){
      try{if((await fetch("http://127.0.0.1:9551/health")).ok)break;}catch{}
      await pause(100);
    }
    const url="http://127.0.0.1:9551/v1/chat/completions";
    const body=JSON.stringify({model:"malicious",stream:false,messages:[{role:"user",content:"Oi"}]});
    assert.equal((await fetch(url,{method:"POST",body,headers:{"Content-Type":"application/json"}})).status,401);
    const response=await fetch(url,{method:"POST",body,headers:{
      "Content-Type":"application/json","Authorization":"Bearer "+secret
    }});
    assert.equal(response.status,200);
    assert.match(await response.text(),/Olá!/);
    assert.equal((await fetch("http://127.0.0.1:9551/v1/models")).status,404);
    console.log("Ollama proxy: chave obrigatoria, rota limitada, modelo fixo, SSE validado.");
  }finally{
    child.kill("SIGTERM");
    backend.close();
  }
})().catch(e=>{console.error(e);process.exitCode=1;backend.close();});
