import type { User } from 'firebase/auth';
import type { KinUser } from '../types';

/** Firebase may leave the primary email empty with separate provider accounts. */
export function toKinUser(user: User): KinUser {
  return {
    uid: user.uid,
    displayName: user.displayName ?? user.providerData.find((provider) => provider.displayName)?.displayName ?? null,
    email: user.email ?? user.providerData.find((provider) => provider.email)?.email ?? null,
    providers: user.providerData.map((provider) => provider.providerId),
  };
}
