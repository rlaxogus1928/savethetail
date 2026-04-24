"use client";

import { useState } from "react";
import { signInAnonymously } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { preparePayment } from "@/lib/payment";
import type { PaymentType } from "@/lib/payment";

type Props = {
  animalId: string;
  type: PaymentType;
  itemId: string;
  label: string;
  amount: number;
  className?: string;
  disabled?: boolean;
};

export function PaymentButton({
  animalId,
  type,
  itemId,
  label,
  amount,
  className = "",
  disabled = false,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (loading || disabled) return;
    setLoading(true);
    setError(null);

    try {
      if (!auth.currentUser) {
        await signInAnonymously(auth);
      }
      const user = auth.currentUser;
      if (!user) throw new Error("로그인이 필요합니다.");

      const idToken = await user.getIdToken();
      const { orderId, orderName, amount: serverAmount } = await preparePayment(
        { idToken, animalId, type, itemId },
      );

      const clientKey = process.env.NEXT_PUBLIC_TOSS_PAYMENTS_CLIENT_KEY;
      if (!clientKey) {
        throw new Error(
          "NEXT_PUBLIC_TOSS_PAYMENTS_CLIENT_KEY가 설정되지 않았습니다.",
        );
      }

      const { loadTossPayments } = await import(
        "@tosspayments/tosspayments-sdk"
      );
      const tossPayments = await loadTossPayments(clientKey);
      const payment = tossPayments.payment({ customerKey: user.uid });

      // requestPayment는 TossPayments 결제 페이지로 리디렉션합니다
      await payment.requestPayment({
        method: "CARD",
        amount: { currency: "KRW", value: serverAmount },
        orderId,
        orderName,
        successUrl: `${window.location.origin}/payment/success`,
        failUrl: `${window.location.origin}/payment/fail`,
      });
      // 리디렉션 후에는 이 코드에 도달하지 않음
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || loading}
        className={className}
      >
        {loading ? "처리 중..." : label}
      </button>
      {error ? (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      ) : null}
    </div>
  );
}

// amount 표시용 포맷터 (컴포넌트 외부에서 import해서 쓸 수 있음)
export function formatWon(n: number): string {
  return n.toLocaleString("ko-KR");
}
