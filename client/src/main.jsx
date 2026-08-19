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
