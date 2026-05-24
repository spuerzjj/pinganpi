export type MiniProgramEnvironmentName = "dev" | "prd";

export interface MiniProgramEnvironmentConfig {
  readonly cloudbaseEnvId: string;
}

export interface MiniProgramRuntimeConfig {
  readonly envName: MiniProgramEnvironmentName;
  readonly cloudbaseEnvId: string;
}

export const activeMiniProgramEnvironment: MiniProgramEnvironmentName = "dev";

export const miniProgramEnvironments: Record<
  MiniProgramEnvironmentName,
  MiniProgramEnvironmentConfig
> = {
  dev: {
    cloudbaseEnvId: "pinganpi-d7gml1f6sbcc172ea",
  },
  prd: {
    cloudbaseEnvId: "",
  },
};

export function getMiniProgramRuntimeConfig(): MiniProgramRuntimeConfig {
  const activeConfig = miniProgramEnvironments[activeMiniProgramEnvironment];

  if (!activeConfig.cloudbaseEnvId) {
    throw new Error(`missing CloudBase env id for ${activeMiniProgramEnvironment}`);
  }

  return {
    envName: activeMiniProgramEnvironment,
    cloudbaseEnvId: activeConfig.cloudbaseEnvId,
  };
}

export function getMiniProgramCloudbaseEnvId(): string {
  return getMiniProgramRuntimeConfig().cloudbaseEnvId;
}
