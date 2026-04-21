import { useMemo } from "react";

export type CompletionScoreLevel = "낮음" | "보통" | "높음";

export type CompletionScoreInput = {
  /** 사진 URL 등 — 개수로만 판정 */
  photos?: readonly string[] | null;
  name?: string | null;
  age?: number | string | null;
  /** 성격 설명 — 50자 이상이면 가점 */
  personality?: string | null;
  /** 건강 상태 */
  health?: string | null;
  /** 중성화 여부 — 선택·입력이 있으면 완료로 간주 */
  neuter?: boolean | "done" | "pending" | string | null;
  /** 파양 사유 */
  surrenderReason?: string | null;
};

const PERSONALITY_MIN_LEN = 50;

function trim(s: string | null | undefined): string {
  return (s ?? "").trim();
}

function hasName(name: string | null | undefined): boolean {
  return trim(name).length > 0;
}

function hasAge(age: number | string | null | undefined): boolean {
  if (age === null || age === undefined) return false;
  if (typeof age === "number") return !Number.isNaN(age) && age >= 0;
  return trim(age).length > 0;
}

function personalityLen(personality: string | null | undefined): number {
  return trim(personality).length;
}

function hasHealth(health: string | null | undefined): boolean {
  return trim(health).length > 0;
}

function hasNeuter(
  neuter: boolean | "done" | "pending" | string | null | undefined,
): boolean {
  if (neuter === null || neuter === undefined) return false;
  if (typeof neuter === "boolean") return true;
  if (neuter === "done" || neuter === "pending") return true;
  return trim(neuter).length > 0;
}

function hasSurrenderReason(reason: string | null | undefined): boolean {
  return trim(reason).length > 0;
}

function levelFromScore(score: number): CompletionScoreLevel {
  if (score <= 39) return "낮음";
  if (score <= 69) return "보통";
  return "높음";
}

function computeCompletionScore(input: CompletionScoreInput): {
  score: number;
  level: CompletionScoreLevel;
  missingFields: string[];
} {
  const photos = input.photos ?? [];
  const photoCount = Array.isArray(photos) ? photos.length : 0;

  let raw = 0;
  if (photoCount >= 1) raw += 15;
  if (photoCount >= 3) raw += 25;

  if (hasName(input.name)) raw += 10;
  if (hasAge(input.age)) raw += 10;
  if (personalityLen(input.personality) >= PERSONALITY_MIN_LEN) raw += 20;
  if (hasHealth(input.health)) raw += 10;
  if (hasNeuter(input.neuter)) raw += 10;
  if (hasSurrenderReason(input.surrenderReason)) raw += 15;

  const score = Math.min(100, Math.max(0, raw));

  const missingFields: string[] = [];
  if (photoCount < 1) missingFields.push("사진");
  else if (photoCount < 3) missingFields.push("사진 (3장 이상)");
  if (!hasName(input.name)) missingFields.push("이름");
  if (!hasAge(input.age)) missingFields.push("나이");
  if (personalityLen(input.personality) < PERSONALITY_MIN_LEN) {
    missingFields.push("성격 설명 (50자 이상)");
  }
  if (!hasHealth(input.health)) missingFields.push("건강 상태");
  if (!hasNeuter(input.neuter)) missingFields.push("중성화 여부");
  if (!hasSurrenderReason(input.surrenderReason)) missingFields.push("파양 사유");

  return {
    score,
    level: levelFromScore(score),
    missingFields,
  };
}

/**
 * 공고 완성도 점수(0–100), 단계, 미입력 항목 라벨을 계산합니다.
 * `input` 객체는 필드 단위로 메모이즈되므로, 폼에서는 값이 바뀔 때만 새 객체를 넘기면 됩니다.
 */
export function useCompletionScore(input: CompletionScoreInput): {
  score: number;
  level: CompletionScoreLevel;
  missingFields: string[];
} {
  const {
    photos,
    name,
    age,
    personality,
    health,
    neuter,
    surrenderReason,
  } = input;

  const photoLen = photos?.length ?? 0;

  return useMemo(
    () =>
      computeCompletionScore({
        photos,
        name,
        age,
        personality,
        health,
        neuter,
        surrenderReason,
      }),
    [photoLen, name, age, personality, health, neuter, surrenderReason],
  );
}
