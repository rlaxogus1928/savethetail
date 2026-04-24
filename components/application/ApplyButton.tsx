"use client";

import { useState } from "react";
import { signInAnonymously } from "firebase/auth";
import { auth } from "@/lib/firebase";

type Props = {
  animalId: string;
  animalName: string;
};

type FormState = "idle" | "open" | "submitting" | "done" | "error";

export function ApplyButton({ animalId, animalName }: Props) {
  const [state, setState] = useState<FormState>("idle");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function openModal() {
    setState("open");
    setErrorMsg(null);
  }

  function closeModal() {
    setState("idle");
    setErrorMsg(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (state === "submitting") return;
    setState("submitting");
    setErrorMsg(null);

    try {
      if (!auth.currentUser) {
        await signInAnonymously(auth);
      }
      const user = auth.currentUser;
      if (!user) throw new Error("로그인에 실패했습니다.");

      const idToken = await user.getIdToken();
      const res = await fetch("/api/application/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          animalId,
          applicantName: name.trim(),
          applicantEmail: email.trim(),
          message: message.trim() || undefined,
        }),
      });

      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "신청에 실패했습니다.");

      setState("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-center text-sm text-green-800">
        입양 신청이 완료되었습니다! 파양자가 검토 후 연락드릴 예정입니다.
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="w-full rounded-xl bg-[#1a2744] py-3 text-sm font-semibold text-white"
      >
        입양 신청하기
      </button>

      {(state === "open" || state === "submitting" || state === "error") && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-4 backdrop-blur-[2px] sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="apply-modal-title"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl ring-1 ring-black/10">
            <h2
              id="apply-modal-title"
              className="text-lg font-bold text-zinc-900"
            >
              입양 신청 — {animalName}
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              신청 완료 후 파양자에게 알림이 발송됩니다.
            </p>

            <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">
                  이름 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="홍길동"
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-[#1a2744] focus:ring-1 focus:ring-[#1a2744]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">
                  이메일 <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="example@email.com"
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-[#1a2744] focus:ring-1 focus:ring-[#1a2744]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">
                  신청 메시지
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  placeholder="자기소개, 입양 동기 등을 자유롭게 작성해 주세요."
                  className="w-full resize-none rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-[#1a2744] focus:ring-1 focus:ring-[#1a2744]"
                />
              </div>

              {errorMsg ? (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
                  {errorMsg}
                </p>
              ) : null}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={state === "submitting"}
                  className="flex-1 rounded-xl border border-zinc-200 py-3 text-sm font-semibold text-zinc-700 disabled:opacity-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={state === "submitting"}
                  className="flex-1 rounded-xl bg-[#1a2744] py-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {state === "submitting" ? "신청 중…" : "신청 완료"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
