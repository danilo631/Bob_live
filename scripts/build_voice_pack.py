#!/usr/bin/env python3
"""Gera pacote de respostas fixas para Piper em GitHub Actions; sem inferencia no Render."""
import hashlib, json, pathlib, sys

ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/"build"/"voices"
OUT.mkdir(parents=True,exist_ok=True)
data=json.loads((ROOT/"brain"/"intents.json").read_text(encoding="utf-8"))
responses=sorted({str(answer).strip() for intent in data["intents"] for answer in intent["answers"] if answer.strip()})
manifest={}
with (OUT/"piper.ndjson").open("w",encoding="utf-8") as feed:
    for text in responses:
        name=hashlib.sha256(text.encode("utf-8")).hexdigest()[:24]
        manifest[text]=name+".ogg"
        feed.write(json.dumps({"text":text,"output_file":str(OUT/(name+".wav"))},ensure_ascii=False)+"\n")
(OUT/"manifest.json").write_text(json.dumps({"version":1,"provider":"piper-pt_BR-faber-medium","answers":manifest},ensure_ascii=False,separators=(",",":")),encoding="utf-8")
print(f"Preparados {len(responses)} trechos de voz para Piper no Actions (sem custo de TTS por reproduzir).")
if len(responses)<120:
    sys.exit("Poucas respostas para gerar o pacote!")
