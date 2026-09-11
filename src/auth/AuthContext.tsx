import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  createUserWithEmailAndPassword, EmailAuthProvider, getRedirectResult,
  GoogleAuthProvider, linkWithCredential, linkWithRedirect, onAuthStateChanged,
  sendPasswordResetEmail, signInWithEmailAndPassword, signInWithRedirect,
  signOut as firebaseSignOut, updateProfile,
} from 'firebase/auth';
import { doc, onSnapshot, runTransaction, serverTimestamp, Timestamp } from 'firebase/firestore';
import { assertRedirectConfiguration, authPersistenceReady, firebaseAuth, firebaseConfigured, firestore } from '../lib/firebase';
import type { KinUser } from '../types';
import { cacheAccountProfile, cachedAccountProfile, readAccountProfile, toKinUser, validateAccountProfile, type AccountProfile } from './profile';
import { AuthContext, type AuthContextValue } from './context';
export { useAuth } from './context';

const DEMO_KEY = 'kinlift:demo';
const demoUser: KinUser = { uid: 'demo', displayName: 'Arnold Schwarzenegger', photoURL: null, email: null, providers: [] };
function inDemo() { try { return sessionStorage.getItem(DEMO_KEY) === 'true'; } catch { return false; } }
function storeDemo(value: boolean) { try { value ? sessionStorage.setItem(DEMO_KEY, 'true') : sessionStorage.removeItem(DEMO_KEY); } catch { /* In-memory demo still works. */ } }
function openTraining() {
  history.replaceState({ ...history.state, kinliftIndex: Number(history.state?.kinliftIndex ?? 0) }, '', '/allenamento');
  // Firebase can publish its auth state before the sign-in promise resolves.
  // Notify an already-mounted router as well as setting the initial route.
  window.dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
  window.scrollTo(0, 0);
}
export function authMessage(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  const messages: Record<string, string> = {
    'auth/invalid-credential': 'Email o password non corretti. Riprova oppure reimposta la password.',
    'auth/invalid-email': 'Controlla l’indirizzo email.',
    'auth/email-already-in-use': 'Questa email ha già un account. Accedi con il metodo esistente e collega l’altro dalle impostazioni.',
    'auth/weak-password': 'Usa una password di almeno 6 caratteri.',
    'auth/too-many-requests': 'Troppi tentativi. Aspetta qualche minuto e riprova.',
    'auth/network-request-failed': 'Connessione assente. Per accedere serve una connessione Internet.',
    'auth/credential-already-in-use': 'Questo metodo è già collegato a un altro account. Accedi a quell’account: gli storici non vengono uniti automaticamente.',
    'auth/account-exists-with-different-credential': 'Esiste già un account con questa email. Accedi con il metodo originale e collega Google dalle impostazioni.',
    'auth/provider-already-linked': 'Questo metodo di accesso è già collegato.',
    'auth/requires-recent-login': 'Per questa modifica esci e accedi nuovamente, poi riprova. I dati sul dispositivo resteranno conservati.',
    'auth/unauthorized-domain': 'Il dominio di Kynlift deve essere autorizzato nella configurazione Firebase.',
    'auth/operation-not-allowed': 'Questo metodo di accesso deve essere abilitato nella console Firebase.',
    'auth/user-disabled': 'Questo account è stato disabilitato.',
    'unavailable': 'Connessione assente. Per salvare il profilo torna online e riprova.',
    'permission-denied': 'Il server non ha autorizzato il salvataggio del profilo. Le modifiche sono ancora qui: contatta chi gestisce Kynlift.',
  };
  return messages[code] ?? (code ? 'Accesso non riuscito. Riprova tra poco.' : error instanceof Error ? error.message : 'Accesso non riuscito. Riprova.');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isDemo, setIsDemo] = useState(inDemo);
  // Keep Auth data separate: refreshing/linking Google must preserve the saved profile.
  const [baseUser, setUser] = useState<KinUser | null>(() => inDemo() ? demoUser : null);
  const [ready, setReady] = useState(!firebaseConfigured || inDemo());
  const [error, setError] = useState<string | null>(null);
  const uid = baseUser?.uid ?? null;
  const scope = uid ? (isDemo ? 'demo' : `user:${uid}`) : null;
  const [profileState, setProfileState] = useState<{ scope: string; profile: AccountProfile | null } | null>(null);
  const profile = scope ? (profileState?.scope === scope ? profileState.profile : cachedAccountProfile(scope)) : null;
  const user = baseUser ? { ...baseUser, ...profile } : null;
  const listenerEpoch = useRef(0);
  const savingProfile = useRef(false);
  const profileWriteBarrier = useRef<{ scope: string; before: string | null } | null>(null);
  const [subscriptionVersion, setSubscriptionVersion] = useState(0);

  useEffect(() => {
    const epoch = ++listenerEpoch.current;
    if (!scope) return;
    setProfileState({ scope, profile: cachedAccountProfile(scope) });
    if (isDemo || !uid || !firestore) return;
    const unsubscribe = onSnapshot(doc(firestore, 'users', uid, 'profile', 'main'), { includeMetadataChanges: true }, (snapshot) => {
      if (epoch !== listenerEpoch.current || firebaseAuth?.currentUser?.uid !== uid || inDemo()) return;
      // A missing memory-cache entry is not evidence that the server profile was removed.
      if (snapshot.metadata.hasPendingWrites || (!snapshot.exists() && snapshot.metadata.fromCache)) return;
      const next = snapshot.exists() ? readAccountProfile(snapshot.data()) : null;
      if (snapshot.exists() && !next) return;
      const barrier = profileWriteBarrier.current;
      if (barrier?.scope === scope) {
        const updatedAt = snapshot.get('updatedAt');
        // A transaction can resolve before its watch event reaches the memory cache.
        // Only a revision newer than the transaction's read may replace our saved value.
        if (!next || !(updatedAt instanceof Timestamp) || (barrier.before !== null && updatedAt.valueOf() <= barrier.before)) return;
        profileWriteBarrier.current = null;
      }
      cacheAccountProfile(scope, next);
      setProfileState({ scope, profile: next });
    }, () => { /* Preserve the last confirmed, account-scoped profile while offline. */ });
    return () => { ++listenerEpoch.current; unsubscribe(); };
  }, [scope, uid, isDemo, subscriptionVersion]);

  useEffect(() => {
    const auth = firebaseAuth;
    if (!auth) return;
    let alive = true;
    let unsubscribe: (() => void) | undefined;
    void authPersistenceReady.then(async () => {
      if (!alive) return;
      unsubscribe = onAuthStateChanged(auth, (next) => {
        if (!alive) return;
        if (inDemo()) { setUser(demoUser); setIsDemo(true); }
        else { setUser(next ? toKinUser(next) : null); setIsDemo(false); }
        setReady(true);
      }, (failure) => { if (alive) { setError(authMessage(failure)); setReady(true); } });
      try {
        const result = await getRedirectResult(auth);
        if (alive && result) { if (result.operationType === 'signIn') openTraining(); storeDemo(false); setIsDemo(false); setUser(toKinUser(result.user)); }
      } catch (failure) { if (alive) setError(authMessage(failure)); }
    }).catch((failure) => { if (alive) { setError(authMessage(failure)); setReady(true); } });
    return () => { alive = false; unsubscribe?.(); };
  }, []);

  async function run(action: () => Promise<void>) {
    setError(null);
    try { await action(); }
    catch (failure) { throw new Error(authMessage(failure)); }
  }
  function requireAuth() {
    if (!firebaseAuth) throw new Error('Configura Firebase per creare un account. Puoi già esplorare Kynlift in modalità demo.');
    return firebaseAuth;
  }
  function leaveDemo() { storeDemo(false); setIsDemo(false); }
  const value: AuthContextValue = {
    user, ready, configured: firebaseConfigured, isDemo, error,
    clearError: () => setError(null),
    signIn: (email, password) => run(async () => {
      const auth = requireAuth(); await authPersistenceReady;
      const result = await signInWithEmailAndPassword(auth, email.trim(), password);
      openTraining();
      leaveDemo(); setUser(toKinUser(result.user));
    }),
    signUp: (email, password, name) => run(async () => {
      const auth = requireAuth(); await authPersistenceReady;
      const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
      openTraining();
      leaveDemo(); setUser(toKinUser(result.user));
      await updateProfile(result.user, { displayName: name.trim() || null });
      setUser(toKinUser(result.user));
    }),
    signInGoogle: () => run(async () => {
      const auth = requireAuth(); await authPersistenceReady; assertRedirectConfiguration();
      const provider = new GoogleAuthProvider(); provider.setCustomParameters({ prompt: 'select_account' });
      leaveDemo(); await signInWithRedirect(auth, provider);
    }),
    linkGoogle: () => run(async () => {
      const auth = requireAuth();
      if (!auth.currentUser || isDemo) throw new Error('Accedi al tuo account per collegare Google.');
      assertRedirectConfiguration();
      const provider = new GoogleAuthProvider(); provider.setCustomParameters({ prompt: 'select_account' });
      await linkWithRedirect(auth.currentUser, provider);
    }),
    linkPassword: (password) => run(async () => {
      const auth = requireAuth();
      const currentUser = auth.currentUser;
      const email = currentUser?.email ?? currentUser?.providerData.find((provider) => provider.email)?.email;
      if (!currentUser || !email || isDemo) throw new Error('Accedi a un account con email per aggiungere una password.');
      const result = await linkWithCredential(currentUser, EmailAuthProvider.credential(email, password));
      setUser(toKinUser(result.user));
    }),
    resetPassword: (email) => run(async () => { await sendPasswordResetEmail(requireAuth(), email.trim()); }),
    updateAccountProfile: (input) => run(async () => {
      const next = validateAccountProfile(input);
      if (!scope || !uid) throw new Error('Accedi al tuo account per modificare il profilo.');
      if (savingProfile.current) throw new Error('Il profilo è già in salvataggio. Attendi un momento.');
      if (isDemo) {
        cacheAccountProfile(scope, next);
        setProfileState({ scope, profile: next });
        return;
      }
      const auth = requireAuth();
      const db = firestore;
      const assertCurrentAccount = () => {
        if (auth.currentUser?.uid !== uid || inDemo()) throw new Error('L’account è cambiato. Riapri il profilo e riprova.');
      };
      assertCurrentAccount();
      if (!db) throw new Error('Il salvataggio del profilo non è disponibile. Riprova tra poco.');
      if (navigator.onLine === false) throw new Error('Per salvare il profilo torna online e riprova.');
      savingProfile.current = true;
      // Retire the old listener immediately so delayed reads cannot undo this save.
      ++listenerEpoch.current;
      try {
        const ref = doc(db, 'users', uid, 'profile', 'main');
        // Transactions require a live server and never leave this edit in an offline queue.
        const before = await runTransaction(db, async (transaction) => {
          const previous = await transaction.get(ref);
          assertCurrentAccount();
          transaction.set(ref, { ...next, updatedAt: serverTimestamp() });
          const timestamp = previous.get('updatedAt');
          return timestamp instanceof Timestamp ? timestamp.valueOf() : null;
        });
        profileWriteBarrier.current = { scope, before };
        cacheAccountProfile(scope, next);
        assertCurrentAccount();
        setProfileState({ scope, profile: next });
      } finally {
        savingProfile.current = false;
        // A fresh listener reconciles the confirmed value with later server revisions.
        setSubscriptionVersion((version) => version + 1);
      }
    }),
    signOut: () => run(async () => {
      if (firebaseAuth) await firebaseSignOut(firebaseAuth);
      storeDemo(false); setIsDemo(false); setUser(null); setReady(true);
    }),
    enterDemo: () => run(async () => {
      if (firebaseAuth?.currentUser) await firebaseSignOut(firebaseAuth);
      openTraining();
      storeDemo(true); setIsDemo(true); setUser(demoUser); setReady(true);
    }),
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
