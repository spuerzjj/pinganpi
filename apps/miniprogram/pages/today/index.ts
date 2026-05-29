import {
  createLocalMockState,
  createTodayPageModel,
  type TodayPageModel,
} from "../../services/local-model.js";
import {
  checkMiniProgramSyncStatus,
  createInitialSyncStatus,
  createSyncingStatus,
  type MiniProgramSyncStatus,
} from "../../services/sync-status.js";

interface TodayPageData {
  model: TodayPageModel | null;
  syncStatus: MiniProgramSyncStatus;
}

interface TodayPageInstance {
  setData(data: Partial<TodayPageData>): void;
}

Page({
  data: {
    model: null as TodayPageModel | null,
    syncStatus: createInitialSyncStatus(),
  },
  onShow(this: TodayPageInstance) {
    const now = new Date();
    const state = createLocalMockState(now);
    const model = createTodayPageModel(state, now);

    this.setData({ model, syncStatus: createSyncingStatus() });

    void checkMiniProgramSyncStatus()
      .then((syncStatus) => {
        this.setData({ syncStatus });
      })
      .catch(() => {
        this.setData({
          syncStatus: {
            ...createInitialSyncStatus(),
            state: "failed",
            label: "云端查验未成",
            detailText: "云端查验暂未成功，稍后再试。",
            checkedAtText: "刚才",
          },
        });
      });
  },
});
