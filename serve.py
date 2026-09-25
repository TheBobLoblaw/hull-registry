"""Hull Registry local server: serves the viewer, catalogue, models/ and blueprints/ from the folder this program lives in,
on http://localhost:8765/, and opens the browser. Built into HullRegistry.exe with PyInstaller (see BUILD.md); also runs as
`python serve.py`."""
import http.server, json, os, sys, webbrowser, threading
HERE = os.path.dirname(os.path.abspath(sys.executable if getattr(sys, "frozen", False) else __file__))
os.chdir(HERE)
PORT = 8765
class H(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, ".glb": "model/gltf-binary", ".json": "application/json", ".js": "text/javascript", ".mjs": "text/javascript"}
    def do_GET(self):
        if self.path.split("?")[0] == "/glb-index.json":   # which models are present: scanned from models/ every time
            idx = []
            for root, _, files in os.walk("models"):
                for f in files:
                    if f.lower().endswith(".glb"): idx.append(os.path.relpath(os.path.join(root, f), "models").replace(os.sep, "/")[:-4] + ".json")
            data = json.dumps(sorted(idx)).encode()
            self.send_response(200); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(data))); self.end_headers(); self.wfile.write(data); return
        super().do_GET()
    def end_headers(self):
        self.send_header("Cache-Control", "no-store"); super().end_headers()
    def log_message(self, *a): pass
missing = [d for d in ("models", "blueprints") if not os.path.isdir(d)]
print("Hull Registry  http://localhost:%d/   (close this window to stop)" % PORT)
if missing: print("note: no %s folder yet; see README.md for the download (the viewer still works, without %s)" % (" or ".join(missing), " or ".join("3D models" if d == "models" else "blueprint files" for d in missing)))
threading.Timer(1.0, lambda: webbrowser.open("http://localhost:%d/" % PORT)).start()
try: http.server.ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
except OSError as e: print("could not start (is another copy running?):", e); input("press Enter to close")
