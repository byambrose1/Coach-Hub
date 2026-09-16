import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Installability is a nice-to-have, not a requirement. If registration
      // fails for any reason, the app should keep working normally.
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
