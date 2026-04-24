"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { signInAnonymously } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  subscribeToChatMeta,
  subscribeToMessages,
  subscribeToLastRead,
  sendTextMessage,
  sendPhotoMessage,
  uploadChatPhoto,
  updateLastRead,
  type ChatMeta,
  type ChatMessage,
} from "@/lib/chat";

// ——— Helpers ———

function formatTime(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const period = h < 12 ? "오전" : "오후";
  return `${period} ${h % 12 || 12}:${m}`;
}

// ——— Sub-components ———

function Skeleton() {
  return (
    <div
      className="mx-auto flex max-w-lg flex-col"
      style={{ height: "100dvh" }}
    >
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-zinc-100 bg-white px-4">
        <div className="h-4 w-4 animate-pulse rounded bg-zinc-200" />
        <div className="h-5 w-32 animate-pulse rounded bg-zinc-200" />
      </div>
      <div className="flex-1 space-y-3 p-4">
        {[40, 60, 45, 70, 50].map((w, i) => (
          <div
            key={i}
            className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}
          >
            <div
              className="h-9 animate-pulse rounded-2xl bg-zinc-200"
              style={{ width: `${w}%` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function SystemMessage({ text }: { text: string }) {
  return (
    <div className="flex justify-center py-1">
      <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-500">
        {text}
      </span>
    </div>
  );
}

function MessageBubble({
  msg,
  isOwn,
  showReadMark,
}: {
  msg: ChatMessage;
  isOwn: boolean;
  showReadMark: boolean;
}) {
  if (msg.type === "system") {
    return <SystemMessage text={msg.text ?? ""} />;
  }

  return (
    <div className={`flex items-end gap-1.5 ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar placeholder for other user */}
      {!isOwn && (
        <div className="mb-5 h-8 w-8 shrink-0 rounded-full bg-zinc-300" />
      )}

      <div className={`flex flex-col gap-0.5 ${isOwn ? "items-end" : "items-start"} max-w-[68%]`}>
        <div
          className={`rounded-2xl px-3 py-2 ${
            isOwn
              ? "rounded-br-sm bg-[#1a2744] text-white"
              : "rounded-bl-sm bg-white text-zinc-900 shadow-sm ring-1 ring-black/5"
          }`}
        >
          {msg.type === "photo" && msg.photoUrl ? (
            <a
              href={msg.photoUrl}
              target="_blank"
              rel="noreferrer"
              className="block"
            >
              <Image
                src={msg.photoUrl}
                alt="전송된 사진"
                width={220}
                height={165}
                className="rounded-lg object-cover"
                unoptimized
              />
            </a>
          ) : (
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {msg.text}
            </p>
          )}
        </div>

        <div className={`flex items-center gap-1 ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
          {isOwn && showReadMark && (
            <span className="text-[10px] text-zinc-400">읽음</span>
          )}
          <span className="text-[10px] text-zinc-400">
            {formatTime(msg.createdAt)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ——— Main component ———

type ViewState = "loading" | "denied" | "not_found" | "ready";

export function ChatContent({ chatId }: { chatId: string }) {
  const router = useRouter();

  const [uid, setUid] = useState<string | null>(null);
  const [meta, setMeta] = useState<ChatMeta | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [lastRead, setLastRead] = useState<Record<string, number>>({});
  const [viewState, setViewState] = useState<ViewState>("loading");

  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completing, setCompleting] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Step 1: auth
  useEffect(() => {
    (async () => {
      try {
        if (!auth.currentUser) await signInAnonymously(auth);
        setUid(auth.currentUser?.uid ?? null);
      } catch {
        setViewState("denied");
      }
    })();
  }, []);

  // Step 2: subscribe once we have uid
  useEffect(() => {
    if (!uid) return;

    const unsubMeta = subscribeToChatMeta(chatId, (m) => {
      if (m === null) {
        setViewState("not_found");
        return;
      }
      if (m.ownerId !== uid && m.applicantId !== uid) {
        setViewState("denied");
        return;
      }
      setMeta(m);
      setViewState("ready");
    });

    const unsubMsgs = subscribeToMessages(chatId, (msgs) => {
      setMessages(msgs);
      updateLastRead(chatId, uid).catch(() => {});
    });

    const unsubLastRead = subscribeToLastRead(chatId, setLastRead);

    updateLastRead(chatId, uid).catch(() => {});

    return () => {
      unsubMeta();
      unsubMsgs();
      unsubLastRead();
    };
  }, [chatId, uid]);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Compute which messages show the "읽음" mark
  const readMarkedMessageId = (() => {
    if (!meta || !uid) return null;
    const otherId = meta.ownerId === uid ? meta.applicantId : meta.ownerId;
    const otherLastRead = lastRead[otherId] ?? 0;
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]!;
      if (m.senderId === uid && m.createdAt <= otherLastRead) {
        return m.id;
      }
    }
    return null;
  })();

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || sending || !uid) return;
    setSending(true);
    setInputText("");
    // Reset textarea height
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    try {
      await sendTextMessage(chatId, uid, text);
    } catch (err) {
      setInputText(text);
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }, [chatId, inputText, sending, uid]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  function handleTextareaInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInputText(e.target.value);
    // Auto-resize
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || uploading || !uid) return;
    e.target.value = "";
    setUploading(true);
    try {
      const url = await uploadChatPhoto(chatId, file);
      await sendPhotoMessage(chatId, uid, url);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  }

  async function handleComplete() {
    if (completing) return;
    setCompleting(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("로그인이 필요합니다.");
      const idToken = await user.getIdToken();
      const res = await fetch("/api/chat/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ applicationId: chatId }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "처리에 실패했습니다.");
      setShowCompleteModal(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setCompleting(false);
    }
  }

  // ——— Render: loading / error states ———

  if (viewState === "loading") return <Skeleton />;

  if (viewState === "not_found") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 text-center">
          <p className="font-semibold text-zinc-900">채팅방을 찾을 수 없습니다</p>
          <button
            type="button"
            onClick={() => router.back()}
            className="mt-4 rounded-xl bg-[#1a2744] px-5 py-2.5 text-sm font-semibold text-white"
          >
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  if (viewState === "denied") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="font-semibold text-red-900">접근 권한이 없습니다</p>
          <p className="mt-1 text-sm text-red-700">채팅 참여자만 이 페이지에 접근할 수 있습니다.</p>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="mt-4 rounded-xl bg-[#1a2744] px-5 py-2.5 text-sm font-semibold text-white"
          >
            홈으로
          </button>
        </div>
      </div>
    );
  }

  if (!meta) return null;

  const isOwner = uid === meta.ownerId;
  const isCompleted = meta.status === "completed";

  // ——— Render: chat view ———

  return (
    <div
      className="mx-auto flex max-w-lg flex-col bg-zinc-50"
      style={{
        height: "100dvh",
        paddingBottom: "calc(60px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-100 bg-white px-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="뒤로가기"
            className="flex items-center text-zinc-500"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <p className="text-sm font-semibold text-zinc-900 leading-tight">
              {meta.animalName}
            </p>
            {isCompleted ? (
              <p className="text-xs text-green-600 font-medium">입양 완료</p>
            ) : (
              <p className="text-xs text-zinc-400">
                {isOwner ? "입양 희망자와 채팅 중" : "파양자와 채팅 중"}
              </p>
            )}
          </div>
        </div>

        {isOwner && !isCompleted && (
          <button
            type="button"
            onClick={() => setShowCompleteModal(true)}
            className="rounded-xl border border-[#1a2744] px-3 py-1.5 text-xs font-semibold text-[#1a2744]"
          >
            입양 완료
          </button>
        )}

        {isCompleted && (
          <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800">
            완료
          </span>
        )}
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="flex flex-col gap-2">
          {messages.length === 0 && (
            <p className="py-8 text-center text-sm text-zinc-400">
              첫 메시지를 보내보세요
            </p>
          )}
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              isOwn={msg.senderId === uid}
              showReadMark={msg.id === readMarkedMessageId}
            />
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-zinc-100 bg-white px-3 py-2">
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            aria-label="사진 전송"
            className="mb-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-500 disabled:opacity-50"
          >
            {uploading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4-4a3 3 0 014.24 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2zm8-15.5a.5.5 0 11-1 0 .5.5 0 011 0z" />
              </svg>
            )}
          </button>

          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={handleTextareaInput}
            onKeyDown={handleKeyDown}
            placeholder="메시지 입력…"
            rows={1}
            className="flex-1 resize-none rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm leading-relaxed outline-none focus:border-[#1a2744] focus:bg-white focus:ring-1 focus:ring-[#1a2744]"
            style={{ maxHeight: "120px" }}
          />

          <button
            type="button"
            onClick={handleSend}
            disabled={!inputText.trim() || sending}
            aria-label="전송"
            className="mb-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#1a2744] text-white disabled:opacity-40"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handlePhotoSelect}
        />
      </div>

      {/* 입양 완료 확인 모달 */}
      {showCompleteModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="complete-modal-title"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl ring-1 ring-black/10">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 id="complete-modal-title" className="text-center text-lg font-bold text-zinc-900">
              입양을 완료하시겠습니까?
            </h3>
            <p className="mt-2 text-center text-sm text-zinc-500">
              완료 처리 후 공고가 마감되며, 채팅은 기록으로 남습니다.
              이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setShowCompleteModal(false)}
                disabled={completing}
                className="flex-1 rounded-xl border border-zinc-200 py-3 text-sm font-semibold text-zinc-700 disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleComplete}
                disabled={completing}
                className="flex-1 rounded-xl bg-green-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {completing ? "처리 중…" : "입양 완료"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
