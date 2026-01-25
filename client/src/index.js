import React from "react";
import App from "./components/App";
import "./index.css";
import { BrowserRouter } from "react-router-dom/";
import ReactDOM from "react-dom"
import { ChakraProvider } from '@chakra-ui/react'

ReactDOM.render(
    <ChakraProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ChakraProvider>,
    document.getElementById("root")
  );
