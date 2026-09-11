import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { AppData, CollectionName, DataChange } from '../types';
import { isStoredEntity } from './validation';
export { isStoredEntity } from './validation';

export const collections: CollectionName[] = ['exercises', 'routines', 'sessions', 'sets'];
export const emptyData = (): AppData => ({ exercises: [], routines: [], sessions: [], sets: [] });
type AnyEntity = AppData[CollectionName][number];
export interface ServerVersion { seconds: number; nanoseconds: number }
interface StoredDocument {
  key: string; scope: string; collection: CollectionName; value: AnyEntity;
  clientId?: string; sequence?: number; serverVersion?: ServerVersion; serverApplied?: boolean; serverValue?: AnyEntity;
}
export interface PendingDocument extends StoredDocument { revision: string; clientId: string; sequence: number }
interface KinDatabase extends DBSchema {
  documents: { key: string; value: StoredDocument; indexes: { scope: string } };
  outbox: { key: string; value: PendingDocument; indexes: { scope: string } };
  metadata: { key: string; value: { scope: string; initialized: boolean; clientId?: string } };
}
const docKey = (scope: string, collection: CollectionName, id: string) => JSON.stringify([scope, collection, id]);
export const accountScope = (uid: string, demo: boolean) => demo ? 'demo' : `user:${uid}`;
function compareVersion(a: ServerVersion, b: ServerVersion) { return a.seconds - b.seconds || a.nanoseconds - b.nanoseconds; }

/** Device durability is independent of Firebase. Never erase another account
 * on logout, and never clear an unacknowledged revision on a stale server ack. */
export class LocalStore {
  private db: Promise<IDBPDatabase<KinDatabase>>;
  constructor(name = 'kinlift-v1') {
    this.db = openDB<KinDatabase>(name, 1, {
      upgrade(db) {
        db.createObjectStore('documents', { keyPath: 'key' }).createIndex('scope', 'scope');
        db.createObjectStore('outbox', { keyPath: 'key' }).createIndex('scope', 'scope');
        db.createObjectStore('metadata', { keyPath: 'scope' });
      },
    });
  }

  async load(scope: string): Promise<{ data: AppData; initialized: boolean; invalidCount: number }> {
    const db = await this.db;
    const tx = db.transaction(['documents', 'metadata'], 'readonly');
    const [documents, metadata] = await Promise.all([
      tx.objectStore('documents').index('scope').getAll(scope),
      tx.objectStore('metadata').get(scope),
    ]);
    await tx.done;
    const data = emptyData();
    let invalidCount = 0;
    for (const row of documents) {
      if (!isStoredEntity(row.value, row.value.id, row.collection)) { invalidCount++; continue; }
      if (row.value.deletedAt == null) (data[row.collection] as AnyEntity[]).push(row.value);
    }
    return { data, initialized: metadata?.initialized ?? false, invalidCount };
  }

  async save(scope: string, changes: DataChange[], sync = true): Promise<void> {
    for (const change of changes) {
      if (!change.value.id || change.value.id.includes('/')) throw new Error('Identificatore del dato non valido.');
    }
    const db = await this.db;
    const tx = db.transaction(['documents', 'outbox', 'metadata'], 'readwrite', { durability: 'strict' });
    try {
      const metadata = await tx.objectStore('metadata').get(scope);
      const clientId = metadata?.clientId ?? crypto.randomUUID();
      await tx.objectStore('metadata').put({ scope, initialized: metadata?.initialized ?? false, clientId });
      for (const change of changes) {
        const key = docKey(scope, change.collection, change.value.id);
        const previous = await tx.objectStore('documents').get(key);
        const value = { ...change.value, updatedAt: Math.max(Date.now(), change.value.updatedAt, (previous?.value.updatedAt ?? 0) + 1) };
        const row = { ...previous, key, scope, collection: change.collection, value, clientId, sequence: (previous?.sequence ?? 0) + 1 };
        await tx.objectStore('documents').put(row);
        if (sync) await tx.objectStore('outbox').put({ ...row, revision: crypto.randomUUID() });
      }
      await tx.done;
    } catch (failure) {
      // Synchronous structured-clone failures do not necessarily abort IDB.
      // Explicitly roll back the entire workout+set commit before rejecting.
      try { tx.abort(); } catch { /* The failed request may already have aborted. */ }
      await tx.done.catch(() => undefined);
      throw failure;
    }
  }

  async remove(scope: string, collection: CollectionName, id: string, sync = true): Promise<void> {
    const db = await this.db;
    const tx = db.transaction(['documents', 'outbox', 'metadata'], 'readwrite', { durability: 'strict' });
    const key = docKey(scope, collection, id);
    const previous = await tx.objectStore('documents').get(key);
    if (previous) {
      const metadata = await tx.objectStore('metadata').get(scope);
      const clientId = metadata?.clientId ?? crypto.randomUUID();
      await tx.objectStore('metadata').put({ scope, initialized: metadata?.initialized ?? false, clientId });
      const timestamp = Math.max(Date.now(), previous.value.updatedAt + 1);
      const row = { ...previous, clientId, sequence: (previous.sequence ?? 0) + 1, value: { ...previous.value, deletedAt: timestamp, updatedAt: timestamp } };
      await tx.objectStore('documents').put(row);
      if (sync) await tx.objectStore('outbox').put({ ...row, revision: crypto.randomUUID() });
    }
    await tx.done;
  }

  async pending(scope: string): Promise<PendingDocument[]> {
    const tx = (await this.db).transaction(['outbox', 'documents', 'metadata'], 'readwrite');
    const rows = await tx.objectStore('outbox').index('scope').getAll(scope);
    const metadata = await tx.objectStore('metadata').get(scope);
    const clientId = metadata?.clientId ?? crypto.randomUUID();
    if (rows.length && !metadata?.clientId) await tx.objectStore('metadata').put({ scope, initialized: metadata?.initialized ?? false, clientId });
    for (const row of rows) if (!row.clientId || !row.sequence) {
      row.clientId = clientId; row.sequence = 1;
      await tx.objectStore('outbox').put(row);
      const stored = await tx.objectStore('documents').get(row.key);
      if (stored) await tx.objectStore('documents').put({ ...stored, clientId, sequence: row.sequence });
    }
    await tx.done;
    return rows;
  }

  async acknowledge(scope: string, entries: Pick<PendingDocument, 'key' | 'revision'>[]): Promise<void> {
    const tx = (await this.db).transaction(['outbox', 'documents'], 'readwrite', { durability: 'strict' });
    for (const entry of entries) {
      const current = await tx.objectStore('outbox').get(entry.key);
      if (current?.scope === scope && current.revision === entry.revision) {
        await tx.objectStore('outbox').delete(entry.key);
        const stored = await tx.objectStore('documents').get(entry.key);
        if (stored?.serverValue) {
          const { serverValue, ...row } = stored;
          await tx.objectStore('documents').put({ ...row, value: serverValue, serverApplied: true });
        }
      }
    }
    await tx.done;
  }

  async mergeRemote(scope: string, collection: CollectionName, values: AnyEntity[], versions: Record<string, ServerVersion> = {}): Promise<void> {
    const tx = (await this.db).transaction(['documents', 'outbox'], 'readwrite', { durability: 'strict' });
    for (const value of values) {
      const key = docKey(scope, collection, value.id);
      const pending = await tx.objectStore('outbox').get(key);
      const current = await tx.objectStore('documents').get(key);
      const serverVersion = versions[value.id];
      // Only the server commit order is authoritative. A phone clock can be
      // hours ahead or behind and must never suppress another device's edits.
      if (current?.serverVersion && (!serverVersion || compareVersion(serverVersion, current.serverVersion) < 0)) continue;
      const equalVersion = serverVersion && current?.serverVersion && compareVersion(serverVersion, current.serverVersion) === 0;
      if (pending) {
        if (current && serverVersion && (!equalVersion || !current.serverValue)) {
          await tx.objectStore('documents').put({ ...current, serverVersion, serverValue: value, serverApplied: false });
        }
        continue;
      }
      if (equalVersion && current?.serverApplied) continue;
      const { serverValue: _pendingServerValue, ...previous } = current ?? {};
      await tx.objectStore('documents').put({ ...previous, key, scope, collection, value, ...(serverVersion ? { serverVersion } : {}), serverApplied: true });
    }
    await tx.done;
  }

  /** Run only after the first complete server read (or immediately in demo).
   * An existing cloud dataset is never replaced with starter content. */
  async initialize(scope: string, seed: AppData, sync: boolean): Promise<void> {
    const tx = (await this.db).transaction(['documents', 'outbox', 'metadata'], 'readwrite', { durability: 'strict' });
    const metadata = await tx.objectStore('metadata').get(scope);
    if (!metadata?.initialized) {
      const clientId = metadata?.clientId ?? crypto.randomUUID();
      const existing = await tx.objectStore('documents').index('scope').count(scope);
      if (existing === 0) {
        for (const collection of collections) for (const value of seed[collection]) {
          const row = { key: docKey(scope, collection, value.id), scope, collection, value, clientId, sequence: 1 };
          await tx.objectStore('documents').put(row);
          if (sync) await tx.objectStore('outbox').put({ ...row, revision: crypto.randomUUID() });
        }
      }
      await tx.objectStore('metadata').put({ scope, initialized: true, clientId });
    }
    await tx.done;
  }

  async replaceDemo(seed: AppData): Promise<void> {
    const scope = accountScope('demo', true);
    const tx = (await this.db).transaction(['documents', 'outbox', 'metadata'], 'readwrite', { durability: 'strict' });
    for (const name of ['documents', 'outbox'] as const) {
      const keys = await tx.objectStore(name).index('scope').getAllKeys(scope);
      for (const key of keys) await tx.objectStore(name).delete(key);
    }
    for (const collection of collections) for (const value of seed[collection]) {
      await tx.objectStore('documents').put({ key: docKey(scope, collection, value.id), scope, collection, value });
    }
    await tx.objectStore('metadata').put({ scope, initialized: true });
    await tx.done;
  }

  async close() { (await this.db).close(); }
}
