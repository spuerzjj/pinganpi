# 平安批开发路线图

> **供后续代理使用：** 本文件记录《平安批》从 Capacitor 移动 App 主线转向微信原生小程序主线后的当前状态。后续开始实现前，应先阅读本文件确认方向、边界和验收标准。

**日常可视化入口：** `npm run roadmap:dev` 启动独立 Roadmap Viewer。数据源为 `docs/roadmap-data.json`。

**旧静态看板：** `docs/pinganpi-roadmap-dashboard.html` 仍保留为静态快照，不再作为日常主入口。

**当前分支：** `codex/wechat-miniprogram-pivot`

**当前开发基线：** 阶段 1-19 的 Capacitor / Vue App 工程能力已形成完整业务参考：领域层、写信流程、AI 起稿、流式起稿、CloudBase AI 代理、同步模型、CloudBase 同步代理、手机号账号本地闭环、双人绑定本地 / 服务端边界和外部平台配置收口均已完成对应验证。2026-05-24 用户确认重大方向调整：目标运行环境从 iOS / Android App 改为微信小程序并需要上架；新主线采用微信原生小程序 + TypeScript + CloudBase 云函数 `dev` / `prd` 多环境；手机号仍是《平安批》业务账号主键；微信一键获取手机号为默认登录入口，短信验证码保留兜底；本地开发和线上都优先走 CloudBase 云函数，本地 proxy 降级为诊断工具。阶段 21 已完成迁移设计与重基线；阶段 22 已完成小程序工程基座；阶段 23 已完成共享领域核心迁移；阶段 24 已完成小程序本地核心界面；阶段 25 已完成小程序 CloudBase dev 主链路；阶段 26 已完成小程序登录与双人关系工程闭环：账号页接入微信手机号 code 登录和受控兜底入口，关系页接入创建关系、生成邀请码、输入邀请码加入，小程序本地会话只缓存账号 / 绑定摘要，服务端账号和关系云函数改为从可信微信 / CloudBase 上下文推导账号身份，不再信任客户端传入的 `authUid`、`phoneNumber` 或 `accountId`。下一步进入阶段 27：小程序 AI 与同步体验补齐。迁移设计文档为 `docs/superpowers/specs/2026-05-24-pinganpi-wechat-miniprogram-migration-design.md`，阶段 22 实施计划为 `docs/superpowers/plans/2026-05-24-pinganpi-miniprogram-foundation.md`，阶段 23 实施计划为 `docs/superpowers/plans/2026-05-24-pinganpi-shared-domain-core.md`，阶段 24 实施计划为 `docs/superpowers/plans/2026-05-24-pinganpi-miniprogram-local-ui.md`，阶段 25 实施计划为 `docs/superpowers/plans/2026-05-24-pinganpi-miniprogram-cloudbase-dev.md`，阶段 26 实施计划为 `docs/superpowers/plans/2026-05-24-pinganpi-miniprogram-login-pair.md`。精确提交以 `git log --oneline --decorate -5` 为准。

**工作区策略：** 日常开发直接在 `/Users/zhujunjie/code/pinganpi` 进行。除非用户明确要求隔离开发，否则不要创建或使用 `.worktrees/`。

---

## 当前进展

### 阶段 1：领域层基础

状态：已完成。

实现位置：`shared/domain/`；`src/domain/` 保留兼容 re-export，旧 App 和旧测试入口仍可继续使用。

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

原主线阶段按“本地体验稳定 → AI 接入设计 → 本地 AI 代理 → AI 正文生成 → 云端 AI 配置 → AI 体验优化 → 同步模型 → 双人真实可用 → 账号恢复 → 双人绑定 → 人工收口 → 完整验证 → 异常与附件 → 发布质量”推进。阶段 1-19 已为业务规则、AI、同步、账号和绑定提供可复用基础。

新主线从阶段 21 开始改为“微信小程序迁移设计 → 小程序工程基座 → 共享领域核心 → 小程序核心界面 → CloudBase dev 主链路 → 登录绑定真实闭环 → AI 与同步补齐 → 小程序上架配置 → 小程序完整人工验证 → 邮政异常 / 推送 / 附件 / 发布打磨”。

**本期目标：** 阶段 26 已完成小程序登录与双人关系工程闭环。下一步进入阶段 27：补齐小程序 AI 起稿、失败关闭、同步状态和必要流式专项。旧 Capacitor / Vue 实现暂存为历史参考，不再作为主开发目标。

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
| 13 | 云端 AI 代理与费用配置 | 工程完成 | CloudBase HTTP 云函数、云端 secret、`/api` 路由、云端 AI 起稿、浏览器烟测、禁用 key 安全失败、恢复验证和 `/*` 路由清理已完成；控制台人工项移入阶段 19。 |
| 14 | AI 起稿流式体验优化 | 已完成工程实现 | 本地 / 云端受控 SSE、App 流式 adapter、写信页 partial 预览、完成前不可投寄、云端流式烟测已通过；GUI 浏览器操作验证待权限补测。 |
| 15 | 云端同步准备 | 已完成基础 | 已新增远端模型、sync adapter、快照转换/合并和本地 mock remote adapter；不接真实云 SDK。 |
| 16 | 双人真实同步 MVP | 已完成云端 smoke | 本地 / 模拟远端同步闭环、CloudBase HTTP 同步代理、数据库集合、显式 HTTP 路由、env 配置和云端 pull / push smoke 已完成。 |
| 17 | 手机号账号系统 | 已完成工程闭环 | 本地手机号登录 mock、稳定 `PinganpiAccount`、登录态恢复、账号入口页和手机号展示已完成；真实 CloudBase Auth / SMS 放入阶段 19。 |
| 18 | 双人绑定与同步授权 | 已完成工程闭环 | 本地创建关系、24 小时一次性邀请码、输入即加入、唯一 active household、App 同步命名空间接入、服务端关系约束和 sync-proxy 账号授权边界已完成。 |
| 19 | 外部平台人工配置收口 | 已收口 | CloudBase Auth HTTP API、账号 / 关系集合命名、短信真实可达、短信资源包、免费体验版费用边界、预算暂缓、默认角色接受、MiMo 暂缓和 HTTP 路由 smoke 已确认。 |
| 20 | 旧 App 完整人工验证引导 | 暂存 | 已新增原 iOS / Android App 完整人工验证计划；小程序迁移后不作为当前主线执行。 |
| 21 | 微信小程序迁移设计与重基线 | 已完成 | 新增小程序迁移设计，更新 roadmap / dashboard / AGENTS，并提交阶段 22 实施计划。 |
| 22 | 小程序工程基座 | 已完成基础 | 已新增 `miniprogram/`、TypeScript 检查、页面骨架、微信开发者工具配置和 `dev` CloudBase 环境入口。 |
| 23 | 共享领域核心迁移 | 已完成基础 | 已新增 `shared/domain/` 作为领域规则真实实现，`src/domain/` 保留兼容 re-export，小程序根内副本和一致性检查已建立，今日页已使用共享领域摘要。 |
| 24 | 小程序本地核心界面 | 已完成基础 | 今日、写信、先生、钱匣、信箱 / 档案已接入本地 mock view-model；写信页已有本地 5 步流程，tab 切换保留进度，口述变更会重新起稿。 |
| 25 | 小程序 CloudBase dev 主链路 | 已完成 dev smoke | 已新增并部署账号、绑定、同步、AI event 云函数入口，小程序 cloud function adapter，构建 / 部署 / smoke 脚本；dev health smoke 已通过。 |
| 26 | 小程序登录与双人关系真实闭环 | 已完成工程闭环 | 账号页接入微信手机号 code 登录和受控兜底入口；关系页接入创建关系、邀请码和加入；服务端可信推导账号，不信任客户端身份字段。 |
| 27 | 小程序 AI 与同步体验补齐 | 未开始 | AI 起稿、失败关闭、同步状态，必要时恢复流式专项。 |
| 28 | 微信小程序上架配置 | 未开始 | AppID、隐私、手机号能力、`prd` 环境、审核发布人工清单。 |
| 29 | 小程序完整人工验证 | 未开始 | 双手机号、双端、写信、送达、拆阅、断网、清空数据、`prd` smoke。 |
| 30 | 邮政异常规则 | 未开始 | 延误、错分、迷失、找回、退回的确定性推进。 |
| 31 | 系统推送 / 订阅消息 | 未开始 | 重要信、挂号信、找回、退回等克制提醒；小程序内优先评估订阅消息。 |
| 32 | 照片附件 | 未开始 | 夹寄照片、费用、存储、展示和隐私边界。 |
| 33 | 发布准备与体验打磨 | 未开始 | toast、图标、启动页、真机、bundle、发布检查。 |

### 阶段依赖

- 阶段 10 是阶段 11 和阶段 12 的前置条件：先明确 AI 起稿边界、提示词素材、失败处理和隐私策略，再实现本地代理与 App 侧 AI adapter。
- 阶段 11 已提供阶段 12 开发期所需的本地代理边界；阶段 12 已接入 App 侧 AI adapter，不阻塞于云端购买和部署。
- 阶段 13 是生产级 AI 能力的工程前置条件：真实 MiMo env、服务端 secret、云函数 / CloudBase 落点、回滚删除步骤和云端 AI 起稿验证已完成；费用告警和控制台人工确认移入阶段 19。
- 阶段 14 是体验优化阶段：本地 / 云端流式代理和 App partial 预览已实现；它不改变写信、投寄、等待和拆阅规则。
- 阶段 15 是阶段 16 的前置条件：远端模型、同步协议和本地 mock remote 验证已完成基础；阶段 16A 已完成 App 侧同步 runtime 和本地双设备闭环，阶段 16B 已完成 CloudBase HTTP 同步代理工程实现与真实云端 smoke；小程序迁移后的真实双设备人工验证放到阶段 29。
- 阶段 17 是账号恢复阶段：工程闭环已完成本地手机号 mock 登录、稳定 `PinganpiAccount`、登录态恢复和账号入口页；真实 CloudBase Auth / SMS 配置留到阶段 19。
- 阶段 18 是双人绑定与同步授权阶段：工程闭环已完成创建 household / pair、24 小时一次性邀请码、输入即加入、唯一 active household、服务端关系约束和 `sync-proxy` 账号成员授权边界；第一版不做独立设备授权、设备 token 轮换或设备撤销。
- 阶段 19 统一处理所有需要用户介入的外部平台配置和真实环境人工收口，包括把阶段 17 / 18 的本地 / 内存 adapter 接到 CloudBase Auth、短信验证码和真实数据库。
- 阶段 20 依赖阶段 17 / 18 工程实现和阶段 19 外部配置，原本用于旧 iOS / Android App 完整人工验证；小程序迁移后暂存为历史验证资料。
- 阶段 21 是微信小程序迁移重基线，必须先完成设计、roadmap、dashboard、AGENTS 和实施计划，再进入代码迁移。
- 阶段 22 依赖阶段 21，建立微信原生小程序工程基座，不继续扩展 Capacitor 壳层。
- 阶段 23 依赖阶段 22，已抽取共享领域核心，确保小程序不重复实现时间、钱匣、邮政和状态机规则。
- 阶段 24 依赖阶段 23，先用本地 mock 跑通小程序核心界面。
- 阶段 25 依赖阶段 24，并把账号、绑定、同步、AI 接到 CloudBase `dev` 云函数 event wrapper。
- 阶段 26 依赖阶段 25，已完成小程序账号 / 关系工程闭环；微信手机号能力真机弹窗、短信真实验证码、AppID 关联和 prd 验证顺延到阶段 28 / 29。
- 阶段 27 依赖阶段 25 / 26，补齐小程序 AI 起稿、失败关闭、同步状态和必要的流式专项验证。
- 阶段 28 依赖阶段 22-27 的可演示小程序，统一处理 AppID、隐私、手机号能力、`prd` 环境和审核发布人工清单。
- 阶段 29 依赖阶段 28，由 Codex 引导用户做小程序完整人工验证。
- 阶段 30-33 是原阶段 21-24 顺延，分别处理邮政异常、推送 / 订阅消息、照片附件和发布准备。

## 验证基线

微信开发者工具自动化新增验证记录：

- 控制台已确认历史阻断错误为 `app.json: 未找到 ["pages"][0] 对应的 pages/account/index.js 文件`；根因是微信开发者工具未启用 TypeScript 编译插件，导致页面 `.ts` 入口被按 `.js` 查找。
- `miniprogram/project.config.json` 已显式配置 `setting.useCompilerPlugins: ["typescript"]`；本机 `miniprogram/project.private.config.json` 也需保持同项配置，避免私有配置覆盖后复现该错误。
- 重新打开并编译项目后，开发者工具 Console 不再出现 app.json 阻断错误；剩余为 WeChatLib、LazyCodeLoading 和 HarmonyOS `getSystemInfo` 兼容提示。
- `WECHAT_DEVTOOLS_PORT=62046 npm run miniprogram:devtools:smoke`：通过；自动打开账号页，输入无效手机号 `123`，点击 `使用兜底入口`，断言错误文案为 `请填写 11 位中国大陆手机号。`。
- `WECHAT_DEVTOOLS_PORT=62046 npm run miniprogram:devtools:flow`：通过；覆盖账号、关系、今日、写信、代笔先生、钱匣、信箱和档案；写信场景停在投寄核算页，不点击本地投寄。
- 自动化安全边界：不点击上传、发布、真机预览、真实微信手机号授权或审核提交；只做低风险页面巡检和本地输入校验。

Roadmap Viewer 新增验证记录：

- `npm test -- roadmap-viewer/src/roadmap.test.ts`：通过，1 个测试通过。
- `npm run roadmap:build`：通过，独立 Vue viewer 可完成类型检查和 Vite 构建。
- `npm run roadmap:dev -- --port 5190`：通过，浏览器验证 `http://localhost:5190/` 能显示 `平安批 Roadmap`、阶段 27 和 `389 tests`；`/docs/pinganpi-roadmap.md` 文档链接返回 200。

最近阶段 26 小程序登录与双人关系工程闭环新增验证记录：

- `npm test -- server/miniprogram-functions/miniprogram-auth.test.ts server/miniprogram-functions/pinganpi-account.test.ts server/miniprogram-functions/pinganpi-pair.test.ts miniprogram/services/account-session.test.ts miniprogram/services/account-cloud.test.ts`：通过，5 个测试文件，23 个测试通过。
- `npm run cloudbase:build:miniprogram`：通过，生成 `pinganpi-ai`、`pinganpi-sync`、`pinganpi-account`、`pinganpi-pair` 四个 event 云函数包；生成目录仍由 `.gitignore` 排除。
- `CLOUDBASE_ENV_ID=pinganpi-d7gml1f6sbcc172ea npm run cloudbase:deploy:miniprogram`：阶段 26 账号 / 关系可信身份改造后通过，四个 event 云函数均部署成功。
- `CLOUDBASE_ENV_ID=pinganpi-d7gml1f6sbcc172ea npm run cloudbase:smoke:miniprogram`：阶段 26 账号 / 关系可信身份改造后通过，四个 event 云函数 health invoke 均通过；AI 起稿 smoke 默认跳过，未产生 provider 调用。
- `npm run miniprogram:check`：通过；包含共享副本一致性检查和小程序 typecheck。
- `npm test`：通过，58 个测试文件，389 个测试通过。
- `npm run typecheck`：通过。
- `git diff --check`：通过。

阶段 24 小程序本地核心界面验证记录：

- `npm test -- miniprogram/services/local-model.test.ts`：通过，4 个测试通过；覆盖今日、先生、钱匣、信箱 / 档案 view-model。
- `npm test -- miniprogram/services/write-flow.test.ts`：通过，6 个测试通过；覆盖本地写信费用、起稿、校改、挂号、投寄存根和口述变更后旧稿失效。
- `npm run miniprogram:check`：通过；包含共享副本一致性检查和小程序 typecheck。
- `npm test`：通过，46 个测试文件，343 个测试通过。
- `npm run typecheck`：通过。
- `git diff --check`：通过。

阶段 23 共享领域核心迁移验证记录：

- `npm test -- src/domain`：通过，5 个测试文件，85 个测试通过；旧领域测试通过 `src/domain` re-export 验证共享核心行为未变。
- `npm run miniprogram:check-shared`：通过；动态扫描 `shared/domain/*.ts` 并确认 `miniprogram/shared/domain/` 与其一致，避免小程序跨根 import 和副本陈旧。
- `npm test -- miniprogram/services/domain-summary.test.ts`：通过，1 个测试通过；确认小程序可通过根内副本使用共享规则。
- `npm test -- scripts/sync-miniprogram-shared-domain.test.ts`：通过，4 个测试通过；覆盖同步、缺失 / 变更检测、多余文件检测和新增源文件检测。
- `npm run miniprogram:check`：通过；包含共享副本一致性检查和小程序 typecheck。
- `npm test`：通过，44 个测试文件，333 个测试通过。
- `npm run typecheck`：通过。
- `git diff --check`：通过。

阶段 22 小程序工程基座验证记录：

- `npm test -- miniprogram/config/env.test.ts`：通过，1 个测试文件，3 个测试通过；确认当前小程序默认使用 `dev` CloudBase 环境 `pinganpi-d7gml1f6sbcc172ea`，`prd` 仍为空等待用户创建。
- `npm test -- miniprogram/project-config.test.ts`：覆盖微信开发者工具 TypeScript 编译插件配置，避免页面 `.ts` 入口被按 `.js` 查找。
- `npm run miniprogram:typecheck`：通过，小程序 TypeScript 入口、环境配置和页面骨架可检查。
- `npm test`：42 个测试文件，328 个测试通过。
- `npm run typecheck`：通过。
- `git diff --check`：通过。

阶段 17 / 18 账号与双人绑定工程闭环验证记录：

- 新增聚焦验证：`src/app/account/local-account-adapter.test.ts`、`src/app/account/local-pair-binding-adapter.test.ts`、`src/app/account/account-sync-config.test.ts`、`server/account-pair/account-pair-service.test.ts`、`server/sync-proxy/handler.test.ts`、`server/sync-proxy/cloudbase-entry.test.ts` 覆盖本地手机号登录、登录态恢复、创建关系、24 小时一次性邀请码、输入即加入、账号驱动同步配置、服务端账号 / 关系约束、sync-proxy 账号成员授权和 CloudBase runtime env。
- `git diff --check`：通过。
- `npm test`：40 个测试文件，320 个测试通过。
- `/Users/zhujunjie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vue-tsc/bin/vue-tsc.js --noEmit`：通过。
- `/Users/zhujunjie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vite/bin/vite.js build`：通过，保留 Varlet / 首包超过 500 KB 的既有提示。
- `/Users/zhujunjie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --import tsx scripts/build-cloudbase-sync-proxy.ts`：通过，生成的 `cloudbase/functions/sync-proxy/` 已被 Git 忽略。
- `/Users/zhujunjie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/@capacitor/cli/bin/capacitor sync`：通过，已同步 iOS / Android Web assets。
- `/Users/zhujunjie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/@capacitor/cli/bin/capacitor doctor`：通过，iOS / Android Capacitor 依赖正常。
- `npm audit --omit=dev`：通过，0 vulnerabilities。为避免 `@cloudbase/node-sdk` 传递引入存在原型污染公告的 `lodash.set` / `lodash.unset` 小包，已通过 `vendor/lodash-set` 和 `vendor/lodash-unset` 提供兼容 shim，内部调用已修复的主 `lodash` 子模块。
- `rg -n "(tp|sk)-[A-Za-z0-9]{8,}|stage16-smoke-token-not-sensitive" src server scripts vendor docs AGENTS.md .env.example package.json --glob '!**/*.test.ts'`：无真实 key 命中。
- 浏览器烟测：`npm run dev` 启动到 `http://localhost:5174/`；账号簿出现；手机号 `13800138000` 本地验证码登录成功；创建关系并生成 24 小时邀请码；点击进入后主界面显示今日页、账号手机号和同步状态。

阶段 16B CloudBase 同步代理云端 smoke 收口基线：

- `CLOUDBASE_ENV_ID=pinganpi-d7gml1f6sbcc172ea npm run cloudbase:deploy:sync`：通过，函数 `sync-proxy` 已部署。
- `CLOUDBASE_ENV_ID=pinganpi-d7gml1f6sbcc172ea npm run cloudbase:configure:sync-env`：通过，已写入 `PINGANPI_SYNC_SNAPSHOT_COLLECTION` 和 base64 形式 `PINGANPI_SYNC_MEMBER_TOKENS_B64`，避免 CloudBase CLI 把 JSON env 误解析为对象。
- CloudBase NoSQL 集合 `pinganpi_sync_snapshots` 已创建。
- CloudBase HTTP 路由：`/sync/health`、`/sync/pull`、`/sync/push` 指向 `sync-proxy`；曾尝试 `/api/sync/*` 和 `/sync/*`，前者会被既有 `/api` AI 路由优先匹配，后者在默认域名下对子路径返回 `INVALID_PATH`，因此最终采用三条显式路由。
- `npm run cloudbase:smoke:sync`：通过，`household=stage16-smoke`、`member=member-zhou`、`initialRevision=0`、`acceptedRevision=1`、`finalRevision=1`；覆盖 health、未带 token 401 fail closed、合法 pull、push、再 pull。

既有阶段 13 / 14 云端基线如下，本次阶段 17 / 18 未重跑这些云端 AI 命令：

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

- `npm run build` 会提示 Varlet 相关首包超过 500 KB。这是旧 App 优化项，不是小程序迁移阻塞项。

## 尚未完成

项目目前还没有完成：

- 小程序今日、写信、先生、钱匣、信箱 / 档案页面目前只有骨架，尚未接入真实业务状态。
- 小程序 CloudBase `dev` 主链路尚未接通；现有 HTTP proxy 需要降级为诊断工具。
- 微信一键手机号登录、短信兜底、真实账号恢复和小程序双人绑定尚未实现。
- CloudBase `prd` 环境、微信小程序 AppID、隐私保护指引、手机号能力和审核发布仍需用户人工配置。
- 小程序端 AI 起稿先做非流式闭环；流式能力需单独验证微信小程序和 CloudBase 响应能力。
- 小程序完整人工验证尚未开始。
- 延误、错分、迷失、找回、退回的自动确定性推进规则尚未接入。
- 系统推送 / 小程序订阅消息尚未设计实现。
- 照片附件：夹寄、费用、存储、展示和隐私控制尚未实现。
- 更丰富的模板内容库和场景覆盖仍需补充。

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

状态：工程完成，控制台人工事项已移入阶段 19。本机 MiMo 连通、本地代理起稿、本地费用护栏、可复用 handler 边界、CloudBase HTTP 云函数、云端 secret、`/api` 路由、云端 AI 起稿接口、浏览器写信页云端 AI 烟测、禁用 key 安全失败验证、恢复验证和历史 `/*` 路由清理已跑通。

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
- 云函数公开面检查已完成：HTTP 函数 `ai-scribe-proxy` 状态 Available，运行时 `Nodejs20.19`，触发器数量为 0，VPC 未配置，env 仅包含 AI 代理变量；默认角色为 `TCB_QcsRole`。更细粒度角色能力确认移入阶段 19。

后续人工收口已移入阶段 19：

- 配置 Xiaomi MiMo 费用告警、额度上限和余额提醒。
- 配置 CloudBase 函数调用量、出网流量、错误率和费用告警。
- 检查 CloudBase 控制台是否可把默认 `TCB_QcsRole` 收敛为更细粒度角色。
- 记录 MiMo 控制台撤销 / 轮换 key 的实际入口。
- 后续如重建云端 AI 代理，仍根据 `docs/superpowers/plans/2026-05-23-pinganpi-cloud-ai-proxy.md` 执行云端代理配置。

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

状态：已完成基础。阶段设计与实施计划已建立，`src/app/sync/` 纯 TypeScript 同步边界和本地 mock remote adapter 已完成；真实 CloudBase HTTP 同步代理已在阶段 16B 完成工程实现。

设计文档：

- `docs/superpowers/specs/2026-05-24-pinganpi-cloud-sync-design.md`

实施计划：

- `docs/superpowers/plans/2026-05-24-pinganpi-cloud-sync-foundation.md`

已实现：

- 新增 `src/app/sync/remote-model.ts`，定义 `RemoteHousehold`、`RemoteMember`、`RemoteWallet`、`RemoteLedgerEntry`、`RemoteDraftPaper`、`RemoteLetter`、`RemotePostalRecord`、`RemoteSyncCursor`、`RemotePhotoAttachment`、`RemoteSnapshot` 和 `SyncAdapter`。
- 新增 `src/app/sync/remote-snapshot.ts`，支持从 `AppState` 导出远端拆分实体，并把远端快照合并回本地状态。
- 新增 `mergeRemoteSnapshots`，供 mock remote adapter 合并远端实体，不把远端存储降级成单一 `AppState` blob。
- 新增 `src/app/sync/mock-remote-adapter.ts`，用本地内存模拟 household 远端快照、revision 和 device cursor。
- 新增测试覆盖：AI metadata 安全字段、白名单转换、append-only 去重、跨设备同 id 不丢数据、未到达来信正文 redaction、信件状态单向推进、草稿冲突、草稿 tombstone、对方私有草稿过滤、双设备 push / pull / opened 合并和深拷贝隔离。

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

状态：已完成云端 smoke。已用本地 / 模拟远端完成 App 侧同步闭环，CloudBase HTTP 同步代理已部署，数据库集合和显式 HTTP 路由已配置，云端 pull / push smoke 已通过；迁移到小程序后，真实双设备人工验证顺延到阶段 29。

设计文档：

- `docs/superpowers/specs/2026-05-24-pinganpi-dual-sync-mvp-design.md`
- `docs/superpowers/specs/2026-05-24-pinganpi-cloudbase-sync-design.md`

实施计划：

- `docs/superpowers/plans/2026-05-24-pinganpi-dual-sync-mvp.md`
- `docs/superpowers/plans/2026-05-24-pinganpi-cloudbase-sync-adapter.md`

推荐范围：

- 接入阶段 15 定义的 sync adapter。
- 新增 App 侧同步 runtime、本地同步元数据和浏览器本地 remote adapter。
- 实现启动时 pull、关键操作后 push、回到前台时 refresh。
- 同步成员、钱包、账本、草稿、信件和邮政记录。
- 明确离线状态：第一版只保证离线写草稿和保存草稿；投寄和拆阅必须联网校验后才正式生效。
- UI 增加低调同步状态：未同步、同步中、已同步、同步失败。
- 保证普通信不会因为云端同步变成即时聊天；收信方仍必须等真实到达时间。
- 本地调试使用 device namespace：同一浏览器可通过不同 device 参数模拟两台设备，本地 AppState 分开，remote snapshot 共享。

已实现：

- 新增 `src/app/sync/sync-state.ts` 和 `src/app/sync/sync-state-storage.ts`，保存 household、device、member、revision、同步状态和短错误。
- 新增 `src/app/sync/sync-runtime.ts`，实现 pull、push、syncNow、prepareOnlineMutation；失败不透出原始异常，push 后会按当前成员 redaction 并把可见远端快照合回本地。
- 新增 `src/app/sync/local-remote-adapter.ts`，用 localStorage 模拟 household 远端快照，拒绝 stale push，污染快照会回退为空快照，push / pull 都返回深拷贝。
- 新增 `src/app/sync/browser-sync-config.ts`，支持 `household` / `device` / `member` URL 参数，按 household + member + device 隔离本地 AppState / SyncState，remote snapshot 仅按 household 共享。
- `src/App.vue` 已接入同步状态 UI、启动同步、进入前台 refresh、信箱 refresh、保存 / 删除草稿后后台 push、投寄 / 拆阅前联网校验和成功后 push。
- 后台同步结果有串行队列和本地 state revision 检查，避免旧同步结果覆盖较新的本地草稿、tombstone、投寄扣款或拆阅记录。
- 新增 `src/app/sync/dual-device-sync.test.ts`，验证 A 投寄、B 到达前拿不到正文、到达后拆阅并补回正文、A 同步看到 opened、账本 / 邮政记录不重复、B 私有草稿不导入 A。
- 新增 `src/app/sync/http-remote-adapter.ts`，通过 `POST /sync/pull` 和 `POST /sync/push` 实现 HTTP 版 `SyncAdapter`，会把 409 `stale_remote_revision` 映射为 runtime 可识别的冲突错误，并拒绝 malformed revision response。
- 新增 `src/app/sync/remote-adapter-factory.ts`、`VITE_PINGANPI_SYNC_PROXY_URL` 和 `VITE_PINGANPI_SYNC_MEMBER_TOKEN` 配置。未配置同步代理地址时继续使用本地 localStorage adapter；配置后才启用 HTTP 同步代理，配置成员 token 时由客户端发送 `X-Pinganpi-Sync-Token`。
- 新增 `server/sync-proxy/handler.ts`，实现 `GET /health`、`POST /sync/pull`、`POST /sync/push`，复用 `mergeRemoteSnapshots` 和 redaction；服务端用 `PINGANPI_SYNC_MEMBER_TOKENS` 将 `householdId + memberId` 绑定到 token，缺失配置时同步请求 fail closed。
- `sync-proxy` 同时支持 `/sync/health` 用于 CloudBase 显式路由健康检查。
- `sync-proxy` 返回给客户端的 snapshot 会过滤对方私有草稿，未到达来信不含正文、摘要、口述、代笔稿或 AI metadata，并清空 `photoAttachments`，避免阶段 23 前后附件定位信息提前泄露。
- 新增 `server/sync-proxy/cloudbase-store.ts`，使用 `@cloudbase/node-sdk` 数据库写入 household snapshot，保存集合默认为 `pinganpi_sync_snapshots`，写入前按 expected revision 做 CAS / 事务边界校验；真实 SDK 写入形态为 `doc.set(data)` / `transaction.collection(name).doc(id).set(data)`，写入数据不包含 `_id` 字段。
- 新增 `server/sync-proxy/cloudbase-entry.ts`、`cloudbase-http-server.ts`、`cloudbase-bootstrap.ts` 和 `scripts/build-cloudbase-sync-proxy.ts`；`cloudbaserc.json` 已增加 HTTP 函数 `sync-proxy`，`package.json` 已增加 `cloudbase:build:sync` / `cloudbase:configure:sync-env` / `cloudbase:smoke:sync` / `cloudbase:deploy:sync`。
- 云端 env 使用 `PINGANPI_SYNC_MEMBER_TOKENS_B64` 保存 member token map，运行时仍兼容本地开发用的明文 JSON `PINGANPI_SYNC_MEMBER_TOKENS`。
- CloudBase 部署使用显式路由 `/sync/health`、`/sync/pull`、`/sync/push`；客户端 HTTP adapter 的云端 base URL 应配置为 `https://pinganpi-d7gml1f6sbcc172ea-1258361524.ap-shanghai.app.tcloudbase.com`，不要配置到 `/api`。

验收标准：

- 两个本地测试设备或两个浏览器 profile 可以共享同一封信的完整生命周期。
- 同一条 ledger / postal record 重复同步不会重复显示。
- 一端投寄后，另一端只能在到达后拆阅。
- 离线写草稿恢复联网后可以同步，不破坏对方数据。
- 如后续支持离线投寄 / 拆阅请求，必须作为 command 入队，联网后重新校验钱包、状态机、收件人和到达时间，失败时转为待处理或回滚。
- 真实 CloudBase 同步代理工程实现不改变 `src/domain` 或投寄 / 拆阅规则；费用告警、默认角色收敛已在阶段 19 收口，小程序迁移后的双真机人工验证顺延到阶段 29。

非目标：

- 不做多人群组。
- 不做现代聊天收发提醒。
- 不做复杂权限后台。

### 阶段 17：手机号账号系统

目标：让用户卸载重装或换机后，可以通过手机号验证码登录找回同一个平安批账号身份。

状态：已完成工程闭环。账号系统从“双人绑定与同步授权”中单独拆出，先完成本地可测的稳定身份、登录态恢复和 App 账号入口；真实 CloudBase Auth / SMS 接入放入阶段 19。

设计文档：

- `docs/superpowers/specs/2026-05-24-pinganpi-phone-account-design.md`

推荐范围：

- 已新增 `src/app/account/account-model.ts`，定义 `PinganpiAccount`、`PinganpiSession`、household、member、invite 和 adapter 边界。
- 已新增 `src/app/account/local-account-adapter.ts`，提供本地手机号 mock 登录、验证码调试码、稳定 accountId、登录态恢复和登出。
- 已新增 `src/app/pages/AccountGatePage.vue`，未登录时先进入账号簿，手机号只在账号入口 / 账号摘要展示。
- 已新增 `server/account-pair/account-pair-service.ts`，服务端按受信任 `authUid` 确保同一 `PinganpiAccount`，后续 CloudBase Auth 接入时复用此边界。
- 真实 CloudBase 手机号验证码登录、token / refresh token 已在旧 App 阶段 19 收口到平台配置；小程序迁移后的账号恢复验证顺延到阶段 26 / 29。

验收标准：

- 本地首次手机号登录会创建平安批账号档案。
- 本地恢复会话后，同一手机号仍对应同一 `accountId`。
- 未登录时 App 不进入写信主流程。
- 账号档案包含完整手机号，但不写入信件、邮政记录或 AI metadata。
- 服务端账号 service 按受信任 `authUid` 保证同一业务账号，并更新 `lastLoginAtIso`。

非目标：

- 不做 household / pair 创建。
- 不做邀请另一方。
- 不做设备授权、设备撤销或 token 轮换。
- 不做昵称头像、好友系统或公开社交账号功能。

### 阶段 18：双人绑定与同步授权

目标：在阶段 17 的账号身份基础上，建立只属于两个人的一对通信关系，并让同步代理按登录账号所属关系授权访问。

状态：已完成工程闭环。阶段 18 只处理双人关系和同步授权，不与手机号账号登录混在同一阶段，也不做独立设备授权；真实 CloudBase Auth / DB 持久化配置留到阶段 19。

设计文档：

- `docs/superpowers/specs/2026-05-24-pinganpi-pair-binding-design.md`

推荐范围：

- 已新增 `src/app/account/local-pair-binding-adapter.ts`，支持本地创建 household、生成 24 小时一次性邀请码、输入即加入、唯一 active household、自邀 / 过期 / 已用 / 满员拒绝。
- 已新增 `src/app/account/account-sync-config.ts`，已有账号绑定时用绑定的 household / member 驱动现有浏览器同步命名空间；无绑定时保留阶段 16 URL 参数调试。
- `src/App.vue` 已接入账号 / 绑定入口。已有绑定后进入主 App；创建或加入关系后刷新一次，让同步 runtime 以正确 household / member 启动。
- `server/account-pair/account-pair-service.ts` 已实现服务端关系约束纯逻辑。
- `server/sync-proxy/handler.ts` 已支持账号成员授权配置：服务端可从可信 auth uid 映射出 `householdId/memberId`，并覆盖客户端传入值；手工 member token 仅保留为阶段 16B 开发 fallback。
- `server/sync-proxy/runtime-auth.ts` 已支持 `PINGANPI_SYNC_ACCOUNT_BINDINGS` / `PINGANPI_SYNC_ACCOUNT_BINDINGS_B64` 和 `PINGANPI_SYNC_TRUSTED_AUTH_UID_HEADER`。

验收标准：

- A 创建一对关系后，可以邀请 B 加入。
- B 输入邀请码立即加入第二个成员席位，不需要 A 二次确认。
- A / B 都不能创建或加入第二个 active household。
- 24 小时过期或已使用的邀请码不能加入。
- 第三个账号不能加入已满员 household。
- 客户端篡改 `memberId` 或 `householdId` 不能冒充另一方；账号授权模式以服务端映射结果为准。
- 手工 member token 仍存在，但仅作为阶段 16B / 本地开发 fallback；真实 CloudBase 登录态接入在阶段 19 收口。

非目标：

- 不做多人关系。
- 不做社交好友系统。
- 不做独立设备授权、设备 token 签发、设备 token 轮换或设备撤销。
- 不做自助解除关系或换绑。
- 不改变写信、投寄、等待、拆阅和钱匣规则。

### 阶段 19：外部平台人工配置收口

目标：把所有需要用户登录控制台、输入验证码、确认费用或操作真实设备前置配置的事项统一处理，避免打断阶段 17 / 18 的工程开发。

状态：已收口。已新增阶段 19 执行计划和脱敏 CloudBase 审计脚本；已记录当前 CloudBase 用量、函数状态、公开面、默认角色和 env key 存在情况。用户已在 CloudBase 控制台开启手机号短信登录，且两个真实手机号验证码均已实际收到。CloudBase 短信资源包已购买，短信签名入口未找到，控制台未看到发送限制和费用说明；发送限制和费用策略暂以官方资料基线为准。当前 CloudBase 套餐 / 版本为腾讯云开发免费体验版；官方价格文档显示免费体验环境提供 `3000 点/月`，单次可续费 6 个月，不支持自动续费。用户确认当前不启用 CloudBase 按量付费，仅使用套餐内资源点；预算管理本阶段暂缓，后续升级套餐、转付费、开启按量或新增腾讯云资源时必须重新配置。官方文档说明普通单环境账号可直接使用默认 `TCB_QcsRole`，本项目是单 CloudBase 环境，本阶段接受默认角色。MiMo 额度、费用提醒、key 撤销 / 轮换入口不阻塞开发，已暂缓到正式发布、扩大使用范围、怀疑 key 泄露、接入新模型或发生异常费用前复查。App 侧手机号登录接入方式已确定为 CloudBase Auth v2 HTTP API，账号 / 关系集合命名已定稿，HTTP 路由 smoke、CLI 路由查询、集合权限查询和角色列表查询已通过。

执行计划：

- `docs/superpowers/plans/2026-05-24-pinganpi-external-platform-closure.md`

已完成自动项：

- 新增 `scripts/audit-cloudbase-stage19.ts` 和 `npm run cloudbase:audit:stage19`，用于脱敏审计 CloudBase 用量和函数状态。
- 当前计费周期 `2026-05-23 ~ 2026-06-23`，CloudBase 用量为 `1.67 / 3000 credits`。
- 用户确认当前 CloudBase 套餐 / 版本为腾讯云开发免费体验版；官方价格文档显示免费体验环境提供 `3000 点/月`，单次可续费 6 个月，不支持自动续费；这不替代预算 / 余额提醒，仍需确认是否可配置费用告警。
- 官方价格文档还说明免费环境可购买 Token 点资源包，暂不支持加购扩展资源包、大促资源包和开启按量付费；当前阶段不升级付费套餐、不购买 CVM、不启用自动续费。
- 用户确认当前策略是不启用 CloudBase 按量付费，仅使用套餐内资源点；若后续资源不够再升级套餐。因此阶段 19 不把预算管理作为阻塞项；后续只要升级套餐、转付费、开启按量付费或新增腾讯云资源，必须重新配置预算 / 费用提醒检查。
- `ai-scribe-proxy` 和 `sync-proxy` 均为 `Active / Available`，运行时均为 `Nodejs20.19`，HTTP 类型，PublicNet `ENABLE`，触发器 `0`，VPC 未配置。
- 两个函数当前角色均为 `TCB_QcsRole`；官方文档说明普通单环境账号可直接使用默认角色，本项目当前是单 CloudBase 环境，本阶段接受默认角色。若后续变成多环境 / 多租户 / 商业化管理后台，必须复查并考虑每环境独立 CAM 角色。
- `ai-scribe-proxy` 的 `MIMO_API_KEY` 存在但审计输出已脱敏；后续不要直接用会打印完整 env 的 CLI 输出。
- CloudBase Auth 手机号短信登录已由用户在控制台开启；本环境为 `ap-shanghai`，符合短信登录地域要求。
- Auth 发送验证码应使用 CloudBase HTTP API 统一域名 `https://pinganpi-d7gml1f6sbcc172ea.api.tcloudbasegateway.com/auth/v1/verification`；已对两个真实手机号各触发一次发送请求，均返回 HTTP 200 和 `verification_id`，用户已确认两台手机均收到验证码。
- CloudBase 控制台确认：手机号短信登录仍为已开启；短信资源包已购买；短信签名入口未找到；控制台未看到发送限制和费用说明。
- 短信发送限制和费用基线已记录：新开通按量计费环境首月 100 条免费额度；超出免费额度可购买资源包；同一号码 30 秒最多 1 条，同一手机号一个自然日最多 10 条。
- App 第一版手机号登录采用 CloudBase Auth v2 HTTP API，不引入 CloudBase JS SDK：发送验证码 `/auth/v1/verification`，验证验证码 `/auth/v1/verification/verify`，登录 `/auth/v1/signin`，刷新 `/auth/v1/token`。
- 账号 / 关系集合名确定为 `pinganpi_accounts`、`pinganpi_households`、`pinganpi_members`、`pinganpi_invites`；账号 / 关系写入必须走服务端可信身份边界，客户端不得直接写授权结果。
- 2026-05-24 HTTP 路由 smoke：`/api/health` 和 `/sync/health` 返回 200；`/sync/pull` 与 `/sync/push` 在未带 token 时返回 401，公网路由和 fail-closed 行为可达。
- 2026-05-24 CLI 路由查询：`/api` 指向 `ai-scribe-proxy`；`/sync/health`、`/sync/pull`、`/sync/push` 指向 `sync-proxy`；四条路由均启用，类型均为 `WEB_SCF`。
- 2026-05-24 CLI 权限查询：`pinganpi_sync_snapshots`、`pinganpi_accounts`、`pinganpi_households`、`pinganpi_members`、`pinganpi_invites` 均为 `PRIVATE`；函数 invoke 权限为自定义规则，但 HTTP 访问服务路由 `enableAuth=false`，所以代理 handler 的应用层校验仍是必须边界。
- 2026-05-24 CLI 角色查询：当前只有系统角色，自定义角色 0 个；函数运行角色仍显示为 `TCB_QcsRole`。结合官方文档和当前单环境场景，本阶段不创建自定义角色。
- 腾讯云预算建议保留为后续升级付费时使用：先建月度费用预算，费用范围选全部范围，推荐 `10 元/月`，阈值提醒使用 `80%` 和 `100%`；当前免费体验版不启用按量付费，本阶段暂缓预算管理。
- MiMo 额度、费用提醒、key 撤销 / 轮换入口已暂缓；当前已有字符 / token 护栏和 `cloudbase:disable:ai-env` 停用方案。正式发布、扩大使用范围、怀疑 key 泄露、接入新模型或发生异常费用前必须复查。
- 阶段 19 计划已新增剩余人工回报模板；用户按模板回报后再把对应人工项标记为完成、暂缓或不可配置。

推荐范围：

- CloudBase 身份认证：开启手机号验证码登录，确认短信签名、短信模板、发送限制和费用。
- CloudBase 数据库：确认账号、关系、邀请、同步 snapshot 等集合权限。
- CloudBase HTTP 路由：确认 AI 代理和同步代理路由可访问。
- CloudBase 费用：配置或记录费用告警、月费用上限、人工检查频率。
- CloudBase 默认角色：当前单环境场景接受 `TCB_QcsRole`；多环境 / 多租户 / 商业化管理后台前复查。
- Xiaomi MiMo：额度、费用提醒、key 撤销 / 轮换入口暂缓；正式发布或异常费用前复查。
- 真实环境变量：确认云端 env 已配置且不打印真实 secret。
- 真实手机号：由用户输入验证码完成至少两个账号登录准备。

验收标准：

- 控制台待办清单逐项标记完成、暂缓或不可配置。
- 手机号验证码登录可在真实环境触发。
- AI 代理和 sync-proxy 的公开路由、权限和费用风险已记录。
- 需要用户保管或后续复查的事项写入 roadmap。

非目标：

- 不在本阶段新增业务功能。
- 不把控制台 secret、验证码或真实 key 写入仓库。

### 阶段 20：旧 App 完整人工验证引导

目标：原计划由 Codex 引导用户对 Capacitor iOS / Android App 做端到端人工验证，覆盖云端账号、双人绑定、同步、AI、写信、送达、拆阅和原生真机流程。

状态：暂存。迁移到微信小程序后，本阶段不作为当前主线执行，但计划可作为业务验收 checklist 参考。

执行计划：

- `docs/superpowers/plans/2026-05-24-pinganpi-full-manual-verification.md`

### 阶段 21：微信小程序迁移设计与重基线

目标：把项目主线从 Capacitor iOS / Android App 切换为微信原生小程序，并明确 CloudBase `dev` / `prd` 多环境、微信一键手机号登录、短信兜底、本地 proxy 降级和上架边界。

状态：进行中。

设计文档：

- `docs/superpowers/specs/2026-05-24-pinganpi-wechat-miniprogram-migration-design.md`

实施计划：

- `docs/superpowers/plans/2026-05-24-pinganpi-miniprogram-foundation.md`

已确认决策：

- 采用微信原生小程序 + TypeScript + CloudBase 云函数多环境。
- 手机号仍是《平安批》业务账号主键。
- 微信一键获取手机号为默认登录入口，短信验证码保留兜底。
- 本地开发和上线都优先走 CloudBase 云函数；本地 proxy 只保留为诊断工具。
- 旧 Capacitor / Vue 实现暂存，不立即删除。
- Codex 作为总控推进，子 agent 只处理边界清晰的并行任务，完成后关闭。

验收标准：

- 迁移设计文档已提交。
- roadmap、dashboard、AGENTS 已同步新主线。
- 写出实施计划后再进入小程序工程实现。

### 阶段 22：小程序工程基座

目标：建立微信原生小程序工程基础，让项目能在微信开发者工具中打开并运行首屏。

推荐范围：

- 新增 `miniprogram/` 目录、`app.json`、`app.ts`、`app.wxss`、`project.config.json` 模板。
- 建立 TypeScript 编译 / 类型检查方式。
- 建立小程序页面骨架和底部导航。
- 建立 `dev` CloudBase 环境配置入口，但不提交 secret。
- 明确微信开发者工具打开路径和本地调试步骤。
- 微信开发者工具必须启用 TypeScript 编译插件：`miniprogram/project.config.json` 的 `setting.useCompilerPlugins` 包含 `typescript`。本机 `miniprogram/project.private.config.json` 被 Git 忽略，但若其中有 `setting` 覆盖项，也要保持同样配置。

### 阶段 23：共享领域核心迁移

目标：让小程序复用现有领域规则，不重复实现时间、钱匣、代笔先生、邮资、送达和状态机。

状态：已完成基础。

已完成：

- 新增 `shared/domain/`，承载时间、旧币制、代笔先生、钱匣、邮政和信件状态机规则真实实现。
- `src/domain/` 改为兼容 re-export，旧 App 和旧测试入口保持可用。
- 新增 `miniprogram/shared/domain/` 根内副本，避免微信小程序预览 / 上传跨出 `miniprogramRoot`。
- 新增 `npm run miniprogram:sync-shared` 和 `npm run miniprogram:check-shared`，动态扫描 `shared/domain/*.ts`，保证小程序副本与 `shared/domain/` 一致。
- `tsconfig.json` 已纳入 `shared/**/*.ts`；`tsconfig.miniprogram.json` 只检查小程序根内源码。
- 新增 `miniprogram/services/domain-summary.ts` 和测试，今日页已通过根内副本使用共享旧历日期和邮资摘要。

### 阶段 24：小程序本地核心界面

目标：用小程序页面重建首批核心界面，并先支持本地 mock 数据。

实施计划：`docs/superpowers/plans/2026-05-24-pinganpi-miniprogram-local-ui.md`

状态：已完成基础。

已完成：

- 新增 `miniprogram/services/local-model.ts` 和测试，提供今日、先生、钱匣、信箱、档案的本地 mock view-model。
- 今日、代笔先生、钱匣、信箱、档案页面已从占位内容改为读取本地模型。
- 新增 `miniprogram/services/write-flow.ts` 和测试，提供本地 5 步写信流程、费用计算、挂号切换和投寄存根。
- 写信页已支持口述、先生起稿、校改、投寄核算和本地投寄回执。
- 写信 tab 切换不会重建本地 flow；口述变更会清空旧起稿 / 定稿，避免用旧正文投寄。
- 本阶段仍不接 CloudBase、真实登录、真实同步或 AI 起稿。

### 阶段 25：小程序 CloudBase dev 主链路

目标：让小程序通过 `wx.cloud.callFunction` 调用 `dev` 云函数，跑通账号、绑定、同步和 AI 的工程通道。

状态：已完成 dev smoke。

- 已新增小程序 event wrapper：`pinganpi-account`、`pinganpi-pair`、`pinganpi-sync`、`pinganpi-ai`。
- `pinganpi-ai` 复用既有 AI proxy handler；health 不依赖 MiMo env，非流式 `scribeDraft` 使用受控返回。
- `pinganpi-sync` 复用既有 sync handler、redaction 和 CloudBase snapshot store；阶段 25 event runtime 使用 dev-only payload namespace，不读取旧 HTTP header token auth，同步侧微信可信身份推导顺延到阶段 27。
- `pinganpi-account` / `pinganpi-pair` 复用 `account-pair-service`，新增账号关系 CloudBase store，集合名为 `pinganpi_accounts`、`pinganpi_households`、`pinganpi_members`、`pinganpi_invites`；创建邀请码响应不向客户端返回 `codeHash`。
- 已新增小程序端 `miniprogram/services/cloud-functions.ts`，封装 `wx.cloud.callFunction`；本阶段尚未接入页面。
- 已新增 `npm run cloudbase:build:miniprogram`、`npm run cloudbase:deploy:miniprogram`、`npm run cloudbase:smoke:miniprogram`。
- HTTP 入口保留为诊断工具，不作为小程序主链路。
- `prd` 环境仍未创建 / 配置 / 部署。

### 阶段 26：小程序登录与双人关系真实闭环

目标：完成微信一键手机号登录、短信兜底、账号恢复、创建关系和邀请码加入。

状态：已完成工程闭环；真实微信手机号能力和短信验证码人工验证顺延到阶段 29。

已完成：

- 新增阶段 26 实施计划：`docs/superpowers/plans/2026-05-24-pinganpi-miniprogram-login-pair.md`。
- 新增 `server/miniprogram-functions/miniprogram-auth.ts`，从 CloudBase / 微信可信上下文读取 `openid` / `unionid` 并生成稳定 `authUid`。
- `pinganpi-account` 新增 `loginByWechatPhone`、受控 `loginByDevPhone`、`getCurrentAccount` 和可信 `getActiveBinding`；手机号只来自服务端微信手机号 resolver 或显式 dev guard，不信任客户端伪造字段。
- `pinganpi-pair` 的 `createHousehold`、`createInvite`、`joinByInvite` 和 `getActiveBinding` 均从当前可信账号推导，不再接收客户端 `accountId` 作为授权依据。
- 新增 `miniprogram/services/account-session.ts` 和 `account-cloud.ts`，小程序只缓存账号 / 绑定摘要，不保存验证码、token、secret 或邀请码 hash。
- 账号页接入微信手机号按钮、兜底入口、登录态恢复和登录后路由；关系页接入创建关系、生成邀请码、输入邀请码加入和本地会话刷新。

仍需人工验证：

- 微信小程序 AppID 关联 CloudBase 环境后，`open-type="getPhoneNumber"` 是否能在开发者工具 / 真机返回 `code`。
- 当前主体、服务类目和手机号能力是否满足微信平台要求。
- 短信验证码兜底的真实发送、频控和模板 / 签名表现。
- 两个真实手机号完成 A 创建邀请、B 输入加入、清空本地数据后恢复账号。

### 阶段 27：小程序 AI 与同步体验补齐

目标：补齐小程序中的 AI 起稿、失败关闭、同步状态和必要流式专项。

推荐范围：

- AI 起稿先保证非流式可用。
- 评估小程序端流式输出可行性；不可行时保留非流式 + 明确等待反馈。
- 同步状态展示 dev / prd 环境、最近同步、失败原因。
- 投寄和拆阅继续要求联网校验。

### 阶段 28：微信小程序上架配置

目标：统一处理微信小程序 AppID、隐私、手机号能力、`prd` 环境和审核发布人工事项。

需要用户介入：

- 微信小程序 AppID、主体认证、服务类目。
- 小程序隐私保护指引和用户协议确认。
- 手机号能力开通。
- CloudBase `prd` 环境创建 / 绑定 / 套餐确认。
- 提交审核、审核反馈处理和发布确认。

### 阶段 29：小程序完整人工验证

目标：由 Codex 引导用户验证小程序真实链路。

推荐范围：

- 两个真实手机号完成微信一键登录或短信兜底。
- A 创建关系，B 输入邀请码加入。
- 双端同步、AI 起稿、写信投寄、真实等待、到达拆阅、归档。
- 断网、重启、清空本地数据、重新登录恢复。
- `prd` smoke、体验版、审核前检查。

### 阶段 30：邮政异常规则

目标：让信件传递具有旧时代通信的不稳定性，但规则必须确定、可测试、可解释。

推荐范围：

- 基于 `letterId + sentAtIso + routeClass + registered` 生成稳定随机种子。
- 为跨区、边远、挂号等路线定义延误、错分、迷失、找回、退回概率。
- 延误、错分、迷失、找回、退回必须产生 `PostalRecord`。
- 状态推进仍使用 `nextLetterState`，不绕过领域层状态机。

### 阶段 31：系统推送 / 订阅消息

目标：为少量重要事件提供克制提醒。小程序内优先评估订阅消息，普通信仍默认不主动打扰。

### 阶段 32：照片附件

目标：实现“夹寄照片”的旧信件体验，让照片成为少量珍贵物件，而不是现代相册消息流。

### 阶段 33：发布准备与体验打磨

目标：把可用小程序收束为可以长期给两个人使用、可审核发布的微信小程序。

推荐范围：

- UI 提示增强：保存、投寄、拆阅、失败改为明显但克制的 toast / snackbar。
- 小程序图标、启动配置、移动端安全区。
- 数据备份 / 导出策略。
- 隐私检查：本地存储、云端数据、附件访问、日志内容。
- 发布前检查清单：版本号、权限说明、构建命令、回滚策略。

### 并行维护项

- 原生调试环境收尾：继续确认 Safari Web Inspector、Chrome WebView inspect 和未来真机安装。
- UI 提示增强：把保存、投寄、失败提示改为更明显的 toast / snackbar。
- 旧 App Bundle 优化：后续若继续维护旧 App，再评估 Varlet 按需加载或手动拆包，降低首包提示。
- 模板内容库扩展：增加更多问安、久别、歉意、生日、挂号、夹照等模板，把模板转为 AI 提示词素材、风格样例和约束规则。
- AI 代笔正文生成：已完成 App 侧链路；后续继续走现有写信与代书流程边界，且必须保留用户手工校改。

## 操作备注

- 新主线优先使用微信开发者工具调试 `miniprogram/`，并连接 CloudBase `dev` 环境。
- 微信开发者工具自动化命令为 `WECHAT_DEVTOOLS_PORT=<port> npm run miniprogram:devtools:smoke` 和 `WECHAT_DEVTOOLS_PORT=<port> npm run miniprogram:devtools:flow`；服务端口需先在 `设置 -> 安全设置` 开启。当前本机验证端口为 `62046`。
- 若控制台报 `app.json: 未找到 ["pages"][0] 对应的 ...index.js 文件`，先检查 `project.config.json` / 本机 `project.private.config.json` 是否启用 `setting.useCompilerPlugins: ["typescript"]`，然后关闭并重新打开项目。
- 旧浏览器调试 `npm run dev`、`cap:sync`、`cap doctor` 只用于历史 Capacitor / Vue 实现诊断，不再作为新功能主链路。
- 不要提交生成的 `dist/`、`cloudbase/functions/`、微信开发者工具私有配置或任何真实 secret。
- 小程序 UI 保持移动端优先，同时保证微信开发者工具和 PC 预览可用。
- 保持克制的档案 / 账簿视觉方向。
- AI 接入不得绕过写信服务、费用校验、手工校改和真实送达规则。
- CloudBase `prd` 部署必须显式传入环境参数，不允许脚本默认部署生产。
- 关键节点必须更新本文件、`docs/pinganpi-roadmap-dashboard.html` 和相关设计 / 计划 / AGENTS 文档。关键节点是会影响后续代理判断、用户查看进度、实现边界、验证方式、部署方式或安全隐私边界的变化。
- 关键节点包括阶段状态变化、产品决策变化、技术架构变化、安全与隐私变化、开发流程变化、验证基线变化、用户确认的问题或风险。纯格式化、无行为变化的小重命名、局部测试内部重构通常不算关键节点。
