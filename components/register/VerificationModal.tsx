"use client";

const IS_DEV = process.env.NODE_ENV === "development";

type VerificationModalProps = {
  open: boolean;
  busy: boolean;
  error: string | null;
  onVerify: () => void;
  onDevSkip?: () => void;
  email: string;
  onEmailChange: (v: string) => void;
};

export function VerificationModal({
  open,
  busy,
  error,
  onVerify,
  onDevSkip,
  email,
  onEmailChange,
}: VerificationModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="verify-modal-title"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl ring-1 ring-black/10">
        <h2
          id="verify-modal-title"
          className="text-lg font-bold text-zinc-900"
        >
          본인인증 필요
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          안전한 파양 공고 등록을 위해 휴대폰 본인인증을 완료해 주세요. 포트원
          본인인증 창이 열립니다.
        </p>

        <div className="mt-4">
          <label
            htmlFor="notif-email"
            className="block text-xs font-medium text-zinc-700"
          >
            이메일
            <span className="ml-1 font-normal text-zinc-400">
              (선택 · 알림 수신용)
            </span>
          </label>
          <input
            id="notif-email"
            type="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            disabled={busy}
            placeholder="example@email.com"
            autoComplete="email"
            className="mt-1.5 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-[#1a2744] focus:ring-1 focus:ring-[#1a2744] disabled:opacity-60"
          />
          <p className="mt-1 text-xs text-zinc-400">
            입양 신청 수신 등 서비스 알림에만 사용하며 외부에 공개되지 않습니다.
          </p>
        </div>

        {error ? (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={onVerify}
          disabled={busy}
          className="mt-4 w-full rounded-xl bg-[#1a2744] py-3 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "처리 중…" : "본인인증 하기"}
        </button>

        {IS_DEV && onDevSkip ? (
          <button
            type="button"
            onClick={onDevSkip}
            disabled={busy}
            className="mt-2 w-full rounded-xl border border-dashed border-amber-400 bg-amber-50 py-2.5 text-sm font-medium text-amber-800 transition-opacity disabled:opacity-50"
          >
            개발 모드 건너뛰기
          </button>
        ) : null}
      </div>
    </div>
  );
}
