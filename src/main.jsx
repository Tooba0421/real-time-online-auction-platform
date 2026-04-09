import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import "bootstrap/dist/css/bootstrap.min.css";
import { FavoritesProvider } from "./userFrontend/components/FavoritesContext.jsx";
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>

<FavoritesProvider>
  <App />
</FavoritesProvider>
  </React.StrictMode>
);
