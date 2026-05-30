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
      cloudbaseEnvId: "cloud1-d6gg9pfb476fc78b4",
    });
  });

  it("keeps prd empty until the user creates the production environment", () => {
    expect(miniProgramEnvironments.prd.cloudbaseEnvId).toBe("");
  });

  it("returns a concrete env id for the active environment", () => {
    expect(getMiniProgramCloudbaseEnvId()).toBe("cloud1-d6gg9pfb476fc78b4");
  });
});
