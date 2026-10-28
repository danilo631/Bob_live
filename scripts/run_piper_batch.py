#!/usr/bin/env python3
"""Sintese em lote com API Python do Piper 1.8, para arquivos individuais seguros."""
import json
import sys
import wave
from pathlib import Path
from piper import PiperVoice

def main():
    if len(sys.argv) != 3:
        raise SystemExit("Uso: run_piper_batch.py modelo.onnx input.ndjson")
    model_path = Path(sys.argv[1]).resolve()
    feed_path = Path(sys.argv[2]).resolve()
    voice = PiperVoice.load(str(model_path))
    target_root=feed_path.parent.resolve()
    count=0
    for line in feed_path.read_text(encoding="utf-8").splitlines():
        entry=json.loads(line)
        text=str(entry.get("text","")).strip()
        if not text or len(text)>300: raise ValueError("Texto invalido")
        target=Path(entry["output_file"]).resolve()
        if target.parent!=target_root or target.suffix!=".wav":
            raise ValueError("Tentativa de gravar audio fora do diretorio permitido")
        with wave.open(str(target),"wb") as output:
            voice.synthesize_wav(text,output)
        if target.stat().st_size<500:raise RuntimeError("Audio gerado vazio")
        count+=1
        if count%20==0:
            print(f"Piper: {count} audios gerados",flush=True)
    print(f"Piper: {count} arquivos WAV validos",flush=True)
    if count<120:raise RuntimeError("Geracao incompleta")

if __name__=="__main__":
    main()
