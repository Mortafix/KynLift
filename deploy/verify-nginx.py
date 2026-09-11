#!/usr/bin/env python3
"""Exercise the production Nginx template locally, without contacting Firebase.

Requires Python 3, OpenSSL and an Nginx build with SSL. All fixtures, keys and
process state live in a temporary directory; the supplied dist is only read.
"""

import argparse
import http.client
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
from pathlib import Path
import shutil
import socket
import ssl
import subprocess
import tempfile
import threading
import time


class AuthHelper(BaseHTTPRequestHandler):
    def do_GET(self):
        self.reply()

    def do_POST(self):
        self.reply()

    def reply(self):
        payload = self.rfile.read(int(self.headers.get("Content-Length", "0")))
        body = json.dumps({"method": self.command, "path": self.path,
                           "body": payload.decode(), "host": self.headers.get("Host")}).encode()
        self.send_response(404 if "missing" in self.path else 200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "public, max-age=3600")
        self.send_header("Content-Security-Policy", "default-src 'self'")
        self.send_header("X-Frame-Options", "SAMEORIGIN")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_args):
        pass


def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--nginx", default="nginx", help="Path to an SSL-enabled nginx binary")
    parser.add_argument("--dist", type=Path, help="Check an existing production build instead of fixtures")
    args = parser.parse_args()
    nginx = shutil.which(args.nginx)
    if not nginx:
        parser.error("Nginx non trovato. Installa Nginx o specifica --nginx /percorso/nginx.")
    if not shutil.which("openssl"):
        parser.error("OpenSSL non trovato.")

    template = Path(__file__).with_name("kinlift.moris.dev.conf.example").read_text()
    with tempfile.TemporaryDirectory(prefix="kynlift-nginx-") as directory:
        temp = Path(directory)
        root = temp / "site"
        if args.dist:
            shutil.copytree(args.dist.resolve(), root)
        else:
            root.mkdir()
            for name, text in {
                "index.html": '<html lang="it"><title>Kynlift</title><h1>Kynlift</h1></html>',
                "app.html": '<html><meta name="robots" content="noindex"><div id="root"></div></html>',
                "404.html": '<html><meta name="robots" content="noindex"><h1>Pagina non trovata</h1></html>',
                "sw.js": "/* service worker fixture */",
                "manifest.webmanifest": '{"name":"Kynlift"}',
                "robots.txt": "User-agent: *\nAllow: /\n",
                "sitemap.xml": '<?xml version="1.0"?><urlset/>',
                "assets/example-abc123.js": "export const app = 'Kynlift';",
            }.items():
                target = root / name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(text)
        for filename in ("index.html", "app.html", "404.html", "sw.js", "manifest.webmanifest", "robots.txt", "sitemap.xml"):
            if not (root / filename).is_file():
                parser.error(f"La build non contiene {filename}.")
        assets = sorted((root / "assets").glob("*.js"))
        if not assets:
            parser.error("La build non contiene asset JavaScript in assets/.")
        for filename in (".env", ".git/config", "assets/leak.map", "debug.log"):
            target = root / filename
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text("NOT PUBLIC")

        cert, key = temp / "cert.pem", temp / "key.pem"
        subprocess.run(["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes",
                        "-days", "1", "-subj", "/CN=localhost", "-addext",
                        "subjectAltName=DNS:localhost,IP:127.0.0.1", "-keyout", str(key),
                        "-out", str(cert)], check=True, stdout=subprocess.DEVNULL,
                       stderr=subprocess.DEVNULL)
        upstream = HTTPServer(("127.0.0.1", 0), AuthHelper)
        upstream_tls = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        upstream_tls.load_cert_chain(cert, key)
        upstream.socket = upstream_tls.wrap_socket(upstream.socket, server_side=True)
        thread = threading.Thread(target=upstream.serve_forever, daemon=True)
        thread.start()
        plain_port, secure_port = free_port(), free_port()
        while secure_port == plain_port:
            secure_port = free_port()
        config = template.replace("listen 80;", f"listen 127.0.0.1:{plain_port};")
        config = config.replace("listen 443 ssl;", f"listen 127.0.0.1:{secure_port} ssl;")
        config = config.replace("/var/www/kynlift/current", str(root))
        config = config.replace("/etc/letsencrypt/live/kinlift.moris.dev/fullchain.pem", str(cert))
        config = config.replace("/etc/letsencrypt/live/kinlift.moris.dev/privkey.pem", str(key))
        config = config.replace("/etc/ssl/certs/ca-certificates.crt", str(cert))
        config = config.replace("proxy_pass https://kynlift.firebaseapp.com;",
                                f"proxy_pass https://127.0.0.1:{upstream.server_port};\n        proxy_ssl_name localhost;")
        # The installed Nginx usually includes mime.types in its http context.
        config = "daemon off;\nmaster_process off;\npid nginx.pid;\nerror_log stderr warn;\nevents {}\nhttp {\naccess_log off;\ntypes { text/html html; application/javascript js; text/plain txt; }\n" + config + "\n}\n"
        config_path = temp / "nginx.conf"
        config_path.write_text(config)
        (temp / "logs").mkdir()
        invocation = [nginx, "-p", str(temp) + "/", "-c", str(config_path)]
        subprocess.run(invocation + ["-t"], check=True)
        process = subprocess.Popen(invocation, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        client_tls = ssl.create_default_context(cafile=str(cert))
        checks = 0

        def request(path, method="GET", body=None, plain=False, extra_headers=None):
            if plain:
                connection = http.client.HTTPConnection("127.0.0.1", plain_port, timeout=5)
            else:
                connection = http.client.HTTPSConnection("127.0.0.1", secure_port, context=client_tls, timeout=5)
            try:
                connection.request(method, path, body=body, headers=extra_headers or {})
                response = connection.getresponse()
                return response.status, dict((name.lower(), value) for name, value in response.getheaders()), response.read()
            finally:
                connection.close()

        def expect(path, status, body_file=None, cache="no-cache", private=False):
            nonlocal checks
            actual, headers, body = request(path)
            assert actual == status, (path, actual, status)
            assert headers["cache-control"] == cache, (path, headers)
            assert headers["x-content-type-options"] == "nosniff", (path, headers)
            assert headers["referrer-policy"] == "strict-origin-when-cross-origin", (path, headers)
            assert headers["permissions-policy"] == "camera=(), microphone=(), geolocation=()", (path, headers)
            assert headers["x-frame-options"] == "DENY", (path, headers)
            assert "frame-ancestors 'none'" in headers["content-security-policy"], (path, headers)
            assert headers.get("strict-transport-security") == "max-age=15552000", (path, headers)
            assert ("noindex" in headers.get("x-robots-tag", "")) == private, (path, headers)
            if body_file:
                assert body == (root / body_file).read_bytes(), path
            checks += 1
            return headers

        try:
            for _ in range(100):
                if process.poll() is not None:
                    raise RuntimeError(process.stderr.read().decode())
                try:
                    request("/")
                    break
                except (ConnectionRefusedError, OSError):
                    time.sleep(0.05)
            else:
                raise RuntimeError("Nginx non si è avviato in tempo.")

            expect("/", 200, "index.html")
            expect("/?source=test", 200, "index.html")
            for route in ("/allenamento", "/allenamento/sessione", "/allenamento/scheda/demo-id",
                          "/schede", "/catalogo", "/progressi", "/impostazioni", "/storico/demo-id"):
                expect(route, 200, "app.html", private=True)
            for route in ("/non-esiste", "/schede/non-esiste", "/app.html", "/404.html", "/assets/missing.js",
                          "/.env", "/.git/config", "/assets/leak.map", "/debug.log"):
                expect(route, 404, "404.html", private=True)
            for filename, mime in {"sw.js": "application/javascript", "manifest.webmanifest": "application/manifest+json",
                                   "robots.txt": "text/plain", "sitemap.xml": "application/xml"}.items():
                headers = expect("/" + filename, 200, filename)
                assert headers["content-type"].split(";")[0] == mime, (filename, headers)
            asset = assets[0].relative_to(root).as_posix()
            headers = expect("/" + asset, 200, asset, cache="public, max-age=31536000, immutable")
            status, cached, _ = request("/" + asset, extra_headers={"If-None-Match": headers["etag"]})
            assert status == 304 and "immutable" in cached["cache-control"], (status, cached)
            checks += 1
            status, headers, _ = request("/index.html?source=test")
            assert status == 308 and headers["location"].endswith("/?source=test"), (status, headers)
            checks += 1
            status, headers, _ = request("/schede?source=test", plain=True)
            assert status == 308 and headers["location"] == "https://kinlift.moris.dev/schede?source=test", (status, headers)
            checks += 1
            for path, method in (("/__/auth", "GET"), ("/__/auth/iframe?state=a%2Bb", "GET"),
                                 ("/__/auth/handler?state=a%2Bb", "POST"),
                                 ("/__/firebase/init.json", "GET"), ("/__/auth/missing", "GET")):
                status, headers, body = request(path, method, "state=some%2Bvalue" if method == "POST" else None)
                assert status == (404 if "missing" in path else 200), (path, status, body)
                payload = json.loads(body)
                assert payload["method"] == method and payload["path"] == path, payload
                assert payload["host"] == "kynlift.firebaseapp.com", payload
                if method == "POST":
                    assert payload["body"] == "state=some%2Bvalue", payload
                assert headers["cache-control"] == "no-store", headers
                assert headers["content-security-policy"] == "default-src 'self'", headers
                assert headers["x-frame-options"] == "SAMEORIGIN", headers
                assert "noindex" in headers["x-robots-tag"], headers
                checks += 1
            print(f"PASS: {checks} controlli Nginx (routing, cache, noindex, header, proxy OAuth GET/POST e TLS).")
        finally:
            process.terminate()
            try:
                process.communicate(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.communicate()
            upstream.shutdown()
            upstream.server_close()


if __name__ == "__main__":
    main()
