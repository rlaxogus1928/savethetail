"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const chipBase =
  "shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium transition-colors";

const chipActive = `${chipBase} bg-[#1a2744] text-white`;
const chipInactive = `${chipBase} bg-zinc-100 text-zinc-800 ring-1 ring-black/5 hover:bg-zinc-200`;

const SPECIES_OPTIONS = [
  { value: "", label: "전체" },
  { value: "dog", label: "강아지" },
  { value: "cat", label: "고양이" },
  { value: "other", label: "기타" },
] as const;

const STATUS_OPTIONS = [
  { value: "", label: "전체" },
  { value: "done", label: "완료" },
  { value: "pending", label: "미완료" },
] as const;

/** 행정구역(시·도) — 전체는 쿼리 생략으로 표현 */
const KOREAN_REGIONS = [
  "서울특별시",
  "부산광역시",
  "대구광역시",
  "인천광역시",
  "광주광역시",
  "대전광역시",
  "울산광역시",
  "세종특별자치시",
  "경기도",
  "강원특별자치도",
  "충청북도",
  "충청남도",
  "전북특별자치도",
  "전라남도",
  "경상북도",
  "경상남도",
  "제주특별자치도",
] as const;

function FilterGroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="shrink-0 self-center text-xs font-semibold text-zinc-400">
      {children}
    </span>
  );
}

function GroupDivider() {
  return (
    <span
      className="mx-1 shrink-0 self-stretch w-px bg-zinc-200"
      aria-hidden
    />
  );
}

type FilterBarProps = {
  className?: string;
};

export function FilterBar({ className }: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const species = searchParams.get("species") ?? "";
  const neuter = searchParams.get("neuter") ?? "";
  const vaccine = searchParams.get("vaccine") ?? "";
  const region = searchParams.get("region") ?? "";

  const applyQuery = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") {
          next.delete(key);
        } else {
          next.set(key, value);
        }
      }
      const qs = next.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return (
    <nav
      aria-label="목록 필터"
      className={className}
    >
      <div className="-mx-1 flex overflow-x-auto px-1 pb-1 [scrollbar-width:thin] touch-pan-x">
        <div className="flex min-w-min items-center gap-2 py-1">
          <FilterGroupLabel>종류</FilterGroupLabel>
          {SPECIES_OPTIONS.map(({ value, label }) => {
            const active = species === value;
            return (
              <button
                key={value || "all"}
                type="button"
                onClick={() => applyQuery({ species: value || null })}
                className={active ? chipActive : chipInactive}
                aria-pressed={active}
              >
                {label}
              </button>
            );
          })}

          <GroupDivider />
          <FilterGroupLabel>중성화</FilterGroupLabel>
          {STATUS_OPTIONS.map(({ value, label }) => {
            const active = neuter === value;
            return (
              <button
                key={`neuter-${value || "all"}`}
                type="button"
                onClick={() => applyQuery({ neuter: value || null })}
                className={active ? chipActive : chipInactive}
                aria-pressed={active}
              >
                {label}
              </button>
            );
          })}

          <GroupDivider />
          <FilterGroupLabel>접종</FilterGroupLabel>
          {STATUS_OPTIONS.map(({ value, label }) => {
            const active = vaccine === value;
            return (
              <button
                key={`vaccine-${value || "all"}`}
                type="button"
                onClick={() => applyQuery({ vaccine: value || null })}
                className={active ? chipActive : chipInactive}
                aria-pressed={active}
              >
                {label}
              </button>
            );
          })}

          <GroupDivider />
          <FilterGroupLabel>지역</FilterGroupLabel>
          <button
            type="button"
            onClick={() => applyQuery({ region: null })}
            className={region === "" ? chipActive : chipInactive}
            aria-pressed={region === ""}
          >
            전체
          </button>
          {KOREAN_REGIONS.map((name) => {
            const active = region === name;
            return (
              <button
                key={name}
                type="button"
                onClick={() => applyQuery({ region: name })}
                className={active ? chipActive : chipInactive}
                aria-pressed={active}
              >
                {name}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
