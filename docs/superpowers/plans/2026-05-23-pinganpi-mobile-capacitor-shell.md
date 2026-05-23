# Pinganpi Mobile Capacitor Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first local mobile app shell for 《平安批》 with Capacitor, using the existing TypeScript domain rules and mock data to render the initial core screens.

**Architecture:** Keep the current `src/domain` package as the source of truth for time, scribe, wallet, money, and postal rules. Add a Vue/Vite app under `src/app` with Varlet components and Tailwind styling, then wrap it with Capacitor for iOS/Android. The first version uses deterministic local mock data only; cloud persistence and native notification wiring remain later phases.

**Tech Stack:** TypeScript, Vue 3, Vite, Tailwind CSS, Varlet, Capacitor, Vitest.

---

## File Structure

- `package.json`: add Vite, Vue, Varlet, Tailwind, Capacitor scripts and dependencies.
- `tsconfig.json`: include `.vue` files, DOM libs, and Vite types.
- `vite.config.ts`: configure Vue, Tailwind, and Vitest.
- `capacitor.config.ts`: define the native app id, name, and web output directory.
- `index.html`: Vite HTML entry.
- `src/vite-env.d.ts`: Vite and Vue SFC type declarations.
- `src/main.ts`: Vue app bootstrap with Varlet.
- `src/App.vue`: app layout, tab navigation, and page routing.
- `src/styles.css`: Tailwind import and global theme tokens.
- `src/app/mock-data.ts`: fixed two-person local scenario, city scribes, wallet, letters, and archive records.
- `src/app/app-model.ts`: view-model helpers that compose mock data with domain rules.
- `src/app/app-model.test.ts`: focused tests proving the UI model reuses existing domain rules.
- `src/app/pages/*.vue`: initial pages for Today, Write Letter, Scribes, Wallet, Mailbox/Archive.

## Tasks

- [x] Confirm the worktree is clean before editing.
- [x] Install and configure Vue/Vite/Tailwind/Varlet/Capacitor dependencies.
- [x] Add a local app model that derives era dates, scribe attendance, postage, delivery windows, wallet settlement, and letter state labels from `src/domain`.
- [x] Write tests for the app model before implementing it.
- [x] Implement the mobile-first App shell with bottom navigation and restrained archive-style visuals.
- [x] Implement first-pass pages: 今日、写信、代笔先生、钱匣、信箱/档案.
- [x] Run `npm test`, `npm run typecheck`, and `npm run build`.
- [x] Start local dev server and verify the first screen in browser at desktop/mobile viewport.

## Acceptance Criteria

- The app runs locally through Vite and is ready for Capacitor native sync.
- UI is mobile-first, still usable on desktop.
- Tailwind and Varlet are both active in the rendered app.
- No postal, money, time, or scribe rule is reimplemented in the UI layer.
- All first-pass screens render from local mock data without cloud dependencies.
- Existing domain tests still pass.
