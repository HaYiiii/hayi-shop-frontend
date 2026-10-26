import { createBackofficeClient } from "@hayi/api-client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ApiProvider } from "./api";
import { createAppRouter } from "./app/router";
import { createStepUpGate } from "./features/identity/step-up";
import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/be-vietnam-pro/600.css";
import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/cormorant-garamond/600.css";
import "./index.css";

const queryClient = new QueryClient();
const stepUpGate = createStepUpGate();

function onSessionExpired() {
  queryClient.clear();
  void router.navigate({ to: "/login" });
}

// Same origin by default: Vite proxies /api in dev, the reverse proxy does in production.
const api = createBackofficeClient({
  baseUrl: import.meta.env.VITE_API_ORIGIN ?? "",
  onSessionExpired,
  onStepUpRequired: stepUpGate.request,
});

const router = createAppRouter({ queryClient, api, stepUpGate, onSessionExpired });

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ApiProvider client={api}>
        <RouterProvider router={router} />
      </ApiProvider>
    </QueryClientProvider>
  </StrictMode>,
);
