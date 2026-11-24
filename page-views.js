(() => {
  'use strict';

  const counter = document.getElementById('site-page-views');
  const value = counter?.querySelector('strong');
  const config = window.MH_ANALYTICS;
  if (!value || !config?.enabled || !config.endpoint || !config.publishableKey) return;

  async function displayTotal() {
    try {
      // For a direct visit to the footer, give the existing tracker time to finish.
      if (config.currentPageView) {
        let timeout;
        try {
          await Promise.race([config.currentPageView, new Promise(resolve => {
            timeout = setTimeout(resolve, 2000);
          })]);
        } finally {
          clearTimeout(timeout);
        }
      }
      const url = config.endpoint + '/api/page-views';
      const response = await fetch(url, {
        method: 'GET',
        headers: { apikey: config.publishableKey },
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        cache: 'no-store',
      });
      if (!response.ok) return;
      const total = await response.json();
      if (typeof total !== 'string' || !/^\d+$/.test(total)) return;
      value.textContent = new Intl.NumberFormat(document.documentElement.lang).format(BigInt(total));
      const snapshotDate = counter.querySelector('small');
      if (snapshotDate) snapshotDate.hidden = true;
    } catch {
      // The dated publication snapshot remains visible if the request fails.
    }
  }

  // Read only when someone approaches the footer, independently of tracking.
  const footer = counter.closest('footer');
  if (footer && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      void displayTotal();
    }, { rootMargin: '200px' });
    observer.observe(footer);
  } else {
    void displayTotal();
  }
})();
