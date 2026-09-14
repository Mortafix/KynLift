import { ArrowLeft, CirclePlay, LoaderCircle, Timer } from 'lucide-react';
import { useData } from '../data/DataContext';
import { formatRepsTarget } from '../lib/domain';
import type { Routine } from '../types';
import './routine-preview.css';

interface RoutinePreviewProps {
  routine: Routine;
  onBack: () => void;
  onStart: () => void;
  busy?: boolean;
}

export function RoutinePreview({ routine, onBack, onStart, busy = false }: RoutinePreviewProps) {
  const { data, loading } = useData();
  const exercises = new Map(data.exercises.filter((exercise) => !exercise.deletedAt).map((exercise) => [exercise.id, exercise]));
  const totalSets = routine.exercises.reduce((total, exercise) => total + exercise.sets, 0);
  const unavailable = routine.exercises.some((exercise) => !exercises.has(exercise.exerciseId));
  const invalid = Boolean(routine.deletedAt) || !routine.name.trim() || !routine.exercises.length || unavailable;
  const disabled = busy || loading || invalid;

  return <section className="page routine-preview-page">
    <button type="button" className="button button-ghost back-button" disabled={busy} onClick={onBack}><ArrowLeft size={18} />Torna alle schede</button>
    <header className="routine-preview-header">
      <h1 className="page-title">{routine.name}</h1>
      <div className="routine-preview-totals"><span><strong>{routine.exercises.length}</strong> {routine.exercises.length === 1 ? 'esercizio' : 'esercizi'}</span><span><strong>{totalSets}</strong> serie totali</span></div>
    </header>
    <ol className="routine-preview-exercises" aria-label="Esercizi della scheda">{routine.exercises.map((entry, index) => {
      const exercise = exercises.get(entry.exerciseId);
      const repetitions = formatRepsTarget(entry);
      const mixedMax = Boolean(entry.maxRepsSets?.length && entry.maxRepsSets.length < entry.sets);
      return <li key={entry.id} className="routine-preview-exercise">
        <span className="routine-preview-order" aria-hidden="true">{index + 1}</span>
        <div className="routine-preview-exercise-main"><h2>{exercise?.name ?? 'Esercizio non disponibile'}</h2>{exercise?.equipment && <p className="routine-preview-equipment">{exercise.equipment}</p>}
          <div className="routine-preview-prescription"><span className="routine-preview-reps" aria-label={`${entry.sets} serie da ${repetitions} ripetizioni`}><strong>{entry.sets} × {repetitions}</strong><span>rip.</span></span><span className="routine-preview-rest"><Timer size={16} aria-hidden="true" /><span>Recupero {entry.restSeconds} s</span></span>{entry.rir != null && <span className="routine-preview-rir">RIR <strong>{entry.rir}</strong></span>}</div>
          {mixedMax && <p className="routine-preview-max">MAX: {entry.maxRepsSets!.map((index) => `serie ${index + 1}`).join(', ')}</p>}
        </div>
      </li>;
    })}</ol>
    {!routine.exercises.length && <p className="routine-preview-empty muted">Nessun esercizio nella scheda.</p>}
    {unavailable && <p className="error-message" role="alert">Un esercizio non è più disponibile. Aggiorna la scheda prima di iniziare.</p>}
    <div className="routine-preview-actions"><button type="button" className="button button-primary routine-preview-start" disabled={disabled} aria-busy={busy || undefined} onClick={onStart}>{busy ? <LoaderCircle size={23} className="spinner" aria-hidden="true" /> : <CirclePlay size={23} aria-hidden="true" />}Inizia allenamento</button></div>
  </section>;
}

export default RoutinePreview;
