<script setup lang="ts">
</script>

<template>
  <div class="home">
    <h1>MechMarathon</h1>
    <p>Program your robot. Outmaneuver your opponents. Reach the checkpoints first.</p>
    <div class="actions">
      <RouterLink to="/login" class="btn">Login</RouterLink>
      <RouterLink to="/register" class="btn btn-secondary">Register</RouterLink>
    </div>
  </div>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  text-align: center;
  gap: 1.5rem;
}

h1 {
  font-size: 3rem;
  background: linear-gradient(135deg, #00d4ff, #7b2ff7);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.actions {
  display: flex;
  gap: 1rem;
}

.btn {
  padding: 0.75rem 2rem;
  border-radius: 0.5rem;
  text-decoration: none;
  font-weight: 600;
  background: #7b2ff7;
  color: white;
  transition: opacity 0.2s;
}

.btn:hover {
  opacity: 0.85;
}

.btn-secondary {
  background: transparent;
  border: 2px solid #7b2ff7;
  color: #7b2ff7;
}
</style>
