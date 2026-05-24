import { describe, expect, it } from "vitest";
import type { DraftPaper } from "./app-state.js";
import type { ScribeDraftResult } from "./scribe-template-engine.js";
import {
  canContinueFromStep,
  canEnterStep,
  createInitialWriteLetterWizardState,
  createWriteLetterWizardStateFromDraft,
  getDraftWizardSyncAction,
  getNextStepId,
  markDraftGenerated,
  markTextBasisChanged,
  writeLetterSteps
} from "./write-letter-wizard.js";

describe("write letter wizard", () => {
  it("defines the five archival writing steps in order", () => {
    expect(writeLetterSteps.map((step) => step.id)).toEqual(["method", "oral", "draft", "revise", "post"]);
    expect(writeLetterSteps.map((step) => step.label)).toEqual(["选写法", "口述", "起稿", "校改", "投寄"]);
  });

  it("blocks later steps until the oral text and draft are ready", () => {
    const state = createInitialWriteLetterWizardState({
      defaultScribeId: "scribe-xu",
      sampleOralText: "",
      sampleDraftText: ""
    });

    expect(canEnterStep(state, "method")).toBe(true);
    expect(canEnterStep(state, "oral")).toBe(true);
    expect(canEnterStep(state, "draft")).toBe(false);
    expect(canEnterStep(state, "revise")).toBe(false);
    expect(canEnterStep(state, "post")).toBe(false);
    expect(canContinueFromStep(state, "oral")).toBe(false);
  });

  it("allows revise and post after a fresh draft and final text exist", () => {
    const initial = createInitialWriteLetterWizardState({
      defaultScribeId: "scribe-xu",
      sampleOralText: "今日雨停，心里记挂你。",
      sampleDraftText: ""
    });
    const drafted = markDraftGenerated(initial, "兰卿：今日雨停，心里记挂你。");

    expect(drafted.draftDirty).toBe(false);
    expect(drafted.scribeDraft).toBe("兰卿：今日雨停，心里记挂你。");
    expect(drafted.finalText).toBe("兰卿：今日雨停，心里记挂你。");
    expect(canEnterStep(drafted, "revise")).toBe(true);
    expect(canEnterStep(drafted, "post")).toBe(true);
    expect(canContinueFromStep(drafted, "revise")).toBe(true);
  });

  it("keeps AI draft metadata after a generated draft enters the wizard", () => {
    const initial = createInitialWriteLetterWizardState({
      defaultScribeId: "scribe-xu",
      sampleOralText: "请替我问她近来安好。",
      sampleDraftText: ""
    });

    const drafted = markDraftGenerated(initial, createAiDraftResult());

    expect(drafted).toMatchObject({
      scribeDraft: "兰卿：见字如晤。近来安好否。",
      readAloudText: "兰卿：见字如晤。近来安好否。",
      finalText: "兰卿：见字如晤。近来安好否。",
      draftSource: "ai",
      draftDirty: false,
      finalTextFromDraft: true
    });
    expect(drafted.generationMeta).toMatchObject({
      engine: "ai-scribe-v1",
      provider: "xiaomi-mimo",
      scribeId: "scribe-xu"
    });
  });

  it("requires a new draft after the oral text or writing method changes", () => {
    const drafted = markDraftGenerated(
      createInitialWriteLetterWizardState({
        defaultScribeId: "scribe-xu",
        sampleOralText: "今日雨停，心里记挂你。",
        sampleDraftText: ""
      }),
      "兰卿：今日雨停，心里记挂你。"
    );

    const changed = markTextBasisChanged({
      ...drafted,
      oralText: "今日雨停，也添了些寒意。"
    });

    expect(changed.draftDirty).toBe(true);
    expect(canEnterStep(changed, "revise")).toBe(false);
    expect(canEnterStep(changed, "post")).toBe(false);
    expect(getNextStepId(changed, "oral")).toBe("draft");
  });

  it("clears stale generated draft metadata after the oral text or writing method changes", () => {
    const drafted = markDraftGenerated(
      createInitialWriteLetterWizardState({
        defaultScribeId: "scribe-xu",
        sampleOralText: "请替我问她近来安好。",
        sampleDraftText: ""
      }),
      createAiDraftResult()
    );

    const changed = markTextBasisChanged({
      ...drafted,
      oralText: "请替我问她冬衣是否够用。"
    });

    expect(changed).toMatchObject({
      scribeDraft: "",
      readAloudText: "",
      finalText: "",
      draftDirty: true,
      finalTextFromDraft: true
    });
    expect(changed.draftSource).toBeUndefined();
    expect(changed.generationMeta).toBeUndefined();
  });

  it("restores wizard state from an existing draft paper", () => {
    const draft: DraftPaper = {
      id: "draft-1",
      authorMemberId: "member-zhou",
      recipientMemberId: "member-lan",
      createdAtIso: "2026-05-23T04:00:00.000Z",
      updatedAtIso: "2026-05-23T05:00:00.000Z",
      oralText: "今日雨停。",
      scribeId: "scribe-xu",
      scribeDraft: "兰卿：今日雨停。",
      finalText: "兰卿：今日雨停，心里记挂你。",
      readAloudText: "兰卿：今日雨停。",
      draftSource: "ai",
      generationMeta: {
        engine: "ai-scribe-v1",
        provider: "xiaomi-mimo",
        model: "mimo-v2.5",
        promptVersion: "ai-scribe-prompt-v1",
        scribeId: "scribe-xu",
        sceneTags: ["天气"],
        letterType: "ordinary",
        senderCity: "杭州",
        recipientCity: "西安",
        latencyMs: 1200
      },
      status: "revised"
    };

    const restored = createWriteLetterWizardStateFromDraft(draft);

    expect(restored).toMatchObject({
      currentStepId: "revise",
      selectedScribeId: "scribe-xu",
      oralText: "今日雨停。",
      scribeDraft: "兰卿：今日雨停。",
      finalText: "兰卿：今日雨停，心里记挂你。",
      readAloudText: "兰卿：今日雨停。",
      draftSource: "ai",
      registered: false,
      draftDirty: false,
      finalTextFromDraft: false
    });
    expect(restored.generationMeta).toMatchObject({
      engine: "ai-scribe-v1",
      provider: "xiaomi-mimo",
      scribeId: "scribe-xu"
    });
    expect(canEnterStep(restored, "post")).toBe(true);
  });

  it("keeps the current wizard when the same draft is saved again", () => {
    expect(getDraftWizardSyncAction({ draftId: "draft-1", resetKey: 0, saveKey: 1 }, { draftId: "draft-1", resetKey: 0, saveKey: 2 })).toBe("keep");
  });

  it("keeps the current wizard when a new letter is first saved as a draft", () => {
    expect(getDraftWizardSyncAction({ draftId: undefined, resetKey: 0, saveKey: 0 }, { draftId: "draft-1", resetKey: 0, saveKey: 1 })).toBe(
      "keep"
    );
  });

  it("restores the wizard only when switching to another draft", () => {
    expect(getDraftWizardSyncAction({ draftId: "draft-1", resetKey: 0, saveKey: 0 }, { draftId: "draft-2", resetKey: 0, saveKey: 0 })).toBe(
      "restore"
    );
  });

  it("resets the wizard after a successful post or active draft clear", () => {
    expect(getDraftWizardSyncAction({ draftId: undefined, resetKey: 0, saveKey: 0 }, { draftId: undefined, resetKey: 1, saveKey: 0 })).toBe(
      "reset"
    );
    expect(getDraftWizardSyncAction({ draftId: "draft-1", resetKey: 0, saveKey: 0 }, { draftId: undefined, resetKey: 0, saveKey: 0 })).toBe(
      "reset"
    );
  });
});

function createAiDraftResult(): ScribeDraftResult {
  return {
    oralText: "请替我问她近来安好。",
    scribeDraft: "兰卿：见字如晤。近来安好否。",
    readAloudText: "兰卿：见字如晤。近来安好否。",
    signature: "明远",
    draftSource: "ai",
    generationMeta: {
      engine: "ai-scribe-v1",
      provider: "xiaomi-mimo",
      model: "mimo-v2.5",
      promptVersion: "ai-scribe-prompt-v1",
      scribeId: "scribe-xu",
      sceneTags: ["问安"],
      letterType: "ordinary",
      senderCity: "杭州",
      recipientCity: "西安",
      latencyMs: 1200
    }
  };
}
