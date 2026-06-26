import { Link, useLocation } from "@tanstack/react-router";
import { Home, BarChart3, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const tabs = [
    { to: "/today", label: "Today", icon: Home },
    { to: "/trends", label: "Trends", icon: BarChart3 },
    { to: "/settings", label: "Settings", icon: Settings },
  ] as const;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1 mx-auto w-full max-w-md px-5 pt-8 pb-32">
        {children}
      </main>
      <nav className="fixed bottom-5 left-1/2 -translate-x-1/2 w-[min(92vw,22rem)] neu-raised rounded-3xl px-3 py-2 flex items-center justify-around z-50">
        {tabs.map((t) => {
          const active = pathname.startsWith(t.to);
          const Icon = t.icon;
          return (
            <Link
              key={t.to}
              to={t.to}
              className={cn(
                "flex flex-col items-center gap-1 px-4 py-2 rounded-2xl transition-all",
                active
                  ? "neu-pressed-sm text-[color:var(--emerald)]"
                  : "text-muted-foreground",
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={2.2} />
              <span className="text-[10px] font-medium tracking-wide">{t.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
