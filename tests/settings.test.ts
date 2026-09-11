import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue } from '../src/auth/context';
import { Settings } from '../src/pages/Settings';

vi.mock('../src/auth/AuthContext', async () => import('../src/auth/context'));
vi.mock('../src/data/DataContext', () => ({ useData: () => ({ data: {}, syncStatus: 'synced', resetDemo: vi.fn() }) }));
vi.mock('../src/components/ConfirmDialog', () => ({ useConfirm: () => vi.fn() }));

function renderSettings(providers: string[], isDemo = false) {
  const action = async () => {};
  const auth: AuthContextValue = {
    user: { uid: 'test-user', displayName: 'Giulia Bianchi', photoURL: 'https://example.com/avatar.jpg', email: 'giulia@example.com', providers },
    ready: true, configured: true, isDemo, error: null, clearError: () => {},
    signIn: action, signUp: action, signInGoogle: action, linkGoogle: action,
    linkPassword: action, resetPassword: action, updateAccountProfile: action,
    signOut: action, enterDemo: action,
  };
  return renderToStaticMarkup(createElement(AuthContext.Provider, { value: auth },
    createElement(Settings, { onReset: () => {}, onDirtyChange: () => {} })));
}

describe('stato dei metodi di accesso nel profilo', () => {
  it.each([
    { providers: [], password: false, google: false },
    { providers: ['password'], password: true, google: false },
    { providers: ['google.com'], password: false, google: true },
    { providers: ['google.com', 'password'], password: true, google: true },
  ])('mostra Google accanto alla mail e il collegamento solo per account password: $providers', ({ providers, password, google }) => {
    const html = renderSettings(providers);
    expect(html).not.toContain('account-methods');
    expect(html).not.toContain('account-method-active');
    expect(html.includes('>Collega Google</button>')).toBe(password && !google);
    expect(html.includes('aria-label="Account Google"')).toBe(google);
    if (google) expect(html).toMatch(/class="muted profile-email".*?aria-label="Account Google".*?giulia@example.com<\/span>/);
    expect(html.includes('>Collega email e password</button>')).toBe(!password);
    expect(html).not.toContain('Reimposta');
    expect(html).not.toContain('Account, dati e preferenze.');
    expect(html).toContain('<strong>Giulia Bianchi</strong>');
    expect(html).toContain('aria-label="Modifica nome"');
    expect(html).not.toContain('name="displayName"');
    expect(html).not.toContain('Salva profilo');
  });

  it('nasconde i metodi di accesso nella demo mantenendo il profilo modificabile', () => {
    const html = renderSettings([], true);
    expect(html).not.toContain('Metodi di accesso');
    expect(html).not.toContain('Collega Google');
    expect(html).not.toContain('Collega email e password');
    expect(html).toContain('<strong>Giulia Bianchi</strong>');
    expect(html).toContain('src="https://example.com/avatar.jpg"');
    expect(html).toContain('aria-label="Apri foto del profilo"');
    expect(html).not.toContain('>Cambia');
    expect(html).not.toContain('>Rimuovi');
    expect(html).toContain('Modifica nome');
    expect(html).not.toContain('Salva profilo');
  });
});
