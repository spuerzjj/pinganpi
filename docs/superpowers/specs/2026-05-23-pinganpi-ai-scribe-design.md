# 平安批 AI 代笔接入设计

> 本设计对应路线图阶段 10：AI 代笔接入设计。目标是为后续阶段 11 的本地 AI 代理基础、阶段 12 的 AI 正文生成落地、阶段 13 的云端 AI 代理与费用配置提供明确边界。

## 目标

接入 AI 能力生成信件正文初稿。AI 只扮演“代笔先生起稿”，不能自动投寄，不能绕过亲自校改、费用校验、封缄投寄、真实等待和拆阅规则。

用户已确认允许将口述内容发送到第三方模型服务。模板不再作为完整正文生成 fallback，而是转为提示词素材、风格样例和约束规则。AI 失败、超时、额度不足或无网时，系统保存口述草稿，提示稍后再请先生起稿。

## 非目标

- 不在移动端或 Vite 客户端直连第三方 AI。
- 不把 AI provider key 放进客户端环境变量、构建产物或 Git。
- 不保留用户可选的“模板代拟制”。
- 不做 AI 自动投寄、自动回信、未拆来信总结或已校定正文改写。
- 不改变 `src/domain` 内的时间、钱匣、邮资、送达和状态机规则。

## 现有边界

当前写信链路由 `src/app/write-letter-service.ts` 统一处理草稿保存、投寄、扣款、账本和邮政记录。正文起稿来自 `src/app/scribe-template-engine.ts` 的 `generateScribeDraft`，输出字段已经覆盖：

- `oralText`
- `scribeDraft`
- `readAloudText`
- `signature`
- `draftSource`
- `generationMeta`

后续 AI 接入应复用这些字段，并把现有模板能力迁移为提示词素材模块，而不是另建一套写信规则。

## 架构

采用三层边界：

1. App 层 AI adapter
   - 位于 `src/app/`。
   - 负责定义 `AiScribeDraftInput`、`AiScribeDraftResult`、`AiScribeGenerationMeta` 和错误类型。
   - 只调用自有服务端代理，不持有第三方 AI key。

2. 提示词素材层
   - 从现有模板引擎中抽出场景标签、先生风格、时代口吻约束和示例片段。
   - 输出 prompt material，不直接生成完整正文。
   - 作为 AI 请求的一部分传给服务端代理。

3. 最小 AI 服务端代理
   - 阶段 11 创建本地开发代理。
   - 阶段 13 完成云端代理、费用告警和 secret 配置。
   - 保存 provider key。
   - 接收客户端请求，调用第三方模型，返回结构化起稿结果。
   - 不保存完整 prompt、原始 provider response 或敏感日志。

## 数据流

写信页“起稿”步骤：

1. 用户选择亲笔或代笔先生。
2. 用户输入口述。
3. 若选择亲笔，仍按亲笔流程生成 `draftSource: "handwritten"`。
4. 若选择代笔先生，客户端调用 AI adapter。
5. AI adapter 发送最小必要上下文到自有服务端代理。
6. 服务端代理调用第三方模型并返回初稿。
7. 客户端进入“校改”步骤，用户手工修改正文。
8. 投寄仍调用现有写信服务，继续做余额、代书费、邮资、状态机和邮政记录校验。

AI 失败时：

1. 不生成模板正文。
2. 保留用户口述、先生选择和草稿状态。
3. 提示用户稍后再请先生起稿。
4. 用户可以保存口述草稿。

## 输入与输出

AI 输入限定为：

- 原始口述。
- 代笔先生 id、姓名、风格、收费、擅长场景。
- 发信人 / 收信人的称呼、信内称呼、落款名、城市。
- 信件类型：普通信 / 挂号信。
- 情绪标签和必要回复上下文。
- 提示词素材：时代口吻、禁用表达、先生风格样例、场景约束。

AI 输出必须映射为：

```ts
{
  oralText: string;
  scribeDraft: string;
  readAloudText: string;
  signature: string;
  draftSource: "ai";
  generationMeta: {
    engine: "ai-scribe-v1";
    provider: string;
    model: string;
    promptVersion: string;
    scribeId: string;
    sceneTags: string[];
    letterType: "ordinary" | "registered";
    senderCity: string;
    recipientCity: string;
    latencyMs: number;
  };
}
```

失败结果不写入 `scribeDraft`。失败信息应使用受控错误类型，例如：

- `network_unavailable`
- `provider_timeout`
- `quota_exceeded`
- `invalid_response`
- `proxy_unavailable`

## 提示词约束

提示词必须约束模型：

- 使用 1960 年左右普通书信和代书先生口吻。
- 保留用户口述事实，不擅自添加重大事件、承诺、疾病、财务情况或现实地址。
- 不出现现代即时聊天表达、网络词、营销腔、客服腔和过度文学化表达。
- 不生成“已寄出”“我马上发消息”“看手机”等破坏慢通信语境的内容。
- 不展示现代地图、物流、实时提醒相关表达。
- 正文应适合被“先生念读给本人听”，并允许用户亲自校改。

## 安全与隐私

- 客户端不得保存或传输第三方 AI key。
- 不使用 `VITE_` 前缀保存任何 provider secret。
- 服务端代理日志不得记录完整口述、完整 prompt、最终正文或原始 provider response。
- `generationMeta` 只保存 provider、model、prompt version、耗时、场景标签和失败原因等非正文元信息。
- 未到达 / 未拆阅的来信正文仍不得暴露给收件方；AI 不参与未拆信内容处理。

## 测试策略

阶段 12 实现时至少覆盖：

- fake AI adapter 成功返回初稿，`draftSource` 为 `ai`。
- AI 失败时不生成模板正文，口述草稿可保存。
- `generationMeta` 保存 provider、model、prompt version 和耗时。
- 客户端只调用自有代理 URL，不读取第三方 provider key。
- 亲笔流程不受 AI 影响。
- 投寄仍经过余额、费用、状态机和真实送达规则。

## 迁移与兼容

现有本地数据可能包含 `draftSource: "template"`。阶段 12 不需要强制迁移旧数据，旧草稿和旧信件可继续展示；新代笔起稿只产生 `draftSource: "ai"`。远端同步阶段需要保留历史 `template` 值的只读兼容，但不再为新正文生成使用模板代拟。

## 开放问题

- 阶段 13 需要在实施时确认 Xiaomi MiMo 的接口地址、模型 ID、调用协议和额度告警方式。
- 阶段 12 需要根据供应商返回格式确定服务端代理的响应清洗规则。
- 如果用户后续希望完全离线可起稿，需要另行设计本地模型或重新引入非 AI 草稿生成机制；当前不做。

## 当前供应商记录

用户已购买 Xiaomi MiMo 模型，默认优先接入该模型，不再从零采购新的 AI 能力。阶段 13 云端配置实施前仍需确认：

- API base URL。
- 模型 ID。
- 调用协议是否兼容 OpenAI Chat Completions / Responses 风格，或需要自定义适配。
- 可用额度和费用告警方式。
- key 如何写入云函数 / 服务端代理的 secret，不进入客户端。
