import { createCloudBaseSyncHttpServer } from "./cloudbase-http-server.js";

const port = Number.parseInt(process.env.PORT ?? "9000", 10);

createCloudBaseSyncHttpServer().listen(port, "0.0.0.0", () => {
  console.log(`Pinganpi sync proxy listening on ${port}`);
});
