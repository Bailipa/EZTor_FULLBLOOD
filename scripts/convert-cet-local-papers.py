import json,re,unicodedata
from pathlib import Path
root=Path(__file__).resolve().parent.parent
manifest=json.loads((root/'content/cet-local/index.json').read_text())
output=root/'.local-cet-import/candidates';output.mkdir(exist_ok=True)

def normalize(raw):
    raw=unicodedata.normalize('NFKC',raw).replace('\r','')
    # PDF fonts sometimes encode visually identical Latin option labels as Cyrillic/Greek.
    glyphs={'А':'A','В':'B','С':'C','Е':'E','Н':'H','І':'I','Ј':'J','К':'K','М':'M','О':'O','Р':'P','Т':'T','Χ':'X','Α':'A','Β':'B','Ε':'E','Η':'H','Ι':'I','Κ':'K','Μ':'M','Ν':'N','Ο':'O','Ρ':'P','Τ':'T'}
    raw=re.sub(r'(['+''.join(glyphs)+r'])(?=\s*[)\]])',lambda m:glyphs[m[1]],raw)
    raw=re.sub(r'【原卷物理页 \d+】','',raw)
    raw=re.sub(r'(?m)^.*(?:第\s*\d+\s*页|[四六]级\s*20\d{2}\s*年\s*\d+).*\n','',raw)
    raw=re.sub(r'(?m)^.*(?:扫码|淘宝|微信|考研|公众号).*\n','',raw)
    raw=re.sub(r'(?m)^[- ]*(\d{1,2})[.]\s*[- ]*([ABCD])(?=[)])',r'\1. \2',raw)
    raw=re.sub(r'(?m)^\s*([lI])\s*[.]\s*(?=A\s*[)])','1. ',raw)
    raw=re.sub(r'(?<=\S)[ \t]+(\d{1,2}\s*[.]\s*A\s*[)])',r'\n\1',raw)
    return raw

def text(asset,mode='hybrid'):
    native=(root/'.local-cet-import/original-text'/f"{asset['id']}.txt").read_text()
    ocr=root/'.local-cet-import/source-ocr'/f"{asset['id']}.json"
    en=root/'.local-cet-import/source-ocr-en'/f"{asset['id']}.json"
    if mode=='en' and en.exists():ocr=en
    if mode=='native' or not ocr.exists():return normalize(native)
    pages=json.loads(ocr.read_text());lines=[]
    zhpages=json.loads((root/'.local-cet-import/source-ocr'/f"{asset['id']}.json").read_text()) if mode=='en' and en.exists() else []
    native_pages=re.split(r'【原卷物理页 \d+】',native)[1:]
    for index,page in enumerate(pages):
        part=native_pages[index] if index<len(native_pages) else ''
        words=re.findall(r'[A-Za-z]+',part)
        ocr_words=' '.join(b['text'] for b in page['lines'])
        headings=['Writing','Translation','Reading','Listening']
        missing_heading=any(h in ocr_words and h not in part for h in headings)
        if mode=='hybrid' and not missing_heading and sum(map(len,words))>300 and sum(map(len,words))/max(1,len(words))<8 and '\ufffd' not in part:
            lines.append(part);continue
        boxes=page['lines']
        if zhpages:
            # Keep Chinese translation lines from the local bilingual recognition pass.
            for box in boxes:
                near=[z for z in zhpages[index]['lines'] if abs(z['y']-box['y'])<.01 and abs(z['x']-box['x'])<.035]
                if near:
                    z=min(near,key=lambda z:abs(z['y']-box['y'])+abs(z['x']-box['x']))
                    cjk=sum('\u4e00'<=c<='\u9fff' for c in z['text'])
                    if cjk/max(1,len(z['text']))>.25:box['text']=z['text']
            for z in zhpages[index]['lines']:
                cjk=sum('\u4e00'<=c<='\u9fff' for c in z['text'])
                if cjk/max(1,len(z['text']))>.25 and not any(abs(b['y']-z['y'])<.01 and abs(b['x']-z['x'])<.035 for b in boxes):boxes.append(z)
        candidates=[]
        for box in boxes:
            m=re.fullmatch(r'([A-Z01]{1,2})(?:\s*[).\]]\s*|\s+)([a-z]+(?:-[a-z]+)*)(?:[.,])?',box['text'].strip())
            if m:candidates.append((box,m[1],m[2]))
        if len(candidates)==15 and sum(any(c in 'EFGHIJKLMNO'for c in l) for _,l,_ in candidates)>5:
            columns=[]
            for b,l,w in sorted(candidates,key=lambda v:v[0]['x']):
                column=next((c for c in columns if abs(c[0][0]['x']-b['x'])<.05),None)
                if column is None:columns.append([(b,l,w)])
                else:column.append((b,l,w))
            ordered=[v for c in columns for v in sorted(c,key=lambda v:-v[0]['y'])]
            agreement=sum(l==chr(65+i) or l==('0'if chr(65+i)=='O'else'1'if chr(65+i)=='I'else'') for i,(_,l,_) in enumerate(ordered))
            if agreement>=10:
                for i,(b,l,w) in enumerate(ordered):b['text']=chr(65+i)+') '+w
        rows=[]
        for box in sorted(boxes,key=lambda b:-(b['y']+b['height']/2)):
            center=box['y']+box['height']/2
            if rows and abs(rows[-1][0]-center)<.007:rows[-1][1].append(box)
            else:rows.append((center,[box]))
        for y,boxes in rows:
            if y<.035:continue
            lines.append('    '.join(b['text'] for b in sorted(boxes,key=lambda b:b['x'])))
    return normalize('\n'.join(lines))

def flat(s):return re.sub(r'\s+',' ',s).strip()
def clean(s):
    # Preserve blank lines and explicit labelled paragraphs; join printed line wraps.
    return re.sub(r'(?<!\n)\n(?!\n|[\[(]?[A-Z]\s*[)\]])',' ',s.strip())

label=re.compile(r'(?<![A-Za-z])(?:[\[(])?([A-Z])\s*[)\]、.]')
def option_map(s,letters='ABCD'):
    s=re.sub(r'(?m)^([ \t]*)(['+letters+r'])[ \t]+(?=[a-zA-Z])',r'\1\2) ',s)
    s=re.sub(r'(?m)(^|\s{2,})([01])(?:\s*[)]|\s+(?=[a-zA-Z]))',lambda m:m[1]+('O' if m[2]=='0' else 'I')+')',s)
    local_label=re.compile(r'(?<![A-Za-z0-9°])(['+letters+r'])\s*[)\]、.]')
    matches=list(local_label.finditer(s)); result={}
    for i,m in enumerate(matches):
        letter=m[1]
        if letter not in letters:continue
        end=matches[i+1].start() if i+1<len(matches) else len(s)
        part=s[m.end():end]
        if letter in result:
            if result[letter]==flat(part):continue
            raise ValueError('重复选项'+letter+' '+s[:180])
        result[letter]=flat(part)
    if set(result)!=set(letters):raise ValueError('选项不足:'+''.join(result))
    return [result[l] for l in letters]

qmark=re.compile(r'(?m)^\s*(\d{1,2})\s*[.、]\s*(?=[A-Za-z“"\(])')
def mcqs(s,first,last,kind,key):
    starts=[m for m in qmark.finditer(s) if first<=int(m[1])<=last]
    questions=[]
    for i,m in enumerate(starts):
        n=int(m[1]);end=starts[i+1].start() if i+1<len(starts) else len(s)
        block=s[m.end():end]
        if kind != 'DETAIL':block=re.sub(r'(?m)^([ \t]*)([ABCD])[ \t]+(?=[a-zA-Z])',r'\1\2) ',block)
        block=re.split(r'(?im)^\s*(?:Section\s+[ABC]|Part\s+[IVX1-4]+|Passage\s+(?:One|Two)|[QO]uestions\s+\d+)',block)[0]
        labs=list(label.finditer(block));pos=next((a.start() for a in labs if a[1]=='A'),None)
        if pos is None:raise ValueError(f'第{n}题无A选项')
        prompt=flat(block[:pos]) or f'第 {n} 题(题干在原始录音中)'
        try:choices=option_map(block[pos:])
        except ValueError as e:raise ValueError(f'第{n}题: {e}')
        t=kind(n) if callable(kind) else kind
        questions.append({'id':f'{key}-q{n}','type':t,'prompt':prompt,'choices':choices,'answerIndex':-1,'answerUnavailableReason':'原始答案暂未核对，本题不计分。',
                          'explanation':'原始答案暂未核对,本题暂不计分。','weight':2 if t in ['DETAIL','LECTURE'] or (key.startswith('cet4') and t=='PASSAGE') else 1})
    if [int(q['id'].split('-q')[-1]) for q in questions]!=list(range(first,last+1)):
        raise ValueError(f'{first}–{last}题号不完整:'+','.join(q['id'].split('-q')[-1] for q in questions))
    return questions

def after_directions(s,endpattern):
    m=re.search(endpattern,s,re.I)
    if not m: raise ValueError('章节说明终点缺失')
    return s[m.end():].strip()

def parse_reading(item,reading):
    key=item['key']
    secs=list(re.finditer(r'(?m)^\s*(?:section|bection)\s*([ABC])\b',reading,re.I))
    if [m[1].upper() for m in secs[:3]]!=['A','B','C']:raise ValueError('阅读Section A/B/C缺失')
    bank=reading[secs[0].end():secs[1].start()]
    missing_bank=bool(re.search(r'说明.*(?:选词填空|不再重复)',flat(bank)))
    if missing_bank:
        passages=[];questions=[]
    else:
        bank=after_directions(bank,r'(?:more|morc)\s*than\s*(?:once|oncc|onee)\s*[.。]?') if re.search(r'Directions',bank,re.I) else bank.strip()
        am=re.search(r'(?m)(?<![A-Za-z])A\s*[)\].]',bank) or re.search(r'(?m)^[ \t]*A[ \t]+[a-z-]+(?=\s{2,}[A-Z01]|[ \t]*$)',bank)
        if am is None:raise ValueError('词库缺少A')
        astart=am.start();option_text=bank[astart:]
        option_text=re.sub(r'(?m)(^|\s{2,})([A-O01])\s+(?=[A-Za-z])',r'\1\2) ',option_text)
        matches=list(re.finditer(r'([A-O01])\s*[)\]、.]\s*([A-Za-z]+(?:[-][A-Za-z]+)*)',option_text))
        cmap={}
        for m in matches:
            l='O' if m[1]=='0' else 'I' if m[1]=='1' else m[1]
            if l in cmap and cmap[l]!=m[2].lower():raise ValueError('词库选项冲突'+l)
            cmap[l]=m[2].lower()
        if set(cmap)!=set('ABCDEFGHIJKLMNO'):raise ValueError('词库缺项:'+''.join(sorted(set('ABCDEFGHIJKLMNO')-set(cmap))))
        choices=[cmap[l] for l in 'ABCDEFGHIJKLMNO']
        passage=bank[:astart].strip()
        for n in range(26,36):
            passage,count=re.subn(r'(?<!\d)[_—–-]*\s*'+str(n)+r'\s*[_—–-]*(?!\d)',f' __({n})__ ',passage,count=1)
            if count!=1:raise ValueError('词库缺少空'+str(n))
        passages=[{'id':key+'-bank','text':clean(passage)}]
        questions=[{'id':f'{key}-q{n}','type':'WORD_BANK','prompt':f'第 {n} 空','choices':choices,'answerIndex':-1,'answerUnavailableReason':'原始答案暂未核对，本题不计分。','explanation':'原始答案暂未核对,本题暂不计分。','weight':.5,'passageId':key+'-bank'} for n in range(26,36)]
    missing_matching=item['key']=='cet6-2021-12-set3'
    if not missing_matching:
        matching=reading[secs[1].end():secs[2].start()]
        matching=after_directions(matching,r'(?:on|or)\s*Answer\s*Sheet\s*[2Z]\s*[.,。]?') if re.search(r'Directions',matching,re.I) else matching.strip()
        markers=[m for m in qmark.finditer(matching) if 36<=int(m[1])<=45]
        if [int(m[1]) for m in markers]!=list(range(36,46)):raise ValueError('匹配题36–45不完整')
        article=matching[:markers[0].start()].strip()
        article=re.sub(r'(?m)^\s*([01])\s*(?:[)\]]|[.](?=\s))',lambda m:('O' if m[1]=='0' else 'I')+')',article)

        article=re.sub(r'(?m)^\s*([B-Z])\s+(?=[A-Z“\"(])',r'\1) ',article)
        parlabels=[m[1] for m in re.finditer(r'(?m)^\s*(?:[\[(])?([A-P])\s*[)\]、.]',article)]
        if parlabels!=list('ABCDEFGHIJKLMNOPQRSTUVWXYZ')[:len(parlabels)] or len(parlabels)<4:raise ValueError('匹配段落标签不完整:'+''.join(parlabels))
        passages.append({'id':key+'-matching','text':clean(article)})
        for i,m in enumerate(markers):
            end=markers[i+1].start() if i+1<len(markers) else len(matching)
            questions.append({'id':f'{key}-q{m[1]}','type':'MATCHING','prompt':flat(matching[m.end():end]),'choices':[l+' 段' for l in parlabels],'answerIndex':-1,'answerUnavailableReason':'原始答案暂未核对，本题不计分。','explanation':'原始答案暂未核对,本题暂不计分。','weight':1,'passageId':key+'-matching'})
    detail=reading[secs[2].end():]
    pm=list(re.finditer(r'Passage\s+(One|Two|1\s*wo)\b',detail,re.I))
    if len(pm)!=2:raise ValueError('仔细阅读篇章标题不完整')
    for i,m in enumerate(pm):
        start,end=(46,50) if i==0 else (51,55)
        piece=detail[m.end():pm[i+1].start() if i+1<len(pm) else len(detail)]
        piece=re.sub(r'^\s*[QO]uestions\s+\d+\s*(?:to|[-–])\s*\d+\s+are\s+based\s+on\s+the\s+following\s+passage\s*[.。]?','',piece,flags=re.I)
        qfirst=next((q for q in qmark.finditer(piece) if int(q[1])==start),None)
        if not qfirst:raise ValueError('仔细阅读缺少第'+str(start)+'题')
        pid=key+f'-detail{i+1}'
        passages.append({'id':pid,'text':clean(piece[:qfirst.start()])})
        qs=mcqs(piece[qfirst.start():],start,end,'DETAIL',key)
        for q in qs:q['passageId']=pid
        questions.extend(qs)
    return {'instructions':'请依次完成选词填空、长篇匹配和仔细阅读。','questions':questions,'audio':[],'passages':passages,**({'wordBankUnavailableReason':'原卷说明本套选词填空未重复刊载。'} if missing_bank else {}),**({'matchingUnavailableReason':'本地原卷 PDF 缺少标页第 2 页，长篇匹配 D–L 段未刊载；已保留仔细阅读。'} if missing_matching else {})}

def split_sections(item,asset,mode):
    raw=text(asset,mode)
    patches=json.loads((root/'content/cet-local/ocr-corrections.json').read_text())
    if mode=='en':
        for old,new in patches.get(asset['id'],[]):
            pattern=r'\s+'.join(re.escape(v) for v in old.split())
            raw=re.sub(pattern,lambda _:new,raw)
    raw=re.split(r'(?im)^\s*(?:KEYS|【参考答案】)\s*$',raw)[0]
    heads=list(re.finditer(r'(?m)^[ \t]*(?:Part[^\n]*?)?(Writing|Listening\s*Comprehension|Reading\s*Comprehension|Translation)\b(?:[ \t]*\([^\n)]*\))?(?:[ \t]*[\u4e00-\u9fff]+)?[ \t]*$',raw,re.I))
    writings=[h for h in heads if h[1].lower()=='writing']
    if not writings:raise ValueError('写作标题缺失')
    ordinal=asset.get('sets',[]).index(int(item['key'].split('set')[-1])) if len(writings)>1 and int(item['key'].split('set')[-1]) in asset.get('sets',[]) else 0
    wm=writings[ordinal]
    last=writings[ordinal+1].start() if ordinal+1<len(writings) else len(raw)
    heads=[h for h in heads if wm.start()<=h.start()<last]
    result={}
    for i,h in enumerate(heads):
        stage='WRITING' if h[1].lower()=='writing' else 'TRANSLATION' if h[1].lower()=='translation' else 'LISTENING' if h[1].lower().startswith('listening') else 'READING'
        if stage in result:break
        result[stage]=raw[h.end():heads[i+1].start() if i+1<len(heads) else last].strip()
    if not result.get('TRANSLATION'):raise ValueError('翻译题干缺失')
    for stage in ['WRITING','TRANSLATION']:
        result[stage]=re.split(r'(?:结构框图|范文点评|参考范文|参考译文|答案解析|详解|【分析】)',result[stage])[0].strip()
    return result,raw

def convert(item,asset,mode='hybrid'):
    key=item['key'];parts,raw=split_sections(item,asset,mode)
    reading=parts.get('READING','')
    if not re.search(r'(?:section|bection)\s*A',reading,re.I) or (not any(26<=int(m[1])<=55 for m in qmark.finditer(reading)) and re.search(r'未|说明|不再',reading) and not re.search(r'\b26\b',reading)):
        if any(26<=int(m[1])<=55 for m in qmark.finditer(reading)):raise ValueError('阅读章节标题未识别')
        read={'instructions':'阅读材料','questions':[],'audio':[],'passages':[],'unavailableReason':'原卷未刊载本卷独立阅读题文。'+flat(reading)[:600]}
    else:read=parse_reading(item,reading)
    ltext=parts.get('LISTENING','')
    lkind=(lambda n:'NEWS' if n<=7 else 'CONVERSATION' if n<=15 else 'PASSAGE') if item['level']=='CET4' else (lambda n:'CONVERSATION' if n<=8 else 'PASSAGE' if n<=15 else 'LECTURE')
    numbers=[int(m[1]) for m in qmark.finditer(ltext) if 1<=int(m[1])<=25]
    if not numbers:
        listen={'instructions':'听力材料','questions':[],'audio':[],'passages':[],'unavailableReason':'原卷未刊载本卷独立听力题文。'+flat(ltext)[:600]}
    else:listen={'instructions':'原卷听力选择题','questions':mcqs(ltext,1,25,lkind,key),'audio':[],'passages':[],'audioUnavailableReason':'尚无已核对卷别的对应录音。'}
    return {'key':key,'sourceId':asset['id'],'content':{
      'WRITING':{'instructions':'原卷写作要求','prompt':clean(parts['WRITING']),'questions':[],'audio':[],'passages':[],'minimumWords':120 if item['level']=='CET4' else 150,'maximumWords':180 if item['level']=='CET4' else 200},
      'LISTENING':listen,'READING':read,
      'TRANSLATION':{'instructions':'请将原卷中文翻译成英语。','prompt':clean(parts['TRANSLATION']),'questions':[],'audio':[],'passages':[]}}}

report={}
for item in manifest['items']:
    errors=[]; assets=sorted([a for a in item['resources'] if a['category'] in ['paper','word']],key=lambda a:(a['category']!='paper','可复制' in a['name'],a['name']))
    for asset,mode in [(asset,mode) for asset in assets for mode in ['en','hybrid','native','ocr']]:
        try:
            data=convert(item,asset,mode)
            (output/(item['key']+'.json')).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
            report[item['key']]={'status':'parsed','sourceId':asset['id'],'mode':mode};break
        except Exception as e:errors.append(asset['id']+':'+mode+':'+str(e))
    else:report[item['key']]={'status':'pending','errors':errors}
(root/'.local-cet-import/conversion-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'parsed':sum(v['status']=='parsed' for v in report.values()),'total':len(report)},ensure_ascii=False))
for k,v in report.items():
 if v['status']!='parsed':print(k,'; '.join(v['errors']))
