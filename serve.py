"""Serve the Hull Registry from this folder on http://localhost:8765/ (models and blueprints stream from the VPS)."""
import http.server, os, webbrowser, threading
os.chdir(os.path.dirname(os.path.abspath(__file__)))
PORT = 8765
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store"); super().end_headers()
    def log_message(self, *a): pass
threading.Timer(1.0, lambda: webbrowser.open(f"http://localhost:{PORT}/")).start()
print(f"Hull Registry at http://localhost:{PORT}/  (close this window to stop)")
http.server.ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
