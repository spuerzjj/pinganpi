import type {
  PinganpiAccount,
  PinganpiHousehold,
  PinganpiInvite,
  PinganpiMember
} from "../../src/app/account/account-model.js";
import type { AccountPairStore } from "./account-pair-service.js";

export const DEFAULT_ACCOUNT_COLLECTION = "pinganpi_accounts";
export const DEFAULT_HOUSEHOLD_COLLECTION = "pinganpi_households";
export const DEFAULT_MEMBER_COLLECTION = "pinganpi_members";
export const DEFAULT_INVITE_COLLECTION = "pinganpi_invites";

export interface AccountPairRepository {
  loadStore(): Promise<AccountPairStore>;
  saveStore(store: AccountPairStore): Promise<void>;
}

export interface CloudBaseAccountPairStoreOptions {
  accountCollection?: string;
  householdCollection?: string;
  memberCollection?: string;
  inviteCollection?: string;
}

interface CloudBaseDatabase {
  collection(name: string): CloudBaseCollection;
}

interface CloudBaseCollection {
  get(): Promise<{ data?: unknown }>;
  doc(id: string): CloudBaseDocumentReference;
}

interface CloudBaseDocumentReference {
  set(data: SchemaWrappedDocument): Promise<unknown>;
}

type SchemaWrappedDocument = Record<string, unknown> & { schemaVersion: 1 };

export function createCloudBaseAccountPairStore(
  db: CloudBaseDatabase,
  options: CloudBaseAccountPairStoreOptions = {}
): AccountPairRepository {
  const collectionNames = {
    accounts: options.accountCollection ?? DEFAULT_ACCOUNT_COLLECTION,
    households: options.householdCollection ?? DEFAULT_HOUSEHOLD_COLLECTION,
    members: options.memberCollection ?? DEFAULT_MEMBER_COLLECTION,
    invites: options.inviteCollection ?? DEFAULT_INVITE_COLLECTION
  };

  return {
    async loadStore() {
      return {
        accounts: await loadEntities<PinganpiAccount>(db.collection(collectionNames.accounts)),
        households: await loadEntities<PinganpiHousehold>(db.collection(collectionNames.households)),
        members: await loadEntities<PinganpiMember>(db.collection(collectionNames.members)),
        invites: await loadEntities<PinganpiInvite>(db.collection(collectionNames.invites))
      };
    },
    async saveStore(store) {
      await Promise.all([
        saveEntities(db.collection(collectionNames.accounts), store.accounts, (account) => account.accountId),
        saveEntities(
          db.collection(collectionNames.households),
          store.households,
          (household) => household.householdId
        ),
        saveEntities(db.collection(collectionNames.members), store.members, (member) => member.memberId),
        saveEntities(db.collection(collectionNames.invites), store.invites, (invite) => invite.inviteId)
      ]);
    }
  };
}

async function loadEntities<TEntity>(collection: CloudBaseCollection): Promise<TEntity[]> {
  const result = await collection.get();
  const data = Array.isArray(result.data) ? result.data : [];

  return data.flatMap((document) => {
    const entity = unwrapSchemaDocument<TEntity>(document);

    return entity === null ? [] : [entity];
  });
}

async function saveEntities<TEntity extends object>(
  collection: CloudBaseCollection,
  entities: TEntity[],
  readId: (entity: TEntity) => string
): Promise<void> {
  await Promise.all(
    entities.map((entity) => {
      const document = wrapSchemaDocument(entity);

      return collection.doc(readId(entity)).set(document);
    })
  );
}

function wrapSchemaDocument<TEntity extends object>(entity: TEntity): SchemaWrappedDocument {
  return {
    schemaVersion: 1,
    ...(deepClone(entity) as Record<string, unknown>)
  };
}

function unwrapSchemaDocument<TEntity>(value: unknown): TEntity | null {
  if (!isRecord(value) || value.schemaVersion !== 1) {
    return null;
  }

  const { schemaVersion: _schemaVersion, _id: _cloudBaseId, ...entity } = value;

  return deepClone(entity) as TEntity;
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
