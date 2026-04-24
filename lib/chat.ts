import {
  ref,
  onValue,
  push,
  set,
  get,
  off,
  type DatabaseReference,
} from "firebase/database";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { rtdb, storage } from "./firebase";

// ——— Types ———

export type ChatStatus = "active" | "completed";
export type ChatMessageType = "text" | "photo" | "system";

export type ChatMeta = {
  animalId: string;
  animalName: string;
  ownerId: string;
  applicantId: string;
  createdAt: number;
  status: ChatStatus;
  completedAt?: number;
};

export type ChatMessage = {
  id: string;
  senderId: string;
  text?: string;
  photoUrl?: string;
  type: ChatMessageType;
  createdAt: number;
};

// ——— RTDB path helpers ———

function chatMetaRef(chatId: string): DatabaseReference {
  return ref(rtdb, `chats/${chatId}/meta`);
}

function chatMessagesRef(chatId: string): DatabaseReference {
  return ref(rtdb, `chats/${chatId}/messages`);
}

function chatLastReadRef(chatId: string): DatabaseReference {
  return ref(rtdb, `chats/${chatId}/lastRead`);
}

// ——— Subscriptions ———

export function subscribeToChatMeta(
  chatId: string,
  callback: (meta: ChatMeta | null) => void,
): () => void {
  const r = chatMetaRef(chatId);
  const listener = onValue(r, (snap) => {
    callback(snap.exists() ? (snap.val() as ChatMeta) : null);
  });
  return () => off(r, "value", listener);
}

export function subscribeToMessages(
  chatId: string,
  callback: (messages: ChatMessage[]) => void,
): () => void {
  const r = chatMessagesRef(chatId);
  const listener = onValue(r, (snap) => {
    if (!snap.exists()) {
      callback([]);
      return;
    }
    const msgs: ChatMessage[] = [];
    snap.forEach((child) => {
      const val = child.val() as Omit<ChatMessage, "id">;
      msgs.push({ id: child.key!, ...val });
    });
    msgs.sort((a, b) => a.createdAt - b.createdAt);
    callback(msgs);
  });
  return () => off(r, "value", listener);
}

export function subscribeToLastRead(
  chatId: string,
  callback: (lastRead: Record<string, number>) => void,
): () => void {
  const r = chatLastReadRef(chatId);
  const listener = onValue(r, (snap) => {
    callback(snap.exists() ? (snap.val() as Record<string, number>) : {});
  });
  return () => off(r, "value", listener);
}

// ——— Writes ———

export async function sendTextMessage(
  chatId: string,
  senderId: string,
  text: string,
): Promise<void> {
  const newRef = push(chatMessagesRef(chatId));
  await set(newRef, {
    senderId,
    text,
    type: "text" as ChatMessageType,
    createdAt: Date.now(),
  });
}

export async function sendPhotoMessage(
  chatId: string,
  senderId: string,
  photoUrl: string,
): Promise<void> {
  const newRef = push(chatMessagesRef(chatId));
  await set(newRef, {
    senderId,
    photoUrl,
    type: "photo" as ChatMessageType,
    createdAt: Date.now(),
  });
}

export async function updateLastRead(
  chatId: string,
  userId: string,
): Promise<void> {
  await set(ref(rtdb, `chats/${chatId}/lastRead/${userId}`), Date.now());
}

// ——— Storage ———

export async function uploadChatPhoto(
  chatId: string,
  file: File,
): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `chatPhotos/${chatId}/${Date.now()}.${ext}`;
  const sRef = storageRef(storage, path);
  await uploadBytes(sRef, file);
  return getDownloadURL(sRef);
}

// ——— One-shot read (for server validation is handled in API routes) ———

export async function getChatMeta(chatId: string): Promise<ChatMeta | null> {
  const snap = await get(chatMetaRef(chatId));
  return snap.exists() ? (snap.val() as ChatMeta) : null;
}
