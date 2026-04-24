import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAdminApp } from "@/lib/firebaseAdmin";
import type { PaymentType } from "@/lib/firestore";

type PricingPlan = { id: string; price: number; label: string; days: number };
type PricingBoost = { id: string; price: number; label: string };

type RequestBody = {
  animalId?: string;
  type?: PaymentType;
  itemId?: string;
};

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const idToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null;

    const body = (await req.json()) as RequestBody;
    const { animalId, type, itemId } = body;

    if (!idToken || !animalId || !type || !itemId) {
      return NextResponse.json(
        { error: "필수 파라미터가 없습니다." },
        { status: 400 },
      );
    }

    const app = getAdminApp();
    const decoded = await getAuth(app).verifyIdToken(idToken);
    const userId = decoded.uid;

    const db = getFirestore(app);

    // 가격은 반드시 Firebase config에서만 가져옵니다 (클라이언트 전달값 무시)
    const pricingSnap = await db.collection("config").doc("pricing").get();
    if (!pricingSnap.exists) {
      return NextResponse.json(
        { error: "요금 정보를 찾을 수 없습니다." },
        { status: 500 },
      );
    }

    const pricing = pricingSnap.data()!;
    let amount: number;
    let orderName: string;
    let days: number | null = null;

    if (type === "plan") {
      const plans = (pricing.plans ?? []) as PricingPlan[];
      const plan = plans.find((p) => p.id === itemId);
      if (!plan) {
        return NextResponse.json(
          { error: "요금제를 찾을 수 없습니다." },
          { status: 400 },
        );
      }
      if (plan.price === 0) {
        return NextResponse.json(
          { error: "무료 요금제는 결제할 수 없습니다." },
          { status: 400 },
        );
      }
      amount = plan.price;
      orderName = `${plan.label} 요금제`;
      days = plan.days;
    } else {
      const boosts = (pricing.boosts ?? []) as PricingBoost[];
      const boost = boosts.find((b) => b.id === itemId);
      if (!boost) {
        return NextResponse.json(
          { error: "부스트 항목을 찾을 수 없습니다." },
          { status: 400 },
        );
      }
      amount = boost.price;
      orderName = boost.label;
    }

    // 해당 공고가 이 사용자 소유인지 확인
    const animalSnap = await db.collection("animals").doc(animalId).get();
    if (!animalSnap.exists) {
      return NextResponse.json(
        { error: "공고를 찾을 수 없습니다." },
        { status: 404 },
      );
    }
    if (animalSnap.data()!.userId !== userId) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    const orderRef = db.collection("pendingOrders").doc();
    await orderRef.set({
      userId,
      animalId,
      type,
      itemId,
      amount,
      days,
      orderName,
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ orderId: orderRef.id, orderName, amount });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
