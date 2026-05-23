import { createCloudBaseHttpServer } from "./cloudbase-http-server.js";

const port = readPort(process.env.PORT);
const server = createCloudBaseHttpServer();

server.listen(port, "0.0.0.0", () => {
  console.log(`Pinganpi CloudBase AI proxy listening on 0.0.0.0:${port}`);
});

function readPort(value: string | undefined): number {
  if (value === undefined || value.trim().length === 0) {
    return 9000;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error("PORT must be an integer from 1 to 65535.");
  }

  return parsed;
}
