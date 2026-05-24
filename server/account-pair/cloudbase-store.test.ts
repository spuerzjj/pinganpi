import { describe, expect, it } from "vitest";
import type {
  PinganpiAccount,
  PinganpiHousehold,
  PinganpiInvite,
  PinganpiMember
} from "../../src/app/account/account-model.js";
import { createInMemoryAccountPairStore, type AccountPairStore } from "./account-pair-service.js";
import {
  createCloudBaseAccountPairStore,
  DEFAULT_ACCOUNT_COLLECTION,
  DEFAULT_HOUSEHOLD_COLLECTION,
  DEFAULT_INVITE_COLLECTION,
  DEFAULT_MEMBER_COLLECTION
} from "./cloudbase-store.js";

describe("cloudbase account pair store", () => {
  it("loads an empty account pair store from empty collections", async () => {
    const db = createFakeDb();
    const repository = createCloudBaseAccountPairStore(db);

    await expect(repository.loadStore()).resolves.toEqual(createInMemoryAccountPairStore());
  });

  it("saves schema versioned entities into the four default collections", async () => {
    const db = createFakeDb();
    const repository = createCloudBaseAccountPairStore(db);
    const store = createStore();

    await repository.saveStore(store);

    expect(db.readDocument(DEFAULT_ACCOUNT_COLLECTION, "account-a")).toEqual({
      schemaVersion: 1,
      ...store.accounts[0]
    });
    expect(db.readDocument(DEFAULT_HOUSEHOLD_COLLECTION, "household-a")).toEqual({
      schemaVersion: 1,
      ...store.households[0]
    });
    expect(db.readDocument(DEFAULT_MEMBER_COLLECTION, "member-a")).toEqual({
      schemaVersion: 1,
      ...store.members[0]
    });
    expect(db.readDocument(DEFAULT_INVITE_COLLECTION, "invite-a")).toEqual({
      schemaVersion: 1,
      ...store.invites[0]
    });
    expect(db.readDocument(DEFAULT_INVITE_COLLECTION, "invite-a")).not.toHaveProperty("code");
  });

  it("strips schema wrappers when loading stored entities", async () => {
    const db = createFakeDb();
    const store = createStore();
    db.writeDocument(DEFAULT_ACCOUNT_COLLECTION, "account-a", { schemaVersion: 1, ...store.accounts[0] });
    db.writeDocument(DEFAULT_HOUSEHOLD_COLLECTION, "household-a", { schemaVersion: 1, ...store.households[0] });
    db.writeDocument(DEFAULT_MEMBER_COLLECTION, "member-a", { schemaVersion: 1, ...store.members[0] });
    db.writeDocument(DEFAULT_INVITE_COLLECTION, "invite-a", { schemaVersion: 1, ...store.invites[0] });

    const repository = createCloudBaseAccountPairStore(db);

    await expect(repository.loadStore()).resolves.toEqual(store);
  });

  it("allows collection names to be overridden", async () => {
    const db = createFakeDb();
    const repository = createCloudBaseAccountPairStore(db, {
      accountCollection: "accounts_dev",
      householdCollection: "households_dev",
      memberCollection: "members_dev",
      inviteCollection: "invites_dev"
    });
    const store = createStore();

    await repository.saveStore(store);

    expect(db.readDocument("accounts_dev", "account-a")).toMatchObject({ accountId: "account-a" });
    expect(db.readDocument("households_dev", "household-a")).toMatchObject({ householdId: "household-a" });
    expect(db.readDocument("members_dev", "member-a")).toMatchObject({ memberId: "member-a" });
    expect(db.readDocument("invites_dev", "invite-a")).toMatchObject({ inviteId: "invite-a" });
  });
});

type StoredDocument = Record<string, unknown> & { schemaVersion: number };

interface FakeDb {
  collection(name: string): FakeCollection;
  readDocument(collectionName: string, id: string): StoredDocument | undefined;
  writeDocument(collectionName: string, id: string, document: StoredDocument): void;
}

interface FakeCollection {
  get(): Promise<{ data: StoredDocument[] }>;
  doc(id: string): FakeDoc;
}

interface FakeDoc {
  set(data: StoredDocument): Promise<{ updated: number }>;
}

function createFakeDb(): FakeDb {
  const documentsByCollection = new Map<string, Map<string, StoredDocument>>();

  return {
    collection(name) {
      return {
        async get() {
          return {
            data: Array.from(documentsByCollection.get(name)?.values() ?? [])
          };
        },
        doc(id) {
          return {
            async set(data) {
              getCollectionDocuments(documentsByCollection, name).set(id, data);
              return { updated: 1 };
            }
          };
        }
      };
    },
    readDocument(collectionName, id) {
      return documentsByCollection.get(collectionName)?.get(id);
    },
    writeDocument(collectionName, id, document) {
      getCollectionDocuments(documentsByCollection, collectionName).set(id, document);
    }
  };
}

function getCollectionDocuments(
  documentsByCollection: Map<string, Map<string, StoredDocument>>,
  name: string
): Map<string, StoredDocument> {
  const existing = documentsByCollection.get(name);

  if (existing !== undefined) {
    return existing;
  }

  const next = new Map<string, StoredDocument>();
  documentsByCollection.set(name, next);

  return next;
}

function createStore(): AccountPairStore {
  const account: PinganpiAccount = {
    accountId: "account-a",
    authUid: "uid-a",
    phoneNumber: "13800138000",
    status: "active",
    createdAtIso: "2026-05-24T08:00:00.000Z",
    lastLoginAtIso: "2026-05-24T08:00:00.000Z"
  };
  const household: PinganpiHousehold = {
    householdId: "household-a",
    status: "active",
    createdByAccountId: account.accountId,
    createdAtIso: "2026-05-24T08:00:00.000Z",
    updatedAtIso: "2026-05-24T08:00:00.000Z"
  };
  const member: PinganpiMember = {
    memberId: "member-a",
    householdId: household.householdId,
    accountId: account.accountId,
    role: "first",
    joinedAtIso: "2026-05-24T08:00:00.000Z",
    status: "active"
  };
  const invite: PinganpiInvite = {
    inviteId: "invite-a",
    householdId: household.householdId,
    createdByAccountId: account.accountId,
    codeHash: "hashed-code",
    expiresAtIso: "2026-05-25T08:00:00.000Z",
    usedAtIso: null,
    usedByAccountId: null,
    status: "active"
  };

  return {
    accounts: [account],
    households: [household],
    members: [member],
    invites: [invite]
  };
}
