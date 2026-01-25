import React from "react";
import App from "./components/App";
import "./index.css";
import { BrowserRouter } from "react-router-dom/";
import ReactDOM from "react-dom"
import { ChakraProvider } from '@chakra-ui/react'
import ErrorBoundary from "./components/ErrorBoundary"

ReactDOM.render(
    <ErrorBoundary>
      <ChakraProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ChakraProvider>
    </ErrorBoundary>,
    document.getElementById("root")
  );
