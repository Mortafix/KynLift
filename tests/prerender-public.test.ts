import { describe, expect, it, vi } from 'vitest';
import { publicPrerender, renderPublicPage } from '../build/prerender-public';

// A future UI import must not silently pull the browser auth SDK into the build.
vi.mock('../src/lib/firebase', () => {
  throw new Error('Il prerender pubblico non deve inizializzare Firebase.');
});

describe('HTML pubblico prima dell’avvio di JavaScript', () => {
  it.each([true, false])('rende la pagina reale senza browser o Firebase (configured=%s)', (configured) => {
    const html = renderPublicPage({ configured });
    expect(html).toContain('<h1>Il tuo allenamento,<br/><span>serie per serie.</span></h1>');
    expect(html).toContain('Esplora la demo');
    expect(html.includes('type="email"')).toBe(configured);
    expect(html.includes('Questa installazione non è ancora pronta per gli account.')).toBe(!configured);
    const controls = html.match(/<(?:input|button)\b[^>]*>/g) ?? [];
    expect(controls.length).toBeGreaterThan(0);
    for (const control of controls) expect(control).toContain('disabled=""');
  });

  it('inserisce il contenuto nella root durante la trasformazione HTML', async () => {
    const plugin = publicPrerender({ configured: true });
    const hook = plugin.transformIndexHtml;
    if (!hook || typeof hook !== 'object' || !('handler' in hook)) throw new Error('Hook HTML mancante.');
    const html = await hook.handler('<html><head><title>Kynlift</title></head><body><div id="root"></div></body></html>', { path: '/index.html', filename: 'index.html' });
    expect(html).toContain('<title>Kynlift</title>');
    expect(html).toContain('<div id="root"><div class="auth-screen">');
    expect(hook.order).toBe('post');
  });

  it('interrompe la build se cambia il punto di montaggio', () => {
    const hook = publicPrerender({ configured: false }).transformIndexHtml;
    if (!hook || typeof hook !== 'object' || !('handler' in hook)) throw new Error('Hook HTML mancante.');
    expect(() => hook.handler('<div id="other"></div>', { path: '/index.html', filename: 'index.html' })).toThrow('prerender pubblico');
  });
});
