import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, Timestamp, updateDoc, type Firestore } from 'firebase/firestore';
import { createDemoData } from '../src/lib/seed';
import { LocalStore } from '../src/data/persistence';
import { decodeDocument, syncPendingBatch } from '../src/data/cloud';
import type { Exercise } from '../src/types';

const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
describe.skipIf(!enabled)('Firestore: isolamento e validazione', () => {
  let env: RulesTestEnvironment;
  const exercise = { id: 'squat', name: 'Squat', equipment: 'Bilanciere', muscleGroup: 'Gambe', loadMode: 'total', loadMultiplier: 1, unilateral: false, increment: 2.5, createdAt: 1, updatedAt: 1 };
  beforeAll(async () => {
    env = await initializeTestEnvironment({ projectId: 'demo-kinlift', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
  });
  beforeEach(async () => { await env.clearFirestore(); });
  afterAll(async () => { await env.cleanup(); });
  it('consente solo al proprietario lettura e modifica dei propri dati', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    const bob = env.authenticatedContext('bob').firestore();
    const anon = env.unauthenticatedContext().firestore();
    await assertSucceeds(setDoc(doc(alice, 'users/alice/exercises/squat'), exercise));
    await assertSucceeds(getDoc(doc(alice, 'users/alice/exercises/squat')));
    await assertSucceeds(getDocs(collection(alice, 'users/alice/exercises')));
    await assertFails(getDoc(doc(bob, 'users/alice/exercises/squat')));
    await assertFails(getDocs(collection(bob, 'users/alice/exercises')));
    await assertFails(setDoc(doc(bob, 'users/alice/exercises/squat'), exercise));
    await assertFails(getDoc(doc(anon, 'users/alice/exercises/squat')));
    await assertFails(setDoc(doc(anon, 'users/alice/exercises/squat'), exercise));
  });
  it('rifiuta campi inattesi, identificatori diversi e collezioni non previste', async () => {
    const db = env.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(db, 'users/alice/exercises/other'), exercise));
    await assertFails(setDoc(doc(db, 'users/alice/exercises/squat'), { ...exercise, role: 'admin' }));
    await assertFails(setDoc(doc(db, 'users/alice/secrets/squat'), exercise));
    await assertFails(setDoc(doc(db, 'users/alice/exercises/squat'), { ...exercise, increment: -1 }));
  });
  it('richiede tombstone per sincronizzare le cancellazioni', async () => {
    const db = env.authenticatedContext('alice').firestore();
    const ref = doc(db, 'users/alice/exercises/squat');
    await assertSucceeds(setDoc(ref, exercise));
    await assertFails(deleteDoc(ref));
    await assertSucceeds(updateDoc(ref, { deletedAt: 2, updatedAt: 2 }));
  });
  it('rifiuta serie malformate e valori negativi', async () => {
    const db = env.authenticatedContext('alice').firestore();
    const value = { id: 'set-1', createdAt: 1, updatedAt: 1, sessionId: 'session-1', sessionExerciseId: 'squat-1', index: 0, weight: 40, reps: 8, rir: null, rightWeight: null, rightReps: null, note: '', completedAt: 1 };
    await assertSucceeds(setDoc(doc(db, 'users/alice/sets/set-1'), value));
    await assertFails(setDoc(doc(db, 'users/alice/sets/set-1'), { ...value, weight: -20 }));
    await assertFails(setDoc(doc(db, 'users/alice/sets/set-1'), { ...value, reps: 3.5 }));
    await assertFails(setDoc(doc(db, 'users/alice/sets/set-1'), { ...value, rir: 20 }));
  });
  it('accetta gli snapshot e le convenzioni generati dal modello di dominio', async () => {
    const db = env.authenticatedContext('alice').firestore();
    const data = createDemoData();
    for (const name of ['exercises', 'routines', 'sessions', 'sets'] as const) {
      const value = data[name][0];
      await assertSucceeds(setDoc(doc(db, 'users/alice', name, value.id), value));
    }
  });
  it('accetta timer e pause persistiti, mantenendo compatibili i vecchi record', async () => {
    const db = env.authenticatedContext('alice').firestore();
    const data = createDemoData();
    const session = { ...data.sessions[0], workStartedAt: 2000, pausedAt: 3000, pausedDurationMs: 1000 };
    const entry = { ...data.sets[0], durationMs: 45000 };
    const sessionRef = doc(db, 'users/alice/sessions', session.id);
    const setRef = doc(db, 'users/alice/sets', entry.id);
    await assertSucceeds(setDoc(sessionRef, session));
    await assertSucceeds(setDoc(setRef, entry));
    await assertFails(setDoc(sessionRef, { ...session, pausedDurationMs: -1 }));
    await assertFails(setDoc(sessionRef, { ...session, workStartedAt: 'soon' }));
    await assertFails(setDoc(setRef, { ...entry, durationMs: -1 }));
  });
  it('accetta energia e mezze ore di sonno, mantiene legacy e rifiuta valori fuori scala', async () => {
    const db = env.authenticatedContext('alice').firestore();
    const session = createDemoData().sessions[0];
    const ref = doc(db, 'users/alice/sessions', session.id);
    await assertSucceeds(setDoc(ref, session));
    await assertSucceeds(setDoc(ref, { ...session, energy: null, sleepHours: null }));
    for (const sleepHours of [0, 0.5, 7.5, 24]) await assertSucceeds(setDoc(ref, { ...session, energy: 5, sleepHours, note: 'Energia costante' }));
    for (const energy of [0, 6, 2.5, '4']) await assertFails(setDoc(ref, { ...session, energy }));
    for (const sleepHours of [-0.5, 24.5, 7.25, '7']) await assertFails(setDoc(ref, { ...session, sleepHours }));
  });
  it('richiede timestamp server per i metadati di sincronizzazione', async () => {
    const db = env.authenticatedContext('alice').firestore();
    const ref = doc(db, 'users/alice/exercises/squat');
    const sync = { revision: 'r1', clientId: 'device1', sequence: 1, committedAt: Timestamp.fromMillis(1) };
    await assertFails(setDoc(ref, { ...exercise, _sync: sync }));
    await assertSucceeds(setDoc(ref, { ...exercise, _sync: { ...sync, committedAt: serverTimestamp() } }));
    await assertFails(setDoc(ref, exercise));
  });
  it('converge sul server con dispositivi a orologi diversi e senza modifiche simultanee', async () => {
    const db = env.authenticatedContext('alice').firestore() as unknown as Firestore;
    const a = new LocalStore(`clock-a-${crypto.randomUUID()}`);
    const b = new LocalStore(`clock-b-${crypto.randomUUID()}`);
    const scope = 'user:alice';
    const ref = doc(db, 'users/alice/exercises/squat');
    try {
      await a.save(scope, [{ collection: 'exercises', value: exercise as Exercise }]);
      await syncPendingBatch(db, a, scope, 'alice', await a.pending(scope));
      const original = decodeDocument(await getDoc(ref), 'exercises');
      await b.mergeRemote(scope, 'exercises', [original.value], { squat: original.version! });
      await a.save(scope, [{ collection: 'exercises', value: { ...exercise, name: 'Clock avanti', updatedAt: Date.now() + 86400000 } as Exercise }]);
      await syncPendingBatch(db, a, scope, 'alice', await a.pending(scope));
      await b.save(scope, [{ collection: 'exercises', value: { ...exercise, name: 'Ultima modifica' } as Exercise }]);
      await syncPendingBatch(db, b, scope, 'alice', await b.pending(scope));
      const latest = decodeDocument(await getDoc(ref), 'exercises');
      await a.mergeRemote(scope, 'exercises', [latest.value], { squat: latest.version! });
      expect((await a.load(scope)).data.exercises[0].name).toBe('Ultima modifica');
      expect((await b.load(scope)).data.exercises[0].name).toBe('Ultima modifica');
      expect(await a.pending(scope)).toHaveLength(0);
      expect(await b.pending(scope)).toHaveLength(0);
    } finally { await a.close(); await b.close(); }
  });
  it('non riscrive una revisione vecchia inviata dopo quella nuova senza Web Locks', async () => {
    const db = env.authenticatedContext('alice').firestore() as unknown as Firestore;
    const store = new LocalStore(`reordered-${crypto.randomUUID()}`);
    const scope = 'user:alice';
    try {
      await store.save(scope, [{ collection: 'exercises', value: exercise as Exercise }]);
      const older = await store.pending(scope);
      await store.save(scope, [{ collection: 'exercises', value: { ...exercise, name: 'Più recente' } as Exercise }]);
      await syncPendingBatch(db, store, scope, 'alice', await store.pending(scope));
      await syncPendingBatch(db, store, scope, 'alice', older);
      expect((await getDoc(doc(db, 'users/alice/exercises/squat'))).data()?.name).toBe('Più recente');
      expect((await store.load(scope)).data.exercises[0].name).toBe('Più recente');
      expect(await store.pending(scope)).toHaveLength(0);
    } finally { await store.close(); }
  });
  it('conserva la modifica locale successiva mentre arriva la conferma della precedente', async () => {
    const db = env.authenticatedContext('alice').firestore() as unknown as Firestore;
    const store = new LocalStore(`pending-${crypto.randomUUID()}`);
    const scope = 'user:alice';
    try {
      await store.save(scope, [{ collection: 'exercises', value: exercise as Exercise }]);
      const older = await store.pending(scope);
      await store.save(scope, [{ collection: 'exercises', value: { ...exercise, name: 'Ancora locale' } as Exercise }]);
      await syncPendingBatch(db, store, scope, 'alice', older);
      expect((await store.load(scope)).data.exercises[0].name).toBe('Ancora locale');
      expect(await store.pending(scope)).toHaveLength(1);
      await syncPendingBatch(db, store, scope, 'alice', await store.pending(scope));
      expect((await getDoc(doc(db, 'users/alice/exercises/squat'))).data()?.name).toBe('Ancora locale');
    } finally { await store.close(); }
  });
  it('un retry già ricevuto dal server non sovrascrive una successiva modifica di un altro dispositivo', async () => {
    const db = env.authenticatedContext('alice').firestore() as unknown as Firestore;
    const a = new LocalStore(`retry-a-${crypto.randomUUID()}`);
    const b = new LocalStore(`retry-b-${crypto.randomUUID()}`);
    const scope = 'user:alice';
    const ref = doc(db, 'users/alice/exercises/squat');
    try {
      await a.save(scope, [{ collection: 'exercises', value: exercise as Exercise }]);
      const original = await a.pending(scope);
      await syncPendingBatch(db, a, scope, 'alice', original);
      await b.save(scope, [{ collection: 'exercises', value: { ...exercise, name: 'Secondo dispositivo' } as Exercise }]);
      await syncPendingBatch(db, b, scope, 'alice', await b.pending(scope));
      await syncPendingBatch(db, a, scope, 'alice', original);
      expect((await getDoc(ref)).data()?.name).toBe('Secondo dispositivo');
      expect((await a.load(scope)).data.exercises[0].name).toBe('Secondo dispositivo');
    } finally { await a.close(); await b.close(); }
  });
});
