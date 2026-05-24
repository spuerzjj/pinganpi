# Roadmap Viewer Apple-style UI Implementation Plan

> **状态：已完成。** 当前实现以 `roadmap-viewer/src/App.vue`、`roadmap-viewer/src/styles.css` 和 `roadmap-viewer/src/roadmap-data.json` 为准。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the roadmap-viewer into a modern Apple-style (macOS/iOS) dashboard using a Bento Grid layout.

**Architecture:** Modify `roadmap-viewer/src/App.vue` and `roadmap-viewer/src/styles.css` to replace the current Tesla-style industrial look with a light, rounded, and high-texture Apple aesthetic. The layout will use an asymmetrical Bento Grid where the phase list is contained within a scrollable wide card.

**Tech Stack:** Vue 3, CSS Variables, CSS Grid, CSS Flexbox

---

### Task 1: Establish Apple Light Theme (CSS Variables & Base Styles)

**Files:**
- Modify: `roadmap-viewer/src/styles.css`

- [ ] **Step 1: Update CSS Variables to Apple defaults**

```css
:root {
  color: #1d1d1f;
  background: #f5f5f7;
  font-family:
    "SF Pro SC", "SF Pro Display", "SF Pro Icons", "PingFang SC", "Helvetica Neue", "Helvetica", "Arial", sans-serif;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  
  --bg: #f5f5f7;
  --surface: #ffffff;
  --surface-muted: #fbfbfd;
  --ink: #1d1d1f;
  --muted: #86868b;
  --subtle: #aeaeb2;
  --line: rgba(0, 0, 0, 0.1);
  --line-strong: rgba(0, 0, 0, 0.2);
  --accent: #34c759; /* Apple Green */
  --active: #007aff; /* Apple Blue */
  --warn: #ff9500;   /* Apple Orange */
  --risk: #ff3b30;   /* Apple Red */
  --shadow: 0 8px 30px rgba(0, 0, 0, 0.04);
}
```

- [ ] **Step 2: Update base component styles (cards, rounded corners, shadows)**

```css
body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
  background: var(--bg);
  color: var(--ink);
}

.page {
  width: min(1200px, calc(100% - 40px));
  margin: 0 auto;
  padding: 40px 0;
  overflow: auto; /* Enable global scrolling again */
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.metric,
.panel,
.phase,
.link-list a {
  border: 1px solid rgba(0, 0, 0, 0.02);
  border-radius: 20px; /* Soft Apple rounded corners */
  background: var(--surface);
  box-shadow: var(--shadow);
}
```

- [ ] **Step 3: Commit**
```bash
git add roadmap-viewer/src/styles.css
git commit -m "style(roadmap): 建立 Apple 风格亮色主题与圆角变量"
```

---

### Task 2: Build Apple Bento Grid Layout

**Files:**
- Modify: `roadmap-viewer/src/App.vue`
- Modify: `roadmap-viewer/src/styles.css`

- [ ] **Step 1: Re-structure `App.vue` template for Bento Grid**

```html
<template>
  <main class="page">
    <header class="hero">
      <div class="hero-content">
        <p class="eyebrow">平安批 / 开发管理</p>
        <h1>{{ model.data.title }}</h1>
        <p class="summary">{{ model.data.summary }}</p>
      </div>
      <div class="hero-meta">
        <span class="badge">更新：{{ model.data.updatedAt }}</span>
        <span class="badge">{{ model.completedCount }} / {{ model.totalCount }} 完成</span>
        <span class="badge active">{{ model.completionPercent }}%</span>
      </div>
    </header>

    <div class="bento-grid">
      <!-- 1. Current Baseline & Next Phase -->
      <section class="bento-span-2 focus-grid">
        <article class="panel">
          <p class="eyebrow">当前基线</p>
          <h2>{{ model.currentPhase?.title }}</h2>
          <p>{{ model.currentPhase?.summary }}</p>
        </article>
        <article class="panel panel-active">
          <p class="eyebrow">下一步</p>
          <h2>{{ model.nextPhase?.title }}</h2>
          <p>{{ model.nextPhase?.summary }}</p>
        </article>
      </section>

      <!-- 2. Core Metrics -->
      <section class="bento-span-1 metrics">
        <article v-for="metric in model.data.metrics" :key="metric.label" class="metric">
          <p class="label">{{ metric.label }}</p>
          <strong>{{ metric.value }}</strong>
          <span>{{ metric.note }}</span>
        </article>
      </section>

      <!-- 3. Scrollable Roadmap (Wide Card) -->
      <section class="bento-span-3 roadmap-card panel">
        <div class="section-head">
          <p class="eyebrow">阶段进度</p>
          <h2>Roadmap Progression</h2>
        </div>
        <div class="roadmap-scroll-area">
          <div class="phase-groups">
            <section v-for="group in model.phaseGroups" :key="group.status" class="phase-group">
              <h3>{{ group.label }}</h3>
              <div class="phase-list">
                <article v-for="phase in group.phases" :key="phase.id" :class="phaseClass(phase.status)">
                  <div class="phase-node"></div>
                  <div class="phase-content">
                    <div class="phase-title">
                      <span>{{ phase.title }}</span>
                      <em class="badge-mini">{{ getPhaseStatusLabel(phase.status) }}</em>
                    </div>
                  </div>
                </article>
              </div>
            </section>
          </div>
        </div>
      </section>

      <!-- 4. Risks -->
      <section class="bento-span-2 risks-card panel">
        <p class="eyebrow">风险</p>
        <h2>{{ model.riskCount }} 项待关注</h2>
        <ul class="risk-list">
          <li v-for="risk in model.data.risks" :key="risk">{{ risk }}</li>
        </ul>
      </section>

      <!-- 5. Documents -->
      <section class="bento-span-1 docs-card panel">
        <p class="eyebrow">文档</p>
        <h2>快速入口</h2>
        <div class="link-list">
          <a v-for="link in model.data.links" :key="link.href" :href="link.href">{{ link.label }}</a>
        </div>
      </section>
    </div>
  </main>
</template>
```

- [ ] **Step 2: Update CSS for Bento Grid layout**

```css
.bento-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.bento-span-3 { grid-column: span 3; }
.bento-span-2 { grid-column: span 2; }
.bento-span-1 { grid-column: span 1; }

.focus-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.metrics {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.roadmap-card {
  display: flex;
  flex-direction: column;
  max-height: 500px;
}

.roadmap-scroll-area {
  flex: 1;
  overflow-y: auto;
  padding: 0 20px 20px;
}
```

- [ ] **Step 3: Commit**
```bash
git add roadmap-viewer/src/App.vue roadmap-viewer/src/styles.css
git commit -m "refactor(roadmap): 构建 Apple Bento Grid 网格布局"
```

---

### Task 3: Refine Apple Typography & UI Components

**Files:**
- Modify: `roadmap-viewer/src/styles.css`

- [ ] **Step 1: Update Hero and Headings**

```css
.hero {
  border: none;
  background: transparent;
  padding: 0;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

h1 {
  font-size: 44px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

h2 {
  font-size: 20px;
  font-weight: 600;
}

.eyebrow {
  color: var(--active);
  font-weight: 600;
  font-size: 13px;
  text-transform: none;
  letter-spacing: 0;
  font-family: inherit;
}
```

- [ ] **Step 2: Update Badges and Pill styles**

```css
.badge {
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 12px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  color: var(--muted);
}

.badge.active {
  background: var(--active);
  color: #fff;
}

.badge-mini {
  font-style: normal;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 999px;
  color: var(--muted);
}
```

- [ ] **Step 3: Refine Metrics and Accents**

```css
.metric {
  padding: 14px;
  min-height: auto;
  text-align: center;
}

.metric strong {
  font-size: 28px;
  color: var(--ink);
  margin: 4px 0;
}

.panel-active {
  background: linear-gradient(135deg, #007aff, #00c7be);
  color: #fff;
}

.panel-active .eyebrow,
.panel-active h2,
.panel-active p {
  color: #fff;
}
```

- [ ] **Step 4: Commit**
```bash
git add roadmap-viewer/src/styles.css
git commit -m "style(roadmap): 优化 Apple 风格排版与胶囊标签"
```

---

### Task 4: Design Apple-style Vertical Timeline

**Files:**
- Modify: `roadmap-viewer/src/styles.css`

- [ ] **Step 1: Style the Phase List with Rounded Nodes**

```css
.phase-group h3 {
  font-size: 13px;
  color: var(--subtle);
  margin: 20px 0 12px;
  padding-left: 36px;
}

.phase-list {
  display: flex;
  flex-direction: column;
}

.phase {
  display: flex;
  gap: 16px;
  align-items: center;
  padding: 12px 16px;
  border: none;
  background: transparent;
  box-shadow: none;
  position: relative;
}

.phase-node {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--subtle);
  flex-shrink: 0;
  position: relative;
  z-index: 1;
}

.phase::before {
  content: '';
  position: absolute;
  left: 20px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: rgba(0, 0, 0, 0.05);
}

.phase:first-child::before { top: 50%; }
.phase:last-child::before { bottom: 50%; }

.phase-content {
  flex: 1;
  padding: 12px 16px;
  background: var(--surface-muted);
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.02);
}

.phase-done .phase-node {
  background: var(--accent);
  box-shadow: 0 0 0 4px rgba(52, 199, 89, 0.15);
}

.phase-next .phase-node {
  background: var(--active);
  box-shadow: 0 0 0 4px rgba(0, 122, 255, 0.2);
}

.phase-next .phase-content {
  background: #fff;
  border-color: var(--active);
  box-shadow: 0 4px 12px rgba(0, 122, 255, 0.08);
}
```

- [ ] **Step 2: Commit**
```bash
git add roadmap-viewer/src/styles.css
git commit -m "style(roadmap): 设计 Apple 风格垂直节点时间轴"
```

---

### Task 5: Final Polish & Responsive Refinement

**Files:**
- Modify: `roadmap-viewer/src/styles.css`

- [ ] **Step 1: Polish Lists and Links**

```css
.risk-list li {
  padding: 10px 14px;
  border-left: 3px solid var(--risk);
  background: rgba(255, 59, 48, 0.03);
  border-radius: 0 8px 8px 0;
  margin-bottom: 8px;
}

.link-list a {
  padding: 0 16px;
  min-height: 48px;
  font-weight: 600;
  font-family: inherit;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: all 0.2s ease;
}

.link-list a::after {
  content: '→';
  opacity: 0.3;
}

.link-list a:hover {
  background: var(--surface);
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.06);
}
```

- [ ] **Step 2: Update Media Queries**

```css
@media (max-width: 1024px) {
  .bento-grid {
    grid-template-columns: 1fr 1fr;
  }
  .bento-span-3, .bento-span-2 { grid-column: span 2; }
}

@media (max-width: 768px) {
  .bento-grid {
    grid-template-columns: 1fr;
  }
  .bento-span-3, .bento-span-2, .bento-span-1 { grid-column: span 1; }
  .focus-grid { grid-template-columns: 1fr; }
  .metrics { grid-template-columns: repeat(2, 1fr); }
  
  .hero { flex-direction: column; gap: 16px; }
  .hero-meta { justify-content: flex-start; }
  h1 { font-size: 32px; }
}
```

- [ ] **Step 3: Commit**
```bash
git add roadmap-viewer/src/styles.css
git commit -m "style(roadmap): 补齐 Apple 风格细节与响应式适配"
```

---

Plan complete and saved to `docs/superpowers/plans/2026-05-24-optimizing-roadmap-viewer-apple-ui.md`.

Execution Handoff:
I will now transition to **Subagent-Driven Execution** (using superpowers:subagent-driven-development) to implement this plan task-by-task. I will not pause between tasks unless I hit a blocker.

Proceeding to implement Task 1...
