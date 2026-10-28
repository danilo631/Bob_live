#!/usr/bin/env node
"use strict";
// Exposes ONLY a guarded WebSocket and two limited APIs to the temporary Cloudflare Tunnel.
// The full 9393 control panel, credentials, settings, and admin endpoints remain on localhost.
const http = require("node:http");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const brain = require("../brain");
const { WebSocket, WebSocketServer } = require("../.generated/server/node_modules/ws");

const ORIGIN = process.env.BOB_PUBLIC_ORIGIN || "https://danilo631.github.io";
// Only use one explicit HTTPS origin; never allow '*' or arbitrary caller origins.
if (!/^https:\/\/[a-z0-9.-]+(?::443)?$/i.test(ORIGIN)) {
  throw new Error("BOB_PUBLIC_ORIGIN precisa ser uma origem HTTPS sem caminho");
}
// Two explicit trusted frontends may share one protected TikTok backend.
const ORIGINS = new Set([ORIGIN]);
for (const item of String(process.env.BOB_PUBLIC_ORIGINS || "").split(",")) {
  const candidate=item.trim();
  if (!candidate) continue;
  if (!/^https:\/\/[a-z0-9.-]+(?::443)?$/i.test(candidate)) throw new Error("Invalid BOB_PUBLIC_ORIGINS");
  ORIGINS.add(candidate);
}
const trustedOrigin = req => ORIGINS.has(req.headers.origin);
const SECRET = process.env.BOB_SESSION_KEY || "";
// Token de escopo limitado so para visualizacao do Godot no LIVE Studio.
// A chave admin nao vai na URL da source; trocar BOB_SESSION_KEY revoga links antigos.
const STUDIO_TOKEN = crypto.createHmac("sha256", SECRET).update("bob-live-studio-source-v2").digest("base64url");
function authorizedStudio(candidate) {
  return typeof candidate==="string"&&candidate.length===STUDIO_TOKEN.length &&
    crypto.timingSafeEqual(Buffer.from(candidate),Buffer.from(STUDIO_TOKEN));
}
const RELAY_KEY = process.env.BOB_OLLAMA_RELAY_KEY || "";
const RELAY_FILE = path.resolve(__dirname, "../.generated/server/private/ollama-relay.json");
function authorizedRelay(candidate) {
  if (RELAY_KEY.length < 32 || typeof candidate !== "string" || candidate.length !== RELAY_KEY.length) return false;
  return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(RELAY_KEY));
}

const PUBLIC_PORT = Number(process.env.PUBLIC_PORT || "9494");
const BACKEND_PORT = Number(process.env.BOB_BACKEND_PORT || process.env.PORT || "9393");
const BACKEND_HOST = process.env.BOB_BACKEND_HOST || "127.0.0.1";
if (SECRET.length < 20 || SECRET.length > 256) {
  console.error("Configure o secret BOB_SESSION_KEY com pelo menos 20 caracteres.");
  process.exit(1);
}
if (!Number.isInteger(PUBLIC_PORT) || PUBLIC_PORT < 1024 || PUBLIC_PORT > 65535) {
  throw new Error("Porta invalida");
}
function authorized(candidate) {
  if (typeof candidate !== "string" || candidate.length !== SECRET.length) return false;
  return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(SECRET));
}
function headers(req) {
  return trustedOrigin(req) ? {
    "Access-Control-Allow-Origin": req.headers.origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Vary": "Origin",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  } : { "Cache-Control": "no-store" };
}
function respond(req, res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, { ...headers(req), "Content-Type": "application/json; charset=utf-8" });
  res.end(data);
}
const allowed = new Map([
  ["GET /api/status", 0],
  ["GET /api/brain/status", 0],
  ["POST /api/brain/ask", 1024],
  ["POST /api/studio/link", 0],
  ["POST /api/simulate/chat", 1200],
  ["POST /api/simulate/gift", 1200],
]);
let nextSimulationAt = 0;
const server = http.createServer(async (req, res) => {
  if (req.url === "/internal/ollama/attach" && req.method === "POST") {
    if (!authorizedRelay(String(req.headers.authorization || "").replace(/^Bearer /,"")))
      return respond(req,res,401,{error:"unauthorized"});
    let raw="";
    try {
      for await (const part of req) {
        raw+=part.toString();
        if(raw.length>1536)return respond(req,res,413,{error:"payload too large"});
      }
      const body=JSON.parse(raw);
      const url=new URL(String(body.url||""));
      if(url.protocol!=="https:" || !/^[a-z0-9-]+\.trycloudflare\.com$/i.test(url.hostname) ||
         url.port || url.pathname!=="/" || url.search || url.hash) throw new Error("invalid relay host");
      const maxExpires=Date.now()+2*60*60*1000;
      const expires=Number(body.expires);
      if(!Number.isFinite(expires)||expires<=Date.now()||expires>maxExpires)
        throw new Error("invalid expiration");
      fs.mkdirSync(path.dirname(RELAY_FILE),{recursive:true,mode:0o700});
      fs.writeFileSync(RELAY_FILE,JSON.stringify({url:url.origin,expires}),{mode:0o600});
      return respond(req,res,200,{ok:true,relay:"ollama",expires});
    } catch { return respond(req,res,400,{error:"invalid relay configuration"}); }
  }
  if (req.url === "/health" && req.method === "GET") {
    return respond(req, res, 200, { ok: true, service: "Bob Live Session", authenticated: false });
  }
  if (!trustedOrigin(req)) return respond(req, res, 403, { error: "origin forbidden" });
  if (req.method === "OPTIONS") {
    res.writeHead(204, headers(req));
    return res.end();
  }
  const endpoint = req.method + " " + req.url;
  if (!allowed.has(endpoint)) return respond(req, res, 404, { error: "not found" });
  if (!authorized(String(req.headers.authorization || "").replace(/^Bearer /, ""))) {
    return respond(req, res, 401, { error: "unauthorized" });
  }
  if (endpoint === "GET /api/brain/status") {
    let ollama=false;
    try {const relay=JSON.parse(fs.readFileSync(RELAY_FILE,"utf8"));ollama=Number(relay.expires)>Date.now();} catch {}
    return respond(req,res,200,{ok:true,engine:ollama?"ollama-actions":"neural-ptbr",
      ollama,vercelOffload:Boolean(process.env.BRAIN_REMOTE_URL && process.env.BRAIN_API_KEY),
      stats:brain.stats()});
  }
  if (endpoint==="POST /api/studio/link") {
    const site=process.env.BOB_PUBLIC_ORIGIN || ORIGIN;
    if(!/^https:\/\/[a-z0-9.-]+$/.test(site))return respond(req,res,500,{error:"invalid site origin"});
    return respond(req,res,200,{
      ok:true,url:site+"/?studio=1#key="+STUDIO_TOKEN,
      mode:"studio",resolution:"1080x1920",
      note:"Cole esta URL na Fonte Web do TikTok LIVE Studio. O acesso e limitado ao personagem, nao permite controlar o servidor."
    });
  }
  const limit = allowed.get(endpoint);
  if (limit) {
    if (Date.now() < nextSimulationAt) return respond(req, res, 429, { error: "aguarde antes de simular novamente" });
    nextSimulationAt = Date.now() + 1500;
  }
  let body = "";
  try {
    for await (const part of req) {
      body += part.toString();
      if (body.length > limit) return respond(req, res, 413, { error: "payload too large" });
    }
  } catch {
    return respond(req, res, 400, { error: "invalid payload" });
  }
  if (limit && endpoint !== "POST /api/brain/ask") {
    let obj;
    try { obj = JSON.parse(body); } catch { return respond(req, res, 400, { error: "invalid json" }); }
    const trim = (v, max) => String(v || "").trim().slice(0, max);
    body = JSON.stringify(endpoint.endsWith("/chat") ? {
      user: trim(obj.user, 40) || "Teste",
      comment: trim(obj.comment, 250) || "Oi, Bob!",
    } : {
      user: trim(obj.user, 40) || "Teste",
      gift: trim(obj.gift, 40) || "Rose",
      count: 1,
      coins: 1,
    });
  }
  if(endpoint==="POST /api/brain/ask") {
    let parsed={};
    try { parsed=JSON.parse(body); } catch { return respond(req,res,400,{error:"invalid json"}); }
    const question=String(parsed.question||"").trim().slice(0,350);
    if(question.length<2||question.length>350)return respond(req,res,400,{error:"invalid question"});
    const nickname=String(parsed.nickname||"").trim().slice(0,40);
    let answer=null, source="neural-local";
    const target=String(process.env.BRAIN_REMOTE_URL||"");
    const brainKey=String(process.env.BRAIN_API_KEY||"");
    if(/^https:\/\/[a-z0-9-]+\.vercel\.app\/api\/brain$/i.test(target)&&brainKey.length>=20) {
      try{
        const remote=await fetch(target,{
          method:"POST",
          headers:{"Content-Type":"application/json","x-brain-key":brainKey},
          body:JSON.stringify({question,nickname}),signal:AbortSignal.timeout(1700)
        });
        if(remote.ok){
          const data=await remote.json();
          if(data.answer&&typeof data.answer.text==="string"&&data.answer.text.length<=220){
            answer=data.answer;source="vercel-neural";
          }
        }
      }catch{/* vce/surface disconnection: fallback local */}
    }
    if(!answer)answer=brain.answer(question,{nickname});
    return respond(req,res,200,{ok:true,answer,source:answer?source:"not-matched"});
  }

  const opts = {
    hostname: BACKEND_HOST, port: BACKEND_PORT, path: req.url, method: req.method,
    headers: { Host: "127.0.0.1:" + BACKEND_PORT, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
    timeout: 6000,
  };
  const upstream = http.request(opts, reply => {
    res.writeHead(reply.statusCode || 502, { ...headers(req), "Content-Type": "application/json; charset=utf-8" });
    reply.pipe(res);
  });
  upstream.on("error", () => { if (!res.headersSent) respond(req, res, 502, { error: "server unavailable" }); else res.end(); });
  upstream.on("timeout", () => upstream.destroy());
  upstream.end(body);
});

const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
let activeClient = null;
server.on("upgrade", (req, socket, head) => {
  let url;
  try { url = new URL(req.url, "http://localhost"); } catch { socket.destroy(); return; }
  const studio=url.pathname==="/ws/studio";
  const permitted=studio?authorizedStudio(url.searchParams.get("token")):authorized(url.searchParams.get("token"));
  if ((!studio && url.pathname!=="/ws/godot") || !trustedOrigin(req) || !permitted) {
    socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, client => wss.emit("connection", client));
});
wss.on("connection", client => {
  if (activeClient && activeClient.readyState === WebSocket.OPEN) activeClient.close(1000, "New session");
  activeClient = client;
  const backend = new WebSocket("ws://" + BACKEND_HOST + ":" + BACKEND_PORT + "/ws/godot", {
    origin: ORIGIN, maxPayload: 4096,
  });
  const queued = [];
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    if (activeClient === client) activeClient = null;
    try { client.close(); } catch {}
    try { backend.close(); } catch {}
  };
  backend.on("open", () => {
    for (const message of queued) backend.send(message);
    queued.length = 0;
  });
  backend.on("message", data => {
    if (client.readyState === WebSocket.OPEN) client.send(data.toString());
  });
  client.on("message", data => {
    let msg;
    try { msg = JSON.parse(data.toString()); } catch { return; }
    if (!["hello", "heartbeat", "speech_finished", "dance_finished"].includes(msg.type)) return;
    const raw = JSON.stringify({ type: msg.type, job_id: String(msg.job_id || "").slice(0, 80), client: "godot-web", protocol: 1 });
    if (backend.readyState === WebSocket.OPEN) backend.send(raw);
    else if (queued.length < 12) queued.push(raw);
  });
  backend.on("close", close);
  backend.on("error", close);
  client.on("close", close);
  client.on("error", close);
});
server.listen(PUBLIC_PORT, process.env.BOB_PUBLIC_HOST || "127.0.0.1", () => console.log("Bob public bridge ready (port " + PUBLIC_PORT + "; authenticated)"));
