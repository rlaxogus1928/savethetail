import { Suspense } from "react";
import { HomeContent } from "@/components/home/HomeContent";
import { bottomTabBarContentPaddingClass } from "@/components/layout/BottomTabBar";

function HomeFallback() {
  return (
    <main
      className={`mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-4 pt-4 ${bottomTabBarContentPaddingClass}`}
    >
      <div className="h-8 w-40 animate-pulse rounded bg-zinc-200" />
      <div className="h-14 w-full animate-pulse rounded-xl bg-zinc-200" />
      <div className="h-64 w-full animate-pulse rounded-2xl bg-zinc-200" />
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<HomeFallback />}>
      <HomeContent />
    </Suspense>
  );
}
