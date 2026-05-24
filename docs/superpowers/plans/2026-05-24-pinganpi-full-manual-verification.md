# 平安批完整人工验证计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 引导用户对《平安批》完成一次端到端人工验证，覆盖真实 CloudBase、双手机号、双人绑定、同步、AI 起稿、写信、送达、拆阅、断网恢复和原生调试入口。

**Architecture:** 本阶段不新增业务功能。Codex 负责准备环境、给出操作步骤、记录结果、归类缺陷；用户负责输入验证码、操作真实手机、查看控制台私密页面。任何手机号验证码、完整手机号、真实 key、SecretId、SecretKey、CloudBase token 或 MiMo key 不写入仓库。

**Tech Stack:** Vue 3、Vite、Varlet、Capacitor、CloudBase HTTP API、CloudBase HTTP 函数、Xiaomi MiMo、浏览器、iOS Simulator / 真机、Android Emulator / 真机。

---

## 前置条件

- 阶段 19 外部平台人工配置至少完成 CloudBase 手机号短信登录可用、预算 / 费用风险已确认或明确暂缓。
- 本机工作区为 `/Users/zhujunjie/code/pinganpi`。
- 工作区干净，或只存在本阶段验证记录改动。
- 不把验证码、完整手机号、真实 key 或 token 发给 Codex。

## 验证记录格式

执行阶段 20 时，新建或更新验证记录文件：

```text
docs/superpowers/reports/2026-05-24-pinganpi-full-manual-verification.md
```

记录结构：

```markdown
# 平安批完整人工验证记录

## 环境

- 日期：
- 分支：
- 提交：
- Web URL：
- CloudBase 环境：
- iOS 设备：
- Android 设备：

## 结果总览

- 通过：
- 失败：
- 阻塞：
- 待后续修复：

## 发现的问题

| 编号 | 严重度 | 模块 | 现象 | 复现步骤 | 处理阶段 |
| --- | --- | --- | --- | --- | --- |
```

## Task 1: 验证前环境检查

**Files:**
- Read: `package.json`
- Read: `docs/pinganpi-roadmap.md`
- Create/Modify during execution: `docs/superpowers/reports/2026-05-24-pinganpi-full-manual-verification.md`

- [ ] **Step 1: 确认 Git 状态**

Run:

```bash
git status --short --branch
git log --oneline --decorate -5
```

Expected:

- 当前分支是 `main`。
- 没有与验证无关的未提交改动。

- [ ] **Step 2: 启动基础验证命令**

Run:

```bash
npm test
npm run typecheck
npm run build
```

Expected:

- `npm test` 全部通过。
- `npm run typecheck` 通过。
- `npm run build` 通过；Varlet 首包超过 500 KB 的既有提示不作为阻塞。

- [ ] **Step 3: 启动 Web 调试服务**

Run:

```bash
npm run dev
```

Expected:

- 终端显示 Local、Network 和 RoadMap 地址。
- RoadMap 可通过 `npm run roadmap:dev` 打开独立 Roadmap Viewer。

## Task 2: CloudBase 与 MiMo 外部服务确认

**Files:**
- Read: `docs/superpowers/plans/2026-05-24-pinganpi-external-platform-closure.md`
- Modify during execution: `docs/superpowers/reports/2026-05-24-pinganpi-full-manual-verification.md`

- [ ] **Step 1: 运行 CloudBase 脱敏审计**

Run:

```bash
CLOUDBASE_ENV_ID=pinganpi-d7gml1f6sbcc172ea npm run cloudbase:audit:stage19
```

Expected:

- 输出不包含真实 key。
- `ai-scribe-proxy` 与 `sync-proxy` 均为 `Active / Available`。

- [ ] **Step 2: 运行 HTTP 健康检查**

Run:

```bash
curl -sS https://pinganpi-d7gml1f6sbcc172ea-1258361524.ap-shanghai.app.tcloudbase.com/api/health
curl -sS https://pinganpi-d7gml1f6sbcc172ea-1258361524.ap-shanghai.app.tcloudbase.com/sync/health
```

Expected:

- 两个命令都返回 `{"ok":true}`。

- [ ] **Step 3: 用户确认控制台人工项**

User action:

- 按 `docs/superpowers/plans/2026-05-24-pinganpi-external-platform-closure.md` 的“剩余人工回报模板”回报 CloudBase 短信、预算、权限和 MiMo key 管理结果。

Expected:

- 阶段 19 剩余项均标记为完成、暂缓或不可配置。
- 不泄露验证码、完整手机号或真实 key。

## Task 3: 双账号登录与绑定验证

**Files:**
- Modify during execution: `docs/superpowers/reports/2026-05-24-pinganpi-full-manual-verification.md`

- [ ] **Step 1: 准备两个浏览器身份**

Open:

```text
http://localhost:5173/?device=stage20-a
http://localhost:5173/?device=stage20-b
```

Expected:

- 两个页面使用不同本地设备命名空间。
- 两边都进入账号入口或已登录状态。

- [ ] **Step 2: A 登录并创建关系**

User action:

- A 使用手机号验证码登录。
- A 选择创建一对关系。
- A 生成邀请码。

Expected:

- A 成为 first member。
- 邀请码显示有效期，默认 24 小时。
- 验证记录只写“A 手机”，不写完整手机号或验证码。

- [ ] **Step 3: B 登录并加入关系**

User action:

- B 使用另一个手机号验证码登录。
- B 输入 A 的邀请码。

Expected:

- B 成为 second member。
- A / B 都显示已绑定状态。
- 两边 household 相同，member 不同。

- [ ] **Step 4: 拒绝异常绑定**

User action:

- 尝试重复使用已用邀请码。
- 尝试让已绑定账号再次创建关系。

Expected:

- 重复邀请码被拒绝。
- 已绑定账号不能创建第二个 active household。

## Task 4: 写信、AI、投寄与同步验证

**Files:**
- Modify during execution: `docs/superpowers/reports/2026-05-24-pinganpi-full-manual-verification.md`

- [ ] **Step 1: A 完成分步写信**

User action:

- 在 A 设备进入写信。
- 依次完成选写法、口述、起稿、校改、投寄。

Expected:

- AI 起稿可以流式显示。
- 起稿完成前不能投寄。
- 校改后正文可手工修改。
- 余额不足时不能投寄，不允许赊账。

- [ ] **Step 2: B 同步收信状态**

User action:

- 在 B 设备刷新或重新打开 App。

Expected:

- 未到达前能看到信件状态，但不能拆阅正文。
- 未到达前不暴露 AI metadata、私有草稿、正文摘要或照片附件信息。

- [ ] **Step 3: A / B 钱匣与账本核对**

Expected:

- A 投寄后扣除代书费和邮资。
- 账本有对应记录。
- B 不因接收未到达信件提前扣款。

## Task 5: 送达、拆阅与档案验证

**Files:**
- Modify during execution: `docs/superpowers/reports/2026-05-24-pinganpi-full-manual-verification.md`

- [ ] **Step 1: 选择可验证送达方式**

Options:

- 使用已有短送达窗口测试数据。
- 或在测试环境通过固定时间样本验证 `in_transit -> arrived`。

Expected:

- 不改生产规则、不绕过领域层状态机。

- [ ] **Step 2: B 拆阅到达信件**

Expected:

- 到达后可以拆阅正文。
- 拆阅产生邮政 / 档案记录。
- 重复拆阅不会重复追加错误记录。

- [ ] **Step 3: A 看到对方拆阅后的同步状态**

Expected:

- A 可看到信件进入已拆或相应档案状态。
- 同步不会回退信件状态。

## Task 6: 断网、重启、清空本地数据验证

**Files:**
- Modify during execution: `docs/superpowers/reports/2026-05-24-pinganpi-full-manual-verification.md`

- [ ] **Step 1: 离线草稿**

User action:

- 断网后创建或修改草稿。

Expected:

- 草稿可本地保存。
- 离线状态不能正式投寄或拆阅需要云端校验的信件。

- [ ] **Step 2: 恢复联网**

Expected:

- 联网后可以同步草稿。
- 如果发生冲突，冲突处理按现有同步策略执行，不丢失本地草稿。

- [ ] **Step 3: 清空本地数据后重新登录**

User action:

- 清空浏览器本地数据或重新安装 App。
- 使用同一手机号登录。

Expected:

- 找回同一平安批账号。
- 找回已有绑定关系。
- 可继续同步已有信件、账本和档案。

## Task 7: iOS / Android 原生验证

**Files:**
- Modify during execution: `docs/superpowers/reports/2026-05-24-pinganpi-full-manual-verification.md`

- [ ] **Step 1: 同步原生工程**

Run:

```bash
npm run cap:sync
npx cap doctor
```

Expected:

- `cap sync` 通过。
- `cap doctor` 通过。

- [ ] **Step 2: iOS 验证**

Run:

```bash
npx cap open ios
```

Expected:

- Xcode 可打开工程。
- App 可在 iOS Simulator 或真机启动。
- Safari Web Inspector 可查看 WebView console，或记录为暂缓。

- [ ] **Step 3: Android 验证**

Run:

```bash
npx cap open android
```

Expected:

- Android Studio 可打开工程。
- App 可在模拟器或真机启动。
- Chrome `chrome://inspect/#devices` 可查看 WebView console，或记录为暂缓。

## Task 8: 结果归类与收尾

**Files:**
- Modify: `docs/superpowers/reports/2026-05-24-pinganpi-full-manual-verification.md`
- Modify: `docs/pinganpi-roadmap.md`
- Modify: `roadmap-viewer/src/roadmap-data.json`
- Modify: `AGENTS.md`

- [ ] **Step 1: 汇总问题**

Classify:

- 阻塞发布的问题。
- 阶段 21 邮政异常可处理的问题。
- 阶段 22 推送可处理的问题。
- 阶段 23 照片附件可处理的问题。
- 阶段 24 发布准备与体验打磨可处理的问题。
- 既有 UI 集中修复清单。

- [ ] **Step 2: 更新路线图**

Expected:

- 阶段 20 标记为通过、部分通过或阻塞。
- 新发现问题写入对应阶段，不遗漏隐私 / 安全问题。

- [ ] **Step 3: 提交验证记录**

Run:

```bash
git status --short --branch
git diff --check
git add docs/superpowers/reports/2026-05-24-pinganpi-full-manual-verification.md docs/pinganpi-roadmap.md roadmap-viewer/src/roadmap-data.json AGENTS.md
git commit -m "docs(stage20): 记录完整人工验证结果"
```

Expected:

- 工作区只包含验证记录和路线图更新。
- 提交消息符合 Conventional Commits。

## Self-Review

- 阶段 20 覆盖浏览器、CloudBase、MiMo、iOS、Android、双账号、双人绑定、同步、AI、写信、送达、拆阅、断网和清空本地数据。
- 本计划不要求用户泄露验证码、完整手机号、真实 key 或 token。
- 本计划不临时修改业务规则，也不绕过领域层状态机。
