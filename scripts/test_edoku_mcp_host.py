import importlib.util
import json
import os
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('edoku_host', Path(__file__).with_name('edoku-mcp-host.py'))
host = importlib.util.module_from_spec(spec)
spec.loader.exec_module(host)


class HostMcpTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.home = Path(self.directory.name)
        self.config = self.home / '.codex/edoku/connection.json'
        self.config.parent.mkdir(parents=True)
        self.config.write_text(json.dumps({'token': 'synthetic-secret-not-a-real-key', 'documentRoot': '/synthetic/allowed-documents'}))
        self.config.chmod(0o600)
        self.home_patch = patch.object(Path, 'home', return_value=self.home)
        self.home_patch.start()

    def tearDown(self):
        self.home_patch.stop()
        self.directory.cleanup()

    def test_secret_stays_out_of_argv_and_private_config_is_unchanged(self):
        before = self.config.read_bytes()
        node = shutil.which('node')
        self.assertIsNotNone(node)
        with patch.object(host.os, 'execve') as execute, patch.object(host.shutil, 'which', return_value=node):
            host.main()
        executable, arguments, environment = execute.call_args.args
        self.assertEqual(executable, node)
        self.assertNotIn('synthetic-secret-not-a-real-key', str(arguments))
        self.assertEqual(environment['EDOKU_API_TOKEN'], 'synthetic-secret-not-a-real-key')
        self.assertEqual(environment['EDOKU_API_URL'], 'http://127.0.0.1:3000')
        self.assertEqual(environment['EDOKU_MCP_DOCUMENT_ROOT'], '/synthetic/allowed-documents')
        self.assertEqual(before, self.config.read_bytes())

    def test_publicly_readable_configuration_is_refused(self):
        self.config.chmod(0o644)
        with patch.object(host.os, 'execve') as execute, self.assertRaises(RuntimeError):
            host.main()
        execute.assert_not_called()

    def test_symlink_configuration_is_refused(self):
        target = self.config.with_suffix('.real')
        self.config.rename(target)
        self.config.symlink_to(target)
        with patch.object(host.os, 'execve') as execute, self.assertRaises(RuntimeError):
            host.main()
        execute.assert_not_called()

    def test_missing_node_does_not_launch_any_other_command(self):
        with patch.object(host.shutil, 'which', return_value=None), patch.object(Path, 'is_file', return_value=False), patch.object(host.os, 'execve') as execute, self.assertRaises(RuntimeError):
            host.main()
        execute.assert_not_called()


if __name__ == '__main__':
    unittest.main()
