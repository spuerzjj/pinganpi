import { describe, expect, it } from "vitest";
import { buildScribeMessages } from "./prompt.js";

describe("scribe prompt material", () => {
  it("builds restrained 1960-era scribe messages from request fields", () => {
    const messages = buildScribeMessages({
      oralText: "近来身体还好，只是惦记家里。",
      scribeName: "陈启明",
      scribeStyle: "语气温和，字句端正",
      senderGreeting: "兰卿",
      senderSignature: "阿平",
      senderCity: "广州",
      recipientCity: "上海",
      letterType: "registered"
    });

    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({
      role: "system",
      content: expect.stringContaining("1960 年左右中国街口代笔先生")
    });
    expect(messages[0]?.content).toContain("不要替用户投寄");
    expect(messages[1]).toMatchObject({
      role: "user",
      content: expect.stringContaining("代笔先生：陈启明")
    });
    expect(messages[1]?.content).toContain("信件类型：挂号信");
    expect(messages[1]?.content).toContain("口述：近来身体还好，只是惦记家里。");
  });
});
