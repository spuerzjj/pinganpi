import { describe, expect, it } from "vitest";
import { createDefaultAppState } from "./app-state.js";
import { generateScribeDraft } from "./scribe-template-engine.js";

describe("scribe template engine", () => {
  const state = createDefaultAppState();
  const sender = state.members.find((member) => member.id === state.currentMemberId)!;
  const recipient = state.members.find((member) => member.id === state.recipientMemberId)!;

  it("keeps oral text and returns generation metadata", () => {
    const scribe = state.scribes.find((candidate) => candidate.id === "scribe-xu")!;

    const result = generateScribeDraft({
      oralText: "昨夜风紧，我很想你，也报个平安。",
      scribe,
      sender,
      recipient,
      senderCity: sender.city,
      recipientCity: recipient.city,
      letterType: "ordinary",
      replyContext: "久未回信",
      emotionTags: ["想念"]
    });

    expect(result.oralText).toBe("昨夜风紧，我很想你，也报个平安。");
    expect(result.scribeDraft).toContain("兰卿");
    expect(result.readAloudText).toContain("昨夜风紧");
    expect(result.signature).toBe("明远");
    expect(result.draftSource).toBe("template");
    expect(result.generationMeta).toMatchObject({
      engine: "local-template-v1",
      scribeId: "scribe-xu",
      templateId: "old-scholar-longing"
    });
    expect(result.generationMeta.sceneTags).toEqual(expect.arrayContaining(["想念", "报平安", "天气", "久未回信"]));
  });

  it("makes different scribes visibly different", () => {
    const oralText = "今日雨停，心里记挂你。";
    const oldScholar = state.scribes.find((candidate) => candidate.id === "scribe-xu")!;
    const clerk = state.scribes.find((candidate) => candidate.id === "scribe-qian")!;

    const scholarDraft = generateScribeDraft({
      oralText,
      scribe: oldScholar,
      sender,
      recipient,
      senderCity: sender.city,
      recipientCity: recipient.city,
      letterType: "ordinary",
      replyContext: null,
      emotionTags: []
    });
    const clerkDraft = generateScribeDraft({
      oralText,
      scribe: clerk,
      sender,
      recipient,
      senderCity: sender.city,
      recipientCity: recipient.city,
      letterType: "ordinary",
      replyContext: null,
      emotionTags: []
    });

    expect(scholarDraft.scribeDraft).toContain("见字如晤");
    expect(clerkDraft.scribeDraft).toContain("兹托钱守明代书");
    expect(scholarDraft.scribeDraft).not.toBe(clerkDraft.scribeDraft);
  });
});
