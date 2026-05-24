import { describe, expect, it } from "vitest";
import { createRoadmapViewModel, type RoadmapData } from "./roadmap.js";

describe("roadmap viewer model", () => {
  it("summarizes current progress from structured roadmap data", () => {
    const data: RoadmapData = {
      updatedAt: "2026-05-24",
      currentPhaseId: 26,
      nextPhaseId: 27,
      title: "平安批 Roadmap",
      summary: "小程序主线",
      metrics: [
        { label: "验证", value: "389 tests", note: "全量通过" }
      ],
      risks: ["AppID 未配置", "prd 未配置"],
      links: [],
      phases: [
        { id: 25, title: "dev 云链路", status: "done", summary: "已完成" },
        { id: 26, title: "登录绑定", status: "done", summary: "已完成" },
        { id: 27, title: "AI 同步", status: "next", summary: "下一步" },
        { id: 28, title: "上架配置", status: "pending", summary: "未开始" }
      ]
    };

    const model = createRoadmapViewModel(data);

    expect(model.currentPhase?.title).toBe("登录绑定");
    expect(model.nextPhase?.title).toBe("AI 同步");
    expect(model.completedCount).toBe(2);
    expect(model.totalCount).toBe(4);
    expect(model.completionPercent).toBe(50);
    expect(model.riskCount).toBe(2);
    expect(model.phaseGroups.map((group) => [group.status, group.phases.length])).toEqual([
      ["done", 2],
      ["next", 1],
      ["pending", 1]
    ]);
  });
});
