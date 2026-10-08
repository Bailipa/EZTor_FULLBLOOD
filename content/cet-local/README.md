# 本地四六级题库

2026-10-08：按用户提供的本地压缩包接入，范围为 2020–2025 年，CET4/CET6 各 43 套。年份以文件名和原卷标题为准，四级 `2022.zip` 并非仅含 2022 年。

当前 /study 的资料目录、整卷与四个分项、换卷均使用现有 ExamPaper 服务。目录和在线试卷各 86 套；数据库保留不可变内容版本，7 套共用章节在本轮以 v2 补齐。没有部署生产。

## 数据与来源

- `index.json`：原始压缩包、文件名、卷别、字节数和 SHA-256。209 个资源文件都已核对复制哈希；原压缩包不修改。
- `papers/`：86 个可由 `parseExamContent` 校验的整卷包，3,980 道客观题。3,781 题已提取配套答案；199 题答案未确认，`answerIndex=-1`，明确不计分，允许保存作答。
- `conversion-report.json`：每套使用的源 PDF 与抽取方式。`ocr-corrections.json` 保留原 OCR 和人工对照原卷图像后的修改，不用 LLM 编造题文或答案。
- `conversion-status.json`：每套题数、答案数、音频及缺失/共用章节。`import-summary.json`：汇总和内容包哈希。
- `writing-figures.json`：三套图表写作题的原卷图像及哈希。

二进制资源位于被 Git 忽略的 `public/study/resources/`；原始压缩包位于被忽略的 `四级/`、`六级/`。它们是本地功能的必要资产，单独复制代码不能还原资源。没有为本地文件伪造公网来源链接。

原档部分 `.mp3` 实际为 M4A，按文件格式保存为 `.m4a`。50 个不同录音全部通过 ffprobe 读取，原资料明确共用后关联到 58 套试卷。四级 2022.06 第 1 套录音含开头说明，约 25 分 40 秒；服务端听力阶段允许完整播放，计时取 26 分钟。

## 原卷缺项与共用章节

- 28 套没有独立听力题文/对应录音，显示原卷缺项提示；没有生成音频或借用未明确关联的其他卷录音。
- 四级 2022.06 第 3 套仅说明阅读与“前两套”内容相同，没有明确具体卷别，保留缺项提示。
- 六级 2021.12 第 3 套未重复刊载选词填空，并缺少印刷第 2 页的匹配 D–L 段，保留其仔细阅读题。缺失部分不会伪造补齐。
- 原资料明确“完全相同”的共用章节，使用对应卷题文、答案和录音。
- 四/六级 2023.03 第 2、3 套原资料仅说明同第一套内容、题序不同：练习按第一套顺序展示，并在作答及结果页面明确提示，未声称还原本套独立题序。

## 重建

需要本机 Python（pypdf、python-docx、Pillow）、Poppler、ffprobe，以及 macOS Swift/PDFKit/Vision。OCR 缓存不入库；当前内容包已可直接导入。

```sh
python3 scripts/import-cet-local-assets.py
mkdir -p .local-cet-import
python3 scripts/extract-cet-local-text.py
swiftc scripts/cet-pdf-ocr.swift -o .local-cet-import/ocr-pdf
swiftc scripts/cet-pdf-ocr-english.swift -o .local-cet-import/ocr-pdf-en
python3 scripts/ocr-cet-local.py
python3 scripts/ocr-cet-local-english.py
python3 scripts/convert-cet-local-papers.py
```

打包还读取 `.local-cet-import/local-audio-info.json`：每个音频 ID 对应其 `ffprobe -v error -show_entries format=duration:stream=codec_name -of json <文件>` 输出。收集后运行：

```sh
python3 scripts/build-cet-local-papers.py
node --import tsx scripts/import-cet-library.ts
```

写库前做完整数据库备份，再执行 `node --import tsx scripts/import-cet-library.ts --import`。命令强制限定 localhost 的 eztor 数据库，校验内容包集合与来源清单一致，使用现有管理员导入/审核/审计服务。同一版本幂等读取；内容变动须增加版本，不覆盖已有版本和作答记录。

## 本轮核对范围

86 套最新内容与数据库回读一致；每个级别的 FULL、LISTENING、READING、TRANSLATION、WRITING 分页列表均为 43 套；目录在线数 86。已有 3 条作答记录导入前后摘要一致，原 4 篇 StudyPassage 保留。TypeScript、相关 ESLint 及 diff 空白检查通过。

浏览器匿名请求 /study 正常进入登录回跳；未完成登录后真实作答、保存、换卷、刷新恢复、音频播放和 AI 评分的完整流程验收。没有进行逐题双人复核或全量人工复听，未运行自动化测试。已实现、已回读核对；未部署、未线上验收。
