import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register 100% Offline-First Service Worker for permanent offline caching across device reboots
if (typeof window !== 'undefined') {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch((err) => {
        console.warn('Offline Service Worker registration failed:', err);
      });
    });
  }

  // Global crash listener for immediate visual recovery
  window.addEventListener('error', (event) => {
    console.error('Mariner Pro global error:', event.error || event.message);
  });
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}


