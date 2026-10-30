"""Private Vollsicherung; Wiederherstellung ausschließlich in ein neues Verzeichnis."""
import argparse
import datetime
import fcntl
import hashlib
import json
import os
from pathlib import Path
import shutil
import sqlite3
import subprocess
import tempfile
import uuid

AREAS = ("data", "config", "storage", "output", "templates")
EXTRAS = (".env", "docker-compose.yml", "Dockerfile", "package.json", "package-lock.json")
SQLITE_FILES = {"storage/app.db" + suffix for suffix in ("", "-wal", "-shm", "-journal")}


def inside(base, candidate):
    try:
        candidate.relative_to(base)
        return True
    except ValueError:
        return False


def sha(file):
    with file.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def inventory(root):
    result = {}
    def walk(folder):
        for file in sorted(folder.iterdir()):
            key = file.relative_to(root).as_posix()
            if file.is_symlink():
                result[key] = {"type": "link", "target": os.readlink(file)}
            elif file.is_dir():
                result[key] = {"type": "directory"}
                walk(file)
            elif file.is_file():
                result[key] = {"type": "file", "size": file.stat().st_size, "sha256": sha(file)}
            else:
                raise ValueError("Nicht unterstützte Spezialdatei in der Sicherung.")
    for name in AREAS:
        if not (root / name).is_dir() or (root / name).is_symlink():
            raise ValueError("Laufzeitordner fehlt oder ist eine Verknüpfung: " + name)
        result[name] = {"type": "directory"}
        walk(root / name)
    return result


def database_digest(root):
    # Niemals die eigentliche Sicherung durch eine SQLite-Prüfung verändern.
    with tempfile.TemporaryDirectory(prefix="edoku-db-check-") as folder:
        for suffix in ("", "-wal", "-shm", "-journal"):
            source = root / ("storage/app.db" + suffix)
            if source.exists():
                if source.is_symlink():
                    raise ValueError("Datenbank darf keine Verknüpfung sein.")
                shutil.copy2(source, Path(folder) / ("app.db" + suffix))
        db = sqlite3.connect("file:" + str(Path(folder) / "app.db") + "?mode=ro", uri=True)
        try:
            if db.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
                raise ValueError("Datenbankintegrität fehlgeschlagen.")
            schema = db.execute("SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY type,name").fetchall()
            result = {"schema": hashlib.sha256(json.dumps(schema).encode()).hexdigest(), "tables": {}}
            for (name,) in db.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").fetchall():
                records = db.execute('SELECT * FROM "' + name.replace('"', '""') + '"').fetchall()
                records = sorted(json.dumps(row, default=lambda v: {"bytes": v.hex()}) for row in records)
                result["tables"][name] = {"count": len(records), "sha256": hashlib.sha256("\n".join(records).encode()).hexdigest()}
            return result
        finally:
            db.close()


def write_json(file, value):
    temporary = file.with_name(file.name + ".tmp")
    with temporary.open("x") as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2)
        stream.write("\n")
        stream.flush()
        os.fsync(stream.fileno())
    temporary.rename(file)


def validate_manifest(backup):
    if backup.is_symlink():
        raise ValueError("Sicherungsordner darf keine Verknüpfung sein.")
    manifest_file = backup / "manifest.json"
    if manifest_file.is_symlink():
        raise ValueError("Manifest darf keine Verknüpfung sein.")
    manifest = json.loads(manifest_file.read_text())
    if manifest.get("format") != "edoku-installation-backup" or manifest.get("version") != 1 or manifest.get("complete") is not True:
        raise ValueError("Unbekannte oder unvollständige Sicherung.")
    for name, item in manifest["files"].items():
        parts = Path(name).parts
        if not parts or Path(name).is_absolute() or ".." in parts or "\\" in name or parts[0] not in AREAS:
            raise ValueError("Unzulässiger Manifestpfad.")
        if item.get("type") == "link":
            # Sicherungen bewahren Verknüpfungen, aktivieren aber keine externen Ziele.
            target = Path(item["target"])
            if target.is_absolute() or not inside((backup / "runtime").resolve(), (backup / "runtime" / name).parent.joinpath(target).resolve()):
                raise ValueError("Externe Verknüpfung erfordert eine manuelle Prüfung.")
    runtime = backup / "runtime"
    if runtime.is_symlink():
        raise ValueError("Runtime darf keine Verknüpfung sein.")
    if inventory(runtime) != manifest["files"]:
        raise ValueError("Dateibestand oder Prüfsummen der Sicherung stimmen nicht.")
    for name, expected in manifest.get("artifacts", {}).items():
        if name not in (*EXTRAS, "image.tar", "container.json") or (backup / name).is_symlink() or sha(backup / name) != expected:
            raise ValueError("Zusatzdatei der Sicherung stimmt nicht.")
    if database_digest(runtime) != manifest["database"]:
        raise ValueError("Datenbankinhalt stimmt nicht mit der Sicherung überein.")
    return manifest


def create_backup(root, destination, metadata=None, save_image=None):
    root, destination = Path(root).resolve(), Path(destination).resolve()
    if any(inside(root / area, destination) for area in AREAS):
        raise ValueError("Sicherung muss außerhalb der Laufzeitordner liegen.")
    before = inventory(root)
    destination.mkdir(parents=True, exist_ok=False, mode=0o700)
    os.chmod(destination, 0o700)
    for name in AREAS:
        shutil.copytree(root / name, destination / "runtime" / name, symlinks=True)
    if before != inventory(root) or before != inventory(destination / "runtime"):
        raise ValueError("Daten wurden während der Sicherung verändert; keine Freigabe.")
    artifacts = {}
    for name in EXTRAS:
        source = root / name
        if source.is_file() and not source.is_symlink():
            shutil.copy2(source, destination / name)
            artifacts[name] = sha(destination / name)
    if metadata is not None:
        write_json(destination / "container.json", metadata)
        artifacts["container.json"] = sha(destination / "container.json")
    if save_image is not None:
        save_image(destination / "image.tar")
        artifacts["image.tar"] = sha(destination / "image.tar")
    manifest = {"format": "edoku-installation-backup", "version": 1, "complete": True,
                "createdAt": datetime.datetime.now(datetime.timezone.utc).isoformat(), "sourceRoot": str(root),
                "files": before, "database": database_digest(destination / "runtime"), "artifacts": artifacts}
    write_json(destination / "manifest.json", manifest)
    validate_manifest(destination)
    return manifest


def restore_backup(backup, target):
    backup, target = Path(backup).resolve(), Path(target).resolve()
    manifest = validate_manifest(backup)
    source = Path(manifest["sourceRoot"]).resolve()
    if target == source or inside(backup, target) or any(inside(source / name, target) for name in AREAS):
        raise ValueError("Wiederherstellung darf keine Originaldaten oder Sicherung überschreiben.")
    target.mkdir(parents=False, exist_ok=False, mode=0o700)
    try:
        for name in AREAS:
            shutil.copytree(backup / "runtime" / name, target / name, symlinks=True)
        for name in manifest.get("artifacts", {}):
            if name != "image.tar":
                shutil.copy2(backup / name, target / name)
        if inventory(target) != manifest["files"] or database_digest(target) != manifest["database"]:
            raise ValueError("Wiederhergestellte Daten stimmen nicht überein.")
        metadata = json.loads((backup / "container.json").read_text()) if (backup / "container.json").exists() else None
        if metadata:
            service = {"image": metadata["Image"], "ports": ["127.0.0.1:3104:3000"],
                       "volumes": ["./" + name + ":/app/" + name for name in AREAS],
                       "environment": metadata["Config"].get("Env", []), "restart": "no"}
            write_json(target / "compose.restore.json", {"services": {"edoku": service}})
        write_json(target / "restore-report.json", {"verified": True, "sourceBackup": str(backup), "database": manifest["database"]})
    except BaseException:
        # Nur das gerade exklusiv angelegte Ziel wird entfernt, niemals ein vorhandener Bestand.
        shutil.rmtree(target)
        raise
    return manifest


def docker(arguments):
    return subprocess.check_output(["docker", *arguments], text=True)


def create_with_docker(root, destination, container, include_image=True):
    root = Path(root).resolve()
    lock_dir = root / "backups"
    lock_dir.mkdir(exist_ok=True, mode=0o700)
    with (lock_dir / ".operation.lock").open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise ValueError("Eine andere Installationssicherung läuft bereits.")
        return _create_with_docker_locked(root, destination, container, include_image)


def _create_with_docker_locked(root, destination, container, include_image=True):
    root = Path(root).resolve()
    metadata = json.loads(docker(["inspect", container]))[0]
    mounts = {item["Destination"]: item for item in metadata["Mounts"]}
    for name in AREAS:
        mount = mounts.get("/app/" + name)
        if not mount or mount["Type"] != "bind" or Path(mount["Source"]).resolve() != root / name:
            raise ValueError("Container und angegebene Datenordner passen nicht zusammen.")
    running = metadata["State"]["Running"]
    try:
        if running:
            docker(["stop", "--timeout", "30", container])
            stopped = json.loads(docker(["inspect", container]))[0]
            if stopped["State"]["Running"] or stopped["State"]["ExitCode"] == 137:
                raise ValueError("Anwendung wurde nicht sauber angehalten; Sicherung abgebrochen.")
        save_image = (lambda file: docker(["image", "save", "--output", str(file), metadata["Image"]])) if include_image else None
        return create_backup(root, destination, metadata, save_image)
    finally:
        if running:
            docker(["start", container])


def main():
    parser = argparse.ArgumentParser(description="edoku vollständig sichern, prüfen und getrennt wiederherstellen")
    sub = parser.add_subparsers(dest="command", required=True)
    create = sub.add_parser("create")
    create.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    create.add_argument("--destination", type=Path)
    create.add_argument("--container", default="edoku_v1")
    create.add_argument("--no-image", action="store_true", help="Nur Daten sichern; passendes Abbild muss separat verfügbar bleiben")
    for command in ("verify", "restore"):
        item = sub.add_parser(command)
        item.add_argument("--backup", type=Path, required=True)
        if command == "restore":
            item.add_argument("--target", type=Path, required=True)
    args = parser.parse_args()
    os.umask(0o077)
    if args.command == "create":
        destination = args.destination or args.root / "backups" / (datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S") + "_" + uuid.uuid4().hex[:8])
        manifest = create_with_docker(args.root, destination, args.container, not args.no_image)
        print(json.dumps({"backup": str(destination.resolve()), "verified": True, "files": len(manifest["files"]), "imageIncluded": "image.tar" in manifest["artifacts"]}))
    elif args.command == "verify":
        manifest = validate_manifest(args.backup.resolve())
        print(json.dumps({"verified": True, "files": len(manifest["files"])}))
    else:
        restore_backup(args.backup, args.target)
        print(json.dumps({"restored": str(args.target.resolve()), "verified": True}))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        raise SystemExit("Sicherung/Wiederherstellung fehlgeschlagen: " + str(error))
