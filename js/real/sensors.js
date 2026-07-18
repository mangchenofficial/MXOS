window.MXOS = window.MXOS || {};
window.MXOS.Real = window.MXOS.Real || {};

const latest = {
    orientation: null,
    motion: null
};

const orientationListeners = new Set();
const motionListeners = new Set();

let orientationBound = false;
let motionBound = false;
let active = false;

function isSupported() {
    return typeof DeviceOrientationEvent !== 'undefined' || typeof DeviceMotionEvent !== 'undefined';
}

function needsPermission() {
    return typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function';
}

async function requestPermission() {
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
        try {
            const ori = await DeviceOrientationEvent.requestPermission();
            if (ori !== 'granted') return false;
        } catch (e) { return false; }
    }
    if (typeof DeviceMotionEvent !== 'undefined' &&
        typeof DeviceMotionEvent.requestPermission === 'function') {
        try {
            const mot = await DeviceMotionEvent.requestPermission();
            if (mot !== 'granted') return false;
        } catch (e) { return false; }
    }
    return true;
}

function handleOrientation(e) {
    latest.orientation = {
        alpha: e.alpha,
        beta: e.beta,
        gamma: e.gamma,
        absolute: !!e.absolute,
        webkitCompassHeading: (typeof e.webkitCompassHeading === 'number') ? e.webkitCompassHeading : null,
        timestamp: Date.now()
    };
    orientationListeners.forEach(fn => { try { fn(latest.orientation); } catch (err) {} });
}

function handleMotion(e) {
    const a = e.acceleration || {};
    const ag = e.accelerationIncludingGravity || {};
    const rr = e.rotationRate || {};
    latest.motion = {
        acceleration: { x: a.x, y: a.y, z: a.z },
        accelerationIncludingGravity: { x: ag.x, y: ag.y, z: ag.z },
        rotationRate: { alpha: rr.alpha, beta: rr.beta, gamma: rr.gamma },
        interval: e.interval || null,
        timestamp: Date.now()
    };
    motionListeners.forEach(fn => { try { fn(latest.motion); } catch (err) {} });
}

function bind() {
    if (orientationBound && motionBound) return;
    if (!orientationBound && typeof window.DeviceOrientationEvent !== 'undefined') {
        window.addEventListener('deviceorientation', handleOrientation, true);
        orientationBound = true;
    }
    if (!motionBound && typeof window.DeviceMotionEvent !== 'undefined') {
        window.addEventListener('devicemotion', handleMotion, true);
        motionBound = true;
    }
}

function unbind() {
    if (orientationBound) {
        window.removeEventListener('deviceorientation', handleOrientation, true);
        orientationBound = false;
    }
    if (motionBound) {
        window.removeEventListener('devicemotion', handleMotion, true);
        motionBound = false;
    }
    latest.orientation = null;
    latest.motion = null;
}

async function start() {
    if (!isSupported()) return false;
    if (needsPermission()) {
        const ok = await requestPermission();
        if (!ok) return false;
    }
    bind();
    active = true;
    return true;
}

function stop() {
    unbind();
    active = false;
}

function onOrientation(fn) {
    if (typeof fn !== 'function') return () => {};
    orientationListeners.add(fn);
    return () => orientationListeners.delete(fn);
}

function onMotion(fn) {
    if (typeof fn !== 'function') return () => {};
    motionListeners.add(fn);
    return () => motionListeners.delete(fn);
}

function sensors() {
    if (!isSupported()) return null;
    return {
        supported: true,
        active: active,
        needsPermission: needsPermission(),
        orientation: latest.orientation,
        motion: latest.motion
    };
}

sensors.start = start;
sensors.stop = stop;
sensors.onOrientation = onOrientation;
sensors.onMotion = onMotion;
sensors.isSupported = isSupported;
sensors.requestPermission = requestPermission;

window.MXOS.Real.sensors = sensors;

export { sensors };
