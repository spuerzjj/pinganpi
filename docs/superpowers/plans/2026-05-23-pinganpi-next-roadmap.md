# Pinganpi Current Progress And Next Roadmap

> **For agentic workers:** This document records the current project state after the domain foundation and Capacitor shell work. Use it to orient future implementation plans before touching code.

**Current Branch:** `main`

**Current Commit:** `37a4593 feat(app): 搭建 Capacitor 移动壳层`

**Workspace Policy:** Continue development directly in `/Users/zhujunjie/code/pinganpi`. Do not create or use `.worktrees/` for routine development unless the user explicitly asks for it.

---

## Current Progress

### Phase 1: Domain Foundation

Status: complete.

Implemented under `src/domain/`:

- 66-year reality-to-era time mapping.
- China-local `Asia/Shanghai` calendar boundaries.
- Old-currency fen/yuan-jiao-fen helpers.
- Scribe model and deterministic daily attendance.
- Wallet settlement with natural income and living-cost deductions.
- 1960-style postal postage, delivery windows, and letter state transitions.

Current test coverage:

- `src/domain/time.test.ts`
- `src/domain/money.test.ts`
- `src/domain/scribes.test.ts`
- `src/domain/wallet.test.ts`
- `src/domain/postal.test.ts`

### Phase 2: Capacitor Mobile Shell

Status: complete for local mock UI.

Implemented:

- Capacitor native shells under `ios/` and `android/`.
- Vue 3 + Vite app entry.
- Tailwind CSS global styling.
- Varlet component registration.
- Mobile-first app shell with bottom navigation.
- Local mock scenario for the two-person product.
- App view-model layer that composes mock data with domain rules.
- First-pass screens:
  - 今日
  - 写信
  - 代笔先生
  - 钱匣
  - 信箱 / 档案

Key files:

- `src/App.vue`
- `src/main.ts`
- `src/styles.css`
- `src/app/mock-data.ts`
- `src/app/app-model.ts`
- `src/app/app-model.test.ts`
- `src/app/pages/`
- `capacitor.config.ts`

Important constraint already satisfied: UI code does not reimplement time, money, scribe, wallet, postage, delivery-window, or letter-state rules. It calls `src/domain`.

## Verification Baseline

The following commands passed from `/Users/zhujunjie/code/pinganpi` after merging back to `main`:

```bash
npm ci
git diff --check
npm test
npm run typecheck
npm audit --omit=dev
npm run build
npx cap sync
npx cap doctor
```

Known build note:

- `npm run build` reports a Vite chunk-size warning because the first Varlet-backed bundle is over 500 KB. This is not currently blocking, but should be revisited before release.

## Not Done Yet

The project does not yet have:

- Native simulator or physical-device verification.
- Completed Xcode / Android Studio / Android SDK / JDK setup on the local Mac.
- Local persistence for drafts, letters, wallet, and ledger.
- Interactive write-letter state changes.
- Draft paper save and restore.
- Template-based scribe generation.
- Photo attachment flow.
- Real-time waiting and delivery progression from persisted timestamps.
- Lost / delayed / found / returned progression in the app UI.
- Cloud sync.
- Push notifications.
- Two-person account binding.
- Production app icon and launch screen.
- Bundle splitting / Varlet import optimization.

## Recommended Next Phases

### Phase 3: Native Debug Environment

Goal: make the current Capacitor shell run on iOS and Android simulators.

Tasks:

- Install full Xcode and open `ios/`.
- Install Android Studio, Android SDK, Android Emulator, and JDK.
- Run `npx cap open ios`, then launch an iPhone Simulator.
- Run `npx cap open android`, then launch an Android Emulator.
- Confirm WebView debugging:
  - iOS through Safari Web Inspector.
  - Android through Chrome `chrome://inspect/#devices`.
- Keep `npm run dev` for browser-first UI debugging.
- Use `npm run cap:sync` before packaged native checks.

Acceptance:

- The app opens on one iOS simulator.
- The app opens on one Android emulator.
- WebView console inspection works on both platforms.
- Any required local setup steps are documented.

### Phase 4: Local Persistence Layer

Goal: replace static mock-only state with local durable app state while still avoiding cloud dependency.

Recommended scope:

- Define local app state schema:
  - members
  - wallet
  - ledger entries
  - draft papers
  - letters
  - postal records
- Add storage adapter boundary so later cloud sync can replace or augment it.
- Start with browser-compatible storage during local development.
- Keep all domain calculations in `src/domain`.
- Add tests for load, save, migration defaults, and invalid stored data handling.

Acceptance:

- Refreshing the app does not lose drafts or wallet state.
- Corrupt local storage falls back safely without crashing.
- Tests cover storage defaults and one saved letter lifecycle.

### Phase 5: Write-Letter Flow

Goal: turn the current write screen into a real first-version local workflow.

Recommended flow:

- Choose present scribe or choose handwritten letter.
- Enter oral text.
- Generate first scribe draft from templates.
- Allow manual revision.
- Calculate scribe fee, postage, registered fee, photo fee later.
- Check wallet balance.
- Prevent overdraft.
- Seal and post.
- Deduct wallet costs.
- Add ledger entries.
- Create letter copy / receipt.
- Create postal records.

Acceptance:

- A user can complete one local letter from oral text to posted state.
- Insufficient balance blocks posting and preserves draft.
- Posted letters cannot be edited.
- Ledger and archive reflect the posting.

### Phase 6: Template Scribe Engine

Goal: implement first-version non-AI scribe drafting.

Recommended scope:

- Add a template engine boundary that can later be replaced by AI.
- Inputs:
  - oral text
  - scribe
  - sender city
  - recipient city
  - letter type
  - reply context
  - emotion / scene tags
- Outputs:
  - scribe draft
  - read-aloud text
  - signature
  - draft source metadata
- Cover initial scenes:
  - 问安
  - 想念
  - 报平安
  - 道歉
  - 久未回信
  - 天气
  - 劳累
  - 生病
  - 生日
  - 纪念日
  - 回信

Acceptance:

- Different scribes produce visibly different drafts.
- Oral text remains stored as `oralText`.
- Final edited body remains stored as `finalText`.
- Generation metadata is preserved for future AI migration.

### Phase 7: Mailbox And Real-Time Delivery Progression

Goal: make delivery availability depend on real elapsed time.

Recommended scope:

- Persist sent timestamp and estimated arrival window.
- Compute current availability from `Date.now()`.
- Keep ordinary letters silent until the user opens the mailbox.
- Allow arrived letters to be opened.
- Prevent opening before arrival.
- Add delayed / lost / found / returned statuses with recorded postal events.

Acceptance:

- A newly posted letter is not immediately openable.
- An arrived letter becomes openable based on real time.
- Status changes produce postal records.
- No letter disappears without a record.

### Phase 8: Cloud And Two-Person Sync Preparation

Goal: prepare for real two-person use after local workflow is stable.

Recommended scope:

- Define remote data model based on the local schema.
- Add account/member binding for exactly two people.
- Add conflict strategy for wallet, letters, drafts, and postal records.
- Plan file storage for photo attachments.
- Plan push notification events:
  - registered letter arrived
  - important letter arrived
  - found lost letter
  - returned letter

Acceptance:

- Local schema can map to cloud records without rewriting domain rules.
- Cloud boundary does not leak into `src/domain`.
- Notification events remain limited and era-appropriate.

## Operating Notes

- Prefer browser debugging first: `npm run dev`.
- Use `npm run cap:sync` after web changes before packaged native checks.
- Do not commit generated `dist/` or copied Capacitor web assets.
- Keep UI mobile-first while usable on desktop.
- Preserve the restrained archive/ledger visual direction.
- Do not add AI drafting before the template engine boundary exists.
