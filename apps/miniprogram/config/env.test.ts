import { describe, expect, it } from "vitest";
import {
  getMiniProgramCloudbaseEnvId,
  getMiniProgramRuntimeConfig,
  miniProgramEnvironments,
} from "./env.js";

describe("miniprogram env config", () => {
  it("uses the current CloudBase environment as dev by default", () => {
    expect(getMiniProgramRuntimeConfig()).toEqual({
      envName: "dev",
      cloudbaseEnvId: "pinganpi-d7gml1f6sbcc172ea",
    });
  });

  it("keeps prd empty until the user creates the production environment", () => {
    expect(miniProgramEnvironments.prd.cloudbaseEnvId).toBe("");
  });

  it("returns a concrete env id for the active environment", () => {
    expect(getMiniProgramCloudbaseEnvId()).toBe("pinganpi-d7gml1f6sbcc172ea");
  });
});
