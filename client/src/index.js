import React from "react";
import App from "./components/App";
import "./index.css";
import { BrowserRouter } from "react-router-dom/";
import ReactDOM from "react-dom"
import ErrorBoundary from "./components/ErrorBoundary"

ReactDOM.render(
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>,
    document.getElementById("root")
  );
