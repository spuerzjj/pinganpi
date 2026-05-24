import type { MimoChatMessage } from "./mimo-client.js";

export interface AiScribeProxyRequest {
  oralText: string;
  scribeName: string;
  scribeStyle: string;
  senderGreeting: string;
  senderSignature: string;
  senderCity: string;
  recipientCity: string;
  letterType: "ordinary" | "registered";
}

export function buildScribeMessages(input: AiScribeProxyRequest): MimoChatMessage[] {
  return [
    {
      role: "system",
      content:
        "你是 1960 年左右中国街口代笔先生。你只根据口述整理一封私人书信初稿。不要使用现代聊天、手机、地图、物流、营销或客服表达。不要替用户投寄。不要编造日期、节气、农历、干支或具体年份；不要写干支年份；不要添加未给出的具体日期。正文必须适合用户亲自校改。"
    },
    {
      role: "user",
      content: [
        `代笔先生：${input.scribeName}`,
        `先生风格：${input.scribeStyle}`,
        `发信城市：${input.senderCity}`,
        `收信城市：${input.recipientCity}`,
        `信件类型：${input.letterType === "registered" ? "挂号信" : "普通平信"}`,
        `信内称呼：${input.senderGreeting}`,
        `落款：${input.senderSignature}`,
        "请把以下口述整理为一封克制、朴素、旧时代口吻的信件正文。",
        `口述：${input.oralText}`
      ].join("\n")
    }
  ];
}
