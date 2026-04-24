import type { PaymentType } from "./firestore";

export type { PaymentType };

export type PrepareResult = {
  orderId: string;
  orderName: string;
  amount: number;
};

export async function preparePayment(params: {
  idToken: string;
  animalId: string;
  type: PaymentType;
  itemId: string;
}): Promise<PrepareResult> {
  const res = await fetch("/api/payment/prepare", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.idToken}`,
    },
    body: JSON.stringify({
      animalId: params.animalId,
      type: params.type,
      itemId: params.itemId,
    }),
  });
  const data = (await res.json()) as {
    error?: string;
    orderId?: string;
    orderName?: string;
    amount?: number;
  };
  if (!res.ok) throw new Error(data.error ?? "결제 준비에 실패했습니다.");
  return {
    orderId: data.orderId!,
    orderName: data.orderName!,
    amount: data.amount!,
  };
}

export async function verifyPayment(params: {
  idToken: string;
  paymentKey: string;
  orderId: string;
  amount: number;
}): Promise<void> {
  const res = await fetch("/api/payment/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.idToken}`,
    },
    body: JSON.stringify({
      paymentKey: params.paymentKey,
      orderId: params.orderId,
      amount: params.amount,
    }),
  });
  const data = (await res.json()) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? "결제 검증에 실패했습니다.");
}
