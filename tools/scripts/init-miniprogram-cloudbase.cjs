#!/usr/bin/env node

const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { build } = require("esbuild");
const automator = require("miniprogram-automator");

const projectRoot = path.resolve(__dirname, "../..");
const projectPath = path.join(projectRoot, "apps/miniprogram");
const defaultCliPath = "/Applications/wechatwebdevtools.app/Contents/MacOS/cli";
const functionName = "pinganpi-init-db";
const functionPath = path.join(projectRoot, "cloudbase/functions", functionName);
const defaultDevtoolsPort = "24248";
const defaultAutomatorPort = "9437";
const requiredCollections = [
  "pinganpi_accounts",
  "pinganpi_households",
  "pinganpi_members",
  "pinganpi_invites",
  "pinganpi_sync_snapshots",
];

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

async function main() {
  const envId = readRequiredEnv("CLOUDBASE_ENV_ID");
  const cliPath = process.env.WECHAT_DEVTOOLS_CLI?.trim() || defaultCliPath;
  const devtoolsPort = process.env.WECHAT_DEVTOOLS_PORT?.trim() || defaultDevtoolsPort;
  const automatorPort = process.env.WECHAT_AUTOMATOR_PORT?.trim() || defaultAutomatorPort;
  const token = crypto.randomBytes(24).toString("hex");

  await buildMaintenanceFunction({ token, collections: requiredCollections });
  await runDevtoolsDeploy({
    cliPath,
    args: buildDevtoolsDeployArgs({ cliPath, envId, functionPath, projectPath, devtoolsPort }),
  });
  await runDevtoolsAuto({ cliPath, devtoolsPort, automatorPort });
  const result = await invokeMaintenanceFunction({ automatorPort, token });

  console.log(JSON.stringify(result, null, 2));
}

async function buildMaintenanceFunction({ token, collections }) {
  await fs.rm(functionPath, { recursive: true, force: true });
  await fs.mkdir(functionPath, { recursive: true });

  await build({
    stdin: {
      contents: buildInitFunctionSource({ token, collections }),
      resolveDir: projectRoot,
      sourcefile: "pinganpi-init-db.generated.js",
      loader: "js",
    },
    outfile: path.join(functionPath, "index.js"),
    bundle: true,
    platform: "node",
    target: "node16",
    format: "cjs",
    sourcemap: false,
    minify: false,
  });

  await fs.writeFile(
    path.join(functionPath, "package.json"),
    `${JSON.stringify(
      {
        name: "pinganpi-init-db",
        version: "0.1.0",
        private: true,
        main: "index.js",
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  await fs.writeFile(
    path.join(functionPath, "README.md"),
    [
      "# pinganpi-init-db",
      "",
      "Generated one-off maintenance function for initializing Pinganpi CloudBase collections.",
      "Do not edit this directory by hand.",
      "",
    ].join("\n"),
    "utf8",
  );
}

function buildDevtoolsDeployArgs({ envId, functionPath, projectPath, devtoolsPort }) {
  return [
    "cloud",
    "functions",
    "deploy",
    "--env",
    envId,
    "--paths",
    functionPath,
    "--project",
    projectPath,
    "--port",
    devtoolsPort,
    "--lang",
    "zh",
  ];
}

function buildInitFunctionSource({ token, collections }) {
  return `
const cloudbase = require("@cloudbase/node-sdk");

const expectedToken = ${JSON.stringify(token)};
const requiredCollections = ${JSON.stringify(collections, null, 2)};

exports.main = async function main(event = {}) {
  if (event.token !== expectedToken) {
    return {
      ok: false,
      reason: "unauthorized",
      message: "Invalid maintenance token."
    };
  }

  const app = cloudbase.init(
    process.env.CLOUDBASE_ENV_ID === undefined || process.env.CLOUDBASE_ENV_ID.trim().length === 0
      ? {}
      : { env: process.env.CLOUDBASE_ENV_ID.trim() }
  );
  const db = app.database();
  const results = [];

  for (const name of requiredCollections) {
    results.push(await ensureCollection(db, name));
  }

  return {
    ok: true,
    collections: results
  };
};

async function ensureCollection(db, name) {
  try {
    await db.createCollection(name);
    return { name, status: "created" };
  } catch (error) {
    if (await collectionExists(db, name)) {
      return { name, status: "exists" };
    }

    return {
      name,
      status: "failed",
      message: safeErrorMessage(error)
    };
  }
}

async function collectionExists(db, name) {
  try {
    await db.collection(name).get();
    return true;
  } catch {
    return false;
  }
}

function safeErrorMessage(error) {
  const message = error instanceof Error ? error.message : String(error);

  return message.replace(/(?:sk|tp)-[A-Za-z0-9_-]{6,}/g, "[redacted-secret]").slice(0, 240);
}
`;
}

async function runDevtoolsAuto({ cliPath, devtoolsPort, automatorPort }) {
  runCommand(cliPath, [
    "--port",
    devtoolsPort,
    "--lang",
    "zh",
    "auto",
    "--project",
    projectPath,
    "--auto-port",
    automatorPort,
    "--trust-project",
  ]);
}

async function runDevtoolsDeploy({ cliPath, args }) {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const output = runCommandCapture(cliPath, args);

    process.stdout.write(output);

    if (isSuccessfulDeployOutput(output)) {
      return;
    }

    if (attempt < maxAttempts && isCreatingStateDeployFailure(output)) {
      await sleep(20_000);
      continue;
    }

    throw new Error("微信开发者工具云函数部署失败。");
  }
}

function isSuccessfulDeployOutput(output) {
  return /pinganpi-init-db[\s\S]*true/.test(output) && !/部署失败|false/.test(output);
}

function isCreatingStateDeployFailure(output) {
  return output.includes("Creating状态") || output.includes("FailedOperation.UpdateFunctionCode");
}

async function invokeMaintenanceFunction({ automatorPort, token }) {
  const miniProgram = await connectAutomatorWithRetry(automatorPort);

  try {
    await miniProgram.reLaunch("/pages/account/index");

    return await miniProgram.evaluate(
      (targetFunctionName, maintenanceToken) => {
        return wx.cloud
          .callFunction({
            name: targetFunctionName,
            data: { token: maintenanceToken },
          })
          .catch((error) => ({
            caught: true,
            errMsg: error && error.errMsg,
            errCode: error && error.errCode,
            message: error && error.message,
          }));
      },
      functionName,
      token,
    );
  } finally {
    miniProgram.disconnect();
  }
}

async function connectAutomatorWithRetry(automatorPort) {
  const wsEndpoint = `ws://127.0.0.1:${automatorPort}`;
  let lastError;

  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      return await automator.connect({ wsEndpoint });
    } catch (error) {
      lastError = error;
      await sleep(500);
    }
  }

  throw lastError ?? new Error(`Failed connecting to ${wsEndpoint}.`);
}

function runCommand(command, args) {
  const result = childProcess.spawnSync(command, args, {
    cwd: projectRoot,
    env: process.env,
    encoding: "utf8",
    stdio: "inherit",
  });

  if (result.error !== undefined) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} failed with status ${result.status ?? "unknown"}.`);
  }
}

function runCommandCapture(command, args) {
  const result = childProcess.spawnSync(command, args, {
    cwd: projectRoot,
    env: process.env,
    encoding: "utf8",
  });
  const output = [result.stdout, result.stderr].filter(Boolean).join("");

  if (result.error !== undefined) {
    throw result.error;
  }

  if (result.status !== 0 && output.length === 0) {
    throw new Error(`${command} failed with status ${result.status ?? "unknown"}.`);
  }

  return output;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function readRequiredEnv(key) {
  const value = process.env[key]?.trim();

  if (value === undefined || value.length === 0) {
    throw new Error(`Missing ${key}.`);
  }

  return value;
}

module.exports = {
  buildDevtoolsDeployArgs,
  buildInitFunctionSource,
  isCreatingStateDeployFailure,
  isSuccessfulDeployOutput,
  requiredCollections,
};
