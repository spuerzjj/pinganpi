# Roadmap Dashboard UI 优化实施计划

> **状态：已废弃。** 旧 `docs/pinganpi-roadmap-dashboard.html` 静态页面已删除，不再维护。后续 roadmap 可视化只使用 `roadmap-viewer/`。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有的静态路线图看板升级为具有 Tesla-style 暗黑极客工业风和 Bento Box 网格布局的现代 Dashboard。

**Architecture:** 这是一个单文件静态网页项目（无构建）。我们将保留所有的语义化 DOM 结构和现有的进度数据，纯粹通过修改 CSS (特别是 CSS Variables 和 Grid Layout) 以及部分类名的结构来实现重新排版和风格转变。布局改为：左侧通栏展示可滚动的阶段进度（1-33），右侧由不同的矩形卡片组成数据展示区。

**Tech Stack:** HTML5, CSS Variables, CSS Grid, CSS Flexbox

---

### Task 1: 建立基础的 Tesla 极简暗黑主题 (CSS Variables)

**Files:**
- Modify: `docs/pinganpi-roadmap-dashboard.html`

- [ ] **Step 1: 修改全局 CSS Variables，去除所有彩色和柔和颜色**

```css
      :root {
        color: #ffffff;
        background: #000000;
        font-family:
          Inter,
          ui-sans-serif,
          system-ui,
          -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          "PingFang SC",
          "Hiragino Sans GB",
          "Microsoft YaHei",
          sans-serif;
        --bg: #000000;
        --surface: #111111;
        --surface-muted: #1a1a1a;
        --ink: #ffffff;
        --muted: #888888;
        --subtle: #444444;
        --line: #333333;
        --line-strong: #555555;
        --accent: #ffffff; /* 核心完成状态：纯白 */
        --active: #3b82f6; /* 当前进行中状态：亮蓝 */
        --warn: #f59e0b; /* 警告：橙色 */
        --risk: #ef4444; /* 风险：红色 */
        --shadow: none; /* 移除阴影 */
      }
```

- [ ] **Step 2: 去除原有标签/Badge的圆润和阴影**

修改 `body`, `.page`, `.card`, `.badge` 的样式，变为直角或极小圆角。

```css
      body {
        min-width: 320px;
        margin: 0;
        background: var(--bg);
        color: var(--ink);
      }
      
      .page {
        width: 100vw;
        height: 100vh;
        margin: 0;
        padding: 16px;
        overflow: hidden; /* 禁用全局滚动，交由内部模块 */
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .card, .metric, .priority, .list-item {
        border: 1px solid var(--line);
        border-radius: 4px; /* 极小圆角 */
        background: var(--surface);
        box-shadow: none; /* 去除原本的阴影 */
      }
      
      .badge {
        display: inline-flex;
        min-height: 24px;
        align-items: center;
        border: 1px solid var(--line);
        border-radius: 2px;
        background: transparent; /* 去除底色 */
        padding: 2px 8px;
        color: var(--muted);
        font-size: 11px;
        font-family: monospace; /* 标签使用等宽字体 */
        font-weight: normal;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .badge.done { border-color: var(--line-strong); color: var(--accent); }
      .badge.info { border-color: var(--active); color: var(--active); }
      .badge.warn { border-color: var(--warn); color: var(--warn); }
      .badge.risk { border-color: var(--risk); color: var(--risk); }
```

- [ ] **Step 3: 浏览器检查页面变黑**
在浏览器中打开 `docs/pinganpi-roadmap-dashboard.html`。页面现在应该是纯黑底色，文字变白，卡片变为非常扁平、方正的深灰色，所有 Badge 都变成了等宽字体的细线框样式。

- [ ] **Step 4: Commit**
```bash
git add docs/pinganpi-roadmap-dashboard.html
git commit -m "style(docs): 应用 Tesla 风格的极简暗黑主题与全局变量"
```

---

### Task 2: 构建左侧通栏大卡 (Tall Sidebar Bento 布局)

**Files:**
- Modify: `docs/pinganpi-roadmap-dashboard.html`

- [ ] **Step 1: 创建左右网格的主容器**
在 `<main class="page">` 中，将页面除 Header 外的部分包裹进一个主网格，左侧固定宽度给阶段进度，右侧自适应占据剩余空间。

找到 HTML 结构，新增一个包装 `<div class="bento-container">`：
*(在 `<header class="topbar">` 之后包裹所有 `<section>`)*

```html
      <header class="topbar">...</header>

      <!-- 新增主网格容器 -->
      <div class="bento-container">
        
        <!-- 左侧：原本在中间的“阶段进度”区，将其移动到这里 -->
        <aside class="bento-sidebar">
            <section class="section card" aria-label="阶段进度">...原来的卡片代码...</section>
        </aside>
        
        <!-- 右侧：放置原本的其他区块 -->
        <div class="bento-main">
            <section class="grid-4" aria-label="关键状态">...</section>
            <section class="section columns">...</section>
            <section class="section columns">...</section>
            <section class="section card">...文档入口...</section>
        </div>

      </div>
```

- [ ] **Step 2: 编写主网格 (Bento Container) 的 CSS**

```css
      .bento-container {
        display: grid;
        grid-template-columns: 320px 1fr;
        gap: 16px;
        flex: 1; /* 撑满剩余高度 */
        min-height: 0; /* 允许内部元素滚动 */
      }

      .bento-sidebar {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
      }
      
      .bento-sidebar .card {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: 0;
      }

      .bento-sidebar .card-body {
        flex: 1;
        overflow-y: auto; /* 左侧独立滚动 */
        padding: 12px;
      }

      .bento-main {
        display: flex;
        flex-direction: column;
        gap: 16px;
        height: 100%;
        overflow-y: auto; /* 右侧独立滚动 */
        padding-right: 4px;
      }
      
      /* 重写右侧卡片间距，去除多余 section margin */
      .section {
        margin-top: 0;
      }
```

- [ ] **Step 3: 浏览器检查左右布局**
在浏览器中打开文件，确认页面分成了左右两列。左侧固定 320px 容纳“阶段进度”，右侧容纳其他的所有的卡片和指标。左右侧现在应该可以独立垂直滚动。

- [ ] **Step 4: Commit**
```bash
git add docs/pinganpi-roadmap-dashboard.html
git commit -m "style(docs): 构建 Bento Box 的左右通栏网格布局"
```

---

### Task 3: 重构核心数据排版 (Typography & Metrics)

**Files:**
- Modify: `docs/pinganpi-roadmap-dashboard.html`

- [ ] **Step 1: 升级四列指标卡片 (Metrics Grid)**
目前四列指标看起来比较柔和。我们要把数字调大，字体加粗，去除内边距圆润感，强化工业感。

```css
      .grid-4 {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 12px;
      }

      .metric {
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        min-height: auto; /* 去除原本强制最小高度 */
        padding: 16px;
        background: var(--surface-muted); /* 稍微区分底色 */
        border: 1px solid var(--line);
      }

      .metric-label {
        color: var(--muted);
        font-family: monospace;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        margin-bottom: 8px;
      }

      .metric-value {
        font-size: 32px; /* 更大数字 */
        font-weight: 800;
        line-height: 1;
        letter-spacing: -0.02em;
        margin-bottom: 8px;
        color: var(--accent);
      }

      .metric-note {
        color: var(--muted);
        font-size: 12px;
        line-height: 1.4;
      }
```

- [ ] **Step 2: 升级标题排版 (Header & Titles)**

```css
      .kicker {
        font-family: monospace;
        font-size: 12px;
        color: var(--subtle);
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }
      
      h1 {
        font-size: 28px;
        font-weight: 700;
        letter-spacing: -0.02em;
      }

      h2 {
        font-size: 14px;
        font-family: monospace;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--muted);
      }
      
      .card-header {
        padding: 12px 16px;
        background: var(--surface); /* Header可以稍有不同质感，这里保持统一 */
        border-bottom: 1px solid var(--line);
      }
```

- [ ] **Step 3: 浏览器检查数据排版**
刷新页面，右侧顶部的 4 个指标格子中的标签现在应该是大写等宽字体，数字非常大且醒目。各区域的小标题（如“已完成能力”）也变成了大写、等宽字体的工业风格。

- [ ] **Step 4: Commit**
```bash
git add docs/pinganpi-roadmap-dashboard.html
git commit -m "style(docs): 重构核心指标和标题为工业感极简排版"
```

---

### Task 4: 重新设计左侧阶段时间轴 (Timeline/List)

**Files:**
- Modify: `docs/pinganpi-roadmap-dashboard.html`

- [ ] **Step 1: 抛弃原有的彩色大圆角格子，改为极简线条**
现有的 `.phase-grid` 和 `.phase` 是方块网格。我们将它改为垂直连续列表。

```css
      /* 将原来的网格强制改为单列列表 */
      .phase-grid {
        display: flex;
        flex-direction: column;
        gap: 0; /* 去除缝隙，让它们连成一线 */
      }

      .phase {
        display: grid;
        grid-template-columns: 24px 1fr;
        align-items: center;
        gap: 12px;
        min-height: auto;
        padding: 12px 0;
        background: transparent;
        border: none;
        border-bottom: 1px solid var(--line);
        border-radius: 0;
      }
      
      /* 最后一项去底边框 */
      .phase:last-child {
        border-bottom: none;
      }

      /* 统一进度点样式为极简线条/方块 */
      .phase-number {
        width: 24px;
        height: 24px;
        background: var(--surface-muted);
        border: 1px solid var(--line);
        color: var(--subtle);
        font-size: 10px;
        border-radius: 2px;
      }

      /* 已完成状态 */
      .phase.done .phase-number {
        background: var(--ink);
        color: var(--bg); /* 黑底白字 */
        border-color: var(--ink);
      }

      /* 进行中状态 (Current/Next) */
      .phase.next .phase-number {
        background: transparent;
        color: var(--active);
        border: 1px solid var(--active);
        box-shadow: 0 0 8px rgba(59, 130, 246, 0.3); /* 极轻微的荧光感 */
      }

      .phase-title {
        font-size: 13px;
        font-weight: 500;
        color: var(--muted);
      }
      
      .phase.done .phase-title { color: var(--ink); }
      .phase.next .phase-title { color: var(--active); font-weight: 700; }
```

- [ ] **Step 2: 移除原来的进度条头图 (Progress Bar)**
在 HTML 中找到并删除 `.progress-track` 这个圆润的彩色进度条。
*（删除这块代码）*
```html
          <div class="progress-track" aria-hidden="true">
            <div class="progress-fill" style="width: 74%"></div>
          </div>
```

- [ ] **Step 3: 浏览器检查阶段列表**
刷新页面，左侧栏的 1-33 阶段应该变成了一个紧凑的纵向列表。完成的项数字框是白色（白底黑字），当前项（27）是亮蓝色空心框，其他是暗灰色。

- [ ] **Step 4: Commit**
```bash
git add docs/pinganpi-roadmap-dashboard.html
git commit -m "style(docs): 重构阶段进度列表为线性极简时间轴"
```

---

### Task 5: 优化右侧内容清单与按钮 (Lists & Buttons)

**Files:**
- Modify: `docs/pinganpi-roadmap-dashboard.html`

- [ ] **Step 1: 扁平化列表项与优先级卡片**
```css
      .list-item {
        background: transparent;
        border: 1px solid var(--line);
        border-radius: 2px;
        padding: 12px;
        grid-template-columns: 140px 1fr auto; /* 微调宽度 */
        align-items: start;
      }

      .priority {
        background: transparent;
        border: 1px solid var(--line);
        border-radius: 2px;
        padding: 16px;
      }
      
      .priority h3 {
        font-size: 14px;
        color: var(--ink);
      }
```

- [ ] **Step 2: 按钮设计 (Buttons)**
改为线框风格或极简方块。

```css
      .button {
        border-radius: 2px;
        background: var(--surface-muted);
        border: 1px solid var(--line);
        color: var(--ink);
        font-size: 12px;
        font-family: monospace;
        font-weight: normal;
        text-transform: uppercase;
      }
      
      .button:hover {
        background: var(--line);
        text-decoration: none;
      }

      .button.primary {
        background: var(--ink);
        color: var(--bg);
        border-color: var(--ink);
      }
      
      .button.primary:hover {
        background: #cccccc; /* 微调亮白色的悬浮态 */
      }
```

- [ ] **Step 3: 移动端媒体查询调整**
在现有的 `@media (max-width: 980px)` 中，确保 `bento-container` 回退成单列瀑布流。

```css
      @media (max-width: 980px) {
        .bento-container {
          grid-template-columns: 1fr;
          height: auto;
          overflow: visible;
        }
        .page {
          height: auto;
          overflow: auto;
        }
        .bento-sidebar, .bento-main {
          height: auto;
          overflow: visible;
        }
      }
```

- [ ] **Step 4: 浏览器最终检查**
在浏览器中确认：深色背景、方正卡片、细线条、等宽字体小标题。页面左右划分正确，在窗口宽度变小时自动换行，列表紧凑有序。

- [ ] **Step 5: Commit**
```bash
git add docs/pinganpi-roadmap-dashboard.html
git commit -m "style(docs): 优化内容清单并处理响应式降级"
```

---

Plan complete and saved to `docs/superpowers/plans/2026-05-24-optimizing-roadmap-dashboard-ui.md`.

Two execution options:
**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration
**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
