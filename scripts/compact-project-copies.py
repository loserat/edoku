"""Lossless macOS/APFS compaction of verified backup/evidence copies; never hard-link files."""
import argparse,collections,ctypes,fcntl,hashlib,json,os,stat,sys,time,uuid
from pathlib import Path
import installation_backup as backup

def digest(file):
 with file.open('rb')as stream:return hashlib.file_digest(stream,'sha256').hexdigest()
def native():
 if sys.platform!='darwin':raise RuntimeError('Diese Kompaktierung benötigt macOS mit APFS-Klonunterstützung.')
 lib=ctypes.CDLL(None,use_errno=True)
 lib.clonefile.argtypes=[ctypes.c_char_p,ctypes.c_char_p,ctypes.c_int];lib.clonefile.restype=ctypes.c_int
 lib.listxattr.argtypes=[ctypes.c_char_p,ctypes.c_void_p,ctypes.c_size_t,ctypes.c_int];lib.listxattr.restype=ctypes.c_ssize_t
 lib.getxattr.argtypes=[ctypes.c_char_p,ctypes.c_char_p,ctypes.c_void_p,ctypes.c_size_t,ctypes.c_uint32,ctypes.c_int];lib.getxattr.restype=ctypes.c_ssize_t
 return lib

def attributes(file,lib):
 encoded=os.fsencode(file);size=lib.listxattr(encoded,None,0,0)
 if size<0:raise OSError(ctypes.get_errno(),'Dateiattribute nicht lesbar')
 if not size:return {}
 buf=ctypes.create_string_buffer(size);size=lib.listxattr(encoded,buf,size,0)
 if size<0:raise OSError(ctypes.get_errno(),'Dateiattribute haben sich geändert')
 result={}
 for name in sorted(filter(None,buf.raw[:size].split(b'\0'))):
  length=lib.getxattr(encoded,name,None,0,0,0)
  if length<0:raise OSError(ctypes.get_errno(),'Dateiattribut nicht lesbar')
  data=ctypes.create_string_buffer(length);actual=lib.getxattr(encoded,name,data,length,0,0)
  if actual!=length:raise RuntimeError('Dateiattribut hat sich geändert')
  result[os.fsdecode(name)]=hashlib.sha256(data.raw[:length]).hexdigest()
 return result

def entry(file,root,lib):
 st=file.lstat()
 if not stat.S_ISREG(st.st_mode)or st.st_nlink!=1:raise ValueError('Nur unabhängige reguläre Dateien sind zulässig')
 if st.st_flags & sum(getattr(stat,name,0)for name in ['UF_IMMUTABLE','UF_APPEND','SF_IMMUTABLE','SF_APPEND']):raise ValueError('Gesperrte Dateien bleiben unverändert')
 return {'path':file.relative_to(root).as_posix(),'size':st.st_size,'sha256':digest(file),'mtime_ns':st.st_mtime_ns,'mode':st.st_mode,'uid':st.st_uid,'gid':st.st_gid,'flags':st.st_flags,'attributes':attributes(file,lib)}
def comparable(value):return tuple(json.dumps(value[k],sort_keys=True)for k in ['size','sha256','mode','uid','gid','flags','attributes'])
def free_bytes(root):
 value=os.statvfs(root);return value.f_bavail*value.f_frsize

def make_plan(root,lib,min_bytes=65536):
 verified=[];checks=[]
 for folder in sorted((root/'backups').iterdir()):
  if not folder.is_dir()or folder.is_symlink()or not(folder/'manifest.json').is_file():continue
  try:
   manifest=backup.validate_manifest(folder);verified.append(folder);checks.append({'backup':folder.name,'verified':True,'files':len(manifest['files'])})
  except Exception as error:checks.append({'backup':folder.name,'verified':False,'reason':str(error)[:200]})
 sizes=collections.defaultdict(list);device=root.stat().st_dev
 for base in verified+[root/'intern/abnahme']:
  if not base.is_dir()or base.is_symlink():continue
  for directory,dirs,files in os.walk(base,followlinks=False):
   dirs[:]=[name for name in dirs if not(Path(directory)/name).is_symlink()]
   for name in files:
    file=Path(directory)/name;st=file.lstat()
    if stat.S_ISREG(st.st_mode)and st.st_nlink==1 and st.st_dev==device and st.st_size>=min_bytes and '.db'not in file.name and not(st.st_flags & sum(getattr(stat,n,0)for n in ['UF_IMMUTABLE','UF_APPEND','SF_IMMUTABLE','SF_APPEND'])):sizes[st.st_size].append(file)
 groups=collections.defaultdict(list);examined=0
 for paths in sizes.values():
  if len(paths)<2:continue
  for file in paths:
   value=entry(file,root,lib);groups[comparable(value)].append(value);examined+=1
 values=[group for group in groups.values()if len(group)>1]
 return {'format':'edoku-apfs-copy-plan','version':1,'root':str(root),'createdAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'verifiedBackups':[x.name for x in verified],'backupChecks':checks,'examinedFiles':examined,'targetFiles':sum(len(x)-1 for x in values),'logicalDuplicateBytes':sum(sum(x['size']for x in group[1:])for group in values),'groups':values}

def allowed(root,relative,verified):
 path=Path(relative)
 if path.is_absolute()or '..'in path.parts or not path.parts:raise ValueError('Unzulässiger Planpfad')
 parts=path.parts
 if not(len(parts)>=3 and parts[0]=='backups'and parts[1]in verified or len(parts)>=3 and parts[:2]==('intern','abnahme')):raise ValueError('Nur geprüfte Sicherungs- und Nachweiskopien sind zulässig')
 file=root/path
 current=root
 for part in parts:
  current=current/part
  if current.is_symlink():raise ValueError('Verknüpfte Planpfade sind nicht zulässig')
 if '.db'in file.name:raise ValueError('Datenbanken werden nicht kompakt umgeordnet')
 return file

def clone_duplicate(source,target,expected,root,lib):
 before=entry(target,root,lib)
 if before!=expected:raise RuntimeError('Zieldatei hat sich seit der Planung geändert: '+expected['path'])
 source_value=entry(source,root,lib)
 if comparable(source_value)!=comparable(expected):raise RuntimeError('Quelldatei stimmt nicht mehr überein')
 temporary=target.with_name('.edoku-clone-'+uuid.uuid4().hex+'.tmp')
 try:
  if lib.clonefile(os.fsencode(source),os.fsencode(temporary),0):raise OSError(ctypes.get_errno(),'APFS-Klon nicht möglich; keine Ersatzverknüpfung erstellt')
  st=target.stat();os.utime(temporary,ns=(st.st_atime_ns,st.st_mtime_ns),follow_symlinks=False)
  staged=entry(temporary,root,lib);staged['path']=expected['path']
  if staged!=expected:raise RuntimeError('Kloninhalt oder Metadaten weichen ab')
  if temporary.stat().st_ino==source.stat().st_ino:raise RuntimeError('Unabhängiger Dateiklon fehlt')
  with temporary.open('rb')as stream:os.fsync(stream.fileno())
  if entry(target,root,lib)!=expected:raise RuntimeError('Zieldatei während der Prüfung geändert')
  os.replace(temporary,target)
  if entry(target,root,lib)!=expected:raise RuntimeError('Abschlussprüfung des Klons fehlgeschlagen')
 finally:
  if temporary.exists():temporary.unlink()

def execute(root,plan,lib,report_path):
 if plan.get('format')!='edoku-apfs-copy-plan'or plan.get('version')!=1 or Path(plan['root'])!=root:raise ValueError('Plan gehört nicht zu diesem Projekt')
 verified=set(plan['verifiedBackups']);before=free_bytes(root);completed=[];seen=set()
 if any(not isinstance(name,str)or Path(name).name!=name or name in ['.','..']or(root/'backups'/name).is_symlink()for name in verified):raise ValueError('Ungültige Sicherungsauswahl')
 for name in sorted(verified):backup.validate_manifest(root/'backups'/name)
 try:
  for group in plan['groups']:
   source=allowed(root,group[0]['path'],verified)
   if entry(source,root,lib)!=group[0]:raise RuntimeError('Klonquelle seit Planung geändert')
   for expected in group[1:]:
    target=allowed(root,expected['path'],verified)
    if target==source or target in seen:raise ValueError('Doppeltes oder identisches Klonziel')
    seen.add(target);clone_duplicate(source,target,expected,root,lib);completed.append(expected['path'])
    if len(completed)%500==0:print(json.dumps({'filesVerifiedAndCloned':len(completed)}),flush=True)
  for name in sorted(verified):backup.validate_manifest(root/'backups'/name)
  report={'complete':True,'filesCloned':len(completed),'logicalDuplicateBytes':plan['logicalDuplicateBytes'],'volumeFreeBefore':before,'volumeFreeAfter':free_bytes(root),'allBackupManifestsVerified':True,'hardLinksCreated':0,'pathsRemoved':0}
 except BaseException:
  report_path.write_text(json.dumps({'complete':False,'filesCloned':len(completed),'completed':completed},indent=2));raise
 report_path.write_text(json.dumps(report,indent=2));return report

def private_output(root,file):
 file=Path(os.path.abspath(file));folder=root/'intern'
 if not file.is_relative_to(folder)or file.is_relative_to(folder/'abnahme')or file.suffix!='.json':raise ValueError('Ausgabe nur als private JSON-Datei unter intern, außerhalb der Abnahmen')
 current=root
 for part in file.relative_to(root).parts:
  current=current/part
  if current.is_symlink():raise ValueError('Verknüpfte Ausgabepfade sind nicht zulässig')
 if not file.parent.is_dir():raise ValueError('Privaten Ausgabeordner vorher anlegen')
 return file

def main():
 parser=argparse.ArgumentParser(description='Identische geprüfte edoku-Sicherungsdateien auf APFS platzsparend und unabhängig erhalten')
 parser.add_argument('command',choices=['plan','execute']);parser.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1]);parser.add_argument('--plan',type=Path,required=True);parser.add_argument('--report',type=Path)
 args=parser.parse_args();root=args.root.resolve();lib=native();os.umask(0o077)
 if args.command=='plan':args.plan=private_output(root,args.plan)
 if args.report:args.report=private_output(root,args.report)
 with(root/'backups/.operation.lock').open('a')as lock:
  fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  if args.command=='plan':
   plan=make_plan(root,lib);args.plan.write_text(json.dumps(plan,indent=2));print(json.dumps({k:v for k,v in plan.items()if k not in ['groups','backupChecks','verifiedBackups']}))
  else:
   if not args.report:raise ValueError('--report ist für die Abschlussprüfung erforderlich')
   plan=json.loads(args.plan.read_text());print(json.dumps(execute(root,plan,lib,args.report)))
if __name__=='__main__':
 try:main()
 except Exception as error:raise SystemExit('Kompaktierung abgebrochen: '+str(error))
