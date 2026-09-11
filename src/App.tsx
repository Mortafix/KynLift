import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Activity, AlertCircle, Check, Cloud, CloudOff, Dumbbell, ListChecks, LoaderCircle, RefreshCw } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { DataProvider, useData } from './data/DataContext';
import { Brand } from './components/Brand';
import { Avatar } from './components/Avatar';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ConfirmProvider, useConfirm } from './components/ConfirmDialog';
import { AuthPage } from './pages/Auth';
import { Home } from './pages/Home';
import { createSession } from './lib/domain';
import { resumeSessionChanges } from './lib/workout-actions';
import { updatePageMetadata } from './lib/seo';
import type { Routine, SyncStatus } from './types';

const Workout = lazy(() => import('./pages/Workout').then((module) => ({ default: module.Workout })));
const Routines = lazy(() => import('./pages/Routines'));
const RoutinePreview = lazy(() => import('./pages/RoutinePreview').then((module) => ({ default: module.RoutinePreview })));
const Catalog = lazy(() => import('./pages/Catalog'));
const Progress = lazy(() => import('./pages/Progress'));
const HistoryDetail = lazy(() => import('./pages/History').then((module) => ({ default: module.HistoryDetail })));
const Settings = lazy(() => import('./pages/Settings').then((module) => ({ default: module.Settings })));

const tabs = [
  { path: '/allenamento', label: 'Allenamento', Icon: Dumbbell },
  { path: '/schede', label: 'Schede', Icon: ListChecks },
  { path: '/progressi', label: 'Progressi', Icon: Activity },
];

function Loading() { return <div className="loading-screen" role="status"><LoaderCircle size={28} className="spinner" /><span>Un momento, prepariamo tutto.</span></div>; }

function SyncIndicator({ status, demo }: { status: SyncStatus; demo: boolean }) {
  const labels: Record<SyncStatus, string> = { local: demo ? 'Demo · dati locali' : 'Salvato sul dispositivo', offline: 'Offline · salvato sul dispositivo', pending: 'Sul dispositivo · sincronizzazione in corso', synced: 'Sincronizzato', error: 'Sincronizzazione da verificare' };
  const Icon = status === 'synced' ? Check : status === 'pending' ? RefreshCw : status === 'offline' ? CloudOff : status === 'error' ? AlertCircle : Cloud;
  return <span className={`sync-indicator sync-${status}`} role="status" title={labels[status]}><Icon size={14} aria-hidden="true" /><span>{labels[status]}</span></span>;
}

function AccountApp() {
  const auth = useAuth();
  const confirm = useConfirm();
  const navigating = useRef(false);
  const { data, loading, save, syncStatus } = useData();
  const [path, setPath] = useState(location.pathname === '/' ? '/allenamento' : location.pathname);
  const [error, setError] = useState('');
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [startingSession, setStartingSession] = useState(false);
  const dirty = useRef(false);
  const starting = useRef(false);
  const currentPath = useRef(path);
  const historyIndex = useRef<number>(Number(history.state?.kinliftIndex ?? 0));
  const main = useRef<HTMLElement>(null);
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW();
  const activeSessions = data.sessions.filter((session) => session.status === 'active').sort((a, b) => b.startedAt - a.startedAt);
  const active = activeSessions[0];
  const selectedTab = path === '/impostazioni' ? null : path.startsWith('/schede') || path.startsWith('/catalogo') ? '/schede' : path.startsWith('/progressi') || path.startsWith('/storico') ? '/progressi' : '/allenamento';
  const reportDirty = useCallback((value: boolean) => { dirty.current = value; }, []);
  const canLeave = useCallback(async () => !dirty.current || await confirm({ title: 'Lasciare la schermata?', message: 'Ci sono modifiche non salvate. Vuoi continuare senza salvarle?', confirmLabel: 'Lascia schermata', cancelLabel: 'Resta qui' }), [confirm]);

  useEffect(() => {
    const viewport = window.visualViewport;
    const update = () => {
      document.documentElement.style.setProperty('--visual-viewport-height', `${viewport?.height ?? window.innerHeight}px`);
      document.documentElement.style.setProperty('--visual-viewport-top', `${viewport?.offsetTop ?? 0}px`);
      const element = document.activeElement;
      const editing = element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement && !['checkbox', 'radio', 'button'].includes(element.type);
      const reduced = window.innerWidth < 760 && (window.innerHeight < 600 || (viewport?.height ?? window.innerHeight) < window.innerHeight - 120);
      // Keep controls in place between pointer down and click when an input blurs.
      // The full layout returns once the keyboard restores the viewport height.
      setKeyboardOpen((wasOpen) => reduced && (editing || wasOpen));
      if (reduced && editing && (!document.querySelector('.workout-page') || element?.closest('dialog'))) requestAnimationFrame(() => element?.scrollIntoView({ block: 'center', behavior: 'instant' }));
    };
    update();
    viewport?.addEventListener('resize', update);
    viewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    window.addEventListener('pageshow', update);
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', update);
    return () => {
      viewport?.removeEventListener('resize', update);
      viewport?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      window.removeEventListener('pageshow', update);
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', update);
    };
  }, []);

  useEffect(() => {
    history.replaceState({ ...history.state, kinliftIndex: historyIndex.current }, '', path);
    let traversal: { index: number; promise: Promise<void>; resolve: () => void } | null = null;
    const travelTo = async (index: number) => {
      while (traversal) await traversal.promise;
      const delta = index - Number(history.state?.kinliftIndex ?? 0);
      if (!delta) return;
      let resolve!: () => void;
      const promise = new Promise<void>((done) => { resolve = done; });
      traversal = { index, promise, resolve };
      history.go(delta);
      await promise;
    };
    const applyLocation = () => {
      historyIndex.current = Number(history.state?.kinliftIndex ?? 0);
      currentPath.current = location.pathname; setPath(location.pathname); setError('');
    };
    const pop = async () => {
      const destination = Number(history.state?.kinliftIndex ?? 0);
      if (traversal) {
        if (destination === traversal.index) {
          const finished = traversal; traversal = null; finished.resolve();
        } else history.go(traversal.index - destination);
        return;
      }
      if (navigating.current) { await travelTo(historyIndex.current); return; }
      if (!dirty.current) { applyLocation(); return; }
      navigating.current = true;
      try {
        // Restore the current entry before asking. Further Back clicks return here
        // too, so accepting or cancelling cannot leave URL and screen out of sync.
        await travelTo(historyIndex.current);
        if (!await canLeave()) return;
        dirty.current = false;
        await travelTo(destination);
        applyLocation();
      } finally { navigating.current = false; }
    };
    const unload = (event: BeforeUnloadEvent) => { if (dirty.current) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('popstate', pop); window.addEventListener('beforeunload', unload);
    return () => { window.removeEventListener('popstate', pop); window.removeEventListener('beforeunload', unload); };
    // The current route is read through a ref so history listeners are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canLeave]);

  useEffect(() => { window.scrollTo(0, 0); main.current?.scrollTo(0, 0); main.current?.focus({ preventScroll: true }); }, [path]);
  useEffect(() => { updatePageMetadata(path, true); }, [path]);
  const navigate = useCallback(async (next: string, replace = false) => {
    if (next === currentPath.current || navigating.current) return;
    navigating.current = true;
    try {
      if (!await canLeave()) return;
      dirty.current = false; currentPath.current = next;
      if (replace) history.replaceState({ kinliftIndex: historyIndex.current }, '', next);
      else { historyIndex.current += 1; history.pushState({ kinliftIndex: historyIndex.current }, '', next); }
      setPath(next); setError('');
    } finally { navigating.current = false; }
  }, [canLeave]);

  async function start(routine: Routine) {
    if (starting.current) return;
    starting.current = true; setStartingSession(true); setError('');
    try {
      if (!await canLeave()) return;
      if (active) { await navigate('/allenamento/sessione', true); return; }
      await save([{ collection: 'sessions', value: createSession(routine, data.exercises) }]);
      dirty.current = false; await navigate('/allenamento/sessione', true);
      // The browser can decline persistence; local transactions still work.
      void navigator.storage?.persist?.().catch(() => false);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Non è stato possibile iniziare. Riprova.'); }
    finally { starting.current = false; setStartingSession(false); }
  }

  async function resumeActive() {
    if (!active || starting.current || !await canLeave()) return;
    starting.current = true; setResuming(true); setError('');
    try {
      if (active.pausedAt != null) await save(resumeSessionChanges(active));
      dirty.current = false; navigate('/allenamento/sessione');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Non è stato possibile riprendere. Riprova.'); }
    finally { starting.current = false; setResuming(false); }
  }

  function screen() {
    if (loading) return <Loading />;
    if (path === '/schede') return <Routines onCatalog={() => navigate('/catalogo')} onDirtyChange={reportDirty} />;
    if (path === '/catalogo') return <Catalog onBack={() => navigate('/schede')} onDirtyChange={reportDirty} />;
    if (path === '/progressi') return <Progress onSession={(id) => navigate(`/storico/${encodeURIComponent(id)}`)} />;
    if (path === '/impostazioni') return <Settings onReset={() => navigate('/allenamento')} onDirtyChange={reportDirty} />;
    if (path.startsWith('/allenamento/scheda/')) {
      let id = ''; try { id = decodeURIComponent(path.slice('/allenamento/scheda/'.length)); } catch { /* A malformed URL shows the missing-routine state. */ }
      const routine = data.routines.find((item) => item.id === id);
      return routine ? <RoutinePreview routine={routine} onBack={() => navigate('/allenamento')} onStart={() => void start(routine)} busy={startingSession} /> : <section className="page empty-state"><h1>Scheda non disponibile.</h1><button type="button" className="button button-primary" onClick={() => navigate('/allenamento')}>Torna alle schede</button></section>;
    }
    if (path === '/allenamento/sessione' && active) return <Workout key={active.id} session={active} onBack={() => navigate('/allenamento')} onFinish={(id) => navigate(`/storico/${encodeURIComponent(id)}`)} onDirtyChange={reportDirty} />;
    if (path.startsWith('/storico/')) {
      let id = ''; try { id = decodeURIComponent(path.slice('/storico/'.length)); } catch { /* Invalid URL shows the same missing-session state. */ }
      const session = data.sessions.find((item) => item.id === id && item.status === 'completed');
      return session ? <HistoryDetail key={session.id} session={session} onBack={() => navigate('/progressi')} onDirtyChange={reportDirty} /> : <section className="page empty-state"><h1>Allenamento non disponibile.</h1><p className="muted">Potrebbe essere stato eliminato o non essere ancora sincronizzato.</p><button type="button" className="button button-secondary" onClick={() => navigate('/progressi')}>Torna ai progressi</button></section>;
    }
    if (path !== '/allenamento' && path !== '/allenamento/sessione') return <section className="page empty-state"><h1>Ripartiamo dall’allenamento.</h1><p className="muted">Questa pagina non esiste.</p><button type="button" className="button button-primary" onClick={() => navigate('/allenamento')}>Vai all’allenamento</button></section>;
    return <Home onDirtyChange={reportDirty} onRoutine={(routine) => navigate(`/allenamento/scheda/${encodeURIComponent(routine.id)}`)} onResume={() => navigate('/allenamento/sessione')} onRoutines={() => navigate('/schede')} onSession={(id) => navigate(`/storico/${encodeURIComponent(id)}`)} />;
  }

  return <div className={`app-shell${keyboardOpen ? ' keyboard-open' : ''}`}>
    <a className="skip-link" href="#main-content">Vai al contenuto</a>
    <header className="app-header"><button type="button" className="brand-button" onClick={() => navigate('/allenamento')} aria-label="Kynlift, vai all’allenamento"><Brand /></button><nav className="desktop-nav" aria-label="Navigazione principale">{tabs.map(({ path: destination, label, Icon }) => <button key={destination} type="button" className={selectedTab === destination ? 'active' : ''} aria-current={selectedTab === destination ? 'page' : undefined} onClick={() => navigate(destination)}><Icon size={19} />{label}</button>)}</nav><div className="header-account"><SyncIndicator status={syncStatus} demo={auth.isDemo} /><button type="button" className="avatar" onClick={() => navigate('/impostazioni')} aria-label="Apri impostazioni account"><Avatar user={auth.user} /></button></div></header>
    <div className="app-messages">
      {auth.isDemo && <p className="demo-banner">Stai provando Kynlift con dati di esempio.<button type="button" onClick={() => navigate('/impostazioni')}>Gestisci demo</button></p>}
      {error && <div className="app-error error-message" role="alert"><AlertCircle size={18} /><span>{error}</span></div>}
      {activeSessions.length > 1 && <p role="alert" className="error-message">Ci sono più allenamenti aperti su dispositivi diversi. Termina o annulla quello più recente; poi potrai recuperare il precedente. Usa Kynlift su un dispositivo alla volta.</p>}
      {needRefresh && <div className="update-banner" role="status"><span>È pronta una nuova versione di Kynlift.</span><button type="button" className="text-button" onClick={async () => { if (await canLeave()) void updateServiceWorker(true); }}>Aggiorna</button><button type="button" className="text-button" onClick={() => setNeedRefresh(false)}>Più tardi</button></div>}
    </div>
    <main id="main-content" ref={main} tabIndex={-1}><Suspense key={path} fallback={<Loading />}>{screen()}</Suspense></main>
    {active && path !== '/allenamento/sessione' && path !== '/allenamento' && <button type="button" className="resume-strip" disabled={resuming} onClick={() => void resumeActive()}><span className="live-dot" /><span>{active.pausedAt != null ? 'Allenamento in pausa' : 'Allenamento in corso'}</span><strong>Riprendi</strong></button>}
    <nav className="bottom-nav" aria-label="Navigazione principale mobile">{tabs.map(({ path: destination, label, Icon }) => <button type="button" key={destination} className={selectedTab === destination ? 'active' : ''} aria-current={selectedTab === destination ? 'page' : undefined} onClick={() => navigate(destination)}><Icon size={23} /><span>{label}</span></button>)}</nav>
  </div>;
}

function AuthGate() {
  const auth = useAuth();
  if (!auth.ready) return <AuthPage />;
  return auth.user ? <DataProvider><AccountApp key={`${auth.isDemo ? 'demo' : 'user'}:${auth.user.uid}`} /></DataProvider> : <AuthPage />;
}

export default function App() { return <ErrorBoundary><AuthProvider><ConfirmProvider><AuthGate /></ConfirmProvider></AuthProvider></ErrorBoundary>; }
