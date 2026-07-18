(function() {
    const MXOS = window.MXOS = window.MXOS || {};
    MXOS.anim = MXOS.anim || {};

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const bodyReduce = () => document.body.classList.contains('reduce-motion');
    const shouldSkip = () => prefersReduced || bodyReduce();

    function ripple(element, x, y) {
        if (!element) return;
        if (shouldSkip()) return;
        const rect = element.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        if (size <= 0) return;
        const rippleEl = document.createElement('span');
        rippleEl.className = 'ripple';
        rippleEl.style.width = size + 'px';
        rippleEl.style.height = size + 'px';
        rippleEl.style.left = ((x - rect.left) - size / 2) + 'px';
        rippleEl.style.top = ((y - rect.top) - size / 2) + 'px';
        element.appendChild(rippleEl);
        let done = false;
        const finish = () => {
            if (done) return;
            done = true;
            if (rippleEl.parentNode) rippleEl.remove();
        };
        rippleEl.addEventListener('animationend', finish, { once: true });
        rippleEl.addEventListener('animationcancel', finish, { once: true });
        setTimeout(finish, 450);
    }
    MXOS.anim.ripple = ripple;

    function setupGlobalRipple() {
        document.addEventListener('pointerdown', (e) => {
            if (e.button !== undefined && e.button !== 0) return;
            const target = e.target.closest('.btn, button');
            if (!target) return;
            if (target.disabled) return;
            ripple(target, e.clientX, e.clientY);
        }, { passive: true });
    }

    function setupContextMenuAnim() {
        const menu = document.getElementById('contextMenu');
        if (!menu) return;
        const sync = () => {
            const visible = menu.style.display === 'block';
            if (visible && !menu.classList.contains('show')) {
                menu.classList.add('show');
            } else if (!visible && menu.classList.contains('show')) {
                menu.classList.remove('show');
            }
        };
        const observer = new MutationObserver(sync);
        observer.observe(menu, { attributes: true, attributeFilter: ['style'] });
        sync();
    }

    function setupFlipClock() {
        const el = document.getElementById('lockTime');
        if (!el) return;
        let lastText = el.textContent;
        const observer = new MutationObserver(() => {
            if (el.textContent === lastText) return;
            lastText = el.textContent;
            if (shouldSkip()) return;
            el.classList.remove('flip');
            void el.offsetWidth;
            el.classList.add('flip');
        });
        observer.observe(el, { childList: true, characterData: true, subtree: true });
    }

    function setupStartMenuStagger() {
        const menu = document.getElementById('startMenu');
        if (!menu) return;
        const observer = new MutationObserver(() => {
            if (!menu.classList.contains('show')) return;
            menu.querySelectorAll('.start-app').forEach((app, idx) => {
                app.style.animationDelay = (idx * 30) + 'ms';
            });
        });
        observer.observe(menu, { attributes: true, attributeFilter: ['class'] });
    }

    function themeTransition(x, y, color) {
        if (shouldSkip()) return;
        const body = document.body;
        body.style.setProperty('--theme-transition-x', (x ?? window.innerWidth / 2) + 'px');
        body.style.setProperty('--theme-transition-y', (y ?? window.innerHeight / 2) + 'px');
        if (color) body.style.setProperty('--theme-transition-color', color);
        body.setAttribute('data-theme-transition', '');
        window.setTimeout(() => {
            body.removeAttribute('data-theme-transition');
        }, 620);
    }
    MXOS.anim.themeTransition = themeTransition;

    function flipClock(element) {
        if (!element || shouldSkip()) return;
        element.classList.remove('flip');
        void element.offsetWidth;
        element.classList.add('flip');
    }
    MXOS.anim.flipClock = flipClock;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setupGlobalRipple();
            setupContextMenuAnim();
            setupFlipClock();
            setupStartMenuStagger();
        });
    } else {
        setupGlobalRipple();
        setupContextMenuAnim();
        setupFlipClock();
        setupStartMenuStagger();
    }
})();
