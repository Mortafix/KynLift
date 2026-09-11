import { useId, useMemo, useState, type KeyboardEvent } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight, CalendarDays, ChartNoAxesCombined, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, LoaderCircle, Trophy } from 'lucide-react';
import { useData } from '../data/DataContext';
import { Select } from '../components/Select';
import { exerciseKey, formatDate, formatNumber } from '../lib/domain';
import { calculateStats, completedEntries, estimatedOneRepMax, setVolume, trainingCalendar, type CompletedEntry, type PersonalRecord, type TrainingDay } from '../lib/stats';
import type { ExerciseSnapshot } from '../types';
import './progress.css';

type Metric = 'weight' | 'reps' | 'volume' | 'estimated-max';
type Side = 'left' | 'right';
type ProgressRange = '7' | '30' | '90' | 'all';
const progressTabs = [{ id: 'overview', label: 'Riepilogo' }, { id: 'exercises', label: 'Esercizi' }, { id: 'history', label: 'Storico' }] as const;
type ProgressTab = typeof progressTabs[number]['id'];
interface ChartPoint { id: string; date: number; value: number; source: string }
interface ProgressProps { onSession: (id: string) => void }

function dateRange(start: number, end: number) {
  return new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }).formatRange(new Date(start), new Date(end - 1));
}

function convention(exercise: ExerciseSnapshot) {
  const load = exercise.loadMode === 'bodyweight' ? 'Corpo libero + eventuale zavorra'
    : exercise.loadMode === 'assisted' ? 'Assistenza in kg'
      : exercise.loadMode === 'per-hand' ? `Kg per manubrio · ${exercise.loadMultiplier} in movimento` : 'Carico totale in kg';
  return `${load}${exercise.unilateral ? ' · lati separati' : ''}`;
}

function loadUnit(exercise: ExerciseSnapshot | undefined) {
  if (exercise?.loadMode === 'bodyweight') return 'kg di zavorra';
  if (exercise?.loadMode === 'assisted') return 'kg di assistenza';
  if (exercise?.loadMode === 'per-hand') return 'kg per manubrio';
  return 'kg';
}

function sideValues(entry: CompletedEntry, side: Side) {
  return entry.exercise.unilateral && side === 'right'
    ? { weight: entry.set.rightWeight ?? entry.set.weight, reps: entry.set.rightReps ?? entry.set.reps }
    : { weight: entry.set.weight, reps: entry.set.reps };
}

function sourceDescription(entry: CompletedEntry, side: Side) {
  const { weight, reps } = sideValues(entry, side);
  const sideLabel = entry.exercise.unilateral ? ` · ${side === 'left' ? 'sinistra' : 'destra'}` : '';
  return `${formatNumber(weight)} ${loadUnit(entry.exercise)} × ${reps} rip. · RIR ${entry.set.rir === null ? 'non indicato' : entry.set.rir}${sideLabel}`;
}

function chartPoints(entries: CompletedEntry[], metric: Metric, side: Side): ChartPoint[] {
  const bySession = new Map<string, CompletedEntry[]>();
  for (const entry of entries) bySession.set(entry.session.id, [...(bySession.get(entry.session.id) ?? []), entry]);
  return [...bySession.values()].flatMap((sessionEntries) => {
    const session = sessionEntries[0].session;
    if (metric === 'volume') return [{
      id: session.id, date: session.startedAt,
      value: sessionEntries.reduce((sum, entry) => sum + setVolume(entry.set, entry.exercise), 0),
      source: `${sessionEntries.length} serie completate${sessionEntries[0].exercise.unilateral ? ' · entrambi i lati' : ''}`,
    }];
    let best: { entry: CompletedEntry; value: number } | null = null;
    for (const entry of sessionEntries) {
      const { weight, reps } = sideValues(entry, side);
      const value = metric === 'estimated-max' ? estimatedOneRepMax(weight, reps) : metric === 'weight' ? weight : reps;
      if (value === null) continue;
      const lessIsBetter = metric === 'weight' && entry.exercise.loadMode === 'assisted';
      if (!best || (lessIsBetter ? value < best.value : value > best.value)) best = { entry, value };
    }
    return best ? [{ id: session.id, date: session.startedAt, value: best.value, source: sourceDescription(best.entry, side) }] : [];
  }).sort((a, b) => a.date - b.date);
}

function Change({ value }: { value: number | null }) {
  if (value === null) return <span className="progress-change muted"><span aria-hidden="true">—</span><span className="sr-only">Confronto non disponibile</span></span>;
  const Icon = value < 0 ? ArrowDownRight : ArrowUpRight;
  return <span className={`progress-change ${value > 0 ? 'is-positive' : ''}`}><Icon size={16} aria-hidden="true" />{value > 0 ? '+' : ''}{formatNumber(value)}%<span className="sr-only"> rispetto al periodo precedente</span></span>;
}

function TrendChart({ points, unit, title }: { points: ChartPoint[]; unit: string; title: string }) {
  const chartId = useId();
  if (!points.length) return <div className="progress-chart-empty"><ChartNoAxesCombined size={30} strokeWidth={1.5} aria-hidden="true" /><p>Nessun dato per questa metrica nel periodo scelto.</p></div>;
  const width = 520, height = 220, left = 48, right = 18, top = 18, bottom = 40;
  const upper = Math.max(...points.map((point) => point.value), 1) * 1.12;
  const step = 10 ** Math.floor(Math.log10(upper)) / 2;
  const max = Math.ceil(upper / step) * step;
  const start = points[0].date, end = points.at(-1)!.date;
  const x = (point: ChartPoint) => points.length === 1 ? (width + left - right) / 2 : left + (point.date - start) / (end - start || 1) * (width - left - right);
  const y = (value: number) => height - bottom - value / max * (height - top - bottom);
  const ticks = [0, max / 2, max];
  const coordinates = points.map((point) => `${x(point)},${y(point.value)}`).join(' ');
  const summary = `${title}. ${points.length} allenamenti, dal ${formatDate(start)} al ${formatDate(end)}. Prima misura: ${formatNumber(points[0].value)} ${unit}. Ultima misura: ${formatNumber(points.at(-1)!.value)} ${unit}. I valori e le serie di origine sono disponibili nella tabella sottostante.`;
  return <svg viewBox={`0 0 ${width} ${height}`} className="progress-chart" role="img" aria-labelledby={`${chartId}-title ${chartId}-description`}>
    <title id={`${chartId}-title`}>{title}</title><desc id={`${chartId}-description`}>{summary}</desc>
    {ticks.map((tick) => <g key={tick}><line className="chart-grid" x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} /><text className="chart-label" x={left - 10} y={y(tick) + 5} textAnchor="end">{formatNumber(tick, max < 10 ? 1 : 0)}</text></g>)}
    {points.length > 1 && <polyline points={coordinates} className="chart-line" />}
    {points.map((point) => <circle key={point.id} cx={x(point)} cy={y(point.value)} r={points.length > 30 ? 2.5 : 4} className="chart-point"><title>{formatDate(point.date)}: {formatNumber(point.value)} {unit}. {point.source}</title></circle>)}
    <text className="chart-label" x={left} y={height - 10}>{formatDate(start)}</text>
    {points.length > 1 && <text className="chart-label" x={width - right} y={height - 10} textAnchor="end">{formatDate(end)}</text>}
  </svg>;
}

function recordValue(record: PersonalRecord, exercise: ExerciseSnapshot) {
  return `${formatNumber(record.value)} ${record.kind === 'reps' ? 'rip.' : loadUnit(exercise)}`;
}

function recordDetail(record: PersonalRecord, exercise: ExerciseSnapshot) {
  if (record.kind === 'estimated-max') return `Da ${formatNumber(record.atWeight ?? 0)} ${loadUnit(exercise)} × ${record.atReps} rip. · RIR ${record.rir === null ? 'non indicato' : record.rir}`;
  if (record.kind === 'weight') return `a ${record.atReps} ripetizioni${exercise.loadMode === 'assisted' ? ' · meno assistenza' : ''}`;
  return `con ${formatNumber(record.atWeight ?? 0)} ${loadUnit(exercise)}`;
}

function Rhythm({ calendar, allTime }: { calendar: TrainingDay[]; allTime: boolean }) {
  const years = [...new Set(calendar.map((day) => new Date(day.date).getFullYear()))];
  const [chosenYear, setChosenYear] = useState<number | null>(null);
  const year = chosenYear !== null && years.includes(chosenYear) ? chosenYear : years.at(-1);
  const paginated = allTime && years.length > 1;
  const visible = paginated ? calendar.filter((day) => new Date(day.date).getFullYear() === year) : calendar;
  const months = [...Map.groupBy(visible, (day) => {
    const date = new Date(day.date);
    return `${date.getFullYear()}-${date.getMonth()}`;
  }).values()];
  if (!calendar.length) return null;
  return <section className="progress-rhythm" aria-labelledby="rhythm-title">
    <div className="progress-section-heading"><h2 id="rhythm-title">Il tuo ritmo</h2><span className="muted">{dateRange(calendar[0].date, calendar.at(-1)!.date + 1)}</span></div>
    {paginated && <div className="progress-calendar-navigation"><button type="button" className="icon-button" aria-label="Anno precedente" disabled={year === years[0]} onClick={() => setChosenYear(years[years.indexOf(year!) - 1])}><ChevronLeft size={20} /></button><strong aria-live="polite">{year}</strong><button type="button" className="icon-button" aria-label="Anno successivo" disabled={year === years.at(-1)} onClick={() => setChosenYear(years[years.indexOf(year!) + 1])}><ChevronRight size={20} /></button></div>}
    <div className="progress-calendar-months">
      {months.map((days) => <section className="progress-calendar-month" key={days[0].date} aria-label={formatDate(days[0].date, { month: 'long', year: 'numeric' })}>
        <h3>{formatDate(days[0].date, { month: 'long', year: 'numeric' })}</h3>
        <div className="progress-calendar-weekdays" aria-hidden="true">{['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((label, index) => <span key={index}>{label}</span>)}</div>
        <ol className="progress-training-days" aria-label="Giorni del mese">{days.map((day, index) => {
          const date = new Date(day.date);
          const description = `${formatDate(day.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}: ${day.workouts === 0 ? 'nessun allenamento' : `${day.workouts} ${day.workouts === 1 ? 'allenamento completato' : 'allenamenti completati'}`}`;
          return <li key={day.date} style={index === 0 ? { gridColumnStart: (date.getDay() + 6) % 7 + 1 } : undefined}><span role="img" className={`progress-training-day${day.workouts ? ' trained' : ''}`} aria-label={description} title={description}><span aria-hidden="true">{date.getDate()}</span>{day.workouts > 0 && <Check size={10} aria-hidden="true" />}</span></li>;
        })}</ol>
      </section>)}
    </div>
    <p className="progress-calendar-legend"><Check size={14} aria-hidden="true" />Allenamento completato</p>
  </section>;
}

export function Progress({ onSession }: ProgressProps) {
  const { data, loading, error } = useData();
  const [tab, setTab] = useState<ProgressTab>('overview');
  const [chosenExercise, setChosenExercise] = useState('');
  const [chosenMetric, setChosenMetric] = useState<Metric>('weight');
  const [side, setSide] = useState<Side>('left');
  const [range, setRange] = useState<ProgressRange>('30');
  const [chosenRecord, setChosenRecord] = useState<PersonalRecord['kind']>('weight');
  const [historyCount, setHistoryCount] = useState(12);
  const summary = useMemo(() => calculateStats(data.sessions, data.sets, Date.now(), range === 'all' ? null : Number(range)), [data.sessions, data.sets, range]);
  const calendar = useMemo(() => trainingCalendar(data.sessions, Date.now(), range === 'all' ? null : Number(range)), [data.sessions, range]);
  const entries = useMemo(() => completedEntries(data.sessions, data.sets), [data.sessions, data.sets]);
  const hasHistory = data.sessions.some((session) => !session.deletedAt && session.status === 'completed');
  const choices = useMemo(() => [...new Map(entries.map((entry) => [exerciseKey(entry.exercise), entry.exercise])).entries()], [entries]);
  const key = choices.some(([value]) => value === chosenExercise) ? chosenExercise : choices[0]?.[0] ?? '';
  const exercise = choices.find(([value]) => value === key)?.[1];
  const external = exercise?.loadMode !== 'bodyweight' && exercise?.loadMode !== 'assisted';
  const metric = !external && (chosenMetric === 'volume' || chosenMetric === 'estimated-max') ? 'reps' : chosenMetric;
  const recordKind = !external && chosenRecord === 'estimated-max' ? 'reps' : chosenRecord;
  const metricLabels: Record<Metric, string> = {
    weight: exercise?.loadMode === 'bodyweight' ? 'Zavorra' : exercise?.loadMode === 'assisted' ? 'Assistenza' : 'Carico',
    reps: 'Ripetizioni', volume: 'Volume', 'estimated-max': 'Massimale stimato',
  };
  const selectedEntries = useMemo(() => entries.filter((entry) => exerciseKey(entry.exercise) === key && entry.session.startedAt >= summary.period.currentStart && entry.session.startedAt < summary.period.currentEnd), [entries, key, summary.period.currentStart, summary.period.currentEnd]);
  const points = useMemo(() => chartPoints(selectedEntries, metric, side), [selectedEntries, metric, side]);
  const unit = metric === 'reps' ? 'rip.' : metric === 'volume' ? 'kg' : loadUnit(exercise);
  const records = summary.records.filter((record) => record.key.startsWith(`${key}:`) && record.kind === recordKind && (!exercise?.unilateral || record.side === side))
    .sort((a, b) => recordKind === 'weight' ? (a.atReps ?? 0) - (b.atReps ?? 0) : (a.atWeight ?? 0) - (b.atWeight ?? 0));
  const volumeDisplay = summary.current.volume >= 10_000 ? `${formatNumber(summary.current.volume / 1000)} t` : `${formatNumber(summary.current.volume, 0)} kg`;
  const changeTabWithKeyboard = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = event.key === 'ArrowRight' ? (index + 1) % progressTabs.length
      : event.key === 'ArrowLeft' ? (index + progressTabs.length - 1) % progressTabs.length
        : event.key === 'Home' ? 0 : event.key === 'End' ? progressTabs.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    setTab(progressTabs[next].id);
    event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`#progress-tab-${progressTabs[next].id}`)?.focus();
  };

  return <section className="page progress-page">
    <header className="page-header progress-heading"><h1 className="page-title">I tuoi progressi</h1></header>
    {error && <p className="error-message" role="alert">{error}</p>}
    {loading ? <div className="empty-state" role="status"><LoaderCircle className="progress-spin" aria-hidden="true" /><p>Caricamento dei tuoi progressi…</p></div> : !hasHistory ? <section className="empty-state progress-empty"><ChartNoAxesCombined size={44} strokeWidth={1.5} aria-hidden="true" /><h2>Ancora nessun allenamento</h2><p className="muted">Completa un allenamento per vedere i tuoi progressi.</p></section> : <>
      <div className="progress-navigation">
        <div className="progress-tabs" role="tablist" aria-label="Sezioni dei progressi">
          {progressTabs.map((item, index) => <button key={item.id} type="button" role="tab" id={`progress-tab-${item.id}`} aria-selected={tab === item.id} aria-controls={`progress-panel-${item.id}`} tabIndex={tab === item.id ? 0 : -1} onClick={() => setTab(item.id)} onKeyDown={(event) => changeTabWithKeyboard(event, index)}>{item.label}</button>)}
        </div>
        <Select className="progress-range-select" label="Periodo" leadingIcon={<CalendarDays size={17} />} value={range} onChange={(value) => { setRange(value as ProgressRange); setHistoryCount(12); }} options={[{ value: '7', label: 'Ultima settimana' }, { value: '30', label: 'Ultimo mese' }, { value: '90', label: 'Ultimi 3 mesi' }, { value: 'all', label: 'Sempre' }]} />
      </div>

      <div role="tabpanel" id="progress-panel-overview" aria-labelledby="progress-tab-overview" hidden={tab !== 'overview'} tabIndex={0}>
        <section className="progress-overview" aria-label="Riepilogo del periodo selezionato">
          <dl className="progress-totals">
            <div><dt>Allenamenti</dt><dd>{summary.current.workouts}</dd>{range !== 'all' && <Change value={summary.change.workouts} />}</div>
            <div><dt>Serie completate</dt><dd>{formatNumber(summary.current.sets, 0)}</dd>{range !== 'all' && <Change value={summary.change.sets} />}</div>
            <div><dt>Volume esterno</dt><dd className="progress-volume-value">{volumeDisplay}</dd>{range !== 'all' && <Change value={summary.change.volume} />}</div>
          </dl>
          {range !== 'all' && <p className="progress-comparison-caption muted">Rispetto al periodo precedente · {dateRange(summary.period.previousStart, summary.period.previousEnd)}</p>}
          {(summary.current.bodyweightReps > 0 || summary.current.assistedReps > 0) && <p className="progress-excluded muted">{summary.current.bodyweightReps > 0 ? `${formatNumber(summary.current.bodyweightReps, 0)} ripetizioni a corpo libero` : ''}{summary.current.bodyweightReps > 0 && summary.current.assistedReps > 0 ? ' · ' : ''}{summary.current.assistedReps > 0 ? `${formatNumber(summary.current.assistedReps, 0)} ripetizioni assistite` : ''}</p>}
        </section>
        <section className="progress-feedback" aria-labelledby="feedback-title"><div className="progress-section-heading"><h2 id="feedback-title">Energia e sonno</h2></div><dl>
          <div><dt>Energia media</dt><dd>{summary.feedback.energy.average === null ? <span aria-label="Non registrata">—</span> : <>{formatNumber(summary.feedback.energy.average)}<span> / 5</span></>}</dd><span>{summary.feedback.energy.count} di {summary.current.workouts} allenamenti</span></div>
          <div><dt>Sonno medio</dt><dd>{summary.feedback.sleepHours.average === null ? <span aria-label="Non registrato">—</span> : <>{formatNumber(summary.feedback.sleepHours.average)}<span> ore</span></>}</dd><span>{summary.feedback.sleepHours.count} di {summary.current.workouts} allenamenti</span></div>
        </dl></section>
        <div className="progress-overview-grid">
          <Rhythm key={range} calendar={calendar} allTime={range === 'all'} />
          <section className="progress-muscles" aria-labelledby="muscles-title"><div className="progress-section-heading"><h2 id="muscles-title">Dove hai lavorato</h2></div>{summary.muscles.length ? <ul>{summary.muscles.map((muscle) => <li key={muscle.name}><div><span>{muscle.name}</span><strong>{muscle.sets} <span>serie</span></strong></div><div className="progress-muscle-track" aria-hidden="true"><span style={{ width: `${muscle.sets / summary.muscles[0].sets * 100}%` }} /></div></li>)}</ul> : <p className="progress-inline-empty muted">Nessuna serie completata nel periodo scelto.</p>}</section>
        </div>
      </div>

      <div role="tabpanel" id="progress-panel-exercises" aria-labelledby="progress-tab-exercises" hidden={tab !== 'exercises'} tabIndex={0}>
        <section className="progress-trend" aria-label="Andamento degli esercizi">
          {exercise ? <>
            <Select className="progress-exercise-select" label="Esercizio" value={key} onChange={setChosenExercise} options={choices.map(([value, item]) => ({ value, label: `${item.name} · ${item.equipment}${choices.filter(([, candidate]) => candidate.id === item.id).length > 1 ? ` · ${convention(item)}` : ''}` }))} />
            <div className="progress-chart-controls">
              <div className="progress-metric-tabs" role="group" aria-label="Metrica del grafico">{(['weight', 'reps', ...(external ? ['volume', 'estimated-max'] : [])] as Metric[]).map((value) => <button type="button" key={value} aria-pressed={metric === value} className={metric === value ? 'is-active' : ''} onClick={() => setChosenMetric(value)}>{metricLabels[value]}</button>)}</div>
            </div>
            {exercise.unilateral && <div className="progress-side-tabs" role="group" aria-label="Lato per grafico e record"><span className="muted">Lato</span><button type="button" aria-pressed={side === 'left'} onClick={() => setSide('left')}>Sinistro</button><button type="button" aria-pressed={side === 'right'} onClick={() => setSide('right')}>Destro</button>{metric === 'volume' && <small className="muted">Volume di entrambi i lati</small>}</div>}
            <div className="progress-chart-panel">
              <div className="progress-chart-caption"><h3>{metricLabels[metric]}</h3><span className="muted">{metric === 'volume' ? 'kg per allenamento' : metric === 'reps' ? 'ripetizioni per serie' : unit}</span></div>
              <TrendChart points={points} unit={unit} title={`${metricLabels[metric]} · ${exercise.name}${exercise.unilateral && metric !== 'volume' ? ` · lato ${side === 'left' ? 'sinistro' : 'destro'}` : ''}`} />
              {points.length > 0 && <details className="progress-chart-data"><summary>Valori e serie <ChevronDown size={17} aria-hidden="true" /></summary><table><caption className="sr-only">Dati del grafico {metricLabels[metric]} per {exercise.name}</caption><thead><tr><th scope="col">Allenamento</th><th scope="col">{metricLabels[metric]}</th></tr></thead><tbody>{points.map((point) => <tr key={point.id}><td><button type="button" className="progress-date-link" onClick={() => onSession(point.id)}>{formatDate(point.date, { day: 'numeric', month: 'short', year: 'numeric' })}<ArrowRight size={15} aria-hidden="true" /></button><small>{point.source}</small></td><td>{formatNumber(point.value)} <span>{unit}</span></td></tr>)}</tbody></table></details>}
            </div>

            <section className="progress-records" aria-labelledby="records-title">
              <div className="progress-section-heading"><h2 id="records-title"><Trophy size={21} aria-hidden="true" />{range === 'all' ? 'I tuoi record' : 'Migliori risultati'}</h2></div>
              <Select className="progress-record-select" label="Confronto" value={recordKind} onChange={(value) => setChosenRecord(value as PersonalRecord['kind'])} options={[{ value: 'weight', label: exercise.loadMode === 'assisted' ? 'Minore assistenza a pari ripetizioni' : exercise.loadMode === 'bodyweight' ? 'Maggiore zavorra a pari ripetizioni' : 'Maggiore carico a pari ripetizioni' }, { value: 'reps', label: 'Più ripetizioni a pari carico' }, ...(external ? [{ value: 'estimated-max', label: 'Massimale stimato' }] : [])]} />
              {records.length ? <ul className="progress-record-list">{records.map((record) => <li key={record.key}><button type="button" onClick={() => onSession(record.sessionId)}><span className="progress-record-result"><strong>{recordValue(record, exercise)}</strong><span>{recordDetail(record, exercise)}</span></span><span className="progress-record-date">{formatDate(record.date, { day: 'numeric', month: 'short', year: '2-digit' })}<ArrowRight size={18} aria-hidden="true" /></span></button></li>)}</ul> : <p className="progress-inline-empty muted">Nessun risultato per questo confronto nel periodo scelto.</p>}
            </section>
          </> : <p className="progress-inline-empty muted">Nessuna serie completata.</p>}
        </section>
      </div>

      <div role="tabpanel" id="progress-panel-history" aria-labelledby="progress-tab-history" hidden={tab !== 'history'} tabIndex={0}>
        <section className="progress-history" aria-label="Allenamenti nel periodo selezionato">
          {summary.history.length ? <ul>{summary.history.slice(0, historyCount).map((session) => <li key={session.sessionId}><button type="button" onClick={() => onSession(session.sessionId)} aria-label={`Apri ${session.name} del ${formatDate(session.date, { day: 'numeric', month: 'long', year: 'numeric' })}`}><span className="progress-history-date"><strong>{formatDate(session.date, { day: '2-digit' })}</strong><span>{formatDate(session.date, { month: 'short', year: '2-digit' })}</span></span><span className="progress-history-description"><strong>{session.name}</strong><span>{session.sets} serie<span aria-hidden="true"> · </span><Clock3 size={13} aria-hidden="true" />{formatNumber(session.minutes, 0)} min</span></span><ArrowRight size={18} aria-hidden="true" /></button></li>)}</ul> : <p className="progress-inline-empty muted">Nessun allenamento nel periodo scelto.</p>}
          {summary.history.length > historyCount && <button type="button" className="button button-secondary progress-more-history" onClick={() => setHistoryCount((count) => count + 12)}>Mostra altri allenamenti<ChevronDown size={17} aria-hidden="true" /></button>}
        </section>
      </div>

      <details className="progress-definitions"><summary>Come sono calcolati i dati <ChevronDown size={17} aria-hidden="true" /></summary><div><p><strong>Volume esterno:</strong> carico totale in movimento × ripetizioni completate. Per i manubri conta il numero di attrezzi; per gli esercizi unilaterali sommiamo i due lati. Quando il lato destro è vuoto, usa i valori del sinistro.</p><p><strong>Corpo libero e assistenza:</strong> le ripetizioni sono conteggiate separatamente. Questi esercizi, anche con zavorra, sono esclusi dal volume esterno aggregato e dal massimale stimato.</p><p><strong>Grafico:</strong> ogni allenamento mostra il carico più alto, le ripetizioni massime, il volume totale o il massimale stimato migliore, secondo la metrica selezionata. Per l’assistenza mostra il carico minore. Le serie di origine riportano anche ripetizioni e RIR.</p><p><strong>Massimale stimato:</strong> peso × 36 / (37 − ripetizioni), per serie da 1 a 10 ripetizioni con carico positivo. È una stima della serie, non una misura diretta; per i manubri il valore è per singolo manubrio. Il RIR non corregge la stima.</p><p><strong>Periodi:</strong> settimana, mese e tre mesi corrispondono a 7, 30 e 90 giorni di calendario, compreso oggi, nel fuso orario del dispositivo. Il confronto usa lo stesso numero di giorni immediatamente precedenti. Con una base pari a zero o il periodo Sempre, la percentuale non è disponibile. Il ritmo mostra tutti i giorni del periodo selezionato. Sempre parte dal primo allenamento registrato; negli storici su più anni puoi cambiare anno.</p><p><strong>Energia e sonno:</strong> media dei valori registrati negli allenamenti conclusi del periodo. I conteggi indicano quanti allenamenti hanno un valore disponibile. I dati mancanti non sono trattati come zero; zero ore di sonno è un valore registrato.</p><p><strong>Migliori risultati:</strong> il confronto usa lo stesso esercizio, attrezzatura e convenzione di carico nel periodo selezionato. Una parità conserva la data del primo risultato; le correzioni dello storico aggiornano i record.</p><p><strong>Storico e gruppi muscolari:</strong> vengono conteggiate soltanto le serie salvate negli allenamenti conclusi. Ogni serie conta una volta nel gruppo muscolare principale. Le modifiche alle schede non cambiano i dati delle sessioni già iniziate.</p></div></details>
    </>}
  </section>;
}

export default Progress;
