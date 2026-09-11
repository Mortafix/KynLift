import { describe, expect, it } from 'vitest';
import { createSession, createSet, initialSet, previousSet, sessionCompletedSets, validateSet } from '../src/lib/domain';
import { createDemoData, createInitialData } from '../src/lib/seed';

describe('Workout domain', () => {
  it('starts an empty personal history and a separate, entirely completed demo history', () => {
    const empty = createInitialData();
    expect(empty.exercises.length).toBeGreaterThanOrEqual(30);
    expect(empty.routines).toEqual([]);
    expect(empty.sessions).toEqual([]);
    expect(empty.sets).toEqual([]);
    expect(empty.exercises.find((exercise) => exercise.id === 'weighted-pull-up')?.loadMode).toBe('bodyweight');
    const demo = createDemoData();
    expect(demo.sessions).toHaveLength(24);
    expect(demo.sessions.every((s) => s.status === 'completed')).toBe(true);
    expect(demo.routines.map((r) => r.name)).toEqual(['Lower body A', 'Upper body', 'Full body']);
  });

  it('snapshots exercise conventions and prescriptions independently of source edits', () => {
    const data = createDemoData();
    const routine = data.routines[0];
    const session = createSession(routine, data.exercises, 1000);
    const original = structuredClone(session);
    routine.name = 'Nome cambiato';
    routine.exercises[0].repsMax = 30;
    data.exercises.find((e) => e.id === 'hip-thrust')!.name = 'Nuovo nome';
    data.exercises.find((e) => e.id === 'hip-thrust')!.loadMode = 'assisted';
    expect(session).toEqual(original);
  });

  it('draft suggestions are never completed implicitly and identifiers are stable', () => {
    const data = createDemoData();
    const session = createSession(data.routines[0], data.exercises);
    const exercise = session.exercises[0];
    const one = createSet(session, exercise, 0, { weight: 40, reps: 8, rir: 0, completedAt: 123 });
    const two = createSet(session, exercise, 0);
    expect(one.id).toBe(two.id);
    expect(one.completedAt).toBeNull();
    expect(one.rir).toBe(0);
    expect(createSet(session, exercise, 1, { rir: null }).rir).toBeNull();
    expect(sessionCompletedSets(session, [one])).toEqual([]);
    one.completedAt = Date.now();
    expect(sessionCompletedSets(session, [one])).toEqual([one]);
  });

  it('uses completed comparable history, ignoring drafts, deletions and future workouts', () => {
    const data = createDemoData(1_800_000_000_000);
    const session = createSession(data.routines[0], data.exercises, 1_800_000_000_000);
    const exercise = session.exercises[0];
    const previous = previousSet(exercise, 0, data.sessions, data.sets, session.startedAt)!;
    expect(previous).toBeDefined();
    const excluded = data.sessions.find((s) => s.id === previous.sessionId)!;
    excluded.status = 'active';
    expect(previousSet(exercise, 0, data.sessions, data.sets)?.id).not.toBe(previous.id);
    excluded.status = 'completed';
    previous.deletedAt = Date.now();
    expect(previousSet(exercise, 0, data.sessions, data.sets)?.id).not.toBe(previous.id);
    exercise.snapshot.loadMultiplier = 2;
    expect(previousSet(exercise, 0, data.sessions, data.sets)).toBeUndefined();
  });

  it('rejects missing exercises, empty routines and invalid numerical input', () => {
    const data = createDemoData();
    expect(() => createSession({ ...data.routines[0], exercises: [] }, data.exercises)).toThrow();
    expect(() => createSession(data.routines[0], [])).toThrow();
    const session = createSession(data.routines[0], data.exercises);
    const exercise = session.exercises[2];
    const set = createSet(session, exercise, 0);
    expect(validateSet({ ...set, weight: NaN }, exercise.snapshot)).toBeTruthy();
    expect(validateSet({ ...set, reps: 0 }, exercise.snapshot)).toBeTruthy();
    expect(validateSet({ ...set, rir: 0 }, exercise.snapshot)).toBeNull();
    expect(validateSet({ ...set, rir: null }, exercise.snapshot)).toBeNull();
    expect(validateSet({ ...set, rightReps: 1.5 }, exercise.snapshot)).toBeTruthy();
  });

  it('starts from history, then carries increases and decreases without changing reps or RIR', () => {
    const data = createDemoData();
    const session = createSession(data.routines[0], data.exercises);
    const exercise = session.exercises[0];
    const previous = previousSet(exercise, 0, data.sessions, data.sets, session.startedAt)!;
    expect(initialSet(session, exercise, 0, data.sessions, data.sets).weight).toBe(previous.weight);
    const first = { ...createSet(session, exercise, 0, { weight: 85, reps: 3, rir: 5 }), completedAt: 100, updatedAt: 100 };
    data.sets.push(first);
    const second = initialSet(session, exercise, 1, data.sessions, data.sets);
    const secondHistory = previousSet(exercise, 1, data.sessions, data.sets, session.startedAt)!;
    expect(second).toMatchObject({ weight: 85, reps: secondHistory.reps, rir: secondHistory.rir, completedAt: null });
    data.sets.push({ ...second, weight: 65, updatedAt: 200 });
    expect(initialSet(session, exercise, 2, data.sessions, data.sets).weight).toBe(65);
    data.sets.push({ ...createSet(session, exercise, 3, { weight: 100 }), deletedAt: 400, updatedAt: 400 });
    data.sets.push({ ...createSet(session, exercise, 4, { weight: Number.NaN }), updatedAt: 500 });
    expect(initialSet(session, exercise, 2, data.sessions, data.sets).weight).toBe(65);
    expect(initialSet(session, exercise, 0, data.sessions, data.sets)).toEqual(first);
    expect(initialSet(session, exercise, 1, data.sessions, data.sets).weight).toBe(65);
  });

  it('keeps loads within the same exercise and session, including zero and independent sides', () => {
    const data = createDemoData();
    const session = createSession(data.routines[0], data.exercises);
    const exercise = session.exercises[2];
    const previous = previousSet(exercise, 0, data.sessions, data.sets, session.startedAt)!;
    data.sets.push(createSet(session, session.exercises[0], 0, { weight: 190 }));
    const another = createSession(data.routines[0], data.exercises);
    data.sets.push(createSet(another, exercise, 0, { weight: 180 }));
    expect(initialSet(session, exercise, 0, data.sessions, data.sets).weight).toBe(previous.weight);
    data.sets.push(createSet(session, exercise, 0, { weight: 10, rightWeight: 12.5, rightReps: 9 }, 100));
    expect(initialSet(session, exercise, 1, data.sessions, data.sets)).toMatchObject({ weight: 10, rightWeight: 12.5 });
    data.sets.push(createSet(session, exercise, 1, { weight: 0, rightWeight: null, rightReps: null }, 200));
    expect(initialSet(session, exercise, 2, data.sessions, data.sets)).toMatchObject({ weight: 0, rightWeight: null, rightReps: null });
  });
});
