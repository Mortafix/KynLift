import assert from 'node:assert/strict';
import site from '../site.config.json' with { type: 'json' };

// Explicit read-only post-deploy probe. No login, writes or deployment.
const origin = new URL(process.argv[2] || site.url).origin;
assert(origin.startsWith('https://'), 'Il controllo pubblico richiede HTTPS.');
const checks = [
  ['/', 200, 'text/html'], ['/robots.txt', 200, 'text/plain'],
  ['/sitemap.xml', 200, 'xml'], ['/manifest.webmanifest', 200, 'json'],
  [site.socialImage, 200, 'image/png'], ['/sw.js', 200, 'javascript'],
  ['/schede', 200, 'text/html'], ['/pagina-inesistente-kynlift-check', 404, 'text/html'],
  ['/assets/kynlift-missing-check.js', 404, 'text/html'],
];
let failed = false;
for (const [path, status, type] of checks) {
  try {
    const response = await fetch(`${origin}${path}`, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
    assert.equal(response.status, status, `${path}: status inatteso`);
    assert(response.headers.get('content-type')?.includes(type), `${path}: Content-Type inatteso`);
    assert(response.headers.has('strict-transport-security'), `${path}: HSTS mancante`);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    if (path === '/schede' || status === 404) assert(response.headers.get('x-robots-tag')?.includes('noindex'), `${path}: X-Robots-Tag mancante`);
    if (path === '/' || path === '/sw.js') assert(/no-cache|no-store/.test(response.headers.get('cache-control') || ''), `${path}: cache non rivalidabile`);
    if (status === 404) assert(!response.headers.get('cache-control')?.includes('immutable'));
    if (path === '/') {
      const body = await response.text();
      assert(body.includes(`rel="canonical" href="${site.url}/"`));
      assert(!/noindex/.test(response.headers.get('x-robots-tag') || ''));
      assert(/name="robots" content="index,/.test(body));
    }
    console.log(`OK ${path}`);
  } catch (error) { failed = true; console.error(`FAIL ${path}: ${error.message}`); }
}
// Auth helper must be proxied, never a SPA shell or an HTTP redirect.
try {
  const response = await fetch(`${origin}/__/auth/iframe`, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
  const body = await response.text();
  assert.equal(response.status, 200);
  assert(/no-store/.test(response.headers.get('cache-control') || ''));
  assert(!body.includes('id="root"') && /iframe|firebase/i.test(body));
  console.log('OK /__/auth/iframe (la prova Google interattiva resta necessaria)');
} catch (error) { failed = true; console.error(`FAIL helper Firebase: ${error.message}`); }
process.exitCode = failed ? 1 : 0;
