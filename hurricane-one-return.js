/* Hurricane One return button · 2026-10-09. No login, cookies, or API requests. */
(() => {
  'use strict';
  const home = 'https://hurricane-one.jeffersonnoahh.chatgpt.site/';
  function mount() {
    if (document.getElementById('hurricane-one-return')) return;
    const host = document.createElement('div');
    host.id = 'hurricane-one-return';
    // Shadow DOM keeps the host app's styles and the return control independent.
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>
      :host { all: initial; position: fixed; left: max(14px, env(safe-area-inset-left)); bottom: calc(20px + env(safe-area-inset-bottom)); z-index: 990; display: block; color-scheme: light; }
      * { box-sizing: border-box; }
      a { display: flex; align-items: center; gap: 9px; min-height: 46px; padding: 7px 16px 7px 7px; border: 1px solid #ffffff; border-radius: 999px; background: #fffdf5; color: #242536; box-shadow: 0 3px 0 #e5d9b6, 0 8px 24px #19244825; font: 700 12px/1.2 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; letter-spacing: -.15px; text-decoration: none; -webkit-tap-highlight-color: transparent; transition: transform .18s ease, box-shadow .18s ease; }
      .arrow { display: grid; place-items: center; width: 31px; height: 31px; flex: 0 0 31px; border-radius: 50%; background: linear-gradient(145deg, #ffe77a, #ffbe32); box-shadow: inset 0 2px 2px #fff7c9, 0 2px 3px #b97b1525; }
      svg { width: 18px; height: 18px; fill: none; stroke: #634200; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
      a:focus-visible { outline: 3px solid #3269f4; outline-offset: 4px; }
      @media (hover: hover) { a:hover { transform: translateY(-2px); box-shadow: 0 4px 0 #e5d9b6, 0 11px 28px #19244830; } }
      a:active { transform: translateY(2px); box-shadow: 0 1px 0 #e5d9b6, 0 3px 12px #19244820; }
      @media (max-width: 800px) { :host { bottom: calc(108px + env(safe-area-inset-bottom)); } }
      @media (prefers-reduced-motion: reduce) { a { transition: none; } }
      @media print { :host { display: none; } }
    </style><a href="${home}" target="_self" aria-label="Kembali ke Hurricane One" title="Kembali ke Hurricane One"><span class="arrow" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M19 12H5m6-6-6 6 6 6"/></svg></span><span>Hurricane One</span></a>`;
    document.body.appendChild(host);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
