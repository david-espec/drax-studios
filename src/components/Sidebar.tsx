"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./nav-items";
import { Logo } from "./Logo";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:border-r md:border-border md:bg-surface">
      <div className="flex items-center gap-2 px-5 py-5">
        <Logo size={36} showWordmark />
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href + item.label}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-surface-2 text-foreground"
                  : "text-muted hover:bg-surface-2/60 hover:text-foreground"
              }`}
            >
              <Icon size={18} className={active ? "text-accent-blue" : ""} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-5 py-4 text-xs text-muted">Drax Studio · v0.1</div>
    </aside>
  );
}
