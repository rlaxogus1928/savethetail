"use client";

import Link from "next/link";
import { usePricingConfig } from "@/lib/config";
import { bottomTabBarContentPaddingClass } from "@/components/layout/BottomTabBar";

function formatWon(n: number): string {
  return n.toLocaleString("ko-KR");
}

export default function RegisterPricingPage() {
  const { data, loading, error } = usePricingConfig();

  return (
    <main
      className={`mx-auto flex min-h-full w-full max-w-lg flex-col gap-6 px-4 py-6 ${bottomTabBarContentPaddingClass}`}
    >
      <header>
        <h1 className="text-xl font-bold text-zinc-900">요금제 선택</h1>
        <p className="mt-1 text-sm text-zinc-600">
          무료 등록 1회를 사용한 뒤에는 아래 요금제 중 하나를 선택해 주세요.
          금액은 Firebase config 컬렉션의 pricing 문서에서 관리됩니다.
        </p>
      </header>

      {loading ? (
        <div className="space-y-3">
          <div className="h-28 animate-pulse rounded-2xl bg-zinc-200" />
          <div className="h-28 animate-pulse rounded-2xl bg-zinc-200" />
        </div>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error.message}
        </p>
      ) : null}

      {!loading && data ? (
        <ul className="flex flex-col gap-3">
          {data.plans.map((plan) => (
            <li key={plan.id}>
              <div className="flex flex-col gap-2 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm ring-1 ring-black/5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-zinc-900">{plan.label}</p>
                    <p className="text-xs text-zinc-500">
                      노출 {plan.days}일 · id: {plan.id}
                    </p>
                  </div>
                  <p className="text-lg font-bold tabular-nums text-[#1a2744]">
                    {formatWon(plan.price)}원
                  </p>
                </div>
                <p className="text-xs text-zinc-500">
                  실제 결제는 결제 연동 후 연결할 수 있어요.
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-col gap-2 pt-2">
        <Link
          href="/register"
          className="rounded-xl bg-[#1a2744] py-3 text-center text-sm font-semibold text-white"
        >
          등록 폼으로 돌아가기
        </Link>
        <Link
          href="/"
          className="rounded-xl border border-zinc-300 bg-white py-3 text-center text-sm font-semibold text-zinc-800"
        >
          홈으로
        </Link>
      </div>
    </main>
  );
}
