import vue from "@vitejs/plugin-vue";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, resolve, sep } from "node:path";
import { defineConfig, type Connect, type Plugin } from "vite";

const projectRoot = resolve(import.meta.dirname, "..");
const docsRoot = resolve(projectRoot, "docs");

function contentTypeFor(filePath: string): string {
  const contentTypes: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
    ".txt": "text/plain; charset=utf-8"
  };

  return contentTypes[extname(filePath)] ?? "application/octet-stream";
}

function serveDocs(middlewares: Connect.Server): void {
  middlewares.use((request, response, next) => {
    const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://roadmap.local").pathname);

    if (!pathname.startsWith("/docs/")) {
      next();
      return;
    }

    const filePath = resolve(projectRoot, `.${pathname}`);
    const insideDocsRoot = filePath === docsRoot || filePath.startsWith(`${docsRoot}${sep}`);

    if (!insideDocsRoot) {
      response.statusCode = 403;
      response.end("Forbidden");
      return;
    }

    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      next();
      return;
    }

    response.statusCode = 200;
    response.setHeader("Content-Type", contentTypeFor(filePath));
    createReadStream(filePath).pipe(response);
  });
}

function roadmapDevLinks(): Plugin {
  return {
    name: "roadmap-dev-links",
    configurePreviewServer(server) {
      serveDocs(server.middlewares);
    },
    configureServer(server) {
      serveDocs(server.middlewares);
      server.httpServer?.once("listening", () => {
        setTimeout(() => {
          const localUrl = server.resolvedUrls?.local[0];

          if (localUrl !== undefined) {
            server.config.logger.info(`  ➜  Roadmap Viewer: ${localUrl}`);
          }
        }, 0);
      });
    }
  };
}

export default defineConfig({
  root: import.meta.dirname,
  plugins: [vue(), roadmapDevLinks()],
  server: {
    fs: {
      allow: [projectRoot]
    }
  },
  build: {
    target: "es2022",
    outDir: "dist",
    emptyOutDir: true
  }
});
