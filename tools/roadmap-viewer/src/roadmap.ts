export type PhaseStatus = "done" | "next" | "pending" | "paused";

export interface RoadmapMetric {
  label: string;
  value: string;
  note: string;
}

export interface RoadmapLink {
  label: string;
  href: string;
}

export interface RoadmapPhase {
  id: number;
  title: string;
  status: PhaseStatus;
  summary: string;
}

export interface RoadmapData {
  updatedAt: string;
  title: string;
  summary: string;
  currentPhaseId: number;
  nextPhaseId: number;
  metrics: RoadmapMetric[];
  risks: string[];
  links: RoadmapLink[];
  phases: RoadmapPhase[];
}

export interface RoadmapPhaseGroup {
  status: PhaseStatus;
  label: string;
  phases: RoadmapPhase[];
}

export interface RoadmapViewModel {
  data: RoadmapData;
  currentPhase: RoadmapPhase | undefined;
  nextPhase: RoadmapPhase | undefined;
  completedCount: number;
  totalCount: number;
  completionPercent: number;
  riskCount: number;
  phaseGroups: RoadmapPhaseGroup[];
}

const phaseStatusLabels: Record<PhaseStatus, string> = {
  done: "已完成",
  next: "下一步",
  pending: "未开始",
  paused: "暂存"
};

const statusOrder: PhaseStatus[] = ["done", "next", "pending", "paused"];

export function createRoadmapViewModel(data: RoadmapData): RoadmapViewModel {
  const completedCount = data.phases.filter((phase) => phase.status === "done").length;
  const totalCount = data.phases.length;

  return {
    data,
    currentPhase: data.phases.find((phase) => phase.id === data.currentPhaseId),
    nextPhase: data.phases.find((phase) => phase.id === data.nextPhaseId),
    completedCount,
    totalCount,
    completionPercent: totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100),
    riskCount: data.risks.length,
    phaseGroups: statusOrder.flatMap((status) => {
      const phases = data.phases.filter((phase) => phase.status === status);

      return phases.length === 0 ? [] : [{ status, label: phaseStatusLabels[status], phases }];
    })
  };
}

export function getPhaseStatusLabel(status: PhaseStatus): string {
  return phaseStatusLabels[status];
}
