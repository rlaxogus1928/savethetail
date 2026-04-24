import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getDatabase, type Database } from "firebase-admin/database";

let cached: App | null = null;

/**
 * API Route 등 서버 전용. `FIREBASE_SERVICE_ACCOUNT_JSON`에 Firebase 서비스 계정 JSON 전체를 문자열로 넣습니다.
 */
export function getAdminApp(): App {
  if (cached) return cached;
  const existing = getApps()[0];
  if (existing) {
    cached = existing;
    return cached;
  }
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON 환경 변수가 설정되지 않았습니다.",
    );
  }
  const credential = cert(JSON.parse(raw) as Record<string, unknown>);
  const databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
  cached = initializeApp({
    credential,
    ...(databaseURL ? { databaseURL } : {}),
  });
  return cached;
}

let cachedDb: Database | null = null;

export function getAdminDatabase(): Database {
  if (cachedDb) return cachedDb;
  if (!process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL) {
    throw new Error("NEXT_PUBLIC_FIREBASE_DATABASE_URL 환경 변수가 설정되지 않았습니다.");
  }
  cachedDb = getDatabase(getAdminApp());
  return cachedDb;
}
