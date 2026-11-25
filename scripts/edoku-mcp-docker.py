"""Startet ausschließlich den stdio-MCP-Adapter im bestehenden edoku-Container.

Zugangsdaten liegen privat außerhalb des Repositories. stdout gehört nur MCP.
"""
import json
import os
from pathlib import Path
import re
import stat
import sys


def main():
    connection = Path(sys.argv[1]) if len(sys.argv) == 2 else Path.home() / ".codex" / "edoku" / "connection.json"
    info = connection.lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) & 0o077:
        raise ValueError("Die edoku-Verbindungsdatei muss dem Benutzer gehören und privat lesbar sein (0600).")
    settings = json.loads(connection.read_text())
    token, container = settings["token"], settings["container"]
    if not re.fullmatch(r"edoku_[a-f0-9]{24}\.[a-f0-9]{64}", token):
        raise ValueError("Ungültige edoku-Zugangsdaten.")
    if not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9_.-]*", container):
        raise ValueError("Ungültiger Containername.")
    docker = Path(settings["docker"])
    document_root = Path(settings["documentRoot"])
    if not docker.is_absolute() or not os.access(docker, os.X_OK) or not document_root.is_absolute() or not document_root.is_dir():
        raise ValueError("Docker oder der freigegebene Dokumentordner ist nicht verfügbar.")
    environment = dict(os.environ, EDOKU_API_TOKEN=token)
    args = [str(docker), "exec", "-i", "-e", "EDOKU_API_TOKEN", "-e", "EDOKU_API_URL=http://127.0.0.1:3000",
            "-e", "EDOKU_MCP_ALLOW_WRITES=true", "-e", "EDOKU_MCP_DOCUMENT_ROOT=" + str(document_root),
            container, "node", "/app/scripts/edoku-mcp.js"]
    os.execve(str(docker), args, environment)


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError, TypeError):
        # Weder Verbindungskonfiguration noch Ausnahmen mit Geheimnissen ausgeben.
        print("edoku MCP konnte nicht starten. Private Verbindungsdatei, Dokumentordner und Docker prüfen.", file=sys.stderr)
        sys.exit(1)
