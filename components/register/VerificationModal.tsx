"use client";

type VerificationModalProps = {
  open: boolean;
  busy: boolean;
  error: string | null;
  onVerify: () => void;
};

export function VerificationModal({
  open,
  busy,
  error,
  onVerify,
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
        {error ? (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          onClick={onVerify}
          disabled={busy}
          className="mt-5 w-full rounded-xl bg-[#1a2744] py-3 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "처리 중…" : "본인인증 하기"}
        </button>
      </div>
    </div>
  );
}
