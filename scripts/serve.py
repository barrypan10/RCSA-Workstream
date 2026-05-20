#!/usr/bin/env python3
"""Local web server for the RCSA demo.

Serves docs/ at http://localhost:8000/ so the browser origin is a real URL.
Required when calling an LLM gateway from the demo: browsers block CORS
fetches from file:// origins before they ever reach the network, so live
AI calls only work when the demo is loaded over http://.

Usage:    py scripts/serve.py
Port override (PowerShell): $env:RCSA_DEMO_PORT='8765'; py scripts/serve.py
"""

import http.server
import os
import socketserver
import sys
import threading
import webbrowser
from pathlib import Path


PORT = int(os.environ.get('RCSA_DEMO_PORT', '8000'))


def main():
    docs = Path(__file__).resolve().parent.parent / 'docs'
    if not docs.is_dir():
        print(f'docs/ not found at {docs}', file=sys.stderr)
        sys.exit(1)

    os.chdir(docs)
    url = f'http://localhost:{PORT}/'
    print(f'Serving {docs} at {url}')
    print('Press Ctrl+C to stop.')

    # Open the browser shortly after the server has started binding.
    threading.Timer(0.5, lambda: webbrowser.open(url)).start()

    # Allow restart-after-Ctrl+C without "Address already in use" lingering.
    socketserver.TCPServer.allow_reuse_address = True
    handler = http.server.SimpleHTTPRequestHandler

    try:
        with socketserver.TCPServer(('localhost', PORT), handler) as srv:
            try:
                srv.serve_forever()
            except KeyboardInterrupt:
                print('\nStopped.')
    except OSError as e:
        print(
            f'\nCouldn\'t bind to port {PORT}: {e}\n'
            f'Try: $env:RCSA_DEMO_PORT=\'8765\'; py scripts/serve.py',
            file=sys.stderr,
        )
        sys.exit(1)


if __name__ == '__main__':
    main()
