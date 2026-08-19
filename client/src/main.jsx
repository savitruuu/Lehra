import React from "react";
import { createRoot } from "react-dom/client";

import App from "./App.jsx";
import { loadSettings, applyTheme } from "./lib/settings.js";
import "./style.css";

// Before the first paint, so the saved theme is what renders rather than a
// flash of the shipped dark one. index.html carries `dark-mode` on <body> as
// the starting state; this removes it when the saved theme says light.
applyTheme(loadSettings());

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Production only: in development Vite serves modules it expects to control,
// and a worker caching them fights the dev server's own reloading.
//
// Registered after load rather than during it, so fetching and installing the
// worker never competes with the audio the player is decoding.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      // Not fatal. Without it the app still runs; it just will not install as a
      // standalone app or work offline.
      console.warn("Service worker registration failed:", err);
    });
  });
}
