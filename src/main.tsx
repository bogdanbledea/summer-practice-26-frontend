import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "@radix-ui/themes/styles.css";
import { Theme } from "@radix-ui/themes";
import App from "./App.tsx";
import LoginPage from "./LoginPage.tsx";
import { BrowserRouter, Routes, Route } from "react-router";
import RegisterPage from "./RegisterPage.tsx";
import { AuthProvider } from "./AuthContext.tsx";
import LogoutPage from "./LogoutPage.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Theme accentColor="indigo" radius="large">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/logout" element={<LogoutPage />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </Theme>
  </StrictMode>,
);
