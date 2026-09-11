import { useState } from 'react';
import { ArrowLeft, Download, Link2, LogOut, Mail, MonitorSmartphone, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useData } from '../data/DataContext';
import { useConfirm } from '../components/ConfirmDialog';

export function Settings({ onBack, onReset }: { onBack: () => void; onReset: () => void }) {
  const confirm = useConfirm();
  const auth = useAuth();
  const { data, syncStatus, resetDemo } = useData();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function run(action: () => Promise<void>, success?: string) {
    setBusy(true); setError(''); setMessage('');
    try { await action(); if (success) setMessage(success); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Operazione non riuscita. Riprova.'); }
    finally { setBusy(false); }
  }
  function exportData() {
    const blob = new Blob([JSON.stringify({ app: 'Kynlift', version: 1, exportedAt: new Date().toISOString(), demo: auth.isDemo, data }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `kynlift-${auth.isDemo ? 'demo-' : ''}${new Date().toISOString().slice(0, 10)}.json`; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className="page settings-page">
    <button type="button" className="button button-ghost back-button" onClick={onBack}><ArrowLeft size={18} />Indietro</button>
    <div className="page-header"><div><h1 className="page-title">Il tuo spazio.</h1><p className="muted">Account, dati e preferenze.</p></div></div>
    {error && <p role="alert" className="error-message">{error}</p>}
    {message && <p role="status" className="success-message">{message}</p>}
    <section className="settings-section"><h2><ShieldCheck size={20} />Il tuo account</h2><div className="account-identity"><span className="avatar avatar-large">{auth.user?.displayName?.slice(0, 1).toUpperCase() ?? 'K'}</span><div><strong>{auth.user?.displayName ?? 'Il tuo account'}</strong><p className="muted">{auth.isDemo ? 'Modalità demo · dati di esempio' : auth.user?.email}</p></div></div>
      {!auth.isDemo && <><div className="account-methods"><span className="tag">{auth.user?.providers.includes('password') ? 'Email e password collegate' : 'Email e password non collegate'}</span><span className="tag">{auth.user?.providers.includes('google.com') ? 'Google collegato' : 'Google non collegato'}</span></div>
        {!auth.user?.providers.includes('google.com') && <button type="button" className="button button-secondary" onClick={() => void run(auth.linkGoogle)} disabled={busy}><Link2 size={18} />Collega Google</button>}
        {!auth.user?.providers.includes('password') && <form className="link-password" onSubmit={(event) => { event.preventDefault(); void run(() => auth.linkPassword(password), 'Password aggiunta. Puoi accedere con entrambi i metodi.'); }}><label className="field">Aggiungi una password<input type="password" autoComplete="new-password" required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Almeno 6 caratteri" /></label><button type="submit" className="button button-secondary" disabled={busy}><Mail size={18} />Collega email e password</button></form>}
        {auth.user?.providers.includes('password') && <button type="button" className="text-button" disabled={busy} onClick={() => void run(() => auth.resetPassword(auth.user?.email ?? ''), 'Email per reimpostare la password inviata. Controlla la posta.')} >Reimposta la password</button>}
      </>}
    </section>
    <section className="settings-section"><h2><Download size={20} />I tuoi dati</h2><p className="muted">{auth.isDemo ? 'Questi allenamenti sono esempi e rimangono in questa demo.' : syncStatus === 'synced' ? 'Le modifiche sono sincronizzate con il tuo account.' : 'Le modifiche salvate restano sul dispositivo. Quando la connessione è disponibile, Kynlift le sincronizza con il tuo account.'}</p><button type="button" className="button button-secondary" onClick={exportData}><Download size={18} />Esporta i dati in JSON</button><p className="field-hint">L’esportazione contiene i dati presenti su questo dispositivo. Connettiti prima per includere le modifiche di altri dispositivi.</p></section>
    <section className="settings-section"><h2><MonitorSmartphone size={20} />Sempre a portata di mano</h2><p className="muted">Installa Kynlift dalla schermata Home per aprirla come un’app.</p><details><summary>Su iPhone</summary><p>Apri Kynlift in Safari, tocca Condividi e scegli “Aggiungi alla schermata Home”. Il primo accesso richiede una connessione.</p></details><details><summary>Su Android</summary><p>Apri Kynlift in Chrome. Dal menu scegli “Installa app” o “Aggiungi a schermata Home”.</p></details><p className="field-hint">Il recupero torna corretto alla riapertura. Con lo schermo bloccato l’avviso non è garantito. Kynlift non controlla la tua musica.</p></section>
    <section className="settings-section"><h2>Le tue preferenze</h2><div className="list-row"><span>Lingua</span><strong>Italiano</strong></div><div className="list-row"><span>Unità di misura</span><strong>Chilogrammi</strong></div><div className="list-row"><span>Aspetto</span><strong>Scuro</strong></div></section>
    <div className="settings-footer">
      <div className="settings-actions" role="group" aria-label="Azioni dell’account">
      {auth.isDemo && <button type="button" className="button button-secondary" disabled={busy} onClick={async () => { if (await confirm({ title: 'Ripristina demo', message: 'Le modifiche ai dati di esempio saranno rimosse.', confirmLabel: 'Ripristina', danger: true })) void run(async () => { await resetDemo(); onReset(); }); }}><RefreshCw size={18} />Ripristina demo</button>}
      <button type="button" className="button button-secondary" disabled={busy} onClick={() => void run(auth.signOut)}><LogOut size={18} />{auth.isDemo ? 'Esci dalla demo' : 'Esci dall’account'}</button>
      </div>
      <p className="muted">Kynlift · versione 1.0.0</p>
    </div>
  </section>;
}
