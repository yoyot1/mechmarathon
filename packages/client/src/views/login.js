import '../styles/auth.css';
import { auth } from '../state/auth.js';
import { navigateTo } from '../lib/router.js';

export function render(container) {
  container.innerHTML = `
    <div class="auth-page">
      <h2>Login</h2>
      <p class="error" id="auth-error" style="display:none"></p>
      <form id="login-form">
        <input type="email" name="email" placeholder="Email" required />
        <input type="password" name="password" placeholder="Password" required />
        <button type="submit" class="btn" id="login-btn">Login</button>
      </form>
      <p>Don't have an account? <a href="/register" data-link>Register</a></p>
    </div>
  `;

  const form = container.querySelector('#login-form');
  const errorEl = container.querySelector('#auth-error');
  const btn = container.querySelector('#login-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.style.display = 'none';
    btn.disabled = true;
    btn.textContent = 'Logging in...';

    try {
      await auth.login({
        email: form.email.value,
        password: form.password.value,
      });
      navigateTo('/lobby');
    } catch {
      if (auth.error) {
        errorEl.textContent = auth.error;
        errorEl.style.display = '';
      }
    } finally {
      btn.disabled = false;
      btn.textContent = 'Login';
    }
  });
}

export function unmount() {}
