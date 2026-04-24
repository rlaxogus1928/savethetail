"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { signInAnonymously } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { verifyPayment } from "@/lib/payment";

function PaymentSuccessContent() {
  const params = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const paymentKey = params.get("paymentKey");
    const orderId = params.get("orderId");
    const amountStr = params.get("amount");

    if (!paymentKey || !orderId || !amountStr) {
      setError("결제 정보가 올바르지 않습니다.");
      setStatus("error");
      return;
    }

    const amount = Number(amountStr);

    (async () => {
      try {
        if (!auth.currentUser) {
          await signInAnonymously(auth);
        }
        const user = auth.currentUser;
        if (!user) throw new Error("로그인에 실패했습니다.");

        const idToken = await user.getIdToken();
        await verifyPayment({ idToken, paymentKey, orderId, amount });
        setStatus("success");
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setStatus("error");
      }
    })();
  }, [params]);

  if (status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[#1a2744] border-t-transparent" />
          <p className="mt-4 text-sm text-zinc-600">결제를 처리하고 있습니다...</p>
        </div>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-lg font-bold text-red-900">결제 처리에 실패했습니다</p>
          <p className="mt-2 text-sm text-red-700">{error}</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="mt-5 w-full rounded-xl bg-[#1a2744] py-3 text-sm font-semibold text-white"
          >
            대시보드로 이동
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-green-200 bg-green-50 p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <svg
            className="h-6 w-6 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="mt-4 text-lg font-bold text-green-900">결제가 완료되었습니다!</p>
        <p className="mt-1 text-sm text-green-700">공고에 성공적으로 적용되었습니다.</p>
        <button
          onClick={() => router.push("/dashboard")}
          className="mt-5 w-full rounded-xl bg-[#1a2744] py-3 text-sm font-semibold text-white"
        >
          대시보드로 이동
        </button>
      </div>
    </main>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center px-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1a2744] border-t-transparent" />
        </main>
      }
    >
      <PaymentSuccessContent />
    </Suspense>
  );
}
