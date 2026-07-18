const API_BASE = 'https://mxosapi.neocn.top';
const API_FALLBACK_BASE = 'https://mxos-api.3132329918.workers.dev';

export const CONFIG = {
  API_BASE,
  API_PREFIX: '/api',
  API_FALLBACK_BASE,
  TIMEOUT: 15000,
  RETRY: 1
};

export function apiUrl(path) {
  if (!path) path = '';
  if (path.indexOf('http') === 0) return path;
  if (path.charAt(0) !== '/' && path !== '') path = '/' + path;
  return CONFIG.API_BASE + CONFIG.API_PREFIX + path;
}

export default CONFIG;
