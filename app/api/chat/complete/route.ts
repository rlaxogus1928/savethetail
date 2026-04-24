import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getAdminApp, getAdminDatabase } from "@/lib/firebaseAdmin";

type RequestBody = {
  applicationId?: string;
};

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const idToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null;

    const body = (await req.json()) as RequestBody;
    const { applicationId } = body;

    if (!idToken || !applicationId) {
      return NextResponse.json(
        { error: "필수 파라미터가 없습니다." },
        { status: 400 },
      );
    }

    const app = getAdminApp();
    const decoded = await getAuth(app).verifyIdToken(idToken);
    const callerId = decoded.uid;

    const rtdb = getAdminDatabase();
    const metaSnap = await rtdb.ref(`chats/${applicationId}/meta`).get();

    if (!metaSnap.exists()) {
      return NextResponse.json(
        { error: "채팅방을 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    const meta = metaSnap.val() as {
      ownerId: string;
      applicantId: string;
      animalId: string;
      animalName: string;
      status: string;
    };

    if (meta.ownerId !== callerId) {
      return NextResponse.json(
        { error: "입양 완료는 파양자만 처리할 수 있습니다." },
        { status: 403 },
      );
    }

    if (meta.status === "completed") {
      return NextResponse.json(
        { error: "이미 완료된 입양입니다." },
        { status: 409 },
      );
    }

    const completedAt = Date.now();

    // Realtime Database 상태 업데이트
    await rtdb.ref(`chats/${applicationId}/meta`).update({
      status: "completed",
      completedAt,
    });

    // 완료 시스템 메시지
    await rtdb.ref(`chats/${applicationId}/messages`).push({
      senderId: "system",
      text: `🎉 ${meta.animalName}의 입양이 완료되었습니다. 새 가족이 되어주셔서 감사합니다!`,
      type: "system",
      createdAt: completedAt,
    });

    // Firestore animal 상태를 "closed"로 업데이트
    const db = getFirestore(app);
    await db.collection("animals").doc(meta.animalId).update({
      status: "closed",
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
