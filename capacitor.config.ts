import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.draxstudio.app",
  appName: "Drax Studio",
  webDir: "out",
  android: {
    allowMixedContent: false,
  },
};

export default config;
