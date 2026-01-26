import React from "react";
import App from "./components/App";
import "./index.css";
import { BrowserRouter } from "react-router-dom/";
import ReactDOM from "react-dom"
import ErrorBoundary from "./components/ErrorBoundary"

console.log('=== INDEX.JS LOADING ===');
console.log('Root element exists:', !!document.getElementById("root"));
console.log('Current URL:', window.location.href);
console.log('Current pathname:', window.location.pathname);

ReactDOM.render(
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>,
    document.getElementById("root"),
    () => {
      console.log('=== REACT RENDERED ===');
    }
  );
