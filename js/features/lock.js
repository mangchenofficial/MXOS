(function() {
    const MXOS = window.MXOS = window.MXOS || {};
    const TYPE_KEY = 'mxos_lock_type';
    const VALUE_KEY = 'mxos_lock_value';

    function readType() {
        try {
            const v = localStorage.getItem(TYPE_KEY);
            if (v === 'pin' || v === 'password') return v;
        } catch (e) {}
        return 'none';
    }

    function readValue() {
        try {
            return localStorage.getItem(VALUE_KEY) || '';
        } catch (e) {}
        return '';
    }

    function writeType(t) {
        try { localStorage.setItem(TYPE_KEY, t); } catch (e) {}
    }

    function writeValue(v) {
        try { localStorage.setItem(VALUE_KEY, v); } catch (e) {}
    }

    function getType() {
        return readType();
    }

    function setPin(pin) {
        if (!/^\d{4}$/.test(pin || '')) return false;
        writeType('pin');
        writeValue(pin);
        return true;
    }

    function setPassword(pwd) {
        if (!pwd || typeof pwd !== 'string') return false;
        writeType('password');
        writeValue(pwd);
        return true;
    }

    function clear() {
        writeType('none');
        try { localStorage.removeItem(VALUE_KEY); } catch (e) {}
    }

    function verify(input) {
        const t = readType();
        if (t === 'none') return true;
        if (!input) return false;
        return readValue() === String(input);
    }

    let authContainer = null;
    let authInput = null;
    let authDots = null;
    let authHint = null;

    function buildAuthUI() {
        if (authContainer) return authContainer;
        const lockScreen = document.getElementById('lock-screen');
        if (!lockScreen) return null;

        authContainer = document.createElement('div');
        authContainer.className = 'lock-auth';
        authContainer.style.cssText = 'z-index:3; position:relative; display:none; flex-direction:column; align-items:center; gap:14px; margin-bottom:80px;';

        const dotsWrap = document.createElement('div');
        dotsWrap.style.cssText = 'display:flex; gap:14px;';
        dotsWrap.id = 'lock-auth-dots';
        for (let i = 0; i < 4; i++) {
            const dot = document.createElement('div');
            dot.style.cssText = 'width:14px; height:14px; border-radius:50%; border:2px solid rgba(255,255,255,0.8); background:transparent; transition:background 0.15s ease;';
            dotsWrap.appendChild(dot);
        }
        authDots = dotsWrap;

        authInput = document.createElement('input');
        authInput.type = 'password';
        authInput.id = 'lock-auth-input';
        authInput.setAttribute('autocomplete', 'off');
        authInput.setAttribute('inputmode', 'numeric');
        authInput.style.cssText = 'width:180px; padding:10px 14px; border-radius:10px; border:1px solid rgba(255,255,255,0.4); background:rgba(0,0,0,0.35); color:#fff; font-size:18px; text-align:center; letter-spacing:8px; outline:none; backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px);';

        authHint = document.createElement('div');
        authHint.style.cssText = 'font-size:13px; color:rgba(255,255,255,0.85); min-height:18px; text-shadow:0 1px 4px rgba(0,0,0,0.6);';

        authContainer.appendChild(dotsWrap);
        authContainer.appendChild(authInput);
        authContainer.appendChild(authHint);

        lockScreen.appendChild(authContainer);

        authContainer.addEventListener('click', (e) => e.stopPropagation());

        authInput.addEventListener('input', (e) => {
            updateDots(e.target.value);
            authHint.textContent = '';
        });

        authInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                submitAuth();
            }
        });

        return authContainer;
    }

    function updateDots(value) {
        if (!authDots) return;
        const dots = authDots.children;
        const len = (value || '').length;
        for (let i = 0; i < dots.length; i++) {
            if (i < len) {
                dots[i].style.background = 'rgba(255,255,255,0.95)';
            } else {
                dots[i].style.background = 'transparent';
            }
        }
    }

    function shake() {
        if (!authContainer) return;
        authContainer.animate(
            [
                { transform: 'translateX(0)' },
                { transform: 'translateX(-10px)' },
                { transform: 'translateX(10px)' },
                { transform: 'translateX(-8px)' },
                { transform: 'translateX(8px)' },
                { transform: 'translateX(0)' }
            ],
            { duration: 420, easing: 'ease-in-out' }
        );
        if (navigator.vibrate) {
            try { navigator.vibrate(220); } catch (e) {}
        }
    }

    function submitAuth() {
        if (!authInput) return;
        const val = authInput.value;
        if (verify(val)) {
            hideAuthInput();
            authInput.value = '';
            updateDots('');
            if (window.MXOS.system && typeof window.MXOS.system.lock === 'function') {
                const lockScreen = document.getElementById('lock-screen');
                if (lockScreen) {
                    lockScreen.dispatchEvent(new CustomEvent('mxos:auth-success'));
                }
            }
            if (typeof window.unlockScreen === 'function') {
                window.unlockScreen();
            } else {
                tryUnlock();
            }
        } else {
            shake();
            if (authHint) authHint.textContent = '输入错误，请重试';
            authInput.value = '';
            updateDots('');
        }
    }

    function tryUnlock() {
        const lockScreen = document.getElementById('lock-screen');
        if (lockScreen) {
            lockScreen.click();
        }
    }

    function showAuthInput() {
        const ui = buildAuthUI();
        if (!ui) return;
        const t = readType();
        if (t === 'none') {
            hideAuthInput();
            return;
        }
        ui.style.display = 'flex';
        if (authInput) {
            authInput.value = '';
            authInput.type = t === 'pin' ? 'tel' : 'password';
            authInput.setAttribute('inputmode', t === 'pin' ? 'numeric' : 'text');
            authInput.placeholder = t === 'pin' ? '输入 4 位 PIN' : '输入密码';
            updateDots('');
            if (authHint) authHint.textContent = '';
            setTimeout(() => authInput.focus(), 80);
        }
        const hint = document.querySelector('.lock-hint');
        if (hint) hint.style.display = 'none';
    }

    function hideAuthInput() {
        if (authContainer) authContainer.style.display = 'none';
        const hint = document.querySelector('.lock-hint');
        if (hint) hint.style.display = '';
    }

    function init() {
        buildAuthUI();
        window.addEventListener('system:lock', () => {
            const t = readType();
            if (t !== 'none') {
                showAuthInput();
            }
        });
        const lockScreen = document.getElementById('lock-screen');
        if (lockScreen) {
            const visible = lockScreen.style.display !== 'none' && !lockScreen.classList.contains('hidden');
            if (visible) {
                const t = readType();
                if (t !== 'none') {
                    showAuthInput();
                }
            }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    MXOS.Lock = {
        setPin,
        setPassword,
        clear,
        verify,
        getType,
        showAuthInput,
        hideAuthInput
    };
})();
