# 管理员手册

## 目录
- [管理员权限设置](#管理员权限设置)
- [管理功能页面](#管理功能页面)
- [API 接口](#api-接口)
- [常见操作指南](#常见操作指南)

---

## 管理员权限设置

### 方法一：数据库直接修改
```sql
-- 查看当前用户
SELECT id, username, "isAdmin" FROM "User";

-- 设置用户为管理员
UPDATE "User" SET "isAdmin" = true WHERE username = '你的用户名';
```

### 方法二：使用 Prisma Studio
```bash
npx prisma studio
```
在浏览器中打开 Prisma Studio，找到 `User` 表，将目标用户的 `isAdmin` 字段设为 `true`。

---

## 管理功能页面

### 1. 数据分析看板
**路径**: `/analytics`

**功能**:
- 用户统计（总用户数、新增用户、日活用户）
- 功能使用统计（单词查询、翻译、默写次数）
- 错误统计
- 每日趋势图
- 最近 50 条事件记录
- 数据导出（CSV / JSON）

**适用场景**:
- 监控系统使用情况
- 分析用户行为
- 排查异常问题

---

### 2. 公共词库管理
**路径**: `/public-words`

**功能**:
- 查看所有公共词库单词
- 搜索单词（支持模糊搜索）
- 按质量评分筛选
- 添加新单词
- 编辑单词信息（音标、词性、翻译、例句）
- 删除单词
- 查看质量评分分布统计

**字段说明**:
| 字段 | 说明 |
|------|------|
| word | 单词/短语 |
| phonetic | 音标 |
| pos | 词性 |
| translation | 中文翻译 |
| example | 例句 |
| exampleTranslation | 例句翻译 |
| qualityScore | 质量评分 (0-100) |

---

### 3. 翻译记录查看
**路径**: `/translation-records`

**功能**:
- 查看所有翻译请求记录
- 按用户筛选
- 按单词搜索
- 查看响应时间
- 查看缓存命中率
- 删除记录

**字段说明**:
| 字段 | 说明 |
|------|------|
| username | 用户名 |
| word | 查询的单词 |
| translation | 翻译结果 |
| isCached | 是否来自缓存 |
| responseTime | 响应时间(ms) |
| ipAddress | 请求 IP |
| createdAt | 创建时间 |

---

## API 接口

### 数据分析 API
```
GET /api/analytics
```
**权限**: 管理员

**返回数据**:
- overview: 概览统计
- eventsByType: 按类型统计
- dailyTrend: 每日趋势
- recentEvents: 最近事件

---

### 公共词库 API
```
GET    /api/public-words     # 获取列表
POST   /api/public-words     # 添加单词
PUT    /api/public-words     # 更新单词
DELETE /api/public-words     # 删除单词
```
**权限**: 管理员

**参数**:
- page: 页码
- limit: 每页数量
- search: 搜索关键词
- minQuality / maxQuality: 质量评分范围
- sortBy: 排序字段
- sortOrder: 排序方向

---

### 翻译记录 API
```
GET    /api/translation-records     # 获取列表
DELETE /api/translation-records     # 删除记录
```
**权限**: 管理员

**参数**:
- page: 页码
- limit: 每页数量
- search: 搜索关键词
- userId: 用户 ID 筛选

---

### 系统配置 API
```
GET  /api/config    # 获取配置
POST /api/config    # 更新配置
```
**权限**: 管理员

**配置项**:
- apiKey: LLM API Key
- baseUrl: API 地址
- model: 模型名称
- systemPrompt: 系统提示词

---

## 常见操作指南

### 添加公共词库单词
1. 访问 `/public-words`
2. 点击「添加单词」按钮
3. 填写单词信息
4. 点击保存

### 导出数据
1. 访问 `/analytics`
2. 点击「导出 CSV」或「导出 JSON」
3. 文件将自动下载

### 查看用户翻译历史
1. 访问 `/translation-records`
2. 在搜索框输入用户名
3. 查看该用户的所有翻译记录

### 监控系统健康
1. 访问 `/analytics`
2. 查看「错误统计」卡片
3. 如有异常，查看「最近事件」排查

---

## 快速访问链接

| 功能 | 路径 |
|------|------|
| 数据分析看板 | `/analytics` |
| 公共词库管理 | `/public-words` |
| 翻译记录查看 | `/translation-records` |
| 用户登录页 | `/auth/signin` |
| 首页 | `/` |
