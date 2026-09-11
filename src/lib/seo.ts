import site from '../../site.config.json';

export function updatePageMetadata(path: string, personal = false) {
  const publicHome = path === '/' && !personal;
  const indexable = publicHome && import.meta.env.VITE_SITE_INDEXING === 'true' && location.origin === site.url;
  const labels: Record<string, string> = {
    '/allenamento': 'Allenamento', '/allenamento/sessione': 'Allenamento in corso',
    '/schede': 'Schede', '/catalogo': 'Catalogo esercizi',
    '/progressi': 'Progressi', '/impostazioni': 'Impostazioni',
  };
  const label = labels[path] ?? (path.startsWith('/storico/') ? 'Storico allenamento' : path.startsWith('/allenamento/scheda/') ? 'Riepilogo scheda' : 'Pagina non trovata');
  document.title = publicHome ? site.title : `${label} — ${site.name}`;
  document.querySelector('meta[name="robots"]')?.setAttribute('content', indexable ? 'index, follow, max-image-preview:large' : 'noindex, nofollow');
  if (!publicHome) {
    document.querySelector('link[rel="canonical"]')?.remove();
    document.getElementById('site-schema')?.remove();
    document.querySelectorAll('meta[property^="og:"], meta[name^="twitter:"]').forEach((element) => element.remove());
  }
}
