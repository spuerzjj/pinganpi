# Roadmap Viewer UI 优化实施计划 (Vue)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有的 Roadmap Viewer (Vue 3) 升级为具有 Tesla-style 暗黑极客工业风和 Bento Box 网格布局的现代 Dashboard。

**Architecture:** 我们需要修改 `roadmap-viewer/src/App.vue` 和 `roadmap-viewer/src/styles.css`。布局改为：左侧通栏展示可滚动的阶段进度（Phase 1-33），右侧由不同的矩形卡片组成数据展示区。

**Tech Stack:** Vue 3, CSS Variables, CSS Grid, CSS Flexbox

---

### Task 1: 建立基础的 Tesla 极简暗黑主题 (CSS Variables)

**Files:**
- Modify: `roadmap-viewer/src/styles.css`

- [ ] **Step 1: 修改全局 CSS Variables，去除所有彩色和柔和颜色**

```css
:root {
  color: #ffffff;
  background: #000000;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  
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
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
  background: var(--bg);
  color: var(--ink);
}
```

- [ ] **Step 2: 规范卡片和通用排版**

```css
a {
  color: inherit;
  text-decoration: none;
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

.metric,
.panel,
.phase,
.link-list a {
  border: 1px solid var(--line);
  border-radius: 4px; /* 极小圆角 */
  background: var(--surface);
  box-shadow: none; /* 去除原本的阴影 */
}

.hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 24px;
  align-items: end;
  padding: 16px;
  border: 1px solid var(--line);
  background: var(--surface);
  border-radius: 4px;
}

.eyebrow {
  margin: 0 0 8px;
  color: var(--subtle);
  font-family: monospace;
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

h1, h2, h3, p { margin: 0; }

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

h3 {
  font-size: 13px;
  color: var(--muted);
  font-family: monospace;
  text-transform: uppercase;
}
```

- [ ] **Step 3: Commit**
```bash
git add roadmap-viewer/src/styles.css
git commit -m "style(roadmap): 应用 Tesla 风格极简暗黑主题基础"
```

---

### Task 2: 构建左侧通栏大卡 (Tall Sidebar Bento 布局)

**Files:**
- Modify: `roadmap-viewer/src/App.vue`
- Modify: `roadmap-viewer/src/styles.css`

- [ ] **Step 1: 在 `App.vue` 中重组网格布局**
将原本在中间的阶段进度区块移动到左侧。

```html
<template>
  <main class="page">
    <header class="hero">
      <div>
        <p class="eyebrow">平安批 / 开发管理</p>
        <h1>{{ model.data.title }}</h1>
        <p class="summary">{{ model.data.summary }}</p>
      </div>
      <div class="hero-meta">
        <span>更新：{{ model.data.updatedAt }}</span>
        <span>{{ model.completedCount }} / {{ model.totalCount }} 完成</span>
        <span>{{ model.completionPercent }}%</span>
      </div>
    </header>

    <div class="bento-container">
      <aside class="bento-sidebar">
        <section class="panel phase-panel">
          <div class="section-head">
            <div>
              <p class="eyebrow">阶段进度</p>
              <h2>Roadmap</h2>
            </div>
          </div>
          <div class="phase-groups-wrapper">
            <div class="phase-groups">
              <section v-for="group in model.phaseGroups" :key="group.status" class="phase-group">
                <h3>{{ group.label }}</h3>
                <div class="phase-list">
                  <article v-for="phase in group.phases" :key="phase.id" :class="phaseClass(phase.status)">
                    <div class="phase-number">{{ phase.id }}</div>
                    <div>
                      <div class="phase-title">
                        <span>{{ phase.title }}</span>
                        <em>{{ getPhaseStatusLabel(phase.status) }}</em>
                      </div>
                    </div>
                  </article>
                </div>
              </section>
            </div>
          </div>
        </section>
      </aside>

      <div class="bento-main">
        <section class="metrics" aria-label="关键状态">
          <article v-for="metric in model.data.metrics" :key="metric.label" class="metric">
            <p>{{ metric.label }}</p>
            <strong>{{ metric.value }}</strong>
            <span>{{ metric.note }}</span>
          </article>
        </section>

        <section class="focus-grid">
          <article class="panel">
            <p class="eyebrow">当前基线</p>
            <h2>{{ model.currentPhase?.title }}</h2>
            <p>{{ model.currentPhase?.summary }}</p>
          </article>
          <article class="panel panel-accent">
            <p class="eyebrow">下一步</p>
            <h2>{{ model.nextPhase?.title }}</h2>
            <p>{{ model.nextPhase?.summary }}</p>
          </article>
        </section>

        <section class="bottom-grid">
          <article class="panel">
            <div class="section-head">
              <div>
                <p class="eyebrow">风险</p>
                <h2>{{ model.riskCount }} 项待关注</h2>
              </div>
            </div>
            <ul class="risk-list">
              <li v-for="risk in model.data.risks" :key="risk">{{ risk }}</li>
            </ul>
          </article>

          <article class="panel">
            <p class="eyebrow">文档</p>
            <h2>快速入口</h2>
            <div class="link-list">
              <a v-for="link in model.data.links" :key="link.href" :href="link.href">{{ link.label }}</a>
            </div>
          </article>
        </section>
      </div>
    </div>
  </main>
</template>
```

- [ ] **Step 2: 编写 Bento Container 的 CSS**
在 `styles.css` 中添加布局代码：

```css
.bento-container {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 16px;
  flex: 1;
  min-height: 0;
}

.bento-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.phase-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 0; /* 我们把 padding 放到内部，方便滚动 */
}

.phase-panel .section-head {
  padding: 16px;
  border-bottom: 1px solid var(--line);
}

.phase-groups-wrapper {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.bento-main {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  overflow-y: auto;
  padding-right: 4px;
}

/* 右侧多余的 margin-top 移除 */
.metrics, .focus-grid, .bottom-grid {
  margin-top: 0;
}
```

- [ ] **Step 3: Commit**
```bash
git add roadmap-viewer/src/App.vue roadmap-viewer/src/styles.css
git commit -m "refactor(roadmap): 重组为 Bento Box 左右通栏网格布局"
```

---

### Task 3: 重构核心数据与排版细节 (Metrics & Accents)

**Files:**
- Modify: `roadmap-viewer/src/styles.css`

- [ ] **Step 1: 升级卡片和网格样式**

```css
.metrics {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.focus-grid,
.bottom-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.metric {
  min-height: auto;
  padding: 16px;
  background: var(--surface-muted);
}

.metric p {
  color: var(--muted);
  font-family: monospace;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 8px;
}

.metric strong {
  display: block;
  font-size: 32px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.02em;
  margin-bottom: 8px;
  color: var(--accent);
}

.metric span,
.panel p,
.risk-list {
  color: var(--muted);
  font-size: 13px;
  line-height: 1.6;
}

.metric span {
  display: block;
  margin-top: 0;
}

.panel {
  padding: 16px;
}

.panel-accent {
  border-color: var(--active);
}

.panel h2 + p {
  margin-top: 12px;
  color: var(--ink);
}

.summary {
  max-width: 780px;
  margin-top: 8px;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.6;
}

.hero-meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.hero-meta span {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  border: 1px solid var(--line);
  border-radius: 2px;
  padding: 0 8px;
  color: var(--muted);
  background: transparent;
  font-family: monospace;
  font-size: 11px;
  text-transform: uppercase;
  font-weight: normal;
}
```

- [ ] **Step 2: Commit**
```bash
git add roadmap-viewer/src/styles.css
git commit -m "style(roadmap): 优化卡片数据排版和核心指标视觉"
```

---

### Task 4: 重新设计左侧阶段时间轴 (Timeline/List)

**Files:**
- Modify: `roadmap-viewer/src/styles.css`

- [ ] **Step 1: 移除原有的阶段大网格和彩色样式，使用极简线条**

```css
.phase-groups {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.phase-group {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.phase-list {
  display: flex;
  flex-direction: column;
  gap: 0;
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

.phase:last-child {
  border-bottom: none;
}

.phase-number {
  display: inline-grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 2px;
  background: var(--surface-muted);
  border: 1px solid var(--line);
  color: var(--subtle);
  font-size: 10px;
  font-weight: normal;
}

.phase-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: var(--muted);
  font-size: 13px;
  font-weight: 500;
}

.phase-title em {
  display: inline-flex;
  align-items: center;
  min-height: 20px;
  border: 1px solid var(--line);
  border-radius: 2px;
  padding: 0 6px;
  color: var(--muted);
  background: transparent;
  font-family: monospace;
  font-size: 10px;
  font-weight: normal;
  text-transform: uppercase;
}

.phase p {
  display: none; /* 在侧边栏中隐藏阶段的详细 summary，保持简洁 */
}

/* 已完成状态 */
.phase-done .phase-number {
  background: var(--ink);
  color: var(--bg);
  border-color: var(--ink);
}
.phase-done .phase-title {
  color: var(--ink);
}

/* 进行中状态 */
.phase-next .phase-number {
  background: transparent;
  color: var(--active);
  border-color: var(--active);
  box-shadow: 0 0 8px rgba(59, 130, 246, 0.3);
}
.phase-next .phase-title {
  color: var(--active);
  font-weight: 700;
}
.phase-next .phase-title em {
  color: var(--active);
  border-color: var(--active);
}

/* 暂停状态 */
.phase-paused .phase-number {
  background: transparent;
  border-style: dashed;
}
```

- [ ] **Step 2: 去除原有进度条代码**
`App.vue` 中的 `<div class="progress-shell">...</div>` 已经被我们在 Task 2 中移除（通过直接不包含它重写 HTML）。现在可以移除原本的 CSS。
确保删除 `.progress-shell` 和 `.progress-bar` 以及 `.section-head` 相关的不必要居中逻辑（如果还有）。

- [ ] **Step 3: Commit**
```bash
git add roadmap-viewer/src/styles.css
git commit -m "style(roadmap): 重构 Vue 版本的侧边栏时间轴"
```

---

### Task 5: 底部细节与响应式降级 (Lists & Media Queries)

**Files:**
- Modify: `roadmap-viewer/src/styles.css`

- [ ] **Step 1: 整理 Risks 和 Links 列表**

```css
.risk-list {
  display: grid;
  gap: 10px;
  margin: 16px 0 0;
  padding: 0;
  list-style: none;
}

.risk-list li {
  padding-left: 14px;
  border-left: 2px solid var(--risk);
  color: var(--ink);
  font-size: 13px;
}

.link-list {
  display: grid;
  gap: 8px;
  margin-top: 16px;
}

.link-list a {
  display: flex;
  align-items: center;
  min-height: 36px;
  padding: 0 12px;
  background: var(--surface-muted);
  color: var(--ink);
  font-family: monospace;
  font-size: 12px;
  text-transform: uppercase;
}

.link-list a:hover {
  background: var(--line);
  border-color: var(--line-strong);
}
```

- [ ] **Step 2: 更新响应式查询**

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
  
  .hero,
  .focus-grid,
  .bottom-grid,
  .metrics {
    grid-template-columns: 1fr;
  }

  .hero-meta {
    justify-content: flex-start;
  }
}

@media (max-width: 560px) {
  h1 {
    font-size: 24px;
  }
}
```

- [ ] **Step 3: Commit**
```bash
git add roadmap-viewer/src/styles.css
git commit -m "style(roadmap): 补齐底部细节与自适应降级"
```

---

Plan complete and saved to `docs/superpowers/plans/2026-05-24-optimizing-roadmap-viewer-ui.md`.

Two execution options:
**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration
**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**