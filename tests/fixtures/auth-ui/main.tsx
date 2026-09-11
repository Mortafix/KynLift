import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/barlow/latin-400.css';
import '@fontsource/barlow/latin-500.css';
import '@fontsource/barlow/latin-600.css';
import '@fontsource/barlow/latin-700.css';
import '@fontsource/barlow-condensed/latin-500.css';
import '@fontsource/barlow-condensed/latin-600.css';
import { AuthPage } from '../../../src/pages/Auth';
import { AuthContext, type AuthContextValue } from '../../../src/auth/context';
import '../../../src/styles.css';

async function unsupported() { throw new Error('Questa fixture verifica il form, non esegue accessi reali.'); }

function AuthFormFixture() {
  const [demoRequested, setDemoRequested] = useState(false);
  const auth: AuthContextValue = {
    user: null, ready: true, configured: true, isDemo: false, error: null,
    signIn: unsupported, signUp: unsupported, signInGoogle: unsupported,
    linkGoogle: unsupported, linkPassword: unsupported, resetPassword: unsupported,
    signOut: unsupported, enterDemo: async () => { setDemoRequested(true); },
  };
  // A visible acknowledgement checks the callback without faking the app router.
  // Actual demo entry/navigation is covered against the built app in workout.spec.ts.
  return demoRequested ? <main><p role="status">Ingresso demo richiesto</p></main>
    : <AuthContext.Provider value={auth}><AuthPage /></AuthContext.Provider>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><AuthFormFixture /></StrictMode>);
