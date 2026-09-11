import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Plugin } from 'vite';
import { AuthContext, type AuthContextValue } from '../src/auth/context';
import { AuthPage } from '../src/pages/Auth';

interface PublicPrerenderOptions {
  configured: boolean;
}

async function unavailable() {
  throw new Error('Le azioni di accesso richiedono l’app nel browser.');
}

export function renderPublicPage({ configured }: PublicPrerenderOptions): string {
  const auth: AuthContextValue = {
    user: null, ready: false, configured, isDemo: false, error: null, clearError: () => {},
    signIn: unavailable, signUp: unavailable, signInGoogle: unavailable,
    linkGoogle: unavailable, linkPassword: unavailable, resetPassword: unavailable,
    signOut: unavailable, enterDemo: unavailable, updateAccountProfile: unavailable,
  };
  return renderToStaticMarkup(createElement(AuthContext.Provider, { value: auth }, createElement(AuthPage)));
}

// The normal HTML pipeline runs before Workbox reads dist/index.html, so its
// precache revision includes this markup. React mounts the same page on startup.
export function publicPrerender(options: PublicPrerenderOptions): Plugin {
  return {
    name: 'kynlift:public-prerender',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const root = '<div id="root"></div>';
        if (html.split(root).length !== 2) {
          throw new Error('Il prerender pubblico richiede un solo elemento <div id="root"></div> vuoto.');
        }
        return html.replace(root, `<div id="root">${renderPublicPage(options)}</div>`);
      },
    },
  };
}
