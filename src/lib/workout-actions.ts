import type { AppData, DataChange, SessionFeedback, SetEntry, WorkoutSession } from '../types';
import { sessionCompletedSets, validateSet } from './domain';

export type SessionAction = (current: WorkoutSession) => DataChange[];

/** Every recipe sees the latest successful local write, even before React has
 * received its refresh. Failed writes never become the next recipe's base. */
export function createSessionWriter(initial: WorkoutSession, persist: (changes: DataChange[]) => Promise<void>) {
  let current = initial;
  let tail = Promise.resolve();
  let pending = 0;
  const observed = new WeakSet<WorkoutSession>([initial]);
  return {
    current: () => current,
    sync(value: WorkoutSession) {
      if (value.id !== current.id) throw new Error('La sessione è cambiata. Riapri l’allenamento.');
      // DataProvider publishes immutable snapshots after LocalStore resolves
      // server commit order. Client clocks must not overrule that decision.
      // Remember snapshots seen during saves too: a subsequent React render
      // with those same props must not undo the successful local write.
      if (observed.has(value)) return;
      observed.add(value);
      if (!pending) current = value;
    },
    write(action: SessionAction): Promise<void> {
      pending++;
      const operation = tail.catch(() => undefined).then(async () => {
        const changes = action(current);
        for (const change of changes) if (change.collection === 'sessions') {
          if (change.value.id !== current.id) throw new Error('La modifica appartiene a un altro allenamento.');
          change.value = { ...change.value, updatedAt: Math.max(change.value.updatedAt, current.updatedAt + 1) };
        }
        await persist(changes);
        const session = changes.find((change) => change.collection === 'sessions');
        if (session?.collection === 'sessions') current = session.value;
      }).finally(() => { pending--; });
      tail = operation;
      return operation;
    },
  };
}

/** A saved set and cursor/timer update commit together in the local database. */
export function completeSetChanges(session: WorkoutSession, entry: SetEntry, now = Date.now()): DataChange[] {
  const exerciseIndex = session.exercises.findIndex((exercise) => exercise.id === entry.sessionExerciseId);
  const exercise = session.exercises[exerciseIndex];
  if (!exercise || entry.sessionId !== session.id) throw new Error('Questa serie non appartiene alla sessione.');
  if (session.status === 'discarded' || session.deletedAt) throw new Error('Questa sessione è stata annullata.');
  if (!Number.isInteger(entry.index) || entry.index < 0 || entry.index >= exercise.target.sets) throw new Error('La serie non è prevista in questo esercizio.');
  if (session.status === 'active' && session.pausedAt != null) throw new Error('Riprendi l’allenamento prima di salvare la serie.');
  const error = validateSet(entry, exercise.snapshot, session.status === 'active');
  if (error) throw new Error(error);
  const changes: DataChange[] = [{ collection: 'sets', value: {
    ...entry, completedAt: entry.completedAt ?? now, updatedAt: now,
    durationMs: entry.completedAt !== null ? entry.durationMs ?? null : session.workStartedAt != null ? Math.max(0, now - session.workStartedAt) : null,
  } }];
  if (session.status === 'active' && entry.completedAt === null) {
    const nextSet = entry.index + 1;
    const nextExercise = nextSet >= exercise.target.sets && exerciseIndex + 1 < session.exercises.length ? exerciseIndex + 1 : exerciseIndex;
    const currentSet = nextExercise !== exerciseIndex ? 0 : Math.min(nextSet, exercise.target.sets - 1);
    changes.push({ collection: 'sessions', value: {
      ...session, currentExercise: nextExercise, currentSet, updatedAt: now,
      restEndsAt: exercise.target.restSeconds > 0 ? now + exercise.target.restSeconds * 1000 : null,
      workStartedAt: now + exercise.target.restSeconds * 1000,
      restDuration: session.exercises[nextExercise].target.restSeconds,
    } });
  }
  return changes;
}

export const ENERGY_LABELS = ['Molto bassa', 'Bassa', 'Media', 'Alta', 'Molto alta'] as const;

export function validateSessionFeedback(feedback: SessionFeedback): string | null {
  if (!Number.isInteger(feedback.energy) || feedback.energy < 1 || feedback.energy > 5) return 'Seleziona come ti sentivi durante l’allenamento.';
  if (!Number.isFinite(feedback.sleepHours) || feedback.sleepHours < 0 || feedback.sleepHours > 24 || !Number.isInteger(feedback.sleepHours * 2)) return 'Inserisci le ore di sonno da 0 a 24, anche a intervalli di mezz’ora.';
  if (typeof feedback.note !== 'string' || feedback.note.length > 5000) return 'Le note possono contenere al massimo 5000 caratteri.';
  return null;
}

export function updateSessionFeedbackChanges(session: WorkoutSession, feedback: SessionFeedback, now = Date.now()): DataChange[] {
  if (session.status !== 'completed' || session.deletedAt) throw new Error('Questo allenamento non è disponibile nello storico.');
  const error = validateSessionFeedback(feedback);
  if (error) throw new Error(error);
  return [{ collection: 'sessions', value: { ...session, energy: feedback.energy, sleepHours: feedback.sleepHours, note: feedback.note, updatedAt: now } }];
}

export function finishSessionChanges(session: WorkoutSession, data: Pick<AppData, 'sets'>, feedback: string | SessionFeedback, now = Date.now()): DataChange[] {
  if (session.status === 'discarded' || session.deletedAt) throw new Error('Questa sessione è stata annullata.');
  if (!sessionCompletedSets(session, data.sets).length) throw new Error('Registra almeno una serie, oppure annulla la sessione.');
  if (typeof feedback !== 'string') {
    const error = validateSessionFeedback(feedback);
    if (error) throw new Error(error);
  }
  const assessment = typeof feedback === 'string' ? { note: feedback } : { note: feedback.note, energy: feedback.energy, sleepHours: feedback.sleepHours };
  return [{ collection: 'sessions', value: {
    ...session, ...assessment, status: 'completed', finishedAt: session.finishedAt ?? now,
    restEndsAt: null, workStartedAt: null, pausedAt: null,
    pausedDurationMs: (session.pausedDurationMs ?? 0) + (session.pausedAt != null ? Math.max(0, now - session.pausedAt) : 0), updatedAt: now,
  } }];
}

/** Absolute deadlines keep recovery and work accurate after backgrounding or reload.
 * A future workStartedAt means recovery is still in progress; no transition write is needed. */
export function workoutTimer(session: WorkoutSession, now = Date.now()): { phase: 'rest' | 'work'; seconds: number; paused: boolean } {
  const paused = session.pausedAt != null;
  const time = session.pausedAt ?? now;
  const recovery = remainingSeconds(session.restEndsAt, time);
  if (recovery > 0) return { phase: 'rest', seconds: recovery, paused };
  return { phase: 'work', seconds: session.workStartedAt == null ? 0 : Math.max(0, Math.floor((time - session.workStartedAt) / 1000)), paused };
}

/** Old sessions start recording from their first visit; never invent past work time. */
export function initializeSessionTimerChanges(session: WorkoutSession, now = Date.now()): DataChange[] {
  if (session.status !== 'active' || session.workStartedAt !== undefined) return [];
  return [{ collection: 'sessions', value: { ...session, workStartedAt: Math.max(session.pausedAt ?? now, session.restEndsAt ?? 0), pausedAt: session.pausedAt ?? null, pausedDurationMs: session.pausedDurationMs ?? 0, updatedAt: now } }];
}

export function pauseSessionChanges(session: WorkoutSession, now = Date.now()): DataChange[] {
  if (session.status !== 'active' || session.pausedAt != null) return [];
  return [{ collection: 'sessions', value: { ...session, pausedAt: now, updatedAt: now } }];
}

export function resumeSessionChanges(session: WorkoutSession, now = Date.now()): DataChange[] {
  if (session.status !== 'active' || session.pausedAt == null) return [];
  const pause = Math.max(0, now - session.pausedAt);
  return [{ collection: 'sessions', value: {
    ...session, pausedAt: null, pausedDurationMs: (session.pausedDurationMs ?? 0) + pause,
    restEndsAt: session.restEndsAt == null ? null : session.restEndsAt + pause,
    workStartedAt: session.workStartedAt == null ? Math.max(now, (session.restEndsAt ?? 0) + pause) : session.workStartedAt + pause,
    updatedAt: now,
  } }];
}

/** Session duration includes recovery, and excludes every explicit pause. */
export function sessionDurationSeconds(session: WorkoutSession, now = Date.now()): number {
  const end = session.finishedAt ?? session.pausedAt ?? now;
  return Math.max(0, (end - session.startedAt - (session.pausedDurationMs ?? 0)) / 1000);
}

export function remainingSeconds(endsAt: number | null, now = Date.now()): number {
  return endsAt === null ? 0 : Math.max(0, Math.ceil((endsAt - now) / 1000));
}

export function clockTime(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60).toString().padStart(2, '0')}:${(whole % 60).toString().padStart(2, '0')}`;
}
