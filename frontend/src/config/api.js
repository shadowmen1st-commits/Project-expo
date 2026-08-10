import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL;

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('accessToken');
  console.log("TOKEN BEFORE REQUEST:", token);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, error => {
  return Promise.reject(error);
});

let refreshPromise = null;
api.interceptors.response.use(response => response, async error => {
    const request = error.config;
    console.log("API ERROR:", {
        url: request?.url,
        method: request?.method,
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
        headers: request?.headers
    });
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
