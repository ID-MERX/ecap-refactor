import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";
import { siteConfig } from "@/config";
import { PlaceholderPage } from "@/app/PlaceholderPage";

const root = document.getElementById("root");
if (!root) throw new Error("No #root element in index.html");

document.title = siteConfig.pageTitle();

createRoot(root).render(
  <StrictMode>
    <PlaceholderPage />
  </StrictMode>,
);
