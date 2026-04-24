"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function PaymentFailContent() {
  const params = useSearchParams();
  const router = useRouter();
  const message = params.get("message") ?? "결제가 취소되었습니다.";
  const code = params.get("code");

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100">
          <svg
            className="h-6 w-6 text-zinc-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <p className="mt-4 text-lg font-bold text-zinc-900">결제에 실패했습니다</p>
        <p className="mt-1 text-sm text-zinc-600">{message}</p>
        {code ? (
          <p className="mt-1 text-xs text-zinc-400">오류 코드: {code}</p>
        ) : null}
        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={() => router.back()}
            className="w-full rounded-xl bg-[#1a2744] py-3 text-sm font-semibold text-white"
          >
            다시 시도
          </button>
          <button
            onClick={() => router.push("/dashboard")}
            className="w-full rounded-xl border border-zinc-200 py-3 text-sm font-semibold text-zinc-700"
          >
            대시보드로 이동
          </button>
        </div>
      </div>
    </main>
  );
}

export default function PaymentFailPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center px-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1a2744] border-t-transparent" />
        </main>
      }
    >
      <PaymentFailContent />
    </Suspense>
  );
}
