import { getMiniProgramRuntimeConfig } from "./config/env.js";

const runtimeConfig = getMiniProgramRuntimeConfig();

App({
  globalData: {
    runtimeConfig,
  },

  onLaunch() {
    if (wx.cloud) {
      wx.cloud.init({
        env: runtimeConfig.cloudbaseEnvId,
        traceUser: true,
      });
    }
  },
});
