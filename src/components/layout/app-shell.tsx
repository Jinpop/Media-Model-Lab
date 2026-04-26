"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const navItems = [
  { href: "/app", label: "대시보드" },
  { href: "/app/image", label: "텍스트→이미지" },
  { href: "/app/edit", label: "이미지 편집" },
  { href: "/app/video", label: "이미지→비디오" },
  { href: "/app/history", label: "히스토리" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-20 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="text-sm font-semibold tracking-[0.12em] text-cyan-300">
            Media Model Lab
          </Link>
          <nav className="hidden gap-1 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-md px-3 py-2 text-sm text-zinc-400 transition hover:text-zinc-100",
                  pathname === item.href && "bg-zinc-800 text-zinc-100",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <nav className="md:hidden">
          <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 pb-3 sm:px-6">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "shrink-0 rounded-md border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400",
                  pathname === item.href && "border-zinc-600 bg-zinc-800 text-zinc-100",
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
