import { createSignal, onMount, onCleanup, type JSX } from "solid-js";

export default function Layout(props: { children: JSX.Element }) {
  const readStoredCollapsed = (): boolean => {
    if (typeof window === "undefined") return false;
    const storage = window.localStorage;
    if (!storage || typeof storage.getItem !== "function") return false;
    return storage.getItem("sidebar-collapsed") === "true";
  };

  const [collapsed, setCollapsed] = createSignal(readStoredCollapsed());

  onMount(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "sidebar-collapsed") {
        setCollapsed(e.newValue === "true");
      }
    };

    const onSidebarToggle = () => {
      const val = readStoredCollapsed();
      if (val !== collapsed()) setCollapsed(val);
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("sidebar-toggle", onSidebarToggle);
    onCleanup(() => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("sidebar-toggle", onSidebarToggle);
    });
  });

  return (
    <main
      class={`flex-1 min-h-screen relative z-10 p-6 md:p-8 transition-[margin-left] duration-300 ease-[var(--ease-out-expo)] ${
        collapsed() ? "md:ml-16" : "md:ml-[17rem]"
      }`}
    >
      {props.children}
    </main>
  );
}
