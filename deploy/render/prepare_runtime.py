#!/usr/bin/env python3
"""Cria somente o servidor Node no Render, sem Godot, Ollama ou Piper."""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "upstream/server"
DST = ROOT / ".generated/server"

def replace_once(path, before, after):
    s=path.read_text(encoding="utf-8")
    count=s.count(before)
    if count!=1: raise RuntimeError(f"Patch de {path.name} esperado 1 vez, encontrou {count}: {before[:80]!r}")
    path.write_text(s.replace(before,after),encoding="utf-8")

if not (SRC / "package-lock.json").is_file():
    raise SystemExit("Submodulo upstream nao encontrado; git submodule update --init")
if DST.exists():
    shutil.rmtree(DST)
shutil.copytree(SRC,DST,ignore=shutil.ignore_patterns(".env","node_modules","private","runs","venv-*","__pycache__"))
replace_once(DST/"src/index.js",
             "server.listen(cfg.PORT, '127.0.0.1', () => {",
             "server.listen(cfg.PORT, '127.0.0.1', () => {")
# O Render roda o TTS no browser, em outro processo, sem arquivos WAV e sem Python.
speech=DST/"src/speech.js"
replace_once(speech,
  "function synthesize(text) {\n  return (async () => {",
  '''function synthesize(text) {
  if (cfg.TTS_PROVIDER === 'browser') {
    const duration = Math.max(0.8, Math.min(20, text.length * 0.068));
    return Promise.resolve({
      text, file: '', browser_tts: true,
      lip: { duration, speechEnd: duration, hop: 0.03, envelope: [], segments: [] }
    });
  }
  return (async () => {''')
replace_once(speech,
  "        audio_path: c.file,",
  "        audio_path: c.file,\n        browser_tts: Boolean(c.browser_tts),")

# Rede neural pequena: Vercel autenticada (se conectada), fallback sempre local.
ai=DST/"src/ai.js"
replace_once(ai,"const cfg = require('./config');",
r"""const cfg = require('./config');
const localBrain = require('../../../brain');
async function neuralReply(question, name) {
  const remote = process.env.BRAIN_REMOTE_URL || '';
  const key = process.env.BRAIN_API_KEY || '';
  if (/^https:\/\/[a-z0-9-]+\.vercel\.app\/api\/brain$/.test(remote) && key.length >= 20) {
    try {
      const res = await fetch(remote, {
        method: 'POST',
        headers: {'Content-Type':'application/json','x-brain-key':key},
        body: JSON.stringify({question:String(question).slice(0,350),nickname:String(name).slice(0,40)}),
        signal: AbortSignal.timeout(1800),
      });
      if (res.ok) {
        const data=await res.json();
        if (typeof data.answer?.text === 'string' && data.answer.text.length < 230) return data.answer;
      }
    } catch { /* Vercel indisponivel: continuar offline */ }
  }
  return localBrain.answer(question, {nickname:name});
}""")
replace_once(ai,
"  const messages = [\n    { role: 'system', content: systemPrompt() },",
"""  // Sem chave: evite erro 401 e responda na rede neural local imediatamente.
  if (!sensitive && cfg.AI_PROVIDER === 'openai' && !cfg.OPENAI_API_KEY) {
    const reply = await neuralReply(message,name);
    if (reply) { yield reply.text; return; }
  }
  const messages = [
    { role: 'system', content: systemPrompt() },""")
replace_once(ai,
"  if (!spoken.length) {\n    log.warn('ia',",
"""  if (!spoken.length) {
    if (!sensitive) {
      const reply=await neuralReply(message,name);
      if (reply) { log.info('ia','fallback neural: '+reply.intent); yield reply.text; return; }
    }
    log.warn('ia',""")
replace_once(ai,
"  if (cfg.AI_PROVIDER !== 'ollama') {\n    const hasKey =",
"""  if (cfg.AI_PROVIDER === 'openai' && !cfg.OPENAI_API_KEY) {
    warm=true;
    log.ok('ia','Modelo neural pt-BR pronto: '+localBrain.stats().trainingExamples+' exemplos e '+localBrain.stats().intents+' intencoes.');
    return;
  }
  if (cfg.AI_PROVIDER !== 'ollama') {
    const hasKey =""")

# Sem logs de token, sem painel publico: a ponte entrega apenas as APIs permitidas.
print("Runtime Node para Render: TTS Browser preparado.")
