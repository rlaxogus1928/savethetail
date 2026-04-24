import { Suspense } from "react";
import { ChatContent } from "@/components/chat/ChatContent";

function ChatFallback() {
  return (
    <div
      className="mx-auto flex max-w-lg flex-col"
      style={{ height: "100dvh" }}
    >
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-zinc-100 bg-white px-4">
        <div className="h-4 w-4 animate-pulse rounded bg-zinc-200" />
        <div className="h-5 w-32 animate-pulse rounded bg-zinc-200" />
      </div>
      <div className="flex-1 space-y-3 bg-zinc-50 p-4">
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

export default async function ChatPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;

  return (
    <Suspense fallback={<ChatFallback />}>
      <ChatContent chatId={applicationId} />
    </Suspense>
  );
}
