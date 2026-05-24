# 平安批微信小程序迁移与 CloudBase 多环境设计

> **2026-05-25 工程结构更新：** 本设计中的迁移目标仍有效，但物理路径已按 `docs/project-structure.md` 治理为 `apps/miniprogram/`、`apps/legacy-capacitor/`、`packages/domain/src/`、`services/` 和 `tools/`。后续实施以新路径为准。

## 背景

《平安批》原主线是 iOS / Android Capacitor App：Vue 3、Vite、Tailwind CSS、Varlet、Capacitor 原生壳，加 CloudBase HTTP 云函数承载 AI 起稿和双人同步代理。

用户在 2026-05-24 确认重大方向调整：

- 目标运行环境从 iOS / Android App 改为微信小程序，并以可上架为目标。
- 后端需要区分 `dev` 和 `prd` 环境。
- 本地开发和正式上线都优先走 CloudBase 云函数，不再把本地 proxy 作为主链路。
- 本次变更在独立分支 `codex/wechat-miniprogram-pivot` 推进。
- 技术方案采用微信原生小程序 + TypeScript + CloudBase 云函数多环境。
- 手机号仍是《平安批》的业务账号主键。
- 微信一键获取手机号是默认登录入口，短信验证码登录保留为兜底。

这份设计是迁移主线的新基线。旧 Capacitor 实现不立即删除；小程序核心闭环跑通前，旧实现作为已验证业务规则和体验参考保留。

## 外部约束

CloudBase 官方文档说明：

- CloudBase 环境是应用后端服务基础，每个环境相互隔离，拥有唯一环境 ID，并包含独立数据库、存储空间和云函数配置。
- CloudBase 可创建多个资源环境，用于开发、测试、生产等场景。
- 小程序可通过 `wx.cloud.callFunction` 调用 CloudBase 云函数，云函数侧可通过 `wx-server-sdk` 获取可信的 `OPENID`、`APPID`、`UNIONID`。
- 小程序 AppID 需要关联到 CloudBase 环境，否则 `wx.cloud.init({ env })` 和云函数调用会失败。
- 免费环境存在功能和调用次数限制，正式使用需关注套餐、调用量和告警。

参考：

- https://docs.cloudbase.net/quick-start/create-env
- https://docs.cloudbase.net/recipes/add-cloud-function-wechat-miniprogram
- https://docs.cloudbase.net/cloud-function/how-use

微信小程序的上架、服务类目、隐私保护、手机号能力、审核材料属于外部平台人工配置。实现阶段可以准备代码和清单，但最终开通、确认、提交审核和发布需要用户在微信公众平台 / 微信开发者工具内操作。

## 目标

### 产品目标

- 把《平安批》从安装型移动 App 调整为微信小程序。
- 保留慢通信核心体验：代笔、真实等待、钱匣、账本、信箱 / 档案、未到达前不可拆、到达前不泄露正文。
- 保留 AI 起稿目标：AI 仍只作为代笔先生起稿能力，不绕过用户手工校改、费用校验和封缄投寄。
- 保留双人关系：一个手机号账号同一时间只属于一个有效双人关系。
- 为后续上架准备账号、隐私、审核和人工验证边界。

### 工程目标

- 新增微信原生小程序主线。
- 复用已有 TypeScript 领域规则，不重复实现时间、钱匣、代笔先生、邮资、送达和状态机。
- 后端主线改为 CloudBase 云函数，按 `dev` / `prd` 环境隔离。
- 小程序端不保存或暴露 AI provider key、CloudBase 管理密钥、短信验证码、真实 secret。
- 本地 proxy 降级为诊断工具，不再是日常开发必经链路。
- 文档、roadmap、AGENTS 同步反映新主线。

## 非目标

- 不继续扩展 Capacitor 原生壳。
- 不在迁移第一步删除 `ios/`、`android/`、Vue 页面或旧 Vite 调试能力。
- 不引入 Taro、uni-app 或继续套一层跨端框架。
- 不做公开社交、小程序好友系统、联系人导入、多人关系。
- 不做现代聊天 UI、即时消息流、物流地图或实时在线状态。
- 不在小程序端直连 Xiaomi MiMo 或任何第三方 AI API。
- 不在本设计阶段购买新 CloudBase 资源、提交小程序审核或修改真实线上配置。

## 总体架构

新主线：

```text
微信原生小程序
  -> wx.cloud.callFunction
  -> CloudBase 云函数
  -> CloudBase 数据库 / 后续云存储
  -> Xiaomi MiMo 等第三方 AI 能力
```

旧主线暂存：

```text
Vue / Vite / Tailwind / Varlet / Capacitor
  -> 保留为历史实现、规则验证和调试参考
```

关键决策：

- 小程序页面使用原生 WXML / WXSS / TypeScript。
- 不再把 Tailwind CSS 和 Varlet 作为小程序 UI 主线。
- 领域层保持纯 TypeScript，不能引入小程序、CloudBase、Vue、浏览器或 Capacitor 依赖。
- 小程序端只调用平安批云函数，不直接写核心业务集合，不直连 AI provider。
- 云函数服务层复用 `services/` 中已验证的 AI、同步、账号 / 关系边界，必要时新增小程序 event wrapper。

## 目录结构

目录按以下方向逐步演进：

```text
miniprogram/
  app.ts
  app.json
  app.wxss
  project.config.json
  pages/
    account/
    pair/
    today/
    write/
    scribes/
    wallet/
    mailbox/
    archive/
  components/
  services/
  adapters/
  styles/

shared/
  domain/
  app-core/

services/
  ai-scribe-proxy/
  sync-proxy/
  account-pair/
  miniprogram-functions/

tools/
  scripts/
  roadmap-viewer/

cloudbase/
  functions/
```

迁移策略：

- 当前真实领域实现位于 `packages/domain/src/`；小程序使用 `apps/miniprogram/shared/domain/` 生成副本，避免微信小程序跨根打包。
- `apps/legacy-capacitor/src/app/` 里的 Vue view-model、页面状态、Varlet 交互不作为小程序复用对象，只作为行为参考。
- `cloudbase/functions/` 继续作为构建产物目录并保持 Git 忽略。

## 小程序页面结构

第一批小程序页面与现有体验对齐：

- `account`：账号簿，默认微信一键手机号登录，短信验证码兜底。
- `pair`：创建一对关系、展示邀请码、输入邀请码加入。
- `today`：今日，显示旧历时间、钱匣摘要、来信提示、待处理事项。
- `write`：分步写信流程：选写法、口述、起稿、校改、投寄。
- `scribes`：代笔先生，当日出勤、城市、风格、代书费。
- `wallet`：钱匣和账本。
- `mailbox`：今日信箱、路上信札。
- `archive`：旧信匣和邮政档案。

底部导航保留“今日 / 写信 / 先生 / 钱匣 / 信箱”的移动端结构。小程序页面不做营销首页。

视觉方向继续保持克制档案风格，但实现方式从 Tailwind / Varlet 改为 WXSS 和本地组件。组件优先服务阅读效率和移动端可操作性，不引入花哨动效。

## 账号与登录

账号原则：

- 手机号仍是《平安批》的业务账号主键。
- 微信身份是小程序环境下的登录会话辅助和可信平台身份来源。
- 一个手机号对应一个 `PinganpiAccount`。
- 微信 `openid` / `unionid` 与业务账号建立映射，但不替代手机号。

默认登录流程：

1. 小程序启动，初始化 `wx.cloud` 到当前环境。
2. 用户点击微信一键登录。
3. 小程序通过微信手机号授权能力拿到一次性手机号凭证。
4. 小程序调用账号云函数。
5. 云函数从微信 / CloudBase 上下文获取可信 `OPENID`、`APPID`、`UNIONID`。
6. 云函数校验手机号授权结果，并得到完整手机号。
7. 服务端按手机号创建或恢复 `PinganpiAccount`。
8. 服务端建立或更新微信身份映射。
9. 小程序进入双人关系流程或已绑定主界面。

短信兜底流程：

- 当微信手机号授权失败、用户拒绝授权、权限尚未开通、审核配置未完成或平台临时不可用时，显示短信验证码入口。
- 短信验证码仍走服务端可信边界，验证码不写入仓库、日志、AI metadata 或信件数据。
- 短信登录成功后同样按手机号恢复 `PinganpiAccount`。

账号模型：

```ts
interface PinganpiAccount {
  accountId: string;
  phoneNumber: string;
  status: "active" | "disabled";
  createdAtIso: string;
  lastLoginAtIso: string;
}

interface PinganpiWechatIdentity {
  identityId: string;
  appId: string;
  openid: string;
  unionid: string | null;
  accountId: string;
  phoneNumber: string;
  linkedAtIso: string;
  lastSeenAtIso: string;
}
```

隐私边界：

- 手机号可以完整保存到账号档案，这是已确认产品决策。
- 手机号不写入信件、邮政记录、AI metadata、同步日志或无关控制台日志。
- `openid` / `unionid` 不写入信件、邮政记录或 AI metadata。

## 双人绑定

阶段 18 的产品规则继续有效：

- 一个手机号账号同一时间只允许属于一个有效双人关系。
- 第一版不做自助解除关系；绑错由开发者人工处理。
- 邀请码 24 小时有效，只能使用一次。
- 另一方手机号登录后输入邀请码即加入，不需要创建方二次确认。
- 不做独立设备授权、设备 token 签发、设备 token 轮换或设备撤销。

小程序迁移后，同步授权以云函数可信身份为准：

1. 云函数从微信 / CloudBase 上下文确认当前账号。
2. 服务端查询 `PinganpiAccount`。
3. 服务端查询该账号唯一 active member。
4. 服务端推导 `householdId` 和 `memberId`。
5. 客户端传入的 `householdId` / `memberId` 只能做一致性校验，不能作为授权依据。

## CloudBase 多环境

环境目标：

- `dev`：本地开发、微信开发者工具、真机预览、测试数据。
- `prd`：审核、发布、真实数据。

环境隔离：

- 两套 CloudBase 环境 ID。
- 两套数据库集合。
- 两套云函数部署。
- 两套 AI secret。
- 两套同步快照。
- 两套账号 / 关系数据。
- 两套审计和 smoke 记录。

当前环境 `pinganpi-d7gml1f6sbcc172ea` 不直接假定为 `prd`。迁移实施默认先把现有环境作为 `dev` 使用，等用户创建或确认线上环境后再配置 `prd`。

配置策略：

- 小程序构建或运行配置只保存环境别名和环境 ID，不保存 secret。
- `dev` 与 `prd` 环境 ID 可写入本地配置模板；真实 `project.private.config.json`、本机 CLI 登录态、真实 key 继续 Git 忽略。
- 云函数内部使用 `cloud.DYNAMIC_CURRENT_ENV` 或等价策略，避免代码里硬编码环境。
- 部署脚本必须显式要求环境参数，避免误把开发函数部署到生产。

## 云函数边界

小程序主线使用 `wx.cloud.callFunction`，优先新增事件式云函数入口：

- `pinganpi-account`：微信手机号登录、短信兜底登录、账号恢复。
- `pinganpi-pair`：创建关系、生成邀请码、加入关系。
- `pinganpi-sync`：pull / push 同步、状态推进、redaction。
- `pinganpi-ai`：AI 起稿、失败关闭、费用护栏。

现有 HTTP 代理处理器继续复用核心逻辑：

- `services/ai-scribe-proxy/handler.ts`
- `services/sync-proxy/handler.ts`
- `services/account-pair/account-pair-service.ts`

迁移时新增小程序 event wrapper，而不是复制一套业务校验。HTTP 入口可保留用于命令行 smoke、诊断和历史浏览器调试，但不再是小程序日常开发主链路。

## AI 起稿

AI 起稿仍只属于“代笔先生起稿”：

- 输入来自用户口述、代笔先生、寄件人 / 收件人、城市、信件类型和必要上下文。
- 输出是代笔初稿，用户必须手工校改后才能投寄。
- 投寄仍经过钱匣余额、代书费、邮资、封缄和真实等待校验。
- AI key 只存放在 CloudBase 云函数环境变量，不进入小程序端。
- 云函数失败时返回受控错误，不回传 provider 原始响应。

流式体验迁移策略：

- 小程序迁移 MVP 先确保 AI 起稿可用和失败关闭正确。
- 现有受控 SSE 流式能力保留在服务端核心实现中。
- 小程序端是否能继续原样流式输出，需要单独验证微信小程序请求分片能力、CloudBase 函数响应方式和 MiMo 流式接口稳定性。
- 如果小程序流式链路不稳定，首版小程序允许使用非流式 AI 起稿，同时保留“先生正在起稿”的明确等待反馈。
- 小程序流式恢复作为迁移后的专项优化阶段，不阻塞小程序核心闭环。

## 同步与数据

现有远端模型和 redaction 原则继续有效：

- 远端实体使用 `remoteId` 避免跨设备本地 id 冲突。
- 未到达来信正文、摘要、口述、AI metadata 不向收件方泄露。
- 对方私有草稿过滤。
- 照片附件到达前过滤。
- 投寄和拆阅必须联网通过服务端校验。
- 离线第一版只保证草稿可写，投寄 / 拆阅不做离线命令队列。

小程序本地存储只保存必要的本地缓存、草稿状态和同步 cursor。长期可信数据以 CloudBase dev / prd 环境为准。

## 上架与人工配置

迁移后需要新增一个外部平台阶段，统一处理微信小程序上架事项：

- 微信小程序 AppID。
- 主体认证与服务类目。
- 小程序隐私保护指引。
- 手机号能力开通与合规说明。
- CloudBase 环境与小程序 AppID 关联。
- `dev` / `prd` 两套环境创建、命名和权限确认。
- AI 第三方模型调用告知。
- 提交审核、审核反馈处理、发布。

这些事项需要用户登录微信公众平台、微信开发者工具、腾讯云控制台或 Xiaomi MiMo 控制台确认。Codex 可以准备清单、脚本、文案草案和验证步骤，但不能替用户完成控制台确认、购买或审核提交。

## 本地开发方式

新的日常开发方式：

1. 用微信开发者工具打开 `miniprogram/`。
2. 选择 `dev` CloudBase 环境。
3. 小程序页面直接调用 `dev` 云函数。
4. 本地代码测试仍使用 Vitest 验证共享领域规则和服务端 handler。
5. 云函数改动通过 CLI 部署到 `dev` 后再真机预览。
6. `prd` 只用于审核和线上发布，不作为日常调试环境。

本地 proxy：

- `ai-proxy:dev` 可保留为 MiMo 诊断工具。
- `sync-proxy` HTTP dev server 可保留为 handler 诊断工具。
- 新功能不得依赖本地 proxy 才能完成小程序主流程。

## 后续阶段重排建议

重大迁移插入为新的主线阶段，并把原阶段 21-24 顺延。后续阶段重排为：

| 阶段 | 名称 | 目标 |
| --- | --- | --- |
| 21 | 微信小程序迁移设计与重基线 | 本设计、roadmap、AGENTS 和实施计划。 |
| 22 | 小程序工程基座 | `miniprogram/`、TypeScript、页面骨架、开发者工具配置、dev 环境配置。 |
| 23 | 共享领域核心迁移 | 抽取或适配可复用领域规则，让小程序复用规则而不是重写。 |
| 24 | 小程序本地核心界面 | 今日、写信、先生、钱匣、信箱 / 档案的本地 mock 闭环。 |
| 25 | 小程序 CloudBase dev 主链路 | 账号、绑定、同步、AI 云函数 event wrapper 与 dev 环境 smoke。 |
| 26 | 小程序登录与双人关系真实闭环 | 微信一键手机号、短信兜底、账号恢复、邀请码加入。 |
| 27 | 小程序 AI 与同步体验补齐 | AI 起稿、失败关闭、同步状态、必要时恢复流式专项。 |
| 28 | 微信小程序上架配置 | AppID、隐私、手机号能力、prd 环境、审核发布人工清单。 |
| 29 | 小程序完整人工验证 | 双手机号、双端、写信、送达、拆阅、断网、清空数据、prd smoke。 |
| 30 | 邮政异常规则 | 原阶段 21 顺延。 |
| 31 | 系统推送 | 原阶段 22 顺延；小程序内可能改为订阅消息策略。 |
| 32 | 照片附件 | 原阶段 23 顺延。 |
| 33 | 发布准备与体验打磨 | 原阶段 24 顺延。 |

## 子 agent 执行策略

用户已授权 Codex 作为总控推进迁移，并把可并行任务交给子 agent。

执行原则：

- 总控负责架构决策、任务拆分、冲突整合、最终验证和提交。
- 子 agent 只处理边界清晰的任务。
- 同一时间只开启必要数量的子 agent，任务结束后关闭。
- 实现类子 agent 必须分配不重叠的文件或模块所有权。
- 审阅类子 agent 只读，不修改文件。
- 不让多个子 agent 同时编辑 roadmap、AGENTS、package.json 或共享核心配置。
- 子 agent 不得提交真实 secret、手机号验证码、AI key 或控制台原始 env。

适合委派：

- 小程序页面骨架。
- 共享领域核心迁移评估。
- 云函数 event wrapper。
- 文档审阅。
- 独立测试补齐。

不适合委派：

- 用户确认、购买、上架审核提交。
- 涉及多个核心边界的一次性重构。
- secret、真实手机号、真实生产环境操作。

## 验收标准

设计阶段验收：

- 本设计文档落盘并通过自审。
- `docs/pinganpi-roadmap.md`、`tools/roadmap-viewer/src/roadmap-data.json`、`AGENTS.md` 同步反映小程序主线。
- 写出实施计划后才能开始实现。

工程迁移验收：

- 小程序能在微信开发者工具中打开。
- 小程序首屏进入账号 / 绑定 / 今日流程。
- 核心页面移动端优先，PC 开发工具可用。
- 小程序复用现有领域规则，不重复实现邮政、钱匣和时间逻辑。
- `dev` 云函数可完成账号、绑定、同步、AI 起稿 smoke。
- `prd` 部署步骤明确且需要显式环境参数。
- `npm test`、TypeScript 检查和相关构建 / 云函数构建通过。
- roadmap 和 AGENTS 记录最新验证基线。

人工验收：

- 用户在微信公众平台 / 微信开发者工具确认 AppID、手机号能力、隐私、服务类目、CloudBase 关联和审核发布事项。
- 两个真实手机号能完成一键登录或短信兜底。
- 两人能创建 / 加入关系，完成一封信从起稿、投寄、等待、到达、拆阅到归档。

## 风险与处理

- **CloudBase 免费环境限制**：dev / prd 双环境可能需要新增或升级环境。实现阶段不擅自购买，只给出清单。
- **微信手机号能力限制**：一键手机号可能需要平台能力和审核配置；短信验证码保留兜底。
- **流式 AI 待验证**：小程序端是否稳定支持现有 SSE 体验需单独验证；不阻塞小程序 MVP。
- **小程序上架合规**：隐私、手机号、AI 第三方处理、服务类目可能影响审核；单独阶段处理。
- **共享领域构建兼容**：小程序 TypeScript / 模块解析可能与 Vite 不同；先保守抽纯逻辑，避免大规模重构。
- **旧实现与新实现并存**：短期会增加仓库复杂度；小程序闭环后再决定删除或归档旧 Capacitor 主线。
- **生产误操作**：所有 prd 部署脚本必须显式传入环境，默认不部署生产。

## 决策记录

- 采用微信原生小程序，不采用 Taro / uni-app。
- 采用 CloudBase 云函数多环境，不购买独立 CVM 作为第一选择。
- 本地开发也优先走 `dev` 云函数，不再依赖本地 proxy。
- 手机号仍是业务账号主键。
- 微信一键手机号登录为默认入口，短信验证码登录兜底。
- 旧 Capacitor 实现暂存，不立即删除。
- 小程序迁移优先恢复核心慢通信闭环，邮政异常、推送、照片附件继续后移。
