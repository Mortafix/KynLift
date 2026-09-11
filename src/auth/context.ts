import { createContext, useContext } from 'react';
import type { KinUser } from '../types';

// Keep the UI contract independent of Firebase so the public page can also be
// rendered at build time without initializing authentication or a browser SDK.
export interface AuthContextValue {
  user: KinUser | null;
  ready: boolean;
  configured: boolean;
  isDemo: boolean;
  error: string | null;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string, name: string): Promise<void>;
  signInGoogle(): Promise<void>;
  linkGoogle(): Promise<void>;
  linkPassword(password: string): Promise<void>;
  resetPassword(email: string): Promise<void>;
  signOut(): Promise<void>;
  enterDemo(): Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth richiede AuthProvider.');
  return value;
}
