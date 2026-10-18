import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./style.css";

const bootInput = document.getElementById(
  "boot-input",
) as HTMLTextAreaElement | null;
function mount() {
  const initialDraft = bootInput?.value ?? "";
  const wasFocused = document.activeElement === bootInput;
  createRoot(document.getElementById("root")!).render(
    <App bootDraft={initialDraft} wasFocused={wasFocused} />,
  );
}
// Preserve an IME composition that began while the application bundle loaded.
if (bootInput?.dataset.composing === "true")
  bootInput.addEventListener("compositionend", mount, { once: true });
else mount();
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js").catch(() => {
      /* Offline availability is optional when registration fails. */
    });
  });
}
