import { describe, expect, it } from "vitest";
import { createLocalMockState } from "./local-model.js";
import {
  createWriteFlowModel,
  generateLocalDraft,
  preparePostedReceipt,
  reviseDraft,
  setRegistered,
  updateOralText,
} from "./write-flow.js";

const fixedNow = new Date(Date.UTC(2026, 4, 23, 12, 0, 0));

describe("miniprogram write flow", () => {
  it("calculates draft cost from selected scribe and postage", () => {
    const flow = createWriteFlowModel(createLocalMockState(fixedNow), fixedNow);

    expect(flow.step).toBe("method");
    expect(flow.selectedScribeName).toBe("许鹤年");
    expect(flow.postageText).toBe("8 分");
    expect(flow.totalCostText).toBe("1 角 1 分");
    expect(flow.canPost).toBe(false);
  });

  it("generates and revises a local mock draft", () => {
    const state = createLocalMockState(fixedNow);
    const oral = updateOralText(createWriteFlowModel(state, fixedNow), "近来天阴，问她可安。");
    const drafted = generateLocalDraft(oral, state, fixedNow);
    const revised = reviseDraft(drafted, "兰卿：近来天阴，望你安好。");

    expect(drafted.step).toBe("revise");
    expect(drafted.draftText).toContain("许鹤年先生代拟");
    expect(drafted.draftText).toContain("近来天阴");
    expect(revised.finalText).toBe("兰卿：近来天阴，望你安好。");
    expect(revised.canPost).toBe(true);
  });

  it("updates registered postage and total cost", () => {
    const state = createLocalMockState(fixedNow);
    const registered = setRegistered(createWriteFlowModel(state, fixedNow), true);

    expect(registered.registered).toBe(true);
    expect(registered.postageText).toBe("1 角 6 分");
    expect(registered.totalCostText).toBe("1 角 9 分");
  });

  it("blocks local post when final text is blank or wallet is short", () => {
    const state = createLocalMockState(fixedNow);
    const blank = reviseDraft(createWriteFlowModel(state, fixedNow), "   ");
    const shortWallet = {
      ...state,
      wallet: {
        ...state.wallet,
        balanceFen: 10,
      },
    };
    const expensive = reviseDraft(createWriteFlowModel(shortWallet, fixedNow), "兰卿：一切平安。");

    expect(blank.canPost).toBe(false);
    expect(expensive.canPost).toBe(false);
  });

  it("prepares a local posted receipt without mutating cloud state", () => {
    const state = createLocalMockState(fixedNow);
    const flow = reviseDraft(
      generateLocalDraft(updateOralText(createWriteFlowModel(state, fixedNow), "一切平安。"), state, fixedNow),
      "兰卿：一切平安。",
    );

    expect(preparePostedReceipt(flow, state, fixedNow)).toEqual({
      title: "本地投寄存根",
      costText: "1 角 1 分",
      routeText: "杭州 → 西安",
      dueText: "一九六〇年五月三十日 至 一九六〇年六月四日",
    });
  });
});
