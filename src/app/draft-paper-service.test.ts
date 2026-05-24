import { describe, expect, it } from "vitest";
import { createDefaultAppState, settleAppState } from "./app-state.js";
import { deleteDraftPaper, postDraftPaper, saveDraftPaper } from "./draft-paper-service.js";

describe("draft paper service", () => {
  const now = new Date("2026-05-23T04:00:00.000Z");
  const later = new Date("2026-05-23T05:00:00.000Z");

  it("creates a new draft paper", () => {
    const state = settleAppState(createDefaultAppState(), now).state;
    const result = saveDraftPaper(
      state,
      {
        oralText: "今日雨停，心里记挂你。",
        scribeId: "scribe-xu",
        finalText: "兰卿：今日雨停，心里记挂你。",
        registered: false
      },
      now
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.created).toBe(true);
    expect(result.state.draftPapers).toHaveLength(1);
    expect(result.state.draftPapers[0]).toMatchObject({
      id: result.draftId,
      oralText: "今日雨停，心里记挂你。",
      finalText: "兰卿：今日雨停，心里记挂你。",
      status: "revised"
    });
  });

  it("updates an existing draft without duplicating it", () => {
    const state = settleAppState(createDefaultAppState(), now).state;
    const created = saveDraftPaper(
      state,
      {
        oralText: "今日雨停，心里记挂你。",
        scribeId: "scribe-xu",
        finalText: "兰卿：今日雨停，心里记挂你。",
        registered: false
      },
      now
    );
    if (!created.ok) throw new Error(created.reason);

    const updated = saveDraftPaper(
      created.state,
      {
        draftId: created.draftId,
        oralText: "今日雨停，也添了些寒意。",
        scribeId: "scribe-xu",
        finalText: "兰卿：今日雨停，也添了些寒意。",
        registered: false
      },
      later
    );

    expect(updated.ok).toBe(true);
    if (!updated.ok) throw new Error(updated.reason);
    expect(updated.created).toBe(false);
    expect(updated.state.draftPapers).toHaveLength(1);
    expect(updated.state.draftPapers[0]).toMatchObject({
      id: created.draftId,
      createdAtIso: now.toISOString(),
      updatedAtIso: later.toISOString(),
      oralText: "今日雨停，也添了些寒意。",
      finalText: "兰卿：今日雨停，也添了些寒意。"
    });
  });

  it("updates one draft by index without changing another draft with a colliding generated id", () => {
    const state = settleAppState(createDefaultAppState(), now).state;
    const created = saveDraftPaper(
      state,
      {
        oralText: "第一张草稿。",
        scribeId: null,
        finalText: "第一张草稿。",
        registered: false
      },
      now
    );
    if (!created.ok) throw new Error(created.reason);
    created.state.draftPapers.push({
      id: `draft-${later.getTime()}-1`,
      authorMemberId: "member-zhou",
      recipientMemberId: "member-lan",
      createdAtIso: now.toISOString(),
      updatedAtIso: now.toISOString(),
      oralText: "第二张草稿。",
      scribeId: null,
      scribeDraft: "第二张草稿。",
      finalText: "第二张草稿。",
      status: "draft"
    });

    const updated = saveDraftPaper(
      created.state,
      {
        draftId: created.draftId,
        oralText: "第一张草稿已改。",
        scribeId: null,
        finalText: "第一张草稿已改。",
        registered: false
      },
      later
    );

    expect(updated.ok).toBe(true);
    if (!updated.ok) throw new Error(updated.reason);
    expect(updated.state.draftPapers).toHaveLength(2);
    expect(updated.state.draftPapers[0]).toMatchObject({
      id: created.draftId,
      oralText: "第一张草稿已改。",
      finalText: "第一张草稿已改。"
    });
    expect(updated.state.draftPapers[1]).toMatchObject({
      id: `draft-${later.getTime()}-1`,
      oralText: "第二张草稿。",
      finalText: "第二张草稿。"
    });
  });

  it("fails to update a missing draft", () => {
    const state = settleAppState(createDefaultAppState(), now).state;
    const result = saveDraftPaper(
      state,
      {
        draftId: "missing-draft",
        oralText: "今日雨停。",
        scribeId: null,
        finalText: "今日雨停。",
        registered: false
      },
      now
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected missing draft update to fail");
    expect(result.reason).toBe("没有找到这张草稿。");
    expect(result.state.draftPapers).toHaveLength(0);
  });

  it("deletes an existing draft", () => {
    const state = settleAppState(createDefaultAppState(), now).state;
    const created = saveDraftPaper(
      state,
      {
        oralText: "今日雨停。",
        scribeId: null,
        finalText: "今日雨停。",
        registered: false
      },
      now
    );
    if (!created.ok) throw new Error(created.reason);

    const deleted = deleteDraftPaper(created.state, created.draftId, later);

    expect(deleted.ok).toBe(true);
    if (!deleted.ok) throw new Error(deleted.reason);
    expect(deleted.state.draftPapers).toHaveLength(0);
    expect(deleted.state.draftTombstones).toEqual([
      {
        id: created.draftId,
        authorMemberId: "member-zhou",
        recipientMemberId: "member-lan",
        deletedAtIso: later.toISOString()
      }
    ]);
  });

  it("keeps state unchanged when deleting a missing draft", () => {
    const state = settleAppState(createDefaultAppState(), now).state;
    const deleted = deleteDraftPaper(state, "missing-draft");

    expect(deleted.ok).toBe(false);
    if (deleted.ok) throw new Error("Expected missing draft delete to fail");
    expect(deleted.reason).toBe("没有找到这张草稿。");
    expect(deleted.state).toEqual(state);
  });

  it("posts an existing draft and removes it after success", () => {
    const state = settleAppState(createDefaultAppState(), now).state;
    const created = saveDraftPaper(
      state,
      {
        oralText: "今日雨停，心里记挂你。",
        scribeId: "scribe-xu",
        finalText: "兰卿：今日雨停，心里记挂你。",
        registered: false
      },
      now
    );
    if (!created.ok) throw new Error(created.reason);

    const posted = postDraftPaper(
      created.state,
      created.draftId,
      {
        oralText: "今日雨停，心里记挂你。",
        scribeId: "scribe-xu",
        finalText: "兰卿：今日雨停，心里记挂你。",
        registered: true
      },
      now
    );

    expect(posted.ok).toBe(true);
    if (!posted.ok) throw new Error(posted.reason);
    expect(posted.state.draftPapers).toHaveLength(0);
    expect(posted.state.letters.find((letter) => letter.id === posted.letterId)).toMatchObject({
      registered: true,
      finalText: "兰卿：今日雨停，心里记挂你。"
    });
  });

  it("keeps an existing draft when posting fails", () => {
    const state = settleAppState(createDefaultAppState(), now).state;
    const created = saveDraftPaper(
      state,
      {
        oralText: "今日雨停。",
        scribeId: "scribe-xu",
        finalText: "兰卿：今日雨停。",
        registered: false
      },
      now
    );
    if (!created.ok) throw new Error(created.reason);
    created.state.wallet.balanceFen = 1;

    const posted = postDraftPaper(
      created.state,
      created.draftId,
      {
        oralText: "今日雨停。",
        scribeId: "scribe-xu",
        finalText: "兰卿：今日雨停。",
        registered: true
      },
      now
    );

    expect(posted.ok).toBe(false);
    if (posted.ok) throw new Error("Expected posting to fail");
    expect(posted.reason).toBe("钱匣余额不足，不能赊账。");
    expect(posted.state.draftPapers).toHaveLength(1);
  });
});
