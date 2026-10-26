import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { configureAuth } from './account/service';
import './style.css';
// One Auth client per browser, including React StrictMode.
const config = configureAuth({
  DEV: import.meta.env.DEV,
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  VITE_AUTH_OTP_EXPIRY_SECONDS: import.meta.env.VITE_AUTH_OTP_EXPIRY_SECONDS,
  VITE_AUTH_OTP_LENGTH: import.meta.env.VITE_AUTH_OTP_LENGTH,
});
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App config={config} />
  </React.StrictMode>,
);
