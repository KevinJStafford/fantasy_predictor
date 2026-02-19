import React from "react";
import App from "./components/App";
import "./index.css";
import { BrowserRouter } from "react-router-dom";
import ReactDOM from "react-dom";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import ErrorBoundary from "./components/ErrorBoundary";

// Brand colors aligned with navbar and landing images
const theme = createTheme({
  palette: {
    primary: {
      main: "#ff6c26",
      dark: "#e55a1a",
      light: "rgba(255, 108, 38, 0.15)",
    },
    secondary: {
      main: "#f93d3a",
      dark: "#d63431",
    },
    background: {
      default: "#fafafa",
      paper: "#ffffff",
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
});

ReactDOM.render(
  <ErrorBoundary>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </ErrorBoundary>,
  document.getElementById("root")
);
