#!/usr/bin/env node

const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const childProcess = require("node:child_process");
const { promisify } = require("node:util");
const automator = require("miniprogram-automator");

const execFile = promisify(childProcess.execFile);

const projectRoot = path.resolve(__dirname, "../..");
const projectPath = path.join(projectRoot, "apps/miniprogram");
const storageKey = "pinganpi:miniprogram:account-session:v1";
const defaultCliPath = "/Applications/wechatwebdevtools.app/Contents/MacOS/cli";
const defaultAutomatorPort = 9431;
const defaultTimeoutMs = 45_000;
const defaultConnectAttemptTimeoutMs = 3_000;
const defaultScenarioTimeoutMs = 30_000;

const mode = process.argv[2] ?? "smoke";

if (!["smoke", "flow"].includes(mode)) {
  fail(`未知命令：${mode}。可用命令：smoke, flow`);
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    fail(error instanceof Error ? error.message : String(error), error);
  });

async function main() {
  const devtoolsPort = resolveDevtoolsPort();
  const preferredAutomatorPort = process.env.WECHAT_AUTOMATOR_PORT
    ? readPortEnv("WECHAT_AUTOMATOR_PORT")
    : defaultAutomatorPort;
  const { miniProgram, automatorPort } = await launchMiniProgram(devtoolsPort, preferredAutomatorPort);
  const results = [];
  let cloudFunctionStubInstalled = false;

  try {
    if (mode === "smoke") {
      results.push(await runScenario("account-invalid-phone", () => runAccountInvalidPhoneSmoke(miniProgram)));
    } else {
      await installCloudFunctionStub(miniProgram);
      cloudFunctionStubInstalled = true;

      const scenarios = [
        ["account-invalid-phone", () => runAccountInvalidPhoneSmoke(miniProgram)],
        ["pair-invalid-invite", () => runPairInvalidInviteSmoke(miniProgram)],
        ["today", () => inspectStaticPage(miniProgram, "/pages/today/index", "today", ["model.title", "syncStatus.state"])],
        ["write-ai-flow-no-post", () => inspectWriteFlow(miniProgram)],
        ["scribes", () => inspectStaticPage(miniProgram, "/pages/scribes/index", "scribes", ["model.scribes"])],
        ["wallet", () => inspectStaticPage(miniProgram, "/pages/wallet/index", "wallet", ["model.balanceText"])],
        ["mailbox", () => inspectStaticPage(miniProgram, "/pages/mailbox/index", "mailbox", ["model.letters"])],
        ["archive", () => inspectStaticPage(miniProgram, "/pages/archive/index", "archive", ["model.letters"])],
      ];

      for (const [name, run] of scenarios) {
        results.push(await runScenario(name, run));
      }
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          mode,
          devtoolsPort,
          automatorPort,
          results,
        },
        null,
        2,
      ),
    );
  } finally {
    await safeRestore(miniProgram, "redirectTo");
    if (cloudFunctionStubInstalled) {
      await safeRestoreCloudFunctionStub(miniProgram);
    }
    await safeRemoveStorage(miniProgram, storageKey);
    miniProgram.disconnect();
  }
}

async function runScenario(name, run) {
  process.stderr.write(`[miniprogram-devtools-automator] start ${name}\n`);
  const result = await withTimeoutRun(
    run,
    readPositiveIntegerEnv("WECHAT_AUTOMATOR_SCENARIO_TIMEOUT_MS", defaultScenarioTimeoutMs),
    `场景超时：${name}`,
  );
  process.stderr.write(`[miniprogram-devtools-automator] done ${name}\n`);
  return result;
}

async function launchMiniProgram(devtoolsPort, automatorPort) {
  const cliPath = process.env.WECHAT_DEVTOOLS_CLI || defaultCliPath;

  if (!fs.existsSync(cliPath)) {
    throw new Error(`未找到微信开发者工具 CLI：${cliPath}`);
  }

  if (process.env.WECHAT_AUTOMATOR_REUSE === "1") {
    const existing = await tryConnectAutomator(automatorPort);

    if (existing) {
      return {
        miniProgram: existing,
        automatorPort,
      };
    }
  }

  let selectedAutomatorPort = automatorPort;

  if (!(await canListen(selectedAutomatorPort))) {
    selectedAutomatorPort = await findAvailablePort(selectedAutomatorPort + 1);
  }

  await runDevtoolsAuto(cliPath, devtoolsPort, selectedAutomatorPort);

  const miniProgram = await connectAutomator(selectedAutomatorPort);
  await sleep(readPositiveIntegerEnv("WECHAT_AUTOMATOR_SETTLE_MS", 5_000));

  return {
    miniProgram,
    automatorPort: selectedAutomatorPort,
  };
}

async function runDevtoolsAuto(cliPath, devtoolsPort, automatorPort) {
  const args = [
    "--port",
    String(devtoolsPort),
    "--lang",
    "zh",
    "auto",
    "--project",
    projectPath,
    "--auto-port",
    String(automatorPort),
    "--trust-project",
  ];

  try {
    await execFile(cliPath, args, {
      timeout: readPositiveIntegerEnv("WECHAT_DEVTOOLS_CLI_TIMEOUT_MS", defaultTimeoutMs),
      maxBuffer: 1024 * 1024,
    });
  } catch (error) {
    const output = [error.stdout, error.stderr].filter(Boolean).join("\n").trim();
    const detail = output.length > 0 ? `\n${output}` : "";

    throw new Error(`微信开发者工具自动化开启失败，端口 ${automatorPort}。${detail}`);
  }
}

async function tryConnectAutomator(automatorPort) {
  try {
    return await connectAutomator(automatorPort, defaultConnectAttemptTimeoutMs);
  } catch {
    return null;
  }
}

async function connectAutomator(automatorPort, timeoutMs = readPositiveIntegerEnv("WECHAT_AUTOMATOR_TIMEOUT_MS", defaultTimeoutMs)) {
  const wsEndpoint = `ws://127.0.0.1:${automatorPort}`;
  const deadline = Date.now() + timeoutMs;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      return await withTimeoutRun(
        () => automator.connect({ wsEndpoint }),
        defaultConnectAttemptTimeoutMs,
        `连接自动化端口失败：${wsEndpoint}`,
      );
    } catch (error) {
      lastError = error;
      await sleep(500);
    }
  }

  const suffix = lastError instanceof Error ? `：${lastError.message}` : "";
  throw new Error(`无法连接微信开发者工具自动化端口 ${wsEndpoint}${suffix}`);
}

async function runAccountInvalidPhoneSmoke(miniProgram) {
  await safeRemoveStorage(miniProgram, storageKey);

  const page = await relaunch(miniProgram, "/pages/account/index");
  const before = await page.data();
  await input(page, ".paper-input", "123");
  await tapButton(page, "使用兜底入口");
  await page.waitFor(500);

  const after = await page.data();
  assertEqual(after.devPhoneNumber, "123", "账号页应保留输入的测试手机号");
  assertEqual(after.errorText, "请填写 11 位中国大陆手机号。", "账号页应显示手机号校验错误");

  return {
    scenario: "account-invalid-phone",
    route: page.path,
    beforeStatus: before.statusText,
    inputValue: after.devPhoneNumber,
    errorText: after.errorText,
  };
}

async function runPairInvalidInviteSmoke(miniProgram) {
  await miniProgram.mockWxMethod("redirectTo", { errMsg: "redirectTo:ok" });

  const page = await relaunch(miniProgram, "/pages/pair/index");
  await input(page, ".paper-input", "12");
  await tapButton(page, "加入关系");
  await page.waitFor(500);

  const after = await page.data();
  assertEqual(after.joinCode, "12", "关系页应保留输入的邀请码");
  assertEqual(after.errorText, "请填写 6 位邀请码。", "关系页应显示邀请码校验错误");

  await safeRestore(miniProgram, "redirectTo");

  return {
    scenario: "pair-invalid-invite",
    route: page.path,
    inputValue: after.joinCode,
    errorText: after.errorText,
  };
}

async function inspectStaticPage(miniProgram, route, scenario, requiredPaths) {
  const page = await relaunch(miniProgram, route);
  const data = await page.data();

  for (const dataPath of requiredPaths) {
    const value = readPath(data, dataPath);
    assert(value !== undefined && value !== null, `${scenario} 缺少数据：${dataPath}`);
    if (Array.isArray(value)) {
      assert(value.length >= 0, `${scenario} 数据不是有效数组：${dataPath}`);
    }
  }

  return {
    scenario,
    route: page.path,
    title: readPath(data, "model.title") ?? null,
  };
}

async function inspectWriteFlow(miniProgram) {
  const page = await relaunch(miniProgram, "/pages/write/index");
  let data = await page.data();

  assertEqual(data.flow.step, "method", "写信页初始步骤应为 method");
  await tapButton(page, "下一步");
  await page.waitFor(200);

  data = await page.data();
  assertEqual(data.flow.step, "oral", "写信页应进入口述步骤");
  await input(page, ".oral-input", "今日试写一封平安批，只作自动化调试。");
  await page.waitFor(200);
  await tapButton(page, "下一步");
  await page.waitFor(200);

  data = await page.data();
  assertEqual(data.flow.step, "draft", "写信页应进入起稿步骤");
  await tapButton(page, "请先生起稿");

  data = await waitForPageData(
    page,
    (pageData) => pageData.flow.step === "revise" || pageData.flow.draftStatus === "failed",
    "写信页 AI 起稿应进入校改或受控失败状态",
  );
  assertEqual(data.flow.step, "revise", "写信页起稿后应进入校改步骤");
  assert(data.flow.draftText.length > 0, "先生起稿后应有 draftText");
  assertEqual(data.flow.draftSource, "ai", "写信页应使用 AI 起稿来源");
  await input(page, ".final-input", `${data.flow.draftText}\n自动化调试补记。`);
  await page.waitFor(200);
  await tapButton(page, "下一步");
  await page.waitFor(200);

  data = await page.data();
  assertEqual(data.flow.step, "post", "写信页应进入投寄核算步骤");
  assert(data.flow.canPost === true, "写信页定稿后应可进入本地投寄状态");

  return {
    scenario: "write-ai-flow-no-post",
    route: page.path,
    finalStep: data.flow.step,
    draftSource: data.flow.draftSource,
    canPost: data.flow.canPost,
    totalCostText: data.flow.totalCostText,
  };
}

async function installCloudFunctionStub(miniProgram) {
  await miniProgram.evaluate((draftText) => {
    const root = typeof globalThis === "object" && globalThis ? globalThis : {};

    if (!wx.cloud) {
      wx.cloud = {};
    }

    if (!root.__pinganpiOriginalCloudCallFunction) {
      root.__pinganpiOriginalCloudCallFunction =
        typeof wx.cloud.callFunction === "function"
          ? wx.cloud.callFunction.bind(wx.cloud)
          : async () => {
              throw new Error("wx.cloud.callFunction is unavailable");
            };
    }

    wx.cloud.callFunction = async (options) => {
      const name = options && options.name;
      const data = (options && options.data) || {};
      const action = data.action;

      if (name === "pinganpi-ai" && action === "scribeDraft") {
        return {
          result: {
            ok: true,
            action,
            data: {
              ok: true,
              scribeDraft: draftText,
              readAloudText: draftText,
              signature: "阿周",
              generationMeta: {
                engine: "devtools-stub",
                provider: "devtools",
                promptVersion: "devtools-flow",
              },
            },
          },
        };
      }

      if (name === "pinganpi-sync" && action === "health") {
        return {
          result: {
            ok: true,
            action,
            data: { ok: true },
          },
        };
      }

      return root.__pinganpiOriginalCloudCallFunction(options);
    };
  }, "兰卿：今日试写一封平安批，托先生先作一稿。");
}

async function relaunch(miniProgram, route) {
  process.stderr.write(`[miniprogram-devtools-automator] route ${route}\n`);
  const page = await miniProgram.reLaunch(route);

  if (!page) {
    throw new Error(`无法打开页面：${route}`);
  }

  await page.waitFor(800);
  return page;
}

async function input(page, selector, value) {
  const element = await page.$(selector);

  if (!element || typeof element.input !== "function") {
    throw new Error(`找不到可输入控件：${selector}`);
  }

  await element.input(value);
}

async function tapButton(page, textIncludes) {
  const buttons = await page.$$("button");

  for (const button of buttons) {
    const text = await button.text();

    if (text.includes(textIncludes)) {
      await button.tap();
      return;
    }
  }

  throw new Error(`找不到按钮：${textIncludes}`);
}

async function waitForPageData(page, predicate, message, timeoutMs = 8_000) {
  const deadline = Date.now() + timeoutMs;
  let lastData = null;

  while (Date.now() < deadline) {
    lastData = await page.data();

    if (predicate(lastData)) {
      return lastData;
    }

    await page.waitFor(200);
  }

  throw new Error(`${message}；最后数据：${JSON.stringify(lastData)}`);
}

function resolveDevtoolsPort() {
  if (process.env.WECHAT_DEVTOOLS_PORT) {
    return readPortEnv("WECHAT_DEVTOOLS_PORT");
  }

  const ideFiles = findIdeFiles(path.join(os.homedir(), "Library", "Application Support", "微信开发者工具"));
  const validFiles = ideFiles
    .map((file) => {
      const port = readPortFile(file);
      const stat = fs.statSync(file);

      return port === null ? null : { file, port, mtimeMs: stat.mtimeMs };
    })
    .filter(Boolean)
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  if (validFiles[0]) {
    return validFiles[0].port;
  }

  throw new Error(
    [
      "未找到微信开发者工具服务端口。",
      "请先打开微信开发者工具 -> 设置 -> 安全设置 -> 服务端口，并设置 WECHAT_DEVTOOLS_PORT=<端口>。",
    ].join(""),
  );
}

function findIdeFiles(root) {
  const result = [];

  if (!fs.existsSync(root)) {
    return result;
  }

  walk(root, 0);
  return result;

  function walk(current, depth) {
    if (depth > 5) {
      return;
    }

    let entries = [];

    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);

      if (entry.isFile() && entry.name === ".ide") {
        result.push(fullPath);
      } else if (entry.isDirectory()) {
        walk(fullPath, depth + 1);
      }
    }
  }
}

function readPortFile(file) {
  const value = fs.readFileSync(file, "utf8").trim();
  const port = Number(value);

  return Number.isInteger(port) && port > 0 ? port : null;
}

function readPortEnv(name, fallback) {
  return readPositiveIntegerEnv(name, fallback);
}

function readPositiveIntegerEnv(name, fallback) {
  const raw = process.env[name];

  if (!raw) {
    if (fallback === undefined) {
      throw new Error(`缺少环境变量：${name}`);
    }

    return fallback;
  }

  const port = Number(raw);

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`${name} 不是有效正整数：${raw}`);
  }

  return port;
}

function withTimeout(promise, timeoutMs, message) {
  return withTimeoutRun(() => promise, timeoutMs, message);
}

function withTimeoutRun(run, timeoutMs, message) {
  let timer;

  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${message}，超过 ${timeoutMs}ms`)), timeoutMs);
  });

  return Promise.race([Promise.resolve().then(run), timeout]).finally(() => clearTimeout(timer));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function findAvailablePort(startPort) {
  for (let port = startPort; port < startPort + 50; port += 1) {
    if (await canListen(port)) {
      return port;
    }
  }

  throw new Error(`无法找到可用自动化端口：${startPort}-${startPort + 49}`);
}

function canListen(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port);
  });
}

function readPath(value, dataPath) {
  return dataPath.split(".").reduce((current, key) => (current == null ? undefined : current[key]), value);
}

async function safeRemoveStorage(miniProgram, key) {
  try {
    await miniProgram.callWxMethod("removeStorageSync", key);
  } catch {
    // Storage cleanup is best-effort because older DevTools automation can disconnect during teardown.
  }
}

async function safeRestore(miniProgram, method) {
  try {
    await miniProgram.restoreWxMethod(method);
  } catch {
    // Method restoration is best-effort when the method was not mocked in the active scenario.
  }
}

async function safeRestoreCloudFunctionStub(miniProgram) {
  try {
    await miniProgram.evaluate(() => {
      const root = typeof globalThis === "object" && globalThis ? globalThis : {};

      if (root.__pinganpiOriginalCloudCallFunction && wx.cloud) {
        wx.cloud.callFunction = root.__pinganpiOriginalCloudCallFunction;
        delete root.__pinganpiOriginalCloudCallFunction;
      }
    });
  } catch {
    // Cloud function stubs are best-effort for DevTools flow isolation.
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}；实际值：${JSON.stringify(actual)}，期望值：${JSON.stringify(expected)}`);
  }
}

function fail(message, error) {
  console.error(`[miniprogram-devtools-automator] ${message}`);

  if (error && error.stack) {
    console.error(error.stack);
  }

  process.exit(1);
}
