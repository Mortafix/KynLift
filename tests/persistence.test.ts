import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { deleteDB } from 'idb';
import { accountScope, emptyData, isStoredEntity, LocalStore } from '../src/data/persistence';
import { createDemoData } from '../src/lib/seed';
import type { Exercise } from '../src/types';

const sample = (id = 'squat', name = 'Squat'): Exercise => ({ id, name, equipment: 'Bilanciere', muscleGroup: 'Gambe', loadMode: 'total', loadMultiplier: 1, unilateral: false, increment: 2.5, createdAt: 1, updatedAt: 1 });
let store: LocalStore;
let name: string;
beforeEach(() => { name = `test-${crypto.randomUUID()}`; store = new LocalStore(name); });
afterEach(async () => { await store.close(); await deleteDB(name); });

describe('persistenza locale e outbox', () => {
  it('conserva dati e revisioni pendenti dopo chiusura e riapertura', async () => {
    await store.save('user:a', [{ collection: 'exercises', value: sample() }]);
    await store.close(); store = new LocalStore(name);
    expect((await store.load('user:a')).data.exercises[0].name).toBe('Squat');
    expect(await store.pending('user:a')).toHaveLength(1);
  });
  it('conserva timer, pause e durata delle serie dopo la riapertura', async () => {
    const demo = createDemoData();
    const session = { ...demo.sessions[0], workStartedAt: 2000, pausedAt: 3000, pausedDurationMs: 1000 };
    const entry = { ...demo.sets[0], durationMs: 45000 };
    await store.save('user:a', [{ collection: 'sessions', value: session }, { collection: 'sets', value: entry }]);
    await store.close(); store = new LocalStore(name);
    const loaded = (await store.load('user:a')).data;
    expect(loaded.sessions[0]).toMatchObject({ workStartedAt: 2000, pausedAt: 3000, pausedDurationMs: 1000 });
    expect(loaded.sets[0].durationMs).toBe(45000);
    expect(isStoredEntity({ ...session, pausedDurationMs: -1 }, session.id, 'sessions')).toBe(false);
    expect(isStoredEntity({ ...entry, durationMs: -1 }, entry.id, 'sets')).toBe(false);
  });

  it('conserva energia, sonno e note dopo la riapertura e nelle revisioni da sincronizzare', async () => {
    const session = { ...createDemoData().sessions[0], energy: 4, sleepHours: 7.5, note: 'Energia costante', pausedDurationMs: 30000 };
    await store.save('user:a', [{ collection: 'sessions', value: session }]);
    await store.close(); store = new LocalStore(name);
    expect((await store.load('user:a')).data.sessions[0]).toMatchObject({ energy: 4, sleepHours: 7.5, note: 'Energia costante', pausedDurationMs: 30000 });
    expect((await store.pending('user:a'))[0].value).toMatchObject({ energy: 4, sleepHours: 7.5, note: 'Energia costante' });
  });

  it('valida i nuovi dati senza escludere allenamenti storici privi di energia o sonno', () => {
    const session = createDemoData().sessions[0];
    expect(isStoredEntity(session, session.id, 'sessions')).toBe(true);
    expect(isStoredEntity({ ...session, energy: null, sleepHours: null }, session.id, 'sessions')).toBe(true);
    for (const energy of [0, 6, 1.5, '4', Number.NaN]) expect(isStoredEntity({ ...session, energy }, session.id, 'sessions')).toBe(false);
    for (const sleepHours of [-1, 24.5, 7.25, '7', Number.POSITIVE_INFINITY]) expect(isStoredEntity({ ...session, sleepHours }, session.id, 'sessions')).toBe(false);
    for (const sleepHours of [0, 0.5, 24]) expect(isStoredEntity({ ...session, energy: 5, sleepHours }, session.id, 'sessions')).toBe(true);
  });

  it('deduplica documenti stabili e non perde la nuova modifica quando arriva un vecchio ack', async () => {
    await store.save('user:a', [{ collection: 'exercises', value: sample() }]);
    const first = await store.pending('user:a');
    await store.save('user:a', [{ collection: 'exercises', value: sample('squat', 'Squat aggiornato') }]);
    await store.acknowledge('user:a', first);
    expect(await store.pending('user:a')).toHaveLength(1);
    expect((await store.load('user:a')).data.exercises).toHaveLength(1);
    expect((await store.load('user:a')).data.exercises[0].name).toBe('Squat aggiornato');
    await store.acknowledge('user:a', await store.pending('user:a'));
    expect(await store.pending('user:a')).toHaveLength(0);
  });

  it('protegge i pending e ignora versioni server precedenti dopo ack', async () => {
    await store.save('user:a', [{ collection: 'exercises', value: sample('squat', 'Locale') }]);
    await store.mergeRemote('user:a', 'exercises', [{ ...sample('squat', 'Locale'), updatedAt: Date.now() + 1000 }], { squat: { seconds: 2, nanoseconds: 0 } });
    expect((await store.load('user:a')).data.exercises[0].name).toBe('Locale');
    await store.acknowledge('user:a', await store.pending('user:a'));
    await store.mergeRemote('user:a', 'exercises', [sample()], { squat: { seconds: 1, nanoseconds: 0 } });
    expect((await store.load('user:a')).data.exercises[0].name).toBe('Locale');
  });

  it('accetta una nuova versione server anche con orologio client precedente', async () => {
    const first = { ...sample('squat', 'Prima'), updatedAt: 9999999999999 };
    await store.mergeRemote('user:a', 'exercises', [first], { squat: { seconds: 1, nanoseconds: 0 } });
    await store.mergeRemote('user:a', 'exercises', [sample('squat', 'Ultima sul server')], { squat: { seconds: 2, nanoseconds: 0 } });
    expect((await store.load('user:a')).data.exercises[0].name).toBe('Ultima sul server');
    await store.mergeRemote('user:a', 'exercises', [first], { squat: { seconds: 1, nanoseconds: 0 } });
    expect((await store.load('user:a')).data.exercises[0].name).toBe('Ultima sul server');
  });

  it('applica il server più recente visto fra rilettura di conferma e pulizia outbox', async () => {
    await store.save('user:a', [{ collection: 'exercises', value: sample('squat', 'Locale') }]);
    const sent = await store.pending('user:a');
    await store.mergeRemote('user:a', 'exercises', [sample('squat', 'Locale')], { squat: { seconds: 2, nanoseconds: 0 } });
    await store.mergeRemote('user:a', 'exercises', [sample('squat', 'Altro dispositivo successivo')], { squat: { seconds: 3, nanoseconds: 0 } });
    expect((await store.load('user:a')).data.exercises[0].name).toBe('Locale');
    await store.acknowledge('user:a', sent);
    await store.mergeRemote('user:a', 'exercises', [sample('squat', 'Locale')], { squat: { seconds: 2, nanoseconds: 0 } });
    expect((await store.load('user:a')).data.exercises[0].name).toBe('Altro dispositivo successivo');
    expect(await store.pending('user:a')).toHaveLength(0);
  });

  it('isola account, demo e ack anche con identificatori uguali', async () => {
    await store.save(accountScope('demo', false), [{ collection: 'exercises', value: sample('same', 'Privato') }]);
    await store.save(accountScope('demo', true), [{ collection: 'exercises', value: sample('same', 'Demo') }], false);
    await store.save('user:b', [{ collection: 'exercises', value: sample('same', 'Altro') }]);
    await store.acknowledge('user:b', await store.pending('user:demo'));
    expect(await store.pending('user:demo')).toHaveLength(1);
    await store.replaceDemo(emptyData());
    expect((await store.load('demo')).data.exercises).toHaveLength(0);
    expect((await store.load('user:demo')).data.exercises[0].name).toBe('Privato');
    expect((await store.load('user:b')).data.exercises[0].name).toBe('Altro');
  });

  it('propaga tombstone senza mostrare il dato eliminato o resuscitarlo al bootstrap', async () => {
    const seed = { ...emptyData(), exercises: [sample()] };
    await store.initialize('user:a', seed, true);
    await store.remove('user:a', 'exercises', 'squat');
    expect((await store.load('user:a')).data.exercises).toHaveLength(0);
    const tombstone = (await store.pending('user:a'))[0].value;
    expect(tombstone.deletedAt).toBeGreaterThan(0);
    await store.mergeRemote('user:b', 'exercises', [tombstone]);
    await store.initialize('user:b', seed, true);
    expect((await store.load('user:b')).data.exercises).toHaveLength(0);
  });

  it('inizializza una sola volta senza sostituire dati remoti esistenti', async () => {
    const seed = { ...emptyData(), exercises: [sample()] };
    await store.initialize('user:a', seed, true);
    await store.initialize('user:a', seed, true);
    expect(await store.pending('user:a')).toHaveLength(1);
    await store.mergeRemote('user:b', 'exercises', [sample('mine', 'Personale')]);
    await store.initialize('user:b', seed, true);
    expect((await store.load('user:b')).data.exercises.map((item) => item.id)).toEqual(['mine']);
    expect(await store.pending('user:b')).toHaveLength(0);
  });

  it('rifiuta un batch invalido senza persistere una parte delle modifiche', async () => {
    await expect(store.save('user:a', [{ collection: 'exercises', value: sample() }, { collection: 'exercises', value: sample('bad/id') }])).rejects.toThrow();
    expect((await store.load('user:a')).data.exercises).toHaveLength(0);
    expect(await store.pending('user:a')).toHaveLength(0);
  });

  it('annulla anche le scritture precedenti se una serializzazione fallisce a metà transazione', async () => {
    const invalid = { ...sample('broken'), name: () => 'non serializzabile' } as unknown as Exercise;
    await expect(store.save('user:a', [{ collection: 'exercises', value: sample() }, { collection: 'exercises', value: invalid }])).rejects.toThrow();
    expect((await store.load('user:a')).data.exercises).toHaveLength(0);
    expect(await store.pending('user:a')).toHaveLength(0);
  });

  it('valida tutti i payload demo e blocca elementi nested corrotti prima della UI', async () => {
    const demo = createDemoData();
    for (const collection of ['exercises', 'routines', 'sessions', 'sets'] as const) {
      expect(demo[collection].every((value) => isStoredEntity(value, value.id, collection))).toBe(true);
    }
    const bad = { ...demo.routines[0], exercises: [null] };
    expect(isStoredEntity(bad, bad.id, 'routines')).toBe(false);
    await store.save('user:a', [{ collection: 'routines', value: bad as unknown as typeof demo.routines[number] }]);
    expect((await store.load('user:a')).invalidCount).toBe(1);
    expect((await store.load('user:a')).data.routines).toHaveLength(0);
    const session = { ...demo.sessions[0], exercises: [{ ...demo.sessions[0].exercises[0], target: null }] };
    expect(isStoredEntity(session, session.id, 'sessions')).toBe(false);
  });
});
