"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./nav-items";

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface/95 backdrop-blur md:hidden">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href + item.label}
            href={item.href}
            className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium"
          >
            <Icon size={20} className={active ? "text-accent-blue" : "text-muted"} />
            <span className={active ? "text-foreground" : "text-muted"}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
