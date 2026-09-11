import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, ChevronDown, Dumbbell, Pencil, Timer, Trash2 } from 'lucide-react';
import { useData } from '../data/DataContext';
import { formatDate, formatNumber, loadLabel, sessionCompletedSets, validateSet } from '../lib/domain';
import { setVolume } from '../lib/stats';
import { clockTime, ENERGY_LABELS, sessionDurationSeconds, updateSessionFeedbackChanges } from '../lib/workout-actions';
import type { SessionExercise, SessionFeedback, SetEntry, WorkoutSession } from '../types';
import { useConfirm } from '../components/ConfirmDialog';
import { Modal } from '../components/Modal';
import { SessionFeedbackForm } from '../components/SessionFeedback';
import { Select } from '../components/Select';

function EditSet({ entry, exercise, onClose, onBusyChange }: { entry: SetEntry; exercise: SessionExercise; onClose: () => void; onBusyChange: (busy: boolean) => void }) {
  const { save, remove } = useData();
  const confirm = useConfirm();
  const [draft, setDraft] = useState(entry);
  const [weight, setWeight] = useState(String(entry.weight).replace('.', ','));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const saving = useRef(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving.current) return;
    const value = { ...draft, weight: weight.trim() ? Number(weight.replace(',', '.')) : Number.NaN, updatedAt: Date.now() };
    const message = validateSet(value, exercise.snapshot);
    if (message) { setError(message); return; }
    saving.current = true; setBusy(true); onBusyChange(true);
    try { await save([{ collection: 'sets', value }]); onClose(); } catch (failure) { setError(failure instanceof Error ? failure.message : 'Salvataggio non riuscito.'); } finally { setBusy(false); saving.current = false; onBusyChange(false); }
  }
  async function deleteEntry() {
    if (saving.current || !await confirm({ title: 'Elimina serie', message: 'Eliminare questa serie? Le statistiche verranno ricalcolate.', confirmLabel: 'Elimina serie', danger: true })) return;
    saving.current = true; setBusy(true); onBusyChange(true);
    try { await remove('sets', entry.id); onClose(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Eliminazione non riuscita.'); }
    finally { saving.current = false; setBusy(false); onBusyChange(false); }
  }
  return <form className="history-edit-form" onSubmit={(event) => void submit(event)}><h3>Modifica serie {entry.index + 1}</h3><div className="form-grid"><label className="field">{exercise.snapshot.loadMode === 'bodyweight' ? 'Zavorra' : exercise.snapshot.loadMode === 'assisted' ? 'Assistenza' : 'Peso'} (kg)<input disabled={busy} aria-label="Peso storico" inputMode="decimal" value={weight} onChange={(event) => setWeight(event.target.value)} required /></label><label className="field">Ripetizioni<input disabled={busy} type="number" inputMode="numeric" min={1} max={999} value={draft.reps} onChange={(event) => setDraft({ ...draft, reps: Number(event.target.value) })} required /></label><Select label="RIR" disabled={busy} value={draft.rir == null ? '' : String(draft.rir)} onChange={(value) => setDraft({ ...draft, rir: value === '' ? null : Number(value) })} options={[{ value: '', label: 'Non registrato' }, ...Array.from({ length: 11 }, (_, index) => ({ value: String(index), label: String(index) }))]} /></div>
    {exercise.snapshot.unilateral && <><p className="field-hint">Sopra: lato sinistro. Lascia vuoto il lato destro se uguale al sinistro.</p><div className="form-grid"><label className="field">Peso destro (kg)<input disabled={busy} type="number" inputMode="decimal" min={0} max={2000} step="any" value={draft.rightWeight ?? ''} onChange={(event) => setDraft({ ...draft, rightWeight: event.target.value === '' ? null : Number(event.target.value) })} /></label><label className="field">Ripetizioni destra<input disabled={busy} type="number" inputMode="numeric" min={1} max={999} value={draft.rightReps ?? ''} onChange={(event) => setDraft({ ...draft, rightReps: event.target.value === '' ? null : Number(event.target.value) })} /></label></div></>}
    <label className="field">Note della serie<textarea disabled={busy} rows={2} maxLength={5000} value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} /></label>{error && <p role="alert" className="error-message">{error}</p>}<div className="history-edit-actions"><button type="submit" className="button button-primary" disabled={busy}><Check size={18} />Salva modifiche</button><button type="button" className="button button-ghost" onClick={onClose} disabled={busy}>Annulla</button><button type="button" className="icon-button danger-text" aria-label="Elimina serie" disabled={busy} onClick={() => void deleteEntry()}><Trash2 size={18} /></button></div>
  </form>;
}

export function HistoryDetail({ session, onBack, onDirtyChange }: { session: WorkoutSession; onBack: () => void; onDirtyChange?: (dirty: boolean) => void }) {
  const { data, save } = useData();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<string | null>(null);
  const [editingFeedback, setEditingFeedback] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingBusy, setEditingBusy] = useState(false);
  const reportDirty = useCallback((dirty: boolean) => onDirtyChange?.(dirty), [onDirtyChange]);
  const completed = sessionCompletedSets(session, data.sets);
  const volume = completed.reduce((total, set) => { const exercise = session.exercises.find((item) => item.id === set.sessionExerciseId); return total + (exercise ? setVolume(set, exercise.snapshot) : 0); }, 0);
  useEffect(() => { reportDirty(editing !== null || editingFeedback || busy || editingBusy); }, [editing, editingFeedback, busy, editingBusy, reportDirty]);
  useEffect(() => () => reportDirty(false), [reportDirty]);
  async function editEntry(id: string) {
    if (editing && !await confirm({ title: 'Lascia le modifiche?', message: 'Le modifiche non salvate della serie andranno perse.', confirmLabel: 'Lascia modifiche' })) return;
    setEditing(id);
  }
  async function saveFeedback(feedback: SessionFeedback) {
    const current = data.sessions.find((item) => item.id === session.id) ?? session;
    await save(updateSessionFeedbackChanges(current, feedback));
    setEditingFeedback(false);
    setNotice('Energia, sonno e note salvati.');
  }
  async function deleteSession() {
    if (busy || editingBusy || !await confirm({ title: 'Elimina allenamento', message: 'Eliminare questo allenamento dallo storico e dalle statistiche?', confirmLabel: 'Elimina allenamento', danger: true })) return;
    setBusy(true); setError('');
    try {
      const current = data.sessions.find((item) => item.id === session.id) ?? session;
      await save([{ collection: 'sessions', value: { ...current, status: 'discarded', updatedAt: Date.now() } }]);
      reportDirty(false); onBack();
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Eliminazione non riuscita.'); }
    finally { setBusy(false); }
  }
  return <section className="page history-page">
    <button type="button" className="button button-ghost back-button" disabled={busy || editingBusy} onClick={onBack}><ArrowLeft size={18} />Torna ai progressi</button>
    <div className="page-header"><div><h1 className="page-title">{session.routineName}</h1><p className="muted">{formatDate(session.startedAt, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p></div><span className="tag"><Check size={14} />Completato</span></div>
    <div className="session-facts"><span><Timer size={18} /><strong>{Math.max(1, Math.round(sessionDurationSeconds(session) / 60))}</strong> min</span><span><Dumbbell size={18} /><strong>{completed.length}</strong> serie</span><span><strong>{formatNumber(volume)}</strong> kg·reps esterni</span></div>
    <div className="history-exercises">{session.exercises.map((exercise) => {
      const entries = completed.filter((item) => item.sessionExerciseId === exercise.id);
      return <section key={exercise.id} className="history-exercise">
        <div className="section-heading"><div><h2>{exercise.snapshot.name}</h2><p className="field-hint">{exercise.snapshot.equipment} · {loadLabel(exercise.snapshot)}{exercise.snapshot.unilateral ? ' · ripetizioni per lato' : ''}</p></div></div>
        {entries.length ? <div className="history-set-list"><div className="history-set-head" aria-hidden="true"><span>Serie</span><span>kg</span><span>reps</span><span>RIR</span><span /></div>{entries.map((entry) => <div key={entry.id}>{editing === entry.id ? <EditSet key={entry.id} entry={entry} exercise={exercise} onClose={() => setEditing((current) => current === entry.id ? null : current)} onBusyChange={setEditingBusy} /> : <>
          <button type="button" className="history-set-row" disabled={busy || editingBusy} onClick={() => void editEntry(entry.id)} aria-label={`Modifica ${exercise.snapshot.name}, serie ${entry.index + 1}: ${entry.weight} kg, ${entry.reps} ripetizioni`}><span>{entry.index + 1}</span><strong>{formatNumber(entry.weight)}</strong><strong>{entry.reps}</strong><span>{entry.rir ?? '—'}</span><Pencil size={16} /></button>
          {exercise.snapshot.unilateral && (entry.rightReps !== null || entry.rightWeight !== null) && <p className="history-side-note">Destro: {formatNumber(entry.rightWeight ?? entry.weight)} kg × {entry.rightReps ?? entry.reps} reps</p>}
          {entry.durationMs != null && <p className="history-set-duration"><Timer size={14} aria-hidden="true" />Durata serie {clockTime(entry.durationMs / 1000)}</p>}
          {entry.note && <p className="history-set-note">{entry.note}</p>}
        </>}</div>)}</div> : <p className="muted">Nessuna serie confermata per questo esercizio.</p>}
        {(exercise.note || exercise.target.note) && <p className="exercise-note">{exercise.note || exercise.target.note}</p>}
      </section>;
    })}</div>
    <section className="session-notes history-feedback">
      <div className="section-heading"><h2>Come è andata?</h2><button type="button" className="button button-secondary" disabled={busy || editingBusy} onClick={() => { setEditingFeedback(true); setNotice(''); }}><Pencil size={16} />Modifica</button></div>
      <dl className="history-feedback-facts"><div><dt>Energia</dt><dd>{session.energy != null ? ENERGY_LABELS[session.energy - 1] : 'Non registrata'}</dd></div><div><dt>Sonno</dt><dd>{session.sleepHours != null ? `${formatNumber(session.sleepHours)} ore` : 'Non registrato'}</dd></div></dl>
      {session.note && <p className="history-feedback-note">{session.note}</p>}
      {notice && <p role="status" className="success-message">{notice}</p>}
    </section>
    <details className="history-options"><summary>Gestisci questo allenamento<ChevronDown size={18} /></summary><button type="button" className="button button-ghost danger-text" disabled={busy || editingBusy} onClick={() => void deleteSession()}><Trash2 size={18} />Elimina allenamento</button></details>
    {error && <p role="alert" className="error-message">{error}</p>}
    <Modal open={editingFeedback} onClose={() => setEditingFeedback(false)} title="Come è andata?" busy={busy} className="session-feedback-dialog">
      {editingFeedback && <SessionFeedbackForm key={session.id} session={session} onSubmit={saveFeedback} onCancel={() => setEditingFeedback(false)} onBusyChange={setBusy} />}
    </Modal>
  </section>;
}
