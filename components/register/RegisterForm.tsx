"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { signInAnonymously } from "firebase/auth";
import { Timestamp } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import PortOne from "@portone/browser-sdk/v2";
import { auth, storage } from "@/lib/firebase";
import {
  createAnimal,
  createUser,
  getUser,
  incrementUserRegisteredCount,
} from "@/lib/firestore";
import type { User } from "@/lib/firestore";
import { useCompletionScore } from "@/lib/hooks/useCompletionScore";
import { bottomTabBarContentPaddingClass } from "@/components/layout/BottomTabBar";
import { VerificationModal } from "@/components/register/VerificationModal";

const STEPS = [
  { id: 1, title: "기본 정보", desc: "이름 · 종류 · 나이 · 성별" },
  { id: 2, title: "사진", desc: "최대 5장" },
  { id: 3, title: "상세 정보", desc: "성격 · 건강 · 중성화 · 파양 사유" },
] as const;

type SpeciesCode = "dog" | "cat" | "other";

function speciesKorean(code: SpeciesCode): string {
  switch (code) {
    case "dog":
      return "강아지";
    case "cat":
      return "고양이";
    case "other":
      return "기타";
  }
}

type PhotoItem = { file: File; blobUrl: string };

function CompletionGauge({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const barClass =
    pct < 40 ? "bg-orange-500" : pct < 70 ? "bg-yellow-400" : "bg-green-500";
  const textClass =
    pct < 40 ? "text-orange-700" : pct < 70 ? "text-yellow-800" : "text-green-800";

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-zinc-700">공고 완성도</span>
        <span className={`text-lg font-bold tabular-nums ${textClass}`}>
          {pct}%
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-black/10">
        <div
          className={`h-full rounded-full transition-[width,background-color] duration-300 ease-out ${barClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function StepIndicator({ current }: { current: number }) {
  return (
    <ol className="flex items-center justify-center gap-1 px-2 sm:gap-2">
      {STEPS.map((s, i) => {
        const active = s.id === current;
        const done = s.id < current;
        return (
          <li key={s.id} className="flex items-center">
            {i > 0 ? (
              <span
                className={`mx-1 h-px w-4 sm:w-8 ${done || active ? "bg-[#1a2744]" : "bg-zinc-200"}`}
                aria-hidden
              />
            ) : null}
            <div
              className={`flex min-w-0 flex-col items-center gap-0.5 ${
                active ? "text-[#1a2744]" : done ? "text-zinc-600" : "text-zinc-400"
              }`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                  active
                    ? "bg-[#1a2744] text-white"
                    : done
                      ? "bg-zinc-200 text-zinc-800"
                      : "bg-zinc-100 text-zinc-500"
                }`}
              >
                {s.id}
              </span>
              <span className="hidden max-w-[5.5rem] truncate text-center text-[10px] font-medium sm:block">
                {s.title}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

async function uploadAnimalPhotos(
  items: PhotoItem[],
  userId: string,
): Promise<string[]> {
  const urls: string[] = [];
  for (let i = 0; i < items.length; i++) {
    const { file } = items[i]!;
    const safe = file.name.replace(/[^\w.\-가-힣]/g, "_");
    const path = `animals/${userId}/${Date.now()}_${i}_${safe}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    urls.push(await getDownloadURL(storageRef));
  }
  return urls;
}

export function RegisterForm() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  const [name, setName] = useState("");
  const [speciesCode, setSpeciesCode] = useState<SpeciesCode | "">("");
  const [ageStr, setAgeStr] = useState("");
  const [gender, setGender] = useState("");

  const [photos, setPhotos] = useState<PhotoItem[]>([]);

  const [personality, setPersonality] = useState("");
  const [health, setHealth] = useState("");
  const [neuter, setNeuter] = useState<"" | "done" | "pending">("");
  const [surrenderReason, setSurrenderReason] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [gateLoading, setGateLoading] = useState(true);
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const photosRef = useRef(photos);
  photosRef.current = photos;
  useEffect(() => {
    return () => {
      photosRef.current.forEach((p) => URL.revokeObjectURL(p.blobUrl));
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!auth.currentUser) {
          await signInAnonymously(auth);
        }
        const uid = auth.currentUser?.uid;
        if (!uid) throw new Error("로그인에 실패했습니다.");
        let u = await getUser(uid);
        if (!u) {
          await createUser(uid, {
            phone: "",
            isVerified: false,
            plan: "free",
            registeredCount: 0,
            role: "user",
          });
          u = await getUser(uid);
        }
        if (!cancelled) setProfileUser(u);
      } catch (e) {
        if (!cancelled) {
          setFormError(
            e instanceof Error ? e.message : "사용자 정보를 불러오지 못했습니다.",
          );
        }
      } finally {
        if (!cancelled) setGateLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (gateLoading || !profileUser) return;
    if (profileUser.isVerified && profileUser.registeredCount >= 1) {
      router.replace("/register/pricing");
    }
  }, [gateLoading, profileUser, router]);

  const completionInput = useMemo(
    () => ({
      photos: photos.map((p) => p.blobUrl),
      name,
      age: ageStr.trim() === "" ? null : Number(ageStr),
      personality,
      health,
      neuter: neuter === "" ? null : neuter,
      surrenderReason,
    }),
    [photos, name, ageStr, personality, health, neuter, surrenderReason],
  );

  const { score, missingFields } = useCompletionScore(completionInput);

  const step1Valid =
    name.trim().length > 0 &&
    speciesCode !== "" &&
    ageStr.trim() !== "" &&
    !Number.isNaN(Number(ageStr)) &&
    Number(ageStr) >= 0 &&
    gender !== "";

  function addPhotoFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    setPhotos((prev) => {
      const slots = 5 - prev.length;
      if (slots <= 0) return prev;
      const incoming = Array.from(fileList).slice(0, slots);
      return [
        ...prev,
        ...incoming.map((file) => ({
          file,
          blobUrl: URL.createObjectURL(file),
        })),
      ];
    });
  }

  function removePhotoAt(index: number) {
    setPhotos((prev) => {
      const next = [...prev];
      const removed = next.splice(index, 1)[0];
      if (removed) URL.revokeObjectURL(removed.blobUrl);
      return next;
    });
  }

  const runPortOneVerification = useCallback(async () => {
    setVerifyBusy(true);
    setVerifyError(null);
    try {
      const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID;
      const channelKey = process.env.NEXT_PUBLIC_PORTONE_IDENTITY_CHANNEL_KEY;
      if (!storeId || !channelKey) {
        throw new Error(
          "NEXT_PUBLIC_PORTONE_STORE_ID / NEXT_PUBLIC_PORTONE_IDENTITY_CHANNEL_KEY 를 설정해 주세요.",
        );
      }
      const identityVerificationId = `identity-verification-${crypto.randomUUID()}`;
      const response = await PortOne.requestIdentityVerification({
        storeId,
        identityVerificationId,
        channelKey,
      });
      if (response && response.code !== undefined) {
        throw new Error(response.message ?? "본인인증이 완료되지 않았습니다.");
      }
      const user = auth.currentUser;
      if (!user) throw new Error("로그인 상태가 아닙니다.");
      const idToken = await user.getIdToken();
      const res = await fetch("/api/identity-verification/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ identityVerificationId }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(payload.error ?? "서버에서 본인인증 처리에 실패했습니다.");
      }
      const u = await getUser(user.uid);
      setProfileUser(u);
      if (u && u.registeredCount >= 1) {
        router.push("/register/pricing");
      }
    } catch (e) {
      setVerifyError(e instanceof Error ? e.message : String(e));
    } finally {
      setVerifyBusy(false);
    }
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (step !== 3 || score < 40 || submitting) return;
    if (!profileUser?.isVerified) {
      setFormError("본인인증을 완료해 주세요.");
      return;
    }
    if (profileUser.registeredCount >= 1) {
      router.push("/register/pricing");
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error("로그인이 필요합니다.");
      const photoUrls =
        photos.length > 0 ? await uploadAnimalPhotos(photos, uid) : [];

      const ageNum = Number(ageStr);
      await createAnimal({
        userId: uid,
        name: name.trim(),
        species: speciesKorean(speciesCode as SpeciesCode),
        speciesCode: speciesCode as SpeciesCode,
        gender,
        age: ageNum,
        photos: photoUrls,
        completionScore: score,
        matchScore: 50,
        status: "open",
        personality: personality.trim() || undefined,
        health: health.trim() || undefined,
        surrenderReason: surrenderReason.trim() || undefined,
        neuterStatus: neuter === "" ? undefined : neuter,
        createdAt: Timestamp.now(),
        expiresAt: Timestamp.fromMillis(
          Date.now() + 14 * 24 * 60 * 60 * 1000,
        ),
      });
      await incrementUserRegisteredCount(uid);
      router.push("/");
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "등록에 실패했습니다.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const lowCompletion = score < 40;
  const showVerifyModal =
    !gateLoading && !!profileUser && !profileUser.isVerified;

  if (gateLoading) {
    return (
      <div
        className={`mx-auto flex min-h-full w-full max-w-lg flex-col gap-4 px-4 py-8 ${bottomTabBarContentPaddingClass}`}
      >
        <div className="h-10 animate-pulse rounded-lg bg-zinc-200" />
        <div className="h-24 animate-pulse rounded-2xl bg-zinc-200" />
        <div className="h-40 animate-pulse rounded-2xl bg-zinc-200" />
      </div>
    );
  }

  return (
    <>
      <VerificationModal
        open={showVerifyModal}
        busy={verifyBusy}
        error={verifyError}
        onVerify={runPortOneVerification}
      />
      <div
        className={`mx-auto flex min-h-full w-full max-w-lg flex-col ${bottomTabBarContentPaddingClass} ${showVerifyModal ? "pointer-events-none opacity-40" : ""}`}
      >
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-zinc-50/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-zinc-50/80">
        <CompletionGauge score={score} />
      </header>

      <div className="border-b border-zinc-100 bg-white px-4 py-3">
        <StepIndicator current={step} />
        <p className="mt-2 text-center text-xs text-zinc-500">
          {STEPS[step - 1]?.desc}
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-1 flex-col gap-4 px-4 py-4"
      >
        {lowCompletion ? (
          <div
            role="status"
            className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          >
            <p className="font-semibold text-amber-900">
              이 항목을 추가하면 매칭률이 올라요!
            </p>
            {missingFields.length > 0 ? (
              <ul className="mt-2 list-inside list-disc space-y-0.5 text-amber-900/90">
                {missingFields.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {formError ? (
          <div
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
          >
            {formError}
          </div>
        ) : null}

        {step === 1 ? (
          <section className="space-y-4" aria-labelledby="step1-title">
            <h2 id="step1-title" className="text-lg font-semibold text-zinc-900">
              기본 정보
            </h2>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-zinc-700">이름</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-zinc-900 outline-none ring-[#1a2744]/20 focus:ring-2"
                placeholder="이름을 입력하세요"
                autoComplete="off"
              />
            </label>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-zinc-700">종류</legend>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["dog", "강아지"],
                    ["cat", "고양이"],
                    ["other", "기타"],
                  ] as const
                ).map(([code, label]) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setSpeciesCode(code)}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                      speciesCode === code
                        ? "bg-[#1a2744] text-white"
                        : "bg-zinc-100 text-zinc-800 ring-1 ring-black/5 hover:bg-zinc-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-zinc-700">나이</span>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={ageStr}
                onChange={(e) => setAgeStr(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-zinc-900 outline-none focus:ring-2 focus:ring-[#1a2744]/20"
                placeholder="0"
              />
            </label>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-zinc-700">성별</legend>
              <div className="flex flex-wrap gap-2">
                {(["수컷", "암컷", "알 수 없음"] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(g)}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                      gender === g
                        ? "bg-[#1a2744] text-white"
                        : "bg-zinc-100 text-zinc-800 ring-1 ring-black/5 hover:bg-zinc-200"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </fieldset>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="space-y-4" aria-labelledby="step2-title">
            <h2 id="step2-title" className="text-lg font-semibold text-zinc-900">
              사진 업로드
            </h2>
            <p className="text-sm text-zinc-600">
              Firebase Storage에 저장됩니다. 최대 5장까지 등록할 수 있어요.
            </p>
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center transition-colors hover:border-zinc-400 hover:bg-zinc-100">
              <span className="text-sm font-medium text-zinc-700">
                사진 선택 ({photos.length}/5)
              </span>
              <span className="mt-1 text-xs text-zinc-500">
                JPG, PNG, WEBP 등
              </span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={(e) => {
                  addPhotoFiles(e.target.files);
                  e.target.value = "";
                }}
                disabled={photos.length >= 5}
              />
            </label>
            {photos.length > 0 ? (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {photos.map((p, i) => (
                  <li
                    key={`${p.blobUrl}-${i}`}
                    className="relative aspect-square overflow-hidden rounded-xl bg-zinc-200 ring-1 ring-black/5"
                  >
                    <Image
                      src={p.blobUrl}
                      alt={`미리보기 ${i + 1}`}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                    <button
                      type="button"
                      onClick={() => removePhotoAt(i)}
                      className="absolute right-1 top-1 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white backdrop-blur-sm"
                    >
                      삭제
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}

        {step === 3 ? (
          <section className="space-y-4" aria-labelledby="step3-title">
            <h2 id="step3-title" className="text-lg font-semibold text-zinc-900">
              상세 정보
            </h2>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-zinc-700">
                성격 설명
                <span className="font-normal text-zinc-500">
                  {" "}
                  (50자 이상 권장)
                </span>
              </span>
              <textarea
                value={personality}
                onChange={(e) => setPersonality(e.target.value)}
                rows={5}
                className="w-full resize-y rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-zinc-900 outline-none focus:ring-2 focus:ring-[#1a2744]/20"
                placeholder="성격, 사람·동물과의 관계 등을 적어 주세요."
              />
              <span className="text-xs text-zinc-500">
                {personality.trim().length}자
              </span>
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-zinc-700">건강 상태</span>
              <textarea
                value={health}
                onChange={(e) => setHealth(e.target.value)}
                rows={3}
                className="w-full resize-y rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-zinc-900 outline-none focus:ring-2 focus:ring-[#1a2744]/20"
                placeholder="접종 여부, 지병, 치료 이력 등"
              />
            </label>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-zinc-700">
                중성화 여부
              </legend>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["done", "완료"],
                    ["pending", "미완료"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setNeuter(value)}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                      neuter === value
                        ? "bg-[#1a2744] text-white"
                        : "bg-zinc-100 text-zinc-800 ring-1 ring-black/5 hover:bg-zinc-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-zinc-700">파양 사유</span>
              <textarea
                value={surrenderReason}
                onChange={(e) => setSurrenderReason(e.target.value)}
                rows={4}
                className="w-full resize-y rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-zinc-900 outline-none focus:ring-2 focus:ring-[#1a2744]/20"
                placeholder="파양 사유를 구체적으로 적어 주세요."
              />
            </label>
          </section>
        ) : null}

        <div className="mt-auto flex flex-col gap-3 pt-2">
          <div className="flex gap-2">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(1, s - 1))}
                className="flex-1 rounded-xl border border-zinc-300 bg-white py-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
              >
                이전
              </button>
            ) : null}
            {step < 3 ? (
              <button
                type="button"
                onClick={() => {
                  if (step === 1 && !step1Valid) return;
                  setStep((s) => Math.min(3, s + 1));
                }}
                disabled={step === 1 && !step1Valid}
                className="flex-1 rounded-xl bg-[#1a2744] py-3 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
              >
                다음
              </button>
            ) : (
              <button
                type="submit"
                disabled={
                  score < 40 ||
                  submitting ||
                  !profileUser?.isVerified ||
                  profileUser.registeredCount >= 1
                }
                className="flex-1 rounded-xl bg-[#1a2744] py-3 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting ? "등록 중…" : "파양 공고 등록"}
              </button>
            )}
          </div>
          {step < 3 ? (
            <p className="text-center text-xs text-zinc-400">
              완성도 40% 이상이면 등록할 수 있어요.
            </p>
          ) : null}
        </div>
      </form>
    </div>
    </>
  );
}
