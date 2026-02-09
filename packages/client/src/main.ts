import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { router } from './router';
import { useAuthStore } from './stores/auth';

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);

// Hydrate auth from stored token before router navigates
const auth = useAuthStore();
auth.init().then(() => {
  app.use(router);
  app.mount('#app');
});
