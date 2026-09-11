import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { collection as cloudCollection, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../auth/AuthContext';
import { firebaseAuth, firestore } from '../lib/firebase';
import { createDemoData, createInitialData } from '../lib/seed';
import type { AppData, CollectionName, DataChange, SyncStatus } from '../types';
import { accountScope, collections, emptyData, LocalStore, type ServerVersion } from './persistence';
import { decodeDocument, syncPendingBatch } from './cloud';

interface DataContextValue {
  data: AppData;
  loading: boolean;
  error: string | null;
  syncStatus: SyncStatus;
  save(changes: DataChange[]): Promise<void>;
  remove(collection: CollectionName, id: string): Promise<void>;
  resetDemo(): Promise<void>;
}
const DataContext = createContext<DataContextValue | null>(null);
type DataActions = Pick<DataContextValue, 'save' | 'remove' | 'resetDemo'>;

function storageMessage(failure: unknown) {
  if (failure instanceof DOMException && failure.name === 'QuotaExceededError') return 'Spazio sul dispositivo esaurito. La modifica non è stata salvata: libera spazio e riprova.';
  return 'Non è stato possibile salvare sul dispositivo. La modifica non è confermata: controlla lo spazio e riprova.';
}
function cloudMessage(failure: unknown) {
  const code = failure && typeof failure === 'object' && 'code' in failure ? String(failure.code) : '';
  if (code.includes('permission-denied') || code.includes('unauthenticated')) return 'Dati conservati sul dispositivo. Accedi nuovamente; se il problema continua, contatta chi gestisce Kynlift.';
  if (failure instanceof Error && /non valid|mancante/.test(failure.message)) return 'Un dato del cloud non è valido e non è stato caricato. I dati sul dispositivo restano conservati.';
  return 'Dati conservati sul dispositivo. La sincronizzazione verrà ritentata automaticamente.';
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { user, isDemo } = useAuth();
  const scope = user ? accountScope(user.uid, isDemo) : null;
  // A new provider instance clears all visible memory before another account
  // renders, while each account's durable pending changes remain in IndexedDB.
  return <AccountDataProvider key={scope ?? 'signed-out'} scope={scope} uid={user?.uid ?? null} demo={isDemo}>{children}</AccountDataProvider>;
}

function AccountDataProvider({ children, scope, uid, demo }: { children: ReactNode; scope: string | null; uid: string | null; demo: boolean }) {
  const [data, setData] = useState<AppData>(emptyData);
  const [loading, setLoading] = useState(Boolean(scope));
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('local');
  const actions = useRef<DataActions | null>(null);

  useEffect(() => {
    if (!scope || !uid) { setLoading(false); return; }
    let alive = true;
    let store: LocalStore;
    let channel: BroadcastChannel | undefined;
    let sending = false;
    let cloudFailure: string | null = null;
    let localFailure: string | null = null;
    const firstServerRead = new Set<CollectionName>();
    const unsubscribers: (() => void)[] = [];
    let incoming = Promise.resolve();
    try { store = new LocalStore(); }
    catch (failure) { setError(storageMessage(failure)); setSyncStatus('error'); setLoading(false); return; }

    async function refresh() {
      const [{ data: next, initialized, invalidCount }, pending] = await Promise.all([store.load(scope!), store.pending(scope!)]);
      if (!alive) return;
      setData(next);
      setLoading(!demo && !initialized && navigator.onLine && !cloudFailure && firstServerRead.size !== collections.length);
      setError(localFailure ?? (invalidCount ? 'Alcuni dati sul dispositivo non sono validi e non vengono mostrati. Torna online per provare a recuperarli.' : cloudFailure));
      if (localFailure || invalidCount) setSyncStatus('error');
      else if (demo) setSyncStatus('local');
      else if (!navigator.onLine) setSyncStatus('offline');
      else if (cloudFailure) setSyncStatus('error');
      else if (pending.length || firstServerRead.size !== collections.length) setSyncStatus('pending');
      else setSyncStatus('synced');
    }
    function announce() { if (alive) channel?.postMessage('changed'); }
    async function flush() {
      if (sending || !alive || demo || !firestore || !navigator.onLine || firebaseAuth?.currentUser?.uid !== uid) return;
      sending = true;
      const send = async () => {
        while (alive && navigator.onLine && firebaseAuth?.currentUser?.uid === uid) {
          const pending = (await store.pending(scope!)).slice(0, 200);
          if (!pending.length || !alive || firebaseAuth?.currentUser?.uid !== uid) break;
          await syncPendingBatch(firestore!, store, scope!, uid!, pending, () => alive && firebaseAuth?.currentUser?.uid === uid);
          cloudFailure = null;
          if (alive) { await refresh(); announce(); }
        }
      };
      try {
        if (navigator.locks) await navigator.locks.request(`kinlift-sync:${scope}`, send);
        else await send();
      } catch (failure) { cloudFailure = cloudMessage(failure); }
      finally { sending = false; if (alive) await refresh().catch(localError); }
    }
    function localError(failure: unknown) {
      localFailure = storageMessage(failure);
      if (alive) { setError(localFailure); setSyncStatus('error'); setLoading(false); }
    }
    async function changed(action: () => Promise<void>) {
      try {
        await action();
        localFailure = null;
        await refresh(); announce();
        void flush();
      } catch (failure) { localError(failure); throw new Error(storageMessage(failure)); }
    }

    void (async () => {
      if (demo) await store.initialize(scope, createDemoData(), false);
      await refresh();
      if (!alive) return;
      actions.current = {
        save: (changes) => changed(() => store.save(scope, changes, !demo)),
        remove: (name, id) => changed(() => store.remove(scope, name, id, !demo)),
        resetDemo: () => {
          if (!demo) return Promise.reject(new Error('Il ripristino è disponibile soltanto in modalità demo.'));
          return changed(() => store.replaceDemo(createDemoData()));
        },
      };
      if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel(`kinlift:${scope}`);
        channel.onmessage = () => { void refresh().catch(localError); void flush(); };
      }
      if (demo || !firestore) return;
      for (const name of collections) {
        unsubscribers.push(onSnapshot(cloudCollection(firestore, 'users', uid, name), { includeMetadataChanges: true }, (snapshot) => {
          if (!alive || snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
          incoming = incoming.then(async () => {
            if (!alive) return;
            const decoded = snapshot.docs.map((document) => decodeDocument(document, name));
            const versions: Record<string, ServerVersion> = {};
            for (const item of decoded) if (item.version) versions[item.value.id] = item.version;
            await store.mergeRemote(scope, name, decoded.map((item) => item.value), versions);
            if (!alive) return;
            firstServerRead.add(name);
            if (firstServerRead.size === collections.length) await store.initialize(scope, createInitialData(), true);
            cloudFailure = null;
            await refresh(); announce();
            void flush();
          }).catch((failure) => { cloudFailure = cloudMessage(failure); if (alive) void refresh().catch(localError); });
        }, (failure) => {
          cloudFailure = cloudMessage(failure);
          if (alive) void refresh().catch(localError);
        }));
      }
      void flush();
    })().catch(localError);

    const connectionChanged = () => { void refresh().catch(localError); if (navigator.onLine) void flush(); };
    const resume = () => { if (document.visibilityState === 'visible') connectionChanged(); };
    window.addEventListener('online', connectionChanged);
    window.addEventListener('offline', connectionChanged);
    document.addEventListener('visibilitychange', resume);
    const retry = window.setInterval(() => { void flush(); }, 15_000);
    const firstReadTimeout = window.setTimeout(() => {
      if (alive && !demo && firstServerRead.size !== collections.length) {
        cloudFailure = 'Connessione al cloud non disponibile. I dati già presenti sul dispositivo restano utilizzabili; per la prima apertura dell’account serve Internet.';
        void refresh().catch(localError);
      }
    }, 12_000);
    return () => {
      alive = false; actions.current = null;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      channel?.close(); window.clearInterval(retry); window.clearTimeout(firstReadTimeout);
      window.removeEventListener('online', connectionChanged);
      window.removeEventListener('offline', connectionChanged);
      document.removeEventListener('visibilitychange', resume);
      // Do not close IDB here: a save started before logout must be allowed to
      // finish its transaction, and an in-flight cloud ack remains UID-scoped.
    };
  }, [scope, uid, demo]);

  function available() {
    if (!actions.current) throw new Error('Attendi il caricamento dei dati e riprova.');
    return actions.current;
  }
  const value: DataContextValue = {
    data, loading, error, syncStatus,
    save: async (changes) => available().save(changes),
    remove: async (name, id) => available().remove(name, id),
    resetDemo: async () => available().resetDemo(),
  };
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData richiede DataProvider.');
  return context;
}
