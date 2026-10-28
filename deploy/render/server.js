"use strict";
// Run lightweight TikTok/AI backend and authenticated HTTP/WS bridge inside one Render service.
// Node only: no Ollama, Piper, or Godot process in RAM.
const { spawn } = require("node:child_process");
const crypto = require("node:crypto");
const path = require("node:path");
const backend = path.resolve(__dirname, "../../.generated/server/src/index.js");
const bridge = path.resolve(__dirname, "../../scripts/public_bridge.js");
const assignedPort = String(process.env.PORT || "10000");
const secret = process.env.BOB_SESSION_KEY || "";
if (!/^\d{2,5}$/.test(assignedPort)) throw new Error("Invalid Render PORT");
if (secret.length < 20) {
  process.stderr.write("Set BOB_SESSION_KEY in Render Environment (20+ characters).\n");
  process.exit(1);
}
const env = { ...process.env,
  AI_PROVIDER: process.env.AI_PROVIDER || "openai",
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL || "https://openrouter.ai/api/v1",
  OPENAI_MODEL: process.env.OPENAI_MODEL || "openrouter/free",
  TIKTOK_USERNAME: process.env.TIKTOK_USERNAME || "nexttec_1",
  TTS_PROVIDER: "browser",
  VOICE_AUTOSTART: "0",
  REPLY_LENGTH: "curta",
  SPEECH_MAX_GAP_SECONDS: "999",
};
const jobs = [
  {
    name: "backend",
    file: backend,
    env: { ...env, PORT: "9393" }
  },
  {
    name: "bridge",
    file: bridge,
    env: {
      ...env,
      PORT: "9393",
      BOB_BACKEND_PORT: "9393",
      PUBLIC_PORT: assignedPort,
      BOB_PUBLIC_HOST: "0.0.0.0",
      BOB_PUBLIC_ORIGIN: process.env.BOB_PUBLIC_ORIGIN || "https://bob-live-web-nexttec.onrender.com"
    }
  }
];
let stopping = false;
const children = jobs.map(job => {
  const child = spawn(process.execPath, [job.file], { env: job.env, stdio: "inherit" });
  child.on("error", err => console.error(job.name, err.message));
  child.on("exit", (code, signal) => {
    console.error(job.name + " exited", { code, signal });
    if (!stopping) process.exit(code || 1);
  });
  return child;
});
// Uma unica verificacao no inicio comprova que Vercel atende o backend Render.
// O token nunca e registrado; falha remota nunca derruba o fallback local.
async function verifyVercelBrain() {
  const endpoint=process.env.BRAIN_REMOTE_URL || "";
  const key=process.env.BRAIN_API_KEY || "";
  if(!/^https:\/\/[a-z0-9-]+\.vercel\.app\/api\/brain$/.test(endpoint)||key.length<20) {
    console.log("IA: rede neural local pronta; offload Vercel nao configurado.");
    return;
  }
  try {
    const response=await fetch(endpoint,{
      method:"POST",
      headers:{"Content-Type":"application/json","x-brain-key":key},
      body:JSON.stringify({question:"qual seu nome?",nickname:"Teste"}),
      signal:AbortSignal.timeout(7500)
    });
    if(!response.ok)throw new Error("HTTP "+response.status);
    const result=await response.json();
    if(!result.answer?.text || !result.answer.intent)throw new Error("sem resposta classificada");
    console.log("IA distribuida: Vercel neural operacional, Render e fallback local prontos.");
  } catch(err) {
    console.warn("IA Vercel indisponivel ("+String(err.message).slice(0,110)+"); usando neural local no Render.");
  }
}
void verifyVercelBrain();

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    stopping = true;
    for (const child of children) child.kill(signal);
    setTimeout(() => process.exit(0), 1000).unref();
  });
}
