import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";

export function AppShell() {
  return (
    <div className="h-screen w-full flex flex-col md:flex-row font-body bg-bg overflow-hidden">
      <Sidebar />
      <main className="flex-1 px-4 md:px-8 py-6 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
