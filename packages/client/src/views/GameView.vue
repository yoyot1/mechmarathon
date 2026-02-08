<script setup lang="ts">
// TODO: Main game view - PixiJS board + card programming UI
</script>

<template>
  <div class="game">
    <div class="board-container">
      <!-- PixiJS canvas will be mounted here -->
    </div>
    <div class="controls">
      <!-- Card programming interface -->
    </div>
  </div>
</template>

<style scoped>
.game {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.board-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.controls {
  padding: 1rem;
  background: #1a1a2e;
  border-top: 1px solid #333;
}
</style>
