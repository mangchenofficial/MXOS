(function() {
    const MXOS = window.MXOS = window.MXOS || {};
    const PREF_KEY = 'mxos_theme_mode_pref';
    const ACTUAL_KEY = 'mxos_theme_mode';

    function readPref() {
        try {
            const v = localStorage.getItem(PREF_KEY);
            if (v === 'light' || v === 'dark' || v === 'auto') return v;
        } catch (e) {}
        return 'dark';
    }

    function systemPrefersLight() {
        return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches);
    }

    function resolveTheme(pref) {
        if (pref === 'auto') {
            return systemPrefersLight() ? 'light' : 'dark';
        }
        return pref;
    }

    function applyTheme(theme, withTransition) {
        const fromTheme = document.body.getAttribute('data-theme');
        if (fromTheme === theme && withTransition !== true) {
            return;
        }
        if (withTransition && MXOS.anim && typeof MXOS.anim.themeTransition === 'function') {
            const transitionColor = theme === 'light' ? '#f5f5f7' : '#0e1513';
            MXOS.anim.themeTransition(window.innerWidth / 2, window.innerHeight / 2, transitionColor);
            setTimeout(() => {
                document.body.setAttribute('data-theme', theme);
            }, 280);
        } else {
            document.body.setAttribute('data-theme', theme);
        }
        try { localStorage.setItem(ACTUAL_KEY, theme); } catch (e) {}
        window.dispatchEvent(new CustomEvent('theme-change', { detail: { theme } }));
    }

    function init() {
        const pref = readPref();
        const theme = resolveTheme(pref);
        document.body.setAttribute('data-theme', theme);
        try { localStorage.setItem(ACTUAL_KEY, theme); } catch (e) {}

        if (window.matchMedia) {
            const mql = window.matchMedia('(prefers-color-scheme: light)');
            const handler = (e) => {
                const currentPref = readPref();
                if (currentPref !== 'auto') return;
                const next = e.matches ? 'light' : 'dark';
                applyTheme(next, false);
            };
            if (typeof mql.addEventListener === 'function') {
                mql.addEventListener('change', handler);
            } else if (typeof mql.addListener === 'function') {
                mql.addListener(handler);
            }
        }

        window.addEventListener('theme-change', (e) => {
            const t = e.detail && e.detail.theme;
            if (t === 'light' || t === 'dark') {
                document.body.setAttribute('data-theme', t);
                if (MXOS.WallpaperColor && typeof MXOS.WallpaperColor.setTheme === 'function') {
                    MXOS.WallpaperColor.setTheme(t);
                }
            }
        });
    }

    MXOS.theme = MXOS.theme || {};
    MXOS.theme.applyTheme = applyTheme;
    MXOS.theme.getPref = readPref;
    MXOS.theme.setPref = function(pref) {
        if (pref !== 'light' && pref !== 'dark' && pref !== 'auto') return;
        try { localStorage.setItem(PREF_KEY, pref); } catch (e) {}
        const theme = resolveTheme(pref);
        applyTheme(theme, true);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
