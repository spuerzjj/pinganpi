import {
  createLocalMockState,
  createMailboxPageModel,
  type MailboxPageModel,
} from "../../services/local-model.js";

Page({
  data: {
    model: null as MailboxPageModel | null,
  },
  onShow(this: { setData(data: { model: MailboxPageModel }): void }) {
    const now = new Date();
    const state = createLocalMockState(now);
    const model = createMailboxPageModel(state, now);

    this.setData({ model });
  },
});
