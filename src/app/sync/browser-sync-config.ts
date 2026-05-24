import { APP_STATE_STORAGE_KEY, type KeyValueStorage } from "../app-state-storage.js";
import { currentMemberId } from "../mock-data.js";
import { createRemoteSnapshotStorageKey } from "./local-remote-adapter.js";
import { LOCAL_SYNC_STATE_STORAGE_KEY } from "./sync-state-storage.js";

export const DEFAULT_BROWSER_SYNC_HOUSEHOLD_ID = "household-main";
export const DEFAULT_BROWSER_SYNC_MEMBER_ID = currentMemberId;
export const BROWSER_DEVICE_ID_STORAGE_KEY = "pinganpi.browser-device-id.v1";

export interface BrowserSyncConfig {
  householdId: string;
  deviceId: string;
  memberId: string;
  appStateStorageKey: string;
  syncStateStorageKey: string;
  remoteSnapshotStorageKey: string;
}

export interface ResolveBrowserSyncConfigOptions {
  deviceIdGenerator?: () => string;
}

export type BrowserSyncLocation = string | URL | { href?: string; search?: string };

export function resolveBrowserSyncConfig(
  location: BrowserSyncLocation,
  storage: KeyValueStorage,
  options: ResolveBrowserSyncConfigOptions = {}
): BrowserSyncConfig {
  const params = new URLSearchParams(resolveSearch(location));
  const householdId = readParam(params, "household") ?? DEFAULT_BROWSER_SYNC_HOUSEHOLD_ID;
  const deviceId = readParam(params, "device") ?? resolvePersistedDeviceId(storage, options.deviceIdGenerator);
  const memberId = readParam(params, "member") ?? DEFAULT_BROWSER_SYNC_MEMBER_ID;
  const deviceNamespace = createDeviceNamespace({ householdId, deviceId, memberId });

  return {
    householdId,
    deviceId,
    memberId,
    appStateStorageKey: createAppStateStorageKey(deviceNamespace),
    syncStateStorageKey: createSyncStateStorageKey(deviceNamespace),
    remoteSnapshotStorageKey: createRemoteSnapshotStorageKey(householdId)
  };
}

export function createAppStateStorageKey(deviceId: string): string {
  return createNamespacedStorageKey(APP_STATE_STORAGE_KEY, deviceId);
}

export function createSyncStateStorageKey(deviceId: string): string {
  return createNamespacedStorageKey(LOCAL_SYNC_STATE_STORAGE_KEY, deviceId);
}

export function createDeviceNamespace(input: Pick<BrowserSyncConfig, "householdId" | "deviceId" | "memberId">): string {
  return [input.householdId, input.memberId, input.deviceId].map(encodeStorageNamespacePart).join(".");
}

function resolvePersistedDeviceId(storage: KeyValueStorage, deviceIdGenerator?: () => string): string {
  const storedDeviceId = normalizeStorageValue(storage.getItem(BROWSER_DEVICE_ID_STORAGE_KEY));

  if (storedDeviceId !== null) {
    return storedDeviceId;
  }

  const deviceId = deviceIdGenerator?.() ?? createBrowserDeviceId();
  storage.setItem(BROWSER_DEVICE_ID_STORAGE_KEY, deviceId);

  return deviceId;
}

function createNamespacedStorageKey(baseKey: string, namespace: string): string {
  return `${baseKey}.${namespace}`;
}

function encodeStorageNamespacePart(value: string): string {
  return encodeURIComponent(value);
}

function readParam(params: URLSearchParams, name: string): string | null {
  return normalizeStorageValue(params.get(name));
}

function normalizeStorageValue(value: string | null): string | null {
  const trimmed = value?.trim();

  return trimmed === undefined || trimmed.length === 0 ? null : trimmed;
}

function resolveSearch(location: BrowserSyncLocation): string {
  if (typeof location === "string") {
    return parseSearchFromString(location);
  }

  if (location instanceof URL) {
    return location.search;
  }

  if (typeof location.search === "string") {
    return location.search;
  }

  if (typeof location.href === "string") {
    return parseSearchFromString(location.href);
  }

  return "";
}

function parseSearchFromString(value: string): string {
  try {
    return new URL(value, "https://pinganpi.local").search;
  } catch {
    return value.startsWith("?") ? value : "";
  }
}

function createBrowserDeviceId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `device-${globalThis.crypto.randomUUID()}`;
  }

  if (typeof globalThis.crypto?.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);

    return `device-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  }

  throw new Error("Cannot generate browser sync device id without a secure random source");
}
