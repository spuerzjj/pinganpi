import {
  createArchivePageModel,
  createLocalMockState,
  type ArchivePageModel,
} from "../../services/local-model.js";

Page({
  data: {
    model: null as ArchivePageModel | null,
  },
  onShow(this: { setData(data: { model: ArchivePageModel }): void }) {
    const now = new Date();
    const state = createLocalMockState(now);
    const model = createArchivePageModel(state);

    this.setData({ model });
  },
});
