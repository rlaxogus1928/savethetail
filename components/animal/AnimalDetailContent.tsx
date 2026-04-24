"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { signInAnonymously } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getAnimal, type Animal } from "@/lib/firestore";
import { ApplyButton } from "@/components/application/ApplyButton";
import { bottomTabBarContentPaddingClass } from "@/components/layout/BottomTabBar";
import type { Timestamp } from "firebase/firestore";

function daysLeft(expiresAt: Timestamp | null): number {
  if (!expiresAt) return 9999;
  return Math.ceil((expiresAt.toDate().getTime() - Date.now()) / 86_400_000);
}

function badge(text: string, cls: string) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {text}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="w-20 shrink-0 text-xs font-medium text-zinc-500">{label}</span>
      <span className="text-xs text-zinc-800">{value}</span>
    </div>
  );
}

function Skeleton() {
  return (
    <main
      className={`mx-auto flex w-full max-w-lg flex-1 flex-col ${bottomTabBarContentPaddingClass}`}
    >
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

export function AnimalDetailContent({ id }: { id: string }) {
  const router = useRouter();
  const [animal, setAnimal] = useState<Animal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (!auth.currentUser) await signInAnonymously(auth);
        if (!cancelled) setCurrentUserId(auth.currentUser?.uid ?? null);

        const data = await getAnimal(id);
        if (!cancelled) {
          if (!data) setError("공고를 찾을 수 없습니다.");
          else setAnimal(data);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) return <Skeleton />;

  if (error || !animal) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="font-semibold text-red-900">{error ?? "공고를 찾을 수 없습니다."}</p>
          <button
            type="button"
            onClick={() => router.back()}
            className="mt-4 rounded-xl bg-[#1a2744] px-5 py-2.5 text-sm font-semibold text-white"
          >
            돌아가기
          </button>
        </div>
      </main>
    );
  }

  const photos = animal.photos.length > 0 ? animal.photos : ["/file.svg"];
  const left = daysLeft(animal.expiresAt);
  const isOpen = animal.status === "open";
  const isOwner = currentUserId === animal.userId;
  const canApply = isOpen && !isOwner;

  const neuterLabel =
    animal.neuterStatus === "done"
      ? "중성화 완료"
      : animal.neuterStatus === "pending"
        ? "중성화 예정"
        : null;

  const vaccineLabel =
    animal.vaccineStatus === "done"
      ? "접종 완료"
      : animal.vaccineStatus === "pending"
        ? "접종 예정"
        : null;

  return (
    <main
      className={`mx-auto flex w-full max-w-lg flex-1 flex-col ${bottomTabBarContentPaddingClass}`}
    >
      {/* 뒤로가기 헤더 */}
      <div className="sticky top-0 z-20 flex h-12 items-center border-b border-zinc-100 bg-white/95 px-4 backdrop-blur-sm">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm font-medium text-zinc-700"
          aria-label="뒤로가기"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          목록으로
        </button>
      </div>

      {/* 사진 갤러리 */}
      <div className="relative aspect-[4/3] w-full bg-zinc-200">
        <Image
          src={photos[photoIndex] ?? "/file.svg"}
          alt={`${animal.name} 사진 ${photoIndex + 1}`}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 512px"
          unoptimized
          priority
        />
        {left <= 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="rounded-full bg-white/90 px-4 py-1.5 text-sm font-bold text-zinc-800">마감</span>
          </div>
        )}
        {left > 0 && left < 9999 && (
          <div className="absolute bottom-3 right-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
            {left}일 남음
          </div>
        )}
        {photos.length > 1 && (
          <>
            <button
              type="button"
              aria-label="이전 사진"
              onClick={() => setPhotoIndex((i) => (i - 1 + photos.length) % photos.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white backdrop-blur-sm"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              aria-label="다음 사진"
              onClick={() => setPhotoIndex((i) => (i + 1) % photos.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white backdrop-blur-sm"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1">
              {photos.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPhotoIndex(i)}
                  aria-label={`사진 ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${i === photoIndex ? "w-4 bg-white" : "w-1.5 bg-white/50"}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4">
        {/* 이름 + 배지 */}
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-zinc-900">{animal.name || "이름 없음"}</h1>
            {badge(animal.species || "기타", "bg-white ring-1 ring-black/10 text-zinc-700")}
            {animal.gender ? badge(animal.gender, "bg-zinc-100 text-zinc-600") : null}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {neuterLabel ? badge(neuterLabel, "border border-blue-200 bg-blue-50 text-blue-800") : null}
            {vaccineLabel ? badge(vaccineLabel, "border border-purple-200 bg-purple-50 text-purple-800") : null}
          </div>
        </div>

        {/* 기본 정보 */}
        <div className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-zinc-800">기본 정보</h2>
          <div className="flex flex-col gap-2">
            <InfoRow label="나이" value={`${animal.age}세`} />
            {(animal.location || animal.region) ? (
              <InfoRow label="위치" value={animal.location ?? animal.region ?? ""} />
            ) : null}
            <InfoRow
              label="완성도"
              value={`${animal.completionScore}%`}
            />
          </div>
        </div>

        {/* 성격 */}
        {animal.personality ? (
          <div className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold text-zinc-800">성격</h2>
            <p className="text-sm leading-relaxed text-zinc-600">{animal.personality}</p>
          </div>
        ) : null}

        {/* 건강 상태 */}
        {animal.health ? (
          <div className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold text-zinc-800">건강 상태</h2>
            <p className="text-sm leading-relaxed text-zinc-600">{animal.health}</p>
          </div>
        ) : null}

        {/* 파양 사유 */}
        {animal.surrenderReason ? (
          <div className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold text-zinc-800">파양 사유</h2>
            <p className="text-sm leading-relaxed text-zinc-600">{animal.surrenderReason}</p>
          </div>
        ) : null}

        {/* 신청 버튼 */}
        <div className="mt-auto pt-2">
          {canApply ? (
            <ApplyButton animalId={animal.id} animalName={animal.name} />
          ) : isOwner ? (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 py-3 text-center text-sm text-zinc-500">
              내가 등록한 공고입니다
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 py-3 text-center text-sm text-zinc-500">
              현재 신청을 받지 않는 공고입니다
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
