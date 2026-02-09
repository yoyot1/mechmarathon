import { ref } from 'vue';
import { defineStore } from 'pinia';
import type { UserProfile, AuthResponse, RegisterRequest, LoginRequest } from '@mechmarathon/shared';
import { api, setToken, ApiError } from '../lib/api';

const TOKEN_KEY = 'mechmarathon_token';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserProfile | null>(null);
  const error = ref<string | null>(null);
  const loading = ref(false);

  function setAuth(response: AuthResponse) {
    localStorage.setItem(TOKEN_KEY, response.token);
    setToken(response.token);
    user.value = response.user;
    error.value = null;
  }

  async function register(data: RegisterRequest) {
    loading.value = true;
    error.value = null;
    try {
      const res = await api<AuthResponse>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      setAuth(res);
    } catch (e) {
      error.value = e instanceof ApiError ? e.message : 'Registration failed';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function login(data: LoginRequest) {
    loading.value = true;
    error.value = null;
    try {
      const res = await api<AuthResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      setAuth(res);
    } catch (e) {
      error.value = e instanceof ApiError ? e.message : 'Login failed';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    user.value = null;
  }

  async function init() {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) return;

    setToken(stored);
    try {
      user.value = await api<UserProfile>('/api/auth/me');
    } catch {
      logout();
    }
  }

  return { user, error, loading, register, login, logout, init };
});
