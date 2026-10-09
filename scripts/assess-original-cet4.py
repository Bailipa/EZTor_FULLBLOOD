#!/usr/bin/env python3
"""Local descriptive comparison, not a psychometric calibration.
Requires textstat==0.7.13 in an isolated environment. No database access.
"""
import hashlib
import json
import pathlib
import re
import statistics
from importlib.metadata import version

import textstat

ROOT = pathlib.Path(__file__).resolve().parents[1]
FOLDER = ROOT / 'content/cet-original/cet4-original-001'
WORD = re.compile(r"\b[A-Za-z]+(?:['’-][A-Za-z]+)*\b")
textstat.set_lang('en_US')


def metrics(text):
    # These two formulas do not require downloaded pronunciation dictionaries.
    return {
        'words': len(WORD.findall(text)),
        'sentences': textstat.sentence_count(text),
        'ari': round(textstat.automated_readability_index(text), 2),
        'colemanLiau': round(textstat.coleman_liau_index(text), 2),
        'textSha256': hashlib.sha256(text.encode()).hexdigest(),
    }


records = []
for file in sorted((ROOT / 'content/cet-local/papers').glob('cet4-2025-*.json')):
    paper = json.loads(file.read_text())
    section = paper['content']['READING']
    for passage in section['passages']:
        questions = [q for q in section['questions'] if q.get('passageId') == passage['id']]
        types = {q['type'] for q in questions}
        if len(types) != 1:
            raise ValueError(f'Ambiguous passage: {passage["id"]}')
        kind = next(iter(types))
        text = passage['text']
        restored = 0
        if kind == 'WORD_BANK':
            for q in questions:
                number = re.search(r'\d+', q['prompt']).group()
                answer = q.get('answerIndex')
                if answer is None:
                    raise ValueError('Reference cloze has an unverified answer')
                text, count = re.subn(r'_+\s*\(' + number + r'\)\s*_+', q['choices'][answer], text)
                restored += count
            if restored != 10:
                raise ValueError(f'Expected 10 restored blanks: {passage["id"]}')
        # Whitespace/paragraph labels only; do not guess at OCR-split words.
        text = re.sub(r'(?m)^\s*[A-O]\)\s*', '', text)
        text = re.sub(r'\s+', ' ', text).strip()
        records.append(dict(source=paper['slug'], passage=passage['id'], type=kind,
                            restoredBlanks=restored, **metrics(text)))

written = json.loads((FOLDER / 'written-material.json').read_text())
cloze = written['cloze']
for number, (answer, _) in enumerate(written['clozeAnswers'], 26):
    cloze = cloze.replace(f'__({number})__', answer)
original = [('WORD_BANK', 'bank', cloze), ('MATCHING', 'matching',
            'Making a campus service work\n' + '\n'.join(t for _, t in written['matchingParagraphs']))]
original += [('DETAIL', f'detail{i+1}', text) for i, text in enumerate(written['detailPassages'])]
for kind, name, text in original:
    records.append(dict(source='ORIGINAL', passage=name, type=kind,
                        restoredBlanks=10 if kind == 'WORD_BANK' else 0,
                        **metrics(re.sub(r'\s+', ' ', text).strip())))

listening = json.loads((FOLDER / 'listening-script.json').read_text())
audio = json.loads((FOLDER / 'audio-manifest.json').read_text())
groups = []
for group in listening['groups']:
    words = sum(len(WORD.findall(s['text'])) for s in group['segments'])
    seconds = sum(t['duration'] for t in audio['timeline'] if t.get('group') == group['id'] and t['role'] == 'body')
    groups.append(dict(id=group['id'], type=group['type'], words=words,
                       bodySeconds=round(seconds, 3), measuredBodyWpm=round(words * 60 / seconds, 2)))
result = dict(referenceYear=2025, referencePapers=6, textstatVersion=version('textstat'),
              interpretation='Descriptive language metrics only; not official CET difficulty or score equating.',
              limitations=['OCR artifacts in references are not silently repaired.',
                           'Only six reference papers; ranges are descriptive, not acceptance thresholds.',
                           'No user-response calibration, official-vocabulary coverage, or independent audio listening review.'],
              reading=records, listening=groups, audioSha256=audio['sha256'])
(FOLDER / 'difficulty-metrics.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
rows = []
for kind, label in [('WORD_BANK', '选词填空'), ('MATCHING', '长篇匹配'), ('DETAIL', '仔细阅读')]:
    refs = [r for r in records if r['source'] != 'ORIGINAL' and r['type'] == kind]
    samples = [r for r in records if r['source'] == 'ORIGINAL' and r['type'] == kind]
    def span(key):
        values = [r[key] for r in refs]
        return f'{statistics.median(values):.1f}（{min(values):.1f}—{max(values):.1f}）'
    for i, sample in enumerate(samples):
        rows.append(f'| {label}{i+1 if len(samples)>1 else ""} | {len(refs)} | {sample["words"]} / {span("words")} | {sample["ari"]:.1f} / {span("ari")} | {sample["colemanLiau"]:.1f} / {span("colemanLiau")} |')
body = '''# 原创样卷01：难度评估方法与当前证据

日期：2026-10-09。定位：参考2025年可靠真题的原创四级样卷；2026年待校准。发布状态见本目录README及工作记录，评估结果不代表难度校准完成。

## 采用的现成标准

1. **命题规格：四六级官方大纲。** 官方当前英语大纲为2016年修订版。四级听力约120—140词/分钟，三则新闻合计450—500词，两段长对话每段240—280词，三篇听力篇章每篇220—240词；选词填空200—250词，长篇阅读约1000词，仔细阅读每篇300—350词。按题型数量、权重和考试时长检查。[官方大纲](https://cet.neea.edu.cn/res/Home/1704/55b02330ac17274664f06d9d3db8249d.pdf)、[官网大纲目录](https://cet.neea.edu.cn/xhtml1/folder/16113/1588-1.htm)、[现行笔试结构](https://cet.neea.edu.cn/html1/folder/16113/1586-1.htm)。
2. **语言复杂度：现成可读性公式。** textstat支持ARI、Coleman–Liau、Flesch等公式；本次使用不依赖在线发音词典的ARI与Coleman–Liau，同一版本、同一清洗方法比较2025年同题型材料。这些指标主要利用字母、词和句子的统计关系，输出不能换算为“达到四级”或官方难度。[textstat项目与算法说明](https://github.com/textstat/textstat)。
3. **实际题目难度：经典测验理论（CTT）。** 试做后计算每题正确率p、题目与扣除本题后的总分相关、各干扰项选择比例；用这些数据发现过易、过难、歧义或无效干扰项。p越高表示该批考生答对得越多，不是题目越难。指标受考生群体影响，不能用不同能力人群的正确率直接判定两卷等难。[剑桥题目分析资料](https://www.cambridgeenglish.org/images/206645-research-notes-59.pdf)。
4. **题库规模扩大后的标定：IRT／Rasch。** 使用真实作答数据估计题目参数，再设计锚题或等组比较。可复用mirt等实现；本套尚无数据，不生成虚构的IRT参数。IRT也需要模型适配与拟合检查。[mirt官方文档](https://philchalmers.github.io/mirt/docs/index.html)。

现成方法可直接采用；“一键计算并保证与某年真题等难”不在这些方法的保证范围内。剑桥也先预试，再分析题目并修改或淘汰异常题。[剑桥预试流程](https://support.cambridgeenglish.org/hc/en-gb/articles/202843216-What-is-Pretesting)。

## 2025年文本对照

来源：项目可信本地资料中2025年6月、12月各三套四级卷，共6套、24篇阅读材料。只读取本地JSON，不修改真题。

表格格式为“样卷 / 真题中位数（最小—最大）”；六套样本较少，范围只描述观测值。选词填空先恢复已核对答案；清理连续空白与段落编号，不推测修复OCR拆词。指标中的词数使用统一英文词正则；连字符连接的词计为一词。

| 材料 | 参考篇数 | 词数 | ARI | Coleman–Liau |
|---|---:|---|---|---|
''' + '\n'.join(rows) + '''

ARI与Coleman–Liau的数字较高通常表示其公式估计的文本复杂度较高；均不是四六级能力等级。OCR残留、句子切分和题材会影响结果。没有仅凭两项指标宣称样卷与真题等值。

本次长篇匹配的Coleman–Liau高于参考范围，是待复核项；其ARI位于参考范围内。两项结果不能合并解释成“难度已通过”，需继续检查词汇覆盖与实际作答表现。

## 当前样卷检查

- 听力25道客观题，阅读30道客观题；另有写作、翻译各一项。题型与分值权重交由现有ExamPaper解析器检查。
- 初稿语速150词/分钟已调整为正文目标130；答题停顿每题15秒。时长包含说明、预览与答题停顿，不能拿总词数除整段25分钟当作讲话语速。
- 听力正文逐组词数：''' + '、'.join(str(g['words']) for g in groups) + '''。各组正文实际平均语速见difficulty-metrics.json。
- 仔细阅读从初稿366／399词精简到当前329／340词，保留题目所需依据。翻译从初稿178个汉字精简至144个汉字；2025年六套对照卷为131—148个汉字。这里仅计汉字，不计标点。
- 已为客观题提供答案与依据，调整干扰项以采用同场景中的信息错配、过度推论和因果混淆；这是命题修改，尚不能证明区分度提升。
- 内容为原创虚构场景；主题集中于校园、社区服务、学习与技术使用，覆盖面仍有限。内容立场审查与语言难度分别处理。
- 尚未进行官方词表覆盖率核验、独立人工盲审、完整音频听感验收及真人试做；不标注“已达到2025真题等难”。

## 试做后的校准方式

先在接近目标考生的群体中试做，保留首次、未查看答案且无AI帮助的有效作答；练习重做、提前翻译、音频异常的结果分别标记，避免混入难度估计。对照卷与样卷须使用相近条件与考生能力分布。

每题p=答对人数÷有效作答人数；完成整卷但漏答按错答计，未接触该题的中断记录不冒充错答。报告人数、正确率置信区间、题目区分度、干扰项分布和时间。小样本或零方差时标记“暂不可估计”，不强行给结论。

疑似歧义、负区分度、无人选择的干扰项需回到原文复核；不能机械套用一个正确率阈值淘汰全部题。写作与翻译需要评分标准及评分者一致性检查。获得2026年可靠真题后更新文本基线；有足够作答数据后再研究IRT标定和等值。

## 复现

在隔离Python环境安装textstat==0.7.13，运行scripts/assess-original-cet4.py。输出difficulty-metrics.json包含工具版本、逐篇统计与文本哈希；不访问数据库、不采集用户数据、不部署。
'''
(FOLDER / 'difficulty-review.md').write_text(body)
print('\n'.join(rows))
print('Listening body WPM:', [g['measuredBodyWpm'] for g in groups])
