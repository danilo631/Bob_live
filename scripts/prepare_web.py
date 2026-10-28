#!/usr/bin/env python3
"""Prepara Godot Web e servidor local sem editar o submodulo original."""
import argparse
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
UPSTREAM = ROOT / "upstream"
OUTPUT = ROOT / ".generated"


def replace_once(path: Path, old: str, new: str):
    contents = path.read_text(encoding="utf-8")
    occurrences = contents.count(old)
    if occurrences != 1:
        raise RuntimeError(f"{path}: esperava 1 ocorrencia do trecho, achei {occurrences}: {old[:70]!r}")
    path.write_text(contents.replace(old, new), encoding="utf-8")


def prepare():
    if not (UPSTREAM / "game/project.godot").exists():
        raise RuntimeError("Submodulo ausente. Use git submodule update --init --recursive")
    OUTPUT.mkdir(exist_ok=True)
    game = OUTPUT / "game"
    server = OUTPUT / "server"
    for target, source in ((game, UPSTREAM / "game"), (server, UPSTREAM / "server")):
        if target.exists():
            shutil.rmtree(target)
        shutil.copytree(
            source,
            target,
            ignore=shutil.ignore_patterns(".godot", "node_modules", ".env", "runs", "private", "venv-*", "__pycache__"),
        )

    main = game / "scripts/main.gd"
    replace_once(
        main,
        "\tadd_child(ServerLauncher.new())  # abre o servidor da live junto com o jogo",
        "\tif not OS.has_feature(\"web\"):\n\t\tadd_child(ServerLauncher.new())  # somente executavel nativo",
    )
    replace_once(
        main,
        'float(p.get("hop", 0.03)))',
        'float(p.get("hop", 0.03)), "speech", "", 0.0, str(p.get("audio_base64", "")))',
    )

    voice = game / "scripts/voice_sync.gd"
    replace_once(
        voice,
        'vocal_path: String = "", volume_db: float = 0.0) -> bool:',
        'vocal_path: String = "", volume_db: float = 0.0, audio_base64: String = "") -> bool:',
    )
    replace_once(
        voice,
        "var stream: AudioStreamWAV = WavLoader.load_wav(audio_path)",
        'var stream: AudioStreamWAV = WavLoader.load_wav_bytes(Marshalls.base64_to_raw(audio_base64)) if audio_base64 != "" else WavLoader.load_wav(audio_path)',
    )

    wav = game / "scripts/wav_loader.gd"
    replace_once(
        wav,
        'var bytes: PackedByteArray = FileAccess.get_file_as_bytes(path)\n\tif bytes.size() < 44',
        'return load_wav_bytes(FileAccess.get_file_as_bytes(path))\n\nstatic func load_wav_bytes(bytes: PackedByteArray) -> AudioStreamWAV:\n\tif bytes.size() < 44',
    )

    # Nenhum acesso ao disco no Web: o WAV vai pelo WebSocket em base64.
    replace_once(wav, '"WavLoader: arquivo invalido: %s" % path', '"WavLoader: arquivo WAV invalido"')
    replace_once(wav, '"WavLoader: wav sem dados: %s" % path', '"WavLoader: WAV sem dados"')

    # A pagina estaticamente publicada guarda URL e credencial apenas na sessao do navegador.
    replace_once(
        main,
        'var url: String = OS.get_environment("LIVE_WS_URL")\n\tif url != "":\n\t\tbridge.url = url',
        '''var url: String = OS.get_environment("LIVE_WS_URL")
    if OS.has_feature("web"):
        var browser_url: Variant = JavaScriptBridge.eval("window.sessionStorage.getItem('bob_live_ws')", true)
        if browser_url is String and str(browser_url).begins_with("wss://"):
            url = str(browser_url)
        else:
            url = "wss://no-session.invalid/ws/godot"
    if url != "":
        bridge.url = url'''.replace("    ", "\t"),
    )

    backend_entry = server / "src/index.js"
    replace_once(
        backend_entry,
        "server.listen(cfg.PORT, '127.0.0.1', () => {",
        "server.listen(cfg.PORT, process.env.BOB_CONTAINER === '1' ? '0.0.0.0' : '127.0.0.1', () => {",
    )

    bridge = server / "src/bridge.js"
    replace_once(bridge, "const EventEmitter = require('events');", "const EventEmitter = require('events');\nconst fs = require('fs');\nconst path = require('path');")
    replace_once(bridge, "this.socket = null;\n    this.lastByType = {};",
                 "this.socket = null;\n    this.webClient = false;\n    this.lastByType = {};")
    replace_once(
        bridge,
        "const verifyClient = ({ origin }) => !origin || /^https?:\\/\\/(127\\.0\\.0\\.1|localhost)(:\\d+)?$/.test(origin);",
        "const verifyClient = ({ origin }) => !origin || /^https?:\\/\\/(127\\.0\\.0\\.1|localhost)(:\\d+)?$/.test(origin) || origin === (process.env.BOB_PUBLIC_ORIGIN || 'https://danilo631.github.io');",
    )
    replace_once(bridge, "wss.on('connection', (ws) => {",
                 "wss.on('connection', (ws, req) => {\n      this.webClient = req.headers.origin === (process.env.BOB_PUBLIC_ORIGIN || 'https://danilo631.github.io');")
    replace_once(bridge, "if (this.socket === ws) this.socket = null;",
                 "if (this.socket === ws) { this.socket = null; this.webClient = false; }")
    replace_once(
        bridge,
        "this.socket.send(JSON.stringify({ time: Date.now() / 1000, ...msg }));",
        """let outgoing = msg;
      // No navegador o caminho C:\\\\... WAV nao existe. Enviamos o WAV ao Godot via WS.
      if (this.webClient && msg.type === 'speech_ready' && msg.payload?.audio_path) {
        const file = path.resolve(String(msg.payload.audio_path));
        const root = path.resolve(__dirname, '..', 'runs', 'audio') + path.sep;
        if (!file.startsWith(root)) throw new Error('audio fora do diretorio da live');
        const st = fs.statSync(file);
        if (st.size > 8 * 1024 * 1024) throw new Error('WAV excede limite de 8 MB');
        outgoing = { ...msg, payload: { ...msg.payload, audio_base64: fs.readFileSync(file).toString('base64') } };
      }
      this.socket.send(JSON.stringify({ time: Date.now() / 1000, ...outgoing }));""",
    )

    export = game / "export_presets.cfg"
    with export.open("a", encoding="utf-8") as out:
        out.write("""
[preset.1]

name="Web"
platform="Web"
runnable=true
advanced_options=false
dedicated_server=false
custom_features=""
export_filter="all_resources"
include_filter=""
exclude_filter="tools/*"
export_path="../site/game/index.html"
patches=PackedStringArray()
encryption_include_filters=""
encryption_exclude_filters=""
seed=0
encrypt_pck=false
encrypt_directory=false
script_export_mode=2

[preset.1.options]

custom_template/debug=""
custom_template/release=""
variant/extensions_support=false
variant/thread_support=false
vram_texture_compression/for_desktop=true
vram_texture_compression/for_mobile=false
html/export_icon=true
html/custom_html_shell=""
html/head_include=""
html/canvas_resize_policy=2
html/focus_canvas_on_start=true
html/experimental_virtual_keyboard=false
progressive_web_app/enabled=false
""")
    shutil.copy2(UPSTREAM / "LICENSE", OUTPUT / "LICENSE-original.txt")
    shutil.copy2(UPSTREAM / "NOTICE.md", OUTPUT / "NOTICE-original.md")
    print(f"Versao web: {game}\nServidor local: {server}")


if __name__ == "__main__":
    argparse.ArgumentParser(description=__doc__).parse_args()
    prepare()
