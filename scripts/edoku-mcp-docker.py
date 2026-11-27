#!/usr/bin/env python3
"""Start the existing STDIO adapter in a local edoku container; never provision access."""
import json
import os
from pathlib import Path
import stat
import re
import shutil
import sys


def command(environment):
    docker = shutil.which('docker')
    if not docker:
        raise RuntimeError('Docker fehlt oder ist nicht erreichbar.')
    container = environment.get('EDOKU_MCP_CONTAINER', 'edoku_v1')
    if not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}', container):
        raise RuntimeError('Ungültiger Containername.')
    # -e NAME takes values from Docker's process environment, not command arguments.
    names = ['EDOKU_API_URL', 'EDOKU_API_TOKEN', 'EDOKU_MCP_ALLOW_WRITES',
             'EDOKU_MCP_DOCUMENT_ROOT', 'EDOKU_MCP_RESPONSE_MODE']
    args = [docker, 'exec', '-i', '--workdir', '/app']
    for name in names:
        args += ['--env', name]
    args += [container, 'node', 'scripts/edoku-mcp.js']
    env = {**environment, 'EDOKU_API_URL': environment.get('EDOKU_API_URL', 'http://127.0.0.1:3000'),
           'EDOKU_MCP_ALLOW_WRITES': environment.get('EDOKU_MCP_ALLOW_WRITES', 'false'),
           'EDOKU_MCP_DOCUMENT_ROOT': environment.get('EDOKU_MCP_DOCUMENT_ROOT', ''),
           'EDOKU_MCP_RESPONSE_MODE': environment.get('EDOKU_MCP_RESPONSE_MODE', 'structured')}
    return docker, args, env


def legacy_command(environment, connection):
    connection = Path(connection)
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
    environment = dict(environment, EDOKU_API_TOKEN=token)
    args = [str(docker), "exec", "-i", "-e", "EDOKU_API_TOKEN", "-e", "EDOKU_API_URL=http://127.0.0.1:3000",
            "-e", "EDOKU_MCP_ALLOW_WRITES=true", "-e", "EDOKU_MCP_DOCUMENT_ROOT=" + str(document_root),
            container, "node", "/app/scripts/edoku-mcp.js"]
    return str(docker), args, environment


def main():
    if len(sys.argv) > 2:
        raise RuntimeError("Zu viele Starterargumente.")
    mode = os.environ.get("EDOKU_MCP_LAUNCH_MODE", "")
    if len(sys.argv) == 1 and mode not in ("", "environment"):
        raise RuntimeError("Unbekannter Startmodus.")
    if len(sys.argv) == 2 or mode == "":
        connection = Path(sys.argv[1]) if len(sys.argv) == 2 else Path.home() / ".codex" / "edoku" / "connection.json"
        executable, args, env = legacy_command(os.environ, connection)
    else:
        executable, args, env = command(os.environ)
    os.execve(executable, args, env)


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('edoku-MCP konnte nicht starten. Docker, Container und Verbindungseinstellungen prüfen. Es wurden keine Zugänge geändert.', file=sys.stderr)
        sys.exit(1)
