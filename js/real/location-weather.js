import { http } from '../utils/http.js';

window.MXOS = window.MXOS || {};
window.MXOS.Real = window.MXOS.Real || {};

const LOCATION_CACHE_KEY = 'mxos_real_location';
const WEATHER_CACHE_KEY = 'mxos_real_weather';
const CACHE_TTL = 30 * 60 * 1000;

function readCache(key) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const obj = JSON.parse(raw);
        if (!obj || typeof obj !== 'object') return null;
        if (Date.now() - (obj.timestamp || 0) > CACHE_TTL) return null;
        return obj;
    } catch (e) {
        return null;
    }
}

function writeCache(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(Object.assign({ timestamp: Date.now() }, data)));
    } catch (e) {}
}

function getPositionFromGeo() {
    return new Promise((resolve) => {
        if (!navigator.geolocation || !navigator.geolocation.getCurrentPosition) {
            resolve(null);
            return;
        }
        let settled = false;
        const timer = setTimeout(() => {
            if (!settled) { settled = true; resolve(null); }
        }, 10000);
        try {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timer);
                    resolve({
                        latitude: pos.coords.latitude,
                        longitude: pos.coords.longitude,
                        accuracy: pos.coords.accuracy,
                        altitude: pos.coords.altitude,
                        altitudeAccuracy: pos.coords.altitudeAccuracy,
                        heading: pos.coords.heading,
                        speed: pos.coords.speed,
                        source: 'geolocation',
                        timestamp: pos.timestamp
                    });
                },
                (err) => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timer);
                    resolve(null);
                },
                { enableHighAccuracy: false, timeout: 9000, maximumAge: 300000 }
            );
        } catch (e) {
            clearTimeout(timer);
            resolve(null);
        }
    });
}

async function getPositionFromIP() {
    try {
        const resp = await http.get('/location', { retry: 0 });
        const data = resp && (resp.data || resp) || resp;
        const lat = data && (data.latitude != null ? data.latitude : data.lat);
        const lon = data && (data.longitude != null ? data.longitude : data.lon);
        const latNum = typeof lat === 'string' ? parseFloat(lat) : lat;
        const lonNum = typeof lon === 'string' ? parseFloat(lon) : lon;
        if (data && typeof latNum === 'number' && !isNaN(latNum) && typeof lonNum === 'number' && !isNaN(lonNum)) {
            return {
                latitude: latNum,
                longitude: lonNum,
                accuracy: data.accuracy || null,
                city: data.city || null,
                region: data.region || null,
                country: data.country || data.country_name || null,
                countryCode: data.country_code || data.countryCode || null,
                timezone: data.timezone || null,
                source: 'ip',
                timestamp: Date.now()
            };
        }
    } catch (e) {}
    return null;
}

let locationPromise = null;

async function location(forceRefresh = false) {
    if (!forceRefresh) {
        const cached = readCache(LOCATION_CACHE_KEY);
        if (cached && cached.data) return cached.data;
    }
    if (locationPromise) return locationPromise;
    locationPromise = (async () => {
        let pos = await getPositionFromGeo();
        if (!pos) pos = await getPositionFromIP();
        if (pos) writeCache(LOCATION_CACHE_KEY, { data: pos });
        locationPromise = null;
        return pos;
    })();
    return locationPromise;
}

const WEATHER_CODE_MAP = {
    0: { desc: '晴', icon: 'clear' },
    1: { desc: '主要晴朗', icon: 'clear' },
    2: { desc: '局部多云', icon: 'partly-cloudy' },
    3: { desc: '阴', icon: 'cloudy' },
    45: { desc: '雾', icon: 'fog' },
    48: { desc: '凇雾', icon: 'fog' },
    51: { desc: '小毛毛雨', icon: 'drizzle' },
    53: { desc: '毛毛雨', icon: 'drizzle' },
    55: { desc: '大毛毛雨', icon: 'drizzle' },
    56: { desc: '冻毛毛雨', icon: 'drizzle' },
    57: { desc: '强冻毛毛雨', icon: 'drizzle' },
    61: { desc: '小雨', icon: 'rain' },
    63: { desc: '中雨', icon: 'rain' },
    65: { desc: '大雨', icon: 'rain' },
    66: { desc: '冻雨', icon: 'rain' },
    67: { desc: '强冻雨', icon: 'rain' },
    71: { desc: '小雪', icon: 'snow' },
    73: { desc: '中雪', icon: 'snow' },
    75: { desc: '大雪', icon: 'snow' },
    77: { desc: '雪粒', icon: 'snow' },
    80: { desc: '阵雨', icon: 'rain' },
    81: { desc: '强阵雨', icon: 'rain' },
    82: { desc: '暴雨', icon: 'rain' },
    85: { desc: '阵雪', icon: 'snow' },
    86: { desc: '强阵雪', icon: 'snow' },
    95: { desc: '雷暴', icon: 'thunderstorm' },
    96: { desc: '雷暴伴冰雹', icon: 'thunderstorm' },
    99: { desc: '强雷暴伴冰雹', icon: 'thunderstorm' }
};

function mapWeather(code) {
    return WEATHER_CODE_MAP[code] || { desc: '未知', icon: 'unknown' };
}

async function fetchWeather(lat, lon) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('weather request failed');
    const data = await res.json();
    if (!data || !data.current_weather) throw new Error('no current_weather');
    const cw = data.current_weather;
    const mapped = mapWeather(cw.weathercode);
    return {
        temperature: cw.temperature,
        windspeed: cw.windspeed,
        winddirection: cw.winddirection,
        weathercode: cw.weathercode,
        description: mapped.desc,
        icon: mapped.icon,
        isDay: typeof cw.is_day === 'number' ? cw.is_day === 1 : null,
        time: cw.time || null,
        timezone: data.timezone || null,
        utcOffsetSeconds: data.utc_offset_seconds || null,
        latitude: data.latitude,
        longitude: data.longitude,
        source: 'open-meteo',
        fetchedAt: Date.now()
    };
}

async function weather(forceRefresh = false) {
    if (!forceRefresh) {
        const cached = readCache(WEATHER_CACHE_KEY);
        if (cached && cached.data) return cached.data;
    }
    const pos = await location(forceRefresh);
    if (!pos) return null;
    try {
        const w = await fetchWeather(pos.latitude, pos.longitude);
        writeCache(WEATHER_CACHE_KEY, { data: w });
        return w;
    } catch (e) {
        return null;
    }
}

window.MXOS.Real.location = location;
window.MXOS.Real.weather = weather;

export { location, weather };
