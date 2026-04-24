import { Suspense } from "react";
import { AnimalDetailContent } from "@/components/animal/AnimalDetailContent";
import { bottomTabBarContentPaddingClass } from "@/components/layout/BottomTabBar";

function AnimalDetailFallback() {
  return (
    <main
      className={`mx-auto flex w-full max-w-lg flex-1 flex-col ${bottomTabBarContentPaddingClass}`}
    >
      <div className="flex h-12 items-center border-b border-zinc-100 px-4">
        <div className="h-4 w-20 animate-pulse rounded bg-zinc-200" />
      </div>
      <div className="aspect-[4/3] w-full animate-pulse bg-zinc-200" />
      <div className="space-y-4 p-4">
        <div className="h-7 w-3/5 animate-pulse rounded-xl bg-zinc-200" />
        <div className="h-4 w-2/5 animate-pulse rounded bg-zinc-200" />
        <div className="h-24 w-full animate-pulse rounded-2xl bg-zinc-200" />
        <div className="h-24 w-full animate-pulse rounded-2xl bg-zinc-200" />
      </div>
    </main>
  );
}

export default async function AnimalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <Suspense fallback={<AnimalDetailFallback />}>
      <AnimalDetailContent id={id} />
    </Suspense>
  );
}
