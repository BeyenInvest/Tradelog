import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initMonitoring } from "./lib/monitoring";
import "./index.css";

// Fire-and-forget: a DSN-less build resolves instantly without loading Sentry,
// so this never delays first render.
void initMonitoring();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
