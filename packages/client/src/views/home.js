import '../styles/home.css';

export function render(container) {
  container.innerHTML = `
    <div class="home">
      <h1>MechMarathon</h1>
      <p>Program your robot. Outmaneuver your opponents. Reach the checkpoints first.</p>
      <div class="actions">
        <a href="/login" data-link class="btn">Login</a>
        <a href="/register" data-link class="btn btn-secondary">Register</a>
      </div>
    </div>
  `;
}

export function unmount() {}
