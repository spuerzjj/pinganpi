import {
  createLocalMockState,
  createScribesPageModel,
  type ScribesPageModel,
} from "../../services/local-model.js";

Page({
  data: {
    model: null as ScribesPageModel | null,
  },
  onShow(this: { setData(data: { model: ScribesPageModel }): void }) {
    const now = new Date();
    const state = createLocalMockState(now);
    const model = createScribesPageModel(state, now);

    this.setData({ model });
  },
});
