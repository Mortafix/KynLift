import { useEffect, useRef, useState } from 'react';
import { ArrowRight, CirclePlay, Dumbbell, Flag, Plus } from 'lucide-react';
import { useData } from '../data/DataContext';
import { sessionCompletedSets } from '../lib/domain';
import { finishSessionChanges, resumeSessionChanges } from '../lib/workout-actions';
import type { Routine, SessionFeedback } from '../types';
import { useConfirm } from '../components/ConfirmDialog';
import { FinishWorkoutDialog } from '../components/SessionFeedback';
import './home.css';

export function Home({ onRoutine, onResume, onRoutines, onSession, onDirtyChange }: { onRoutine: (routine: Routine) => void; onResume: () => void; onRoutines: () => void; onSession: (id: string) => void; onDirtyChange?: (dirty: boolean) => void }) {
  const { data, save } = useData();
  const confirm = useConfirm();
  const [finishRequestedAt, setFinishRequestedAt] = useState<number | null>(null);
  const active = data.sessions.filter((session) => session.status === 'active').sort((a, b) => b.startedAt - a.startedAt)[0];
  const completed = active ? sessionCompletedSets(active, data.sets) : [];
  const planned = active?.exercises.reduce((sum, exercise) => sum + exercise.target.sets, 0) ?? 0;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const operating = useRef(false);
  useEffect(() => { onDirtyChange?.(finishRequestedAt !== null); }, [finishRequestedAt, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  async function resume() {
    if (!active || operating.current) return;
    operating.current = true; setBusy(true); setError('');
    try {
      if (active.pausedAt != null) await save(resumeSessionChanges(active));
      onResume();
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Non è stato possibile riprendere. Riprova.'); }
    finally { operating.current = false; setBusy(false); }
  }

  async function requestFinish() {
    if (!active || operating.current) return;
    if (completed.length) { setFinishRequestedAt(Date.now()); return; }
    if (!await confirm({ title: 'Termina allenamento', message: 'Non ci sono serie salvate. Vuoi chiudere questa sessione?', confirmLabel: 'Chiudi sessione' })) return;
    operating.current = true; setBusy(true); setError('');
    try {
      await save([{ collection: 'sessions', value: { ...active, status: 'discarded', finishedAt: Date.now(), restEndsAt: null, workStartedAt: null, pausedAt: null, updatedAt: Date.now() } }]);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Non è stato possibile terminare. Riprova.'); }
    finally { operating.current = false; setBusy(false); }
  }

  async function finish(feedback: SessionFeedback) {
    if (!active || operating.current) return;
    operating.current = true; setBusy(true);
    try {
      await save(finishSessionChanges(active, data, feedback, finishRequestedAt ?? Date.now()));
      onDirtyChange?.(false); onSession(active.id);
    } finally { operating.current = false; setBusy(false); }
  }

  return <section className="page home-page">
    <header className="page-header home-header"><h1 className="page-title">Le tue schede</h1><button type="button" className="text-button" onClick={onRoutines}>Gestisci<ArrowRight size={17} /></button></header>
    {error && <p className="error-message" role="alert">{error}</p>}
    {active && <article className="active-workout" aria-label="Allenamento in corso">
      <div className="active-workout-heading"><h2>{active.routineName}</h2><span className="tag"><span className="live-dot" />{active.pausedAt != null ? 'In pausa' : 'In corso'}</span></div>
      <div className="active-workout-progress-label"><span><strong>{completed.length}</strong> / {planned} serie</span><span>{Math.round(completed.length / Math.max(1, planned) * 100)}%</span></div>
      <div className="active-workout-progress" role="progressbar" aria-label="Avanzamento allenamento" aria-valuemin={0} aria-valuemax={planned} aria-valuenow={completed.length} aria-valuetext={`${completed.length} di ${planned} serie completate`}>
        {active.exercises.map((exercise) => {
          const count = completed.filter((entry) => entry.sessionExerciseId === exercise.id).length;
          return <span key={exercise.id} style={{ flexGrow: exercise.target.sets }} title={`${exercise.snapshot.name}: ${count} di ${exercise.target.sets} serie`}><span style={{ width: `${count / exercise.target.sets * 100}%` }} /></span>;
        })}
      </div>
      <div className="active-workout-current"><Dumbbell size={19} /><span>{completed.length === planned ? 'Tutte le serie completate' : <><span className="active-workout-current-label">Esercizio da riprendere</span><strong>{active.exercises[active.currentExercise]?.snapshot.name}</strong></>}</span></div>
      <div className="active-workout-actions"><button type="button" className="button button-primary" onClick={() => void resume()} disabled={busy}><CirclePlay size={20} />Riprendi</button><button type="button" className="button button-secondary" onClick={() => void requestFinish()} disabled={busy}><Flag size={19} />Termina allenamento</button></div>
    </article>}
    {data.routines.length ? <div className="home-routines" aria-label="Scegli la scheda da allenare">{data.routines.map((routine) => {
      const unavailable = !routine.exercises.length || routine.exercises.some((item) => !data.exercises.some((exercise) => exercise.id === item.exerciseId));
      const otherActive = Boolean(active && active.routineId !== routine.id);
      return <button type="button" key={routine.id} className="home-routine-row" aria-label={`${active?.routineId === routine.id ? 'Riprendi' : 'Apri'} ${routine.name}`} disabled={busy || unavailable || otherActive} title={unavailable ? 'Completa la scheda nella sezione Schede' : otherActive ? 'Termina la sessione in corso per iniziare questa scheda' : undefined} onClick={() => active ? void resume() : onRoutine(routine)}><span className="home-routine-text"><strong>{routine.name}</strong><small>{routine.exercises.length} esercizi · {routine.exercises.reduce((sum, item) => sum + item.sets, 0)} serie</small></span>{active?.routineId === routine.id ? <CirclePlay size={30} strokeWidth={1.5} aria-hidden="true" /> : <ArrowRight size={26} strokeWidth={1.5} aria-hidden="true" />}</button>;
    })}</div> : <div className="home-empty"><Dumbbell size={36} /><h2>Crea la tua prima scheda</h2><button type="button" className="button button-primary" onClick={onRoutines}><Plus size={20} />Crea scheda</button></div>}
    {active && <FinishWorkoutDialog open={finishRequestedAt !== null} session={active} completedCount={completed.length} plannedCount={planned} onClose={() => setFinishRequestedAt(null)} onSubmit={finish} />}
  </section>;
}
