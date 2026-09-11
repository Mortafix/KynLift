import type { Exercise, ExerciseSnapshot, Routine, SessionExercise, SetEntry, WorkoutSession } from '../types';

export const id = () => crypto.randomUUID();

/** Convention changes intentionally start a new comparable history. */
export function exerciseKey(exercise: ExerciseSnapshot): string {
  return JSON.stringify([exercise.id, exercise.equipment, exercise.loadMode, exercise.loadMultiplier, exercise.unilateral]);
}

export function createSession(routine: Routine, exercises: Exercise[], now = Date.now()): WorkoutSession {
  const snapshots: SessionExercise[] = routine.exercises.map((entry) => {
    const exercise = exercises.find((item) => item.id === entry.exerciseId && !item.deletedAt);
    if (!exercise) throw new Error('Un esercizio della scheda non è più disponibile. Modifica la scheda prima di iniziare.');
    const { id: exerciseId, name, equipment, muscleGroup, loadMode, loadMultiplier, unilateral, increment } = exercise;
    const { sets, repsMin, repsMax, rir, restSeconds, note } = entry;
    return {
      id: entry.id,
      sourceExerciseId: exerciseId,
      snapshot: { id: exerciseId, name, equipment, muscleGroup, loadMode, loadMultiplier, unilateral, increment },
      target: { sets, repsMin, repsMax, rir, restSeconds, note },
      note: '',
    };
  });
  if (!snapshots.length) throw new Error('Aggiungi almeno un esercizio alla scheda.');
  return {
    id: id(), createdAt: now, updatedAt: now, routineId: routine.id, routineName: routine.name,
    startedAt: now, finishedAt: null, status: 'active', exercises: snapshots, note: '',
    currentExercise: 0, currentSet: 0, restEndsAt: null, restDuration: snapshots[0].target.restSeconds,
    workStartedAt: now, pausedAt: null, pausedDurationMs: 0,
  };
}

export function createSet(
  session: WorkoutSession,
  exercise: SessionExercise,
  index: number,
  suggestion?: Partial<SetEntry>,
  now = Date.now(),
): SetEntry {
  if (!Number.isInteger(index) || index < 0) throw new Error('Indice della serie non valido.');
  return {
    id: `${session.id}:${exercise.id}:${index}`, createdAt: now, updatedAt: now,
    sessionId: session.id, sessionExerciseId: exercise.id, index,
    weight: suggestion?.weight ?? 0,
    reps: suggestion?.reps ?? exercise.target.repsMax,
    rir: suggestion?.rir !== undefined ? suggestion.rir : exercise.target.rir,
    rightWeight: suggestion?.rightWeight ?? null, rightReps: suggestion?.rightReps ?? null,
    note: '', completedAt: null,
  };
}

export function sessionCompletedSets(session: WorkoutSession, sets: SetEntry[]): SetEntry[] {
  if (session.deletedAt || session.status === 'discarded') return [];
  return sets.filter((set) => set.sessionId === session.id && !set.deletedAt && set.completedAt !== null)
    .sort((a, b) => session.exercises.findIndex((e) => e.id === a.sessionExerciseId)
      - session.exercises.findIndex((e) => e.id === b.sessionExerciseId) || a.index - b.index);
}

/** Only completed workouts can propose an actual previous performance. */
export function previousSet(
  exercise: SessionExercise, index: number, sessions: WorkoutSession[], sets: SetEntry[], before = Infinity,
): SetEntry | undefined {
  const key = exerciseKey(exercise.snapshot);
  const ordered = sessions.filter((s) => !s.deletedAt && s.status === 'completed' && s.startedAt < before)
    .sort((a, b) => b.startedAt - a.startedAt);
  for (const session of ordered) {
    const matches = session.exercises.filter((e) => exerciseKey(e.snapshot) === key);
    for (const candidate of matches) {
      const entries = sessionCompletedSets(session, sets).filter((set) => set.sessionExerciseId === candidate.id);
      const result = entries.find((set) => set.index === index) ?? entries.at(-1);
      if (result) return result;
    }
  }
  return undefined;
}

/** Keep entered sets intact; new sets carry the latest load from this exercise. */
export function initialSet(
  session: WorkoutSession, exercise: SessionExercise, index: number, sessions: WorkoutSession[], sets: SetEntry[],
): SetEntry {
  const current = sets.filter((set) => set.sessionId === session.id && set.sessionExerciseId === exercise.id && !set.deletedAt);
  const existing = current.find((set) => set.index === index);
  if (existing) return existing;
  const previous = previousSet(exercise, index, sessions, sets, session.startedAt);
  const latest = current.filter((set) => !validateSet(set, exercise.snapshot))
    .sort((a, b) => b.updatedAt - a.updatedAt || b.index - a.index)[0];
  return createSet(session, exercise, index, latest ? {
    ...previous,
    weight: latest.weight,
    rightWeight: latest.rightWeight,
    rightReps: latest.rightWeight !== null || latest.rightReps !== null ? previous?.rightReps ?? null : null,
  } : previous);
}

export function loadLabel(exercise: Pick<ExerciseSnapshot, 'loadMode' | 'unilateral' | 'loadMultiplier'>): string {
  if (exercise.loadMode === 'assisted') return 'kg di assistenza';
  if (exercise.loadMode === 'bodyweight') return 'corpo libero';
  if (exercise.unilateral) return 'kg per lato';
  if (exercise.loadMode === 'per-hand') return 'kg per manubrio';
  return 'kg totali';
}

export function formatNumber(value: number, maximumFractionDigits = 1): string {
  return new Intl.NumberFormat('it-IT', { maximumFractionDigits }).format(value);
}

export function formatDate(value: number, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }): string {
  return new Intl.DateTimeFormat('it-IT', options).format(value);
}

export function validateSet(set: SetEntry, exercise: ExerciseSnapshot, requireRir = false): string | null {
  if (!Number.isFinite(set.weight) || set.weight < 0 || set.weight > 2000) return 'Inserisci un peso tra 0 e 2.000 kg.';
  if (!Number.isInteger(set.reps) || set.reps < 1 || set.reps > 999) return 'Inserisci da 1 a 999 ripetizioni.';
  if (requireRir && set.rir === null) return 'Inserisci il RIR tra 0 e 10.';
  if (set.rir !== null && (!Number.isInteger(set.rir) || set.rir < 0 || set.rir > 10)) return 'Il RIR deve essere tra 0 e 10.';
  if (exercise.unilateral) {
    if (set.rightWeight !== null && (!Number.isFinite(set.rightWeight) || set.rightWeight < 0 || set.rightWeight > 2000)) return 'Controlla il peso del lato destro.';
    if (set.rightReps !== null && (!Number.isInteger(set.rightReps) || set.rightReps < 1 || set.rightReps > 999)) return 'Controlla le ripetizioni del lato destro.';
  }
  return null;
}
