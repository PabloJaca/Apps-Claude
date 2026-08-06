import React from "react";
import { createRoot } from "react-dom/client";
import AppGastos from "./App.jsx";

createRoot(document.getElementById("raiz")).render(
  <React.StrictMode>
    <AppGastos />
  </React.StrictMode>
);
