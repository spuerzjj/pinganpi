import { createDefaultAppState, parseAppState, serializeAppState, type AppState } from "./app-state.js";

export const APP_STATE_STORAGE_KEY = "pinganpi.app-state.v1";

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface AppStateStore {
  load(): AppState;
  save(state: AppState): void;
  reset(): AppState;
}

export function createMemoryKeyValueStorage(): KeyValueStorage {
  const values = new Map<string, string>();

  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    }
  };
}

export function createAppStateStore(
  storage: KeyValueStorage,
  key: string = APP_STATE_STORAGE_KEY
): AppStateStore {
  return {
    load() {
      const raw = storage.getItem(key);

      if (raw === null) {
        return createDefaultAppState();
      }

      return parseAppState(raw) ?? createDefaultAppState();
    },
    save(state) {
      storage.setItem(key, serializeAppState(state));
    },
    reset() {
      const state = createDefaultAppState();
      storage.setItem(key, serializeAppState(state));
      return state;
    }
  };
}

export function createBrowserAppStateStore(key: string = APP_STATE_STORAGE_KEY): AppStateStore {
  if (typeof window === "undefined") {
    return createAppStateStore(createMemoryKeyValueStorage(), key);
  }

  return createAppStateStore(window.localStorage, key);
}
