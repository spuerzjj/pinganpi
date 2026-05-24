import {
  createLocalMockState,
  createTodayPageModel,
  type TodayPageModel,
} from "../../services/local-model.js";

Page({
  data: {
    model: null as TodayPageModel | null,
  },
  onShow(this: { setData(data: { model: TodayPageModel }): void }) {
    const now = new Date();
    const state = createLocalMockState(now);
    const model = createTodayPageModel(state, now);

    this.setData({ model });
  },
});
