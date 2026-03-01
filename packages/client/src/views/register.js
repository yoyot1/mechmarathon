import '../styles/auth.css';
import { auth } from '../state/auth.js';
import { navigateTo } from '../lib/router.js';

export function render(container) {
  container.innerHTML = `
    <div class="auth-page">
      <h2>Register</h2>
      <p class="error" id="auth-error" style="display:none"></p>
      <form id="register-form">
        <input type="text" name="username" placeholder="Username" required minlength="3" maxlength="24" />
        <input type="email" name="email" placeholder="Email" required />
        <input type="password" name="password" placeholder="Password" required minlength="8" />
        <button type="submit" class="btn" id="register-btn">Create Account</button>
      </form>
      <p>Already have an account? <a href="/login" data-link>Login</a></p>
    </div>
  `;

  const form = container.querySelector('#register-form');
  const errorEl = container.querySelector('#auth-error');
  const btn = container.querySelector('#register-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.style.display = 'none';
    btn.disabled = true;
    btn.textContent = 'Creating account...';

    try {
      await auth.register({
        username: form.username.value,
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
      btn.textContent = 'Create Account';
    }
  });
}

export function unmount() {}
