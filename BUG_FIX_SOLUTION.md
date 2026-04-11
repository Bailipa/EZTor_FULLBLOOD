# 🐛 Bug修复方案

**修复日期**: 2026-04-08  
**修复人员**: AI Assistant  

---

## 📋 Bug 1: 多用户共用一个"私有单词本"

### 问题描述
用户A删除自己库中的单词，用户B的单词也被删除。

### 根本原因
**位置**: [src/lib/auth.ts](file:///d:/TTTT/四级/web/src/lib/auth.ts#L67-L78)

当前认证逻辑中存在一个严重的安全漏洞：**自动创建用户机制**。

```typescript
// ❌ 问题代码
if (!user) {
  await simulatePasswordHash();
  
  const hashedPassword = await bcrypt.hash(credentials.password, 10);
  const newUser = await prisma.user.create({
    data: {
      username: normalizedUsername,
      password: hashedPassword,
    }
  });
  return { id: newUser.id, name: newUser.username, isAdmin: newUser.isAdmin };
}
```

**问题分析**:
1. 任何不存在的用户名都会自动创建新账户
2. 用户可能以为在登录，实际在创建新账户
3. 如果用户A用"alice"登录，用户B也用"alice"（但密码不同），会创建两个不同的账户
4. 但由于username有unique约束，第二次会失败，导致用户混淆

### 修复方案

**已创建修复文件**: `src/lib/auth-fixed.ts`

**关键修改**:
```typescript
// ✅ 修复后的代码
if (!user) {
  await simulatePasswordHash(); // 防止时序攻击
  throw new Error(AUTH_ERROR_MESSAGE); // 返回错误而不是创建新用户
}
```

**实施步骤**:
1. 备份原文件: `src/lib/auth.ts`
2. 将 `src/lib/auth-fixed.ts` 内容替换到 `src/lib/auth.ts`
3. 或者手动修改以下内容：
   - 删除第67-78行的自动创建用户逻辑
   - 添加错误处理

**验证方法**:
1. 尝试用不存在的用户名登录
2. 应该收到"用户名或密码错误"提示
3. 不会自动创建新用户

---

## 📋 Bug 2: 单词卡功能返回错误

### 问题描述
用户点击"不认识"或"认识"按钮时，功能返回错误，预期结果应该是跳过当前单词进入下一个单词。

### 根本原因
**位置**: [src/components/ui/flashcard/flashcard-widget.tsx](file:///d:/TTTT/四级/web/src/components/ui/flashcard/flashcard-widget.tsx#L91-L110)

```typescript
// ❌ 问题代码
const handleNext = async (isCorrect: boolean) => {
  if (currentWord) {
    try {
      fetch('/api/dictation/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: currentWord.word, isCorrect })
      }).catch(e => console.error("Failed to update stats", e)); // 错误被忽略
    } catch (e) {
      // ignore - 错误被忽略
    }
  }
  // ...继续执行
};
```

**问题分析**:
1. **错误被静默忽略**：API调用失败时，用户看不到任何反馈
2. **未登录用户**：如果用户未登录，API会返回401错误
3. **没有loading状态**：用户不知道操作是否成功
4. **错误处理不当**：catch块为空，错误被吞掉

### 修复方案

**已创建修复文件**: `src/components/ui/flashcard/flashcard-widget-fixed.tsx`

**关键修改**:

1. **添加登录状态检查**:
```typescript
const { data: session, status } = useSession();
```

2. **添加loading状态**:
```typescript
const [isUpdating, setIsUpdating] = useState(false);
```

3. **改进错误处理**:
```typescript
// ✅ 修复后的代码
const handleNext = async (isCorrect: boolean) => {
  if (!currentWord) return;

  setIsUpdating(true);
  try {
    const res = await fetch('/api/dictation/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word: currentWord.word, isCorrect })
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      if (res.status === 401) {
        console.warn("Session expired, continuing without saving stats");
      } else {
        throw new Error(data.error || '更新失败');
      }
    }
  } catch (e: any) {
    console.error("Failed to update stats:", e);
    // 不阻止用户继续，只记录错误
  } finally {
    setIsUpdating(false);
  }

  // 继续下一个单词
  if (currentIndex < words.length - 1) {
    setCurrentIndex(prev => prev + 1);
    setShowAnswer(false);
  } else {
    fetchWords();
  }
};
```

4. **UI改进**:
```typescript
<Button 
  onClick={() => handleNext(false)}
  disabled={isUpdating} // 防止重复点击
>
  {isUpdating ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <X className="w-5 h-5 mr-2" />}
  不认识
</Button>
```

**实施步骤**:
1. 备份原文件: `src/components/ui/flashcard/flashcard-widget.tsx`
2. 将修复文件内容替换到原文件
3. 测试未登录用户场景
4. 测试已登录用户场景

**验证方法**:
1. 未登录用户点击按钮，应该能正常跳过
2. 已登录用户点击按钮，应该显示loading状态
3. API失败时，用户仍能继续浏览单词
4. 控制台应该显示错误日志

---

## 🔧 其他建议修复

### 3. 添加用户注册功能

**问题**: 当前没有明确的注册入口，导致用户混淆。

**建议**:
1. 创建独立的注册页面
2. 在登录页面添加"注册"链接
3. 移除自动创建用户逻辑

### 4. 改进错误提示

**问题**: 当前使用alert()提示错误，用户体验差。

**建议**:
1. 使用Toast组件替代alert
2. 提供更详细的错误信息
3. 添加重试机制

### 5. 添加数据隔离验证

**问题**: 缺少数据隔离的单元测试。

**建议**:
```typescript
// 测试用例示例
describe('Data Isolation', () => {
  it('should not allow user A to delete user B words', async () => {
    // 创建两个用户
    const userA = await createUser('alice');
    const userB = await createUser('bob');
    
    // 用户A添加单词
    const wordA = await addWord(userA.id, 'apple');
    
    // 用户B尝试删除用户A的单词
    const result = await deleteWord(userB.id, wordA.id);
    
    // 应该失败
    expect(result.success).toBe(false);
    expect(result.status).toBe(403);
  });
});
```

---

## 📊 修复优先级

| Bug | 严重级别 | 修复难度 | 优先级 |
|-----|---------|---------|--------|
| Bug 1: 多用户数据隔离 | 🔴 严重 | 低 | P0 (立即修复) |
| Bug 2: 单词卡功能错误 | 🟠 高 | 中 | P1 (本周修复) |
| 建议3: 添加注册功能 | 🟡 中 | 中 | P2 (下个版本) |
| 建议4: 改进错误提示 | 🟡 中 | 低 | P2 (下个版本) |
| 建议5: 添加测试 | 🟢 低 | 高 | P3 (持续改进) |

---

## ✅ 修复验证清单

### Bug 1 验证
- [ ] 用不存在的用户名登录，收到错误提示
- [ ] 不会自动创建新用户
- [ ] 已存在的用户可以正常登录
- [ ] 用户A的单词对用户B不可见
- [ ] 用户A删除单词不影响用户B

### Bug 2 验证
- [ ] 未登录用户可以浏览公共词库
- [ ] 点击"认识"/"不认识"按钮能正常跳过
- [ ] 已登录用户点击按钮显示loading状态
- [ ] API失败时用户仍能继续浏览
- [ ] 控制台显示错误日志

---

## 🚀 部署建议

1. **备份数据库**: 修复前备份生产数据库
2. **灰度发布**: 先在测试环境验证
3. **监控日志**: 部署后密切关注错误日志
4. **用户通知**: 通知用户新的注册流程

---

**修复完成时间**: 预计 2-4 小时  
**测试时间**: 预计 1-2 小时  
**部署时间**: 预计 30 分钟
