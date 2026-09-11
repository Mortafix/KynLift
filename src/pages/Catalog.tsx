import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Dumbbell, LoaderCircle, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useData } from '../data/DataContext';
import { useConfirm } from '../components/ConfirmDialog';
import { scrollPageToTop } from '../lib/scroll';
import type { Exercise, LoadMode, MuscleGroup } from '../types';
import './routines.css';

interface CatalogProps { onBack: () => void; onDirtyChange?: (dirty: boolean) => void }
interface ExerciseDraft { id: string; createdAt: number; name: string; equipment: string; muscleGroup: MuscleGroup; loadMode: LoadMode; loadMultiplier: 1 | 2; unilateral: boolean; increment: string }
const muscles: MuscleGroup[] = ['Gambe', 'Glutei', 'Dorso', 'Petto', 'Spalle', 'Bicipiti', 'Tricipiti', 'Core', 'Altro'];
const modeLabels: Record<LoadMode, string> = { total: 'Peso totale', 'per-hand': 'Peso per mano', bodyweight: 'Corpo libero', assisted: 'Carico assistito' };
const modeHelp: Record<LoadMode, string> = { total: 'Registra il peso totale, compreso il bilanciere quando lo usi.', 'per-hand': 'Registra il peso di un singolo manubrio. Il volume tiene conto del numero di carichi che indichi sotto.', bodyweight: 'Registra le ripetizioni. Se aggiungi una zavorra, inserisci solo il peso aggiunto.', assisted: 'Registra i kg di assistenza della macchina. Meno assistenza significa un esercizio più impegnativo.' };

export function Catalog({ onBack, onDirtyChange }: CatalogProps) {
  const confirm = useConfirm();
  const { data, loading, error: dataError, save, remove } = useData();
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState('');
  const [draft, setDraft] = useState<ExerciseDraft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const exercises = useMemo(() => data.exercises.filter((item) => !item.deletedAt), [data.exercises]);
  const visibleExercises = useMemo(() => exercises.filter((exercise) => (!muscle || exercise.muscleGroup === muscle) && `${exercise.name} ${exercise.equipment}`.toLocaleLowerCase('it').includes(query.trim().toLocaleLowerCase('it'))).sort((a, b) => a.name.localeCompare(b.name, 'it')), [exercises, muscle, query]);
  const equipmentOptions = useMemo(() => [...new Set(exercises.map((exercise) => exercise.equipment))].sort((a, b) => a.localeCompare(b, 'it')), [exercises]);

  useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false); }, [dirty, onDirtyChange]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function edit(exercise?: Exercise) {
    setDraft(exercise ? { ...exercise, increment: String(exercise.increment).replace('.', ',') } : { id: crypto.randomUUID(), createdAt: Date.now(), name: '', equipment: '', muscleGroup: 'Altro', loadMode: 'total', loadMultiplier: 1, unilateral: false, increment: '2,5' });
    setDirty(false); setError(''); setNotice(''); scrollPageToTop();
  }
  function patch(patch: Partial<ExerciseDraft>) { setDraft((current) => current ? { ...current, ...patch } : null); setDirty(true); setError(''); }
  async function closeEditor() {
    if (dirty && !await confirm('Uscire senza salvare le modifiche all’esercizio?')) return;
    setDraft(null); setDirty(false); setError(''); scrollPageToTop();
  }
  async function saveExercise() {
    if (!draft || busy) return;
    if (!draft.name.trim()) { setError('Inserisci il nome dell’esercizio.'); return; }
    if (!draft.equipment.trim()) { setError('Indica l’attrezzatura, per esempio “Manubri” o “Nessuna”.'); return; }
    const increment = Number(draft.increment.trim().replace(',', '.'));
    if (!draft.increment.trim() || !Number.isFinite(increment) || increment <= 0 || increment > 100) { setError('Inserisci un incremento del peso maggiore di 0 e fino a 100 kg. Puoi usare la virgola.'); return; }
    const duplicate = exercises.find((exercise) => exercise.id !== draft.id && exercise.name.trim().toLocaleLowerCase('it') === draft.name.trim().toLocaleLowerCase('it') && exercise.equipment.trim().toLocaleLowerCase('it') === draft.equipment.trim().toLocaleLowerCase('it'));
    if (duplicate) { setError('Esiste già un esercizio con questo nome e questa attrezzatura. Modifica quello esistente o distingui il nome della variante.'); return; }
    const exercise: Exercise = { id: draft.id, createdAt: draft.createdAt, updatedAt: Date.now(), name: draft.name.trim(), equipment: draft.equipment.trim(), muscleGroup: draft.muscleGroup, loadMode: draft.loadMode, loadMultiplier: draft.loadMode === 'per-hand' ? draft.loadMultiplier : 1, unilateral: draft.unilateral, increment };
    setBusy(true); setError('');
    try { await save([{ collection: 'exercises', value: exercise }]); setDraft(null); setDirty(false); setNotice('Esercizio salvato sul dispositivo.'); scrollPageToTop(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Non è stato possibile salvare l’esercizio. Le modifiche sono ancora qui: riprova.'); }
    finally { setBusy(false); }
  }
  async function deleteExercise(exercise: Exercise) {
    if (busy) return;
    const usedBy = data.routines.filter((routine) => !routine.deletedAt && routine.exercises.some((item) => item.exerciseId === exercise.id));
    if (usedBy.length) { setError(`“${exercise.name}” è usato in ${usedBy.map((routine) => `“${routine.name}”`).join(', ')}. Rimuovilo da queste schede prima di eliminarlo dal catalogo.`); return; }
    if (!await confirm(`Eliminare “${exercise.name}” dal catalogo? Gli allenamenti già registrati rimangono nello storico.`)) return;
    setBusy(true); setError('');
    try { await remove('exercises', exercise.id); if (draft?.id === exercise.id) { setDraft(null); setDirty(false); } setNotice('Esercizio eliminato dal catalogo. Lo storico è conservato.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Impossibile eliminare l’esercizio. Riprova.'); }
    finally { setBusy(false); }
  }

  if (draft) {
    const existing = exercises.find((exercise) => exercise.id === draft.id);
    return <section className="page routines-page catalog-page">
      <header className="editor-heading"><button type="button" className="icon-button" onClick={closeEditor} disabled={busy} aria-label="Torna al catalogo"><ArrowLeft size={22} /></button><div><h1 className="page-title">{existing ? 'Modifica esercizio' : 'Nuovo esercizio'}</h1><p className="muted">Dai un nome preciso a ogni variante.</p></div></header>
      <form onSubmit={(event) => { event.preventDefault(); void saveExercise(); }} noValidate>
        <fieldset className="editor-fieldset catalog-editor-fields" disabled={busy}>
          <label className="field">Nome dell’esercizio<input autoFocus value={draft.name} onChange={(event) => patch({ name: event.target.value })} maxLength={200} placeholder="Es. Rematore con manubrio" autoComplete="off" required /></label>
          <div className="catalog-form-grid"><label className="field">Attrezzatura<input list="catalog-equipment" value={draft.equipment} onChange={(event) => patch({ equipment: event.target.value })} maxLength={200} placeholder="Es. Manubri" required /><datalist id="catalog-equipment">{equipmentOptions.map((equipment) => <option value={equipment} key={equipment} />)}</datalist></label><label className="field">Gruppo muscolare<select value={draft.muscleGroup} onChange={(event) => patch({ muscleGroup: event.target.value as MuscleGroup })}>{muscles.map((group) => <option key={group}>{group}</option>)}</select></label></div>
          <section className="catalog-load-section"><h2 className="section-title">Come registri il carico?</h2><label className="field">Tipo di carico<select value={draft.loadMode} onChange={(event) => { const mode = event.target.value as LoadMode; patch({ loadMode: mode, loadMultiplier: mode === 'per-hand' ? 2 : 1 }); }}><option value="total">Peso totale</option><option value="per-hand">Peso per mano</option><option value="bodyweight">Corpo libero e zavorra</option><option value="assisted">Carico assistito</option></select></label><p className="field-help">{modeHelp[draft.loadMode]}</p>
            {draft.loadMode === 'per-hand' && <label className="field">Carichi conteggiati nel volume<select value={draft.loadMultiplier} onChange={(event) => patch({ loadMultiplier: Number(event.target.value) as 1 | 2 })}><option value={2}>Due carichi · un manubrio per mano</option><option value={1}>Un solo carico</option></select></label>}
            <label className="catalog-checkbox"><input type="checkbox" checked={draft.unilateral} onChange={(event) => patch({ unilateral: event.target.checked })} /><span><strong>Registra i lati separatamente</strong><span className="muted">Peso e ripetizioni per sinistra e destra.</span></span></label>
            <label className="field catalog-increment-field">Incremento rapido, kg<input inputMode="decimal" value={draft.increment} onChange={(event) => patch({ increment: event.target.value })} placeholder="2,5" maxLength={8} required /></label><p className="field-help">Quanto cambia il peso a ogni tocco sui pulsanti + e − durante l’allenamento.</p>
          </section>
          {existing && <p className="catalog-history-note">Le modifiche valgono per i prossimi allenamenti. I dati già registrati conservano l’esercizio com’era.</p>}
        </fieldset>
        {(error || dataError) && <p className="error-message" role="alert">{error || dataError}</p>}
        <footer className="editor-actions"><button type="button" className="button button-secondary" onClick={closeEditor} disabled={busy}>Annulla</button><button type="submit" className="button button-primary" disabled={busy}>{busy ? <LoaderCircle size={19} className="routine-spinner" /> : <Check size={19} />}{busy ? 'Salvataggio…' : 'Salva esercizio'}</button></footer>
      </form>
      {existing && <button type="button" className="button button-ghost danger-button catalog-delete" onClick={() => void deleteExercise(existing)} disabled={busy}><Trash2 size={18} />Elimina dal catalogo</button>}
    </section>;
  }

  return <section className="page routines-page catalog-page">
    <header className="editor-heading"><button type="button" className="icon-button" onClick={onBack} aria-label="Torna alle schede"><ArrowLeft size={22} /></button><div><h1 className="page-title">Catalogo esercizi</h1><p className="muted">Le tue varianti, i tuoi carichi.</p></div></header>
    <div className="catalog-toolbar"><div className="catalog-search"><Search size={19} aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cerca nome o attrezzatura" aria-label="Cerca nel catalogo" /></div><button type="button" className="button button-primary" onClick={() => edit()} disabled={loading || busy}><Plus size={19} />Nuovo esercizio</button></div>
    <div className="catalog-filter-row"><label className="field">Gruppo muscolare<select value={muscle} onChange={(event) => setMuscle(event.target.value)}><option value="">Tutti i gruppi</option>{muscles.map((group) => <option key={group}>{group}</option>)}</select></label><span className="muted" role="status">{visibleExercises.length} {visibleExercises.length === 1 ? 'esercizio' : 'esercizi'}</span></div>
    {(error || dataError) && <p className="error-message" role="alert">{error || dataError}</p>}
    {notice && <p className="routine-notice" role="status"><Check size={17} aria-hidden="true" />{notice}</p>}
    {loading ? <div className="empty-state" role="status"><LoaderCircle className="routine-spinner" aria-hidden="true" /><p>Caricamento del catalogo…</p></div> : visibleExercises.length ? <div className="catalog-list">{visibleExercises.map((exercise) => <article className="catalog-row" key={exercise.id}><div className="catalog-row-info"><h2>{exercise.name}</h2><p className="muted">{exercise.equipment} · {exercise.muscleGroup}</p><p className="catalog-load-description">{modeLabels[exercise.loadMode]}{exercise.unilateral ? ' · lati separati' : ''}</p></div><button type="button" className="icon-button" aria-label={`Modifica ${exercise.name}`} onClick={() => edit(exercise)} disabled={busy}><Pencil size={19} /></button></article>)}</div> : <section className="empty-state routine-empty"><Dumbbell size={38} strokeWidth={1.5} aria-hidden="true" /><h2>{exercises.length ? 'Nessun esercizio trovato.' : 'Fai spazio al tuo primo esercizio.'}</h2><p className="muted">{exercises.length ? 'Prova un altro nome, cambia gruppo muscolare oppure crea una nuova variante.' : 'Aggiungi il nome, l’attrezzatura e il modo in cui registri il peso.'}</p>{exercises.length > 0 && <button type="button" className="button button-secondary" onClick={() => { setQuery(''); setMuscle(''); }}>Azzera filtri</button>}<button type="button" className="button button-primary" onClick={() => edit()}><Plus size={19} />Crea esercizio</button></section>}
  </section>;
}

export default Catalog;
