import { describe, expect, it } from 'vitest';
import { createSession, createSet, formatRepsTarget, initialSet, isMaxReps, previousSet, sessionCompletedSets, validateSet } from '../src/lib/domain';
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

  it('snapshots MAX targets independently and preserves legacy repetition ranges', () => {
    const data = createDemoData();
    const routine = data.routines[0];
    routine.exercises[0].maxRepsSets = [0, 2];
    const session = createSession(routine, data.exercises);
    expect(session.exercises[0].target.maxRepsSets).toEqual([0, 2]);
    expect(session.exercises[0].target.maxRepsSets).not.toBe(routine.exercises[0].maxRepsSets);
    routine.exercises[0].maxRepsSets.push(1);
    expect(session.exercises[0].target.maxRepsSets).toEqual([0, 2]);
    session.exercises[0].target.maxRepsSets!.splice(0, 1);
    expect(routine.exercises[0].maxRepsSets).toEqual([0, 2, 1]);
    expect(session.exercises[1].target).not.toHaveProperty('maxRepsSets');
    expect(createSet(session, session.exercises[1], 0).reps).toBe(session.exercises[1].target.repsMax);
  });

  it('formats individual, mixed and all-MAX prescriptions without changing numeric targets', () => {
    const target = { sets: 3, repsMin: 8, repsMax: 10 };
    expect(formatRepsTarget(target)).toBe('8–10');
    expect(formatRepsTarget({ ...target, repsMin: 10 })).toBe('10');
    expect(formatRepsTarget({ ...target, maxRepsSets: [] })).toBe('8–10');
    const mixed = { ...target, maxRepsSets: [2] };
    expect(formatRepsTarget(mixed)).toBe('8–10 / MAX');
    expect(formatRepsTarget(mixed, 0)).toBe('8–10');
    expect(formatRepsTarget(mixed, 2)).toBe('MAX');
    expect(isMaxReps(mixed, 2)).toBe(true);
    expect(isMaxReps(target, 2)).toBe(false);
    expect(isMaxReps(mixed, 3)).toBe(false);
    expect(isMaxReps(mixed, -1)).toBe(false);
    expect(formatRepsTarget({ ...target, maxRepsSets: [2, 0, 1] })).toBe('MAX');
    expect(mixed).toEqual({ sets: 3, repsMin: 8, repsMax: 10, maxRepsSets: [2] });
  });

  it('requires a numeric result for new MAX sets and retains real historical suggestions and carried loads', () => {
    const data = createDemoData();
    const routine = data.routines[0];
    routine.exercises[0].maxRepsSets = [0, 1];
    const session = createSession(routine, data.exercises);
    const exercise = session.exercises[0];
    const first = createSet(session, exercise, 0);
    expect(first).toMatchObject({ reps: 0, rir: exercise.target.rir, completedAt: null });
    expect(validateSet(first, exercise.snapshot)).toContain('ripetizioni');
    expect(createSet(session, exercise, 0, { reps: 13, rir: 1 })).toMatchObject({ reps: 13, rir: 1, completedAt: null });
    const completed = { ...first, weight: 75, reps: 12, rir: 0, completedAt: 100, updatedAt: 100 };
    expect(initialSet(session, exercise, 1, [], [completed])).toMatchObject({ weight: 75, reps: 0, rir: exercise.target.rir, completedAt: null });
    const historical = previousSet(exercise, 1, data.sessions, data.sets, session.startedAt)!;
    expect(initialSet(session, exercise, 1, data.sessions, [...data.sets, completed])).toMatchObject({ weight: 75, reps: historical.reps, rir: historical.rir });
    const existing = { ...createSet(session, exercise, 1), weight: 65, reps: 14, rir: 2 };
    expect(initialSet(session, exercise, 1, data.sessions, [...data.sets, completed, existing])).toBe(existing);
    expect(sessionCompletedSets(session, [first, completed])).toEqual([completed]);
  });
});
