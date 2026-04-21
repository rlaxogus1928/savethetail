import { Suspense } from "react";
import { DashboardContent } from "@/components/dashboard/DashboardContent";
import { bottomTabBarContentPaddingClass } from "@/components/layout/BottomTabBar";

function DashboardFallback() {
  return (
    <main
      className={`mx-auto flex min-h-full w-full max-w-lg flex-1 flex-col gap-4 px-4 py-6 ${bottomTabBarContentPaddingClass}`}
    >
      <div className="h-7 w-44 animate-pulse rounded bg-zinc-200" />
      <div className="h-20 w-full animate-pulse rounded-2xl bg-zinc-200" />
      <div className="h-20 w-full animate-pulse rounded-2xl bg-zinc-200" />
      <div className="h-20 w-full animate-pulse rounded-2xl bg-zinc-200" />
    </main>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardFallback />}>
      <DashboardContent />
    </Suspense>
  );
}

