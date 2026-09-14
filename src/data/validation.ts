import type { AppData, CollectionName } from '../types';

type Row = Record<string, unknown>;
const record = (value: unknown): value is Row => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown, max = 5000): value is string => typeof value === 'string' && value.length <= max;
const id = (value: unknown) => text(value, 200) && value.length > 0 && !value.includes('/');
const number = (value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): value is number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const integer = (value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER) => number(value, min, max) && Number.isInteger(value);
const optionalNumber = (value: unknown, max = Number.MAX_SAFE_INTEGER) => value === null || number(value, 0, max);

function snapshot(value: unknown): boolean {
  return record(value) && id(value.id) && text(value.name, 200) && value.name.length > 0
    && text(value.equipment, 200) && ['Gambe', 'Glutei', 'Dorso', 'Petto', 'Spalle', 'Bicipiti', 'Tricipiti', 'Core', 'Altro'].includes(String(value.muscleGroup))
    && ['total', 'per-hand', 'bodyweight', 'assisted'].includes(String(value.loadMode))
    && (value.loadMultiplier === 1 || value.loadMultiplier === 2) && typeof value.unilateral === 'boolean'
    && number(value.increment, Number.MIN_VALUE, 100);
}
function target(value: unknown): boolean {
  return record(value) && integer(value.sets, 1, 1000) && integer(value.repsMin, 0, 1000)
    && integer(value.repsMax, Number(value.repsMin), 1000) && optionalNumber(value.rir, 10)
    && (value.maxRepsSets === undefined || (Array.isArray(value.maxRepsSets) && value.maxRepsSets.length <= Number(value.sets)
      && [...value.maxRepsSets].every((index) => integer(index, 0, Number(value.sets) - 1)) && new Set(value.maxRepsSets).size === value.maxRepsSets.length))
    && number(value.restSeconds, 0, 3600) && text(value.note);
}

/** A corrupt nested routine/session must never reach rendering code. The rules
 * enforce account boundaries; this guard also validates every array element. */
export function isStoredEntity(value: unknown, expectedId: string, collection?: CollectionName): value is AppData[CollectionName][number] {
  if (!record(value) || value.id !== expectedId || !id(value.id) || !number(value.createdAt) || !number(value.updatedAt)
    || (value.deletedAt !== undefined && !optionalNumber(value.deletedAt))) return false;
  const kind = collection ?? ('loadMode' in value ? 'exercises' : 'routineName' in value ? 'sessions' : 'sessionId' in value ? 'sets' : 'routines');
  if (kind === 'exercises') return snapshot(value);
  if (kind === 'routines') {
    return text(value.name, 200) && value.name.length > 0 && text(value.description)
      && Array.isArray(value.exercises) && value.exercises.length <= 200
      && value.exercises.every((item) => record(item) && id(item.id) && id(item.exerciseId) && target(item));
  }
  if (kind === 'sessions') {
    return (value.routineId === null || id(value.routineId)) && text(value.routineName, 200)
      && number(value.startedAt) && optionalNumber(value.finishedAt) && ['active', 'completed', 'discarded'].includes(String(value.status))
      && text(value.note) && integer(value.currentExercise) && integer(value.currentSet)
      && optionalNumber(value.restEndsAt) && number(value.restDuration, 0, 3600)
      && (value.workStartedAt === undefined || optionalNumber(value.workStartedAt))
      && (value.pausedAt === undefined || optionalNumber(value.pausedAt))
      && (value.pausedDurationMs === undefined || number(value.pausedDurationMs))
      && (value.energy === undefined || value.energy === null || integer(value.energy, 1, 5))
      && (value.sleepHours === undefined || value.sleepHours === null || (number(value.sleepHours, 0, 24) && Number.isInteger(value.sleepHours * 2)))
      && Array.isArray(value.exercises) && value.exercises.length <= 200
      && value.exercises.every((item) => record(item) && id(item.id) && id(item.sourceExerciseId) && snapshot(item.snapshot) && target(item.target) && text(item.note));
  }
  return id(value.sessionId) && id(value.sessionExerciseId) && integer(value.index)
    && number(value.weight, 0, 2000) && integer(value.reps, 0, 1000) && optionalNumber(value.rir, 10)
    && optionalNumber(value.rightWeight, 2000) && (value.rightReps === null || integer(value.rightReps, 0, 1000))
    && text(value.note) && optionalNumber(value.completedAt)
    && (value.durationMs === undefined || optionalNumber(value.durationMs));
}
