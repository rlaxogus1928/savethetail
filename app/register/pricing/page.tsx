"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { usePricingConfig } from "@/lib/config";
import { PaymentButton, formatWon } from "@/components/payment/PaymentButton";
import { bottomTabBarContentPaddingClass } from "@/components/layout/BottomTabBar";

function PricingContent() {
  const params = useSearchParams();
  const router = useRouter();
  const animalId = params.get("animalId");
  const { data, loading, error } = usePricingConfig();

  const paidPlans = data?.plans.filter((p) => p.price > 0) ?? [];

  return (
    <main
      className={`mx-auto flex min-h-full w-full max-w-lg flex-col gap-6 px-4 py-6 ${bottomTabBarContentPaddingClass}`}
    >
      <header>
        <h1 className="text-xl font-bold text-zinc-900">요금제 선택</h1>
        <p className="mt-1 text-sm text-zinc-600">
          공고를 노출할 기간을 선택해 주세요.
          금액은 Firebase config에서 불러온 값만 사용됩니다.
        </p>
      </header>

      {!animalId ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          공고 ID가 없습니다. 등록 폼에서 다시 시도해 주세요.
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-3">
          <div className="h-28 animate-pulse rounded-2xl bg-zinc-200" />
          <div className="h-28 animate-pulse rounded-2xl bg-zinc-200" />
          <div className="h-28 animate-pulse rounded-2xl bg-zinc-200" />
        </div>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error.message}
        </p>
      ) : null}

      {!loading && paidPlans.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {paidPlans.map((plan) => (
            <li key={plan.id}>
              <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm ring-1 ring-black/5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-zinc-900">{plan.label}</p>
                    <p className="text-xs text-zinc-500">노출 {plan.days}일</p>
                  </div>
                  <p className="text-lg font-bold tabular-nums text-[#1a2744]">
                    {formatWon(plan.price)}원
                  </p>
                </div>
                {animalId ? (
                  <PaymentButton
                    animalId={animalId}
                    type="plan"
                    itemId={plan.id}
                    label={`${plan.label} 결제하기`}
                    amount={plan.price}
                    className="w-full rounded-xl bg-[#1a2744] py-3 text-sm font-semibold text-white disabled:opacity-40"
                  />
                ) : (
                  <button
                    type="button"
                    disabled
                    className="w-full rounded-xl bg-[#1a2744] py-3 text-sm font-semibold text-white opacity-40"
                  >
                    {plan.label} 결제하기
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-col gap-2 pt-2">
        <button
          type="button"
          onClick={() => router.push("/register")}
          className="rounded-xl border border-zinc-300 bg-white py-3 text-center text-sm font-semibold text-zinc-800"
        >
          등록 폼으로 돌아가기
        </button>
      </div>
    </main>
  );
}

export default function RegisterPricingPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-full w-full max-w-lg flex-col gap-6 px-4 py-6">
          <div className="space-y-3">
            <div className="h-8 w-1/2 animate-pulse rounded-xl bg-zinc-200" />
            <div className="h-28 animate-pulse rounded-2xl bg-zinc-200" />
            <div className="h-28 animate-pulse rounded-2xl bg-zinc-200" />
          </div>
        </main>
      }
    >
      <PricingContent />
    </Suspense>
  );
}
