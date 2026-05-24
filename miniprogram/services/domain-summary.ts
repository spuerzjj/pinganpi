import {
  calculatePostage,
  formatEraDate,
  formatFen,
  formatPresentCorrespondence,
} from "../../shared/domain/index.js";

export interface TodayDomainSummary {
  eraDateText: string;
  presentDateText: string;
  localPostageText: string;
  registeredPostageText: string;
}

export function createTodayDomainSummary(now: Date): TodayDomainSummary {
  return {
    eraDateText: formatEraDate(now),
    presentDateText: formatPresentCorrespondence(now),
    localPostageText: formatFen(calculatePostage({ local: true, registered: false, hasPhoto: false })),
    registeredPostageText: formatFen(calculatePostage({ local: true, registered: true, hasPhoto: false })),
  };
}
