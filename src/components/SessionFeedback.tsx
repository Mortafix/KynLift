import { useId, useRef, useState } from 'react';
import { Annoyed, Check, Frown, Laugh, Meh, Minus, Plus, Smile } from 'lucide-react';
import { ENERGY_LABELS, validateSessionFeedback } from '../lib/workout-actions';
import type { SessionFeedback, WorkoutSession } from '../types';
export type { SessionFeedback } from '../types';
import { Modal } from './Modal';
import './session-feedback.css';

const ENERGY_ICONS = [Frown, Annoyed, Meh, Smile, Laugh];
const sleepNumber = (value: string) => value.trim() ? Number(value.replace(',', '.')) : Number.NaN;

export function SessionFeedbackForm({ session, onSubmit, onCancel, onBusyChange, submitLabel = 'Salva modifiche', defaultSleepHours }: {
  session: Pick<WorkoutSession, 'energy' | 'sleepHours' | 'note'>;
  onSubmit: (feedback: SessionFeedback) => Promise<void>;
  onCancel: () => void;
  onBusyChange?: (busy: boolean) => void;
  submitLabel?: string;
  defaultSleepHours?: number;
}) {
  const id = useId();
  const [energy, setEnergy] = useState<number | null>(session.energy ?? null);
  const [sleep, setSleep] = useState(() => {
    const initialSleep = session.sleepHours ?? defaultSleepHours;
    return initialSleep == null ? '' : String(initialSleep).replace('.', ',');
  });
  const [note, setNote] = useState(session.note);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const saving = useRef(false);
  const numericSleep = sleepNumber(sleep);
  const validSleep = Number.isFinite(numericSleep) && numericSleep >= 0 && numericSleep <= 24 && Number.isInteger(numericSleep * 2);
  function adjustSleep(direction: 1 | -1) {
    const base = Number.isFinite(numericSleep) ? numericSleep : 7;
    const halfHours = direction === 1 ? Math.floor(base * 2) + 1 : Math.ceil(base * 2) - 1;
    setSleep(String(Math.min(24, Math.max(0, halfHours / 2))).replace('.', ','));
    setError('');
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current) return;
    const feedback: SessionFeedback = { energy: energy ?? Number.NaN, sleepHours: numericSleep, note };
    const message = validateSessionFeedback(feedback);
    if (message) {
      setError(message);
      event.currentTarget.querySelector<HTMLInputElement>(energy == null ? 'input[type="radio"]' : 'input[name="sleepHours"]')?.focus();
      return;
    }
    saving.current = true; setBusy(true); setError(''); onBusyChange?.(true);
    try { await onSubmit(feedback); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Salvataggio non riuscito. Riprova.'); }
    finally { saving.current = false; setBusy(false); onBusyChange?.(false); }
  }
  return <form className="session-feedback-form" noValidate onSubmit={(event) => void submit(event)}>
    <fieldset className="feedback-energy" disabled={busy}>
      <legend>Energia durante l’allenamento</legend>
      <div className="feedback-energy-options">{ENERGY_LABELS.map((label, index) => {
        const Icon = ENERGY_ICONS[index];
        return <label className="feedback-energy-option" data-level={index + 1} key={label}>
          <input type="radio" name={`${id}-energy`} aria-label={label} aria-invalid={Boolean(error) && energy == null || undefined} aria-describedby={error ? `${id}-error` : undefined} value={index + 1} checked={energy === index + 1} onChange={() => { setEnergy(index + 1); setError(''); }} required />
          <span><Icon className="feedback-energy-icon" size={26} aria-hidden="true" /><strong>{index + 1}</strong>{energy === index + 1 && <Check className="feedback-energy-selected" size={12} aria-hidden="true" />}</span>
        </label>;
      })}</div>
    </fieldset>
    <div className="number-field feedback-sleep">
      <div className="number-field-heading"><label htmlFor={`${id}-sleep`}>Ore di sonno prima dell’allenamento</label><span className="number-unit" aria-hidden="true">ore</span></div>
      <div className="number-controls">
        <button type="button" aria-label="Diminuisci ore di sonno" disabled={busy || numericSleep <= 0} onClick={() => adjustSleep(-1)}><Minus size={22} /></button>
        <input id={`${id}-sleep`} name="sleepHours" inputMode="decimal" value={sleep} onChange={(event) => { setSleep(event.target.value); setError(''); }} onFocus={(event) => event.target.select()} placeholder="—" disabled={busy} required autoComplete="off" aria-invalid={Boolean(error) && !validSleep || undefined} aria-describedby={error ? `${id}-error` : undefined} />
        <button type="button" aria-label="Aumenta ore di sonno" disabled={busy || numericSleep >= 24} onClick={() => adjustSleep(1)}><Plus size={22} /></button>
      </div>
    </div>
    <label className="field" htmlFor={`${id}-note`}>Note aggiuntive <span className="feedback-optional">Facoltative</span>
      <textarea id={`${id}-note`} value={note} rows={3} maxLength={5000} onChange={(event) => setNote(event.target.value)} disabled={busy} />
    </label>
    {error && <p id={`${id}-error`} role="alert" className="error-message">{error}</p>}
    <div className="session-feedback-actions"><button type="button" className="button button-ghost" onClick={onCancel} disabled={busy}>Annulla</button><button type="submit" className="button button-primary" disabled={busy}><Check size={18} />{busy ? 'Salvataggio…' : submitLabel}</button></div>
  </form>;
}

export function FinishWorkoutDialog({ open, session, completedCount, plannedCount, onClose, onSubmit }: {
  open: boolean;
  session: WorkoutSession;
  completedCount: number;
  plannedCount: number;
  onClose: () => void;
  onSubmit: (feedback: SessionFeedback) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return <Modal open={open} onClose={onClose} title="Termina allenamento" busy={busy} className="session-feedback-dialog">
    {open && <><p className="feedback-completion">{completedCount} di {plannedCount} serie completate</p><SessionFeedbackForm key={session.id} session={session} onSubmit={onSubmit} onCancel={onClose} onBusyChange={setBusy} submitLabel="Termina allenamento" defaultSleepHours={7} /></>}
  </Modal>;
}
