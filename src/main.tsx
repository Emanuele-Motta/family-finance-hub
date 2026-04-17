import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Register Service Worker for offline support and PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      console.log('Service Worker registered:', registration);

      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => undefined);
      }

      if ('Notification' in window && Notification.permission === 'granted') {
        const today = new Date().toISOString().slice(0, 10);
        const key = 'ff_last_local_push_date';
        if (localStorage.getItem(key) !== today && registration.active) {
          registration.active.postMessage({
            type: 'SHOW_LOCAL_NOTIFICATION',
            title: 'Promemoria FamilyFinance',
            body: 'Hai gia registrato le spese di oggi?',
            tag: 'daily-reminder',
            url: '/?quickAdd=1',
          });
          localStorage.setItem(key, today);
        }
      }
    }).catch((error) => {
      console.error('Service Worker registration failed:', error);
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
