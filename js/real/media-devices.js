window.MXOS = window.MXOS || {};
window.MXOS.Real = window.MXOS.Real || {};

async function enumerate() {
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.enumerateDevices !== 'function') {
        return null;
    }
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.map(d => ({
            deviceId: d.deviceId || null,
            kind: d.kind || null,
            label: d.label || null,
            groupId: d.groupId || null
        }));
    } catch (e) {
        return null;
    }
}

async function getSupportedConstraints() {
    try {
        if (navigator.mediaDevices && typeof navigator.mediaDevices.getSupportedConstraints === 'function') {
            return navigator.mediaDevices.getSupportedConstraints();
        }
    } catch (e) {}
    return null;
}

function getScreenInfo() {
    const s = window.screen || {};
    return {
        width: s.width || null,
        height: s.height || null,
        availWidth: s.availWidth || null,
        availHeight: s.availHeight || null,
        colorDepth: s.colorDepth || null,
        pixelDepth: s.pixelDepth || null,
        orientation: (s.orientation && {
            type: s.orientation.type || null,
            angle: typeof s.orientation.angle === 'number' ? s.orientation.angle : null
        }) || null,
        devicePixelRatio: typeof window.devicePixelRatio === 'number' ? window.devicePixelRatio : null,
        innerWidth: window.innerWidth || null,
        innerHeight: window.innerHeight || null,
        outerWidth: window.outerWidth || null,
        outerHeight: window.outerHeight || null,
        availTop: typeof s.availTop === 'number' ? s.availTop : null,
        availLeft: typeof s.availLeft === 'number' ? s.availLeft : null
    };
}

async function mediaDevices() {
    const devices = await enumerate();
    const constraints = await getSupportedConstraints();
    return {
        supported: devices !== null,
        devices: devices || [],
        supportedConstraints: constraints,
        screen: getScreenInfo(),
        hasUserMedia: !!(navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function'),
        hasDisplayMedia: !!(navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function'),
        timestamp: Date.now()
    };
}

mediaDevices.enumerate = enumerate;
mediaDevices.getScreenInfo = getScreenInfo;

window.MXOS.Real.mediaDevices = mediaDevices;

export { mediaDevices };
