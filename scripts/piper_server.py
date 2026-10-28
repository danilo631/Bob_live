#!/usr/bin/env python3
"""API local para voz Piper pt-BR, disponível apenas no runner."""
import argparse
import io
import json
import threading
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from piper import PiperVoice


def handler_factory(voice):
    lock = threading.Lock()

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, fmt, *args):
            print("[piper] " + fmt % args, flush=True)

        def reply(self, status, body, mime):
            self.send_response(status)
            self.send_header("Content-Type", mime)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            if self.path == "/health":
                self.reply(200, b'{"ok":true}', "application/json")
            else:
                self.reply(404, b'{"error":"not found"}', "application/json")

        def do_POST(self):
            if self.path != "/tts":
                return self.reply(404, b'{"error":"not found"}', "application/json")
            n = int(self.headers.get("Content-Length", "0"))
            if not 0 < n <= 8192:
                return self.reply(413, b'{"error":"invalid request size"}', "application/json")
            try:
                req = json.loads(self.rfile.read(n))
                phrase = str(req.get("text", "")).strip()[:350]
                if not phrase:
                    return self.reply(400, b'{"error":"empty text"}', "application/json")
                output = io.BytesIO()
                with lock:
                    with wave.open(output, "wb") as wav:
                        voice.synthesize_wav(phrase, wav)
                result = output.getvalue()
                if not result.startswith(b"RIFF") or len(result) <= 100:
                    raise ValueError("invalid WAV output")
                self.reply(200, result, "audio/wav")
            except Exception as e:
                print("[piper] falha: %s: %s" % (type(e).__name__, e), flush=True)
                self.reply(500, b'{"error":"voice synthesis failed"}', "application/json")

    return Handler


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--port", type=int, default=8022)
    args = parser.parse_args()
    model = Path(args.model).resolve()
    if not model.is_file() or not Path(str(model) + ".json").is_file():
        raise SystemExit("Missing .onnx or .onnx.json: %s" % model)
    voice = PiperVoice.load(str(model))
    print("[piper] pronto: %s" % model.name, flush=True)
    ThreadingHTTPServer(("127.0.0.1", args.port), handler_factory(voice)).serve_forever()
