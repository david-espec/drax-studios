import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { Logo } from "./Logo";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen w-full">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border px-4 py-3 md:hidden">
          <Logo size={30} showWordmark />
        </header>
        <main className="flex-1 pb-20 md:pb-0">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
