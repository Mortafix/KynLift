import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Check, ArrowLeft, LoaderCircle } from 'lucide-react';
import { Brand, Mark } from '../components/Brand';
import { GoogleMark } from '../components/GoogleMark';
import { useAuth } from '../auth/context';


function revealInPanel(panel: HTMLElement, element: HTMLElement) {
  const container = panel.getBoundingClientRect();
  const target = element.getBoundingClientRect();
  if (target.top < container.top + 8) panel.scrollTop += target.top - container.top - 8;
  else if (target.bottom > container.bottom - 8) panel.scrollTop += target.bottom - container.bottom + 8;
}

export function AuthPage() {
  const auth = useAuth();
  const screen = useRef<HTMLDivElement>(null);
  const formPanel = useRef<HTMLElement>(null);
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const unavailable = busy || !auth.ready;
  useEffect(() => {
    const viewport = window.visualViewport;
    let frame = 0;
    let keyboardOpen = false;
    const update = () => {
      const height = viewport?.height ?? window.innerHeight;
      screen.current?.style.setProperty('--auth-viewport-height', `${height}px`);
      screen.current?.style.setProperty('--auth-viewport-top', `${viewport?.offsetTop ?? 0}px`);
      const focused = document.activeElement;
      const editing = focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement;
      const reduced = window.innerWidth < 760 && (window.innerHeight < 600 || height < window.innerHeight - 120);
      keyboardOpen = reduced && (editing || keyboardOpen);
      if (screen.current) {
        // Outside keyboard interactions CSS chooses the browser/installed height;
        // visualViewport can report a stale measure when restoring an iOS app.
        screen.current.dataset.keyboardOpen = String(keyboardOpen);
        const style = getComputedStyle(screen.current);
        const availableHeight = screen.current.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
        screen.current.dataset.compact = String(availableHeight < 680 || window.innerWidth < 760 && availableHeight < 800);
      }
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const panel = formPanel.current;
        const field = document.activeElement;
        if (panel && field instanceof HTMLElement && panel.contains(field)) revealInPanel(panel, field);
      });
    };
    update();
    viewport?.addEventListener('resize', update);
    viewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    window.addEventListener('pageshow', update);
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', update);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener('resize', update);
      viewport?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      window.removeEventListener('pageshow', update);
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', update);
    };
  }, []);
  useEffect(() => {
    const panel = formPanel.current;
    const message = panel?.querySelector<HTMLElement>('[role="alert"], [role="status"]');
    if (panel && message) revealInPanel(panel, message);
  }, [error, auth.error, notice]);
  async function act(action: () => Promise<void>) {
    setBusy(true); setError(''); setNotice('');
    try { await action(); } catch (failure) { setError(failure instanceof Error ? failure.message : 'Non è stato possibile accedere. Riprova.'); }
    finally { setBusy(false); }
  }
  function changeMode(next: typeof mode) { setMode(next); setError(''); setNotice(''); auth.clearError(); }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (unavailable) return;
    void act(async () => {
      if (mode === 'reset') { await auth.resetPassword(email); setNotice('Se esiste un account con questa email, riceverai le istruzioni per reimpostare la password.'); }
      else if (mode === 'signup') await auth.signUp(email, password, name);
      else await auth.signIn(email, password);
    });
  }
  return <div ref={screen} className="auth-screen">
    <header className="auth-header"><Brand /><span className="auth-header-note">Ogni serie conta.</span></header>
    <main className="auth-layout">
      <section className="auth-story">
        <h1>Il tuo allenamento,<br /><span>serie per serie.</span></h1>
        <div className="brand-instrument" aria-hidden="true">
          <div className="instrument-head"><Mark /><span>ESEMPIO DI SERIE</span><span className="instrument-led" /></div>
          <div className="instrument-values"><span>60<small>kg</small></span><span className="instrument-cross">×</span><span>10<small>reps</small></span></div>
          <div className="instrument-bottom"><span>Il resto, ricordalo qui.</span><Check size={22} /></div>
        </div>
      </section>
      <section ref={formPanel} className="auth-form-section" aria-label={auth.configured && mode === 'login' ? 'Accedi a Kynlift' : undefined} aria-labelledby={!auth.configured || mode !== 'login' ? 'auth-title' : undefined}>
        <noscript><p className="setup-notice">Attiva JavaScript nel browser per accedere a Kynlift o esplorare la demo.</p></noscript>
        {mode === 'reset' && <button type="button" className="button button-ghost back-button" onClick={() => changeMode('login')}><ArrowLeft size={18} />Torna all’accesso</button>}
        {(!auth.configured || mode !== 'login') && <h2 id="auth-title">{!auth.configured ? 'Prova Kynlift.' : mode === 'signup' ? 'Inizia da te.' : 'Una nuova password.'}</h2>}
        {(!auth.configured || mode !== 'login') && <p className="muted">{!auth.configured ? 'Scopri come si registra un allenamento, una serie alla volta.' : mode === 'signup' ? 'Crea il tuo account e porta lo storico con te.' : 'Ti invieremo un’email per scegliere una nuova password.'}</p>}
        {!auth.configured && <p className="setup-notice">Questa installazione non è ancora pronta per gli account. Puoi già esplorare la demo.</p>}
        {auth.configured && <>{mode !== 'reset' && <><button type="button" className="button button-secondary google-button" disabled={!auth.configured || unavailable} onClick={() => void act(auth.signInGoogle)}><GoogleMark />Continua con Google</button><div className="form-divider"><span>oppure con email</span></div></>}
        <form onSubmit={submit}>
          {mode === 'signup' && <label className="field">Il tuo nome<input autoComplete="given-name" value={name} maxLength={80} onChange={(event) => setName(event.target.value)} placeholder="Come ti chiami?" required disabled={!auth.configured || unavailable} /></label>}
          <label className="field">Email<input type="email" inputMode="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nome@esempio.it" required disabled={!auth.configured || unavailable} /></label>
          {mode !== 'reset' && <label className="field">Password<input type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === 'signup' ? 'Almeno 6 caratteri' : 'La tua password'} required disabled={!auth.configured || unavailable} /></label>}
          {mode === 'login' && <button type="button" className="text-button forgot-password" disabled={unavailable} onClick={() => changeMode('reset')}>Password dimenticata?</button>}
          {(error || auth.error) && <p role="alert" className="error-message">{error || auth.error}</p>}
          {notice && <p role="status" className="success-message">{notice}</p>}
          <button type="submit" className="button button-primary auth-submit" disabled={!auth.configured || unavailable}>{busy ? <LoaderCircle className="spin" size={20} /> : null}{mode === 'signup' ? 'Crea account' : mode === 'reset' ? 'Invia istruzioni' : 'Accedi'}<ArrowRight size={20} /></button>
        </form>
        {mode !== 'reset' && <p className="auth-switch">{mode === 'signup' ? 'Hai già un account?' : 'La prima volta qui?'} <button type="button" className="text-button" disabled={unavailable} onClick={() => changeMode(mode === 'login' ? 'signup' : 'login')}>{mode === 'signup' ? 'Accedi' : 'Crea un account'}</button></p>}
        </>}
        {!auth.configured && (error || auth.error) && <p role="alert" className="error-message">{error || auth.error}</p>}
        <div className="demo-entry"><button type="button" className={`button ${auth.configured ? 'button-ghost' : 'button-primary'}`} disabled={unavailable} onClick={() => void act(auth.enterDemo)}>Esplora la demo<ArrowRight size={18} /></button></div>
      </section>
    </main>
    <footer className="auth-footer"><span>Kynlift</span><span>Un po’ meno da ricordare. Un po’ più spazio per te.</span></footer>
  </div>;
}
