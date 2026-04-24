"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { signInAnonymously } from "firebase/auth";
import type { Timestamp } from "firebase/firestore";
import { auth } from "@/lib/firebase";
import {
  getUser,
  updateUser,
  listAnimalsByUserId,
  listApplicationsByAnimalId,
  type Animal,
  type Application,
} from "@/lib/firestore";
import { getBoostById, usePricingConfig } from "@/lib/config";
import { bottomTabBarContentPaddingClass } from "@/components/layout/BottomTabBar";
import { PaymentButton } from "@/components/payment/PaymentButton";

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
  if (s === "open" || s === "active") return "border border-green-200 bg-green-50 text-green-800";
  if (s === "closed" || s === "done") return "border border-zinc-200 bg-zinc-100 text-zinc-700";
  return "border border-blue-200 bg-blue-50 text-blue-800";
}

function applicationStatusLabel(status: string): { label: string; cls: string } {
  if (status === "accepted") return { label: "수락", cls: "bg-green-100 text-green-800" };
  if (status === "rejected") return { label: "거절", cls: "bg-zinc-100 text-zinc-600" };
  return { label: "검토 중", cls: "bg-blue-100 text-blue-800" };
}

function formatWon(n: number): string {
  return n.toLocaleString("ko-KR");
}

type Row = {
  animal: Animal;
  applications: Application[];
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
  const [respondingIds, setRespondingIds] = useState<Set<string>>(new Set());
  const [expandedAnimalIds, setExpandedAnimalIds] = useState<Set<string>>(new Set());

  // 알림 이메일 설정
  const [profileEmail, setProfileEmail] = useState("");
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailDraft, setEmailDraft] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailSaveError, setEmailSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        if (!auth.currentUser) await signInAnonymously(auth);
        const uid = auth.currentUser?.uid;
        if (!uid) throw new Error("로그인에 실패했습니다.");

        const [animals, user] = await Promise.all([
          listAnimalsByUserId(uid),
          getUser(uid),
        ]);
        if (!cancelled && user?.email) setProfileEmail(user.email);
        const sorted = [...animals].sort(
          (a, b) => b.createdAt.toMillis() - a.createdAt.toMillis(),
        );

        const appLists = await Promise.all(
          sorted.map((a) => listApplicationsByAnimalId(a.id)),
        );

        const out: Row[] = sorted.map((animal, idx) => ({
          animal,
          applications: appLists[idx] ?? [],
        }));

        if (!cancelled) setRows(out);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  async function handleSaveEmail() {
    const trimmed = emailDraft.trim().toLowerCase();
    if (trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailSaveError("올바른 이메일 형식을 입력해 주세요.");
      return;
    }
    setSavingEmail(true);
    setEmailSaveError(null);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("로그인이 필요합니다.");
      // email을 undefined로 업데이트하면 필드가 삭제됨 — 빈값은 null 처리
      await updateUser(user.uid, { email: trimmed || undefined });
      setProfileEmail(trimmed);
      setEditingEmail(false);
    } catch (e) {
      setEmailSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingEmail(false);
    }
  }

  const handleRespond = useCallback(
    async (applicationId: string, action: "accept" | "reject") => {
      if (respondingIds.has(applicationId)) return;
      setRespondingIds((prev) => new Set(prev).add(applicationId));

      try {
        const user = auth.currentUser;
        if (!user) throw new Error("로그인이 필요합니다.");
        const idToken = await user.getIdToken();

        const res = await fetch("/api/application/respond", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ applicationId, action }),
        });

        const data = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(data.error ?? "처리에 실패했습니다.");

        // 로컬 상태 낙관적 업데이트
        setRows((prev) =>
          prev.map((row) => ({
            ...row,
            applications: row.applications.map((app) =>
              app.id === applicationId
                ? { ...app, status: action === "accept" ? "accepted" : "rejected" }
                : app,
            ),
          })),
        );
      } catch (e) {
        alert(e instanceof Error ? e.message : String(e));
      } finally {
        setRespondingIds((prev) => {
          const next = new Set(prev);
          next.delete(applicationId);
          return next;
        });
      }
    },
    [respondingIds],
  );

  function toggleExpand(animalId: string) {
    setExpandedAnimalIds((prev) => {
      const next = new Set(prev);
      if (next.has(animalId)) next.delete(animalId);
      else next.add(animalId);
      return next;
    });
  }

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

      {/* 알림 이메일 설정 */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm ring-1 ring-black/5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-zinc-800">알림 이메일</p>
            <p className="mt-0.5 text-xs text-zinc-400">
              입양 신청 알림 등에 사용되며 외부에 공개되지 않습니다.
            </p>
          </div>
          {!editingEmail ? (
            <button
              type="button"
              onClick={() => {
                setEmailDraft(profileEmail);
                setEmailSaveError(null);
                setEditingEmail(true);
              }}
              className="shrink-0 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
            >
              {profileEmail ? "수정" : "등록"}
            </button>
          ) : null}
        </div>

        {!editingEmail ? (
          <p className="mt-2 text-sm text-zinc-700">
            {profileEmail || (
              <span className="text-zinc-400">미설정</span>
            )}
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            <input
              type="email"
              value={emailDraft}
              onChange={(e) => setEmailDraft(e.target.value)}
              disabled={savingEmail}
              placeholder="example@email.com"
              autoComplete="email"
              className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-[#1a2744] focus:ring-1 focus:ring-[#1a2744] disabled:opacity-60"
            />
            {emailSaveError ? (
              <p className="text-xs text-red-600">{emailSaveError}</p>
            ) : null}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditingEmail(false);
                  setEmailSaveError(null);
                }}
                disabled={savingEmail}
                className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-sm font-medium text-zinc-700 disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSaveEmail}
                disabled={savingEmail}
                className="flex-1 rounded-xl bg-[#1a2744] py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {savingEmail ? "저장 중…" : "저장"}
              </button>
            </div>
          </div>
        )}
      </div>

      {error ? (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </div>
      ) : null}

      {loading ? <SkeletonList /> : null}

      {showEmpty ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-white px-6 py-14 text-center">
          <p className="text-lg font-semibold text-zinc-800">아직 등록한 공고가 없어요</p>
          <p className="mt-1 text-sm text-zinc-500">첫 공고를 등록하면 대시보드가 채워집니다.</p>
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
          {rows.map(({ animal, applications }) => {
            const thumb = animal.photos[0] ?? "/file.svg";
            const level = matchLevelFromCompletion(animal.completionScore);
            const low = level === "낮음";
            const dLeft = daysLeftFromExpires(animal.expiresAt);
            const pendingApps = applications.filter((a) => a.status === "pending");
            const isExpanded = expandedAnimalIds.has(animal.id);

            return (
              <li key={animal.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
                {/* 공고 기본 정보 */}
                <div className="flex gap-3">
                  <Link
                    href={`/animal/${animal.id}`}
                    className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-zinc-200 ring-1 ring-black/5"
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
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(animal.status)}`}
                      >
                        {animal.status || "status"}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-xl bg-zinc-50 px-2 py-2">
                        <p className="text-[11px] font-medium text-zinc-500">조회수</p>
                        <p className="mt-0.5 text-sm font-bold tabular-nums text-zinc-900">
                          {animal.viewCount ?? 0}
                        </p>
                      </div>
                      <div className="rounded-xl bg-zinc-50 px-2 py-2">
                        <p className="text-[11px] font-medium text-zinc-500">신청수</p>
                        <p className="mt-0.5 text-sm font-bold tabular-nums text-zinc-900">
                          {applications.length}
                        </p>
                      </div>
                      <div className="rounded-xl bg-zinc-50 px-2 py-2">
                        <p className="text-[11px] font-medium text-zinc-500">남은 기간</p>
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

                {/* 부스트 섹션 */}
                {low ? (
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-semibold text-amber-900">
                      매칭 확률이 낮아요. 노출을 올려보세요.
                    </p>
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                      {bump ? (
                        <PaymentButton
                          animalId={animal.id}
                          type="bump"
                          itemId="bump"
                          label={`끌어올리기 (${formatWon(bump.price)}원)`}
                          amount={bump.price}
                          className="rounded-xl bg-[#1a2744] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                        />
                      ) : (
                        <button type="button" disabled className="rounded-xl bg-[#1a2744] px-4 py-2.5 text-sm font-semibold text-white opacity-40">
                          끌어올리기
                        </button>
                      )}
                      {top ? (
                        <PaymentButton
                          animalId={animal.id}
                          type="top"
                          itemId="top"
                          label={`상단 노출 (${formatWon(top.price)}원)`}
                          amount={top.price}
                          className="rounded-xl bg-[#1a2744] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                        />
                      ) : (
                        <button type="button" disabled className="rounded-xl bg-[#1a2744] px-4 py-2.5 text-sm font-semibold text-white opacity-40">
                          상단 노출
                        </button>
                      )}
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

                {/* 입양 신청 목록 */}
                {applications.length > 0 ? (
                  <div className="mt-4 border-t border-zinc-100 pt-4">
                    <button
                      type="button"
                      onClick={() => toggleExpand(animal.id)}
                      className="flex w-full items-center justify-between text-sm font-semibold text-zinc-800"
                    >
                      <span>
                        입양 신청
                        <span className="ml-1.5 rounded-full bg-[#1a2744] px-2 py-0.5 text-xs font-semibold text-white">
                          {applications.length}
                        </span>
                        {pendingApps.length > 0 ? (
                          <span className="ml-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                            검토 중 {pendingApps.length}
                          </span>
                        ) : null}
                      </span>
                      <svg
                        className={`h-4 w-4 text-zinc-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {isExpanded ? (
                      <ul className="mt-3 flex flex-col gap-3">
                        {applications.map((app) => {
                          const { label, cls } = applicationStatusLabel(app.status);
                          const isBusy = respondingIds.has(app.id);

                          return (
                            <li
                              key={app.id}
                              className="rounded-xl border border-zinc-100 bg-zinc-50 p-3"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-zinc-900">
                                    {app.applicantName || "이름 없음"}
                                  </p>
                                  <p className="mt-0.5 truncate text-xs text-zinc-500">
                                    {app.applicantEmail}
                                  </p>
                                </div>
                                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
                                  {label}
                                </span>
                              </div>

                              {app.message ? (
                                <p className="mt-2 text-xs leading-relaxed text-zinc-600 line-clamp-3">
                                  {app.message}
                                </p>
                              ) : null}

                              {app.status === "pending" ? (
                                <div className="mt-3 flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleRespond(app.id, "accept")}
                                    disabled={isBusy}
                                    className="flex-1 rounded-lg bg-[#1a2744] py-2 text-xs font-semibold text-white disabled:opacity-50"
                                  >
                                    {isBusy ? "처리 중…" : "수락"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRespond(app.id, "reject")}
                                    disabled={isBusy}
                                    className="flex-1 rounded-lg border border-zinc-200 bg-white py-2 text-xs font-semibold text-zinc-700 disabled:opacity-50"
                                  >
                                    {isBusy ? "처리 중…" : "거절"}
                                  </button>
                                </div>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
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
