"""Local relay for the DuckDB jev extension.

Some sandboxes add the API key at an HTTPS proxy instead of exposing it to programs.
The jev extension does not go through that proxy, so this relay accepts the extension's
requests on localhost and forwards them through the proxy (HTTPS_PROXY) unchanged.
Not needed when the key is set with `SET jev_api_key` or TYPESAFE_API_KEY.

Usage: python pipeline/jev_relay.py [port]   then   SET jev_api_url='http://127.0.0.1:<port>/v1/systemone'
"""
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import requests

UPSTREAM = "https://api.typesafe.ai"
_local = threading.local()


def session():
    s = getattr(_local, "s", None)
    if s is None:
        s = _local.s = requests.Session()
    return s


class Relay(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def _forward(self, method):
        n = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(n) if n else None
        headers = {k: v for k, v in self.headers.items()
                   if k.lower() in ("content-type", "authorization", "user-agent", "accept")}
        try:
            r = session().request(method, UPSTREAM + self.path, data=body, headers=headers, timeout=60)
            status, content, ctype = r.status_code, r.content, r.headers.get("Content-Type", "application/json")
        except requests.RequestException as e:
            status, content, ctype = 502, str(e).encode(), "text/plain"
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def do_POST(self):
        self._forward("POST")

    def do_GET(self):
        self._forward("GET")

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8787
    ThreadingHTTPServer(("127.0.0.1", port), Relay).serve_forever()
