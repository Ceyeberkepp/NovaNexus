/* Minimal dependency-free startup guard. Only activates when React cannot mount. */
(() => {
  let failedAsset = false;
  window.addEventListener('error', (event) => {
    const target = event.target;
    if (target && (target.tagName === 'SCRIPT' || target.tagName === 'LINK')) failedAsset = true;
  }, true);
  window.addEventListener('unhandledrejection', () => { failedAsset = true; });
  window.setTimeout(() => {
    const status = document.getElementById('nova-startup');
    if (!status) return; // React replaced the static loading state.
    const title = status.querySelector('strong');
    const detail = status.querySelector('p');
    if (title) title.textContent = 'Workspace interface could not load';
    if (detail) detail.textContent = failedAsset
      ? 'A frontend file failed to load. Hard-refresh (Ctrl+Shift+R). If the issue continues, check Cloudflare caching and your browser Console/Network tab for a failed JavaScript request.'
      : 'The page opened but Nexus did not start. Hard-refresh (Ctrl+Shift+R), then check the browser Console for script errors.';
  }, 8000);
})();
