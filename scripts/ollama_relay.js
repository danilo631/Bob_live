#!/usr/bin/env node
"use strict";
const http=require("node:http");
const crypto=require("node:crypto");
const KEY=process.env.BOB_OLLAMA_RELAY_KEY||"";
if(KEY.length<32){console.error("BOB_OLLAMA_RELAY_KEY ausente (minimo 32 caracteres)");process.exit(1);}
const PORT=Number(process.env.OLLAMA_RELAY_PORT||"9550");
const OLLAMA_PORT=Number(process.env.OLLAMA_BACKEND_PORT||"11434");
const valid=header=>{
  const s=String(header||"").replace(/^Bearer /,"");
  return s.length===KEY.length&&crypto.timingSafeEqual(Buffer.from(s),Buffer.from(KEY));
};
function json(res,code,obj){
  res.writeHead(code,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"});
  res.end(JSON.stringify(obj));
}
const server=http.createServer(async(req,res)=>{
  if(req.method==="GET"&&req.url==="/health")return json(res,200,{ok:true,model:"qwen2.5:0.5b",auth:true});
  if(req.method!=="POST"||req.url!=="/v1/chat/completions")return json(res,404,{error:"not found"});
  if(!valid(req.headers.authorization))return json(res,401,{error:"unauthorized"});
  let raw="";
  try{
    for await (const chunk of req) {
      raw+=chunk.toString();
      if(raw.length>32768)return json(res,413,{error:"request too large"});
    }
    const body=JSON.parse(raw);
    if(!Array.isArray(body.messages)||body.messages.length>14||
      body.messages.some(m=>!["system","user","assistant"].includes(m.role)||typeof m.content!=="string"||m.content.length>6000))
      return json(res,400,{error:"invalid messages"});
    const clean={model:"qwen2.5:0.5b",stream:true,messages:body.messages,
      max_tokens:Math.max(16,Math.min(Number(body.max_tokens)||140,160)),
      temperature:0.7};
    const outgoing=http.request({
      hostname:"127.0.0.1",port:OLLAMA_PORT,path:"/v1/chat/completions",method:"POST",
      headers:{"Content-Type":"application/json","Content-Length":Buffer.byteLength(JSON.stringify(clean))},
      timeout:100000
    },reply=>{
      res.writeHead(reply.statusCode||502,{
        "Content-Type":String(reply.headers["content-type"]||"text/event-stream"),
        "Cache-Control":"no-store",
        "X-Content-Type-Options":"nosniff"
      });
      reply.pipe(res);
    });
    outgoing.on("error",()=>{if(!res.headersSent)json(res,502,{error:"ollama unavailable"});else res.end();});
    outgoing.on("timeout",()=>outgoing.destroy());
    outgoing.end(JSON.stringify(clean));
  }catch{
    if(!res.headersSent)json(res,400,{error:"invalid request"});
    else res.end();
  }
});
server.listen(PORT,"127.0.0.1",()=>console.log("Ollama relay seguro ouvindo localhost:"+PORT));
