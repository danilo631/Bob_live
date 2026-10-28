#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const crypto = require("node:crypto");

const secret = crypto.randomBytes(20).toString("hex");
const origin = process.env.BOB_PUBLIC_ORIGIN || "https://danilo631.github.io";
const alternate = "https://bob-live-nexttec.vercel.app";
const child = spawn(process.execPath, ["scripts/public_bridge.js"], {
  cwd: process.cwd(),
  env: { ...process.env, BOB_SESSION_KEY: secret, PUBLIC_PORT: "9495", PORT: "9399", BOB_PUBLIC_HOST: "127.0.0.1", BOB_PUBLIC_ORIGIN: origin, BOB_PUBLIC_ORIGINS:alternate, BRAIN_API_KEY:"", BRAIN_REMOTE_URL:"" },
  stdio: ["ignore", "pipe", "pipe"],
});
let stderr = "";
child.stderr.on("data", chunk => { stderr += chunk.toString(); });

const url = "http://127.0.0.1:9495";
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  try {
    let ready = false;
    for (let i = 0; i < 50; i++) {
      if (child.exitCode !== null) throw new Error(stderr || "process exited");
      try {
        const r = await fetch(url + "/health", { signal: AbortSignal.timeout(1000) });
        if (r.ok) { ready = true; break; }
      } catch {}
      await pause(100);
    }
    assert.ok(ready, "proxy not ready");
    const outside = await fetch(url + "/api/status");
    assert.equal(outside.status, 403, "public requests must be rejected");
    const wrong = await fetch(url + "/api/status", { headers: { Origin: origin, Authorization: "Bearer wrong" } });
    assert.equal(wrong.status, 401, "wrong key must be rejected");
    const forbidden = await fetch(url + "/api/settings", { headers: { Origin: origin, Authorization: "Bearer " + secret } });
    assert.equal(forbidden.status, 404, "panel settings must never be exposed");
    const preflight = await fetch(url + "/api/status", { method: "OPTIONS", headers: { Origin: origin } });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get("access-control-allow-origin"), origin);
    const alt = await fetch(url+"/api/status", { method:"OPTIONS",headers:{Origin:alternate} });
    assert.equal(alt.status,204);
    assert.equal(alt.headers.get("access-control-allow-origin"),alternate);
    const evil=await fetch(url+"/api/status", {method:"OPTIONS",headers:{Origin:"https://evil.example"}});
    assert.equal(evil.status,403);
    const brainAsk = await fetch(url + "/api/brain/ask", {method:"POST",headers:{
      Origin:origin,Authorization:"Bearer "+secret,"Content-Type":"application/json"
    },body:JSON.stringify({question:"qual é seu nome?"})});
    assert.equal(brainAsk.status,200);
    const answer=await brainAsk.json();
    assert.equal(answer.ok,true);
    assert.ok(typeof answer.answer?.text==="string");
    assert.equal(answer.source,"neural-local");
    const brainOutside = await fetch(url+"/api/brain/ask",{method:"POST",headers:{
      Origin:"https://evil.example",Authorization:"Bearer "+secret
    },body:"{}"});
    assert.equal(brainOutside.status,403);
    const linkResponse=await fetch(url+"/api/studio/link",{method:"POST",headers:{
      Origin:origin,Authorization:"Bearer "+secret
    }});
    assert.equal(linkResponse.status,200);
    const link=await linkResponse.json();
    assert.match(link.url,/^https:\/\/[a-z0-9.-]+\/\?studio=1#key=[A-Za-z0-9_-]{43}$/);
    assert.ok(!link.url.includes(secret),"Admin password leaked in source link");
    const denyStudio=await fetch(url+"/api/studio/link",{method:"POST",headers:{
      Origin:origin,Authorization:"Bearer invalid"
    }});
    assert.equal(denyStudio.status,401);
    const denyOtherOrigin=await fetch(url+"/api/studio/link",{method:"POST",headers:{
      Origin:"https://example.org",Authorization:"Bearer "+secret
    }});
    assert.equal(denyOtherOrigin.status,403);
    const brain = await fetch(url + "/api/brain/status", { headers: { Origin: origin, Authorization: "Bearer " + secret } });
    assert.equal(brain.status, 200);
    const engine=await brain.json();
    assert.equal(engine.stats.intents,49);
    assert.equal(engine.ollama,false);
    const ok = await fetch(url + "/api/status", { headers: { Origin: origin, Authorization: "Bearer " + secret } });
    assert.equal(ok.status, 502, "expected backend unavailable, not an auth error");
    console.log("Ponte autenticada: origem, senha, CORS e bloqueio do painel OK");
  } finally {
    child.kill("SIGTERM");
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
