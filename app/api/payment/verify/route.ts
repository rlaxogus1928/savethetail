/**
 * 결제 검증 서버 라우트
 *
 * 클라이언트에서 직접 DB를 수정하지 않고 이 서버 라우트에서만
 * TossPayments 승인 → Firestore 업데이트가 이루어집니다.
 * (Firebase Cloud Function과 동일한 보안 모델)
 */
import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import {
  getFirestore,
  FieldValue,
  Timestamp,
} from "firebase-admin/firestore";
import { getAdminApp } from "@/lib/firebaseAdmin";

const TOSS_CONFIRM_URL = "https://api.tosspayments.com/v1/payments/confirm";

// 부스트 유효 기간 (일)
const BOOST_DAYS = 3;

type RequestBody = {
  paymentKey?: string;
  orderId?: string;
  amount?: number;
};

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const idToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null;

    const body = (await req.json()) as RequestBody;
    const { paymentKey, orderId, amount } = body;

    if (!idToken || !paymentKey || !orderId || amount === undefined) {
      return NextResponse.json(
        { error: "필수 파라미터가 없습니다." },
        { status: 400 },
      );
    }

    const secretKey = process.env.TOSS_PAYMENTS_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json(
        { error: "TOSS_PAYMENTS_SECRET_KEY가 설정되지 않았습니다." },
        { status: 500 },
      );
    }

    const app = getAdminApp();
    const decoded = await getAuth(app).verifyIdToken(idToken);
    const userId = decoded.uid;

    const db = getFirestore(app);

    const orderRef = db.collection("pendingOrders").doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
      return NextResponse.json(
        { error: "주문을 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    const order = orderSnap.data()!;

    if (order.userId !== userId) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    // 이미 처리된 결제 (멱등성 보장)
    if (order.status === "confirmed") {
      return NextResponse.json({ ok: true });
    }

    // 서버에 저장된 금액과 비교 (변조 방지)
    if (order.amount !== amount) {
      return NextResponse.json(
        { error: "결제 금액이 일치하지 않습니다." },
        { status: 400 },
      );
    }

    // TossPayments 결제 최종 승인
    const encoded = Buffer.from(`${secretKey}:`).toString("base64");
    const tossRes = await fetch(TOSS_CONFIRM_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${encoded}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });

    if (!tossRes.ok) {
      const detail = await tossRes.text();
      return NextResponse.json(
        { error: "TossPayments 결제 승인에 실패했습니다.", detail },
        { status: 400 },
      );
    }

    const tossPayment = (await tossRes.json()) as { method?: string };

    // Firestore 트랜잭션: animals 업데이트 + payments 생성
    await db.runTransaction(async (tx) => {
      const animalRef = db.collection("animals").doc(order.animalId as string);
      const animalSnap = await tx.get(animalRef);
      if (!animalSnap.exists) {
        throw new Error("공고를 찾을 수 없습니다.");
      }

      const animalData = animalSnap.data()!;
      const now = Date.now();

      if (order.type === "plan") {
        const days = order.days as number;
        const currentExpires =
          (animalData.expiresAt as Timestamp | null)?.toMillis() ?? now;
        const base = Math.max(currentExpires, now);
        const newExpires = Timestamp.fromMillis(
          base + days * 24 * 60 * 60 * 1000,
        );
        tx.update(animalRef, { expiresAt: newExpires, status: "open" });
      } else if (order.type === "bump") {
        const boostUntil = Timestamp.fromMillis(
          now + BOOST_DAYS * 24 * 60 * 60 * 1000,
        );
        tx.update(animalRef, { boostUntil });
      } else if (order.type === "top") {
        const topUntil = Timestamp.fromMillis(
          now + BOOST_DAYS * 24 * 60 * 60 * 1000,
        );
        tx.update(animalRef, { topUntil });
      }

      // payments 컬렉션에 결제 내역 저장
      const paymentRef = db.collection("payments").doc();
      tx.set(paymentRef, {
        userId,
        animalId: order.animalId,
        type: order.type,
        itemId: order.itemId,
        amount: order.amount,
        orderId,
        paymentKey,
        method: tossPayment.method ?? null,
        status: "paid",
        createdAt: FieldValue.serverTimestamp(),
      });

      tx.update(orderRef, { status: "confirmed" });
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
