import { getApp, getApps, initializeApp } from 'firebase/app';
import { browserLocalPersistence, getAuth, setPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfigured = Object.values(config).every((value) => typeof value === 'string' && value.trim().length > 0);
const app = firebaseConfigured ? (getApps().length ? getApp() : initializeApp(config)) : null;
export const firebaseAuth = app ? getAuth(app) : null;
// Firestore uses memory cache. IndexedDB persistence and the durable outbox are
// explicitly partitioned by account in data/persistence.ts.
export const firestore = app ? getFirestore(app) : null;
export const authPersistenceReady = firebaseAuth ? setPersistence(firebaseAuth, browserLocalPersistence) : Promise.resolve();

export function assertRedirectConfiguration() {
  if (import.meta.env.VITE_FIREBASE_EXPLICIT_LINKING !== 'true') {
    throw new Error('Per abilitare Google configura Firebase con account distinti per provider e imposta VITE_FIREBASE_EXPLICIT_LINKING=true. Consulta la guida di deploy.');
  }
  if (config.authDomain !== window.location.host) {
    throw new Error('Per Google configura VITE_FIREBASE_AUTH_DOMAIN con il dominio di Kynlift e il proxy /__/auth/ sul server.');
  }
}
