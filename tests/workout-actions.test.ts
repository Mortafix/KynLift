import { describe, expect, it } from 'vitest';
import { createInitialData } from '../src/lib/seed';
import { createSession, createSet } from '../src/lib/domain';
import { completeSetChanges, createSessionWriter, finishSessionChanges, initializeSessionTimerChanges, pauseSessionChanges, remainingSeconds, resumeSessionChanges, sessionDurationSeconds, updateSessionFeedbackChanges, validateSessionFeedback, workoutTimer } from '../src/lib/workout-actions';
import type { DataChange, Routine, WorkoutSession } from '../src/types';

const data = createInitialData();
const routine: Routine = { id: 'routine', name: 'Test', description: '', createdAt: 1, updatedAt: 1, exercises: [
  { id: 'slot', exerciseId: data.exercises[0].id, sets: 2, repsMin: 8, repsMax: 10, rir: 2, restSeconds: 90, note: '' },
] };

describe('workout persistence actions', () => {
  it('commits an explicit completion and advances the cursor with an absolute timer deadline', () => {
    const session = createSession(routine, data.exercises, 1000);
    const set = createSet(session, session.exercises[0], 0, { weight: 40 }, 1000);
    const changes = completeSetChanges(session, set, 2000);
    expect(changes[0].value).toMatchObject({ id: set.id, completedAt: 2000, weight: 40 });
    expect(changes[1].value).toMatchObject({ currentSet: 1, restEndsAt: 92000 });
    expect(remainingSeconds(92000, 65000)).toBe(27);
    expect(remainingSeconds(92000, 100000)).toBe(0);
  });

  it('retains identity when double-confirmed and does not move historical session cursors', () => {
    const active = createSession(routine, data.exercises, 1000);
    const session: WorkoutSession = { ...active, status: 'completed', finishedAt: 2000 };
    const set = { ...createSet(session, session.exercises[0], 0), completedAt: 1500 };
    const changes = completeSetChanges(session, { ...set, weight: 45 }, 3000);
    expect(changes).toHaveLength(1);
    expect(changes[0].value).toMatchObject({ id: set.id, completedAt: 1500, weight: 45 });
  });

  it('does not close an empty session or count unconfirmed drafts', () => {
    const session = createSession(routine, data.exercises);
    const draft = createSet(session, session.exercises[0], 0);
    expect(() => finishSessionChanges(session, { sets: [draft] }, '')).toThrow('Registra almeno');
    const completed = { ...draft, completedAt: 1 };
    expect(finishSessionChanges(session, { sets: [completed] }, 'Bene', 2000)[0].value).toMatchObject({ status: 'completed', finishedAt: 2000, note: 'Bene', restEndsAt: null });
  });

  it('saves explicit energy, sleep and notes while closing the workout and preserves feedback on legacy note updates', () => {
    const session = { ...createSession(routine, data.exercises, 1000), note: 'Nota precedente', pausedAt: 2000, pausedDurationMs: 100 };
    const entry = { ...createSet(session, session.exercises[0], 0), completedAt: 1500 };
    const finished = finishSessionChanges(session, { sets: [entry] }, { energy: 4, sleepHours: 7.5, note: 'Mi sono sentito bene' }, 3000)[0].value as WorkoutSession;
    expect(finished).toMatchObject({ energy: 4, sleepHours: 7.5, note: 'Mi sono sentito bene', status: 'completed', finishedAt: 3000, pausedAt: null, pausedDurationMs: 1100, workStartedAt: null });
    expect(finishSessionChanges(finished, { sets: [entry] }, 'Correzione nota', 4000)[0].value).toMatchObject({ energy: 4, sleepHours: 7.5, note: 'Correzione nota', finishedAt: 3000 });
    expect(finishSessionChanges(session, { sets: [entry] }, '', 3000)[0].value).not.toHaveProperty('energy');
  });

  it('validates feedback boundaries without turning missing observations into zero', () => {
    const feedback = { energy: 3, sleepHours: 7.5, note: '' };
    for (const energy of [0, 6, 2.5, Number.NaN]) expect(validateSessionFeedback({ ...feedback, energy })).toContain('Seleziona');
    for (const sleepHours of [-0.5, 24.5, 7.25, Number.NaN, Number.POSITIVE_INFINITY]) expect(validateSessionFeedback({ ...feedback, sleepHours })).toContain('ore di sonno');
    for (const sleepHours of [0, 0.5, 7.5, 24]) expect(validateSessionFeedback({ ...feedback, sleepHours })).toBeNull();
    for (const energy of [1, 5]) expect(validateSessionFeedback({ ...feedback, energy })).toBeNull();
    expect(validateSessionFeedback({ ...feedback, note: 'a'.repeat(5001) })).toContain('5000');
    const session = createSession(routine, data.exercises, 1000);
    const entry = { ...createSet(session, session.exercises[0], 0), completedAt: 1500 };
    expect(() => finishSessionChanges(session, { sets: [entry] }, { ...feedback, energy: 0 }, 2000)).toThrow('Seleziona');
  });

  it('edits historic feedback without changing timing, exercise snapshots or saved results', () => {
    const session: WorkoutSession = { ...createSession(routine, data.exercises, 1000), status: 'completed', finishedAt: 8000, pausedDurationMs: 2500, energy: 2, sleepHours: 6, note: 'Prima' };
    const feedback = { energy: 5, sleepHours: 8.5, note: 'Correzione' };
    const changes = updateSessionFeedbackChanges(session, feedback, 10000);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual({ collection: 'sessions', value: { ...session, ...feedback, updatedAt: 10000 } });
    expect(() => updateSessionFeedbackChanges({ ...session, status: 'active' }, feedback)).toThrow('storico');
    expect(() => updateSessionFeedbackChanges({ ...session, deletedAt: 9000 }, feedback)).toThrow('storico');
    expect(() => updateSessionFeedbackChanges(session, { ...feedback, sleepHours: 30 })).toThrow('ore di sonno');
  });

  it('uses the completed exercise recovery now, then the next exercise prescription', () => {
    const multi: Routine = { ...routine, exercises: [
      { ...routine.exercises[0], sets: 1, restSeconds: 120 },
      { ...routine.exercises[0], id: 'second-slot', sets: 2, restSeconds: 45 },
    ] };
    const session = { ...createSession(multi, data.exercises, 1000), restDuration: 5 };
    const entry = createSet(session, session.exercises[0], 0);
    const changes = completeSetChanges(session, entry, 2000);
    expect(changes[1].value).toMatchObject({ currentExercise: 1, currentSet: 0, restEndsAt: 122000, restDuration: 45 });
    const next = changes[1].value as WorkoutSession;
    expect(completeSetChanges(next, createSet(next, next.exercises[1], 0), 200000)[1].value).toMatchObject({ restEndsAt: 245000 });
  });

  it('keeps recovery bound to the set being confirmed even after jumping between exercises', () => {
    const multi: Routine = { ...routine, exercises: [
      { ...routine.exercises[0], restSeconds: 90 },
      { ...routine.exercises[0], id: 'second-slot', restSeconds: 15 },
    ] };
    const session = { ...createSession(multi, data.exercises, 1000), currentExercise: 1, restDuration: 15 };
    const entry = createSet(session, session.exercises[0], 0);
    expect(completeSetChanges(session, entry, 2000)[1].value).toMatchObject({ currentExercise: 0, restEndsAt: 92000, restDuration: 90 });
    const noRest = { ...session, exercises: session.exercises.map((exercise) => ({ ...exercise, target: { ...exercise.target, restSeconds: 0 } })) };
    expect(completeSetChanges(noRest, entry, 2000)[1].value).toMatchObject({ restEndsAt: null, restDuration: 0 });
  });

  it('preserves existing notes and does not restart recovery when correcting a confirmed active set', () => {
    const session = { ...createSession(routine, data.exercises, 1000), restEndsAt: 91000, currentSet: 1 };
    const entry = { ...createSet(session, session.exercises[0], 0), note: 'Nota già archiviata', completedAt: 1000 };
    const changes = completeSetChanges(session, { ...entry, weight: 45 }, 2000);
    expect(changes).toHaveLength(1);
    expect(changes[0].value).toMatchObject({ note: 'Nota già archiviata', completedAt: 1000, weight: 45 });
  });

  it('serializes note, timer and cursor writes against the last local success', async () => {
    const session = createSession(routine, data.exercises, 1000);
    const persisted: DataChange[][] = [];
    let finishFirst!: () => void;
    const delayed = new Promise<void>((resolve) => { finishFirst = resolve; });
    const writer = createSessionWriter(session, async (changes) => {
      if (!persisted.length) { persisted.push(changes); await delayed; }
      else persisted.push(changes);
    });
    const note = writer.write((current) => [{ collection: 'sessions', value: { ...current, note: 'Panca regolata', updatedAt: 2000 } }]);
    const cursor = writer.write((current) => [{ collection: 'sessions', value: { ...current, currentSet: 1, updatedAt: 2000 } }]);
    const inFlightSnapshot = { ...session, note: 'Vecchio aggiornamento ricevuto durante il salvataggio' };
    writer.sync(inFlightSnapshot);
    await Promise.resolve();
    finishFirst();
    await Promise.all([note, cursor]);
    expect(writer.current()).toMatchObject({ note: 'Panca regolata', currentSet: 1, updatedAt: 2001 });
    expect(persisted[1][0].value).toMatchObject({ note: 'Panca regolata', currentSet: 1 });
    writer.sync(session);
    expect(writer.current().note).toBe('Panca regolata');
    writer.sync(inFlightSnapshot);
    expect(writer.current()).toMatchObject({ note: 'Panca regolata', currentSet: 1 });
  });

  it.each([9000, 10000])('retains an authoritative server update with client timestamp %i in the next local save', async (updatedAt) => {
    const session = { ...createSession(routine, data.exercises, 1000), updatedAt: 10000, note: 'Nota precedente' };
    const persisted: DataChange[][] = [];
    const writer = createSessionWriter(session, async (changes) => { persisted.push(changes); });
    // LocalStore has already resolved commit order. A later server winner can
    // have a smaller/equal client timestamp when devices have different clocks.
    const serverWinner = { ...session, note: 'Nota dal secondo dispositivo', updatedAt };
    writer.sync(serverWinner);
    await writer.write((current) => [{ collection: 'sessions', value: { ...current, restDuration: 60, updatedAt: 11000 } }]);
    expect(persisted[0][0].value).toMatchObject({ note: 'Nota dal secondo dispositivo', restDuration: 60 });
    // React can render already-observed props again before publishing the save.
    writer.sync(session);
    writer.sync(serverWinner);
    expect(writer.current()).toMatchObject({ note: 'Nota dal secondo dispositivo', restDuration: 60 });
  });

  it('does not publish failed changes or block later saves after a storage error', async () => {
    const session = createSession(routine, data.exercises, 1000);
    let attempts = 0;
    const writer = createSessionWriter(session, async () => { if (attempts++ === 0) throw new Error('Quota'); });
    const rejected = writer.write((current) => [{ collection: 'sessions', value: { ...current, note: 'Non salvata', updatedAt: 2000 } }]);
    await expect(rejected).rejects.toThrow('Quota');
    expect(writer.current().note).toBe('');
    await writer.write((current) => [{ collection: 'sessions', value: { ...current, restDuration: 60, updatedAt: 2000 } }]);
    expect(writer.current()).toMatchObject({ note: '', restDuration: 60 });
  });

  it('rejects writes to discarded sessions and unplanned set indices', () => {
    const session = createSession(routine, data.exercises);
    const set = createSet(session, session.exercises[0], 0);
    expect(() => completeSetChanges({ ...session, status: 'discarded' }, set)).toThrow('annullata');
    expect(() => completeSetChanges(session, { ...set, index: 2 })).toThrow('non è prevista');
  });
});

describe('exercise and pause timing', () => {
  const sessionFrom = (changes: DataChange[]) => changes.find((change) => change.collection === 'sessions')!.value as WorkoutSession;

  it('starts immediately and changes from recovery to exercise time using persisted deadlines', () => {
    const session = createSession(routine, data.exercises, 1000);
    expect(workoutTimer(session, 31000)).toEqual({ phase: 'work', seconds: 30, paused: false });
    const entry = createSet(session, session.exercises[0], 0);
    const changes = completeSetChanges(session, entry, 31000);
    expect(changes[0].value).toMatchObject({ durationMs: 30000 });
    const recovered = JSON.parse(JSON.stringify(sessionFrom(changes))) as WorkoutSession;
    expect(workoutTimer(recovered, 120000)).toEqual({ phase: 'rest', seconds: 1, paused: false });
    expect(workoutTimer(recovered, 121000)).toEqual({ phase: 'work', seconds: 0, paused: false });
    expect(workoutTimer(recovered, 146000)).toEqual({ phase: 'work', seconds: 25, paused: false });
    expect(completeSetChanges(recovered, createSet(recovered, recovered.exercises[0], 1), 146000)[0].value).toMatchObject({ durationMs: 25000 });
  });

  it('freezes recovery through reload and preserves the remaining seconds after a long pause', () => {
    const initial = createSession(routine, data.exercises, 1000);
    const recovery = sessionFrom(completeSetChanges(initial, createSet(initial, initial.exercises[0], 0), 31000));
    const paused = sessionFrom(pauseSessionChanges(recovery, 61000));
    expect(workoutTimer(JSON.parse(JSON.stringify(paused)), 661000)).toEqual({ phase: 'rest', seconds: 60, paused: true });
    const resumed = sessionFrom(resumeSessionChanges(paused, 661000));
    expect(resumed).toMatchObject({ pausedAt: null, pausedDurationMs: 600000, restEndsAt: 721000, workStartedAt: 721000 });
    expect(workoutTimer(resumed, 721000)).toEqual({ phase: 'work', seconds: 0, paused: false });
    expect(workoutTimer(resumed, 736000)).toEqual({ phase: 'work', seconds: 15, paused: false });
    expect(sessionDurationSeconds(resumed, 736000)).toBe(135);
  });

  it('excludes repeated exercise pauses from recorded set duration and total duration', () => {
    const initial = createSession(routine, data.exercises, 1000);
    const paused = sessionFrom(pauseSessionChanges(initial, 21000));
    expect(workoutTimer(paused, 51000)).toEqual({ phase: 'work', seconds: 20, paused: true });
    expect(sessionDurationSeconds(paused, 51000)).toBe(20);
    const resumed = sessionFrom(resumeSessionChanges(paused, 51000));
    const pausedAgain = sessionFrom(pauseSessionChanges(resumed, 61000));
    const resumedAgain = sessionFrom(resumeSessionChanges(pausedAgain, 81000));
    const entry = createSet(resumedAgain, resumedAgain.exercises[0], 0);
    const changes = completeSetChanges(resumedAgain, entry, 91000);
    expect(changes[0].value).toMatchObject({ durationMs: 40000 });
    expect(sessionDurationSeconds(resumedAgain, 91000)).toBe(40);
    const finishedWhilePaused = sessionFrom(finishSessionChanges(sessionFrom(pauseSessionChanges(sessionFrom(changes), 101000)), { sets: [{ ...entry, completedAt: 91000 }] }, '', 201000));
    expect(finishedWhilePaused).toMatchObject({ pausedAt: null, pausedDurationMs: 150000, workStartedAt: null });
    expect(sessionDurationSeconds(finishedWhilePaused)).toBe(50);
  });

  it('does not invent durations for legacy records or overwrite them on corrections', () => {
    const { workStartedAt: _work, pausedAt: _paused, pausedDurationMs: _duration, ...legacy } = createSession(routine, data.exercises, 1000);
    const initialized = sessionFrom(initializeSessionTimerChanges(legacy, 600000));
    expect(workoutTimer(initialized, 600000).seconds).toBe(0);
    expect(initializeSessionTimerChanges(initialized, 610000)).toEqual([]);
    const oldEntry = { ...createSet(legacy, legacy.exercises[0], 0), completedAt: 2000, rir: null };
    const historical: WorkoutSession = { ...legacy, status: 'completed', finishedAt: 3000 };
    expect(completeSetChanges(historical, oldEntry, 700000)[0].value).toMatchObject({ rir: null, durationMs: null });
    expect(completeSetChanges(initialized, { ...oldEntry, rir: 2, durationMs: 25000 }, 700000)[0].value).toMatchObject({ durationMs: 25000, completedAt: 2000 });
  });

  it('requires RIR for active saves and prevents saving while paused', () => {
    const session = createSession(routine, data.exercises, 1000);
    const entry = createSet(session, session.exercises[0], 0);
    expect(() => completeSetChanges(session, { ...entry, rir: null }, 2000)).toThrow('Inserisci il RIR');
    expect(() => completeSetChanges(sessionFrom(pauseSessionChanges(session, 2000)), entry, 3000)).toThrow('Riprendi');
    expect(pauseSessionChanges(sessionFrom(pauseSessionChanges(session, 2000)), 3000)).toEqual([]);
    expect(resumeSessionChanges(session, 3000)).toEqual([]);
    const noRecovery = { ...session, exercises: session.exercises.map((exercise) => ({ ...exercise, target: { ...exercise.target, restSeconds: 0 } })) };
    expect(workoutTimer(sessionFrom(completeSetChanges(noRecovery, entry, 2000)), 3000)).toEqual({ phase: 'work', seconds: 1, paused: false });
  });
});
