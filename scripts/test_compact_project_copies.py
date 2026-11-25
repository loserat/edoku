import importlib.util,os,shutil,sqlite3,sys,tempfile,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('compact',Path(__file__).with_name('compact-project-copies.py'));compact=importlib.util.module_from_spec(spec);spec.loader.exec_module(compact)

@unittest.skipUnless(sys.platform=='darwin','APFS-Komprimierung ist ausschließlich für macOS vorgesehen')
class CopyCompactionTests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory(prefix='edoku-compact-test-');self.root=Path(self.temp.name);self.lib=compact.native()
  for name in compact.backup.AREAS:(self.root/name).mkdir()
  (self.root/'backups').mkdir();(self.root/'intern/abnahme').mkdir(parents=True)
  self.bytes=os.urandom(262144);(self.root/'output/probe.bin').write_bytes(self.bytes)
  db=sqlite3.connect(self.root/'storage/app.db');db.execute('CREATE TABLE retained(id INTEGER PRIMARY KEY,value TEXT)');db.execute("INSERT INTO retained VALUES(1,'retained')");db.commit();db.close()
  for name in ['one','two']:compact.backup.create_backup(self.root,self.root/'backups'/name)
 def tearDown(self):self.temp.cleanup()
 def test_independent_clones_preserve_backups_and_restore(self):
  plan=compact.make_plan(self.root,self.lib);self.assertGreater(plan['targetFiles'],0)
  report=compact.execute(self.root,plan,self.lib,self.root/'report.json');self.assertTrue(report['complete']);self.assertEqual(report['pathsRemoved'],0)
  a=self.root/'backups/one/runtime/output/probe.bin';b=self.root/'backups/two/runtime/output/probe.bin';self.assertNotEqual(a.stat().st_ino,b.stat().st_ino);self.assertEqual(a.stat().st_nlink,1);self.assertEqual(b.stat().st_nlink,1)
  compact.backup.restore_backup(self.root/'backups/one',self.root/'restored');self.assertEqual((self.root/'restored/output/probe.bin').read_bytes(),self.bytes)
  with b.open('r+b')as stream:stream.write(b'changed clone')
  self.assertEqual(a.read_bytes(),self.bytes);self.assertEqual((self.root/'output/probe.bin').read_bytes(),self.bytes)
 def test_changed_target_is_never_replaced(self):
  plan=compact.make_plan(self.root,self.lib);group=plan['groups'][0];a=self.root/group[0]['path'];b=self.root/group[1]['path'];before=a.read_bytes();b.write_bytes(b'new user contents')
  with self.assertRaisesRegex(RuntimeError,'Zieldatei'):compact.clone_duplicate(a,b,group[1],self.root,self.lib)
  self.assertEqual(a.read_bytes(),before);self.assertEqual(b.read_bytes(),b'new user contents')
 def test_runtime_and_symlink_paths_are_rejected(self):
  for path in ['storage/app.db','output/probe.bin','../outside','/private/tmp/elsewhere','.git/config']:
   with self.assertRaises(ValueError):compact.allowed(self.root,path,{'one'})
  (self.root/'backups/one/unsafe').symlink_to(self.root/'output',target_is_directory=True)
  with self.assertRaises(ValueError):compact.allowed(self.root,'backups/one/unsafe/probe.bin',{'one'})
 def test_reports_cannot_overwrite_runtime_or_evidence(self):
  for name in ['storage/app.db','output/report.json','intern/abnahme/report.json','backups/one/manifest.json']:
   with self.assertRaises(ValueError):compact.private_output(self.root,self.root/name)
  (self.root/'intern/reports').mkdir();self.assertEqual(compact.private_output(self.root,self.root/'intern/reports/result.json'),self.root/'intern/reports/result.json')
 def test_corrupt_backup_is_excluded_from_plan(self):
  (self.root/'backups/two/runtime/output/probe.bin').write_bytes(b'tampered backup')
  plan=compact.make_plan(self.root,self.lib);self.assertEqual(plan['verifiedBackups'],['one']);self.assertTrue(any(not item['verified']for item in plan['backupChecks']))

if __name__=='__main__':unittest.main()
