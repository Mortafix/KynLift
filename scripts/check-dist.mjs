import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import site from '../site.config.json' with { type: 'json' };

const dir = resolve(process.env.DIST_DIR || 'dist');
const read = (file) => readFile(join(dir, file), 'utf8');
const html = await read('index.html');
const app = await read('app.html');
const robots = await read('robots.txt');
const sitemap = await read('sitemap.xml');
const worker = await read('sw.js');
const indexable = /name="robots" content="index,/.test(html);
assert.equal((html.match(/<h1[ >]/g) || []).length, 1, 'La home deve contenere un H1 prerenderizzato.');
assert(html.includes('Il tuo allenamento,'), 'Contenuto pubblico assente nell’HTML.');
assert.equal((html.match(/rel="canonical"/g) || []).length, 1, 'Canonical duplicato o assente.');
assert(html.includes(`rel="canonical" href="${site.url}/"`), 'Dominio canonico errato.');
assert(html.includes(`content="${site.url}${site.socialImage}"`), 'Anteprima social assente.');
const schema = JSON.parse(html.match(/<script id="site-schema"[^>]*>(.*?)<\/script>/s)?.[1] ?? '{}');
assert.equal(schema['@type'], 'WebSite');
assert.equal(schema.url, `${site.url}/`);
assert(/name="robots" content="noindex, nofollow"/.test(app), 'Shell personale indicizzabile.');
assert(!/rel="canonical"|application\/ld\+json|property="og:/.test(app), 'Metadati pubblici copiati nell’area personale.');
assert(/name="robots" content="noindex/.test(await read('404.html')), '404 indicizzabile.');
assert(indexable ? robots.includes(`Sitemap: ${site.url}/sitemap.xml`) : robots.includes('Disallow: /\n'), 'robots.txt incoerente con indexing.');
assert.equal((sitemap.match(/<loc>/g) || []).length, indexable ? 1 : 0, 'La sitemap deve contenere solo la home pubblica.');
assert(!/allenamento|schede|storico|catalogo|progressi|impostazioni/.test(sitemap));
assert(worker.includes('app.html'), 'Fallback offline personale mancante.');
for (const file of ['index.html', 'app.html']) {
  const hash = createHash('md5').update(await read(file)).digest('hex');
  assert(worker.includes(hash), `Precache non allineato al contenuto finale di ${file}.`);
}
const png = await readFile(join(dir, site.socialImage));
assert.equal(png.subarray(1, 4).toString(), 'PNG');
assert.equal(png.readUInt32BE(16), 1200);
assert.equal(png.readUInt32BE(20), 630);
const manifest = JSON.parse(await read('manifest.webmanifest'));
assert.equal(manifest.name, site.name);
assert.equal(manifest.start_url, '/');
assert(manifest.icons.some((icon) => icon.purpose === 'maskable'));
for (const icon of manifest.icons) await readFile(join(dir, icon.src));
for (const match of html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)"/g)) await readFile(join(dir, match[1]));
async function inspectFiles(folder) {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    assert(!/^\.env|\.map$|service.?account|debug\.log$/i.test(entry.name), `File non distribuibile: ${entry.name}`);
    if (entry.isDirectory()) await inspectFiles(join(folder, entry.name));
  }
}
await inspectFiles(dir);
if (process.argv.includes('--production')) assert(indexable, 'La build produzione non è indicizzabile.');
console.log(`Build verificata: HTML pubblico, SEO, sitemap, shell privata, 404, social 1200×630, asset e hash PWA. Indicizzazione: ${indexable ? 'attiva' : 'disattivata'}.`);
