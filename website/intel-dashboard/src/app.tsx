import { Router, useLocation } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { MetaProvider } from "@solidjs/meta";
import { Show, Suspense, type JSX } from "solid-js";
import { AuthProvider } from "~/lib/auth";
import Sidebar from "~/components/layout/Sidebar";
import Layout from "~/components/layout/Layout";
import "./app.css";

function isPublicAppPath(pathname: string): boolean {
  return (
    pathname === "/landing" ||
    pathname.startsWith("/landing/") ||
    pathname === "/login" ||
    pathname === "/signup"
  );
}

function AppShell(props: { children: JSX.Element }) {
  const location = useLocation();
  const publicRoute = () => isPublicAppPath(location.pathname);

  return (
    <AuthProvider publicRoute={publicRoute()}>
      <div class="flex min-h-screen relative">
        <Show when={!publicRoute()}>
          <Sidebar />
        </Show>
        <Layout noSidebar={publicRoute()}>
          <Suspense>{props.children}</Suspense>
        </Layout>
      </div>
    </AuthProvider>
  );
}

export default function App() {
  return (
    <MetaProvider>
      <Router root={(props) => <AppShell>{props.children}</AppShell>}>
        <FileRoutes />
      </Router>
    </MetaProvider>
  );
}
