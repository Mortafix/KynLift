import type { User } from 'firebase/auth';
import type { KinUser } from '../types';

export interface AccountProfile { displayName: string; photoURL: string | null }
export const MAX_PROFILE_PHOTO_LENGTH = 180000;

export function validPhotoURL(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && (
    (value.length <= MAX_PROFILE_PHOTO_LENGTH && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value))
    || (value.length <= 2048 && /^https:\/\/[^\s]+$/.test(value))
  ));
}

export function validateAccountProfile(value: AccountProfile): AccountProfile {
  const displayName = value.displayName.trim();
  if (!displayName || displayName.length > 80) throw new Error('Inserisci un nome da 1 a 80 caratteri.');
  if (!validPhotoURL(value.photoURL)) throw new Error('La foto non è valida o è troppo grande. Scegli un’altra immagine.');
  return { displayName, photoURL: value.photoURL };
}

export function readAccountProfile(value: unknown): AccountProfile | null {
  if (!value || typeof value !== 'object' || !('displayName' in value) || !('photoURL' in value)
    || typeof value.displayName !== 'string' || !validPhotoURL(value.photoURL)) return null;
  try { return validateAccountProfile({ displayName: value.displayName, photoURL: value.photoURL }); }
  catch { return null; }
}

function profileStorage(scope: string) {
  return scope === 'demo' ? sessionStorage : localStorage;
}
export function cachedAccountProfile(scope: string): AccountProfile | null {
  try { return readAccountProfile(JSON.parse(profileStorage(scope).getItem(`kinlift:profile:${scope}`) ?? 'null')); }
  catch { return null; }
}
export function cacheAccountProfile(scope: string, profile: AccountProfile | null) {
  try {
    const storage = profileStorage(scope);
    const key = `kinlift:profile:${scope}`;
    if (profile) storage.setItem(key, JSON.stringify(profile));
    else storage.removeItem(key);
  } catch { /* Cloud saves still work when browser storage is unavailable/full. */ }
}

/** Firebase may leave the primary email empty with separate provider accounts. */
export function toKinUser(user: User, profile?: AccountProfile | null): KinUser {
  const providerPhoto = user.providerData.find((provider) => provider.providerId === 'google.com')?.photoURL;
  const photoURL = user.photoURL || providerPhoto || null;
  return {
    uid: user.uid,
    displayName: user.displayName ?? user.providerData.find((provider) => provider.displayName)?.displayName ?? null,
    photoURL: validPhotoURL(photoURL) ? photoURL : null,
    email: user.email ?? user.providerData.find((provider) => provider.email)?.email ?? null,
    providers: user.providerData.map((provider) => provider.providerId),
    ...profile,
  };
}
