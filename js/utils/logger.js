const DEBUG = (typeof localStorage !== 'undefined' && localStorage.getItem('mxos_debug') === '1') ||
    (typeof location !== 'undefined' && location.search.indexOf('debug=1') !== -1);

function formatLevel(level) {
    return '[' + level + ']';
}

export const logger = {
    log(...args) {
        if (DEBUG) console.log(formatLevel('LOG'), ...args);
    },
    info(...args) {
        if (DEBUG) console.info(formatLevel('INFO'), ...args);
    },
    warn(...args) {
        console.warn(formatLevel('WARN'), ...args);
    },
    error(...args) {
        console.error(formatLevel('ERROR'), ...args);
    },
    debug(...args) {
        if (DEBUG) console.debug(formatLevel('DEBUG'), ...args);
    },
    get enabled() { return DEBUG; }
};

window.MXOS = window.MXOS || {};
window.MXOS.logger = logger;

export default logger;
