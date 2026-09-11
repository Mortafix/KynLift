export type LoadMode = 'total' | 'per-hand' | 'bodyweight' | 'assisted';
export type MuscleGroup = 'Gambe' | 'Glutei' | 'Dorso' | 'Petto' | 'Spalle' | 'Bicipiti' | 'Tricipiti' | 'Core' | 'Altro';

export interface Entity {
  id: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
}

export interface ExerciseSnapshot {
  id: string;
  name: string;
  equipment: string;
  muscleGroup: MuscleGroup;
  loadMode: LoadMode;
  loadMultiplier: 1 | 2;
  unilateral: boolean;
  increment: number;
}

export interface Exercise extends Entity, ExerciseSnapshot {}

export interface Prescription {
  sets: number;
  repsMin: number;
  repsMax: number;
  rir: number | null;
  restSeconds: number;
  note: string;
}

export interface RoutineExercise extends Prescription {
  id: string;
  exerciseId: string;
}

export interface Routine extends Entity {
  name: string;
  description: string;
  exercises: RoutineExercise[];
}

export interface SessionExercise {
  id: string;
  sourceExerciseId: string;
  snapshot: ExerciseSnapshot;
  target: Prescription;
  note: string;
}

export interface WorkoutSession extends Entity {
  routineId: string | null;
  routineName: string;
  startedAt: number;
  finishedAt: number | null;
  status: 'active' | 'completed' | 'discarded';
  exercises: SessionExercise[];
  note: string;
  currentExercise: number;
  currentSet: number;
  restEndsAt: number | null;
  restDuration: number;
  /** Optional for sessions saved before exercise timing was introduced. */
  workStartedAt?: number | null;
  pausedAt?: number | null;
  pausedDurationMs?: number;
  /** Absent in legacy sessions; never infer an unrecorded self-assessment. */
  energy?: number | null;
  sleepHours?: number | null;
}

export interface SessionFeedback {
  energy: number;
  sleepHours: number;
  note: string;
}

export interface SetEntry extends Entity {
  sessionId: string;
  sessionExerciseId: string;
  index: number;
  weight: number;
  reps: number;
  rir: number | null;
  rightWeight: number | null;
  rightReps: number | null;
  note: string;
  completedAt: number | null;
  /** Active time for this series, excluding recovery and pauses. */
  durationMs?: number | null;
}

export interface AppData {
  exercises: Exercise[];
  routines: Routine[];
  sessions: WorkoutSession[];
  sets: SetEntry[];
}

export type CollectionName = keyof AppData;
export type DataChange = {
  [K in CollectionName]: { collection: K; value: AppData[K][number] }
}[CollectionName];

export interface KinUser { uid: string; displayName: string | null; email: string | null; providers: string[] }
export type SyncStatus = 'local' | 'offline' | 'pending' | 'synced' | 'error';
