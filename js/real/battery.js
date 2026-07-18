window.MXOS = window.MXOS || {};
window.MXOS.Real = window.MXOS.Real || {};

let cachedBattery = null;
let listenersBound = false;
const changeListeners = new Set();

function snapshot(battery) {
    return {
        level: typeof battery.level === 'number' ? Math.round(battery.level * 100) : null,
        charging: !!battery.charging,
        chargingTime: typeof battery.chargingTime === 'number' && isFinite(battery.chargingTime) ? battery.chargingTime : null,
        dischargingTime: typeof battery.dischargingTime === 'number' && isFinite(battery.dischargingTime) ? battery.dischargingTime : null,
        supported: true,
        timestamp: Date.now()
    };
}

function bindListeners(battery) {
    if (listenersBound) return;
    listenersBound = true;
    const update = () => {
        cachedBattery = snapshot(battery);
        changeListeners.forEach(fn => {
            try { fn(cachedBattery); } catch (e) {}
        });
    };
    battery.addEventListener('levelchange', update);
    battery.addEventListener('chargingchange', update);
    battery.addEventListener('chargingtimechange', update);
    battery.addEventListener('dischargingtimechange', update);
}

async function battery() {
    if (!navigator.getBattery) {
        return null;
    }
    try {
        if (!cachedBattery) {
            const b = await navigator.getBattery();
            cachedBattery = snapshot(b);
            bindListeners(b);
        }
        cachedBattery.timestamp = Date.now();
        return cachedBattery;
    } catch (e) {
        return null;
    }
}

function onBatteryChange(fn) {
    if (typeof fn !== 'function') return () => {};
    changeListeners.add(fn);
    return () => changeListeners.delete(fn);
}

battery.onChange = onBatteryChange;
battery.isSupported = () => typeof navigator.getBattery === 'function';

window.MXOS.Real.battery = battery;

export { battery };
