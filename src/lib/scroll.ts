/** Desktop scrolls the document; the mobile app scrolls its content panel. */
export function scrollPageToTop() {
  window.scrollTo({ top: 0 });
  document.getElementById('main-content')?.scrollTo({ top: 0 });
}
