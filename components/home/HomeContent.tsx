"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  DocumentData,
  QueryDocumentSnapshot,
  Timestamp,
} from "firebase/firestore";
import { useSearchParams } from "next/navigation";
import { AnimalCard, type MatchScoreLevel } from "@/components/ui/AnimalCard";
import { FilterBar } from "@/components/ui/FilterBar";
import { bottomTabBarContentPaddingClass } from "@/components/layout/BottomTabBar";
import {
  listAnimalsPage,
  type Animal,
  type AnimalListFilters,
} from "@/lib/firestore";

const PAGE_SIZE = 10;

function matchLevel(score: number): MatchScoreLevel {
  const s = Math.max(0, Math.min(100, score));
  if (s < 40) return "낮음";
  if (s < 70) return "보통";
  return "높음";
}

function speciesLabel(animal: Animal): string {
  if (animal.species.trim()) return animal.species;
  switch (animal.speciesCode) {
    case "dog":
      return "강아지";
    case "cat":
      return "고양이";
    case "other":
      return "기타";
    default:
      return "기타";
  }
}

function daysLeftFromExpires(expiresAt: Timestamp | null): number {
  if (!expiresAt) return 9999;
  const end = expiresAt.toDate();
  const now = new Date();
  return Math.ceil((end.getTime() - now.getTime()) / 86_400_000);
}

function toCardProps(animal: Animal) {
  const photoUrl =
    animal.photos[0] ?? "/file.svg";
  const location =
    animal.location?.trim() ||
    animal.region?.trim() ||
    "위치 미정";
  return {
    id: animal.id,
    name: animal.name || "이름 없음",
    species: speciesLabel(animal),
    age: `${animal.age}세`,
    photoUrl,
    completionScore: animal.completionScore,
    matchScore: matchLevel(animal.matchScore),
    location,
    daysLeft: daysLeftFromExpires(animal.expiresAt),
  };
}

function filtersFromSearchParams(searchParams: URLSearchParams): AnimalListFilters {
  const species = searchParams.get("species")?.trim() ?? "";
  const neuter = searchParams.get("neuter")?.trim() ?? "";
  const vaccine = searchParams.get("vaccine")?.trim() ?? "";
  const region = searchParams.get("region")?.trim() ?? "";
  return {
    ...(species ? { species } : {}),
    ...(neuter ? { neuter } : {}),
    ...(vaccine ? { vaccine } : {}),
    ...(region ? { region } : {}),
  };
}

function FeedSkeleton() {
  return (
    <ul className="grid gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <li
          key={i}
          className="overflow-hidden rounded-2xl bg-[#f5f0e8] shadow-sm ring-1 ring-black/5"
        >
          <div className="aspect-[4/3] w-full animate-pulse bg-zinc-200" />
          <div className="space-y-3 p-4">
            <div className="flex justify-between gap-2">
              <div className="h-6 w-2/5 animate-pulse rounded bg-zinc-200" />
              <div className="h-5 w-16 animate-pulse rounded-full bg-zinc-200" />
            </div>
            <div className="h-4 w-3/5 animate-pulse rounded bg-zinc-200" />
            <div className="space-y-2">
              <div className="h-3 w-16 animate-pulse rounded bg-zinc-200" />
              <div className="h-2.5 w-full animate-pulse rounded-full bg-zinc-200" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function HomeContent() {
  const searchParams = useSearchParams();
  const filterKey = searchParams.toString();

  const filters = useMemo(
    () => filtersFromSearchParams(new URLSearchParams(filterKey)),
    [filterKey],
  );

  const [animals, setAnimals] = useState<Animal[]>([]);
  const [cursor, setCursor] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setAnimals([]);
    setCursor(null);
    setHasMore(true);
    setError(null);
    setLoading(true);

    (async () => {
      try {
        const { animals: rows, lastDoc, hasMore: hm } = await listAnimalsPage(
          filters,
          PAGE_SIZE,
          null,
        );
        if (cancelled) return;
        setAnimals(rows);
        setCursor(lastDoc);
        setHasMore(hm);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e : new Error(String(e)));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [filters]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loading || loadingMore || cursor === null) return;
    if (loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setError(null);
    try {
      const { animals: next, lastDoc, hasMore: hm } = await listAnimalsPage(
        filters,
        PAGE_SIZE,
        cursor,
      );
      setAnimals((prev) => [...prev, ...next]);
      setCursor(lastDoc);
      setHasMore(hm);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoadingMore(false);
      loadingMoreRef.current = false;
    }
  }, [cursor, filters, hasMore, loading, loadingMore]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (!first?.isIntersecting) return;
        if (!hasMore || loading || loadingMore) return;
        void loadMore();
      },
      { root: null, rootMargin: "120px", threshold: 0 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loadMore, loading, loadingMore]);

  const showSkeleton = loading && animals.length === 0;
  const showEmpty = !loading && !error && animals.length === 0;

  return (
    <main
      className={`mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-4 pt-4 ${bottomTabBarContentPaddingClass}`}
    >
      <header>
        <h1 className="text-xl font-bold text-zinc-900">입양 공고</h1>
      </header>

      <div className="sticky top-0 z-20 -mx-4 border-b border-zinc-100 bg-zinc-50/95 px-4 py-2 backdrop-blur-sm">
        <FilterBar />
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
        >
          <p className="font-medium">불러오지 못했어요</p>
          <p className="mt-1 text-red-800/90">{error.message}</p>
          <button
            type="button"
            className="mt-3 rounded-full bg-[#1a2744] px-4 py-2 text-xs font-semibold text-white"
            onClick={() => {
              setError(null);
              setLoading(true);
              setAnimals([]);
              setCursor(null);
              setHasMore(true);
              void (async () => {
                try {
                  const { animals: rows, lastDoc, hasMore: hm } =
                    await listAnimalsPage(filters, PAGE_SIZE, null);
                  setAnimals(rows);
                  setCursor(lastDoc);
                  setHasMore(hm);
                } catch (e) {
                  setError(
                    e instanceof Error ? e : new Error(String(e)),
                  );
                } finally {
                  setLoading(false);
                }
              })();
            }}
          >
            다시 시도
          </button>
        </div>
      ) : null}

      {showSkeleton ? <FeedSkeleton /> : null}

      {showEmpty ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-200 bg-white px-6 py-16 text-center">
          <p className="text-lg font-semibold text-zinc-800">
            등록된 공고가 없어요
          </p>
          <p className="text-sm text-zinc-500">
            필터를 넓히거나 나중에 다시 확인해 주세요.
          </p>
        </div>
      ) : null}

      {!showSkeleton && !showEmpty ? (
        <ul className="grid gap-4">
          {animals.map((animal) => (
            <li key={animal.id}>
              <AnimalCard {...toCardProps(animal)} />
            </li>
          ))}
        </ul>
      ) : null}

      {!loading && hasMore && animals.length > 0 ? (
        <div
          ref={sentinelRef}
          className="flex h-10 items-center justify-center text-xs text-zinc-400"
          aria-hidden
        >
          {loadingMore ? "불러오는 중…" : ""}
        </div>
      ) : null}

      {!loading && !hasMore && animals.length > 0 ? (
        <p className="pb-2 text-center text-xs text-zinc-400">
          모두 불러왔어요
        </p>
      ) : null}
    </main>
  );
}
