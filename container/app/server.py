"""HTTP API for the container.

GET  /health     -> "ok"
GET  /questions  -> bundled questions
POST /search     -> {"city": "sapporo", "method": "C", "question_id": "groceries"}
                    or {"city": "sapporo", "method": "C", "question_text": "A place to eat ramen"}
"""
import json
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from search import Searcher

searcher = Searcher()
# One search at a time per container: each search already sends up to 16 requests in parallel.
lock = threading.Lock()


class Handler(BaseHTTPRequestHandler):
    def _send(self, status, body, ctype="application/json"):
        data = body if isinstance(body, bytes) else json.dumps(body, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", ctype + ("; charset=utf-8" if ctype.startswith("application/json") else ""))
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == "/health":
            return self._send(200, b"ok", "text/plain")
        if self.path == "/questions":
            return self._send(200, searcher.questions)
        return self._send(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/search":
            return self._send(404, {"error": "not found"})
        try:
            n = int(self.headers.get("Content-Length") or 0)
            if n > 4096:
                return self._send(413, {"error": "request too large"})
            req = json.loads(self.rfile.read(n) or b"{}")
            with lock:
                res = searcher.search(req.get("city", ""), req.get("method", "C"),
                                      req.get("question_id"), req.get("question_text"))
            return self._send(200, res)
        except ValueError as e:
            return self._send(400, {"error": str(e)})
        except Exception as e:  # report the failure without a stack trace
            return self._send(500, {"error": type(e).__name__, "detail": str(e)[:500]})

    def log_message(self, fmt, *args):
        print("%s %s" % (self.command, self.path), flush=True)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8080"))
    ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()
