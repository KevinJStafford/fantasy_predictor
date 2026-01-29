import React from "react";
import App from "./components/App";
import "./index.css";
import { HashRouter } from "react-router-dom";
import ReactDOM from "react-dom";
import ErrorBoundary from "./components/ErrorBoundary";

// HashRouter: server only ever sees "/", so refresh and direct links work without server rewrites
ReactDOM.render(
  <ErrorBoundary>
    <HashRouter>
      <App />
    </HashRouter>
  </ErrorBoundary>,
  document.getElementById("root")
);
