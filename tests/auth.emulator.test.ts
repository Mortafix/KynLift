import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, EmailAuthProvider, GoogleAuthProvider, initializeAuth, inMemoryPersistence, linkWithCredential, signInWithCredential, signInWithEmailAndPassword, signOut, type Auth } from 'firebase/auth';
import { toKinUser } from '../src/auth/profile';

const host = process.env.FIREBASE_AUTH_EMULATOR_HOST;
describe.skipIf(!host)('Auth: collegamento esplicito dei provider', () => {
  let app: FirebaseApp;
  let auth: Auth;
  const projectId = 'demo-kinlift';
  const email = 'kinlift-emulator@gmail.com';
  const password = 'local-test-password';
  function google() {
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const token = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ sub: 'google-user-1', email, email_verified: true, name: 'Test Google', iss: 'https://accounts.google.com', aud: 'emulator-only', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 })}.`;
    return GoogleAuthProvider.credential(token);
  }
  async function policy(allowDuplicateEmails: boolean) {
    if (!host || !/^(127\.0\.0\.1|localhost):\d+$/.test(host)) throw new Error('I test Auth possono chiamare soltanto l’emulatore localhost.');
    const response = await fetch(`http://${host}/emulator/v1/projects/${projectId}/config`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ signIn: { allowDuplicateEmails } }),
    });
    expect(response.ok).toBe(true);
  }
  beforeEach(async () => {
    await policy(true);
    const response = await fetch(`http://${host}/emulator/v1/projects/${projectId}/accounts`, { method: 'DELETE' });
    expect(response.ok).toBe(true);
    app = initializeApp({ projectId, apiKey: 'emulator-only', authDomain: 'localhost' }, `auth-${crypto.randomUUID()}`);
    auth = initializeAuth(app, { persistence: inMemoryPersistence });
    connectAuthEmulator(auth, `http://${host}`, { disableWarnings: true });
  });
  afterEach(async () => { await deleteApp(app); });

  it('documenta il rischio della policy predefinita prima di disabilitarla', async () => {
    await policy(false);
    const original = await createUserWithEmailAndPassword(auth, email, password);
    await signOut(auth);
    const result = await signInWithCredential(auth, google());
    expect(result.user.uid).toBe(original.user.uid);
    expect(result.user.providerData.map((provider) => provider.providerId)).not.toContain('password');
  });
  it('con provider separati Google non sostituisce password e UID preesistenti', async () => {
    const original = await createUserWithEmailAndPassword(auth, email, password);
    await signOut(auth);
    const result = await signInWithCredential(auth, google());
    expect(result.user.uid).not.toBe(original.user.uid);
    expect(toKinUser(result.user).email).toBe(email);
    await signOut(auth);
    expect((await signInWithEmailAndPassword(auth, email, password)).user.uid).toBe(original.user.uid);
  });
  it('il collegamento esplicito conserva UID e consente entrambi gli accessi', async () => {
    const original = await createUserWithEmailAndPassword(auth, email, password);
    const linked = await linkWithCredential(original.user, google());
    expect(linked.user.uid).toBe(original.user.uid);
    expect(toKinUser(linked.user).providers.sort()).toEqual(['google.com', 'password']);
    await signOut(auth);
    expect((await signInWithCredential(auth, google())).user.uid).toBe(original.user.uid);
    await signOut(auth);
    expect((await signInWithEmailAndPassword(auth, email, password)).user.uid).toBe(original.user.uid);
  });
  it('se i due account esistono già segnala il conflitto senza unire i dati', async () => {
    const original = await createUserWithEmailAndPassword(auth, email, password);
    await signOut(auth);
    const separate = await signInWithCredential(auth, google());
    await signOut(auth);
    const signedIn = await signInWithEmailAndPassword(auth, email, password);
    await expect(linkWithCredential(signedIn.user, google())).rejects.toMatchObject({ code: 'auth/credential-already-in-use' });
    expect(auth.currentUser?.uid).toBe(original.user.uid);
    expect(auth.currentUser?.uid).not.toBe(separate.user.uid);
  });
  it('aggiunge una password anche quando l’email Google è nei dati provider', async () => {
    const result = await signInWithCredential(auth, google());
    const profile = toKinUser(result.user);
    expect(profile.email).toBe(email);
    await linkWithCredential(result.user, EmailAuthProvider.credential(profile.email!, password));
    await signOut(auth);
    expect((await signInWithEmailAndPassword(auth, email, password)).user.uid).toBe(result.user.uid);
  });
});
