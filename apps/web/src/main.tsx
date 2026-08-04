import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './app/App';
import { createBuildConsoleBadge, currentBuildInfo } from './shared/build/model/build-info';
import { useBuildUpdateStore } from './shared/build/store/build-update.store';

console.info(...createBuildConsoleBadge(currentBuildInfo));

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  useBuildUpdateStore.getState().markStaleAssets();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
