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
# Sem logs de token, sem painel publico: a ponte entrega apenas as APIs permitidas.
print("Runtime Node para Render: TTS Browser preparado.")
