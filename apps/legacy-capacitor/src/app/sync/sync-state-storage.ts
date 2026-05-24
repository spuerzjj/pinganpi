import { createMemoryKeyValueStorage, type KeyValueStorage } from "../app-state-storage.js";
import {
  createDefaultLocalSyncState,
  parseLocalSyncState,
  serializeLocalSyncState,
  type CreateDefaultLocalSyncStateInput,
  type LocalSyncState
} from "./sync-state.js";

export const LOCAL_SYNC_STATE_STORAGE_KEY = "pinganpi.sync-state.v1";

export interface LocalSyncStateStore {
  load(): LocalSyncState;
  save(state: LocalSyncState): void;
  reset(input?: CreateDefaultLocalSyncStateInput): LocalSyncState;
}

export function createLocalSyncStateStore(
  storage: KeyValueStorage,
  fallbackInput: CreateDefaultLocalSyncStateInput,
  key: string = LOCAL_SYNC_STATE_STORAGE_KEY
): LocalSyncStateStore {
  return {
    load() {
      const raw = storage.getItem(key);

      if (raw === null) {
        const state = createDefaultLocalSyncState(fallbackInput);
        storage.setItem(key, serializeLocalSyncState(state));
        return state;
      }

      const state = parseLocalSyncState(raw, fallbackInput);

      if (serializeLocalSyncState(state) !== raw) {
        storage.setItem(key, serializeLocalSyncState(state));
      }

      return state;
    },
    save(state) {
      storage.setItem(key, serializeLocalSyncState(state));
    },
    reset(input = fallbackInput) {
      const state = createDefaultLocalSyncState(input);
      storage.setItem(key, serializeLocalSyncState(state));
      return state;
    }
  };
}

export function createBrowserLocalSyncStateStore(
  fallbackInput: CreateDefaultLocalSyncStateInput,
  key: string = LOCAL_SYNC_STATE_STORAGE_KEY
): LocalSyncStateStore {
  if (typeof window === "undefined") {
    return createLocalSyncStateStore(createMemoryKeyValueStorage(), fallbackInput, key);
  }

  return createLocalSyncStateStore(window.localStorage, fallbackInput, key);
}
