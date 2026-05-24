# 平安批开发路线图

> **供后续代理使用：** 本文件记录《平安批》在领域层、Capacitor 移动壳层和原生调试阶段之后的当前状态。后续开始实现前，应先阅读本文件确认方向、边界和验收标准。

**可视化看板：** `docs/pinganpi-roadmap-dashboard.html`

**当前分支：** `main`

**当前开发基线：** 已完成阶段 12 的 App 侧 AI 起稿链路；阶段 13 已跑通本机 Xiaomi MiMo、本地代理、App 写信页、CloudBase HTTP 云函数部署、云端 secret 配置、云端 AI 起稿接口、浏览器写信页云端 AI 烟测、CloudBase 用量基线、禁用 key 安全失败验证和恢复验证，并已删除历史遗留 `/*` 路由，只保留 `/api`。阶段 14 已完成 AI 起稿流式工程链路：本地 / 云端代理支持受控 SSE，App 起稿页可边收边显示，完成前不会进入可投寄正文，云端 `/api/ai/scribe-draft/stream` 已通过非敏感烟测。阶段 15 已完成云端与双人同步准备基础：新增远端模型、sync adapter 边界、AppState / RemoteSnapshot 转换、远端快照合并和本地 mock remote adapter，已用本地测试验证双设备 push / pull / merge；远端实体使用 `remoteId` 避免跨设备 id 冲突，pull 会对收件方未到达来信正文做红action，删除草稿可同步 tombstone。本阶段未接真实 CloudBase 数据库 SDK。阶段 16 已确定先走 16A：本地 / 模拟远端同步闭环优先，设计文档和实施计划已建立，下一步接入 App 侧同步 runtime、同步状态、联网操作护栏和双设备验证；真实 CloudBase 数据库 adapter 放到闭环稳定后的阶段 16B。阶段 13 仍需完成 MiMo / CloudBase 控制台费用告警和 CloudBase 默认角色收敛检查；阶段 14 仍需在用户授予 Computer Use 权限后补一次 GUI 浏览器操作验证。精确提交以 `git log --oneline --decorate -5` 为准。

**工作区策略：** 日常开发直接在 `/Users/zhujunjie/code/pinganpi` 进行。除非用户明确要求隔离开发，否则不要创建或使用 `.worktrees/`。

---

## 当前进展

### 阶段 1：领域层基础

状态：已完成。

实现位置：`src/domain/`

已实现：

- 现实时间到 App 内旧时代时间的 66 年映射。
- 基于中国大陆 `Asia/Shanghai` 的本地日历边界。
- 旧币制分 / 元角分 helper。
- 代笔先生模型与确定性每日出勤。
- 钱匣自然收入、自然消耗与结算。
- 1960 年风格的邮资、传递窗口与信件状态流转。

现有测试覆盖：

- `src/domain/time.test.ts`
- `src/domain/money.test.ts`
- `src/domain/scribes.test.ts`
- `src/domain/wallet.test.ts`
- `src/domain/postal.test.ts`

### 阶段 2：Capacitor 移动壳层

状态：本地 mock UI 已完成。

已实现：

- `ios/` 和 `android/` 下的 Capacitor 原生壳。
- Vue 3 + Vite App 入口。
- Tailwind CSS 全局样式。
- Varlet 组件注册。
- 移动端优先的 App 壳层与底部导航。
- 面向两人使用场景的本地 mock 数据。
- 组合 mock 数据与领域规则的 App view-model 层。
- 第一批页面：
  - 今日
  - 写信
  - 代笔先生
  - 钱匣
  - 信箱 / 档案

关键文件：

- `src/App.vue`
- `src/main.ts`
- `src/styles.css`
- `src/app/mock-data.ts`
- `src/app/app-model.ts`
- `src/app/app-model.test.ts`
- `src/app/pages/`
- `capacitor.config.ts`

重要约束：UI 层没有重复实现时间、钱、代笔先生、钱匣、邮资、传递窗口或信件状态规则，而是调用 `src/domain`。

### 阶段 3：原生调试环境

状态：模拟器 App 启动基线已完成。

已验证：

- Android 模拟器可以构建、安装并启动 `com.pinganpi.app`。
- iOS Simulator 可以构建、安装并启动 `com.pinganpi.app`。
- `npx cap doctor` 显示 iOS 和 Android 依赖状态正常。

剩余手工确认：

- 通过 Safari Web Inspector 确认 iOS WebView console 可检查。

### 阶段 4：本地持久化层

状态：本地存储基础已完成。

已实现：

- `AppState` 本地 schema，覆盖 members、scribes、wallet、ledger entries、draft papers、letters、postal records。
- 默认状态从现有 seed 数据生成，日期以 ISO 字符串保存。
- `localStorage` storage adapter 边界，测试环境使用内存 storage。
- 状态序列化、解析和坏数据安全回退。
- 钱匣自然结算会写回持久化 wallet，并追加账本记录。
- `AppModel` 已从持久化 `AppState` 构建 UI model，不再直接依赖 mock-only 全局状态。
- App 启动时会加载本地状态、执行一次钱匣结算，并在状态变化时保存。

当前测试覆盖：

- `src/app/app-state.test.ts`
- `src/app/app-model.test.ts`

### 阶段 5：写信主流程

状态：第一版本地闭环已完成。

已实现：

- 写信服务 `src/app/write-letter-service.ts`，以纯函数方式接收 `AppState` 并返回新状态。
- 可选择当天在场代笔先生或亲笔。
- 可输入口述、生成先生初稿、手工校改正文。
- 可保存本地草稿到 `draftPapers`。
- 可封缄投寄普通信或挂号信。
- 投寄时校验钱匣余额，不允许赊账。
- 投寄成功后扣除代书费和邮资，追加 `ledgerEntries`。
- 投寄成功后生成信件副本和邮政记录。
- 写信页面已从静态展示改为本地表单，并接入 `localStorage` 持久化。

当前测试覆盖：

- `src/app/write-letter-service.test.ts`
- `src/app/app-model.test.ts`

### 阶段 6：模板代书引擎

状态：第一版非 AI 模板引擎已完成。

已实现：

- 新增 `src/app/scribe-template-engine.ts` 作为可替换的 template engine 边界。
- `write-letter-service` 已改为调用模板引擎，不再内置代书模板 switch。
- 模板引擎输入包含 oral text、scribe、sender / recipient、城市、letter type、reply context、emotion tags。
- 模板引擎输出包含 scribe draft、read-aloud text、signature、draft source、generation metadata。
- 不同代笔先生会产生可感知不同的草稿风格。
- 草稿和投寄信件会保存 `oralText`、`scribeDraft`、`finalText`、`draftSource`、`generationMeta`。
- 生成来源当前为 `template` / `handwritten`，为后续 AI 接入预留 `ai`。

当前测试覆盖：

- `src/app/scribe-template-engine.test.ts`
- `src/app/write-letter-service.test.ts`

### 阶段 7：写信分步流程

状态：5 步可回看流程已完成。

已实现：

- 写信页拆为 `选写法 → 口述 → 起稿 → 校改 → 投寄`。
- 已完成步骤可回看，未满足条件的后续步骤不可跳转。
- 修改口述或写法后需要重新起稿。
- 起稿、保存草稿、封缄投寄继续复用现有写信服务和模板代书引擎。
- 投寄页展示邮资、挂号选择、钱匣余额、邮路和誊清预览。

当前测试覆盖：

- `src/app/write-letter-wizard.test.ts`

### 阶段 8：草稿管理 / 信纸匣

状态：本地草稿管理闭环已完成。

已实现：

- 新增 `src/app/draft-paper-service.ts`，统一处理草稿新增、覆盖保存、删除和从草稿投寄。
- 写信页右栏新增“信纸匣”，展示草稿列表、更新时间、收件人、写法和状态。
- 支持从草稿续写，并恢复口述、先生初稿、校改正文和写法。
- 支持保存新草稿，也支持覆盖当前草稿，不重复新增。
- 新信第一次存为草稿后，会采用新草稿 id，但不重置当前写信步骤和投寄前临时选择。
- 删除当前正在续写的草稿后，会清除当前编辑态并重置写信 wizard。
- 从草稿封缄投寄成功后，会清理该草稿；投寄、扣款、账本和邮政记录继续复用写信服务。
- 草稿不持久化挂号选择，挂号只作为投寄前确认选项。

当前测试覆盖：

- `src/app/draft-paper-service.test.ts`
- `src/app/write-letter-wizard.test.ts`
- `src/app/write-letter-service.test.ts`
- `src/app/app-model.test.ts`

### 阶段 9：信箱与真实时间送达推进

状态：本地真实时间送达闭环已完成。

已实现：

- 领域层新增送达时间窗口和 `canArriveBy` 判断，基于真实投寄时间与传递窗口推进送达。
- 新增 `postal-progress-service`，按真实经过时间将 `in_transit -> arrived`，并写入稳定投递记录。
- `settleAppState` 已整合钱匣结算和邮政推进，App 启动与进入信箱时都会结算状态。
- 新增 `mailbox-service`，拆阅前会先推进邮政状态；到达前、非收件人、重复拆阅都会被服务层拒绝。
- 拆阅成功后写入稳定拆阅记录，并将信件推进到 `opened`。
- 信箱页区分“今日信箱”“路上信札”“旧信匣 / 邮政档案”。
- 未到达的收进信件不展示正文摘要，避免提前泄露内容。
- 档案页展示每封信的最后邮政记录，并可展开完整邮政记录簿。

当前测试覆盖：

- `src/domain/postal.test.ts`
- `src/app/postal-progress-service.test.ts`
- `src/app/mailbox-service.test.ts`
- `src/app/app-state.test.ts`
- `src/app/app-model.test.ts`

## 路线图总览

主线阶段按“本地体验稳定 → AI 接入设计 → 本地 AI 代理 → AI 正文生成 → 云端 AI 配置 → AI 体验优化 → 同步模型 → 双人真实可用 → 异常与附件 → 发布质量”推进。当前已完成阶段 15 云端与双人同步准备基础；阶段 13 还有控制台人工收口事项，阶段 14 还有 GUI 点击补测，下一工程阶段已进入阶段 16A 双人同步本地闭环。

**本期目标：** 完成阶段 16A 双人同步本地闭环：把阶段 15 的同步模型接入 App 运行时，支持同步状态、启动 / 前台 refresh、操作后 push、联网投寄 / 拆阅护栏和本地双设备生命周期验证。真实 CloudBase 数据库 adapter 放到 16B，AI 仍只负责“代笔先生起稿”，不替用户自动投寄，不绕过手工校改，不改变真实等待、邮资、钱匣和信件状态规则。

| 阶段 | 名称 | 状态 | 说明 |
| --- | --- | --- | --- |
| 1 | 领域层基础 | 已完成 | 时间、钱、代笔先生、钱匣、邮资、信件状态机。 |
| 2 | Capacitor 移动壳层 | 已完成 | Vue / Tailwind / Varlet / iOS / Android 壳层。 |
| 3 | 原生调试环境 | 已完成基础 | iOS / Android 模拟器可启动，Safari Web Inspector 仍需手工确认。 |
| 4 | 本地持久化层 | 已完成 | `AppState`、localStorage、坏数据回退、钱包结算。 |
| 5 | 写信主流程 | 已完成 | 口述、起稿、校改、投寄、扣款、邮政记录。 |
| 6 | 模板代书引擎 | 已完成 | 非 AI 模板边界，保留未来 AI metadata。 |
| 7 | 写信分步流程 | 已完成 | 5 步 wizard，可回看、可投寄。 |
| 8 | 草稿管理 / 信纸匣 | 已完成 | 续写、覆盖保存、删除、从草稿投寄。 |
| 9 | 信箱与真实时间送达推进 | 已完成 | 真实等待、到达前不可拆、拆阅记录、邮政档案。 |
| 10 | AI 代笔接入设计 | 已完成 | 明确 AI 生成正文的边界、提示词素材、隐私、失败处理和测试策略。 |
| 11 | 本地 AI 代理基础 | 已完成 | 本地最小 AI 代理脚手架已完成，用于开发期验证 MiMo 调用和响应结构。 |
| 12 | AI 生成信件正文落地 | 已完成 App 侧链路 | 已接入 AI adapter、写信页异步起稿、AI metadata 保存和失败提示；真实云端配置在阶段 13。 |
| 13 | 云端 AI 代理与费用配置 | 进行中 | CloudBase HTTP 云函数、云端 secret、`/api` 路由、云端 AI 起稿、浏览器烟测、禁用 key 安全失败、恢复验证和 `/*` 路由清理已完成；控制台费用告警和默认角色收敛检查待完成。 |
| 14 | AI 起稿流式体验优化 | 已完成工程实现 | 本地 / 云端受控 SSE、App 流式 adapter、写信页 partial 预览、完成前不可投寄、云端流式烟测已通过；GUI 浏览器操作验证待权限补测。 |
| 15 | 云端同步准备 | 已完成基础 | 已新增远端模型、sync adapter、快照转换/合并和本地 mock remote adapter；不接真实云 SDK。 |
| 16 | 双人真实同步 MVP | 16A 进行中 | 先用本地 / 模拟远端接入 App 同步 runtime、同步状态和联网操作护栏；真实 CloudBase 数据库 adapter 放到 16B。 |
| 17 | 邮政异常规则 | 未开始 | 延误、错分、迷失、找回、退回的确定性推进。 |
| 18 | 系统推送 | 未开始 | 重要信、挂号信、找回、退回等克制提醒。 |
| 19 | 照片附件 | 未开始 | 夹寄照片、费用、存储、展示和隐私边界。 |
| 20 | 发布准备与体验打磨 | 未开始 | toast、图标、启动页、真机、bundle、发布检查。 |

### 阶段依赖

- 阶段 10 是阶段 11 和阶段 12 的前置条件：先明确 AI 起稿边界、提示词素材、失败处理和隐私策略，再实现本地代理与 App 侧 AI adapter。
- 阶段 11 已提供阶段 12 开发期所需的本地代理边界；阶段 12 已接入 App 侧 AI adapter，不阻塞于云端购买和部署。
- 阶段 13 是生产级 AI 能力的前置条件：真实 MiMo env、费用告警、服务端 secret、云函数 / CloudBase 落点和回滚删除步骤在本阶段完成。
- 阶段 14 是体验优化阶段：本地 / 云端流式代理和 App partial 预览已实现；它不改变写信、投寄、等待和拆阅规则。
- 阶段 15 是阶段 16 的前置条件：远端模型、同步协议和本地 mock remote 验证已完成基础；阶段 16A 先在此边界上完成 App 侧同步 runtime 和本地双设备闭环，真实 CloudBase 数据库 adapter 放到 16B。
- 阶段 17 可以在阶段 15 后独立设计；若与真实双设备同步并行推进，必须保证邮政事件幂等。
- 阶段 18 依赖阶段 15 的远端事件边界，也依赖阶段 17 的异常事件定义。
- 阶段 19 依赖阶段 15 的文件存储规划；具体云存储购买 / 配置在阶段 19 实施，UI 原型可以提前做本地 mock。
- 阶段 20 贯穿后续阶段，但集中收尾应放在 AI、双人同步、推送和附件稳定之后。

## 验证基线

最近阶段 15 云端同步准备新增验证记录：

- `git diff --check`：通过。
- `node node_modules/vitest/vitest.mjs run`：23 个测试文件，225 个测试通过。当前 Codex shell 中 `npm` 不在 PATH，因此使用项目依赖的等价 Vitest 入口。
- `node node_modules/vue-tsc/bin/vue-tsc.js --noEmit`：通过。当前 Codex shell 中 `npm` 不在 PATH，因此使用项目依赖的等价 Vue TSC 入口。

既有阶段 13 / 14 云端、构建和原生基线如下，本次阶段 15 纯 TypeScript 同步模块未重跑这些云端 / 原生命令：

- `npm run build`：通过，保留 Varlet / 首包超过 500 KB 的既有提示。
- `npx cap sync`：通过，已同步 iOS / Android Web assets。
- `npx cap doctor`：通过，iOS / Android Capacitor 依赖正常。
- `npm run cloudbase:build:ai`：通过，生成的 `cloudbase/functions/` 已被 Git 忽略。
- `CLOUDBASE_ENV_ID=pinganpi-d7gml1f6sbcc172ea npm run cloudbase:deploy:ai`：通过，函数 `ai-scribe-proxy` 已重新部署。
- `CLOUDBASE_ENV_ID=pinganpi-d7gml1f6sbcc172ea npm run cloudbase:configure:ai-env`：通过，已写入 6 个云端环境变量，输出不打印真实值。
- `GET https://pinganpi-d7gml1f6sbcc172ea-1258361524.ap-shanghai.app.tcloudbase.com/api/health`：返回 `{ "ok": true }`。
- `POST /api/ai/scribe-draft` 非敏感口述烟测：返回 HTTP 200，provider 为 `xiaomi-mimo`，model 为 `mimo-v2.5-pro`。
- `POST /api/ai/scribe-draft/stream` 非敏感口述烟测：返回多段 `event: delta` 和最终 `event: done`，provider 为 `xiaomi-mimo`，model 为 `mimo-v2.5-pro`，未返回 provider 原始 `choices` chunk。
- `POST http://127.0.0.1:8787/ai/scribe-draft/stream` 本地非敏感口述烟测：返回多段 `event: delta` 和最终 `event: done`。
- 浏览器写信页云端 AI 起稿烟测：使用 `VITE_PINGANPI_AI_PROXY_URL=https://pinganpi-d7gml1f6sbcc172ea-1258361524.ap-shanghai.app.tcloudbase.com/api` 启动本地 App，起稿成功且可进入下一步。
- `CLOUDBASE_ENV_ID=pinganpi-d7gml1f6sbcc172ea npm run cloudbase:disable:ai-env`：通过，云端 env 只保留 5 项，移除 `MIMO_API_KEY`。
- 禁用 key 后 `POST /api/ai/scribe-draft`：返回 HTTP 502，`reason: "proxy_unavailable"`，无正文。
- 恢复 env 后 `POST /api/ai/scribe-draft`：返回 HTTP 200，确认云端代理已恢复。
- `cloudbase env usage --json`：当前计费周期 `2026-05-23 ~ 2026-06-23`，`usedCredits: 0.56`，其中 NoSQL Database `0.52`、Cloud function `0.01`、API calls `0.03`。
- CloudBase HTTP 路由：历史遗留 `/*` 已删除，只保留 `/api`；`/api/health` 和 `/api/ai/scribe-draft` 删除后均重新验证通过。
- 云函数公开面检查：HTTP 函数 `ai-scribe-proxy` 状态 Available，运行时 `Nodejs20.19`，触发器 0，VPC 为空，env 仅包含 6 个 AI 代理变量；默认角色仍为 `TCB_QcsRole`。
- `rg -n "MIMO_API_KEY|VITE_MIMO|VITE_XIAOMI|tp-|sk-" src --glob '!**/*.test.ts'`：无生产代码命中。
- GUI 浏览器操作验证：已尝试用 Computer Use 操作 Chrome，但 macOS Accessibility / Screen Recording 权限仍未授予，无法读屏点击；需用户授权后补测。

以下命令曾在 `/Users/zhujunjie/code/pinganpi` 下通过：

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

已知构建提示：

- `npm run build` 会提示 Varlet 相关首包超过 500 KB。这是后续优化项，不是当前阻塞项。

## 尚未完成

项目目前还没有完成：

- 生产级 AI 能力：本机 MiMo、本地代理、本地费用护栏、可复用 handler 边界、CloudBase HTTP 云函数、云端 secret、云端代理地址、浏览器云端起稿烟测、流式起稿、禁用 key 安全失败验证、恢复验证和 `/*` 路由清理已跑通；CloudBase / MiMo 控制台费用告警和默认角色收敛检查仍在阶段 13。
- AI 起稿流式输出已完成本地 / 云端工程实现；GUI 浏览器点击验证因 Computer Use 权限未授予，需后续补测。
- 真实 CloudBase 数据库同步、双人账户绑定和真实双设备数据同步。
- 阶段 13 的 AI 能力额度、云端费用限额和 CloudBase 默认角色收敛检查；回滚 / 删除命令已记录，但控制台告警仍需手工确认。
- 延误、错分、迷失、找回、退回的自动确定性推进规则。
- 系统推送：重要信、挂号信、迷失信找回、退回信件。
- 照片附件：夹寄、费用、存储、展示和隐私控制。
- 更丰富的模板内容库和场景覆盖。
- 真机验证。
- iOS Safari Web Inspector 的 WebView console 手工确认。
- Codex Computer Use 对 Chrome 的 Accessibility / Screen Recording 权限未完成，暂无法自动执行 GUI 浏览器点击验证。
- 生产级 App 图标和启动页。
- Bundle 拆分与 Varlet 按需优化。

## 集中 UI 修复清单

这些问题先记录，后续进入 UI polish 阶段时统一修复，不在当前业务阶段逐项打断：

- 写信流程的成功 / 失败提示不够明显。目前提示只是页面顶部的普通文字条，用户完成“存作草稿”或“誊清封缄”后不容易察觉。后续应改为更明确的 toast / snackbar 或类似临时反馈，并保证移动端可见、不会被底部导航遮挡。

## 阶段详情与后续推荐

### 阶段 10：AI 代笔接入设计

状态：已完成。

设计文档：

- `docs/superpowers/specs/2026-05-23-pinganpi-ai-scribe-design.md`

目标：把“AI 生成信件正文”设计成现有代笔先生起稿能力的一种实现方式，先明确边界，再进入购买和接入。

推荐范围：

- 复用已完成的代书流程和数据结构，新增 AI generation adapter 设计，不重复实现写信规则。
- AI 输入限定为用户口述、代笔先生、寄信人 / 收信人、城市、信件类型、情绪标签和必要上下文。
- AI 输出必须映射到现有草稿结构：`scribeDraft`、`readAloudText`、`signature`、`draftSource: "ai"`、`generationMeta`。
- 现有模板库改造为提示词素材、风格样例和约束规则，不再作为可直接生成完整正文的用户可选代拟制。
- 提示词要保持 1960 年左右旧时代代笔口吻，避免现代聊天腔、营销腔、过度文学化和即时通信表达。
- 生成失败、超时、额度不足或网络不可用时，不生成完整正文；系统保存口述草稿并提示稍后再请先生起稿。
- 用户仍必须手工校改正文，AI 不能自动封缄投寄。
- 明确隐私与日志边界：允许将口述发送到第三方模型服务，但不记录完整敏感口述到控制台，不保存完整 prompt 或原始 provider response，不把未拆信正文暴露给收件方。
- 明确调用边界：移动端 / Vite 客户端不得直连 AI 供应商，不得携带 provider key；真实 AI key 只能在云函数或服务端代理中使用。

验收标准：

- 有清晰的 AI adapter 接口、输入输出类型、错误类型和失败处理策略。
- 设计说明如何保存 `draftSource: "ai"`、provider、model、prompt version 和耗时等 metadata。
- 不需要真实 AI key 也能用 fake adapter 写测试。
- 设计明确 AI key 不进客户端包，客户端只调用自有云函数或服务端代理。
- `src/domain` 不引入 AI、浏览器、Capacitor 或云服务依赖。

非目标：

- 不在本阶段购买 AI 服务。
- 不接真实 AI SDK。
- 不做 AI 改写用户已经校定的最终正文。
- 不改变邮资、钱匣、投寄、送达和拆阅规则。

### 阶段 11：本地 AI 代理基础

状态：已完成。本阶段只完成开发期本地代理基础；真实 MiMo 连接验证、费用告警和云端落点配置已拆到阶段 13。

已完成：

- 新增 `server/ai-scribe-proxy/`。
- 新增服务端配置读取和密钥防线，拒绝 `VITE_` MiMo key。
- 新增 MiMo OpenAI-compatible `/v1/chat/completions` client，默认 30 秒超时，错误不读取 provider body。
- 新增本地 HTTP 代理：
  - `GET /health`
  - `POST /ai/scribe-draft`
- 本地 HTTP 代理只接受无 Origin 的命令行请求、本地开发 Origin 和 Capacitor / Ionic localhost Origin；拒绝外站网页借用本机代理消耗 MiMo 额度。
- 本地 HTTP 代理限制请求体不超过 32 KB，provider 失败响应不会回传原始错误详情。
- 新增连接检查命令：`npm run ai-proxy:check`。
- 新增本地代理启动命令：`npm run ai-proxy:dev`。
- 新增 `.env.example`，真实 key 仍不得入库。

目标：在 AI 接入设计明确后，先建立本地可测的服务端代理边界，让阶段 12 可以开发 App 侧 AI adapter，而不把 AI provider key 放进移动端 / Vite 客户端。

推荐范围：

- 本地 Node 服务端读取 `MIMO_API_BASE_URL`、`MIMO_MODEL_ID`、`MIMO_API_KEY` 和 `MIMO_REQUEST_TIMEOUT_MS`。
- 本地代理提供 `GET /health` 和 `POST /ai/scribe-draft`。
- 本地代理只接受无 Origin 的命令行请求、本地开发 Origin 和 Capacitor / Ionic localhost Origin。
- 本地代理请求体限制 32 KB，provider 失败不回传原始错误详情。
- 提供 `npm run ai-proxy:check` 和 `npm run ai-proxy:dev`。
- 服务端测试必须纳入 Vitest，不能虚假通过。

验收标准：

- 本地代理和 MiMo client 有 fake fetch / fake requester 测试覆盖。
- 仓库不包含任何真实 secret、token、私钥或管理员密码。
- 无真实 env 时 `npm run ai-proxy:check` 安全失败，不输出 key。
- 移动端构建产物和 Vite 客户端环境中不包含 AI provider key。

非目标：

- 不在本阶段做云端购买、CloudBase 配置或生产部署。
- 不在本阶段完成真实 MiMo 额度、费用告警和 secret 配置。
- 不在本阶段实现完整双设备同步业务。
- 不在本阶段把 AI 生成接入写信页面。
- 不在本阶段正式初始化同步数据库、文件存储、身份认证或推送资源。
- 不购买高规格云服务器或长期包年资源。
- 不把云 SDK 或 AI SDK 引入 `src/domain`。
- 不把真实密钥提交到 Git。

### 阶段 12：AI 生成信件正文落地

状态：已完成 App 侧本地可测链路；真实 MiMo / 云端烟测留到阶段 13。

实施计划：

- `docs/superpowers/plans/2026-05-23-pinganpi-ai-scribe-app-adapter.md`

已实现：

- 新增 `src/app/ai-scribe-adapter.ts`，客户端只调用代理 URL，不读取 provider key。
- `ScribeGenerationMeta` 支持 `ai-scribe-v1`，保存 provider、model、prompt version、scribe id、scene tags、letter type、城市和 latency。
- `AppState` 序列化 / 解析支持 AI 起稿 metadata。
- `write-letter-service` 可接收页面生成的 `scribeDraft`、`readAloudText`、`draftSource` 和 `generationMeta`，并保存到草稿和投寄信件。
- 写信向导保存 `readAloudText`、`draftSource` 和 `generationMeta`；口述或写法变化后会清空旧起稿和旧 metadata，避免复用过期 AI 结果。
- 写信页“起稿”步骤改为异步：
  - 亲笔写法使用本地起稿结果，不调用 AI。
  - 选择代笔先生时调用 HTTP AI adapter。
  - 起稿中禁用关键操作。
  - 失败时不生成模板正文，保留口述并提示稍后再请先生起稿。
- 新增 `src/app/runtime-config.ts`，读取 `VITE_PINGANPI_AI_PROXY_URL`，默认开发代理为 `http://127.0.0.1:8787`。

当前测试覆盖：

- `src/app/ai-scribe-adapter.test.ts`
- `src/app/app-state.test.ts`
- `src/app/write-letter-service.test.ts`
- `src/app/write-letter-wizard.test.ts`

目标：让代笔先生能够基于用户口述调用 AI 生成信件初稿，并继续保留旧时代代笔、手工校改和口述草稿降级路径。

推荐范围：

- 实现阶段 10 定义的 AI generation adapter；开发期先调用阶段 11 的本地代理或 fake adapter，后续阶段 13 再替换为云端 AI 代理地址。
- 写信流程的“起稿”步骤使用 AI 起稿；失败时保存口述草稿，不生成模板正文，并给出明确但克制的提示。
- 生成结果保存 `draftSource: "ai"` 和 `generationMeta`，包括 provider、model、prompt version、latency、failure reason。
- AI 起稿必须继续使用代笔先生风格、口述内容和旧时代书信提示词素材约束。
- AI 生成后用户可以手工修改正文，最终投寄仍以用户确认的 `finalText` 为准。
- 增加 fake AI adapter 测试、失败保存口述草稿测试、metadata 保存测试和 UI 起稿流程测试。
- 客户端只调用自有云函数或服务端代理，不直连第三方 AI API。

验收标准：

- 没有真实 AI key 时，测试仍可通过 fake adapter 验证完整流程。
- 真实 MiMo / 云端配置烟测后移到阶段 13；阶段 12 只要求客户端不持有 provider key，并能调用代理边界。
- AI 失败不会破坏写信流程，口述草稿可保存，稍后可重新起稿。
- 生成正文不会绕过用户校改、费用校验、封缄投寄和真实等待规则。
- 控制台和持久化 metadata 不记录不必要的敏感原始响应。
- 构建产物不包含第三方 AI provider key。

非目标：

- 不做自动回信。
- 不做 AI 代用户投寄。
- 不做未拆来信正文总结或改写。
- 不做多人或公开模型运营后台。

### 阶段 13：云端 AI 代理与费用配置

状态：进行中。本机 MiMo 连通、本地代理起稿、本地费用护栏、可复用 handler 边界、CloudBase HTTP 云函数、云端 secret、`/api` 路由、云端 AI 起稿接口、浏览器写信页云端 AI 烟测、禁用 key 安全失败验证、恢复验证和历史 `/*` 路由清理已跑通；CloudBase / MiMo 控制台费用告警和 CloudBase 默认角色收敛检查仍待完成。

实施计划：

- `docs/superpowers/plans/2026-05-23-pinganpi-cloud-ai-proxy.md`

当前已完成：

- `npm run ai-proxy:check` 和 `npm run ai-proxy:dev` 会自动读取本机 `.env.ai.local`。
- `.env.ai.local` 已在 `.gitignore` 中忽略，适合保存本机真实 MiMo env。
- 本机 `.env.ai.local` 已创建为私有权限 `600`，已按官方文档填入 `MIMO_API_BASE_URL=https://api.xiaomimimo.com/v1`、`MIMO_MODEL_ID=mimo-v2.5-pro` 和本机真实 `MIMO_API_KEY`。该文件被 Git 忽略，不提交。
- `.env.example` 已补充说明：`MIMO_API_BASE_URL` 和 `MIMO_MODEL_ID` 必须以 Xiaomi MiMo 订阅页实际显示为准；当前示例值来自官方 OpenAI API 文档。
- MiMo client 请求体已按官方 OpenAI API 文档显式设置 `thinking: { type: "disabled" }`。
- `npm run ai-proxy:check` 已真实连通 Xiaomi MiMo，返回 `sample: "平安可达"`。
- `POST http://127.0.0.1:8787/ai/scribe-draft` 已返回 AI 初稿。
- 写信页真实 AI 起稿烟测已通过：无错误提示，“下一步”可用。
- Prompt 已补充约束：禁止模型编造日期、农历、干支或未给出的具体时间。
- 本地代理已加入费用护栏配置：
  - `PINGANPI_AI_MAX_ORAL_TEXT_CHARS` 控制单次口述最大字符数，默认 800，超限会在调用 MiMo 前返回受控错误。
  - `MIMO_MAX_COMPLETION_TOKENS` 控制单次最大输出 token，默认 900，避免输出长度失控。
- 本地代理核心逻辑已抽为 `server/ai-scribe-proxy/handler.ts`，本地 dev server 只负责 Node HTTP 桥接；后续 CloudBase / 云函数入口可复用同一套校验、CORS、prompt、MiMo client 和错误归一逻辑。
- 用户已购买腾讯云 CloudBase，阶段 13 云端落点确定为 CloudBase HTTP 云函数。
- 已安装 `@cloudbase/cli@3.4.0`，并新增：
  - `npm run cloudbase:login`
  - `npm run cloudbase:build:ai`
  - `CLOUDBASE_ENV_ID=<env-id> npm run cloudbase:configure:ai-env`
  - `CLOUDBASE_ENV_ID=<env-id> npm run cloudbase:disable:ai-env`
  - `CLOUDBASE_ENV_ID=<env-id> npm run cloudbase:deploy:ai`
- 已新增 `server/ai-scribe-proxy/cloudbase-entry.ts`，将 CloudBase HTTP event 适配到共享 `handleAiProxyRequest`。
- 已新增 `server/ai-scribe-proxy/cloudbase-http-server.ts` 和 `server/ai-scribe-proxy/cloudbase-bootstrap.ts`，以 CloudBase Web Server 模式监听 `0.0.0.0:9000`。
- CloudBase 构建会生成 `scf_bootstrap`，避免 HTTP 函数进程启动后退出。
- 云端 handler 支持 CloudBase 实际路由前缀 `/api`：`/api/health` 与 `/api/ai/scribe-draft` 会归一到共享代理路径。
- 云端 env 缺失时 `POST /api/ai/scribe-draft` 会返回受控 `502 proxy_unavailable`，不会泄露 provider body 或导致进程异常退出。
- 已新增 `cloudbaserc.json`，函数名为 `ai-scribe-proxy`，运行时为 `Nodejs20.19`，构建产物目录为 `cloudbase/functions/ai-scribe-proxy`。
- CloudBase 环境 ID 已确认为 `pinganpi-d7gml1f6sbcc172ea`，区域为 `ap-shanghai`。
- CloudBase 默认访问地址为 `https://pinganpi-d7gml1f6sbcc172ea-1258361524.ap-shanghai.app.tcloudbase.com/api`。
- CloudBase HTTP 路由已收敛为只保留 `/api`；历史遗留 `/*` 路由已删除。
- 函数 `ai-scribe-proxy` 已部署为 HTTP 函数，`GET /api/health` 已返回 `{ "ok": true }`。
- 云端 secret 已通过 `npm run cloudbase:configure:ai-env` 从本机 `.env.ai.local` 写入 CloudBase 函数环境变量，文档和命令输出只记录变量名，不记录真实值。
- 云端 `POST /api/ai/scribe-draft` 非敏感口述烟测已返回 HTTP 200，provider 为 `xiaomi-mimo`，model 为 `mimo-v2.5-pro`。
- 浏览器写信页使用云端代理地址完成一次真实 AI 起稿烟测，页面可进入校改前下一步。
- `npm run cloudbase:disable:ai-env` 已可移除云端 `MIMO_API_KEY`，用于临时停用 AI 起稿和安全失败验证。
- 禁用云端 `MIMO_API_KEY` 后，`POST /api/ai/scribe-draft` 已验证返回受控 `502 proxy_unavailable`，不会生成正文；恢复 env 后再次验证返回 HTTP 200。
- CloudBase 用量基线已读取：当前计费周期 `2026-05-23 ~ 2026-06-23`，`usedCredits: 0.56`，其中 NoSQL Database `0.52`、Cloud function `0.01`、API calls `0.03`。
- 关闭 / 恢复入口已明确：
  - 临时关闭 AI 起稿：`CLOUDBASE_ENV_ID=<env-id> npm run cloudbase:disable:ai-env`
  - 恢复 AI 起稿：`CLOUDBASE_ENV_ID=<env-id> npm run cloudbase:configure:ai-env`
- 删除预览入口已明确：
  - `CLOUDBASE_ENV_ID=<env-id> cloudbase fn delete ai-scribe-proxy --dry-run`
  - `CLOUDBASE_ENV_ID=<env-id> cloudbase routes delete <domain> -p /api --dry-run`
  - `cloudbase env delete --env-id <env-id> --dry-run`
- 云函数公开面检查已完成：HTTP 函数 `ai-scribe-proxy` 状态 Available，运行时 `Nodejs20.19`，触发器数量为 0，VPC 未配置，env 仅包含 AI 代理变量；默认角色为 `TCB_QcsRole`，仍需确认 CloudBase 控制台是否支持更细粒度角色。

下一步：

- 配置 Xiaomi MiMo 费用告警、额度上限和余额提醒。
- 配置 CloudBase 函数调用量、出网流量、错误率和费用告警。
- 检查 CloudBase 控制台是否可把默认 `TCB_QcsRole` 收敛为更细粒度角色。
- 记录 MiMo 控制台撤销 / 轮换 key 的实际入口。
- 根据 `docs/superpowers/plans/2026-05-23-pinganpi-cloud-ai-proxy.md` 执行云端代理配置。

目标：把阶段 11 剩余的真实 MiMo 配置、云端代理落点、费用告警、secret 管理和资源删除 / 回滚步骤独立完成，为长期真机使用提供生产级 AI 调用边界。

推荐范围：

- 选择云服务落点，优先评估腾讯云 CloudBase 是否适合承载最小 AI 服务端代理。
- 默认优先接入用户已购买的 Xiaomi MiMo 模型；实施时确认 API base URL、模型 ID、调用协议、额度上限、费用告警和响应质量。
- 使用最小规格或免费 / 低成本资源启动，不购买服务器 CVM，除非 AI 代理明确需要自管运行时。
- 创建开发环境和未来生产环境的命名规范，例如 `pinganpi-dev`、`pinganpi-prod`。
- 配置费用预算、余额提醒、自动续费策略、AI 调用费用告警和资源用量告警，避免长期后台费用失控。
- 配置最小权限访问：开发者账号、云函数 / 服务端代理权限、AI 服务 key、只读 ping 验证权限。
- 明确密钥保存方式：真实 AI key 只放在云平台 secret / 环境变量或本机服务端 `.env.local` 中，不进入 Vite 客户端环境变量，不使用 `VITE_` 前缀，不提交 Git。
- 记录最小 AI 代理初始化步骤、Xiaomi MiMo 连接验证步骤、回滚方式、资源删除步骤和费用检查清单。
- 为后续 App 生产配置输出 AI adapter 所需环境变量、服务端代理地址和连接验证命令。
- 同步数据库、文件存储、身份认证和推送资源本阶段只做评估和命名预留，不正式购买 / 初始化。

验收标准：

- 有一份可复现的云端 AI 代理和 AI 能力配置文档，后续代理能按文档重新创建最小环境。
- 云端资源和 AI 调用都有费用上限或明确的人工检查流程。
- AI 能力有明确用途、额度上限、费用告警和密钥保存方式；默认供应商记录为 Xiaomi MiMo，后续如需更换供应商必须再确认。
- 仓库不包含任何真实 secret、token、私钥或管理员密码。
- 云函数或服务端代理可以读取服务端环境变量连接 AI 测试端点，并通过只读 / ping 类命令验证配置可用。
- 移动端构建产物和 Vite 客户端环境中不包含 AI provider key。

非目标：

- 不在本阶段实现完整双设备同步业务。
- 不正式初始化同步数据库、文件存储、身份认证或推送资源。
- 不购买高规格云服务器或长期包年资源。
- 不把云 SDK 或 AI SDK 引入 `src/domain`。
- 不把真实密钥提交到 Git。

### 阶段 14：AI 起稿流式体验优化

状态：已完成工程实现；GUI 浏览器点击验证待用户授予 Computer Use 权限后补测。

实施计划：

- `docs/superpowers/plans/2026-05-24-pinganpi-ai-scribe-streaming.md`

已完成：

- 新增 `requestMimoChatCompletionStream`，使用 MiMo OpenAI-compatible `stream: true`，复用非流式 URL、header、`thinking: { type: "disabled" }`、token guard 和 timeout。
- 服务端新增 `POST /ai/scribe-draft/stream`，CloudBase 路由为 `POST /api/ai/scribe-draft/stream`。
- 服务端只输出受控 SSE：`delta`、`done`、`error`；不透传 provider 原始 chunk、prompt、key 或 provider body。
- MiMo stream client 必须收到 provider `data: [DONE]` 才会正常完成；如果 partial delta 后 EOF，会转为受控失败，不会把半截正文标记为可投寄成稿。
- 本地 dev server 和 CloudBase Web Server 入口已将 `AsyncIterable` 真正写为 SSE response。
- App 侧 `AiScribeAdapter` 新增 `generateDraftStream`，解析受控 SSE，边收边回调累计文本，`done` 后才返回完整 `ScribeDraftResult`。
- 写信页新增页面级 `streamingDraftText`，只在“起稿”面板显示 partial；右侧誊清预览、校改、保存为有效 AI draft 和投寄仍只读取完成后的 wizard state。
- 流式失败、中断、空响应或缺失 provider `[DONE]` 不会进入校改 / 投寄，也不会保存成有效 AI draft。
- 保存口述草稿时不再自动回落成本地模板正文，避免 AI 失败后悄悄生成模板稿。
- 云端函数已重新部署，云端 `/api/ai/scribe-draft/stream` 非敏感口述烟测已返回多段 `delta` 与最终 `done`。

目标：让代笔先生起稿时边生成边显字，改善等待感，但不改变慢通信规则。

推荐范围：

- 本地 / 云端代理支持 MiMo OpenAI-compatible `stream: true`。
- 解析 SSE chunk，只转发正文 delta 和受控 done / error 事件。
- 保留现有非流式 `/ai/scribe-draft` 作为兜底。
- App 侧新增 streaming adapter，边收边更新页面临时预览文本；只有 `done` 后才写入 `scribeDraft`。
- 生成中禁用“下一步 / 投寄 / 保存”，完成后才允许进入校改。
- 流式中断时标记未完成，不自动进入校改；用户可重新请先生起稿。
- 不把 provider 原始 chunk、完整 prompt、真实 key 暴露给客户端或日志。
- 更新写信页文案和状态，保持克制旧时代气质。

验收标准：

- fake stream 测试已覆盖 delta、done、error 和中断。
- 服务端 SSE 解析逻辑已测试，覆盖 chunk 拆分、空 delta、provider 错误、timeout 和坏 JSON。
- 本地 / 云端 stream endpoint 已用非敏感口述烟测，确认返回受控 delta / done。
- 完成后 metadata 和最终正文正常保存。
- 中断不会保存为可投寄正文；保存口述草稿不会回落到模板正文。
- 非流式接口仍可用。
- 浏览器 GUI 点击验证待补：当前 Computer Use 缺少 macOS Accessibility / Screen Recording 权限，无法自动操作 Chrome。

非目标：

- 不改变投寄、费用、送达、拆阅规则。
- 不做自动投寄或自动校改。
- 不为未拆来信做流式总结。

### 阶段 15：云端与双人同步准备

状态：已完成基础。阶段设计与实施计划已建立，`src/app/sync/` 纯 TypeScript 同步边界和本地 mock remote adapter 已完成；真实 CloudBase 数据库 adapter 留到阶段 16B。

设计文档：

- `docs/superpowers/specs/2026-05-24-pinganpi-cloud-sync-design.md`

实施计划：

- `docs/superpowers/plans/2026-05-24-pinganpi-cloud-sync-foundation.md`

已实现：

- 新增 `src/app/sync/remote-model.ts`，定义 `RemoteHousehold`、`RemoteMember`、`RemoteWallet`、`RemoteLedgerEntry`、`RemoteDraftPaper`、`RemoteLetter`、`RemotePostalRecord`、`RemoteSyncCursor`、`RemotePhotoAttachment`、`RemoteSnapshot` 和 `SyncAdapter`。
- 新增 `src/app/sync/remote-snapshot.ts`，支持从 `AppState` 导出远端拆分实体，并把远端快照合并回本地状态。
- 新增 `mergeRemoteSnapshots`，供 mock remote adapter 合并远端实体，不把远端存储降级成单一 `AppState` blob。
- 新增 `src/app/sync/mock-remote-adapter.ts`，用本地内存模拟 household 远端快照、revision 和 device cursor。
- 新增测试覆盖：AI metadata 安全字段、白名单转换、append-only 去重、跨设备同 id 不丢数据、未到达来信正文红action、信件状态单向推进、草稿冲突、草稿 tombstone、对方私有草稿过滤、双设备 push / pull / opened 合并和深拷贝隔离。

目标：本地流程和生产级 AI 调用边界稳定后，为真实两人使用做云端同步准备。

推荐范围：

- 基于本地 `AppState` 定义远端数据模型，不直接把整个 JSON blob 当成唯一同步单位。
- 定义云端实体：household / pair、members、wallets、ledger entries、draft papers、letters、postal records、sync cursors。
- 远端模型显式包含 AI 生成字段：`draftSource`、`generationMeta`、prompt version、provider、model、failure reason；不保存完整 prompt、原始 provider response 或敏感日志。
- 为后续邮政异常预留状态和记录类型：`delayed`、`misrouted`、`lost`、`found`、`returned`。
- 为后续照片附件预留访问控制原则：到达前收件方不能获得缩略图、remote key、可访问 URL 或可猜测路径。
- 增加只面向两个人的账户 / 成员绑定概念，先不接真实登录也要把边界留清楚。
- 设计本地与远端的 adapter 接口，App 层依赖同步边界，不让云端 SDK 进入 `src/domain`。
- 设计冲突策略：
  - ledger entries 和 postal records 采用 append-only，按稳定 id 去重。
  - letters 状态采用受状态机约束的单向推进，不能被旧状态覆盖。
  - draft papers 采用 `updatedAtIso` + `deviceId` 的最后写入胜出，远端模型预留删除 tombstone，后续可升级为版本历史。
  - wallet 余额不能简单覆盖，应由 ledger 或明确 settlement snapshot 推导。
- 远端记录预留 `deviceId` / `createdByDeviceId` / `updatedByDeviceId`，避免双设备同毫秒 id 或冲突决胜不稳定。
- 规划照片附件的文件 key、归属关系和上传状态。
- 规划系统推送事件表，但本阶段不真正接推送。

验收标准：

- 本地 schema 可以映射到云端记录，不需要重写领域规则。
- 云端边界不渗入 `src/domain`。
- 有可测试的 sync model / adapter 类型和纯函数合并策略。
- 本地 mock remote adapter 可以在测试里模拟双设备拉取、合并和去重。
- 推送事件保持克制，并符合旧时代通信体验。

非目标：

- 不接真实云服务 SDK。
- 不实现真实登录。
- 不上传文件。
- 不改变现有慢通信产品规则。

### 阶段 16：双人真实同步 MVP

目标：让两台设备在真实云端或本地模拟云端上共享同一对通信关系的数据，并保持慢通信体验。

状态：16A 进行中。已确定先用本地 / 模拟远端完成 App 侧同步闭环，再接真实 CloudBase 数据库 adapter。

设计文档：

- `docs/superpowers/specs/2026-05-24-pinganpi-dual-sync-mvp-design.md`

实施计划：

- `docs/superpowers/plans/2026-05-24-pinganpi-dual-sync-mvp.md`

推荐范围：

- 接入阶段 15 定义的 sync adapter。
- 新增 App 侧同步 runtime、本地同步元数据和浏览器本地 remote adapter。
- 实现启动时 pull、关键操作后 push、回到前台时 refresh。
- 同步成员、钱包、账本、草稿、信件和邮政记录。
- 明确离线状态：第一版只保证离线写草稿和保存草稿；投寄和拆阅必须联网校验后才正式生效。
- UI 增加低调同步状态：未同步、同步中、已同步、同步失败。
- 保证普通信不会因为云端同步变成即时聊天；收信方仍必须等真实到达时间。
- 本地调试使用 device namespace：同一浏览器可通过不同 device 参数模拟两台设备，本地 AppState 分开，remote snapshot 共享。

验收标准：

- 两个本地测试设备或两个浏览器 profile 可以共享同一封信的完整生命周期。
- 同一条 ledger / postal record 重复同步不会重复显示。
- 一端投寄后，另一端只能在到达后拆阅。
- 离线写草稿恢复联网后可以同步，不破坏对方数据。
- 如后续支持离线投寄 / 拆阅请求，必须作为 command 入队，联网后重新校验钱包、状态机、收件人和到达时间，失败时转为待处理或回滚。
- 真实 CloudBase 数据库 adapter 只在 16A 本地闭环稳定后进入 16B，不提前改变 `src/domain` 或投寄 / 拆阅规则。

非目标：

- 不做多人群组。
- 不做现代聊天收发提醒。
- 不做复杂权限后台。

### 阶段 17：邮政异常规则

目标：让信件传递具有旧时代通信的不稳定性，但规则必须确定、可测试、可解释。

推荐范围：

- 基于 `letterId + sentAtIso + routeClass + registered` 生成稳定随机种子。
- 为跨区、边远、挂号等路线定义延误、错分、迷失、找回、退回概率。
- 延误、错分、迷失、找回、退回必须产生 `PostalRecord`。
- 状态推进仍使用 `nextLetterState`，不绕过领域层状态机。
- UI 展示异常状态，但不做现代物流进度条。
- 重要信 / 挂号信的异常后续可作为推送事件来源。

验收标准：

- 同一封信在任意设备、任意重启后得到相同异常结果。
- 重复结算不会重复追加邮政记录。
- 异常状态不会泄露未到达来信正文。
- 所有新增状态都有测试覆盖。

非目标：

- 不引入真实地图或真实物流接口。
- 不做用户可刷新的随机结果。

### 阶段 18：系统推送

目标：为少量重要事件提供系统提醒，同时保持“普通信不主动打扰”的慢通信气质。

推荐范围：

- 定义 push event model：event id、letter id、member id、event type、scheduledAtIso、deliveredAtIso。
- 事件来源：
  - 挂号信到达。
  - 重要信件到达。
  - 迷失信件找回。
  - 退回信件。
- 普通信到达默认不推送，只在用户打开 App / 今日信箱时看到。
- 推送文案保持克制，不展示正文摘要。
- iOS / Android 权限申请延后到用户理解功能之后。
- 本地测试先使用 fake notification adapter，真实推送后接平台能力。

验收标准：

- 推送事件生成可测试且幂等。
- 同一事件不会重复通知。
- 用户未授权通知时 App 功能不受影响。
- 推送文案不泄露未拆信正文。

非目标：

- 不做营销推送。
- 不做即时聊天式消息提醒。

### 阶段 19：照片附件

目标：实现“夹寄照片”的旧信件体验，让照片成为少量珍贵物件，而不是现代相册消息流。

推荐范围：

- 写信流程支持选择是否夹寄一张照片。
- 邮资计算继续复用现有 `hasPhoto` 规则。
- 定义 attachment model：id、letter id、owner member id、local uri、remote key、mime type、upload status、createdAtIso。
- 本地预览、投寄后随信归档。
- 到达前收件方不能看到照片缩略图。
- 云端存储路径与访问控制依赖阶段 15 的文件存储规划；具体云存储购买 / 配置在本阶段实施。
- 失败上传可以重试，不影响信件状态机。

验收标准：

- 夹寄照片会影响费用。
- 到达前不泄露照片。
- 已拆信可在档案中查看照片。
- 附件上传、下载、缺失都有明确状态。

非目标：

- 不做多图相册。
- 不做图片社交编辑、滤镜或评论。

### 阶段 20：发布准备与体验打磨

目标：把可用原型收束为可以长期给两个人使用的移动 App。

推荐范围：

- UI 提示增强：保存、投寄、拆阅、失败改为明显但克制的 toast / snackbar。
- App 图标、启动页、移动端安全区和暗色模式策略。
- iOS / Android 真机安装、冷启动、离线、后台恢复验证。
- Safari Web Inspector / Chrome WebView inspect 最终确认。
- Bundle 拆分、Varlet 按需优化或 manualChunks。
- 数据备份 / 导出策略。
- 隐私检查：本地存储、云端数据、附件访问、日志内容。
- 发布前检查清单：版本号、包名、权限说明、构建命令、回滚策略。

验收标准：

- iOS / Android 真机主流程通过。
- 用户能理解关键反馈，不会错过保存、投寄、拆阅结果。
- 构建 warning 被处理或明确接受并记录。
- 关键数据有备份或恢复策略。

非目标：

- 不做公开上架营销页。
- 不引入多用户运营后台。

### 并行维护项

- 原生调试环境收尾：继续确认 Safari Web Inspector、Chrome WebView inspect 和未来真机安装。
- UI 提示增强：把保存、投寄、失败提示改为更明显的 toast / snackbar。
- Bundle 优化：后续评估 Varlet 按需加载或手动拆包，降低首包提示。
- 模板内容库扩展：增加更多问安、久别、歉意、生日、挂号、夹照等模板，把模板转为 AI 提示词素材、风格样例和约束规则。
- AI 代笔正文生成：已完成 App 侧链路；后续继续走现有写信与代书流程边界，且必须保留用户手工校改。

## 操作备注

- 优先使用浏览器调试：`npm run dev`。
- Web 代码变更后，如需检查原生壳，先执行 `npm run cap:sync`。
- 不要提交生成的 `dist/` 或 Capacitor 复制出的 Web 资源。
- UI 保持移动端优先，同时保证桌面浏览器可用。
- 保持克制的档案 / 账簿视觉方向。
- AI 接入不得绕过写信服务、费用校验、手工校改和真实送达规则。
- 关键节点必须更新本文件、`docs/pinganpi-roadmap-dashboard.html` 和相关设计 / 计划 / AGENTS 文档。关键节点是会影响后续代理判断、用户查看进度、实现边界、验证方式、部署方式或安全隐私边界的变化。
- 关键节点包括阶段状态变化、产品决策变化、技术架构变化、安全与隐私变化、开发流程变化、验证基线变化、用户确认的问题或风险。纯格式化、无行为变化的小重命名、局部测试内部重构通常不算关键节点。
