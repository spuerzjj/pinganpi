import { spawnSync } from "node:child_process";

const defaultEnvId = "pinganpi-d7gml1f6sbcc172ea";
const defaultFunctionNames = ["ai-scribe-proxy", "sync-proxy"];

export interface FunctionEnvAudit {
  key: string;
  value: string;
}

export interface FunctionAudit {
  name: string;
  runtime: string;
  status: string;
  availableStatus: string;
  role: string;
  type: string;
  publicNetStatus: string;
  triggerCount: number;
  vpcConfigured: boolean;
  env: FunctionEnvAudit[];
}

export interface UsageAudit {
  envId: string;
  billingCycle: string;
  totalCredits: number;
  usedCredits: number;
  modules: Array<{
    moduleName: string;
    creditsValue: number;
  }>;
}

export function createFunctionAudit(value: unknown): FunctionAudit {
  const data = readDataRecord(value);
  const envVariables = readRecordArray(readRecord(data.Environment).Variables);
  const publicNetConfig = readRecord(data.PublicNetConfig);
  const vpcConfig = readRecord(data.VpcConfig);

  return {
    name: readString(data.FunctionName),
    runtime: readString(data.Runtime),
    status: readString(data.Status),
    availableStatus: readString(data.AvailableStatus),
    role: readString(data.Role),
    type: readString(data.Type),
    publicNetStatus: readString(publicNetConfig.PublicNetStatus),
    triggerCount: readRecordArray(data.Triggers).length,
    vpcConfigured: readString(vpcConfig.VpcId).length > 0 || readString(vpcConfig.SubnetId).length > 0,
    env: envVariables
      .map((entry) => ({
        key: readString(entry.Key),
        value: redactEnvValue(readString(entry.Key), typeof entry.Value === "string" ? entry.Value : undefined)
      }))
      .filter((entry) => entry.key.length > 0)
  };
}

export function createUsageAudit(value: unknown): UsageAudit {
  const data = readDataRecord(value);
  const billingCycle = readRecord(data.billingCycle);
  const summary = readRecord(data.summary);

  return {
    envId: readString(data.envId),
    billingCycle: `${readString(billingCycle.startDate)} ~ ${readString(billingCycle.endDate)}`,
    totalCredits: readNumber(summary.totalCredits),
    usedCredits: readNumber(summary.usedCredits),
    modules: readRecordArray(data.usages).map((usage) => ({
      moduleName: readString(usage.moduleName),
      creditsValue: readNumber(usage.creditsValue)
    }))
  };
}

export function redactEnvValue(key: string, value: string | undefined): string {
  if (value === undefined || value.trim().length === 0) {
    return "<empty>";
  }

  if (isSensitiveEnvKey(key)) {
    return "<redacted>";
  }

  return value;
}

export function extractJsonObject(output: string): unknown {
  const start = output.indexOf("{");
  const end = output.lastIndexOf("}");

  if (start < 0 || end < start) {
    throw new Error("CloudBase CLI did not return JSON");
  }

  return JSON.parse(output.slice(start, end + 1)) as unknown;
}

async function main(): Promise<void> {
  const envId = process.env.CLOUDBASE_ENV_ID?.trim() || defaultEnvId;
  const usage = createUsageAudit(runCloudBaseJson(["env", "usage", "--json", "--yes"], envId));
  const functions = defaultFunctionNames.map((name) =>
    createFunctionAudit(runCloudBaseJson(["fn", "detail", name, "--json", "--yes"], envId))
  );

  printAudit({ envId, usage, functions });
}

function printAudit(input: { envId: string; usage: UsageAudit; functions: FunctionAudit[] }): void {
  console.log(`Stage 19 CloudBase audit`);
  console.log(`Environment: ${input.envId}`);
  console.log(`Billing cycle: ${input.usage.billingCycle}`);
  console.log(`Credits: ${input.usage.usedCredits} / ${input.usage.totalCredits}`);
  console.log("Usage modules:");

  for (const usage of input.usage.modules) {
    if (usage.creditsValue > 0) {
      console.log(`- ${usage.moduleName}: ${usage.creditsValue}`);
    }
  }

  console.log("Functions:");

  for (const fn of input.functions) {
    console.log(`- ${fn.name}: ${fn.status} / ${fn.availableStatus}, runtime=${fn.runtime}, role=${fn.role}, type=${fn.type}`);
    console.log(`  publicNet=${fn.publicNetStatus}, triggers=${fn.triggerCount}, vpcConfigured=${fn.vpcConfigured ? "yes" : "no"}`);
    console.log(`  env=${fn.env.map((entry) => `${entry.key}=${entry.value}`).join(", ")}`);
  }
}

function runCloudBaseJson(args: string[], envId: string): unknown {
  const result = spawnSync("npx", ["cloudbase", ...args], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      CLOUDBASE_ENV_ID: envId
    },
    encoding: "utf8"
  });

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || "CloudBase CLI command failed");
  }

  return extractJsonObject(result.stdout);
}

function isSensitiveEnvKey(key: string): boolean {
  return /(?:API_KEY|SECRET|PASSWORD|MEMBER_TOKENS|ACCESS_TOKEN|REFRESH_TOKEN|AUTH_TOKEN|SYNC_TOKEN|PRIVATE_KEY|B64)/i.test(key);
}

function readDataRecord(value: unknown): Record<string, unknown> {
  return readRecord(readRecord(value).data);
}

function readRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readRecordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.map(readRecord) : [];
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
