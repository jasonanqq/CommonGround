(() => {
  const KEY = 'commonground_theme';
  const modes = ['light', 'dark', 'system'];
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
  let mode = 'light';

  try {
    const saved = localStorage.getItem(KEY);
    if (modes.includes(saved)) mode = saved;
  } catch {}

  function applyTheme() {
    const effectiveTheme = mode === 'system' ? (systemTheme.matches ? 'dark' : 'light') : mode;
    document.documentElement.dataset.theme = effectiveTheme;
    document.documentElement.dataset.themePreference = mode;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', effectiveTheme === 'dark' ? '#101428' : '#f7f8fc');
    document.querySelectorAll('[data-theme-select]').forEach(select => {
      select.value = mode;
    });
  }

  function setTheme(value) {
    if (!modes.includes(value)) return;
    mode = value;
    try { localStorage.setItem(KEY, value); } catch {}
    applyTheme();
  }

  applyTheme();
  if (typeof systemTheme.addEventListener === 'function') {
    systemTheme.addEventListener('change', () => { if (mode === 'system') applyTheme(); });
  } else if (typeof systemTheme.addListener === 'function') {
    systemTheme.addListener(() => { if (mode === 'system') applyTheme(); });
  }

  document.addEventListener('DOMContentLoaded', () => {
    applyTheme();
    document.querySelectorAll('[data-theme-select]').forEach(select => {
      select.addEventListener('change', event => setTheme(event.target.value));
    });
  });
})();
