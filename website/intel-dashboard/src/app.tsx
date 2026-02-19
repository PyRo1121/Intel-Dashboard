import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { Suspense } from "solid-js";
import { AuthProvider } from "~/lib/auth";
import Sidebar from "~/components/layout/Sidebar";
import Layout from "~/components/layout/Layout";
import "./app.css";

export default function App() {
  return (
    <AuthProvider>
      <Router
        root={(props) => (
          <div class="flex min-h-screen relative">
            <Sidebar />
            <Layout>
              <Suspense>{props.children}</Suspense>
            </Layout>
          </div>
        )}
      >
        <FileRoutes />
      </Router>
    </AuthProvider>
  );
}
