# EZTor原创四级模拟样卷01

本地草案，参考2025年可靠真题，2026年难度待校准。与可信真题归档分开保存，不冒充真题。

## 试用入口

1. 打开 `sample-paper.md` 阅读试卷。听力题干只在录音中出现，卷面展示选项。
2. 播放项目 `public/study/resources/` 下 `audio-manifest.json` 所列MP3；依次完成写作30分钟、听力25分钟、阅读40分钟、翻译30分钟。
3. 完成后查看文档后半部分的答案、解析、参考范文、参考译文和听力原文。
4. 查看 `difficulty-review.md` 了解当前评估方法、测量值与未完成的校准。

## 文件职责

- `listening-script.json`：原创听力稿、问题、选项、依据和解析。
- `written-material.json`：原创阅读、写作、翻译源稿。
- `audio-manifest.json`：音频位置、哈希、时间轴、合成声音；题目逻辑时长1500秒，编码文件含约48毫秒填充。
- `paper.json`：现有ExamPaper格式的整卷数据，originType=ORIGINAL；含答案，只用于受控导入，不直接作为公开前端数据。
- `sample-paper.md`：本地审阅版。
- `difficulty-metrics.json`：2025年六套对照卷与样卷的描述性统计、文本哈希和工具版本。
- `difficulty-review.md`：来源、结果、限制与后续真人试做方案。

## 生成与检查

在项目根目录运行：

```sh
node --import tsx scripts/build-original-cet4-audio.ts
python3 scripts/assemble-original-cet4.py
# 隔离Python环境安装 textstat==0.7.13 后：
python3 scripts/assess-original-cet4.py
```

音频通过已有Edge TTS生成，使用三种合成声音。原始片段和处理中间文件位于忽略目录 `.local-cet-import/original-cet4-001/`；最终音频位于被Git忽略的资源目录，不能只复制JSON而遗漏MP3。

已完成：内容与音频生成、现有试卷解析器结构检查、音频哈希/时长/问题停顿检查、与2025年文本指标对照。

未完成：独立人工盲审、完整音频听感验收、官方词表覆盖率核验及真人作答校准。长篇匹配的Coleman–Liau指标高于本次参考范围，详见报告。服务条款与公开分发条件须在正式发布前核对。

未导入数据库，未授权给线上用户，未部署。后续接入网页应走已有管理员导入、审核与指定用户试卷授权流程；不得改变所有用户默认关闭的权限规则。
