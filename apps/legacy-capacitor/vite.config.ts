import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { defineConfig, type Plugin } from "vite";

function pinganpiDevLinks(): Plugin {
  return {
    name: "pinganpi-dev-links",
    configureServer(server) {
      server.httpServer?.once("listening", () => {
        setTimeout(() => {
          const localUrl = server.resolvedUrls?.local[0];

          if (localUrl === undefined) {
            return;
          }

          void localUrl;
          server.config.logger.info("  ➜  RoadMap: npm run roadmap:dev");
        }, 0);
      });
    }
  };
}

export default defineConfig({
  plugins: [vue(), tailwindcss(), pinganpiDevLinks()],
  build: {
    target: "es2022"
  }
});
