import { doc, getDocFromServer, runTransaction, serverTimestamp, type DocumentSnapshot, type Firestore } from 'firebase/firestore';
import type { AppData, CollectionName } from '../types';
import { collections, isStoredEntity, type LocalStore, type PendingDocument, type ServerVersion } from './persistence';

export function decodeDocument(snapshot: DocumentSnapshot, collection: CollectionName) {
  const raw = snapshot.data();
  if (!raw) throw new Error('Documento remoto mancante.');
  const { _sync, ...value } = raw;
  if (!isStoredEntity(value, snapshot.id, collection)) throw new Error('Il documento remoto contiene dati non validi.');
  let version: ServerVersion | undefined;
  if (_sync !== undefined) {
    if (!_sync || typeof _sync.revision !== 'string' || typeof _sync.clientId !== 'string' || !Number.isSafeInteger(_sync.sequence) || _sync.sequence <= 0
      || !Number.isSafeInteger(_sync.committedAt?.seconds) || !Number.isInteger(_sync.committedAt?.nanoseconds)
      || _sync.committedAt.nanoseconds < 0 || _sync.committedAt.nanoseconds >= 1_000_000_000
      || (_sync.cursors !== undefined && (!_sync.cursors || typeof _sync.cursors !== 'object' || Array.isArray(_sync.cursors)
        || !Object.values(_sync.cursors).every((sequence) => typeof sequence === 'number' && Number.isSafeInteger(sequence) && sequence > 0)))) {
      throw new Error('Metadati di sincronizzazione non validi.');
    }
    version = { seconds: _sync.committedAt.seconds, nanoseconds: _sync.committedAt.nanoseconds };
  }
  return { value, version };
}

/** Browser clocks never resolve a cloud conflict. Server transactions reject an
 * older send from the same installation, including tabs without Web Locks. */
export async function syncPendingBatch(database: Firestore, store: LocalStore, scope: string, uid: string, pending: PendingDocument[], isCurrent = () => true) {
  const refs = pending.map((item) => doc(database, 'users', uid, item.collection, item.value.id));
  await runTransaction(database, async (transaction) => {
    const snapshots = await Promise.all(refs.map((ref) => transaction.get(ref)));
    if (!isCurrent()) throw new Error('La sessione di accesso è cambiata.');
    for (const [index, item] of pending.entries()) {
      const current = snapshots[index].data()?._sync;
      const cursors: Record<string, number> = {};
      if (current?.cursors && typeof current.cursors === 'object') {
        for (const [client, sequence] of Object.entries(current.cursors)) {
          if (typeof sequence === 'number' && Number.isSafeInteger(sequence) && sequence > 0) cursors[client] = sequence;
        }
      }
      if (typeof current?.clientId === 'string' && Number.isSafeInteger(current.sequence)) cursors[current.clientId] = Math.max(cursors[current.clientId] ?? 0, current.sequence);
      // Keep each installation's acknowledged sequence even when a different
      // device becomes the last writer. Retrying an ack lost before logout must
      // not overwrite a later edit from that other device.
      if ((cursors[item.clientId] ?? 0) >= item.sequence) continue;
      cursors[item.clientId] = item.sequence;
      transaction.set(refs[index], {
        ...item.value,
        _sync: { revision: item.revision, clientId: item.clientId, sequence: item.sequence, cursors, committedAt: serverTimestamp() },
      });
    }
  });

  // Read after commit establishes an authoritative server version before the
  // outbox is cleared. A dropped connection leaves the revision safely queued.
  const confirmed = await Promise.all(refs.map((ref) => getDocFromServer(ref)));
  const decoded = confirmed.map((snapshot, index) => ({ collection: pending[index].collection, ...decodeDocument(snapshot, pending[index].collection) }));
  const apply = async () => {
    for (const collection of collections) {
      const rows = decoded.filter((item) => item.collection === collection);
      if (!rows.length) continue;
      const versions: Record<string, ServerVersion> = {};
      for (const row of rows) if (row.version) versions[row.value.id] = row.version;
      await store.mergeRemote(scope, collection, rows.map((row) => row.value) as AppData[CollectionName][number][], versions);
    }
  };
  await apply(); // retain the local value while recording the confirmed version
  await store.acknowledge(scope, pending);
  await apply(); // accept a server winner only when no newer local edit is queued
}
