#!/usr/bin/env python3
"""Teste deterministico das adaptacoes, sem baixar Godot ou modelos."""
from pathlib import Path

root = Path(__file__).resolve().parents[1]
game = root / ".generated/game"
server = root / ".generated/server"
bridge = (server / "src/bridge.js").read_text(encoding="utf-8")
main = (game / "scripts/main.gd").read_text(encoding="utf-8")
voice = (game / "scripts/voice_sync.gd").read_text(encoding="utf-8")
wav = (game / "scripts/wav_loader.gd").read_text(encoding="utf-8")
preset = (game / "export_presets.cfg").read_text(encoding="utf-8")
assert 'OS.has_feature("web")' in main, "nao protege launcher nativo no browser"
assert '"audio_base64"' in main, "Godot nao recebe WAV transmitido pelo backend"
assert 'Marshalls.base64_to_raw(audio_base64)' in voice, "Godot nao decodifica o WAV"
assert 'static func load_wav_bytes' in wav, "faltou loader de bytes para o navegador"
assert "process.env.BOB_PUBLIC_ORIGIN" in bridge and "https://danilo631.github.io" in bridge, "origem HTTPS configuravel nao autorizada"
assert "audio_base64: fs.readFileSync(file).toString('base64')" in bridge, "faltou ponte de audio"
assert "file.startsWith(root)" in bridge, "ausente protecao de caminho dos WAVs"
assert 'variant/thread_support=false' in preset, "export precisa ser sem threads"
assert 'name="Web"' in preset, "preset Web nao criado"
assert (root / "upstream/server/src/bridge.js").read_text(encoding="utf-8") != bridge, "alterou o submodulo"
print("Adaptacao Web validada: Godot, WebSocket, WAV, origem e preset.")
