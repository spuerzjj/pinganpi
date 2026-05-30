#!/usr/bin/env node

const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "../..");
const projectPath = path.join(projectRoot, "apps/miniprogram");
const cloudFunctionRoot = path.join(projectRoot, "cloudbase/functions");
const defaultCliPath = "/Applications/wechatwebdevtools.app/Contents/MacOS/cli";
const functionNames = ["pinganpi-ai", "pinganpi-sync", "pinganpi-account", "pinganpi-pair"];

const envId = readRequiredEnv("CLOUDBASE_ENV_ID");
const cliPath = process.env.WECHAT_DEVTOOLS_CLI?.trim() || defaultCliPath;
const devtoolsPort = process.env.WECHAT_DEVTOOLS_PORT?.trim() || "24248";
const functionPaths = functionNames.map((name) => path.join(cloudFunctionRoot, name));

if (!fs.existsSync(cliPath)) {
  throw new Error(`未找到微信开发者工具 CLI：${cliPath}`);
}

for (const functionPath of functionPaths) {
  if (!fs.existsSync(path.join(functionPath, "index.js"))) {
    throw new Error(`缺少云函数构建产物：${functionPath}`);
  }
}

const args = [
  "cloud",
  "functions",
  "deploy",
  "--env",
  envId,
  "--paths",
  ...functionPaths,
  "--project",
  projectPath,
  "--port",
  devtoolsPort,
  "--lang",
  "zh",
];

const result = childProcess.spawnSync(cliPath, args, {
  cwd: projectRoot,
  env: process.env,
  encoding: "utf8",
  stdio: "inherit",
});

if (result.error !== undefined) {
  throw result.error;
}

if (result.status !== 0) {
  throw new Error(`微信开发者工具云函数部署失败，退出码：${result.status ?? "unknown"}`);
}

function readRequiredEnv(key) {
  const value = process.env[key]?.trim();

  if (value === undefined || value.length === 0) {
    throw new Error(`Missing ${key}.`);
  }

  return value;
}
