import axios from 'axios';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'https://resistant-marc-prints-seniors.trycloudflare.com').replace(/\/$/, '');

const api = axios.create({
  baseURL: API_BASE_URL.endsWith('/api') ? API_BASE_URL : `${API_BASE_URL}/api`,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('accessToken');
  if (token && token !== 'null' && token !== 'undefined' && token.trim() !== '') {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    delete config.headers.Authorization;
  }
  return config;
}, error => {
  return Promise.reject(error);
});

let refreshPromise = null;
api.interceptors.response.use(response => response, async error => {
    const request = error.config;
    console.log(`API ERROR: url=${request?.url} method=${request?.method} status=${error.response?.status} data=${JSON.stringify(error.response?.data)} message=${error.message}`);
    const isAuthRequest = ['/auth/login','/auth/register','/auth/refresh'].some(path => request?.url?.includes(path));
    if (error.response?.status === 401 && request && !request._retry && !isAuthRequest) {
        request._retry = true;
        try {
            refreshPromise ||= api.post('/auth/refresh').finally(() => { refreshPromise = null; });
            const response = await refreshPromise;
            if (response.data.accessToken) {
                localStorage.setItem('accessToken', response.data.accessToken);
                request.headers.Authorization = `Bearer ${response.data.accessToken}`;
            }
            return api(request);
        } catch {
            window.dispatchEvent(new Event('auth:expired'));
        }
    }
    return Promise.reject(error);
});
export { API_BASE_URL };
export default api;
