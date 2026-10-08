"""Copy and index user supplied CET archives, retaining original file checksums."""
import hashlib,json,re,zipfile
from pathlib import Path
root=Path(__file__).resolve().parent.parent
assets=[];archives=[]
for archive in [root/'四级/2022.zip',root/'六级/cet六级.zip']:
 if not archive.exists():continue
 before=archive.stat();digest=hashlib.sha256(archive.read_bytes()).hexdigest()
 with zipfile.ZipFile(archive) as z:
  for info in z.infolist():
   if info.is_dir():continue
   name=Path(info.filename).name
   m=re.fullmatch(r'cet([46])_(20\d{2})_(\d{2})_([123](?:-[123])?)(_ans)?\.(pdf|mp3)',name)
   if not m:raise ValueError('Unexpected archive entry: '+info.filename)
   level,year,month,sets,answer,extension=m.groups()
   if int(year)<2020:continue
   if (info.external_attr>>16)&0o170000==0o120000:raise ValueError('Symlink in source')
   data=z.read(info);sha=hashlib.sha256(data).hexdigest();identity=sha[:24]
   actual_extension='m4a' if extension=='mp3' and data[4:8]==b'ftyp' else extension
   target=root/'public/study/resources'/f'{identity}.{actual_extension}'
   target.parent.mkdir(parents=True,exist_ok=True)
   if not target.exists():target.write_bytes(data)
   if hashlib.sha256(target.read_bytes()).hexdigest()!=sha:raise ValueError('Copy checksum mismatch')
   assets.append(dict(id=identity,level='CET'+level,period=year+'.'+month,sets=[int(n) for n in sets.split('-')],category='audio' if extension=='mp3' else 'answer' if answer else 'paper',name=name,path=str(archive.relative_to(root))+'!/'+info.filename,url='/study/resources/'+target.name,sourceUrl=None,bytes=len(data),sha256=sha))
 after=archive.stat()
 if (before.st_size,before.st_mtime_ns)!=(after.st_size,after.st_mtime_ns):raise ValueError('Archive changed during import')
 archives.append(dict(path=str(archive.relative_to(root)),bytes=before.st_size,sha256=digest))
items=[]
for level,period in sorted({(a['level'],a['period']) for a in assets}):
 group=[a for a in assets if (a['level'],a['period'])==(level,period)]
 for n in sorted({n for a in group if a['category']=='paper' for n in a['sets']}):
  year,month=period.split('.')
  items.append(dict(key=f'{level.lower()}-{year}-{month}-set{n}',level=level,title=f'{year}年{int(month)}月 · 第{n}套',resources=[a for a in group if n in a['sets']]))
manifest=dict(sourceName='用户提供的本地四六级资料',minimumYear=2020,archives=archives,resourceCount=len(assets),periodCount=len({(a['level'],a['period']) for a in assets}),totalBytes=sum(a['bytes'] for a in assets),items=items)
out=root/'content/cet-local/index.json';out.parent.mkdir(exist_ok=True);out.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'sets':len(items),'resources':len(assets),'levels':{l:sum(i['level']==l for i in items) for l in ['CET4','CET6']}},ensure_ascii=False))
