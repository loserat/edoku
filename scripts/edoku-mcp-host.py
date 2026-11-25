#!/usr/bin/env python3
"""Local MCP adapter outside Docker; retained edoku data stays behind its API."""
import json
import os
from pathlib import Path
import shutil
import stat
import sys


def main():
    config_file = Path.home() / '.codex/edoku/connection.json'
    info = config_file.lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o077:
        raise RuntimeError('Die lokale MCP-Verbindungsdatei muss dem Benutzer gehören und ausschließlich privat lesbar sein.')
    config = json.loads(config_file.read_text())
    candidates = [shutil.which('node'), '/opt/homebrew/bin/node', '/usr/local/bin/node']
    node = next((value for value in candidates if value and Path(value).is_file() and os.access(value, os.X_OK)), None)
    if not node:
        raise RuntimeError('Für den lokalen MCP-Adapter fehlt Node.js. Der vorhandene Docker-Starter bleibt als Rückweg erhalten.')
    root = Path(__file__).resolve().parents[1]
    entry = root / 'scripts/edoku-mcp.js'
    if not entry.is_file():
        raise RuntimeError('Der lokale edoku-MCP-Einstieg wurde nicht gefunden.')
    # stdout belongs solely to MCP. Credentials never enter argv or log output.
    environment = {**os.environ, 'EDOKU_API_URL': 'http://127.0.0.1:3000',
                   'EDOKU_API_TOKEN': config['token'],
                   'EDOKU_MCP_DOCUMENT_ROOT': config['documentRoot'],
                   'EDOKU_MCP_ALLOW_WRITES': 'true'}
    os.execve(node, [node, str(entry)], environment)


if __name__ == '__main__':
    try:
        main()
    except Exception:
        # Exception payloads could contain invalid secret configuration values.
        print('Der lokale edoku-MCP-Adapter konnte nicht starten. Private Verbindungsdatei, Node.js und edoku-Pfad prüfen.', file=sys.stderr)
        sys.exit(1)
