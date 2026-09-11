import { describe, expect, it } from 'vitest';
import { createDemoData } from '../src/lib/seed';
import { createSession, createSet } from '../src/lib/domain';
import { calculateStats, comparisonPeriod, completedEntries, estimatedOneRepMax, personalRecords, setVolume, trainingCalendar } from '../src/lib/stats';
import type { SetEntry, WorkoutSession } from '../src/types';

function fixture() {
  const data = createDemoData(new Date(2026, 8, 10, 12).getTime());
  const session = createSession(data.routines[1], data.exercises, new Date(2026, 8, 10, 10).getTime());
  session.status = 'completed';
  session.finishedAt = session.startedAt + 60 * 60_000;
  const set = createSet(session, session.exercises[0], 0, { weight: 20, reps: 10 }, session.startedAt);
  set.completedAt = session.startedAt + 60_000;
  return { data, session, set, exercise: session.exercises[0].snapshot };
}

describe('External load and estimated maximum', () => {
  it('counts paired dumbbells and each unilateral side without assuming equal sides', () => {
    const { exercise, set } = fixture();
    expect(setVolume(set, exercise)).toBe(400);
    const oneArm = { ...exercise, unilateral: true, loadMultiplier: 1 as const };
    expect(setVolume(set, oneArm)).toBe(400);
    expect(setVolume({ ...set, rightWeight: 15, rightReps: 8 }, oneArm)).toBe(320);
    const bulgarian = { ...exercise, unilateral: true, loadMultiplier: 2 as const };
    expect(setVolume({ ...set, rightWeight: 15, rightReps: 8 }, bulgarian)).toBe(640);
    expect(setVolume({ ...set, rightWeight: 0, rightReps: 8 }, oneArm)).toBe(200);
  });

  it('excludes bodyweight and assistance from volume, even if a weight is saved', () => {
    const { exercise, set } = fixture();
    expect(setVolume(set, { ...exercise, loadMode: 'bodyweight' })).toBe(0);
    expect(setVolume(set, { ...exercise, loadMode: 'assisted' })).toBe(0);
  });

  it('uses Brzycki only for positive weight and integer repetitions from 1 to 10', () => {
    expect(estimatedOneRepMax(100, 1)).toBe(100);
    expect(estimatedOneRepMax(60, 10)).toBe(80);
    for (const reps of [0, 11, 8.5, NaN, Infinity]) expect(estimatedOneRepMax(60, reps)).toBeNull();
    for (const weight of [0, -10, NaN, Infinity]) expect(estimatedOneRepMax(weight, 8)).toBeNull();
  });
});

describe('History and records', () => {
  it('ignores incomplete sessions and sets, including soft-deleted records', () => {
    const { session, set } = fixture();
    expect(completedEntries([session], [set])).toHaveLength(1);
    expect(completedEntries([{ ...session, status: 'active' }], [set])).toHaveLength(0);
    expect(completedEntries([session], [{ ...set, completedAt: null }])).toHaveLength(0);
    expect(completedEntries([session], [{ ...set, deletedAt: 100 }])).toHaveLength(0);
    expect(completedEntries([{ ...session, deletedAt: 100 }], [set])).toHaveLength(0);
  });

  it('tracks load at equal reps and reps at equal load, retaining the first tied record', () => {
    const { session, set } = fixture();
    const next: SetEntry = { ...set, id: 'second', index: 1, completedAt: set.completedAt! + 1000 };
    const records = personalRecords([session], [set, next]);
    expect(records.every((record) => record.setId === set.id)).toBe(true);
    next.weight = 25;
    const loadRecord = personalRecords([session], [set, next]).find((r) => r.kind === 'weight' && r.atReps === 10)!;
    expect(loadRecord.value).toBe(25);
    expect(loadRecord.setId).toBe('second');
    next.weight = 20;
    next.reps = 12;
    expect(personalRecords([session], [set, next]).find((r) => r.kind === 'reps' && r.atWeight === 20)?.value).toBe(12);
    next.deletedAt = 100;
    expect(personalRecords([session], [set, next]).find((r) => r.kind === 'reps' && r.atWeight === 20)?.value).toBe(10);
  });

  it('considers less assistance a better weight record and never estimates its maximum', () => {
    const { session, set } = fixture();
    session.exercises[0].snapshot.loadMode = 'assisted';
    const next = { ...set, id: 'second', weight: 10, completedAt: set.completedAt! + 1000 };
    const records = personalRecords([session], [set, next]);
    expect(records.find((r) => r.kind === 'weight')?.value).toBe(10);
    expect(records.some((r) => r.kind === 'estimated-max')).toBe(false);
    session.exercises[0].snapshot.loadMode = 'bodyweight';
    expect(personalRecords([session], [{ ...set, weight: 0 }, { ...next, weight: 0 }]).every((r) => r.kind === 'reps')).toBe(true);
  });

  it('keeps added bodyweight load out of volume/e1RM but separates repetition records by added load', () => {
    const { session, set } = fixture();
    session.exercises[0].snapshot.loadMode = 'bodyweight';
    const weighted = { ...set, weight: 10, reps: 8 };
    const unweighted = { ...set, id: 'unweighted', weight: 0, reps: 12, completedAt: set.completedAt! + 1000 };
    const records = personalRecords([session], [weighted, unweighted]);
    expect(setVolume(weighted, session.exercises[0].snapshot)).toBe(0);
    expect(records.some((record) => record.kind === 'estimated-max')).toBe(false);
    expect(records.find((record) => record.kind === 'reps' && record.atWeight === 10)?.value).toBe(8);
    expect(records.find((record) => record.kind === 'reps' && record.atWeight === 0)?.value).toBe(12);
    expect(records.find((record) => record.kind === 'weight' && record.atReps === 8)?.value).toBe(10);
  });

  it('separates equipment conventions and left/right records, preserving RIR zero', () => {
    const { session, set } = fixture();
    session.exercises[0].snapshot.unilateral = true;
    const records = personalRecords([session], [{ ...set, rir: 0, rightWeight: 15, rightReps: 8 }]);
    expect(records.find((r) => r.kind === 'estimated-max' && r.side === 'left')?.rir).toBe(0);
    expect(records.find((r) => r.kind === 'weight' && r.side === 'right')?.value).toBe(15);
    const other: WorkoutSession = structuredClone(session);
    other.id = 'different-convention';
    other.exercises[0].snapshot.equipment = 'Macchina';
    expect(personalRecords([session, other], [set, { ...set, id: 'other', sessionId: other.id }]).length).toBe(records.length * 2);
  });
});

describe('Calendar periods', () => {
  it.each([7, 30, 90])('returns every one of the %i calendar days, including days with no workout', (days) => {
    const { session } = fixture();
    const now = new Date(2026, 8, 10, 12).getTime();
    const period = comparisonPeriod(now, days);
    const calendar = trainingCalendar([{ ...session, startedAt: period.currentStart }, { ...session, id: 'second', startedAt: period.currentStart + 1000 }, { ...session, id: 'before', startedAt: period.currentStart - 1 }], now, days);
    expect(calendar).toHaveLength(days);
    expect(calendar[0]).toEqual({ date: period.currentStart, workouts: 2 });
    expect(calendar.slice(1).every((day) => day.workouts === 0)).toBe(true);
    expect(calendar.at(-1)?.date).toBe(+new Date(2026, 8, 10));
  });

  it('keeps leap day and each local date across both daylight-saving changes', () => {
    const leap = trainingCalendar([], +new Date(2024, 2, 1, 12), 7);
    expect(leap.map((day) => new Date(day.date).getDate())).toEqual([24, 25, 26, 27, 28, 29, 1]);
    for (const now of [+new Date(2026, 2, 31, 12), +new Date(2026, 9, 27, 12)]) {
      const calendar = trainingCalendar([], now, 7);
      expect(calendar).toHaveLength(7);
      expect(new Set(calendar.map((day) => new Date(day.date).toDateString())).size).toBe(7);
      expect(calendar.every((day) => new Date(day.date).getHours() === 0)).toBe(true);
    }
  });

  it('covers the entire all-time span, including empty years between recorded workouts', () => {
    const { session } = fixture();
    const now = +new Date(2026, 0, 2, 12);
    const calendar = trainingCalendar([{ ...session, startedAt: +new Date(2024, 11, 31, 10) }, { ...session, id: 'latest', startedAt: +new Date(2026, 0, 1, 10) }, { ...session, id: 'ignored', status: 'active', startedAt: +new Date(2020, 0, 1) }], now, null);
    expect(calendar).toHaveLength(368);
    expect(calendar[0].date).toBe(+new Date(2024, 11, 31));
    expect(calendar.filter((day) => new Date(day.date).getFullYear() === 2025)).toHaveLength(365);
    expect(calendar.reduce((sum, day) => sum + day.workouts, 0)).toBe(2);
    expect(calendar.at(-1)?.date).toBe(+new Date(2026, 0, 2));
  });

  it.each([7, 30, 90])('keeps totals, history, muscles and records inside a %i-day selection', (days) => {
    const { session, set } = fixture();
    const now = new Date(2026, 8, 10, 12).getTime();
    const period = comparisonPeriod(now, days);
    const expectedStart = new Date(2026, 8, 11);
    expectedStart.setDate(expectedStart.getDate() - days);
    expect(period.currentStart).toBe(+expectedStart);
    const sessions = [period.previousStart - 1, period.previousStart, period.currentStart - 1, period.currentStart, period.currentEnd - 1, period.currentEnd]
      .map((startedAt, index) => ({ ...session, id: `s${index}`, startedAt, finishedAt: startedAt + 60_000 }));
    const sets = sessions.map((item, index) => ({ ...set, id: `set-${item.id}`, sessionId: item.id, completedAt: item.startedAt + 1000, weight: index === 3 ? 25 : 20 }));
    const result = calculateStats(sessions, sets, now, days);
    expect(result.current.workouts).toBe(2);
    expect(result.previous.workouts).toBe(2);
    expect(result.current.sets).toBe(2);
    expect(result.current.volume).toBe(900);
    expect(result.change.volume).toBe(12.5);
    expect(result.history.map((item) => item.sessionId)).toEqual(['s4', 's3']);
    expect(result.muscles).toEqual([{ name: 'Petto', sets: 2 }]);
    expect(result.records.every((record) => ['s3', 's4'].includes(record.sessionId))).toBe(true);
    expect(result.records.find((record) => record.kind === 'weight')?.value).toBe(25);
  });

  it('includes old history in all-time stats without inventing a comparison or including tomorrow', () => {
    const { session, set } = fixture();
    const now = new Date(2026, 8, 10, 12).getTime();
    const tomorrow = new Date(2026, 8, 11).getTime();
    const starts = [new Date(2020, 0, 1).getTime(), session.startedAt, tomorrow];
    const sessions = starts.map((startedAt, index) => ({ ...session, id: `s${index}`, startedAt, finishedAt: startedAt + 60_000 }));
    const sets = sessions.map((item) => ({ ...set, id: `set-${item.id}`, sessionId: item.id, completedAt: item.startedAt + 1000 }));
    const result = calculateStats(sessions, sets, now, null);
    expect(result.current.workouts).toBe(2);
    expect(result.current.sets).toBe(2);
    expect(result.history.map((item) => item.sessionId)).toEqual(['s1', 's0']);
    expect(result.previous.workouts).toBe(0);
    expect(result.change).toEqual({ workouts: null, sets: null, volume: null });
    expect(result.records.every((record) => record.sessionId !== 's2')).toBe(true);
  });

  it('uses calendar dates across month, leap-day and daylight-saving boundaries', () => {
    const march = comparisonPeriod(new Date(2024, 2, 1, 12).getTime(), 7);
    expect(new Date(march.currentStart)).toEqual(new Date(2024, 1, 24));
    expect(new Date(march.previousStart)).toEqual(new Date(2024, 1, 17));
    const dst = comparisonPeriod(new Date(2026, 2, 31, 12).getTime(), 7);
    expect(new Date(dst.currentStart)).toEqual(new Date(2026, 2, 25));
    expect(new Date(dst.previousStart)).toEqual(new Date(2026, 2, 18));
  });

  it('uses local 28-day boundaries, assigning the exact boundary only to its own period', () => {
    const { session, set } = fixture();
    const now = new Date(2026, 8, 10, 12).getTime();
    const period = comparisonPeriod(now);
    expect(new Date(period.currentEnd)).toEqual(new Date(2026, 8, 11));
    expect(new Date(period.currentStart)).toEqual(new Date(2026, 7, 14));
    expect(new Date(period.previousStart)).toEqual(new Date(2026, 6, 17));
    const sessions = [period.previousStart - 1, period.previousStart, period.currentStart - 1, period.currentStart, period.currentEnd - 1, period.currentEnd].map((start, index) => ({ ...session, id: `s${index}`, startedAt: start, finishedAt: start + 60_000 }));
    const sets = sessions.map((s) => ({ ...set, id: `set-${s.id}`, sessionId: s.id }));
    const result = calculateStats(sessions, sets, now);
    expect(result.current.workouts).toBe(2);
    expect(result.previous.workouts).toBe(2);
    expect(result.current.volume).toBe(800);
    expect(result.change.volume).toBe(0);
    expect(result.muscles.find((m) => m.name === 'Petto')?.sets).toBe(2);
  });

  it('keeps zero baselines undefined instead of reporting infinite growth', () => {
    const { session, set } = fixture();
    const result = calculateStats([session], [set], new Date(2026, 8, 10, 12).getTime());
    expect(result.change.volume).toBeNull();
    expect(result.current.minutes).toBe(60);
    expect(calculateStats([], []).current).toEqual({ workouts: 0, sets: 0, volume: 0, minutes: 0, assistedReps: 0, bodyweightReps: 0 });
  });

  it('excludes explicit pauses from both total and historical workout duration', () => {
    const { session, set } = fixture();
    const result = calculateStats([{ ...session, pausedDurationMs: 10 * 60_000 }], [set], new Date(2026, 8, 10, 12).getTime());
    expect(result.current.minutes).toBe(50);
    expect(result.history[0].minutes).toBe(50);
  });
});

describe('Session feedback statistics', () => {
  it('averages recorded feedback in the selected range, excluding missing fields but preserving zero sleep', () => {
    const { session } = fixture();
    const now = +new Date(2026, 8, 10, 12);
    const period = comparisonPeriod(now, 7);
    const sessions: WorkoutSession[] = [
      { ...session, id: 'at-boundary', startedAt: period.currentStart, energy: 2, sleepHours: 0 },
      { ...session, id: 'recorded', energy: 4, sleepHours: 8 },
      { ...session, id: 'legacy' },
      { ...session, id: 'empty', energy: null, sleepHours: null },
      { ...session, id: 'sleep-only', sleepHours: 7 },
      { ...session, id: 'before', startedAt: period.currentStart - 1, energy: 5, sleepHours: 24 },
      { ...session, id: 'after', startedAt: period.currentEnd, energy: 5, sleepHours: 24 },
      { ...session, id: 'active', status: 'active', energy: 5, sleepHours: 24 },
      { ...session, id: 'deleted', deletedAt: now, energy: 5, sleepHours: 24 },
    ];
    const result = calculateStats(sessions, [], now, 7);
    expect(result.current.workouts).toBe(5);
    expect(result.feedback).toEqual({ energy: { average: 3, count: 2 }, sleepHours: { average: 5, count: 3 } });
    expect(calculateStats(sessions, [], now, null).feedback.energy).toEqual({ average: 11 / 3, count: 3 });
  });

  it('reports missing feedback as unavailable instead of zero', () => {
    const { session } = fixture();
    const result = calculateStats([session], [], +new Date(2026, 8, 10, 12), 30);
    expect(result.feedback).toEqual({ energy: { average: null, count: 0 }, sleepHours: { average: null, count: 0 } });
    expect(calculateStats([], []).feedback).toEqual(result.feedback);
  });
});
