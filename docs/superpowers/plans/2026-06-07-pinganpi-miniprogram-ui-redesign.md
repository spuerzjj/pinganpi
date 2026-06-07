# Pinganpi Miniprogram UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete stage 28 by redesigning every WeChat mini program page with a non-retro quiet modern UI while preserving existing business behavior.

**Architecture:** Keep existing page TypeScript and domain services intact. Replace the global visual token layer and repeated page-level style primitives, then update WXML class names to modern semantic components. Use a file-based Vitest guard to prevent regression to retro tokens and class names.

**Tech Stack:** WeChat native mini program WXML/WXSS, TypeScript, Vitest, existing CloudBase service wrappers.

---

### Task 1: Add UI Redesign Regression Guard

**Files:**
- Create: `apps/miniprogram/styles/ui-redesign.test.ts`

- [x] **Step 1: Write failing tests**

Add tests that require quiet modern tokens, block old retro class names, and verify non-retro app navigation colors.

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- apps/miniprogram/styles/ui-redesign.test.ts`

Expected: FAIL because `--paper`, `--seal`, `archive-panel`, `stamp`, `ledger-button`, `paper-input`, and old app colors still exist.

### Task 2: Replace Global Design System

**Files:**
- Modify: `apps/miniprogram/styles/tokens.wxss`
- Modify: `apps/miniprogram/app.wxss`
- Modify: `apps/miniprogram/app.json`

- [x] **Step 1: Replace token names and palette**

Use `--app-bg`, `--surface`, `--surface-raised`, `--surface-muted`, `--text-primary`, `--text-secondary`, `--text-muted`, `--accent`, `--accent-soft`, `--accent-warm`, `--danger`, `--success`, `--border`, `--border-strong`, `--radius-sm`, `--radius-md`, `--radius-lg`.

- [x] **Step 2: Replace old global classes**

Replace `archive-panel` with `hero-panel`, `stamp` with `status-pill`, `ledger-button` with `action-button`, and `paper-input` with `form-input`.

- [x] **Step 3: Update app configuration**

Set window and tabBar colors to the quiet modern palette required by the regression test.

### Task 3: Update All Page Markup

**Files:**
- Modify: `apps/miniprogram/pages/account/index.wxml`
- Modify: `apps/miniprogram/pages/pair/index.wxml`
- Modify: `apps/miniprogram/pages/today/index.wxml`
- Modify: `apps/miniprogram/pages/write/index.wxml`
- Modify: `apps/miniprogram/pages/scribes/index.wxml`
- Modify: `apps/miniprogram/pages/wallet/index.wxml`
- Modify: `apps/miniprogram/pages/mailbox/index.wxml`
- Modify: `apps/miniprogram/pages/archive/index.wxml`

- [x] **Step 1: Rename semantic classes**

Apply `hero-panel`, `page-label`, `page-title`, `page-copy`, `action-button`, `form-input`, and `status-pill`.

- [x] **Step 2: Preserve bindings**

Keep all existing `wx:if`, `wx:for`, `bindtap`, `bindinput`, `bindchange`, and dynamic text bindings intact.

### Task 4: Modernize Page-Specific Styles

**Files:**
- Modify: `apps/miniprogram/pages/account/index.wxss`
- Modify: `apps/miniprogram/pages/pair/index.wxss`
- Modify: `apps/miniprogram/pages/write/index.wxss`

- [x] **Step 1: Remove duplicate old button/input styles**

Delete local `ledger-button` and `paper-input` definitions.

- [x] **Step 2: Add focused page-specific variants**

Keep only account/pair error panels, pair invite code, and write page progress/editor/letter/nav styles.

### Task 5: Update Roadmap Artifacts

**Files:**
- Modify: `docs/pinganpi-roadmap.md`
- Modify: `tools/roadmap-viewer/src/roadmap-data.json`
- Modify: `AGENTS.md`

- [x] **Step 1: Insert new stage 28**

Add “小程序 UI 完整重设计” as stage 28 and shift existing stage numbers.

- [x] **Step 2: Record current design decision**

Document that the accepted direction is non-retro quiet modern, with writing page editorial warmth.

### Task 6: Verify

**Files:**
- No code files.

- [x] **Step 1: Run targeted regression**

Run: `npm test -- apps/miniprogram/styles/ui-redesign.test.ts`

Expected: PASS.

Actual: PASS, 1 test file and 3 tests.

- [x] **Step 2: Run full checks**

Run: `npm test`, `npm run miniprogram:check`, `npm run roadmap:build`, `npm run structure:audit`, and `git diff --check`.

Actual: PASS for `npm test` (65 files, 420 tests), `npm run miniprogram:check`, `npm run typecheck`, `npm run roadmap:build`, `npm run structure:audit`, `node --check tools/scripts/miniprogram-devtools-automator.cjs`, and `git diff --check`.

- [x] **Step 3: Visual verification**

Compare `docs/assets/stage28-ui-redesign/non-retro-ui-concept.png` with rendered mini program / preview screenshots, recording any intentional deviations.

Actual: Viewed `docs/assets/stage28-ui-redesign/non-retro-ui-concept.png` and `docs/assets/stage28-ui-redesign/implementation-preview.png`. The implementation preview is a static Chrome-rendered verification artifact based on current tokens and representative page structure because `npm run miniprogram:devtools:flow` could not find an enabled WeChat DevTools service port in this session.
