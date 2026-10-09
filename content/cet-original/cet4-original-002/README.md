# EZTor 原创四级模拟卷02

对标：用户提供的2026年6月四级第1套PDF、答案册及MP3。原创非真题；整体练习负荷经命题审查接近参考卷，尚未真人实测等值。

## 成品

- `output/pdf/eztor-cet4-original-002-paper.pdf`：题目册，13页，写作、听力、阅读、翻译。
- `output/pdf/eztor-cet4-original-002-answers.pdf`：答案解析册，13页，55道客观题解析、参考作文、翻译、评分要点及听力原文。
- `output/audio/eztor-cet4-original-002-listening.mp3`：25分钟合成听力，三种声音，含预览和作答停顿。
- 本目录 `paper.json`：兼容现有 ExamPaper 的四模块数据；未登记进目录、导入数据库或部署。
- `difficulty-review.md`、`difficulty-metrics.json`：难度审查、对标指标、方法及限制。
- `quality-review.json`：本地结构、答案索引、音频哈希和最终稿一致性检查记录。

上述成品路径均相对项目根目录。参考原件仅用于本地分析，不包含在成品中。报道、调查及人物为原创虚构情境，不表示真实新闻或研究结果。

## 制作源与复用

`written-material.json` 包含书面题目及参考答案；`listening-script.json` 包含听力脚本、设问、选项及依据；`metadata.json` 保存原创标识及状态；`audio-manifest.json` 保存声音、时间轴、资源路径及哈希。

从项目根目录生成音频：`node --import tsx scripts/build-original-cet4-audio.ts --paper-dir cet4-original-002`；需要可用的TTS网络连接，现有本机环境生成时使用系统代理。音频完成后装配：`python3 scripts/assemble-original-cet4.py --paper-dir cet4-original-002`。脚本默认仍为01卷，02卷装配不会注册目录。

## 状态和限制

已制作并完成结构、选项索引、对稿、音频完整解码、哈希及PDF渲染检查。没有完整人工试听、独立人工盲审或考生实测；没有核定官方词表覆盖率。参考材料未独立认证官方版本，单套基线不能代表全年。合成音频正式商业分发条件尚未独立核验。

本次没有接入网站或部署；原有01卷和线上用户数据未修改。
