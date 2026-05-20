#!/usr/bin/env python3
"""Local forwarding proxy for the Capgemini Generative Engine LLM gateway.

The browser cannot call corporate LLM gateways directly because of CORS — most
gateways refuse arbitrary browser origins by design. This proxy sits on
localhost so the browser only ever sees a same-machine target, and forwards
the request to the real gateway with a Bearer token injected from your shell
environment. Your key never touches the browser, the repo, or chat logs.

Usage (PowerShell):

    $env:CAPGEMINI_KEY='paste-your-real-gateway-key-here'
    py scripts/proxy.py

Then in the demo's ⚙ API panel set Base URL = http://localhost:8787
and API key = anything non-empty (the proxy ignores it).

Environment variables:
  CAPGEMINI_KEY         (required) Bearer token issued by the gateway team.
  CAPGEMINI_BASE_URL    (optional) Defaults to https://openai.generative.engine.capgemini.com
  RCSA_PROXY_PORT       (optional) Port to listen on. Default 8787.
  RCSA_ALLOW_ORIGIN     (optional) CORS origin to allow. Default http://localhost:8000
"""

import http.server
import os
import socketserver
import sys
import urllib.error
import urllib.request


KEY          = os.environ.get('CAPGEMINI_KEY', '').strip()
UPSTREAM     = os.environ.get('CAPGEMINI_BASE_URL',
                              'https://openai.generative.engine.capgemini.com').rstrip('/')
PORT         = int(os.environ.get('RCSA_PROXY_PORT', '8787'))
ALLOW_ORIGIN = os.environ.get('RCSA_ALLOW_ORIGIN', 'http://localhost:8000')

ENDPOINT     = '/v1/chat/completions'
UPSTREAM_URL = UPSTREAM + ENDPOINT


def log(msg):
    print(msg, flush=True)


class ProxyHandler(http.server.BaseHTTPRequestHandler):
    # Suppress the default per-request access log; we print our own.
    def log_message(self, fmt, *args):
        pass

    def _send_cors(self):
        self.send_header('Access-Control-Allow-Origin', ALLOW_ORIGIN)
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
        self.send_header('Access-Control-Max-Age', '86400')

    def do_OPTIONS(self):
        if self.path != ENDPOINT:
            self.send_response(404); self.end_headers(); return
        self.send_response(204)
        self._send_cors()
        self.end_headers()
        log(f'OPTIONS {ENDPOINT} -> 204 (preflight)')

    def do_GET(self):
        # Tiny health endpoint so users can sanity-check the proxy is up.
        if self.path == '/' or self.path == '/health':
            body = (f'TPRM/RCSA proxy alive\n'
                    f'forwarding to {UPSTREAM_URL}\n').encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'text/plain; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self._send_cors()
            self.end_headers()
            self.wfile.write(body)
            return
        self.send_error(404)

    def do_POST(self):
        if self.path != ENDPOINT:
            self.send_error(404, 'Only POST /v1/chat/completions is proxied')
            return

        content_length = int(self.headers.get('Content-Length') or 0)
        body = self.rfile.read(content_length) if content_length else b''
        log(f'  -> upstream (request body {len(body)} bytes)')

        # Build the upstream request. Strip incoming Authorization (the
        # demo sends a placeholder); inject the real Bearer token from env.
        upstream_req = urllib.request.Request(
            UPSTREAM_URL,
            data=body,
            method='POST',
            headers={
                'Authorization': f'Bearer {KEY}',
                'Content-Type':  'application/json',
                'Accept':        'application/json',
            },
        )

        try:
            with urllib.request.urlopen(upstream_req, timeout=60) as resp:
                resp_body = resp.read()
                self.send_response(resp.status)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(resp_body)))
                self._send_cors()
                self.end_headers()
                self.wfile.write(resp_body)
                log(f'POST {ENDPOINT} -> {resp.status} ({len(resp_body)} bytes)')
        except urllib.error.HTTPError as e:
            # Upstream returned 4xx / 5xx — pass body straight through so the
            # demo's ai-client.js typed-error path can do its thing.
            err_body = b''
            try:
                err_body = e.read()
            except Exception:
                pass
            self.send_response(e.code)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(err_body)))
            self._send_cors()
            self.end_headers()
            self.wfile.write(err_body)
            log(f'POST {ENDPOINT} -> {e.code} (upstream error, {len(err_body)} bytes)')
        except urllib.error.URLError as e:
            msg = (f'{{"error":{{"message":"Proxy could not reach upstream: '
                   f'{e.reason}","type":"upstream_unreachable"}}}}').encode('utf-8')
            self.send_response(502)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(msg)))
            self._send_cors()
            self.end_headers()
            self.wfile.write(msg)
            log(f'POST {ENDPOINT} -> 502 (upstream unreachable: {e.reason})')


def main():
    if not KEY:
        sys.stderr.write(
            'CAPGEMINI_KEY is not set. Refusing to start.\n'
            '\n'
            'PowerShell:\n'
            '    $env:CAPGEMINI_KEY=\'your-real-gateway-key\'\n'
            '    py scripts/proxy.py\n'
            '\n'
            'cmd.exe:\n'
            '    set CAPGEMINI_KEY=your-real-gateway-key\n'
            '    py scripts/proxy.py\n'
        )
        sys.exit(2)

    socketserver.TCPServer.allow_reuse_address = True
    try:
        with socketserver.TCPServer(('127.0.0.1', PORT), ProxyHandler) as srv:
            log(f'TPRM/RCSA proxy listening on http://localhost:{PORT}')
            log(f'Forwarding to {UPSTREAM}')
            log(f'Allowing CORS origin: {ALLOW_ORIGIN}')
            log(f'Key loaded from CAPGEMINI_KEY ({len(KEY)} chars).')
            log('Open the demo (py scripts/serve.py in another terminal).')
            log('Stop with Ctrl+C.')
            try:
                srv.serve_forever()
            except KeyboardInterrupt:
                log('\nStopped.')
    except OSError as e:
        sys.stderr.write(
            f'\nCouldn\'t bind to port {PORT}: {e}\n'
            f'Try: $env:RCSA_PROXY_PORT=\'8788\'; py scripts/proxy.py\n'
        )
        sys.exit(1)


if __name__ == '__main__':
    main()
