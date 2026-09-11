import type { Plugin } from 'vite';
import site from '../site.config.json';

const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

export function seoPlugin(indexable: boolean): Plugin {
  return {
    name: 'kynlift-seo',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const schema = {
          '@context': 'https://schema.org', '@type': 'WebSite',
          '@id': `${site.url}/#website`, name: site.name, url: `${site.url}/`,
          description: site.description, inLanguage: 'it-IT',
        };
        return html.replace('<!--seo-head-->', [
          `<title>${escape(site.title)}</title>`,
          `<meta name="description" content="${escape(site.description)}" />`,
          `<meta name="robots" content="${indexable ? 'index, follow, max-image-preview:large' : 'noindex, nofollow'}" />`,
          `<link rel="canonical" href="${site.url}/" />`,
          '<meta property="og:type" content="website" />',
          '<meta property="og:locale" content="it_IT" />',
          `<meta property="og:site_name" content="${site.name}" />`,
          `<meta property="og:title" content="${escape(site.title)}" />`,
          `<meta property="og:description" content="${escape(site.description)}" />`,
          `<meta property="og:url" content="${site.url}/" />`,
          `<meta property="og:image" content="${site.url}${site.socialImage}" />`,
          '<meta property="og:image:type" content="image/png" />',
          '<meta property="og:image:width" content="1200" />',
          '<meta property="og:image:height" content="630" />',
          `<meta property="og:image:alt" content="${escape(site.socialImageAlt)}" />`,
          '<meta name="twitter:card" content="summary_large_image" />',
          `<meta name="twitter:title" content="${escape(site.title)}" />`,
          `<meta name="twitter:description" content="${escape(site.description)}" />`,
          `<meta name="twitter:image" content="${site.url}${site.socialImage}" />`,
          `<meta name="twitter:image:alt" content="${escape(site.socialImageAlt)}" />`,
          `<script id="site-schema" type="application/ld+json">${JSON.stringify(schema).replaceAll('<', '\\u003c')}</script>`,
        ].join('\n    '));
      },
    },
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        const index = bundle['index.html'];
        if (!index || index.type !== 'asset') throw new Error('SEO: index.html mancante.');
        const html = String(index.source);
        // The server and offline navigation use a separate shell: personal URLs
        // never inherit the public canonical, schema or index directive.
        const app = html
          .replace(/<title>.*?<\/title>/, '<title>Kynlift — Area personale</title>')
          .replace(/<meta name="robots"[^>]+>/, '<meta name="robots" content="noindex, nofollow" />')
          .replace(/\s*<link rel="canonical"[^>]+>/g, '')
          .replace(/\s*<meta (?:property="og:[^"]+"|name="twitter:[^"]+")[^>]+>/g, '')
          .replace(/\s*<script id="site-schema"[\s\S]*?<\/script>/, '');
        this.emitFile({ type: 'asset', fileName: 'app.html', source: app });
        this.emitFile({ type: 'asset', fileName: 'robots.txt', source: indexable
          ? `User-agent: *\nAllow: /\nDisallow: /__/\n\nSitemap: ${site.url}/sitemap.xml\n`
          : 'User-agent: *\nDisallow: /\n' });
        this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${indexable ? `<url><loc>${site.url}/</loc></url>` : ''}</urlset>\n` });
      },
    },
  };
}
