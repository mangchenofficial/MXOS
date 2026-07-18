window.MXOS = window.MXOS || {};
window.MXOS.Real = window.MXOS.Real || {};

function getPlatform() {
    try {
        if (navigator.userAgentData && navigator.userAgentData.platform) {
            return navigator.userAgentData.platform;
        }
    } catch (e) {}
    return navigator.platform || 'unknown';
}

function getNetworkInfo() {
    try {
        const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (conn) {
            return {
                effectiveType: conn.effectiveType || null,
                downlink: typeof conn.downlink === 'number' ? conn.downlink : null,
                rtt: typeof conn.rtt === 'number' ? conn.rtt : null,
                saveData: !!conn.saveData
            };
        }
    } catch (e) {}
    return null;
}

function getUAData() {
    try {
        if (navigator.userAgentData) {
            const ua = navigator.userAgentData;
            return {
                brands: ua.brands ? ua.brands.map(b => ({ brand: b.brand, version: b.version })) : [],
                mobile: !!ua.mobile,
                platform: ua.platform || null
            };
        }
    } catch (e) {}
    return null;
}

function hardware() {
    const nav = navigator || {};
    const scr = screen || {};
    let memory = null;
    try {
        if (typeof nav.deviceMemory === 'number') memory = nav.deviceMemory;
    } catch (e) {}

    let timezone = null;
    try {
        timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
    } catch (e) {}

    return {
        cpuCores: typeof nav.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : null,
        deviceMemoryGB: memory,
        platform: getPlatform(),
        userAgent: nav.userAgent || null,
        userAgentData: getUAData(),
        online: nav.onLine,
        language: nav.language || null,
        languages: nav.languages || [],
        timezone: timezone,
        network: getNetworkInfo(),
        screen: {
            width: scr.width || null,
            height: scr.height || null,
            availWidth: scr.availWidth || null,
            availHeight: scr.availHeight || null,
            colorDepth: scr.colorDepth || null,
            pixelDepth: scr.pixelDepth || null,
            orientation: (scr.orientation && scr.orientation.type) || null
        },
        devicePixelRatio: typeof window.devicePixelRatio === 'number' ? window.devicePixelRatio : null,
        vendor: nav.vendor || null,
        cookieEnabled: nav.cookieEnabled,
        doNotTrack: nav.doNotTrack || null,
        maxTouchPoints: typeof nav.maxTouchPoints === 'number' ? nav.maxTouchPoints : 0
    };
}

window.MXOS.Real.hardware = hardware;

export { hardware };
