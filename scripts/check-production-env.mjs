import { loadEnv } from 'vite';
import site from '../site.config.json' with { type: 'json' };

const env = loadEnv('production', process.cwd(), 'VITE_');
const errors = [];
for (const suffix of ['API_KEY', 'AUTH_DOMAIN', 'PROJECT_ID', 'APP_ID']) {
  const key = `VITE_FIREBASE_${suffix}`;
  if (!env[key]?.trim() || /^(?:VALORE|IL_TUO|YOUR_|example|demo-)/i.test(env[key])) errors.push(`${key}: manca un valore di produzione.`);
}
const url = new URL(site.url);
if (url.protocol !== 'https:' || site.url !== url.origin) errors.push('site.config.json: usa un’origine HTTPS senza slash finale, percorso, query o credenziali.');
if (env.VITE_FIREBASE_AUTH_DOMAIN !== url.host) errors.push('VITE_FIREBASE_AUTH_DOMAIN deve coincidere con il dominio in site.config.json.');
if (env.VITE_FIREBASE_EXPLICIT_LINKING !== 'true') errors.push('Conferma la policy Firebase degli account distinti per provider con VITE_FIREBASE_EXPLICIT_LINKING=true.');
if (env.VITE_SITE_INDEXING !== 'true') errors.push('VITE_SITE_INDEXING=true è richiesto per questa release pubblica. Mantieni false nelle anteprime.');
const allowed = new Set(['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_APP_ID', 'VITE_FIREBASE_EXPLICIT_LINKING', 'VITE_SITE_INDEXING']);
for (const key of Object.keys(env)) {
  if (!allowed.has(key)) errors.push(`${key}: variabile pubblica non prevista; controlla che non contenga segreti.`);
  if (/-----BEGIN .*PRIVATE KEY-----|"private_key"\s*:/.test(env[key])) errors.push(`${key}: contiene una credenziale privata, rimuovila prima della build.`);
}
if (errors.length) {
  console.error(`Preflight produzione fallito:\n${errors.map((error) => `- ${error}`).join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`Configurazione client pronta per ${site.url}. Questo controllo non verifica le impostazioni remote di Firebase/OAuth.`);
}
