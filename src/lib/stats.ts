import type { ExerciseSnapshot, LoadMode, MuscleGroup, SetEntry, WorkoutSession } from '../types';
import { exerciseKey, sessionCompletedSets } from './domain';
import { sessionDurationSeconds } from './workout-actions';

export interface CompletedEntry {
  session: WorkoutSession;
  exercise: ExerciseSnapshot;
  set: SetEntry;
}

export interface PeriodTotals {
  workouts: number; sets: number; volume: number; bodyweightReps: number; assistedReps: number; minutes: number;
}

export interface PersonalRecord {
  key: string; exerciseId: string; exerciseName: string;
  kind: 'weight' | 'reps' | 'estimated-max';
  value: number; atReps?: number; atWeight?: number;
  date: number; setId: string; sessionId: string; rir: number | null;
  side: 'both' | 'left' | 'right'; loadMode: LoadMode;
}

export interface SessionSummary {
  sessionId: string; date: number; name: string; sets: number; volume: number; minutes: number;
}

export interface FeedbackAverage { average: number | null; count: number }
export interface TrainingDay { date: number; workouts: number }

export interface StatsSummary {
  current: PeriodTotals;
  previous: PeriodTotals;
  change: { workouts: number | null; sets: number | null; volume: number | null };
  period: { currentStart: number; currentEnd: number; previousStart: number; previousEnd: number };
  history: SessionSummary[];
  muscles: { name: MuscleGroup; sets: number }[];
  records: PersonalRecord[];
  feedback: { energy: FeedbackAverage; sleepHours: FeedbackAverage };
}

export function setVolume(set: SetEntry, exercise: ExerciseSnapshot): number {
  if (exercise.loadMode === 'bodyweight' || exercise.loadMode === 'assisted') return 0;
  if (exercise.unilateral) return (set.weight * set.reps + (set.rightWeight ?? set.weight) * (set.rightReps ?? set.reps)) * exercise.loadMultiplier;
  return set.weight * exercise.loadMultiplier * set.reps;
}

export function setRepetitions(set: SetEntry, exercise: ExerciseSnapshot): number {
  return set.reps + (exercise.unilateral ? set.rightReps ?? set.reps : 0);
}

export function estimatedOneRepMax(weight: number, reps: number): number | null {
  if (!Number.isFinite(weight) || weight <= 0 || !Number.isInteger(reps) || reps < 1 || reps > 10) return null;
  return weight * 36 / (37 - reps);
}

export function completedEntries(sessions: WorkoutSession[], sets: SetEntry[]): CompletedEntry[] {
  return sessions.filter((s) => !s.deletedAt && s.status === 'completed')
    .flatMap((session) => sessionCompletedSets(session, sets).flatMap((set) => {
      const exercise = session.exercises.find((e) => e.id === set.sessionExerciseId)?.snapshot;
      return exercise ? [{ session, exercise, set }] : [];
    }))
    .sort((a, b) => a.session.startedAt - b.session.startedAt || (a.set.completedAt ?? 0) - (b.set.completedAt ?? 0) || a.set.index - b.set.index);
}

/** Current records are recomputed from saved history; equal values retain the first achievement. */
export function personalRecords(sessions: WorkoutSession[], sets: SetEntry[]): PersonalRecord[] {
  const records = new Map<string, PersonalRecord>();
  for (const { session, exercise, set } of completedEntries(sessions, sets)) {
    const sides: { side: PersonalRecord['side']; weight: number; reps: number }[] = exercise.unilateral
      ? [{ side: 'left', weight: set.weight, reps: set.reps }, { side: 'right', weight: set.rightWeight ?? set.weight, reps: set.rightReps ?? set.reps }]
      : [{ side: 'both', weight: set.weight, reps: set.reps }];
    for (const { side, weight, reps } of sides) {
      const baseKey = `${exerciseKey(exercise)}:${side}`;
      const base = {
        exerciseId: exercise.id, exerciseName: exercise.name, date: set.completedAt ?? session.startedAt,
        setId: set.id, sessionId: session.id, rir: set.rir, side, loadMode: exercise.loadMode,
      };
      const add = (kind: PersonalRecord['kind'], key: string, value: number, extra: { atReps?: number; atWeight?: number }, lower = false) => {
        const old = records.get(key);
        if (!old || (lower ? value < old.value : value > old.value)) records.set(key, { ...base, ...extra, key, kind, value });
      };
      if (exercise.loadMode !== 'bodyweight' || weight > 0) add('weight', `${baseKey}:weight:${reps}`, weight, { atReps: reps }, exercise.loadMode === 'assisted');
      add('reps', `${baseKey}:reps:${weight}`, reps, { atWeight: weight });
      if (exercise.loadMode !== 'assisted' && exercise.loadMode !== 'bodyweight') {
        const e1rm = estimatedOneRepMax(weight, reps);
        if (e1rm !== null) add('estimated-max', `${baseKey}:estimated-max`, e1rm, { atWeight: weight, atReps: reps });
      }
    }
  }
  return [...records.values()].sort((a, b) => b.date - a.date || a.exerciseName.localeCompare(b.exerciseName));
}

export function exerciseHistory(exerciseId: string, sessions: WorkoutSession[], sets: SetEntry[]): CompletedEntry[] {
  return completedEntries(sessions, sets).filter((entry) => entry.exercise.id === exerciseId);
}

/** Calendar-day windows use local midnight, including DST changes, and include today. Null selects all history. */
export function comparisonPeriod(now = Date.now(), days: number | null = 28): StatsSummary['period'] {
  const end = new Date(now);
  end.setHours(0, 0, 0, 0);
  end.setDate(end.getDate() + 1);
  if (days === null) return { currentStart: -Infinity, currentEnd: +end, previousStart: -Infinity, previousEnd: -Infinity };
  const currentStart = new Date(end);
  currentStart.setDate(currentStart.getDate() - days);
  const previousStart = new Date(currentStart);
  previousStart.setDate(previousStart.getDate() - days);
  return { currentStart: +currentStart, currentEnd: +end, previousStart: +previousStart, previousEnd: +currentStart };
}

/** One entry per local calendar day, including untrained days and DST transitions. */
export function trainingCalendar(sessions: WorkoutSession[], now = Date.now(), days: number | null = 28): TrainingDay[] {
  const period = comparisonPeriod(now, days);
  const included = sessions.filter((session) => !session.deletedAt && session.status === 'completed' && session.startedAt >= period.currentStart && session.startedAt < period.currentEnd);
  const counts = new Map<string, number>();
  for (const session of included) {
    const key = new Date(session.startedAt).toDateString();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const first = days === null ? included.reduce((earliest, session) => Math.min(earliest, session.startedAt), now) : period.currentStart;
  const day = new Date(first);
  day.setHours(0, 0, 0, 0);
  const calendar: TrainingDay[] = [];
  while (+day < period.currentEnd) {
    calendar.push({ date: +day, workouts: counts.get(day.toDateString()) ?? 0 });
    day.setDate(day.getDate() + 1);
  }
  return calendar;
}

export function calculateStats(sessions: WorkoutSession[], sets: SetEntry[], now = Date.now(), days: number | null = 28): StatsSummary {
  const entries = completedEntries(sessions, sets);
  const complete = sessions.filter((s) => !s.deletedAt && s.status === 'completed');
  const period = comparisonPeriod(now, days);
  const selected = complete.filter((session) => session.startedAt >= period.currentStart && session.startedAt < period.currentEnd);
  const totals = (start: number, end: number): PeriodTotals => {
    const included = complete.filter((s) => s.startedAt >= start && s.startedAt < end);
    const sessionIds = new Set(included.map((s) => s.id));
    const periodEntries = entries.filter((e) => sessionIds.has(e.session.id));
    return {
      workouts: included.length,
      sets: periodEntries.length,
      volume: periodEntries.reduce((sum, e) => sum + setVolume(e.set, e.exercise), 0),
      bodyweightReps: periodEntries.filter((e) => e.exercise.loadMode === 'bodyweight').reduce((sum, e) => sum + setRepetitions(e.set, e.exercise), 0),
      assistedReps: periodEntries.filter((e) => e.exercise.loadMode === 'assisted').reduce((sum, e) => sum + setRepetitions(e.set, e.exercise), 0),
      minutes: included.reduce((sum, session) => sum + sessionDurationSeconds(session, session.startedAt) / 60, 0),
    };
  };
  const current = totals(period.currentStart, period.currentEnd);
  const previous = totals(period.previousStart, period.previousEnd);
  const average = (values: (number | null | undefined)[], valid: (value: number) => boolean): FeedbackAverage => {
    const recorded = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && valid(value));
    return { average: recorded.length ? recorded.reduce((sum, value) => sum + value, 0) / recorded.length : null, count: recorded.length };
  };
  const change = (a: number, b: number) => b === 0 ? null : (a - b) / b * 100;
  const muscles = new Map<MuscleGroup, number>();
  for (const entry of entries) {
    if (entry.session.startedAt >= period.currentStart && entry.session.startedAt < period.currentEnd) {
      muscles.set(entry.exercise.muscleGroup, (muscles.get(entry.exercise.muscleGroup) ?? 0) + 1);
    }
  }
  return {
    current, previous,
    change: { workouts: change(current.workouts, previous.workouts), sets: change(current.sets, previous.sets), volume: change(current.volume, previous.volume) },
    period,
    history: selected.map((session) => {
      const own = entries.filter((e) => e.session.id === session.id);
      return {
        sessionId: session.id, date: session.startedAt, name: session.routineName, sets: own.length,
        volume: own.reduce((sum, e) => sum + setVolume(e.set, e.exercise), 0),
        minutes: sessionDurationSeconds(session, session.startedAt) / 60,
      };
    }).sort((a, b) => b.date - a.date),
    muscles: [...muscles].map(([name, count]) => ({ name, sets: count })).sort((a, b) => b.sets - a.sets),
    records: personalRecords(selected, sets),
    feedback: {
      energy: average(selected.map((session) => session.energy), (value) => Number.isInteger(value) && value >= 1 && value <= 5),
      sleepHours: average(selected.map((session) => session.sleepHours), (value) => value >= 0 && value <= 24),
    },
  };
}
