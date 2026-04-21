"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { signInAnonymously } from "firebase/auth";
import type { Timestamp } from "firebase/firestore";
import { auth } from "@/lib/firebase";
import {
  listAnimalsByUserId,
  listApplicationsByAnimalId,
  type Animal,
} from "@/lib/firestore";
import { getBoostById, usePricingConfig } from "@/lib/config";
import { bottomTabBarContentPaddingClass } from "@/components/layout/BottomTabBar";

type MatchLevel = "낮음" | "보통" | "높음";

function matchLevelFromCompletion(score: number): MatchLevel {
  const s = Math.max(0, Math.min(100, score));
  if (s < 40) return "낮음";
  if (s < 70) return "보통";
  return "높음";
}

function daysLeftFromExpires(expiresAt: Timestamp | null): number {
  if (!expiresAt) return 9999;
  const end = expiresAt.toDate();
  const now = new Date();
  return Math.ceil((end.getTime() - now.getTime()) / 86_400_000);
}

function statusBadgeClass(status: string): string {
  const s = status.trim().toLowerCase();
  if (s === "open" || s === "active") {
    return "border border-green-200 bg-green-50 text-green-800";
  }
  if (s === "closed" || s === "done") {
    return "border border-zinc-200 bg-zinc-100 text-zinc-700";
  }
  return "border border-blue-200 bg-blue-50 text-blue-800";
}

function formatWon(n: number): string {
  return n.toLocaleString("ko-KR");
}

type Row = {
  animal: Animal;
  applicationCount: number;
};

function SkeletonList() {
  return (
    <ul className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <li
          key={i}
          className="flex gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"
        >
          <div className="h-16 w-16 animate-pulse rounded-xl bg-zinc-200" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/2 animate-pulse rounded bg-zinc-200" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-zinc-200" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-zinc-200" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function DashboardContent() {
  const { data: pricing, loading: pricingLoading } = usePricingConfig();
  const bump = useMemo(() => getBoostById(pricing, "bump"), [pricing]);
  const top = useMemo(() => getBoostById(pricing, "top"), [pricing]);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        if (!auth.currentUser) {
          await signInAnonymously(auth);
        }
        const uid = auth.currentUser?.uid;
        if (!uid) throw new Error("로그인에 실패했습니다.");

        const animals = await listAnimalsByUserId(uid);
        const sorted = [...animals].sort(
          (a, b) => b.createdAt.toMillis() - a.createdAt.toMillis(),
        );

        const counts = await Promise.all(
          sorted.map(async (a) => {
            const apps = await listApplicationsByAnimalId(a.id);
            return apps.length;
          }),
        );

        const out: Row[] = sorted.map((animal, idx) => ({
          animal,
          applicationCount: counts[idx] ?? 0,
        }));

        if (!cancelled) setRows(out);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const showEmpty = !loading && !error && rows.length === 0;

  return (
    <main
      className={`mx-auto flex min-h-full w-full max-w-lg flex-1 flex-col gap-5 px-4 py-6 ${bottomTabBarContentPaddingClass}`}
    >
      <header className="space-y-1">
        <h1 className="text-xl font-bold text-zinc-900">내 공고 대시보드</h1>
        <p className="text-sm text-zinc-500">
          조회수·신청수·남은 기간을 한 번에 확인하세요.
        </p>
      </header>

      {error ? (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
        >
          {error}
        </div>
      ) : null}

      {loading ? <SkeletonList /> : null}

      {showEmpty ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-white px-6 py-14 text-center">
          <p className="text-lg font-semibold text-zinc-800">
            아직 등록한 공고가 없어요
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            첫 공고를 등록하면 대시보드가 채워집니다.
          </p>
          <Link
            href="/register"
            className="mt-5 inline-flex rounded-xl bg-[#1a2744] px-5 py-3 text-sm font-semibold text-white"
          >
            공고 등록하기
          </Link>
        </div>
      ) : null}

      {!loading && rows.length > 0 ? (
        <ul className="space-y-3">
          {rows.map(({ animal, applicationCount }) => {
            const thumb = animal.photos[0] ?? "/file.svg";
            const level = matchLevelFromCompletion(animal.completionScore);
            const low = level === "낮음";
            const dLeft = daysLeftFromExpires(animal.expiresAt);

            return (
              <li
                key={animal.id}
                className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"
              >
                <div className="flex gap-3">
                  <Link
                    href={`/animal/${animal.id}`}
                    className="relative h-16 w-16 overflow-hidden rounded-xl bg-zinc-200 ring-1 ring-black/5"
                  >
                    <Image
                      src={thumb}
                      alt={`${animal.name} 썸네일`}
                      fill
                      className="object-cover"
                      sizes="64px"
                      unoptimized
                    />
                  </Link>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-zinc-900">
                          {animal.name || "이름 없음"}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-zinc-500">
                          {animal.species}
                          {animal.location || animal.region
                            ? ` · ${animal.location ?? animal.region}`
                            : ""}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(
                          animal.status,
                        )}`}
                      >
                        {animal.status || "status"}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-xl bg-zinc-50 px-2 py-2">
                        <p className="text-[11px] font-medium text-zinc-500">
                          조회수
                        </p>
                        <p className="mt-0.5 text-sm font-bold tabular-nums text-zinc-900">
                          {animal.viewCount ?? 0}
                        </p>
                      </div>
                      <div className="rounded-xl bg-zinc-50 px-2 py-2">
                        <p className="text-[11px] font-medium text-zinc-500">
                          신청수
                        </p>
                        <p className="mt-0.5 text-sm font-bold tabular-nums text-zinc-900">
                          {applicationCount}
                        </p>
                      </div>
                      <div className="rounded-xl bg-zinc-50 px-2 py-2">
                        <p className="text-[11px] font-medium text-zinc-500">
                          남은 기간
                        </p>
                        <p className="mt-0.5 text-sm font-bold tabular-nums text-zinc-900">
                          {dLeft >= 9999 ? "-" : dLeft <= 0 ? "마감" : `${dLeft}일`}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <p className="text-xs text-zinc-500">매칭 확률 지수</p>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          level === "낮음"
                            ? "border border-orange-200 bg-orange-100 text-orange-900"
                            : level === "보통"
                              ? "border border-yellow-200 bg-yellow-100 text-yellow-900"
                              : "border border-green-200 bg-green-100 text-green-900"
                        }`}
                      >
                        {level}
                      </span>
                    </div>
                  </div>
                </div>

                {low ? (
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-semibold text-amber-900">
                      매칭 확률이 낮아요. 노출을 올려보세요.
                    </p>
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <button
                        type="button"
                        className="rounded-xl bg-[#1a2744] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                        disabled={pricingLoading || !bump}
                        title={
                          bump
                            ? `${bump.label} · ${formatWon(bump.price)}원`
                            : "가격 정보를 불러오는 중"
                        }
                      >
                        끌어올리기
                        {bump ? (
                          <span className="ml-1 text-xs font-medium text-white/80">
                            ({formatWon(bump.price)}원)
                          </span>
                        ) : null}
                      </button>
                      <button
                        type="button"
                        className="rounded-xl bg-[#1a2744] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                        disabled={pricingLoading || !top}
                        title={
                          top
                            ? `${top.label} · ${formatWon(top.price)}원`
                            : "가격 정보를 불러오는 중"
                        }
                      >
                        상단 노출
                        {top ? (
                          <span className="ml-1 text-xs font-medium text-white/80">
                            ({formatWon(top.price)}원)
                          </span>
                        ) : null}
                      </button>
                      <Link
                        href="/register"
                        className="rounded-xl border border-amber-200 bg-white px-4 py-2.5 text-center text-sm font-semibold text-amber-900"
                      >
                        프로필 보완하기
                      </Link>
                    </div>
                    <p className="mt-2 text-xs text-amber-900/80">
                      가격은 Firebase config에서 불러온 값만 사용합니다.
                    </p>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </main>
  );
}

