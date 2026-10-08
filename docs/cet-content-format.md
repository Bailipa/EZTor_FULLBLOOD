# CET 内容包格式

管理员页面接受 UTF-8 JSON 文件，最大 300,000 字节。服务端会按学习域 schema 做完整校验；浏览器预览仅显示元数据和结构摘要。

顶层字段：`slug`（小写字母/数字/短横线）、`version`（正整数）、`level`（`CET4` 或 `CET6`）、`kind`（`PAST_EXAM`、`OFFICIAL_SAMPLE` 或 `ORIGINAL`）、`title`、`sourceName`、`sourceUrl`（原创可为 `null`）、`rightsHolder`、`rightsEvidence`、`content`。

真实试题必须在 `sourceName`、`title` 和 `slug` 中填写可核对的年份、卷别和题号；真题与官方样题还必须提供来源链接。按2026-10-06用户最新要求，公开往年试题可导入供本地验收，许可核验不作为本轮接入阻塞项。`rightsHolder` 与 `rightsEvidence` 保留现有字段兼容性，填写实际权利人记录、来源与使用说明；未知或未核验须明确写出，不能声称已取得授权。原创内容须标明 `kind: "ORIGINAL"`，并在来源名称中明确写“原创/非真题”，不得伪装成真题。

`content` 包含：

- `sentences`: 1–200 个句子对象，字段为 `text`（含英文）、`paragraph`（从 0 开始、顺序不倒退）、可选 `translation`、`glossary`（英文词到 `{ "lemma", "meaning" }` 的映射）。
- `questions`: 恰好 5 道阅读题，每题包含唯一 `id`、`prompt`、4 个不同 `choices`、`answerIndex`（0–3）、`skill`（`DETAIL`、`INFERENCE`、`MAIN_IDEA`、`VOCABULARY`、`PURPOSE`）、`explanation`、非空 `evidence`（句子索引）和 4 个 `distractorReasons`。
- `translationTask`: `{ "source", "reference", "notes" }`。
- `writingTask`: `{ "prompt", "minimumWords", "maximumWords", "rubric" }`；最少词数 80–300，最多词数不超过 600。

按相同 `slug` 与 `version` 重试必须提交完全相同的内容。内容修订应由管理员明确分配新的版本号；页面不会生成、改写或自动递增材料版本。导入只进入待核验状态，批准/撤回须填写审核说明，并保留来源、许可依据及内容 SHA-256 摘要。
