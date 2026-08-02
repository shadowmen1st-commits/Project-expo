import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL;
if (!API_BASE_URL) throw new Error('VITE_API_URL is required. Configure it in frontend/.env.');

const api = axios.create({ baseURL: API_BASE_URL.replace(/\/$/, ''), withCredentials: true, headers: { 'Content-Type': 'application/json' } });
let refreshPromise = null;
api.interceptors.response.use(response => response, async error => {
    const request = error.config;
    const isAuthRequest = ['/auth/login','/auth/register','/auth/refresh'].some(path => request?.url?.includes(path));
    if (error.response?.status === 401 && request && !request._retry && !isAuthRequest) {
        request._retry = true;
        try {
            refreshPromise ||= api.post('/auth/refresh').finally(() => { refreshPromise = null; });
            const response = await refreshPromise;
            if (response.data.accessToken) request.headers.Authorization = `Bearer ${response.data.accessToken}`;
            return api(request);
        } catch {
            window.dispatchEvent(new Event('auth:expired'));
        }
    }
    return Promise.reject(error);
});
export { API_BASE_URL };
export default api;
