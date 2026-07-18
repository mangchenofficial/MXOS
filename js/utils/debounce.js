export function debounce(fn, wait = 300, immediate = false) {
    let timer = null;
    let lastArgs = null;
    let lastThis = null;
    function invoke() {
        timer = null;
        if (lastArgs) {
            const args = lastArgs;
            const ctx = lastThis;
            lastArgs = null;
            lastThis = null;
            return fn.apply(ctx, args);
        }
    }
    const debounced = function (...args) {
        lastArgs = args;
        lastThis = this;
        if (timer) clearTimeout(timer);
        if (immediate && !timer) {
            fn.apply(this, args);
            lastArgs = null;
        }
        timer = setTimeout(invoke, wait);
    };
    debounced.cancel = function () {
        if (timer) { clearTimeout(timer); timer = null; }
        lastArgs = null;
        lastThis = null;
    };
    debounced.flush = function () {
        if (timer) {
            clearTimeout(timer);
            invoke();
        }
    };
    return debounced;
}

export function throttle(fn, wait = 100) {
    let lastTime = 0;
    let timer = null;
    let lastArgs = null;
    let lastThis = null;
    return function (...args) {
        const now = Date.now();
        const remaining = wait - (now - lastTime);
        lastArgs = args;
        lastThis = this;
        if (remaining <= 0) {
            if (timer) { clearTimeout(timer); timer = null; }
            lastTime = now;
            fn.apply(this, args);
            lastArgs = null;
            lastThis = null;
        } else if (!timer) {
            timer = setTimeout(() => {
                lastTime = Date.now();
                timer = null;
                if (lastArgs) {
                    const a = lastArgs;
                    const c = lastThis;
                    lastArgs = null;
                    lastThis = null;
                    fn.apply(c, a);
                }
            }, remaining);
        }
    };
}

window.MXOS = window.MXOS || {};
window.MXOS.debounce = debounce;
window.MXOS.throttle = throttle;

export default debounce;
