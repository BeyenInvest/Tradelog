import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";

export function AppShell() {
  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row font-body bg-bg">
      <Sidebar />
      <main className="flex-1 px-4 md:px-8 py-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
