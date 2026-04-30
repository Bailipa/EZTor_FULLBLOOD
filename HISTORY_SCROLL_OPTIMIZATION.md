# 生词本页面滚动性能优化说明

## 问题描述
在生词本页面（`/history`）中，无论是快速滑动还是缓慢/匀速下滑时，页面内容都会出现明显的"抽搐"或"抖动"现象。

## 根本原因分析

### 1. **CSS 过渡效果冲突**
- WordCard 组件中的 `transition-all` 和按钮上的 `transition-colors` 在滚动时会触发频繁的样式重绘
- Hover 效果（如 `hover:shadow-md`）在滚动过程中可能意外触发

### 2. **布局重排（Reflow）问题**
- 卡片内容高度不一致导致虚拟滚动时的布局抖动
- 缺少 CSS `contain` 属性来隔离布局计算

### 3. **GPU 加速不足**
- 缺少 `transform: translateZ(0)` 和 `backface-visibility: hidden` 等硬件加速属性
- 浏览器在滚动时进行过多的图层提升操作

### 4. **虚拟滚动配置不当**
- `itemContent` 函数在每次渲染时重新创建，导致不必要的组件重渲染
- `overscan` 和 `increaseViewportBy` 参数设置不合理，预渲染缓冲区不足
- 缺少稳定的 item key 计算

### 5. **样式重绘频繁**
- `willChange` 属性使用不当（设置为 `transform` 会持续占用内存）
- 缺少 `overflow-anchor: none` 防止滚动锚定导致的偏移

## 实施的优化措施

### 1. **移除 CSS 过渡效果** (`WordCard.tsx`)
```typescript
// 移除前
className={`hover:shadow-md transition-all ...`}

// 移除后
className={`${isSelectionMode ? 'cursor-pointer select-none' : ''} ...`}
```

**移除的过渡：**
- Card 组件的 `transition-all`
- 音量按钮的 `transition-colors`
- 删除按钮的 `transition-colors`

### 2. **添加 CSS Containment** (`WordCard.tsx`, `page.tsx`)
```typescript
// Card 组件
style={{ 
  contain: 'layout style paint',
  backfaceVisibility: 'hidden',
  WebkitBackfaceVisibility: 'hidden',
  transform: 'translateZ(0)'
}}

// CardContent
style={{ minHeight: '200px', contain: 'layout' }}

// GridItem
style={{ 
  willChange: 'auto',
  contain: 'layout style paint',
  backfaceVisibility: 'hidden',
  WebkitBackfaceVisibility: 'hidden'
}}

// GridList
style={{
  contain: 'layout style',
  willChange: 'auto'
}}
```

### 3. **优化 VirtuosoGrid 配置** (`page.tsx`)
```typescript
<VirtuosoGrid
  data={words}
  totalCount={words.length}
  itemContent={renderItemContent}  // 使用 memoized 函数
  overscan={300}                    // 增加预渲染区域
  useWindowScroll={false}           // 避免窗口滚动冲突
  increaseViewportBy={{ top: 500, bottom: 500 }}  // 扩大视口缓冲区
  computeItemKey={(index, item) => item.id}       // 稳定的 key
  scrollSeekConfiguration={{
    enter: (velocity) => Math.abs(velocity) > 300,
    exit: (velocity) => Math.abs(velocity) < 100,
  }}
/>
```

### 4. **Memoize itemContent 渲染函数** (`page.tsx`)
```typescript
const renderItemContent = useCallback((index: number, item: WordData) => (
  <WordCard
    key={item.id}
    item={item}
    index={index}
    // ... props
  />
), [isSelectionMode, selectedSet, deletingId, isGroupView, ...]);
```

### 5. **优化滚动容器** (`page.tsx`, `globals.css`)
```typescript
// 添加 smooth-scroll-container 类
<div className="smooth-scroll-container" style={{ height: 'calc(100vh - 220px)', overflow: 'auto' }}>
```

```css
/* globals.css */
.smooth-scroll-container {
  -webkit-overflow-scrolling: touch;
  overflow-anchor: none;
  transform: translateZ(0);
  backface-visibility: hidden;
  perspective: 1000px;
}

.virtuoso-grid-list {
  contain: layout style;
  transform: translateZ(0);
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}
```

### 6. **固定卡片最小高度** (`WordCard.tsx`)
```typescript
<CardContent className="p-5 space-y-3 relative" style={{ minHeight: '200px', contain: 'layout' }}>
```

## 技术要点说明

### CSS Containment
- `contain: layout style paint` - 告诉浏览器该元素及其子元素的布局、样式和绘制是独立的
- 显著减少滚动时的重排和重绘范围

### GPU 加速
- `transform: translateZ(0)` - 创建新的合成层，启用 GPU 加速
- `backface-visibility: hidden` - 优化 3D 变换性能
- `perspective: 1000px` - 增强 3D 上下文，提升渲染性能

### willChange 策略
- 使用 `willChange: 'auto'` 而不是 `willChange: 'transform'`
- 避免持续占用大量内存，让浏览器自动优化

### 虚拟滚动优化
- `overscan: 300` - 在视口外预渲染 300px 的内容
- `increaseViewportBy: { top: 500, bottom: 500 }` - 上下各扩展 500px 的渲染区域
- `computeItemKey` - 使用稳定的 ID 作为 key，避免不必要的 DOM 操作

## 测试建议

### 1. 基本功能测试
- ✅ 快速上下滑动页面
- ✅ 缓慢/匀速下滑页面
- ✅ 触摸设备上的滑动手势
- ✅ 鼠标滚轮滚动

### 2. 性能测试
- 打开 Chrome DevTools → Performance 面板
- 录制滚动过程，检查：
  - FPS 是否保持在 60fps
  - 是否有大量的 Layout 或 Paint 事件
  - Layer Tree 是否稳定

### 3. 多设备测试
- 桌面浏览器（Chrome, Firefox, Safari）
- 移动设备（iOS Safari, Android Chrome）
- 平板设备

### 4. 边界情况
- 加载更多内容时的滚动体验
- 删除单词后的滚动稳定性
- 切换选择模式时的性能

## 预期效果

修复后，生词本页面应该具备以下特性：
1. ✅ **无抖动**：任何速度的滚动都保持平滑
2. ✅ **高 FPS**：滚动时保持 60fps 的流畅度
3. ✅ **低 CPU 占用**：减少不必要的重排和重绘
4. ✅ **稳定布局**：卡片位置不会突然跳变
5. ✅ **快速响应**：滚动跟手性好，无延迟感

## 相关文件
- `/src/app/history/page.tsx` - 生词本页面主组件
- `/src/components/vocabulary/WordCard.tsx` - 单词卡片组件
- `/src/app/globals.css` - 全局样式优化

## 后续优化建议

如果仍有性能问题，可以考虑：
1. 使用 React Profiler 分析组件渲染时间
2. 实现图片懒加载（如果有图片）
3. 进一步减少每个卡片的 DOM 节点数量
4. 考虑使用 CSS Grid 的 `content-visibility: auto` 属性
5. 对于超大数据集，考虑服务端分页而非无限滚动
