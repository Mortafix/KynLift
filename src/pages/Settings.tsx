import { useEffect, useRef, useState } from 'react';
import { Camera, Download, LogOut, Mail, MonitorSmartphone, Pencil, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { prepareAvatar } from '../auth/avatar-image';
import { useData } from '../data/DataContext';
import { Avatar } from '../components/Avatar';
import { GoogleMark } from '../components/GoogleMark';
import { Modal } from '../components/Modal';
import { useConfirm } from '../components/ConfirmDialog';
import './settings.css';

export function Settings({ onReset, onDirtyChange }: { onReset: () => void; onDirtyChange: (dirty: boolean) => void }) {
  const confirm = useConfirm();
  const auth = useAuth();
  const { data, syncStatus, error: dataError, resetDemo } = useData();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [name, setName] = useState(auth.user?.displayName ?? '');
  const [photoURL, setPhotoURL] = useState(auth.user?.photoURL ?? null);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileMessage, setProfileMessage] = useState('');
  const [profileEdited, setProfileEdited] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const nameInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const photoRequest = useRef(0);
  const profileSaving = useRef(false);
  const profileDirty = name.trim() !== (auth.user?.displayName ?? '') || photoURL !== (auth.user?.photoURL ?? null);
  const disabled = busy || profileBusy;
  const hasGoogle = !auth.isDemo && auth.user?.providers.includes('google.com');
  const hasPassword = !auth.isDemo && auth.user?.providers.includes('password');

  useEffect(() => {
    // A remote profile may arrive after the page opens. Keep a local draft intact.
    if (!profileEdited) { setName(auth.user?.displayName ?? ''); setPhotoURL(auth.user?.photoURL ?? null); }
  }, [auth.user?.displayName, auth.user?.photoURL, profileEdited]);
  useEffect(() => { onDirtyChange(profileDirty || profileBusy); return () => onDirtyChange(false); }, [profileDirty, profileBusy, onDirtyChange]);
  useEffect(() => () => { photoRequest.current += 1; }, []);
  useEffect(() => { if (editingName) nameInput.current?.focus(); }, [editingName]);
  useEffect(() => {
    // Redirect failures belong to this account screen, not to every app page.
    if (auth.error) { setError(auth.error); auth.clearError(); }
  }, [auth.error, auth.clearError]);

  async function choosePhoto(file?: File) {
    if (!file) return;
    const request = ++photoRequest.current;
    setProfileBusy(true); setPhotoError(''); setProfileMessage('');
    try {
      const image = await prepareAvatar(file);
      if (request === photoRequest.current) { setPhotoURL(image); setProfileEdited(true); setProfileError(''); setPhotoOpen(false); }
    } catch (failure) {
      if (request === photoRequest.current) setPhotoError(failure instanceof Error ? failure.message : 'Non riesco a preparare la foto. Riprova.');
    } finally { if (request === photoRequest.current) setProfileBusy(false); }
  }
  async function saveProfile() {
    if (profileSaving.current || disabled) return;
    if (!name.trim()) { setEditingName(true); setProfileError('Inserisci il tuo nome.'); return; }
    profileSaving.current = true; setProfileBusy(true); setProfileError(''); setProfileMessage('');
    try {
      await auth.updateAccountProfile({ displayName: name.trim(), photoURL });
      setProfileEdited(false); setEditingName(false); setProfileMessage('Profilo aggiornato.');
    } catch (failure) { setProfileError(failure instanceof Error ? failure.message : 'Non è stato possibile salvare il profilo. Riprova.'); }
    finally { profileSaving.current = false; setProfileBusy(false); }
  }
  async function leaveProfile(action: () => Promise<void>) {
    if (profileDirty && !await confirm({ title: 'Lasciare il profilo?', message: 'Ci sono modifiche al profilo non salvate. Vuoi continuare senza salvarle?', confirmLabel: 'Continua', cancelLabel: 'Resta qui' })) return;
    await run(action);
  }
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
    {error && <p role="alert" className="error-message">{error}</p>}
    {message && <p role="status" className="success-message">{message}</p>}
    <section className="settings-section"><h2><ShieldCheck size={20} />Il tuo account</h2>
      <form className="profile-form" aria-label="Modifica profilo" aria-busy={profileBusy} onSubmit={(event) => { event.preventDefault(); void saveProfile(); }}>
        <div className="account-identity"><button type="button" className="avatar avatar-large" aria-label="Apri foto del profilo" aria-haspopup="dialog" disabled={disabled} onClick={() => { setPhotoError(''); setPhotoOpen(true); }}><Avatar user={{ displayName: name, photoURL }} /></button><div>
          <div className="profile-name"><strong>{auth.user?.displayName || 'Il tuo account'}</strong>{!editingName && <button type="button" className="icon-button" aria-label="Modifica nome" title="Modifica nome" disabled={disabled} onClick={() => { setEditingName(true); setProfileMessage(''); }}><Pencil size={18} aria-hidden="true" /></button>}</div>
          <p className="muted profile-email">{hasGoogle && <span className="profile-google" role="img" aria-label="Account Google" title="Account Google"><GoogleMark /></span>}<span>{auth.isDemo ? 'Modalità demo · dati di esempio' : auth.user?.email}</span></p>
        </div></div>
        {editingName && <label className="field">Il tuo nome<input ref={nameInput} name="displayName" autoComplete="name" required maxLength={80} disabled={disabled} value={name} onChange={(event) => { setName(event.target.value); setProfileEdited(true); setProfileMessage(''); setProfileError(''); }} /></label>}
        {profileError && <p role="alert" className="error-message">{profileError}</p>}
        {profileMessage && <p role="status" className="success-message">{profileMessage}</p>}
        {(editingName || profileDirty || profileBusy) && <div className="profile-save-actions"><button type="submit" className="button button-primary" disabled={disabled || !profileDirty}>{profileBusy ? 'Preparazione e salvataggio…' : 'Salva profilo'}</button>
          <button type="button" className="button button-ghost" disabled={disabled} onClick={() => { setName(auth.user?.displayName ?? ''); setPhotoURL(auth.user?.photoURL ?? null); setProfileEdited(false); setEditingName(false); setProfileError(''); setProfileMessage(''); }}>Annulla</button></div>}
      </form>
      {photoOpen && <Modal open onClose={() => setPhotoOpen(false)} title="Foto del profilo" className="profile-photo-dialog" busy={profileBusy}>
        <div className="profile-photo-preview" role="img" aria-label="Anteprima foto del profilo"><Avatar user={{ displayName: name, photoURL }} /></div>
        {photoError && <p role="alert" className="error-message">{photoError}</p>}
        <input ref={photoInput} type="file" accept="image/*" hidden aria-label="Scegli foto del profilo" disabled={disabled} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void choosePhoto(file); }} />
        <div className="profile-photo-actions">
          <button type="button" className="button button-secondary" disabled={disabled} onClick={() => photoInput.current?.click()}><Camera size={18} aria-hidden="true" />{profileBusy ? 'Preparazione…' : 'Cambia'}</button>
          <button type="button" className="button button-secondary" disabled={disabled || !photoURL} onClick={() => { setPhotoURL(null); setProfileEdited(true); setProfileMessage(''); setProfileError(''); setPhotoOpen(false); }}><Trash2 size={18} aria-hidden="true" />Rimuovi</button>
        </div>
      </Modal>}
      {!auth.isDemo && <>
        {hasPassword && !hasGoogle && <button type="button" className="button button-secondary" onClick={() => void leaveProfile(auth.linkGoogle)} disabled={disabled}><GoogleMark />Collega Google</button>}
        {!auth.user?.providers.includes('password') && <form className="link-password" onSubmit={(event) => { event.preventDefault(); void run(async () => { await auth.linkPassword(password); setPassword(''); }, 'Password aggiunta. Puoi accedere con entrambi i metodi.'); }}><label className="field">Aggiungi una password<input type="password" autoComplete="new-password" required minLength={6} disabled={disabled} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Almeno 6 caratteri" /></label><button type="submit" className="button button-secondary" disabled={disabled}><Mail size={18} />Collega email e password</button></form>}
      </>}
    </section>
    <section className="settings-section"><h2><Download size={20} />I tuoi dati</h2>{dataError && <p role="alert" className="error-message">{dataError}</p>}<p className="muted">{auth.isDemo ? 'Questi allenamenti sono esempi e rimangono in questa demo.' : syncStatus === 'synced' ? 'Le modifiche sono sincronizzate con il tuo account.' : 'Le modifiche salvate restano sul dispositivo. Quando la connessione è disponibile, Kynlift le sincronizza con il tuo account.'}</p><button type="button" className="button button-secondary" onClick={exportData}><Download size={18} />Esporta i dati in JSON</button><p className="field-hint">L’esportazione contiene i dati presenti su questo dispositivo. Connettiti prima per includere le modifiche di altri dispositivi.</p></section>
    <section className="settings-section"><h2><MonitorSmartphone size={20} />Sempre a portata di mano</h2><p className="muted">Installa Kynlift dalla schermata Home per aprirla come un’app.</p><details><summary>Su iPhone</summary><p>Apri Kynlift in Safari, tocca Condividi e scegli “Aggiungi alla schermata Home”. Il primo accesso richiede una connessione.</p></details><details><summary>Su Android</summary><p>Apri Kynlift in Chrome. Dal menu scegli “Installa app” o “Aggiungi a schermata Home”.</p></details><p className="field-hint">Il recupero torna corretto alla riapertura. Con lo schermo bloccato l’avviso non è garantito. Kynlift non controlla la tua musica.</p></section>
    <section className="settings-section"><h2>Le tue preferenze</h2><div className="list-row"><span>Lingua</span><strong>Italiano</strong></div><div className="list-row"><span>Unità di misura</span><strong>Chilogrammi</strong></div><div className="list-row"><span>Aspetto</span><strong>Scuro</strong></div></section>
    <div className="settings-footer">
      <div className="settings-actions" role="group" aria-label="Azioni dell’account">
      {auth.isDemo && <button type="button" className="button button-secondary" disabled={disabled} onClick={async () => { if (await confirm({ title: 'Ripristina demo', message: `Le modifiche ai dati di esempio saranno rimosse.${profileDirty ? ' Le modifiche al profilo non salvate saranno scartate.' : ''}`, confirmLabel: 'Ripristina', danger: true })) void run(async () => { await resetDemo(); onDirtyChange(false); onReset(); }); }}><RefreshCw size={18} />Ripristina demo</button>}
      <button type="button" className="button button-secondary" disabled={disabled} onClick={() => void leaveProfile(auth.signOut)}><LogOut size={18} />{auth.isDemo ? 'Esci dalla demo' : 'Esci dall’account'}</button>
      </div>
      <p className="muted">Kynlift · versione 1.0.0</p>
    </div>
  </section>;
}
