<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const auth = useAuthStore();

const email = ref('');
const password = ref('');

async function handleLogin() {
  try {
    await auth.login({ email: email.value, password: password.value });
    router.push('/lobby');
  } catch {
    // error is set in the store
  }
}
</script>

<template>
  <div class="auth-page">
    <h2>Login</h2>
    <p v-if="auth.error" class="error">{{ auth.error }}</p>
    <form @submit.prevent="handleLogin">
      <input v-model="email" type="email" placeholder="Email" required />
      <input v-model="password" type="password" placeholder="Password" required />
      <button type="submit" class="btn" :disabled="auth.loading">
        {{ auth.loading ? 'Logging in...' : 'Login' }}
      </button>
    </form>
    <p>Don't have an account? <RouterLink to="/register">Register</RouterLink></p>
  </div>
</template>

<style scoped>
.auth-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  gap: 1.5rem;
}

form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
  max-width: 320px;
}

input {
  padding: 0.75rem;
  border: 1px solid #333;
  border-radius: 0.5rem;
  background: #1a1a2e;
  color: #e0e0e0;
  font-size: 1rem;
}

.btn {
  padding: 0.75rem;
  border: none;
  border-radius: 0.5rem;
  background: #7b2ff7;
  color: white;
  font-weight: 600;
  cursor: pointer;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error {
  color: #ff4444;
  font-size: 0.9rem;
}

a {
  color: #7b2ff7;
}
</style>
