import { createTodayDomainSummary } from "../../services/domain-summary.js";

const todaySummary = createTodayDomainSummary(new Date());

Page({
  data: {
    kicker: "平安批 / 今日",
    title: todaySummary.eraDateText,
    body: `${todaySummary.presentDateText}。本埠邮资：${todaySummary.localPostageText}；挂号邮资：${todaySummary.registeredPostageText}。`
  }
});
