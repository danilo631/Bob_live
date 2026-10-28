"use strict";
// Vercel Function: small CPU-only neural classifier. No Ollama daemon or GPU.
const crypto=require("node:crypto");
const brain=require("../brain");
function authorized(candidate, secret) {
  if(typeof candidate!=="string"||candidate.length!==secret.length)return false;
  return crypto.timingSafeEqual(Buffer.from(candidate),Buffer.from(secret));
}
module.exports=async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  res.setHeader("X-Content-Type-Options","nosniff");
  if(req.method==="GET"){
    res.status(200).json({ok:true,service:"Bob Live Tiny Neural",stats:brain.stats(),authRequired:true});
    return;
  }
  if(req.method!=="POST"){res.setHeader("Allow","GET, POST");res.status(405).json({error:"method not allowed"});return;}
  const key=process.env.BRAIN_API_KEY || "";
  if(key.length<20){res.status(503).json({error:"brain API key not configured"});return;}
  if(!authorized(String(req.headers["x-brain-key"]||""),key)){
    res.status(401).json({error:"unauthorized"});return;
  }
  const data=typeof req.body==="object"&&req.body&&!Array.isArray(req.body)?req.body:{};
  if(typeof data.question!=="string"||data.question.length<1||data.question.length>350){
    res.status(400).json({error:"invalid question"});return;
  }
  const answer=brain.answer(data.question,{nickname:String(data.nickname||"").slice(0,40)});
  res.status(200).json({ok:true,answer,stats:{intents:brain.stats().intents}});
};
