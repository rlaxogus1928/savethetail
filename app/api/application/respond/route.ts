import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAdminApp, getAdminDatabase } from "@/lib/firebaseAdmin";
import {
  sendApplicationAcceptedEmail,
  sendApplicationRejectedEmail,
} from "@/lib/email";

type RequestBody = {
  applicationId?: string;
  action?: "accept" | "reject";
};

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const idToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null;

    const body = (await req.json()) as RequestBody;
    const { applicationId, action } = body;

    if (!idToken || !applicationId || (action !== "accept" && action !== "reject")) {
      return NextResponse.json(
        { error: "필수 파라미터가 없습니다." },
        { status: 400 },
      );
    }

    const app = getAdminApp();
    const decoded = await getAuth(app).verifyIdToken(idToken);
    const callerId = decoded.uid;

    const db = getFirestore(app);

    const appRef = db.collection("applications").doc(applicationId);
    const appSnap = await appRef.get();
    if (!appSnap.exists) {
      return NextResponse.json(
        { error: "신청을 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    const application = appSnap.data()!;

    // 이미 처리된 신청인지 확인
    if (application.status !== "pending") {
      return NextResponse.json(
        { error: "이미 처리된 신청입니다." },
        { status: 409 },
      );
    }

    // 공고 소유자 확인
    const animalSnap = await db
      .collection("animals")
      .doc(application.animalId as string)
      .get();
    if (!animalSnap.exists) {
      return NextResponse.json(
        { error: "공고를 찾을 수 없습니다." },
        { status: 404 },
      );
    }
    if (animalSnap.data()!.userId !== callerId) {
      return NextResponse.json(
        { error: "권한이 없습니다." },
        { status: 403 },
      );
    }

    const applicantEmail = String(application.applicantEmail ?? "");
    const applicantName = String(application.applicantName ?? "신청자");
    const animalName = String(animalSnap.data()!.name ?? "동물");

    const newStatus = action === "accept" ? "accepted" : "rejected";

    await appRef.update({
      status: newStatus,
      contractLog: FieldValue.arrayUnion({
        at: FieldValue.serverTimestamp(),
        action: newStatus,
      }),
    });

    // 수락 시 Realtime Database 채팅방 자동 생성 (실패해도 수락 결과에 영향 없음)
    if (action === "accept") {
      (async () => {
        try {
          const rtdb = getAdminDatabase();
          const chatRef = rtdb.ref(`chats/${applicationId}`);
          await chatRef.child("meta").set({
            animalId: String(application.animalId),
            animalName,
            ownerId: callerId,
            applicantId: String(application.applicantId),
            createdAt: Date.now(),
            status: "active",
          });
          await chatRef.child("messages").push({
            senderId: "system",
            text: `${animalName}에 대한 입양 신청이 수락되었습니다. 채팅을 시작해 보세요.`,
            type: "system",
            createdAt: Date.now(),
          });
        } catch (err) {
          console.error("[chat] 채팅방 생성 실패:", err);
        }
      })();
    }

    // 신청자에게 이메일 발송 — 실패해도 수락/거절 결과에 영향 없음
    if (applicantEmail) {
      const emailPromise =
        action === "accept"
          ? sendApplicationAcceptedEmail({
              to: applicantEmail,
              applicantName,
              animalName,
              applicationId,
            })
          : sendApplicationRejectedEmail({
              to: applicantEmail,
              applicantName,
              animalName,
            });

      emailPromise.catch((err) =>
        console.error("[email] sendApplication*Email 실패:", err),
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
