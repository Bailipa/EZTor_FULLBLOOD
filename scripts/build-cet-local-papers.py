import json,re,copy,subprocess,hashlib,unicodedata
from pathlib import Path
root=Path(__file__).resolve().parent.parent
manifest=json.loads((root/'content/cet-local/index.json').read_text())
report=json.loads((root/'.local-cet-import/conversion-report.json').read_text())
figure_info={}
audio_info=json.loads((root/'.local-cet-import/local-audio-info.json').read_text())
output=root/'content/cet-local/papers';output.mkdir(exist_ok=True)

def keys(asset,paper=False):
 result={};conflicts=set()
 def ranges(text):
  text=unicodedata.normalize('NFKC',text)
  for match in re.finditer(r'[【\[]?(\d{1,2})\s*[-–—~]\s*(\d{1,2})[】\]]?\s*([A-O](?:\s*[A-O]){1,9})(?![A-Za-z])',text):
   start,end=int(match[1]),int(match[2]);letters=re.sub(r'\s','',match[3])
   if end-start+1==len(letters):
    for n,l in enumerate(letters,start):add(n,l)

 def add(n,l):
  n=int(n);l=l.upper()
  if not 1<=n<=55 or l not in ('ABCD' if n<26 or n>45 else 'ABCDEFGHIJKLMNOPQRST'):return
  if n in result and result[n]!=l:conflicts.add(n)
  result[n]=l
 native=(root/'.local-cet-import/original-text'/f"{asset['id']}.txt").read_text()
 if paper:
  native=re.split(r'\bKEYS\b|【参考答案】',native,flags=re.I)[-1] if re.search(r'\bKEYS\b|【参考答案】',native) else ''
 # Explicit numbered answer entries, never derive answers from solution prose.
 ranges(native)
 lines=native.splitlines()
 for index,line in enumerate(lines[:-1]):
  numbers=re.findall(r'\d{1,2}',line)
  if not re.fullmatch(r'\s*\d{1,2}(?:\s+\d{1,2})+\s*',line):continue
  ns=list(map(int,numbers))
  if ns!=list(range(ns[0],ns[0]+len(ns))):continue
  following=next((v.strip() for v in lines[index+1:] if v.strip()),'')
  if not re.fullmatch(r'[A-O](?:\s+[A-O])+',following):continue
  letters=following.split()
  if len(ns)==len(letters):
   for n,l in zip(ns,letters):add(n,l)
 for n,l in re.findall(r'(?<!\d)(\d{1,2})\s*[.、]\s*(?:[【\[]答案[】\]]\s*)?([A-O])\s*[)）\].、]',native):add(n,l)
 for folder in ['source-ocr','source-ocr-en']:
  file=root/'.local-cet-import'/folder/f"{asset['id']}.json"
  if not file.exists():continue
  pages=json.loads(file.read_text());active=not paper
  if not paper:
   current=None;block=[]
   def flush():
    if current is None:return
    body='\n'.join(block)
    labels=re.findall(r'(?m)^\s*([A-O])\s*[)）]?\s*【(?:精析|语法判断|解析)',body)
    labels+=re.findall(r'([A-O])项为正确答案',body)
    labels+=re.findall(r'答案是\s*([A-O])项',body)
    labels+=re.findall(r'选项([A-O])[^。；]{0,40}因此为正确答案',body)
    labels+=re.findall(r'(?:本题)?答案为\s*([A-O])(?:[)）]|\b)',body)
    labels+=re.findall(r'(?:答案解析|答案解|解析)\s*([A-O])[。．]',body)
    labels+=re.findall(r'选项([A-O])(?:为)?正确',body)
    labels+=re.findall(r'本题(?:选|选择)\s*([A-O])',body)
    if 26<=current<=35:
     direct=re.match(r'^\s*([A-O])(?:[)）]?\s+)[a-z]',body)
     if direct:labels.append(direct[1])
    if len(set(labels))==1:add(current,labels[0])
   for page in pages:
    boxes=page['lines']
    full_width=not any(b['x']>=.5 and re.match(r'^\s*\d{1,2}\s*[.、](?!\d)',b['text']) for b in boxes)
    columns=[boxes] if full_width else [[b for b in boxes if (b['x']>=.5)==right] for right in [False,True]]
    for column in columns:
     for b in sorted(column,key=lambda b:(-round(b['y']+b['height']/2,2),b['x'])):
      value=unicodedata.normalize('NFKC',b['text'])
      match=re.match(r'^\s*(\d{1,2})\s*[.、](?!\d)',value)
      bare=re.fullmatch(r'\s*(3[6-9]|4\d|5[0-5])\s*',value)
      if match or bare:
       flush();current=int((match or bare)[1]);block=[value[match.end():] if match else '']
      elif current is not None:block.append(value)
   flush()
  for page in pages:
   if paper and any(re.search(r'\bKEYS\b|^【?参考答案】?$',b['text'].strip(),re.I) for b in page['lines']):active=True
   if not active:continue
   boxes=page['lines']
   for b in boxes:ranges(b['text'])
   for b in boxes:
    for n,l in re.findall(r'(?<!\d)(\d{1,2})\s*[.、]\s*(?:[【\[]答案[】\]]\s*)?([A-O])\s*[)）\].、]',b['text']):add(n,l)
    if not re.fullmatch(r'\d{1,2}',b['text'].strip()):continue
    n=int(b['text']);cx=b['x']+b['width']/2;cy=b['y']+b['height']/2
    near=[v for v in boxes if re.fullmatch(r'[A-Oa-o]',v['text'].strip()) and abs(v['x']+v['width']/2-cx)<.015 and .008<cy-v['y']-v['height']/2<.04]
    if len(near)==1:add(n,near[0]['text'].strip())
 return {n:l for n,l in result.items() if n not in conflicts}

parsed={i['key']:json.loads((root/'.local-cet-import/candidates'/f"{i['key']}.json").read_text()) for i in manifest['items'] if report[i['key']]['status']=='parsed'}
# Shared chapters are copied only where the printed source expressly says the complete chapters match.
shared={'cet4-2020-09-set3':'cet4-2020-09-set2','cet4-2022-09-set2':'cet4-2022-09-set1','cet4-2022-09-set3':'cet4-2022-09-set1'}
shared.update({'cet6-2020-09-set3':'cet6-2020-09-set2','cet6-2022-09-set2':'cet6-2022-09-set1','cet6-2022-09-set3':'cet6-2022-09-set1'})
reordered={f'{level}-2023-03-set{n}':f'{level}-2023-03-set1' for level in ['cet4','cet6'] for n in [2,3]}
shared.update(reordered)
revised=set(reordered)|{'cet6-2020-09-set3','cet6-2022-09-set2','cet6-2022-09-set3'}

summary=[]
for i in manifest['items']:
 key=i['key']
 if key not in parsed:continue
 d=copy.deepcopy(parsed[key]);paper=next(a for a in i['resources'] if a['id']==d['sourceId']);content=d['content'];ans={}
 for a in i['resources']:
  if a['category']=='answer':ans.update(keys(a))
 # Canonical paper key table takes precedence over a separately supplied commentary.
 ans.update(keys(paper,True))
 for stage,section in content.items():
  section['sourceFileUrl']=paper['url']
  for q in section['questions']:
   n=int(q['id'].split('-q')[-1]);l=ans.get(n);index=ord(l)-65 if l else -1
   if 0<=index<len(q['choices']):
    q['answerIndex']=index;q.pop('answerUnavailableReason',None);q['explanation']=f'原卷答案：{l}。'
 audio=next((a for a in i['resources'] if a['category']=='audio'),None)
 listen=content['LISTENING']
 if audio and listen['questions']:
  duration=float(audio_info[audio['id']]['format']['duration']);aid=key+'-audio'
  listen['audio']=[dict(id=aid,url=audio['url'],sourceUrl=audio['url'],durationSeconds=duration,transcript='',identity=f"{audio['name']} SHA256:{audio['sha256']}")]
  listen.pop('audioUnavailableReason',None)
  for q in listen['questions']:q['audioId']=aid
 writing=content['WRITING']
 if re.search(r'\b(?:chart|graph|table|picture|cartoon)\b',writing['prompt'],re.I):
  # The three chart questions in this local collection are on physical page 1.
  pages=json.loads((root/'.local-cet-import/source-ocr-en'/f"{paper['id']}.json").read_text())
  boundaries=[b for b in pages[0]['lines'] if 'Listening Comprehension' in b['text']]
  if not boundaries:raise ValueError('Writing figure boundary missing: '+key)
  prefix=root/'.local-cet-import/visual'/('writing-'+paper['id'])
  subprocess.run(['pdftoppm','-f','1','-l','1','-scale-to','1800','-png',str(root/'public'/paper['url'].lstrip('/')),str(prefix)],check=True,stderr=subprocess.DEVNULL)
  from PIL import Image
  source=next(prefix.parent.glob(prefix.name+'-*.png'))
  im=Image.open(source);cut=int((1-max(b['y']+b['height'] for b in boundaries)-.015)*im.height)
  figure=prefix.with_suffix('.png');im.crop((0,0,im.width,cut)).save(figure)
  data=figure.read_bytes();sha=hashlib.sha256(data).hexdigest();url='/study/resources/'+sha[:24]+'.png'
  (root/'public'/url.lstrip('/')).write_bytes(data)
  writing['promptImageUrl']=url
  writing['prompt']=re.split(r'(?i)(?<=200 words\.)',writing['prompt'],maxsplit=1)[0]
  figure_info[key]=dict(url=url,sha256=sha,sourceId=paper['id'],physicalPage=1)
 package=dict(slug=key+'-full',version=2 if key in revised else 1,title=i['title']+'整卷模拟真题',level=i['level'],kind='FULL',originType='PAST_EXAM',sourceName=manifest['sourceName'],sourceUrl=paper['url'],rightsHolder='原试卷及解析作者',rightsEvidence='用户提供本地资源并要求接入本地学习系统；原文件及校验值见 content/cet-local/index.json。未授权公开再分发或生产部署。',content=content)
 parsed[key]=package
for key,base in shared.items():
 if key not in parsed or base not in parsed or 'slug' not in parsed[key] or 'slug' not in parsed[base]:continue
 for stage in ['READING','LISTENING']:
  if not parsed[key]['content'][stage]['questions']:
   chapter=copy.deepcopy(parsed[base]['content'][stage])
   if key in reordered:chapter['sourceNotice']='原资料说明本套与第一套题目内容相同，但题序不同；本章练习按第一套题序展示，并使用第一套对应答案和录音。'
   elif key in revised:chapter['sourceNotice']='原资料明确说明本套本章与对应套题完全相同；已关联原题文及配套资源。'
   raw=json.dumps(chapter,ensure_ascii=False).replace(base,key);parsed[key]['content'][stage]=json.loads(raw)
for key,p in parsed.items():
 if 'slug' not in p:continue
 (output/(key+'.json')).write_text(json.dumps(p,ensure_ascii=False,indent=2)+'\n')
 qs=[q for stage in p['content'].values() for q in stage['questions']];summary.append(dict(key=key,questions=len(qs),graded=sum(q['answerIndex']>=0 for q in qs),audio=len(p['content']['LISTENING']['audio']),missingStages=[s for s,v in p['content'].items() if v.get('unavailableReason')],partialStages=[s for s,v in p['content'].items() if v.get('wordBankUnavailableReason') or v.get('matchingUnavailableReason')],sharedStages=[s for s,v in p['content'].items() if v.get('sourceNotice')]))
(root/'content/cet-local/conversion-status.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
(root/'content/cet-local/writing-figures.json').write_text(json.dumps(figure_info,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'packages':len(summary),'questions':sum(x['questions'] for x in summary),'graded':sum(x['graded'] for x in summary),'audio':sum(x['audio'] for x in summary)},ensure_ascii=False))
