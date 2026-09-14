import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowLeftRight, ArrowRight, Check, ChevronLeft, ChevronRight, CircleCheck, Dumbbell, Flag, Minus, Pause, Play, Plus, RotateCcw, Settings, Timer, X } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useConfirm } from '../components/ConfirmDialog';
import { FinishWorkoutDialog } from '../components/SessionFeedback';
import { useData } from '../data/DataContext';
import { formatNumber, formatRepsTarget, initialSet, isMaxReps, previousSet, sessionCompletedSets, validateSet } from '../lib/domain';
import { clockTime, completeSetChanges, createSessionWriter, finishSessionChanges, initializeSessionTimerChanges, pauseSessionChanges, resumeSessionChanges, workoutTimer, type SessionAction } from '../lib/workout-actions';
import type { SessionExercise, SessionFeedback, SetEntry, WorkoutSession } from '../types';
import './Workout.css';

interface WorkoutProps {
  session: WorkoutSession;
  onBack: () => void;
  onFinish: (id: string) => void;
  onDirtyChange?: (dirty: boolean) => void;
}

const asNumber = (value: string) => value.trim() === '' ? Number.NaN : Number(value.replace(',', '.'));

interface SetFields { weight: string; reps: string; rir: string; rightWeight: string; rightReps: string; separateSides: boolean }
function initialFields(entry: SetEntry): SetFields {
  return { weight: String(entry.weight).replace('.', ','), reps: entry.reps === 0 && entry.completedAt === null ? '' : String(entry.reps), rir: entry.rir === null ? '' : String(entry.rir), rightWeight: entry.rightWeight === null ? '' : String(entry.rightWeight).replace('.', ','), rightReps: entry.rightReps === null ? '' : String(entry.rightReps), separateSides: entry.rightWeight !== null || entry.rightReps !== null };
}
function toEntry(fields: SetFields, base: SetEntry): SetEntry {
  return { ...base, weight: asNumber(fields.weight), reps: asNumber(fields.reps), rir: fields.rir === '' ? null : asNumber(fields.rir), rightWeight: fields.separateSides && fields.rightWeight.trim() ? asNumber(fields.rightWeight) : null, rightReps: fields.separateSides && fields.rightReps.trim() ? asNumber(fields.rightReps) : null, updatedAt: Date.now() };
}

function NumberField({ label, unit, value, onChange, step, id, max = 2000, min = 0, large = true, disabled = false, active = false, maxReps = false, onActivate }: { label: string; unit: string; value: string; onChange: (value: string) => void; step: number; id: string; max?: number; min?: number; large?: boolean; disabled?: boolean; active?: boolean; maxReps?: boolean; onActivate?: () => void }) {
  const numeric = asNumber(value);
  const adjust = (direction: number) => onChange(String(Math.min(max, Math.max(min, Math.round(((Number.isFinite(numeric) ? numeric : min) + direction * step) * 100) / 100))).replace('.', ','));
  return <div className={`number-field ${large ? '' : 'number-field-small'}`} data-active={active} onFocusCapture={onActivate}>
    <div className="number-field-heading"><label htmlFor={id}>{label}</label><span className="number-unit">{unit}</span>{maxReps && <span id={`${id}-max`} className="number-max-label">MAX</span>}</div>
    <div className="number-controls"><button type="button" aria-label={`Diminuisci ${label.toLowerCase()}`} disabled={disabled || Number.isFinite(numeric) && numeric <= min} onClick={() => adjust(-1)}><Minus size={22} /></button><input id={id} aria-label={label} aria-describedby={maxReps ? `${id}-max` : undefined} aria-required="true" value={value} placeholder="—" data-long={value.length > 4} disabled={disabled} onChange={(event) => onChange(event.target.value)} inputMode={id.includes('reps') || id.includes('rir') ? 'numeric' : 'decimal'} autoComplete="off" onFocus={(event) => event.target.select()} maxLength={7} /><button type="button" aria-label={`Aumenta ${label.toLowerCase()}`} disabled={disabled || numeric >= max} onClick={() => adjust(1)}><Plus size={22} /></button></div>
  </div>;
}

function SetForm({ session, exercise, index, dirtyChange, onSaved, write, disabled, onSavingChange, now, onPause }: { session: WorkoutSession; exercise: SessionExercise; index: number; dirtyChange: (dirty: boolean) => void; onSaved: (message: string) => void; write: (action: SessionAction) => Promise<void>; disabled: boolean; onSavingChange: (busy: boolean) => void; now: number; onPause: () => void }) {
  const { data } = useData();
  const setId = `${session.id}:${exercise.id}:${index}`;
  const existing = data.sets.find((set) => set.id === setId && !set.deletedAt);
  const [base] = useState(() => initialSet(session, exercise, index, data.sessions, data.sets));
  const [fields, setFields] = useState(() => initialFields(base));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sidesOpen, setSidesOpen] = useState(false);
  const [activeField, setActiveField] = useState('set-weight');
  const request = useRef(0);
  const saving = useRef(false);
  const mounted = useRef(true);
  const persisted = useRef<SetEntry>(base);
  const wasCompleted = (existing?.completedAt ?? persisted.current.completedAt) !== null;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; request.current++; dirtyChange(false); }; }, [dirtyChange]);

  function change(patch: Partial<SetFields>) {
    if (saving.current || disabled || session.pausedAt != null) return;
    const next = { ...fields, ...patch };
    setFields(next); setError(''); dirtyChange(true);
    const revision = ++request.current;
    const entry = toEntry(next, { ...persisted.current, ...(existing ?? {}), completedAt: existing?.completedAt ?? persisted.current.completedAt });
    if (wasCompleted || validateSet(entry, exercise.snapshot)) return;
    void write(() => [{ collection: 'sets', value: entry }]).then(() => {
      if (mounted.current && revision === request.current) { persisted.current = entry; dirtyChange(false); }
    }).catch((failure) => { if (mounted.current && revision === request.current) setError(failure instanceof Error ? failure.message : 'Non è stato possibile salvare la bozza.'); });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving.current || disabled || session.pausedAt != null) return;
    const entry = toEntry(fields, { ...persisted.current, ...(existing ?? {}), completedAt: existing?.completedAt ?? persisted.current.completedAt });
    const failure = validateSet(entry, exercise.snapshot, true);
    if (failure) { setError(failure); return; }
    saving.current = true; request.current++; setBusy(true); onSavingChange(true); dirtyChange(true); setError('');
    try {
      let confirmed = entry;
      await write((current) => {
        const changes = completeSetChanges(current, entry);
        const saved = changes.find((change) => change.collection === 'sets');
        if (saved?.collection === 'sets') confirmed = saved.value;
        return changes;
      });
      persisted.current = confirmed;
      if (mounted.current) dirtyChange(false);
      onSaved(wasCompleted ? 'Serie aggiornata' : 'Serie salvata');
    } catch (failure) { if (mounted.current) setError(failure instanceof Error ? failure.message : 'Non è stato possibile salvare la serie. Riprova.'); }
    finally { if (mounted.current) setBusy(false); saving.current = false; onSavingChange(false); }
  }

  const weightLabel = exercise.snapshot.loadMode === 'bodyweight' ? 'Zavorra' : exercise.snapshot.loadMode === 'assisted' ? 'Assistenza' : 'Peso';
  const timer = workoutTimer(session, now);
  const locked = busy || disabled || timer.paused;

  return <form className="set-form" onSubmit={(event) => void submit(event)}>
    <div className="set-inputs">
    <div className="main-number-fields"><NumberField disabled={locked} id="set-weight" label={`${weightLabel}${fields.separateSides ? ' sx' : ''}`} unit="kg" value={fields.weight} step={exercise.snapshot.increment} active={activeField === 'set-weight'} onActivate={() => setActiveField('set-weight')} onChange={(weight) => change({ weight })} /><NumberField disabled={locked} id="set-reps" maxReps={isMaxReps(exercise.target, index)} label={`Ripetizioni${fields.separateSides ? ' sx' : ''}`} unit="reps" value={fields.reps} step={1} min={1} max={999} active={activeField === 'set-reps'} onActivate={() => setActiveField('set-reps')} onChange={(reps) => change({ reps })} /><NumberField disabled={locked} id="set-rir" label="RIR" unit="0–10" value={fields.rir} step={1} max={10} active={activeField === 'set-rir'} onActivate={() => setActiveField('set-rir')} onChange={(rir) => change({ rir })} /></div>
    </div>
    <div className={`rest-control ${timer.phase === 'rest' ? 'is-running' : 'is-working'} ${timer.paused ? 'is-paused' : ''}`}>
      {timer.paused ? <Pause size={24} /> : <Timer size={24} />}<div className="rest-description"><span>{timer.paused ? 'Allenamento in pausa' : timer.phase === 'rest' ? 'Recupero in corso' : 'Tempo di esecuzione'}</span></div><strong role="timer" aria-live="off" aria-label={timer.phase === 'rest' ? 'Tempo di recupero' : 'Tempo di esecuzione'}>{clockTime(timer.seconds)}</strong>
    </div>
    <div className={`set-actions${exercise.snapshot.unilateral ? ' has-side-control' : ''}`}>
      {exercise.snapshot.unilateral && <button type="button" className={`button button-secondary side-values-button${fields.separateSides ? ' has-side-values' : ''}`} disabled={locked} aria-label="Valori per lato" title="Valori per lato" aria-haspopup="dialog" onClick={() => setSidesOpen(true)}><ArrowLeftRight size={21} /></button>}
      <button type="button" className="button button-secondary pause-workout-button" disabled={busy || disabled} aria-label={timer.paused ? 'Riprendi allenamento' : 'Metti in pausa allenamento'} title={timer.paused ? 'Riprendi allenamento' : 'Metti in pausa allenamento'} onClick={onPause}>{timer.paused ? <Play size={23} /> : <Pause size={23} />}</button><button type="submit" className="button button-primary save-set-button" disabled={locked}><Check size={23} />{busy ? 'Salvataggio…' : wasCompleted ? 'Aggiorna serie' : 'Salva serie'}</button></div>
    <Modal open={sidesOpen} onClose={() => setSidesOpen(false)} title="Valori per lato" className="workout-sides-dialog">
      <label className="check-label"><input type="checkbox" disabled={locked} checked={fields.separateSides} onChange={(event) => change({ separateSides: event.target.checked, rightWeight: fields.rightWeight || fields.weight, rightReps: fields.rightReps || fields.reps })} />Valori diversi per i due lati</label>
      {fields.separateSides && <div className="right-number-fields"><NumberField disabled={locked} id="right-weight" label={`${weightLabel} destro`} unit="kg" value={fields.rightWeight} step={exercise.snapshot.increment} large={false} onChange={(rightWeight) => change({ rightWeight })} /><NumberField disabled={locked} id="right-reps" maxReps={isMaxReps(exercise.target, index)} label="Ripetizioni destra" unit="reps" value={fields.rightReps} step={1} min={1} max={999} large={false} onChange={(rightReps) => change({ rightReps })} /></div>}
      <button type="button" className="button button-primary workout-dialog-done" onClick={() => setSidesOpen(false)}>Fatto</button>
    </Modal>
    <Modal open={Boolean(error)} onClose={() => setError('')} title="Controlla la serie"><p role="alert" className="error-message">{error}</p><button type="button" className="button button-primary workout-dialog-done" onClick={() => setError('')}>Torna alla serie</button></Modal>
  </form>;
}

export function Workout({ session, onBack, onFinish, onDirtyChange }: WorkoutProps) {
  const { data, save } = useData();
  const confirm = useConfirm();
  const dataRef = useRef(data);
  dataRef.current = data;
  const saveRef = useRef(save);
  saveRef.current = save;
  const writer = useRef<ReturnType<typeof createSessionWriter> | null>(null);
  if (!writer.current || writer.current.current().id !== session.id) writer.current = createSessionWriter(session, (changes) => saveRef.current(changes));
  writer.current.sync(session);
  const write = useCallback((action: SessionAction) => writer.current!.write(action), []);
  const [now, setNow] = useState(Date.now());
  const [savedStatus, setSavedStatus] = useState('');
  const statusTimeout = useRef<number | null>(null);
  const [error, setError] = useState('');
  const [operationBusy, setOperationBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const busy = operationBusy || submitting;
  const operationCount = useRef(0);
  const [overview, setOverview] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [finishRequestedAt, setFinishRequestedAt] = useState<number | null>(null);
  const finishOpen = useRef(false);
  finishOpen.current = finishRequestedAt !== null;
  const [formVersion, setFormVersion] = useState(0);
  const setRail = useRef<HTMLDivElement>(null);
  const formDirty = useRef(false);
  const reportDirty = useCallback((value: boolean) => { formDirty.current = value; onDirtyChange?.(value || finishOpen.current); }, [onDirtyChange]);
  const exerciseIndex = Math.min(session.currentExercise, session.exercises.length - 1);
  const exercise = session.exercises[exerciseIndex];
  const index = Math.min(session.currentSet, exercise.target.sets - 1);
  const completed = sessionCompletedSets(session, data.sets);
  const planned = session.exercises.reduce((sum, item) => sum + item.target.sets, 0);
  const latestCompleted = completed.toSorted((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))[0];
  const previous = previousSet(exercise, index, data.sessions, data.sets, session.startedAt);
  useEffect(() => {
    if (session.workStartedAt !== undefined) return;
    void write((current) => initializeSessionTimerChanges(current)).catch((failure) => setError(failure instanceof Error ? failure.message : 'Non è stato possibile avviare il timer.'));
  }, [session.workStartedAt, write]);
  useEffect(() => {
    const rail = setRail.current;
    if (!rail) return;
    const frame = rail.parentElement!;
    const center = () => {
      const selected = rail.querySelector<HTMLButtonElement>('[aria-current="step"]');
      rail.dataset.scrollable = String(exercise.target.sets > 4 || exercise.target.sets * 64 - 16 > frame.clientHeight);
      if (selected && rail.dataset.scrollable === 'true') {
        const padding = Math.max(0, (frame.clientHeight - selected.offsetHeight) / 2);
        rail.style.setProperty('--rail-padding', `${padding}px`);
        rail.scrollTo({ top: selected.offsetTop - padding, behavior: 'auto' });
      }
    };
    center();
    const observer = new ResizeObserver(center);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [exercise.id, exercise.target.sets, index, overview]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  useEffect(() => { onDirtyChange?.(formDirty.current || finishRequestedAt !== null); }, [finishRequestedAt, onDirtyChange]);
  useEffect(() => () => { if (statusTimeout.current !== null) window.clearTimeout(statusTimeout.current); }, []);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const interval = window.setInterval(tick, 500);
    document.addEventListener('visibilitychange', tick);
    return () => { window.clearInterval(interval); document.removeEventListener('visibilitychange', tick); };
  }, []);
  async function update(patch: Partial<WorkoutSession>) {
    await write((current) => [{ collection: 'sessions', value: { ...current, ...patch, updatedAt: Date.now() } }]);
  }
  async function run(action: () => Promise<void>) {
    setError(''); operationCount.current++; setOperationBusy(true);
    try { await action(); } catch (failure) { setError(failure instanceof Error ? failure.message : 'Non è stato possibile salvare. Riprova.'); }
    finally { operationCount.current--; setOperationBusy(operationCount.current > 0); }
  }
  const canLeave = async () => !formDirty.current || await confirm({ title: 'Lasciare le modifiche?', message: 'Ci sono modifiche non confermate a questa serie.', confirmLabel: 'Lascia le modifiche', cancelLabel: 'Resta sulla serie', danger: true });
  async function select(exercisePosition: number, setPosition = 0) {
    if (!await canLeave()) return;
    await run(async () => { await write((current) => [{ collection: 'sessions', value: { ...current, currentExercise: exercisePosition, currentSet: setPosition, restDuration: current.exercises[exercisePosition].target.restSeconds, updatedAt: Date.now() } }]); setOverview(false); reportDirty(false); });
  }
  async function finish() {
    if (!await canLeave()) return;
    if (!completed.length) { await discard(); return; }
    setAdvanced(false);
    setFinishRequestedAt(Date.now());
  }
  async function finishWithFeedback(feedback: SessionFeedback) {
    operationCount.current++; setOperationBusy(true);
    try {
      await write((current) => finishSessionChanges(current, dataRef.current, feedback, finishRequestedAt ?? Date.now()));
      finishOpen.current = false; reportDirty(false); onFinish(session.id);
    } finally { operationCount.current--; setOperationBusy(operationCount.current > 0); }
  }
  async function discard() {
    if (!await confirm({ title: 'Annullare?', message: completed.length ? 'Le serie registrate non appariranno nello storico o nelle statistiche.' : 'Non hai ancora confermato serie. La sessione verrà annullata.', confirmLabel: 'Conferma', cancelLabel: 'Riprendi', danger: true })) return;
    await run(async () => { await update({ status: 'discarded', restEndsAt: null, workStartedAt: null, pausedAt: null }); reportDirty(false); onBack(); });
  }
  async function togglePause() {
    await run(async () => { await write((current) => current.pausedAt != null ? resumeSessionChanges(current) : pauseSessionChanges(current)); setNow(Date.now()); });
  }
  async function addSet() {
    await run(async () => {
      await write((current) => [{ collection: 'sessions', value: { ...current, exercises: current.exercises.map((item) => item.id === exercise.id ? { ...item, target: { ...item.target, sets: Math.min(30, item.target.sets + 1) } } : item), updatedAt: Date.now() } }]);
      setAdvanced(false);
    });
  }
  async function removeSet() {
    if (!await canLeave()) return;
    const last = dataRef.current.sets.find((item) => item.sessionId === session.id && item.sessionExerciseId === exercise.id && item.index === exercise.target.sets - 1);
    if (last?.completedAt != null && !await confirm({ title: 'Rimuovere l’ultima serie?', message: 'Verranno rimossi anche i risultati salvati per questa serie.', confirmLabel: 'Rimuovi serie', danger: true })) return;
    await run(async () => {
      await write((current) => {
        const count = current.exercises.find((item) => item.id === exercise.id)!.target.sets;
        if (count <= 1) return [];
        const now = Date.now();
        return [
          ...(last ? [{ collection: 'sets' as const, value: { ...last, deletedAt: now, updatedAt: now } }] : []),
          { collection: 'sessions', value: { ...current, currentSet: current.currentExercise === exerciseIndex ? Math.min(current.currentSet, count - 2) : current.currentSet, exercises: current.exercises.map((item) => item.id === exercise.id ? { ...item, target: { ...item.target, sets: count - 1, ...(item.target.maxRepsSets ? { maxRepsSets: item.target.maxRepsSets.filter((index) => index < count - 1) } : {}) } } : item), updatedAt: now } },
        ];
      });
      setAdvanced(false); reportDirty(false);
    });
  }
  async function undoSet() {
    if (!latestCompleted || !await canLeave()) return;
    await run(async () => {
      await write((current) => {
        const now = Date.now();
        return [
          { collection: 'sets', value: { ...latestCompleted, completedAt: null, durationMs: null, updatedAt: now } },
          { collection: 'sessions', value: { ...current, currentExercise: current.exercises.findIndex((item) => item.id === latestCompleted.sessionExerciseId), currentSet: latestCompleted.index, restEndsAt: null, workStartedAt: current.pausedAt ?? now, updatedAt: now } },
        ];
      });
      setFormVersion((version) => version + 1); setAdvanced(false); reportDirty(false);
    });
  }
  return <section className="page workout-page">
    <div className="workout-context"><button type="button" className="button button-ghost" disabled={busy} onClick={onBack}><ArrowLeft size={20} /><span>{session.routineName}</span></button><div className="workout-tools"><button type="button" className="button button-ghost exercise-toggle" disabled={busy} onClick={() => setOverview(true)} aria-haspopup="dialog" aria-expanded={overview}><Dumbbell size={20} /><span>Esercizi</span><span className="muted">{exerciseIndex + 1}/{session.exercises.length}</span></button><button type="button" className="icon-button advanced-toggle" aria-label="Opzioni avanzate" title="Opzioni avanzate" aria-haspopup="dialog" disabled={busy} onClick={() => { setError(''); setAdvanced(true); }}><Settings size={20} /></button></div></div>
    <div className="workout-layout"><div className="workout-primary">
      <div className="exercise-heading"><h1 title={exercise.snapshot.name}>{exercise.snapshot.name}</h1><span className="exercise-equipment">{exercise.snapshot.equipment} · {exercise.snapshot.muscleGroup}</span></div>
      <div className="workout-facts"><p className="workout-target"><span>Obiettivo</span><strong>{formatRepsTarget(exercise.target, index)} ripetizioni{exercise.snapshot.unilateral ? ' / lato' : ''}</strong></p>
      {previous && <p className="workout-target previous-weight"><span>Ultima volta</span><strong>{formatNumber(previous.weight)} kg{previous.rightWeight != null && previous.rightWeight !== previous.weight ? ` sx · ${formatNumber(previous.rightWeight)} kg dx` : ''}</strong></p>}</div>
      <div className="set-workspace">
      <div className="set-rail"><div className="set-tabs" ref={setRail} data-scrollable={exercise.target.sets > 4} aria-label="Serie dell’esercizio">{Array.from({ length: exercise.target.sets }, (_, position) => {
        const done = completed.some((item) => item.sessionExerciseId === exercise.id && item.index === position);
        return <button type="button" key={position} disabled={busy} className={`set-tab ${index === position ? 'selected' : ''} ${done ? 'completed' : ''}`} onClick={() => void select(exerciseIndex, position)} aria-current={index === position ? 'step' : undefined} aria-label={`Serie ${position + 1}${done ? ', completata' : ''}`}><span>{position + 1}</span></button>;
      })}</div></div>
      <SetForm key={`${session.id}:${exercise.id}:${index}:${formVersion}`} session={session} exercise={exercise} index={index} write={write} now={finishRequestedAt ?? now} disabled={busy || finishRequestedAt !== null} onPause={() => void togglePause()} onSavingChange={setSubmitting} dirtyChange={reportDirty} onSaved={(message) => { setNow(Date.now()); setSavedStatus(message); if (statusTimeout.current !== null) window.clearTimeout(statusTimeout.current); statusTimeout.current = window.setTimeout(() => setSavedStatus(''), 1500); }} />
      <div className="set-saved-status" role="status" aria-atomic="true">{savedStatus && <><CircleCheck size={18} />{savedStatus}</>}</div>
      </div>
      <div className="exercise-pagination"><button type="button" className="button button-ghost" disabled={exerciseIndex === 0 || busy} onClick={() => void select(exerciseIndex - 1)}><ChevronLeft size={18} />Precedente</button><button type="button" className="button button-ghost" disabled={exerciseIndex === session.exercises.length - 1 || busy} onClick={() => void select(exerciseIndex + 1)}>Successivo<ChevronRight size={18} /></button></div>
    </div>
    </div>
    <Modal open={overview} onClose={() => setOverview(false)} title="Esercizi" busy={busy} className="workout-exercises-dialog">
    <div className="workout-agenda" aria-label="Esercizi della sessione"><div className="session-progress"><span>{completed.length} di {planned} serie</span><span>{Math.round(completed.length / planned * 100)}%</span></div><progress max={planned} value={completed.length} aria-label="Serie completate" /><ol>{session.exercises.map((item, position) => {
      const count = completed.filter((entry) => entry.sessionExerciseId === item.id).length;
      return <li key={item.id}><button type="button" className={position === exerciseIndex ? 'current' : ''} aria-current={position === exerciseIndex ? 'step' : undefined} onClick={() => void select(position)} disabled={busy}><span className="agenda-index">{count >= item.target.sets ? <Check size={16} /> : String(position + 1).padStart(2, '0')}</span><span><strong>{item.snapshot.name}</strong><small>{item.snapshot.equipment} · {item.snapshot.muscleGroup}</small><small>{count}/{item.target.sets} serie · {formatRepsTarget(item.target)} reps</small></span>{position === exerciseIndex ? <ArrowRight size={18} /> : null}</button></li>;
    })}</ol></div>
    </Modal>
    <Modal open={advanced} onClose={() => setAdvanced(false)} title="Opzioni avanzate" busy={busy} className="workout-advanced-dialog">
      <div className="workout-advanced-actions"><button type="button" className="button button-secondary" disabled={busy || exercise.target.sets >= 30} onClick={() => void addSet()}><Plus size={20} />Aggiungi una serie</button><button type="button" className="button button-secondary" disabled={busy || exercise.target.sets <= 1} onClick={() => void removeSet()}><Minus size={20} />Rimuovi l’ultima serie</button><button type="button" className="button button-secondary" disabled={busy || !latestCompleted} onClick={() => void undoSet()}><RotateCcw size={20} />Annulla l’ultimo salvataggio</button><button type="button" className="button button-secondary" disabled={busy} onClick={() => void finish()}><Flag size={20} />Termina allenamento<span>{completed.length}/{planned}</span></button><button type="button" className="button button-secondary danger-text" disabled={busy} onClick={() => void discard()}><X size={20} />Annulla allenamento</button></div>
      {error && <p role="alert" className="error-message">{error}</p>}
    </Modal>
    <Modal open={Boolean(error) && !advanced} onClose={() => setError('')} title="Allenamento"><p role="alert" className="error-message">{error}</p><button type="button" className="button button-primary workout-dialog-done" onClick={() => setError('')}>Chiudi</button></Modal>
    <FinishWorkoutDialog open={finishRequestedAt !== null} session={session} completedCount={completed.length} plannedCount={planned} onClose={() => setFinishRequestedAt(null)} onSubmit={finishWithFeedback} />
  </section>;
}
