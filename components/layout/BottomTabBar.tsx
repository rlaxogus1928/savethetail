"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ACTIVE = "#1a2744";
const INACTIVE = "#9ca3af";

const TABS = [
  { href: "/", label: "홈", emoji: "🏠" },
  { href: "/register", label: "등록", emoji: "➕" },
  { href: "/my", label: "내 공고", emoji: "📋" },
  { href: "/profile", label: "마이", emoji: "👤" },
] as const;

function isTabActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * 본문(`main` 등)에 적용하면 탭바·홈 인디케이터에 가리지 않습니다.
 * `60px` 탭 행 + `safe-area-inset-bottom`.
 */
export const bottomTabBarContentPaddingClass =
  "pb-[calc(60px+env(safe-area-inset-bottom,0px))]";

export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="하단 탭"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div className="mx-auto flex h-[60px] max-w-lg items-stretch justify-around px-2">
        {TABS.map(({ href, label, emoji }) => {
          const active = isTabActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-1 transition-colors"
              style={{ color: active ? ACTIVE : INACTIVE }}
            >
              <span className="text-xl leading-none" aria-hidden>
                {emoji}
              </span>
              <span className="max-w-full truncate text-[11px] font-medium leading-tight">
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
