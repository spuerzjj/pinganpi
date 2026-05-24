# 路线图看板 UI 优化设计 (Apple Bento Grid)

## 设计意图 (Intent)
将 `roadmap-viewer` (Vue 3) 的 UI 从之前的工业风修改为经典的 **Apple (macOS / iOS)** 现代质感风格。通过 Bento Grid 布局，以高度精致、平衡的方式展示项目进度。

## 核心设计方向

### 1. 结构 (Architecture) - Apple Bento Grid
- **网格布局**：采用非对称的 Bento Grid (便当盒网格)。核心指标、当前基线、风险项和文档入口将作为不同尺寸的圆角卡片拼合在一起。
- **阶段进度展示**：在网格中拿出一块大型的宽卡片作为“阶段进度”区，内部支持垂直滚动。这确保了首屏能同时看到全局概览（指标）和具体列表。

### 2. 视觉风格 (Visual Style) - 现代 Apple 质感
- **背景与色彩**：
  - 页面背景使用 Apple 标志性的浅灰色 (`#f5f5f7`)。
  - 卡片使用纯白色背景 (`#ffffff`)。
- **形状与阴影**：
  - 使用柔和的大圆角（卡片 `16px` - `20px`，小元素 `8px`）。
  - 采用极其细腻的扩散阴影（例如 `box-shadow: 0 4px 20px rgba(0,0,0,0.04)`）和极浅的描边 (`1px solid rgba(0,0,0,0.02)`)。
- **排版与字体**：
  - 优先使用系统默认无衬线字体（SF Pro / 微软雅黑 / PingFang SC）。
  - 标题使用较粗的字重，正文保持适中的字间距和行高。
- **指示状态的色彩**：
  - 完成状态：Apple 经典的绿色 (`#34c759`)。
  - 进行中/重点：Apple 经典的蓝色 (`#007aff`)。
  - 警告/风险：Apple 经典的橙色 (`#ff9500`) 或红色 (`#ff3b30`)。

### 3. 组件重构内容
1.  **CSS Root Variables**：
    *   `--bg`: `#f5f5f7`
    *   `--surface`: `#ffffff`
    *   `--ink`: `#1d1d1f` (Apple 典型的黑灰色)
    *   `--muted`: `#86868b`
    *   `--accent`: `#34c759`
    *   `--active`: `#007aff`
    *   `--shadow`: `0 8px 30px rgba(0,0,0,0.04)`
2.  **布局调整**：
    *   `App.vue` 中的 `bento-container` 将改为多行多列的 Grid。
    *   阶段列表卡片通过 `max-height` 和 `overflow-y: auto` 实现内部滚动。
3.  **列表与 Badge**：
    *   Badge 改为 Apple 风格的胶囊形（Pill shape），带有非常浅的底色或描边。
    *   时间轴节点改回圆形，但保持极简。

## 验收标准 (Acceptance Criteria)
1. 页面呈现经典的 Apple 亮色简约风格，富有质感。
2. 采用 Bento Grid 布局，卡片错落有致。
3. 阶段列表在宽卡片内可滚动，不撑开整个页面。
4. 所有的进度数据（1-33）和原本的功能链接均保持完整。