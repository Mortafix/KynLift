import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, Check, ChevronDown, Copy, Dumbbell, LoaderCircle, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { useData } from '../data/DataContext';
import { useConfirm } from '../components/ConfirmDialog';
import type { Exercise, MuscleGroup, Routine, RoutineExercise } from '../types';
import './routines.css';

interface RoutinesProps { onCatalog: () => void; onDirtyChange?: (dirty: boolean) => void }
interface ExerciseDraft { id: string; exerciseId: string; sets: string; repsMin: string; repsMax: string; rir: string; restSeconds: string; note: string }
interface RoutineDraft { id: string; createdAt: number; name: string; description: string; exercises: ExerciseDraft[] }
const muscles: MuscleGroup[] = ['Gambe', 'Glutei', 'Dorso', 'Petto', 'Spalle', 'Bicipiti', 'Tricipiti', 'Core', 'Altro'];
const numberOf = (value: string) => Number(value.trim().replace(',', '.'));
const integerIn = (value: string, min: number, max: number) => value.trim() !== '' && Number.isInteger(numberOf(value)) && numberOf(value) >= min && numberOf(value) <= max;
const fromRoutine = (routine: Routine): RoutineDraft => ({
  id: routine.id, createdAt: routine.createdAt, name: routine.name, description: routine.description,
  exercises: routine.exercises.map((item) => ({ ...item, sets: String(item.sets), repsMin: String(item.repsMin), repsMax: String(item.repsMax), rir: item.rir === null ? '' : String(item.rir), restSeconds: String(item.restSeconds) })),
});
const newExercise = (exerciseId: string): ExerciseDraft => ({ id: crypto.randomUUID(), exerciseId, sets: '3', repsMin: '8', repsMax: '12', rir: '', restSeconds: '90', note: '' });

export function Routines({ onCatalog, onDirtyChange }: RoutinesProps) {
  const confirm = useConfirm();
  const { data, loading, error: dataError, save, remove } = useData();
  const [draft, setDraft] = useState<RoutineDraft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const exercises = useMemo(() => data.exercises.filter((item) => !item.deletedAt), [data.exercises]);
  const exerciseById = useMemo(() => new Map(exercises.map((exercise) => [exercise.id, exercise])), [exercises]);
  const routines = useMemo(() => data.routines.filter((item) => !item.deletedAt).sort((a, b) => b.updatedAt - a.updatedAt), [data.routines]);
  const matchingExercises = useMemo(() => exercises.filter((exercise) => (!muscle || exercise.muscleGroup === muscle) && `${exercise.name} ${exercise.equipment}`.toLocaleLowerCase('it').includes(query.trim().toLocaleLowerCase('it'))).sort((a, b) => a.name.localeCompare(b.name, 'it')), [exercises, muscle, query]);

  useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false); }, [dirty, onDirtyChange]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function edit(routine?: Routine) {
    setDraft(routine ? fromRoutine(routine) : { id: crypto.randomUUID(), createdAt: Date.now(), name: '', description: '', exercises: [] });
    setExpanded(routine?.exercises[0]?.id ?? null);
    setDirty(false); setError(''); setNotice(''); setShowPicker(false); setQuery(''); setMuscle('');
    window.scrollTo({ top: 0 });
  }
  function patchDraft(patch: Partial<RoutineDraft>) { setDraft((current) => current ? { ...current, ...patch } : null); setDirty(true); setError(''); }
  function patchExercise(id: string, patch: Partial<ExerciseDraft>) {
    setDraft((current) => current ? { ...current, exercises: current.exercises.map((item) => item.id === id ? { ...item, ...patch } : item) } : null);
    setDirty(true); setError('');
  }
  async function closeEditor() {
    if (dirty && !await confirm('Uscire senza salvare le modifiche alla scheda?')) return;
    setDraft(null); setDirty(false); setError(''); setShowPicker(false);
    window.scrollTo({ top: 0 });
  }
  function addExercise(exercise: Exercise) {
    if (!draft) return;
    const item = newExercise(exercise.id);
    patchDraft({ exercises: [...draft.exercises, item] }); setExpanded(item.id); setShowPicker(false);
  }
  function moveExercise(index: number, delta: number) {
    if (!draft || index + delta < 0 || index + delta >= draft.exercises.length) return;
    const next = [...draft.exercises];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    patchDraft({ exercises: next });
  }
  async function deleteExercise(item: ExerciseDraft) {
    if (!draft || !await confirm(`Rimuovere ${exerciseById.get(item.exerciseId)?.name ?? 'questo esercizio'} dalla scheda?`)) return;
    patchDraft({ exercises: draft.exercises.filter((exercise) => exercise.id !== item.id) });
  }
  async function saveRoutine() {
    if (!draft || busy) return;
    if (!draft.name.trim()) { setError('Dai un nome alla scheda prima di salvarla.'); return; }
    if (!draft.exercises.length) { setError('Aggiungi almeno un esercizio alla scheda.'); return; }
    if (draft.exercises.length > 200) { setError('Una scheda può contenere al massimo 200 esercizi.'); return; }
    for (const [index, item] of draft.exercises.entries()) {
      const name = exerciseById.get(item.exerciseId)?.name;
      let problem = '';
      if (!name) problem = 'L’esercizio non è più nel catalogo. Rimuovilo o sostituiscilo.';
      else if (!integerIn(item.sets, 1, 50)) problem = 'Inserisci un numero di serie intero da 1 a 50.';
      else if (!integerIn(item.repsMin, 1, 999) || !integerIn(item.repsMax, 1, 999)) problem = 'Inserisci ripetizioni intere da 1 a 999.';
      else if (numberOf(item.repsMax) < numberOf(item.repsMin)) problem = 'Le ripetizioni massime devono essere almeno uguali alle minime.';
      else if (item.rir.trim() && !integerIn(item.rir, 0, 10)) problem = 'Il RIR deve essere un numero intero tra 0 e 10, oppure vuoto.';
      else if (!integerIn(item.restSeconds, 0, 3600)) problem = 'Inserisci un recupero da 0 a 3600 secondi.';
      if (problem) { setError(`${name ?? `Esercizio ${index + 1}`}: ${problem}`); setExpanded(item.id); return; }
    }
    const values: RoutineExercise[] = draft.exercises.map((item) => ({ ...item, sets: numberOf(item.sets), repsMin: numberOf(item.repsMin), repsMax: numberOf(item.repsMax), rir: item.rir.trim() ? numberOf(item.rir) : null, restSeconds: numberOf(item.restSeconds), note: item.note.trim() }));
    const routine: Routine = { id: draft.id, createdAt: draft.createdAt, updatedAt: Date.now(), name: draft.name.trim(), description: draft.description.trim(), exercises: values };
    setBusy(true); setError('');
    try { await save([{ collection: 'routines', value: routine }]); setDraft(null); setDirty(false); setNotice('Scheda salvata sul dispositivo.'); window.scrollTo({ top: 0 }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Non è stato possibile salvare la scheda. Le modifiche sono ancora qui: riprova.'); }
    finally { setBusy(false); }
  }
  async function duplicate(routine: Routine) {
    if (busy) return;
    const now = Date.now();
    const copy: Routine = { ...routine, id: crypto.randomUUID(), createdAt: now, updatedAt: now, name: `${routine.name.slice(0, 192)} · copia`, exercises: routine.exercises.map((item) => ({ ...item, id: crypto.randomUUID() })) };
    setBusy(true); setError('');
    try { await save([{ collection: 'routines', value: copy }]); setNotice('Copia salvata. Puoi adattarla al prossimo allenamento.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Impossibile duplicare la scheda. Riprova.'); }
    finally { setBusy(false); }
  }
  async function deleteRoutine(routine: Routine) {
    if (busy || !await confirm(`Eliminare la scheda “${routine.name}”? Gli allenamenti già registrati rimangono nello storico.`)) return;
    setBusy(true); setError('');
    try { await remove('routines', routine.id); setNotice('Scheda eliminata. Gli allenamenti restano nello storico.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Impossibile eliminare la scheda. Riprova.'); }
    finally { setBusy(false); }
  }

  if (draft) return (
    <section className="page routines-page routine-editor">
      <header className="editor-heading">
        <button type="button" className="icon-button" onClick={closeEditor} disabled={busy} aria-label="Torna alle schede"><ArrowLeft size={22} /></button>
        <div><h1 className="page-title">{routines.some((item) => item.id === draft.id) ? 'Modifica scheda' : 'Nuova scheda'}</h1><p className="muted">Preparala qui. In palestra, pensa alla prossima serie.</p></div>
      </header>
      <form onSubmit={(event) => { event.preventDefault(); void saveRoutine(); }} noValidate>
        <fieldset className="editor-fieldset" disabled={busy}>
          <section className="routine-basics">
            <label className="field">Nome della scheda<input autoFocus value={draft.name} maxLength={200} onChange={(event) => patchDraft({ name: event.target.value })} placeholder="Es. Gambe e glutei" autoComplete="off" required /></label>
            <label className="field">Descrizione <span className="field-optional">facoltativa</span><textarea value={draft.description} maxLength={5000} onChange={(event) => patchDraft({ description: event.target.value })} placeholder="Focus della giornata, indicazioni generali…" rows={2} /></label>
          </section>
          <div className="routine-section-heading"><h2 className="section-title">Esercizi</h2><span className="muted">{draft.exercises.length} in scheda</span></div>
          {draft.exercises.length === 0 && <div className="routine-empty-inline"><Dumbbell size={30} aria-hidden="true" /><p>Da quale esercizio parti?</p><span className="muted">Aggiungilo dal catalogo e imposta le serie.</span></div>}
          <div className="routine-exercise-list">
            {draft.exercises.map((item, index) => {
              const exercise = exerciseById.get(item.exerciseId);
              const isExpanded = expanded === item.id;
              return <article className="routine-exercise" key={item.id}>
                <div className="routine-exercise-top">
                  <button type="button" className="routine-exercise-toggle" onClick={() => setExpanded(isExpanded ? null : item.id)} aria-expanded={isExpanded} aria-controls={`exercise-fields-${item.id}`}>
                    <span className="exercise-order">{String(index + 1).padStart(2, '0')}</span>
                    <span className="exercise-title"><strong>{exercise?.name ?? 'Esercizio non disponibile'}</strong><span className="muted">{item.sets || '—'} serie · {item.repsMin || '—'}{item.repsMax !== item.repsMin ? `–${item.repsMax || '—'}` : ''} ripetizioni · {item.restSeconds || '0'} s</span></span>
                    <ChevronDown size={18} className={isExpanded ? 'chevron-open' : ''} aria-hidden="true" />
                  </button>
                  <div className="exercise-order-actions">
                    <button type="button" className="icon-button" disabled={index === 0} aria-label={`Sposta ${exercise?.name ?? 'esercizio'} prima`} onClick={() => moveExercise(index, -1)}><ArrowUp size={18} /></button>
                    <button type="button" className="icon-button" disabled={index === draft.exercises.length - 1} aria-label={`Sposta ${exercise?.name ?? 'esercizio'} dopo`} onClick={() => moveExercise(index, 1)}><ArrowDown size={18} /></button>
                    <button type="button" className="icon-button danger-button" aria-label={`Rimuovi ${exercise?.name ?? 'esercizio'} dalla scheda`} onClick={() => deleteExercise(item)}><Trash2 size={17} /></button>
                  </div>
                </div>
                {isExpanded && <div className="prescription-fields" id={`exercise-fields-${item.id}`}>
                  <div className="prescription-grid">
                    <label className="field">Serie<input inputMode="numeric" value={item.sets} onChange={(event) => patchExercise(item.id, { sets: event.target.value })} maxLength={3} required /></label>
                    <label className="field">Ripetizioni min.<input inputMode="numeric" value={item.repsMin} onChange={(event) => patchExercise(item.id, { repsMin: event.target.value })} maxLength={3} required /></label>
                    <label className="field">Ripetizioni max.<input inputMode="numeric" value={item.repsMax} onChange={(event) => patchExercise(item.id, { repsMax: event.target.value })} maxLength={3} required /></label>
                    <label className="field">Recupero, secondi<input inputMode="numeric" value={item.restSeconds} onChange={(event) => patchExercise(item.id, { restSeconds: event.target.value })} maxLength={4} required /></label>
                    <label className="field">RIR <span className="field-optional">facoltativo</span><input inputMode="numeric" value={item.rir} onChange={(event) => patchExercise(item.id, { rir: event.target.value })} placeholder="—" maxLength={2} /></label>
                  </div>
                  <p className="field-help">RIR: ripetizioni che pensi di avere ancora a disposizione a fine serie.</p>
                  <label className="field">Nota sull’esercizio <span className="field-optional">facoltativa</span><textarea rows={2} maxLength={5000} value={item.note} onChange={(event) => patchExercise(item.id, { note: event.target.value })} placeholder="Es. Discesa controllata, pausa in basso…" /></label>
                </div>}
              </article>;
            })}
          </div>
          <button type="button" className="button button-secondary add-exercise-button" onClick={() => setShowPicker(!showPicker)} aria-expanded={showPicker}>{showPicker ? <X size={19} /> : <Plus size={19} />}{showPicker ? 'Chiudi catalogo' : 'Aggiungi esercizio'}</button>
          {showPicker && <section className="exercise-picker" aria-label="Scegli un esercizio">
            <div className="catalog-search"><Search size={19} aria-hidden="true" /><input aria-label="Cerca un esercizio da aggiungere" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cerca nome o attrezzatura" /></div>
            <label className="field">Gruppo muscolare<select value={muscle} onChange={(event) => setMuscle(event.target.value)}><option value="">Tutti i gruppi</option>{muscles.map((value) => <option key={value}>{value}</option>)}</select></label>
            <div className="exercise-picker-results">
              {matchingExercises.map((exercise) => <button type="button" className="exercise-picker-row" key={exercise.id} onClick={() => addExercise(exercise)} aria-label={`Aggiungi ${exercise.name}`}><span><strong>{exercise.name}</strong><span className="muted">{exercise.muscleGroup} · {exercise.equipment}</span></span><Plus size={20} aria-hidden="true" /></button>)}
              {matchingExercises.length === 0 && <p className="muted picker-no-results">{exercises.length ? 'Nessun esercizio trovato. Prova un altro nome o gruppo.' : 'Il catalogo è vuoto. Crea prima un esercizio nella sezione Catalogo.'}</p>}
            </div>
          </section>}
        </fieldset>
        {(error || dataError) && <p className="error-message" role="alert">{error || dataError}</p>}
        <footer className="editor-actions"><button type="button" className="button button-secondary" onClick={closeEditor} disabled={busy}>Annulla</button><button type="submit" className="button button-primary" disabled={busy}>{busy ? <LoaderCircle size={19} className="routine-spinner" /> : <Check size={19} />} {busy ? 'Salvataggio…' : 'Salva scheda'}</button></footer>
      </form>
    </section>
  );

  return <section className="page routines-page">
    <header className="page-header routines-heading">
      <div><h1 className="page-title">Le tue schede</h1><p className="muted">Un programma pronto. Una serie alla volta.</p></div>
      <div className="routines-heading-actions">
        <button type="button" className="button button-primary" onClick={() => edit()} disabled={loading || busy}><Plus size={19} aria-hidden="true" />Nuova scheda</button>
        <button type="button" className="button button-secondary catalog-link" onClick={onCatalog}><Dumbbell size={19} aria-hidden="true" />Catalogo esercizi</button>
      </div>
    </header>
    {(error || dataError) && <p className="error-message" role="alert">{error || dataError}</p>}
    {notice && <p className="routine-notice" role="status"><Check size={17} aria-hidden="true" />{notice}</p>}
    {loading ? <div className="empty-state" role="status"><LoaderCircle className="routine-spinner" aria-hidden="true" /><p>Caricamento delle schede…</p></div> : routines.length === 0 ? <section className="empty-state routine-empty"><Dumbbell size={42} strokeWidth={1.5} aria-hidden="true" /><h2>La prossima serie parte da qui.</h2><p className="muted">Crea la tua scheda con esercizi, ripetizioni e recuperi. I risultati li registrerai durante l’allenamento.</p><button type="button" className="button button-primary" onClick={() => edit()}><Plus size={19} />Crea la prima scheda</button></section> : <div className="routine-list">{routines.map((routine) => {
      const missingExercises = routine.exercises.some((item) => !exerciseById.has(item.exerciseId));
      const totalSets = routine.exercises.reduce((total, item) => total + item.sets, 0);
      const groups = [...new Set(routine.exercises.map((item) => exerciseById.get(item.exerciseId)?.muscleGroup).filter(Boolean))];
      return <article className="routine-list-item" key={routine.id}>
        <div className="routine-list-content"><div className="routine-list-title"><h2>{routine.name}</h2></div>{routine.description && <p className="routine-description">{routine.description}</p>}<p className="routine-summary"><strong>{routine.exercises.length}</strong> esercizi<span aria-hidden="true"> · </span><strong>{totalSets}</strong> serie</p><div className="routine-muscles">{groups.map((group) => <span className="tag" key={group}>{group}</span>)}</div><p className="routine-exercise-preview muted">{routine.exercises.slice(0, 3).map((item) => exerciseById.get(item.exerciseId)?.name ?? 'Esercizio non disponibile').join(' / ')}{routine.exercises.length > 3 ? ` / +${routine.exercises.length - 3}` : ''}</p></div>
        <div className="routine-list-actions" role="group" aria-label={`Gestisci ${routine.name}`}>
          <button type="button" className="button button-secondary routine-edit-button" aria-label={`Modifica ${routine.name}`} onClick={() => edit(routine)} disabled={busy}><Pencil size={19} aria-hidden="true" />Modifica</button>
          <button type="button" className="button button-secondary routine-action-icon" onClick={() => void duplicate(routine)} disabled={busy} aria-label={`Duplica ${routine.name}`} title="Duplica scheda"><Copy size={19} aria-hidden="true" /></button>
          <button type="button" className="button button-secondary routine-action-icon danger-button" onClick={() => void deleteRoutine(routine)} disabled={busy} aria-label={`Elimina ${routine.name}`} title="Elimina scheda"><Trash2 size={19} aria-hidden="true" /></button>
        </div>
        {missingExercises && <p className="error-message">Un esercizio non è più disponibile. Modifica la scheda prima di iniziare.</p>}
      </article>;
    })}</div>}
  </section>;
}

export default Routines;
