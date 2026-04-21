import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getAdminApp } from "@/lib/firebaseAdmin";

const PORTONE_API = "https://api.portone.io";

type PortOneIdentityVerification = {
  status?: string;
  verifiedCustomer?: {
    phoneNumber?: string;
  };
};

function extractVerification(json: unknown): PortOneIdentityVerification | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  const inner = o.identityVerification;
  if (inner && typeof inner === "object") {
    return inner as PortOneIdentityVerification;
  }
  return o as PortOneIdentityVerification;
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const idToken =
      authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
    const body = (await req.json()) as { identityVerificationId?: string };
    const identityVerificationId = body.identityVerificationId?.trim();

    if (!idToken || !identityVerificationId) {
      return NextResponse.json(
        { error: "idToken 또는 identityVerificationId가 없습니다." },
        { status: 400 },
      );
    }

    const portoneSecret = process.env.PORTONE_API_SECRET;
    if (!portoneSecret) {
      return NextResponse.json(
        { error: "PORTONE_API_SECRET이 설정되지 않았습니다." },
        { status: 500 },
      );
    }

    const app = getAdminApp();
    const decoded = await getAuth(app).verifyIdToken(idToken);
    const uid = decoded.uid;

    const ivRes = await fetch(
      `${PORTONE_API}/identity-verifications/${encodeURIComponent(identityVerificationId)}`,
      {
        headers: {
          Authorization: `PortOne ${portoneSecret}`,
        },
      },
    );

    if (!ivRes.ok) {
      const detail = await ivRes.text();
      return NextResponse.json(
        { error: "포트원 본인인증 조회에 실패했습니다.", detail },
        { status: 400 },
      );
    }

    const json: unknown = await ivRes.json();
    const iv = extractVerification(json);
    if (!iv || iv.status !== "VERIFIED") {
      return NextResponse.json(
        {
          error: "본인인증이 완료되지 않았습니다.",
          status: iv?.status ?? null,
        },
        { status: 400 },
      );
    }

    const phone = iv.verifiedCustomer?.phoneNumber?.trim() ?? "";
    const db = getFirestore(app);
    const ref = db.collection("users").doc(uid);
    await ref.set(
      {
        isVerified: true,
        phone,
      },
      { merge: true },
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
