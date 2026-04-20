import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type QueryConstraint,
  type SetOptions,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";

/** Firestore 루트 컬렉션 이름 */
export const COLLECTIONS = {
  animals: "animals",
  users: "users",
  applications: "applications",
  config: "config",
} as const;

/** config 컬렉션의 단일 설정 문서 ID */
export const CONFIG_DOC_ID = "app";

export type UserRole = "user" | "admin";

export type Animal = {
  id: string;
  userId: string;
  name: string;
  species: string;
  age: number;
  photos: string[];
  completionScore: number;
  matchScore: number;
  status: string;
  createdAt: Timestamp;
  expiresAt: Timestamp | null;
  viewCount: number;
};

export type AnimalCreateInput = Omit<Animal, "id" | "viewCount"> & {
  viewCount?: number;
};

export type AnimalUpdateInput = Partial<
  Omit<Animal, "id" | "createdAt">
>;

export type User = {
  id: string;
  phone: string;
  isVerified: boolean;
  plan: string;
  registeredCount: number;
  role: UserRole;
};

export type UserCreateInput = Omit<User, "id">;

export type UserUpdateInput = Partial<Omit<User, "id">>;

export type Application = {
  id: string;
  animalId: string;
  applicantId: string;
  contractLog: ContractLogEntry[];
  status: string;
  createdAt: Timestamp;
};

export type ContractLogEntry = {
  at: Timestamp;
  note?: string;
  action?: string;
};

export type ApplicationCreateInput = Omit<Application, "id">;

export type ApplicationUpdateInput = Partial<
  Omit<Application, "id" | "createdAt">
>;

/** 가격·부스트 등 운영 설정 (필드는 프로덕트에 맞게 확장) */
export type AppConfig = {
  pricing: Record<string, unknown>;
  boostOptions: unknown[];
};

function assertTimestamp(value: unknown, field: string): Timestamp {
  if (value instanceof Timestamp) return value;
  throw new Error(`Expected Timestamp at ${field}`);
}

function toAnimal(id: string, data: DocumentData): Animal {
  return {
    id,
    userId: String(data.userId ?? ""),
    name: String(data.name ?? ""),
    species: String(data.species ?? ""),
    age: Number(data.age ?? 0),
    photos: Array.isArray(data.photos) ? data.photos.map(String) : [],
    completionScore: Number(data.completionScore ?? 0),
    matchScore: Number(data.matchScore ?? 0),
    status: String(data.status ?? ""),
    createdAt: assertTimestamp(data.createdAt, "createdAt"),
    expiresAt:
      data.expiresAt === null || data.expiresAt === undefined
        ? null
        : assertTimestamp(data.expiresAt, "expiresAt"),
    viewCount: Number(data.viewCount ?? 0),
  };
}

function toUser(id: string, data: DocumentData): User {
  const role = data.role === "admin" ? "admin" : "user";
  return {
    id,
    phone: String(data.phone ?? ""),
    isVerified: Boolean(data.isVerified),
    plan: String(data.plan ?? ""),
    registeredCount: Number(data.registeredCount ?? 0),
    role,
  };
}

function toContractLogEntry(raw: unknown): ContractLogEntry {
  if (!raw || typeof raw !== "object") {
    return { at: Timestamp.now() };
  }
  const o = raw as Record<string, unknown>;
  const at = o.at instanceof Timestamp ? o.at : Timestamp.now();
  return {
    at,
    note: o.note !== undefined ? String(o.note) : undefined,
    action: o.action !== undefined ? String(o.action) : undefined,
  };
}

function toApplication(id: string, data: DocumentData): Application {
  const rawLog = data.contractLog;
  const contractLog = Array.isArray(rawLog)
    ? rawLog.map(toContractLogEntry)
    : [];
  return {
    id,
    animalId: String(data.animalId ?? ""),
    applicantId: String(data.applicantId ?? ""),
    contractLog,
    status: String(data.status ?? ""),
    createdAt: assertTimestamp(data.createdAt, "createdAt"),
  };
}

function toAppConfig(data: DocumentData): AppConfig {
  const pricing =
    data.pricing && typeof data.pricing === "object" && !Array.isArray(data.pricing)
      ? (data.pricing as Record<string, unknown>)
      : {};
  const boostOptions = Array.isArray(data.boostOptions) ? data.boostOptions : [];
  return { pricing, boostOptions };
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const k of Object.keys(obj) as (keyof T)[]) {
    if (obj[k] !== undefined) {
      out[k] = obj[k];
    }
  }
  return out;
}

// ——— animals ———

export async function createAnimal(input: AnimalCreateInput): Promise<string> {
  const payload = {
    ...input,
    viewCount: input.viewCount ?? 0,
  };
  const ref = await addDoc(collection(db, COLLECTIONS.animals), payload);
  return ref.id;
}

export async function getAnimal(id: string): Promise<Animal | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.animals, id));
  if (!snap.exists()) return null;
  return toAnimal(snap.id, snap.data());
}

export async function listAnimals(
  ...constraints: QueryConstraint[]
): Promise<Animal[]> {
  const q =
    constraints.length > 0
      ? query(collection(db, COLLECTIONS.animals), ...constraints)
      : query(collection(db, COLLECTIONS.animals));
  const snaps = await getDocs(q);
  return snaps.docs.map((d) => toAnimal(d.id, d.data()));
}

export async function listAnimalsByUserId(userId: string): Promise<Animal[]> {
  return listAnimals(where("userId", "==", userId));
}

export async function updateAnimal(
  id: string,
  patch: AnimalUpdateInput
): Promise<void> {
  const cleaned = stripUndefined(patch as Record<string, unknown>);
  if (Object.keys(cleaned).length === 0) return;
  await updateDoc(doc(db, COLLECTIONS.animals, id), cleaned);
}

export async function deleteAnimal(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.animals, id));
}

export async function incrementAnimalViewCount(
  id: string,
  delta = 1
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.animals, id), {
    viewCount: increment(delta),
  });
}

// ——— users ———

export async function createUser(
  userId: string,
  input: UserCreateInput,
  options?: SetOptions
): Promise<void> {
  await setDoc(doc(db, COLLECTIONS.users, userId), input, options ?? {});
}

export async function getUser(id: string): Promise<User | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.users, id));
  if (!snap.exists()) return null;
  return toUser(snap.id, snap.data());
}

export async function listUsers(
  ...constraints: QueryConstraint[]
): Promise<User[]> {
  const q =
    constraints.length > 0
      ? query(collection(db, COLLECTIONS.users), ...constraints)
      : query(collection(db, COLLECTIONS.users));
  const snaps = await getDocs(q);
  return snaps.docs.map((d) => toUser(d.id, d.data()));
}

export async function updateUser(
  id: string,
  patch: UserUpdateInput
): Promise<void> {
  const cleaned = stripUndefined(patch as Record<string, unknown>);
  if (Object.keys(cleaned).length === 0) return;
  await updateDoc(doc(db, COLLECTIONS.users, id), cleaned);
}

export async function deleteUser(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.users, id));
}

// ——— applications ———

export async function createApplication(
  input: ApplicationCreateInput
): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTIONS.applications), input);
  return ref.id;
}

export async function getApplication(id: string): Promise<Application | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.applications, id));
  if (!snap.exists()) return null;
  return toApplication(snap.id, snap.data());
}

export async function listApplications(
  ...constraints: QueryConstraint[]
): Promise<Application[]> {
  const q =
    constraints.length > 0
      ? query(collection(db, COLLECTIONS.applications), ...constraints)
      : query(collection(db, COLLECTIONS.applications));
  const snaps = await getDocs(q);
  return snaps.docs.map((d) => toApplication(d.id, d.data()));
}

export async function listApplicationsByAnimalId(
  animalId: string
): Promise<Application[]> {
  const apps = await listApplications(where("animalId", "==", animalId));
  return apps.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
}

export async function listApplicationsByApplicantId(
  applicantId: string
): Promise<Application[]> {
  const apps = await listApplications(where("applicantId", "==", applicantId));
  return apps.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
}

export async function updateApplication(
  id: string,
  patch: ApplicationUpdateInput
): Promise<void> {
  const cleaned = stripUndefined(patch as Record<string, unknown>);
  if (Object.keys(cleaned).length === 0) return;
  await updateDoc(doc(db, COLLECTIONS.applications, id), cleaned);
}

export async function deleteApplication(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.applications, id));
}

// ——— config (단일 문서) ———

export async function getConfig(): Promise<AppConfig | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.config, CONFIG_DOC_ID));
  if (!snap.exists()) return null;
  return toAppConfig(snap.data());
}

export async function setConfig(
  config: AppConfig,
  options?: SetOptions
): Promise<void> {
  await setDoc(doc(db, COLLECTIONS.config, CONFIG_DOC_ID), config, options ?? {});
}

export async function updateConfig(
  patch: Partial<AppConfig>
): Promise<void> {
  const cleaned = stripUndefined(patch as Record<string, unknown>);
  if (Object.keys(cleaned).length === 0) return;
  await updateDoc(doc(db, COLLECTIONS.config, CONFIG_DOC_ID), cleaned);
}

/** 자주 쓰는 쿼리 보조: 최근 N건 */
export function recent(limitCount: number) {
  return [orderBy("createdAt", "desc"), limit(limitCount)];
}
