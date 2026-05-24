import {
  createLocalMockState,
  createWalletPageModel,
  type WalletPageModel,
} from "../../services/local-model.js";

Page({
  data: {
    model: null as WalletPageModel | null,
  },
  onShow(this: { setData(data: { model: WalletPageModel }): void }) {
    const now = new Date();
    const state = createLocalMockState(now);
    const model = createWalletPageModel(state, now);

    this.setData({ model });
  },
});
