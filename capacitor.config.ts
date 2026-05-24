import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.pinganpi.app",
  appName: "平安批",
  webDir: "apps/legacy-capacitor/dist",
  android: {
    path: "apps/legacy-capacitor/android"
  },
  ios: {
    path: "apps/legacy-capacitor/ios"
  }
};

export default config;
