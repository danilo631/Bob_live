#!/usr/bin/env python3
"""Adiciona sintetizador Web Speech ao Godot exportado, sem alterar upstream."""
from pathlib import Path
from sys import argv

game=Path(argv[1]) if len(argv)>1 else Path(__file__).resolve().parents[2]/".generated/game"
p=game/"scripts/main.gd"
s=p.read_text(encoding="utf-8")
def once(a,b):
  global s
  n=s.count(a)
  if n!=1: raise RuntimeError(f"main.gd: esperava 1 ocorrencia, encontrei {n}: {a!r}")
  s=s.replace(a,b)
once('var _more_coming: bool = false', '''var _more_coming: bool = false
var _browser_speech_job: String = ""
var _browser_mouth_t: float = 0.0''')
once('''func _process(delta: float) -> void:
\tif _loop_dance == "":''','''func _process(delta: float) -> void:
\tif OS.has_feature("web") and _browser_speech_job != "":
\t\t_browser_mouth_t += delta
\t\tcharacter.set_mouth(0.1 + 0.46 * absf(sin(_browser_mouth_t * 14.0)))
\t\tvar completed: Variant = JavaScriptBridge.eval("window.parent.bobLivePopFinished()", true)
\t\tif str(completed) == _browser_speech_job:
\t\t\tvar finished_job: String = _browser_speech_job
\t\t\t_browser_speech_job = ""
\t\t\tcharacter.set_mouth(0.0)
\t\t\t_on_clip_finished(finished_job, "speech")
\tif _loop_dance == "":''')
once('''\tif voice.is_active():
\t\t_speech_queue.append(p)
\telse:
\t\t_play_speech(p)''','''\tif voice.is_active() or _browser_speech_job != "":
\t\t_speech_queue.append(p)
\telse:
\t\t_play_speech(p)''')
once('''\tvar ok: bool = voice.play_clip(job, str(p.get("audio_path", "")), p.get("envelope", []), float(p.get("hop", 0.03)), "speech", "", 0.0, str(p.get("audio_base64", "")))''','''\tvar ok: bool = false
\tif OS.has_feature("web") and bool(p.get("browser_tts", false)):
\t\t_browser_speech_job = job
\t\t_browser_mouth_t = 0.0
\t\tvar request_data: String = JSON.stringify({"job_id": job, "text": str(p.get("text", ""))})
\t\tJavaScriptBridge.eval("window.parent.bobLiveSpeak(" + request_data + ")", true)
\t\tok = true
\telse:
\t\tok = voice.play_clip(job, str(p.get("audio_path", "")), p.get("envelope", []), float(p.get("hop", 0.03)), "speech", "", 0.0, str(p.get("audio_base64", "")))''')
once('''\tif not _speech_queue.is_empty() and not voice.is_active():''','''\tif not _speech_queue.is_empty() and not voice.is_active() and _browser_speech_job == "":''')
p.write_text(s,encoding="utf-8")
print("Godot Web Speech: callback de fim real e movimento de boca habilitados")
