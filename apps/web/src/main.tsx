import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { configureAuth } from './account/service';
import { configureDemo } from './account/demo';
import { avatarCatalog } from './avatar/catalog';
import './style.css';
// One Auth client per browser, including React StrictMode.
// Demo never instantiates Supabase, regardless of stored real sessions or configured keys.
const storage: Storage = {
  get length() {
    return window.localStorage.length;
  },
  clear: () => window.localStorage.clear(),
  key: (index) => window.localStorage.key(index),
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
  removeItem: (key) => window.localStorage.removeItem(key),
};
const config =
  import.meta.env.VITE_ACCOUNT_MODE === 'supabase'
    ? configureAuth({
        DEV: import.meta.env.DEV,
        VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
        VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        VITE_AUTH_OTP_EXPIRY_SECONDS: import.meta.env.VITE_AUTH_OTP_EXPIRY_SECONDS,
        VITE_AUTH_OTP_LENGTH: import.meta.env.VITE_AUTH_OTP_LENGTH,
      })
    : configureDemo(storage, avatarCatalog, window);
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App config={config} />
  </React.StrictMode>,
);
