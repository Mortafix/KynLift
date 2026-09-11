import { afterEach, describe, expect, it, vi } from 'vitest';
import type { User } from 'firebase/auth';
import { cacheAccountProfile, cachedAccountProfile, MAX_PROFILE_PHOTO_LENGTH, readAccountProfile, toKinUser, validateAccountProfile } from '../src/auth/profile';

const googlePhoto = 'https://lh3.googleusercontent.com/a/profile-photo';
const customPhoto = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
const googleUser = {
  uid: 'alice', displayName: null, photoURL: null, email: null,
  providerData: [{ providerId: 'google.com', displayName: 'Google name', photoURL: googlePhoto, email: 'alice@example.com' }],
} as User;

describe('Profilo account', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('recupera nome, email e foto dai dati Google quando mancano sullo user', () => {
    expect(toKinUser(googleUser)).toEqual({
      uid: 'alice', displayName: 'Google name', email: 'alice@example.com', photoURL: googlePhoto, providers: ['google.com'],
    });
    expect(toKinUser({ ...googleUser, photoURL: 'javascript:alert(1)' }).photoURL).toBeNull();
  });

  it('mantiene nome e foto personalizzati dopo aggiornamenti del provider, compresa la rimozione foto', () => {
    const custom = { displayName: 'Nome scelto', photoURL: customPhoto };
    expect(toKinUser(googleUser, custom)).toMatchObject(custom);
    expect(toKinUser({ ...googleUser, displayName: 'Nome Google aggiornato', photoURL: googlePhoto }, custom)).toMatchObject(custom);
    expect(toKinUser(googleUser, { ...custom, photoURL: null }).photoURL).toBeNull();
    expect(toKinUser({ ...googleUser, providerData: [] }).photoURL).toBeNull();
  });

  it('normalizza il nome e rifiuta profili vuoti, troppo lunghi o immagini non consentite', () => {
    expect(validateAccountProfile({ displayName: '  Moris  ', photoURL: null })).toEqual({ displayName: 'Moris', photoURL: null });
    for (const displayName of ['', '   ', 'x'.repeat(81)]) {
      expect(() => validateAccountProfile({ displayName, photoURL: null })).toThrow();
    }
    expect(validateAccountProfile({ displayName: 'x'.repeat(80), photoURL: googlePhoto })).toBeTruthy();
    for (const photoURL of ['javascript:alert(1)', 'data:image/svg+xml,<svg/>', 'http://example.com/avatar.jpg', customPhoto + 'x'.repeat(MAX_PROFILE_PHOTO_LENGTH)]) {
      expect(readAccountProfile({ displayName: 'Moris', photoURL })).toBeNull();
    }
    expect(readAccountProfile({ displayName: 123, photoURL: null })).toBeNull();
  });

  it('separa cache fra account e demo, e conserva la demo solo nella sessione', () => {
    const local = new Map<string, string>();
    const session = new Map<string, string>();
    const storage = (map: Map<string, string>) => ({ getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => map.set(key, value), removeItem: (key: string) => map.delete(key) });
    vi.stubGlobal('localStorage', storage(local));
    vi.stubGlobal('sessionStorage', storage(session));
    cacheAccountProfile('user:alice', { displayName: 'Alice', photoURL: customPhoto });
    cacheAccountProfile('user:bob', { displayName: 'Bob', photoURL: null });
    cacheAccountProfile('demo', { displayName: 'Demo', photoURL: null });
    expect(cachedAccountProfile('user:alice')?.displayName).toBe('Alice');
    expect(cachedAccountProfile('user:bob')?.displayName).toBe('Bob');
    expect(cachedAccountProfile('user:charlie')).toBeNull();
    expect(local.has('kinlift:profile:demo')).toBe(false);
    expect(session.has('kinlift:profile:demo')).toBe(true);
    cacheAccountProfile('user:alice', null);
    expect(cachedAccountProfile('user:alice')).toBeNull();
    expect(cachedAccountProfile('user:bob')?.displayName).toBe('Bob');
    local.set('kinlift:profile:user:bob', '{broken');
    expect(cachedAccountProfile('user:bob')).toBeNull();
  });
});
