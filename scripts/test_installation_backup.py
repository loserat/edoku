import importlib.util
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("backup", Path(__file__).with_name("installation_backup.py"))
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)


class InstallationBackupTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="edoku-backup-test-")
        self.base = Path(self.temp.name)
        self.root = self.base / "original"
        for name in backup.AREAS:
            (self.root / name).mkdir(parents=True)
        (self.root / "output/historisch").mkdir()
        (self.root / "output/historisch/Original.pdf").write_bytes(b"HISTORISCHER_BESTAND")
        (self.root / "config/einstellungen.json").write_text('{"name":"Beispiel"}')
        (self.root / ".env").write_text("SYNTHETIC_PRIVATE_VALUE=private\n")
        db = sqlite3.connect(self.root / "storage/app.db")
        db.execute("CREATE TABLE users (id TEXT, password_hash TEXT)")
        db.execute("INSERT INTO users VALUES ('synthetisch','BEHALTEN_HASH')")
        db.execute("CREATE TABLE sessions (token TEXT)")
        db.execute("INSERT INTO sessions VALUES ('BEHALTEN_SESSION')")
        db.commit(); db.close()
        self.destination = self.base / "backup"

    def tearDown(self):
        self.temp.cleanup()

    def test_complete_backup_restore_preserves_originals_and_historical_files(self):
        original = backup.inventory(self.root)
        manifest = backup.create_backup(self.root, self.destination)
        restored = self.base / "restored"
        backup.restore_backup(self.destination, restored)
        self.assertEqual(backup.inventory(self.root), original)
        self.assertEqual(backup.inventory(restored), original)
        self.assertEqual(backup.database_digest(restored), manifest["database"])
        self.assertEqual((restored / ".env").read_bytes(), (self.root / ".env").read_bytes())
        self.assertEqual(backup.validate_manifest(self.destination), manifest)
        self.assertEqual(self.destination.stat().st_mode & 0o777, 0o700)

    def test_existing_target_and_original_are_never_overwritten(self):
        backup.create_backup(self.root, self.destination)
        with self.assertRaises((ValueError, FileExistsError)):
            backup.restore_backup(self.destination, self.root)
        target = self.base / "exists"; target.mkdir(); (target / "keep").write_text("Original")
        with self.assertRaises(FileExistsError):
            backup.restore_backup(self.destination, target)
        self.assertEqual((target / "keep").read_text(), "Original")

    def test_corruption_is_detected_before_restore_creates_a_target(self):
        backup.create_backup(self.root, self.destination)
        (self.destination / "runtime/output/historisch/Original.pdf").write_text("manipuliert")
        with self.assertRaises(ValueError):
            backup.restore_backup(self.destination, self.base / "not-created")
        self.assertFalse((self.base / "not-created").exists())

    def test_manifest_traversal_and_external_links_are_rejected(self):
        backup.create_backup(self.root, self.destination)
        manifest = json.loads((self.destination / "manifest.json").read_text())
        manifest["files"]["../escape"] = {"type": "file"}
        (self.destination / "manifest.json").write_text(json.dumps(manifest))
        with self.assertRaises(ValueError):
            backup.validate_manifest(self.destination)

    def test_backup_cannot_be_created_inside_runtime_data(self):
        with self.assertRaises(ValueError):
            backup.create_backup(self.root, self.root / "storage/recursive-backup")
        self.assertFalse((self.root / "storage/recursive-backup").exists())


    def docker_metadata(self, running=True):
        return {"Image": "sha256:synthetic", "Config": {"Env": []}, "State": {"Running": running, "ExitCode": 0},
                "Mounts": [{"Destination": "/app/" + name, "Type": "bind", "Source": str(self.root / name)} for name in backup.AREAS]}

    def test_docker_stops_before_backup_and_restarts_after_copy_failure(self):
        metadata = self.docker_metadata()
        stopped = self.docker_metadata(False)
        with patch.object(backup, "docker", side_effect=[json.dumps([metadata]), "", json.dumps([stopped]), ""]) as docker, patch.object(backup, "create_backup", side_effect=OSError("copy failed")):
            with self.assertRaises(OSError):
                backup.create_with_docker(self.root, self.destination, "test-container", False)
        self.assertEqual(docker.call_args_list[1].args[0], ["stop", "--timeout", "30", "test-container"])
        self.assertEqual(docker.call_args_list[-1].args[0], ["start", "test-container"])

    def test_docker_wrong_mounts_are_rejected_before_stop(self):
        metadata = self.docker_metadata(); metadata["Mounts"][0]["Source"] = str(self.base / "other")
        with patch.object(backup, "docker", return_value=json.dumps([metadata])) as docker:
            with self.assertRaises(ValueError):
                backup.create_with_docker(self.root, self.destination, "test-container", False)
        self.assertEqual(docker.call_count, 1)
        self.assertFalse(self.destination.exists())

    def test_stopped_container_is_not_started_by_backup(self):
        metadata = self.docker_metadata(False)
        with patch.object(backup, "docker", return_value=json.dumps([metadata])) as docker:
            manifest = backup.create_with_docker(self.root, self.destination, "test-container", False)
        self.assertEqual(docker.call_count, 1)
        self.assertTrue(manifest["complete"])
        target = self.base / "restored-docker"; backup.restore_backup(self.destination, target)
        compose = json.loads((target / "compose.restore.json").read_text())
        self.assertEqual(compose["services"]["edoku"]["image"], metadata["Image"])
        self.assertEqual(compose["services"]["edoku"]["ports"], ["127.0.0.1:3104:3000"])

if __name__ == "__main__":
    unittest.main()
