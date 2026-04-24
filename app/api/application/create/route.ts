import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAdminApp } from "@/lib/firebaseAdmin";
import {
  sendApplicationReceivedEmail,
} from "@/lib/email";

type RequestBody = {
  animalId?: string;
  applicantName?: string;
  applicantEmail?: string;
  message?: string;
};

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const idToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null;

    const body = (await req.json()) as RequestBody;
    const { animalId, applicantName, applicantEmail, message } = body;

    if (!idToken || !animalId || !applicantName?.trim() || !applicantEmail?.trim()) {
      return NextResponse.json(
        { error: "필수 파라미터가 없습니다." },
        { status: 400 },
      );
    }

    const app = getAdminApp();
    const decoded = await getAuth(app).verifyIdToken(idToken);
    const applicantId = decoded.uid;

    const db = getFirestore(app);

    const animalSnap = await db.collection("animals").doc(animalId).get();
    if (!animalSnap.exists) {
      return NextResponse.json(
        { error: "공고를 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    const animal = animalSnap.data()!;

    if (animal.userId === applicantId) {
      return NextResponse.json(
        { error: "본인 공고에는 신청할 수 없습니다." },
        { status: 400 },
      );
    }

    if (animal.status !== "open") {
      return NextResponse.json(
        { error: "현재 신청을 받지 않는 공고입니다." },
        { status: 400 },
      );
    }

    // 중복 신청 방지
    const duplicateSnap = await db
      .collection("applications")
      .where("animalId", "==", animalId)
      .where("applicantId", "==", applicantId)
      .limit(1)
      .get();
    if (!duplicateSnap.empty) {
      return NextResponse.json(
        { error: "이미 신청한 공고입니다." },
        { status: 409 },
      );
    }

    // 파양자(공고 소유자) 이메일 조회
    const ownerSnap = await db.collection("users").doc(animal.userId as string).get();
    const ownerEmail: string | undefined = ownerSnap.exists
      ? (ownerSnap.data()!.email as string | undefined)
      : undefined;
    const ownerName: string = ownerSnap.exists
      ? (String(ownerSnap.data()!.phone ?? "") || "파양자")
      : "파양자";

    // 신청 생성
    const appRef = db.collection("applications").doc();
    await appRef.set({
      animalId,
      applicantId,
      applicantName: applicantName.trim(),
      applicantEmail: applicantEmail.trim().toLowerCase(),
      message: message?.trim() || null,
      contractLog: [],
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
    });

    // 파양자에게 이메일 발송 — 실패해도 신청 결과에 영향 없음
    if (ownerEmail) {
      sendApplicationReceivedEmail({
        to: ownerEmail,
        ownerName,
        applicantName: applicantName.trim(),
        animalName: String(animal.name ?? "동물"),
        message: message?.trim(),
      }).catch((err) =>
        console.error("[email] sendApplicationReceivedEmail 실패:", err),
      );
    }

    return NextResponse.json({ ok: true, applicationId: appRef.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
