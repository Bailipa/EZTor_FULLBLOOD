#!/usr/bin/env python3
"""Assemble original text/audio into the existing ExamPaper format; no DB writes."""
import json, pathlib, random
root = pathlib.Path(__file__).resolve().parents[1]
folder = root / 'content/cet-original/cet4-original-001'
written = json.loads((folder / 'written-material.json').read_text())
listening = json.loads((folder / 'listening-script.json').read_text())
audio = json.loads((folder / 'audio-manifest.json').read_text())
slug = 'cet4-original-001-full'
notice = '原创模拟卷（非真题）· 参考2025年，难度待校准。情境为虚构，听力为AI合成配音。'
rng = random.Random('EZTor-original-001-v1')
positions = [0, 1, 2, 3] * 8 + [0, 1, 2]
rng.shuffle(positions)
answer_position = iter(positions)
def mc(number, kind, prompt, correct, distractors, evidence, explanation, **refs):
    choices = list(distractors)
    rng.shuffle(choices)
    answer = next(answer_position)
    choices.insert(answer, correct)
    return dict(id=f'cet4-original-001-q{number}', type=kind, prompt=prompt, choices=choices,
        answerIndex=answer, explanation=f'答案：{"ABCD"[answer]}。{explanation}\n原文依据：{evidence}',
        weight=2 if kind in ['DETAIL','PASSAGE'] else 1, **refs)
qs=[]
for group in listening['groups']:
    for q in group['questions']:
        qs.append(mc(q['number'],group['type'],f"第 {q['number']} 题（题干在录音中）",q['correct'],q['distractors'],q['evidence'],q['explanation'],audioId='cet4-original-001-audio'))
reading=[]
for number, (answer, explanation) in enumerate(written['clozeAnswers'],26):
    reading.append(dict(id=f'cet4-original-001-q{number}',type='WORD_BANK',prompt=f'第 {number} 空',choices=written['bank'],answerIndex=written['bank'].index(answer),explanation=f'答案：{answer}。{explanation}',weight=0.5,passageId='cet4-original-001-bank'))
for number, (statement, letter, evidence) in enumerate(written['matching'],36):
    reading.append(dict(id=f'cet4-original-001-q{number}',type='MATCHING',prompt=statement,choices=[f'{l} 段' for l,_ in written['matchingParagraphs']],answerIndex=ord(letter)-65,explanation=f'答案：{letter}段。依据：{evidence}。题干为对应信息的同义转述；其余段落没有完整包含该信息。',weight=1,passageId='cet4-original-001-matching'))
for i, questions in enumerate(written['detailQuestions']):
    for j, q in enumerate(questions):
        reading.append(mc(46+i*5+j,'DETAIL',q[0],q[1],q[2],q[3],q[4],passageId=f'cet4-original-001-detail{i+1}'))
def section(instructions, **extra):
    return dict(instructions=instructions,questions=[],audio=[],passages=[],sourceNotice=notice,**extra)
transcript='\n\n'.join(group['title']+'\n'+'\n'.join(f"{segment['speaker']}: {segment['text']}" for segment in group['segments'])+'\n'+ '\n'.join(f"{q['number']}. {q['prompt']}" for q in group['questions']) for group in listening['groups'])
content={
'WRITING':section('写作：30分钟，120—180词。参考范文不是唯一正确答案。',prompt=written['writingPrompt'],reference=written['writingReference'],minimumWords=120,maximumWords=180),
'LISTENING':section('听力：25分钟。短篇新闻7题、长对话8题、短文10题。题干在录音中播报，每段材料仅播放一遍；试卷展示选项。'),
'READING':section('阅读：40分钟。选词填空每词最多使用一次；长篇匹配每段可以使用多次；仔细阅读每题选择一个最佳答案。'),
'TRANSLATION':section('汉译英：30分钟。参考译文为一种可接受表达，不要求逐字一致。',prompt=written['translationPrompt'],reference=written['translationReference']),
}
content['LISTENING']['questions']=qs
content['LISTENING']['audio']=[dict(id='cet4-original-001-audio',url=audio['url'],sourceUrl=audio['url'],durationSeconds=audio['durationSeconds'],transcript=transcript,identity=f"EZTor原创听力；合成配音；SHA256:{audio['sha256']}")]
content['READING']['questions']=reading
content['READING']['passages']=[dict(id='cet4-original-001-bank',text=written['cloze']),dict(id='cet4-original-001-matching',text='Making a campus service work\n'+'\n\n'.join(f'{l}) {text}' for l,text in written['matchingParagraphs']))]+[dict(id=f'cet4-original-001-detail{i+1}',text=text) for i,text in enumerate(written['detailPassages'])]
paper=dict(slug=slug,version=1,title='EZTor原创四级模拟卷01（参考2025·待校准）',level='CET4',kind='FULL',originType='ORIGINAL',sourceName='EZTor原创题目与合成听力',sourceUrl=None,rightsHolder='EZTor原创样卷',rightsEvidence='用户于2026-10-09授权全权生成一套原创模拟题及听力，并明确要求接入网站、标注模拟卷、向所有用户开放、发布至测试站。正文、情境、题目、解析为本次编写；未复制真题段落。音频使用现有Edge TTS合成；未宣称服务条款或商业分发条件已独立核验。参考2025年可靠真题，未取得2026年真题；难度待真人试做校准，不宣称官方等值、官方授权或真实新闻来源。',content=content)
(folder/'paper.json').write_text(json.dumps(paper,ensure_ascii=False,indent=2)+'\n')
# Human-readable paper; answers and transcripts follow in a separate section.
lines=['# EZTor原创四级模拟样卷01','',notice,'','## 写作（30分钟）','',written['writingPrompt'],'','## 听力（25分钟）','',f"音频：{audio['url']}",'','题干在录音中，以下仅列选项。']
for q in qs:
    lines += ['',f"### {int(q['id'].split('q')[-1])}",'']+[f'{"ABCD"[i]}. {choice}' for i,choice in enumerate(q['choices'])]
lines+=['','## 阅读（40分钟）','','### 选词填空','',written['cloze'],'',' | '.join(f'{chr(65+i)}. {w}' for i,w in enumerate(written['bank'])),'','### 长篇匹配','','Making a campus service work','']+[f'{l}) {text}\n' for l,text in written['matchingParagraphs']]
for n,(statement,_,_) in enumerate(written['matching'],36): lines += [f'{n}. {statement}']
for i,text in enumerate(written['detailPassages']):
    lines += ['',f'### 仔细阅读 {i+1}','',text]
    for q in reading[20+i*5:25+i*5]: lines += ['',q['prompt'],'']+[f'{"ABCD"[j]}. {v}' for j,v in enumerate(q['choices'])]
lines += ['','## 翻译（30分钟）','',written['translationPrompt'],'','---','','# 答案与解析（完成后查看）','']
for q in qs+reading: lines += [f"**{int(q['id'].split('q')[-1])}.** {q['explanation']}\n"]
lines += ['','## 写作参考','',written['writingReference'],'','评分关注：切题、论点与例证、篇章衔接、语言准确性及120—180词要求。不是官方赋分模型。','','## 翻译参考','',written['translationReference'],'','关键表达：are gradually becoming；in addition to；according to residents\' needs；not only ... but also ...；keep the activities going。','','## 听力原文','',transcript]
(folder/'sample-paper.md').write_text('\n'.join(lines)+'\n')
index={'papers':[dict(slug=slug,file='cet4-original-001/paper.json',audio=[audio['url']],status='LOCAL_SAMPLE',benchmark='2025',calibration='2026_PENDING')]}
(root/'content/cet-original/index.json').write_text(json.dumps(index,ensure_ascii=False,indent=2)+'\n')
print('Assembled:',len(qs),'listening,',len(reading),'reading questions; audio',audio['durationSeconds'],'seconds')
