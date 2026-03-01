import { api, setToken, ApiError } from '../lib/api.js';

const TOKEN_KEY = 'mechmarathon_token';

export const auth = {
  user: null,
  error: null,
  loading: false,

  setAuth(response) {
    localStorage.setItem(TOKEN_KEY, response.token);
    setToken(response.token);
    this.user = response.user;
    this.error = null;
  },

  async register(data) {
    this.loading = true;
    this.error = null;
    try {
      const res = await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      this.setAuth(res);
    } catch (e) {
      this.error = e instanceof ApiError ? e.message : 'Registration failed';
      throw e;
    } finally {
      this.loading = false;
    }
  },

  async login(data) {
    this.loading = true;
    this.error = null;
    try {
      const res = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      this.setAuth(res);
    } catch (e) {
      this.error = e instanceof ApiError ? e.message : 'Login failed';
      throw e;
    } finally {
      this.loading = false;
    }
  },

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    this.user = null;
  },

  async init() {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) return;

    setToken(stored);
    try {
      this.user = await api('/api/auth/me');
    } catch {
      this.logout();
    }
  },

  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },
};
