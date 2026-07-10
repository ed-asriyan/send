import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(
      (registration) => {
        console.log('ServiceWorker registration successful with scope:', registration.scope);
      },
      (err) => {
        console.error('ServiceWorker registration failed:', err);
      }
    );
  });
}

const app = mount(App, {
    target: document.getElementById('app')!,
});

export default app;
