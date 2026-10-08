# CET 听力与整卷模拟格式及验证记录

## 结构来源

2026-10-06 只读核对教育部教育考试院公开的考试结构：

- CET4：https://cet.neea.edu.cn/html1/report/16123/196-1.htm
- CET6：https://www.neea.edu.cn/html1/report/16123/201-1.htm

| 部分 | CET4                                               | CET6                                   | 权重 / 时间            |
| ---- | -------------------------------------------------- | -------------------------------------- | ---------------------- |
| 写作 | 1篇，120–180词                                     | 1篇，150–200词                         | 15%，30分钟            |
| 听力 | 新闻7题、长对话8题、篇章10题                       | 长对话8题、篇章7题、讲话/报道/讲座10题 | 35%，25 / 30分钟       |
| 阅读 | 选词10题（15候选）、匹配10题、仔细阅读10题（两篇） | 相同题数                               | 5% + 10% + 20%，40分钟 |
| 翻译 | 1段汉译英                                          | 1段汉译英                              | 15%，30分钟            |

代码逐题验证结构和权重：新闻/长对话及六级篇章每题1；四级篇章/六级讲座每题2；选词0.5、匹配1、仔细阅读2。FULL不得仅包含短篇练习题。客观分母是整卷70或听力35，仅表示练习权重得分。不会将正确率乘710作为官方成绩，主观题由独立评分器给反馈。

## 来源审核与不可变版本

管理员 `POST /api/admin/study/exams` 导入字段：`slug,version,title,level,kind,originType,sourceName,sourceUrl,rightsHolder,rightsEvidence,content`。`kind=FULL|LISTENING`；`originType=PAST_EXAM|OFFICIAL_SAMPLE|ORIGINAL`。真题/官方样题须有HTTPS原出处，原创须明确标注。导入后PENDING，不能开练。相同slug/version相同内容和来源可重试，更改须新version。SHA256包括试卷内容及来源元数据。内容和题目没有修改API。

管理员 `GET /api/admin/study/exams/[id]` 可完整检查题、答案、来源、听力稿与音频身份；`PATCH` 使用 `{rightsStatus:'APPROVED'|'REJECTED',reviewEvidence}` 保存审查证据与审计记录。按2026-10-06用户最新要求，公开往年试题可先接入本地验收，批准前实际核对题文、答案、真实来源和音频身份，照实记录未核验的许可状态，不宣称已获授权。撤回后禁止继续读取或操作该材料。

每章节为 `{instructions,questions,passages,audio,prompt?,reference?,minimumWords?,maximumWords?}`。客观题含 `{id,type,prompt,choices,answerIndex,explanation,weight,passageId?,audioId?}`。音频含 `{id,url,sourceUrl,durationSeconds,transcript,identity}`；URL须为无凭据的HTTPS原始音频。平台没有TTS生成或替代路径。浏览器原生audio须另核CSP、跨源可播放和实际资源响应，后端结构校验不证明音频真实性或可播放性。

未导入任何真题文本、版权文章或真实音频；隔离测试内容均标ORIGINAL，example.org音频是不可播放的测试占位，不能用于功能演示或作为可用题库。

## 用户流程与服务器状态

入口：选择听力训练或整卷 → 只含元数据的分页目录 → 启动/恢复已有同级别模式记录 → 当前阶段答题 → 保存草稿/提交 → 完成反馈 → 显式提交主观评分。

FULL：WRITING → LISTENING → READING → TRANSLATION → COMPLETE。服务器期限从开始计算，刷新、离线、中断不暂停；到期按已保存草稿提交，恢复时连续推进所有已经到期的阶段。提早提交会即时启动下一阶段。LISTENING训练直接听力开始、没有期限、提交直接完成。

- `GET /api/study/exams?level=&kind=&cursor=`：20条元数据；最新已核验版本优先，真题/官方样题排在原创前。
- `POST /api/study/exams`：`{paperId,mode,clientId}`，UUID幂等，已有同level/mode活动记录则恢复。保存当时备考目标快照（未设目标保存试卷级别）。
- `GET /api/study/exams/attempts?cursor=`：账户隔离分页归档，数据库只查询元数据。
- `GET /api/study/exams/attempts/[id]`：按服务器时间恢复完整view。
- `POST /api/study/exams/attempts/[id]/events`：`{clientId,revision,stage,type,answers?,text?,audioId?}`；type为DRAFT/SUBMIT_STAGE/AUDIO_PLAY，返回 `{session,receipt}`。

revision是服务器会话版本，成功写入或期限推进递增。旧版本跨标签页写入409；UUID相同且payload相同重试返回已接受receipt及最新view；改payload重用UUID拒绝。初次选择持久化时间和答案，最终答案另存，不混用：完成结果含firstCorrect/firstAnswered及最终correct/total。

阶段提交锁定。未完成view没有答案、解答、听力稿、参考译文，只有当前阶段题目及已保存的本人草稿。FULL回放记录次数并标assisted，训练允许回放且单独记录；切阶段后拒绝听力播放事件。原始公开URL及客户端播放事件无法证明外部设备未播放，assisted统计描述平台收到的播放行为，不能宣称完整监考或防作弊。

完成后主观提交由 `getExamSubjectiveSubmissions` 提供锁定text、prompt、rubric与revision。revision由attempt ID、阶段和服务器提交时间组成，与草稿修改无关。未完成禁止提供模型评分内容。

## 验证与状态（2026-10-06）

| 项目                               | 已实现   | 已验证           | 已部署 | 线上已验收 |
| ---------------------------------- | -------- | ---------------- | ------ | ---------- |
| 官方结构、权重、原始音频元数据校验 | 是       | 4项纯测试        | 否     | 否         |
| 来源权限、审批、不可变版本、目录   | 是       | 隔离DB回归       | 否     | 否         |
| 整卷阶段、草稿、期限、中断恢复     | 是       | 隔离DB回归       | 否     | 否         |
| 账户隔离、UUID、跨标签页并发       | 是       | 隔离DB回归       | 否     | 否         |
| 听力回放记录、阶段后拒绝、结果隐藏 | 是       | 隔离DB回归       | 否     | 否         |
| 真实授权题库/原生音频端到端播放    | 接口就绪 | 尚无真实授权材料 | 否     | 否         |

隔离PostgreSQL：`eztor_exam_test_20261006`，只允许localhost且数据库名匹配`eztor_exam_test_数字`的EXAM_TEST_DATABASE_URL执行测试。所有27迁移仅在该新数据库验证；业务库、生产库、原preview study测试库均未改动。迁移新增ExamPaper/ExamAttempt/ExamEvent以及User反向关系，既有Study模型没有变更。

命令：`EXAM_TEST_DATABASE_URL=<独立本地测试URL> npx vitest run src/__tests__/study/examDomain.test.ts src/__tests__/study/examDatabase.test.ts`。12测试全部通过；后端新文件定向eslint通过。测试涵盖过期恢复、失败不覆盖、不可变提交、UUID重放、审核前阻断、账号隔离、回放和未完成无解答。未验证真实题库音频、手机实际播放、生产迁移或线上流程；本轮不部署、不bump。
