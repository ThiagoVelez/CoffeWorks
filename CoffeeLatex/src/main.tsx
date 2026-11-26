import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/hanken-grotesk/400.css";
import "@fontsource/hanken-grotesk/500.css";
import "@fontsource/hanken-grotesk/600.css";
import "@fontsource/hanken-grotesk/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/600.css";
import "katex/dist/katex.min.css";
import { App } from "./App";
import { ErrorBoundary } from "./studio/ErrorBoundary";
import "./index.css";
import "./theme.generated.css";
import { initTheme } from "./theme/theme";

initTheme();

const rootElement = document.getElementById("root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary appName="CoffeeLatex">
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
}
