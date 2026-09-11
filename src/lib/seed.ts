import type { AppData, Exercise, LoadMode, MuscleGroup, Routine, RoutineExercise } from '../types';
import { createSession, createSet } from './domain';

type CatalogRow = [string, string, string, MuscleGroup, LoadMode, 1 | 2, boolean];
const catalog: CatalogRow[] = [
  ['squat', 'Back squat', 'Bilanciere', 'Gambe', 'total', 1, false],
  ['hip-thrust', 'Hip thrust', 'Bilanciere', 'Glutei', 'total', 1, false],
  ['romanian-deadlift', 'Stacco rumeno', 'Bilanciere', 'Glutei', 'total', 1, false],
  ['leg-press', 'Leg press', 'Macchina', 'Gambe', 'total', 1, false],
  ['leg-curl', 'Leg curl', 'Macchina', 'Gambe', 'total', 1, false],
  ['leg-extension', 'Leg extension', 'Macchina', 'Gambe', 'total', 1, false],
  ['bulgarian', 'Bulgarian split squat', 'Manubri', 'Glutei', 'per-hand', 2, true],
  ['lunges', 'Affondi', 'Manubri', 'Gambe', 'per-hand', 2, true],
  ['calf-raise', 'Calf raise', 'Macchina', 'Gambe', 'total', 1, false],
  ['abductor', 'Abductor machine', 'Macchina', 'Glutei', 'total', 1, false],
  ['bench-press', 'Panca piana', 'Bilanciere', 'Petto', 'total', 1, false],
  ['incline-press', 'Panca inclinata', 'Manubri', 'Petto', 'per-hand', 2, false],
  ['chest-press', 'Chest press', 'Macchina', 'Petto', 'total', 1, false],
  ['cable-fly', 'Croci ai cavi', 'Cavi', 'Petto', 'per-hand', 2, false],
  ['push-up', 'Piegamenti', 'Corpo libero', 'Petto', 'bodyweight', 1, false],
  ['lat-pulldown', 'Lat machine', 'Macchina', 'Dorso', 'total', 1, false],
  ['cable-row', 'Pulley basso', 'Cavi', 'Dorso', 'total', 1, false],
  ['dumbbell-row', 'Rematore unilaterale', 'Manubrio', 'Dorso', 'per-hand', 1, true],
  ['barbell-row', 'Rematore con bilanciere', 'Bilanciere', 'Dorso', 'total', 1, false],
  ['pull-up', 'Trazioni', 'Sbarra', 'Dorso', 'bodyweight', 1, false],
  ['assisted-pull-up', 'Trazioni assistite', 'Macchina assistita', 'Dorso', 'assisted', 1, false],
  ['weighted-pull-up', 'Trazioni zavorrate', 'Sbarra + zavorra', 'Dorso', 'bodyweight', 1, false],
  ['shoulder-press', 'Shoulder press', 'Manubri', 'Spalle', 'per-hand', 2, false],
  ['lateral-raise', 'Alzate laterali', 'Manubri', 'Spalle', 'per-hand', 2, false],
  ['face-pull', 'Face pull', 'Cavi', 'Spalle', 'total', 1, false],
  ['biceps-curl', 'Curl con manubri', 'Manubri', 'Bicipiti', 'per-hand', 2, false],
  ['hammer-curl', 'Hammer curl', 'Manubri', 'Bicipiti', 'per-hand', 2, false],
  ['pushdown', 'Pushdown tricipiti', 'Cavi', 'Tricipiti', 'total', 1, false],
  ['dips', 'Dip alle parallele', 'Parallele', 'Tricipiti', 'bodyweight', 1, false],
  ['crunch', 'Crunch', 'Corpo libero', 'Core', 'bodyweight', 1, false],
  ['cable-crunch', 'Crunch ai cavi', 'Cavi', 'Core', 'total', 1, false],
  ['dead-bug', 'Dead bug', 'Corpo libero', 'Core', 'bodyweight', 1, true],
];

export function createInitialData(now = Date.now()): AppData {
  const exercises: Exercise[] = catalog.map(([id, name, equipment, muscleGroup, loadMode, loadMultiplier, unilateral]) => ({
    id, name, equipment, muscleGroup, loadMode, loadMultiplier, unilateral,
    increment: loadMode === 'per-hand' ? 1 : 2.5, createdAt: now, updatedAt: now,
  }));
  return { exercises, routines: [], sessions: [], sets: [] };
}

/** All sessions in this dataset are synthetic and must be presented in an explicit demo context. */
export function createDemoData(now = Date.now()): AppData {
  const data = createInitialData(now);
  const prescription = (exerciseId: string, index: number, sets = 3, repsMin = 8, repsMax = 10, restSeconds = 90): RoutineExercise => ({
    id: `slot-${exerciseId}-${index}`, exerciseId, sets, repsMin, repsMax, rir: 2, restSeconds, note: '',
  });
  const routine = (id: string, name: string, description: string, exercises: RoutineExercise[]): Routine => ({
    id, name, description, exercises, createdAt: now - 56 * 86_400_000, updatedAt: now,
  });
  data.routines = [
    routine('demo-lower', 'Lower body A', 'Forza, controllo e un passo in più.', [
      prescription('hip-thrust', 0, 3, 8, 10, 120),
      prescription('romanian-deadlift', 1, 3, 8, 10, 120),
      prescription('bulgarian', 2, 3, 8, 10, 90),
      prescription('leg-curl', 3, 3, 10, 12, 75),
      prescription('abductor', 4, 3, 12, 15, 60),
    ]),
    routine('demo-upper', 'Upper body', 'Spinta e tirata, in equilibrio.', [
      prescription('incline-press', 0), prescription('lat-pulldown', 1), prescription('dumbbell-row', 2),
      prescription('lateral-raise', 3, 3, 12, 15, 60), prescription('pushdown', 4, 3, 10, 12, 60),
    ]),
    routine('demo-full', 'Full body', 'Un allenamento per tutto il corpo.', [
      prescription('squat', 0, 3, 6, 8, 120), prescription('assisted-pull-up', 1, 3, 6, 8, 90),
      prescription('push-up', 2, 3, 8, 12, 60), prescription('crunch', 3, 3, 12, 15, 60),
    ]),
  ];
  const baseWeight: Record<string, number> = {
    'hip-thrust': 50, 'romanian-deadlift': 35, bulgarian: 8, 'leg-curl': 20, abductor: 30,
    'incline-press': 10, 'lat-pulldown': 25, 'dumbbell-row': 12, 'lateral-raise': 4, pushdown: 10,
    squat: 30, 'assisted-pull-up': 40, 'push-up': 0, crunch: 0,
  };
  for (let week = 0; week < 8; week++) {
    for (let day = 0; day < 3; day++) {
      const timestamp = new Date(now);
      timestamp.setDate(timestamp.getDate() - ((7 - week) * 7 + (6 - day * 2)));
      timestamp.setHours(18, 10 + day * 5, 0, 0);
      const session = createSession(data.routines[day], data.exercises, +timestamp);
      session.id = `demo-session-${week}-${day}`;
      session.status = 'completed';
      session.finishedAt = session.startedAt + (42 + day * 4 + week % 3) * 60_000;
      session.updatedAt = session.finishedAt;
      for (const [exerciseIndex, exercise] of session.exercises.entries()) {
        for (let setIndex = 0; setIndex < exercise.target.sets; setIndex++) {
          const mode = exercise.snapshot.loadMode;
          const progress = Math.floor(week / 2) * (mode === 'per-hand' ? 1 : 2.5);
          const weight = mode === 'bodyweight' ? 0
            : (baseWeight[exercise.snapshot.id] ?? 20) + (mode === 'assisted' ? -progress : progress);
          const reps = Math.max(exercise.target.repsMin, exercise.target.repsMax - (setIndex === 2 ? 1 : 0) - (week % 2 ? 0 : 1));
          const completedAt = session.startedAt + (exerciseIndex * 8 + setIndex * 2 + 2) * 60_000;
          const entry = createSet(session, exercise, setIndex, { weight, reps, rir: setIndex === 2 ? 1 : 2 }, completedAt - 60_000);
          entry.completedAt = completedAt;
          entry.updatedAt = completedAt;
          if (exercise.snapshot.id === 'dumbbell-row' && week % 3 === 0 && setIndex === 2) entry.rightReps = Math.max(1, reps - 1);
          data.sets.push(entry);
        }
      }
      data.sessions.push(session);
    }
  }
  return data;
}
