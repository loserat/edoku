import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('launcher',Path(__file__).with_name('edoku-mcp-docker.py'))
launcher=importlib.util.module_from_spec(spec);spec.loader.exec_module(launcher)
class LauncherTests(unittest.TestCase):
    def test_secret_never_enters_arguments_and_no_container_changes(self):
        with patch.object(launcher.shutil,'which',return_value='/usr/bin/docker'):
            exe,args,env=launcher.command({'EDOKU_API_TOKEN':'synthetic-secret','EDOKU_MCP_CONTAINER':'edoku-test'})
        self.assertEqual(exe,'/usr/bin/docker');self.assertNotIn('synthetic-secret',str(args));self.assertEqual(env['EDOKU_API_TOKEN'],'synthetic-secret')
        self.assertEqual(args[1:3],['exec','-i']);self.assertNotIn('-t',args);self.assertEqual(env['EDOKU_MCP_ALLOW_WRITES'],'false');self.assertEqual(env['EDOKU_MCP_RESPONSE_MODE'],'structured')
        self.assertEqual(args[-3:],['edoku-test','node','scripts/edoku-mcp.js'])
    def test_explicit_values_preserved(self):
        with patch.object(launcher.shutil,'which',return_value='/usr/bin/docker'):
            _,_,env=launcher.command({'EDOKU_MCP_ALLOW_WRITES':'true','EDOKU_API_URL':'https://example.test','EDOKU_MCP_DOCUMENT_ROOT':'/files'})
        self.assertEqual(env['EDOKU_API_URL'],'https://example.test');self.assertEqual(env['EDOKU_MCP_DOCUMENT_ROOT'],'/files');self.assertEqual(env['EDOKU_MCP_ALLOW_WRITES'],'true')
    def test_reject_bad_container_and_missing_docker(self):
        with patch.object(launcher.shutil,'which',return_value='/usr/bin/docker'):
            for value in ['--privileged','bad/name','x\ny','a'*129,'']:
                with self.assertRaises(RuntimeError):launcher.command({'EDOKU_MCP_CONTAINER':value})
        with patch.object(launcher.shutil,'which',return_value=None):
            with self.assertRaises(RuntimeError):launcher.command({})

class LegacyCompatibilityTests(unittest.TestCase):
    def test_private_configuration_keeps_previous_start_contract(self):
        import tempfile,json,os
        with tempfile.TemporaryDirectory() as temporary:
            folder=Path(temporary);docker=folder/'docker';docker.write_text('');docker.chmod(0o700)
            docs=folder/'documents';docs.mkdir();config=folder/'connection.json'
            token='edoku_'+'a'*24+'.'+'b'*64
            config.write_text(json.dumps({'docker':str(docker),'documentRoot':str(docs),'container':'edoku_legacy','token':token}));config.chmod(0o600)
            exe,args,env=launcher.legacy_command({},config)
            self.assertEqual(exe,str(docker));self.assertEqual(env['EDOKU_API_TOKEN'],token);self.assertNotIn(token,str(args))
            self.assertIn('EDOKU_MCP_ALLOW_WRITES=true',args);self.assertEqual(args[-3:],['edoku_legacy','node','/app/scripts/edoku-mcp.js'])
            config.chmod(0o644)
            with self.assertRaises(ValueError):launcher.legacy_command({},config)
    def test_explicit_config_path_takes_precedence_over_environment(self):
        with patch.object(launcher.sys,'argv',['starter.py','/private/connection.json']),patch.dict(launcher.os.environ,{'EDOKU_API_TOKEN':'ambient'}),patch.object(launcher,'legacy_command',return_value=('/docker',['/docker'],{})) as legacy,patch.object(launcher.os,'execve'):
            launcher.main();legacy.assert_called_once()
    def test_environment_mode_does_not_read_a_private_config(self):
        with patch.object(launcher.sys,'argv',['starter.py']),patch.dict(launcher.os.environ,{'EDOKU_API_TOKEN':'explicit','EDOKU_MCP_LAUNCH_MODE':'environment'}),patch.object(launcher,'command',return_value=('/docker',['/docker'],{})) as command,patch.object(launcher,'legacy_command') as legacy,patch.object(launcher.os,'execve'):
            launcher.main();command.assert_called_once();legacy.assert_not_called()

class DefaultCompatibilityTests(unittest.TestCase):
    def test_ambient_token_does_not_change_the_existing_default_starter(self):
        with patch.object(launcher.sys,'argv',['starter.py']),patch.dict(launcher.os.environ,{'EDOKU_API_TOKEN':'ambient','EDOKU_MCP_LAUNCH_MODE':''}),patch.object(launcher,'legacy_command',return_value=('/docker',['/docker'],{})) as legacy,patch.object(launcher,'command') as command,patch.object(launcher.os,'execve'):
            launcher.main();legacy.assert_called_once();command.assert_not_called()

class InvalidModeTests(unittest.TestCase):
    def test_invalid_mode_never_falls_back_to_private_credentials(self):
        with patch.object(launcher.sys,'argv',['starter.py']),patch.dict(launcher.os.environ,{'EDOKU_MCP_LAUNCH_MODE':'invalid'}),patch.object(launcher,'legacy_command') as legacy,patch.object(launcher.os,'execve') as execute:
            with self.assertRaises(RuntimeError):launcher.main()
            legacy.assert_not_called();execute.assert_not_called()

if __name__=='__main__':unittest.main()
