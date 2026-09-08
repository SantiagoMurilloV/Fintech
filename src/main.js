/** Entry point: registers the service worker and mounts the app. */
import { mount } from './core/runtime.js';
import { registerServiceWorker } from './core/pwa.js';
import { App } from './App.js';

registerServiceWorker();
mount(App, document.getElementById('root'));
