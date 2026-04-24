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
  startAfter,
  updateDoc,
  where,
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
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
  payments: "payments",
  pendingOrders: "pendingOrders",
} as const;

/** config 컬렉션의 일반 설정 문서 ID */
export const CONFIG_DOC_ID = "app";

/** 요금제·부스트 가격 문서 ID (`config/pricing`) */
export const PRICING_DOC_ID = "pricing";

export type UserRole = "user" | "admin";

export type Animal = {
  id: string;
  userId: string;
  name: string;
  species: string;
  /** 필터·표시용: dog | cat | other (문서에 없으면 species 문자열로 보조) */
  speciesCode?: "dog" | "cat" | "other";
  age: number;
  /** 수컷 / 암컷 / 알 수 없음 등 */
  gender?: string;
  photos: string[];
  completionScore: number;
  matchScore: number;
  status: string;
  /** 성격 설명 */
  personality?: string;
  /** 건강 상태 */
  health?: string;
  /** 파양 사유 */
  surrenderReason?: string;
  /** 중성화: done | pending */
  neuterStatus?: "done" | "pending";
  /** 접종: done | pending */
  vaccineStatus?: "done" | "pending";
  /** 시·도 (FilterBar region 값과 동일) */
  region?: string;
  /** 카드에 표시할 상세 위치 */
  location?: string;
  createdAt: Timestamp;
  expiresAt: Timestamp | null;
  viewCount: number;
  /** 끌어올리기 만료 시각 */
  boostUntil?: Timestamp;
  /** 상단 노출 만료 시각 */
  topUntil?: Timestamp;
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
  email?: string;
  isVerified: boolean;
  plan: string;
  registeredCount: number;
  role: UserRole;
};

export type UserCreateInput = Omit<User, "id">;

export type UserUpdateInput = Partial<Omit<User, "id">>;

export type ApplicationStatus = "pending" | "accepted" | "rejected";

export type Application = {
  id: string;
  animalId: string;
  applicantId: string;
  applicantName: string;
  applicantEmail: string;
  message?: string;
  contractLog: ContractLogEntry[];
  status: ApplicationStatus;
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

export type PaymentType = "plan" | "bump" | "top";

export type Payment = {
  id: string;
  userId: string;
  animalId: string;
  type: PaymentType;
  itemId: string;
  amount: number;
  orderId: string;
  paymentKey: string;
  status: "paid";
  createdAt: Timestamp;
};

export type PaymentCreateInput = Omit<Payment, "id">;

/** 가격·부스트 등 운영 설정 (필드는 프로덕트에 맞게 확장) */
export type AppConfig = {
  pricing: Record<string, unknown>;
  boostOptions: unknown[];
};

function assertTimestamp(value: unknown, field: string): Timestamp {
  if (value instanceof Timestamp) return value;
  throw new Error(`Expected Timestamp at ${field}`);
}

function parseSpeciesCode(
  data: DocumentData
): "dog" | "cat" | "other" | undefined {
  const v = data.speciesCode;
  if (v === "dog" || v === "cat" || v === "other") return v;
  return undefined;
}

function parseDonePending(
  data: DocumentData,
  key: "neuterStatus" | "vaccineStatus"
): "done" | "pending" | undefined {
  const v = data[key];
  if (v === "done" || v === "pending") return v;
  return undefined;
}

function toAnimal(id: string, data: DocumentData): Animal {
  return {
    id,
    userId: String(data.userId ?? ""),
    name: String(data.name ?? ""),
    species: String(data.species ?? ""),
    speciesCode: parseSpeciesCode(data),
    age: Number(data.age ?? 0),
    gender:
      data.gender !== undefined && data.gender !== null
        ? String(data.gender)
        : undefined,
    photos: Array.isArray(data.photos) ? data.photos.map(String) : [],
    personality:
      data.personality !== undefined && data.personality !== null
        ? String(data.personality)
        : undefined,
    health:
      data.health !== undefined && data.health !== null
        ? String(data.health)
        : undefined,
    surrenderReason:
      data.surrenderReason !== undefined && data.surrenderReason !== null
        ? String(data.surrenderReason)
        : undefined,
    completionScore: Number(data.completionScore ?? 0),
    matchScore: Number(data.matchScore ?? 0),
    status: String(data.status ?? ""),
    neuterStatus: parseDonePending(data, "neuterStatus"),
    vaccineStatus: parseDonePending(data, "vaccineStatus"),
    region:
      data.region !== undefined && data.region !== null
        ? String(data.region)
        : undefined,
    location:
      data.location !== undefined && data.location !== null
        ? String(data.location)
        : undefined,
    createdAt: assertTimestamp(data.createdAt, "createdAt"),
    expiresAt:
      data.expiresAt === null || data.expiresAt === undefined
        ? null
        : assertTimestamp(data.expiresAt, "expiresAt"),
    viewCount: Number(data.viewCount ?? 0),
    boostUntil:
      data.boostUntil instanceof Timestamp ? data.boostUntil : undefined,
    topUntil:
      data.topUntil instanceof Timestamp ? data.topUntil : undefined,
  };
}

function toUser(id: string, data: DocumentData): User {
  const role = data.role === "admin" ? "admin" : "user";
  return {
    id,
    phone: String(data.phone ?? ""),
    email:
      data.email !== undefined && data.email !== null
        ? String(data.email)
        : undefined,
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

function toApplicationStatus(v: unknown): ApplicationStatus {
  if (v === "accepted" || v === "rejected") return v;
  return "pending";
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
    applicantName: String(data.applicantName ?? ""),
    applicantEmail: String(data.applicantEmail ?? ""),
    message:
      data.message !== undefined && data.message !== null
        ? String(data.message)
        : undefined,
    contractLog,
    status: toApplicationStatus(data.status),
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

/** URL 필터와 동일한 키 — 값이 비어 있으면 해당 조건은 쿼리에 포함하지 않음 */
export type AnimalListFilters = {
  species?: string;
  neuter?: string;
  vaccine?: string;
  region?: string;
};

/**
 * 동물 목록 페이지 (커서 기반). `pageSize+1`건을 읽어 `hasMore`를 판별합니다.
 * `where` + `orderBy("createdAt")` 조합은 Firestore 복합 인덱스가 필요할 수 있습니다.
 */
export async function listAnimalsPage(
  filters: AnimalListFilters,
  pageSize: number,
  cursor: QueryDocumentSnapshot<DocumentData> | null,
): Promise<{
  animals: Animal[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}> {
  const constraints: QueryConstraint[] = [];
  if (filters.species) {
    constraints.push(where("speciesCode", "==", filters.species));
  }
  if (filters.neuter) {
    constraints.push(where("neuterStatus", "==", filters.neuter));
  }
  if (filters.vaccine) {
    constraints.push(where("vaccineStatus", "==", filters.vaccine));
  }
  if (filters.region) {
    constraints.push(where("region", "==", filters.region));
  }
  constraints.push(orderBy("createdAt", "desc"));
  if (cursor) {
    constraints.push(startAfter(cursor));
  }
  constraints.push(limit(pageSize + 1));

  const q = query(collection(db, COLLECTIONS.animals), ...constraints);
  const snaps = await getDocs(q);
  const docs = snaps.docs;
  if (docs.length === 0) {
    return { animals: [], lastDoc: null, hasMore: false };
  }
  const hasMore = docs.length > pageSize;
  const pageDocs = hasMore ? docs.slice(0, pageSize) : docs;
  const animals = pageDocs.map((d) => toAnimal(d.id, d.data()));
  const lastDoc =
    pageDocs.length > 0 ? pageDocs[pageDocs.length - 1]! : null;
  return { animals, lastDoc, hasMore };
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

export async function incrementUserRegisteredCount(userId: string): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.users, userId), {
    registeredCount: increment(1),
  });
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

// ——— payments ———

export async function createPayment(input: PaymentCreateInput): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTIONS.payments), input);
  return ref.id;
}
