import Image from "next/image";
import Link from "next/link";

export type MatchScoreLevel = "낮음" | "보통" | "높음";

export type AnimalCardProps = {
  id: string;
  name: string;
  /** 강아지 / 고양이 / 기타 */
  species: string;
  age: string;
  photoUrl: string;
  /** 0–100 */
  completionScore: number;
  matchScore: MatchScoreLevel;
  location: string;
  daysLeft: number;
};

function clampPercent(n: number): number {
  return Math.min(100, Math.max(0, n));
}

function completionBarClass(score: number): string {
  const s = clampPercent(score);
  if (s < 40) return "bg-orange-500";
  if (s < 70) return "bg-yellow-400";
  return "bg-green-500";
}

function matchBadgeClass(level: MatchScoreLevel): string {
  switch (level) {
    case "낮음":
      return "border border-orange-200 bg-orange-100 text-orange-900";
    case "보통":
      return "border border-yellow-200 bg-yellow-100 text-yellow-900";
    case "높음":
      return "border border-green-200 bg-green-100 text-green-900";
    default:
      return "border border-zinc-200 bg-zinc-100 text-zinc-800";
  }
}

export function AnimalCard({
  id,
  name,
  species,
  age,
  photoUrl,
  completionScore,
  matchScore,
  location,
  daysLeft,
}: AnimalCardProps) {
  const pct = clampPercent(completionScore);
  const barFill = completionBarClass(completionScore);

  return (
    <Link
      href={`/animal/${id}`}
      className="block overflow-hidden rounded-2xl bg-[#f5f0e8] shadow-sm ring-1 ring-black/5 transition hover:shadow-md hover:ring-black/10"
    >
      <div className="relative aspect-[4/3] w-full bg-zinc-200">
        <Image
          src={photoUrl}
          alt={`${name} 사진`}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 400px"
          unoptimized
        />
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold shadow-sm ${matchBadgeClass(matchScore)}`}
          >
            매칭 {matchScore}
          </span>
        </div>
        <div className="absolute bottom-3 right-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
          {daysLeft <= 0 ? "마감" : `${daysLeft}일 남음`}
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 flex-1 truncate text-lg font-semibold text-zinc-900">
            {name}
          </h3>
          <span className="shrink-0 rounded-full bg-white/80 px-2 py-0.5 text-xs font-medium text-zinc-700 ring-1 ring-black/5">
            {species}
          </span>
        </div>

        <p className="text-sm text-zinc-600">
          {age}
          <span className="mx-1.5 text-zinc-400">·</span>
          {location}
        </p>

        <div>
          <div className="mb-1 flex items-center justify-between text-xs font-medium text-zinc-600">
            <span>완성도</span>
            <span className="tabular-nums text-zinc-800">{pct}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-black/10">
            <div
              className={`h-full rounded-full transition-[width] ${barFill}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}
