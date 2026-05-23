# 平安批开发路线图

> **供后续代理使用：** 本文件记录《平安批》在领域层、Capacitor 移动壳层和原生调试阶段之后的当前状态。后续开始实现前，应先阅读本文件确认方向、边界和验收标准。

**当前分支：** `main`

**当前开发基线：** 已完成阶段 5 第一版本地写信投寄流程。精确提交以 `git log --oneline --decorate -5` 为准。

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

## 验证基线

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

- 真机验证。
- iOS Safari Web Inspector 的 WebView console 手工确认。
- 草稿列表、草稿继续编辑和草稿删除。
- 完整可替换的模板代书引擎。
- 照片附件流程。
- 基于持久化时间戳的真实等待和送达推进。
- 延误、迷失、找回、退回状态在 App UI 中的完整呈现。
- 云端同步。
- 系统推送。
- 两人账户绑定。
- 生产级 App 图标和启动页。
- Bundle 拆分与 Varlet 按需优化。

## 后续推荐阶段

### 阶段 3：原生调试环境收尾

目标：确认当前 Capacitor 壳层在 iOS 和 Android 的完整调试链路可用。

当前状态：Android 模拟器和 iOS Simulator 都已验证可以启动 App。本阶段只剩 WebView inspector 最终确认，以及未来真机验证。

剩余任务：

- 在 iOS 上通过 Safari Web Inspector 确认 WebView console 可查看。
- 在 Android 上通过 Chrome `chrome://inspect/#devices` 确认 WebView console 可查看。
- 后续有真机时，分别进行 iOS / Android 真机安装与启动验证。
- 继续保持浏览器优先调试：`npm run dev`。
- 每次进行打包式原生检查前，先执行 `npm run cap:sync`。

验收标准：

- App 能在至少一个 iOS Simulator 打开。
- App 能在至少一个 Android Emulator 打开。
- 两个平台的 WebView console 都可以检查。
- 必要的本机环境步骤都记录在文档中。

### 阶段 4：本地持久化层

目标：把当前静态 mock-only 状态替换为可持久保存的本地 App 状态，同时暂不依赖云端。

当前状态：本地存储基础已完成。后续写信主流程接入时，需要把页面上的“存作草稿”“封缄投寄”连接到 `draftPapers`、`letters`、`postalRecords` 和 `ledgerEntries`。

推荐范围：

- 定义本地 App state schema：
  - members
  - wallet
  - ledger entries
  - draft papers
  - letters
  - postal records
- 增加 storage adapter 边界，方便后续云同步替换或扩展。
- 第一版使用浏览器兼容的本地存储方案，便于本地开发。
- 所有领域计算继续保留在 `src/domain`。
- 增加测试覆盖加载、保存、默认迁移和坏数据恢复。

验收标准：

- 刷新 App 后不会丢失草稿或钱匣状态。
- 本地存储数据损坏时，App 能安全回退，不崩溃。
- 测试覆盖默认状态和一个已保存信件生命周期。

### 阶段 5：写信主流程

目标：把当前写信页面变成第一版真实可用的本地流程。

推荐流程：

- 选择当天在场的代笔先生，或选择亲笔。
- 输入口述内容。
- 通过模板生成先生初稿。
- 允许手工校改正文。
- 计算代书费、邮资、挂号费；照片费后续再接。
- 校验钱匣余额。
- 阻止透支，不允许赊账。
- 封缄投寄。
- 扣除钱匣费用。
- 增加账本记录。
- 生成信件副本 / 存根。
- 生成邮政记录。

验收标准：

- 用户可以从口述内容完成一封本地信件投寄。
- 余额不足时阻止投寄，并保留草稿。
- 已投寄信件不能继续编辑。
- 账本和档案能反映本次投寄。

### 阶段 6：模板代书引擎

目标：实现第一版非 AI 的代书生成能力。

推荐范围：

- 增加可替换的 template engine 边界，为后续 AI 接入预留位置。
- 输入：
  - oral text
  - scribe
  - sender city
  - recipient city
  - letter type
  - reply context
  - emotion / scene tags
- 输出：
  - scribe draft
  - read-aloud text
  - signature
  - draft source metadata
- 覆盖首批场景：
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

验收标准：

- 不同代笔先生会生成风格可感知不同的草稿。
- 原始口述内容保留为 `oralText`。
- 最终校改正文保留为 `finalText`。
- 生成元数据能保留下来，便于未来迁移到 AI 生成。

### 阶段 7：信箱与真实时间送达推进

目标：让信件可拆阅状态取决于真实经过时间。

推荐范围：

- 持久化投寄时间戳和预计送达窗口。
- 基于 `Date.now()` 计算当前是否可拆。
- 普通信不主动提醒，用户打开信箱时才看到。
- 已到达信件可以拆阅。
- 到达前不能打开。
- 增加延误、迷失、找回、退回状态，并记录对应邮政事件。

验收标准：

- 新投寄信件不会立即可拆。
- 已到达信件会按真实时间变为可拆。
- 状态变化会生成邮政记录。
- 没有任何信件会在没有记录的情况下消失。

### 阶段 8：云端与双人同步准备

目标：本地流程稳定后，为真实两人使用做云端同步准备。

推荐范围：

- 基于本地 schema 定义远端数据模型。
- 增加只面向两个人的账户 / 成员绑定。
- 设计钱匣、信件、草稿和邮政记录的冲突策略。
- 规划照片附件的文件存储。
- 规划系统推送事件：
  - 挂号信到达
  - 重要信件到达
  - 迷失信件找回
  - 退回信件

验收标准：

- 本地 schema 可以映射到云端记录，不需要重写领域规则。
- 云端边界不渗入 `src/domain`。
- 推送事件保持克制，并符合旧时代通信体验。

## 操作备注

- 优先使用浏览器调试：`npm run dev`。
- Web 代码变更后，如需检查原生壳，先执行 `npm run cap:sync`。
- 不要提交生成的 `dist/` 或 Capacitor 复制出的 Web 资源。
- UI 保持移动端优先，同时保证桌面浏览器可用。
- 保持克制的档案 / 账簿视觉方向。
- 在模板引擎边界完成前，不要接入 AI 代写。
