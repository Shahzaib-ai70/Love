import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { LoveProvider } from "./LoveContext";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <LoveProvider>
        <App />
      </LoveProvider>
    </BrowserRouter>
  </React.StrictMode>
);
