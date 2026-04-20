"use client";

import {
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  type DocumentData,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "./firebase";
import { COLLECTIONS, PRICING_DOC_ID } from "./firestore";

/** `config/pricing` 문서 스키마 */
export type PricingPlan = {
  id: string;
  label: string;
  price: number;
  days: number;
};

export type PricingBoost = {
  id: string;
  label: string;
  price: number;
};

export type PricingDocument = {
  plans: PricingPlan[];
  boosts: PricingBoost[];
};

function pricingDocRef() {
  return doc(db, COLLECTIONS.config, PRICING_DOC_ID);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parsePlan(raw: unknown): PricingPlan | null {
  if (!isRecord(raw)) return null;
  return {
    id: String(raw.id ?? ""),
    label: String(raw.label ?? ""),
    price: Number(raw.price ?? 0),
    days: Number(raw.days ?? 0),
  };
}

function parseBoost(raw: unknown): PricingBoost | null {
  if (!isRecord(raw)) return null;
  return {
    id: String(raw.id ?? ""),
    label: String(raw.label ?? ""),
    price: Number(raw.price ?? 0),
  };
}

export function parsePricingDocument(data: DocumentData): PricingDocument {
  const plansRaw = data.plans;
  const boostsRaw = data.boosts;
  const plans = Array.isArray(plansRaw)
    ? plansRaw.map(parsePlan).filter((p): p is PricingPlan => p !== null)
    : [];
  const boosts = Array.isArray(boostsRaw)
    ? boostsRaw.map(parseBoost).filter((b): b is PricingBoost => b !== null)
    : [];
  return { plans, boosts };
}

/**
 * Firestore에 최초 시드할 때만 사용합니다.
 * 런타임 UI·결제 로직은 반드시 `usePricingConfig` / `fetchPricingConfig`로 불러온 값만 사용하세요.
 */
export async function seedPricingDocument(): Promise<void> {
  await setDoc(pricingDocRef(), SEED_PRICING_DOCUMENT);
}

export async function savePricingDocument(
  data: PricingDocument
): Promise<void> {
  await setDoc(pricingDocRef(), data);
}

export async function fetchPricingConfig(): Promise<PricingDocument | null> {
  const snap = await getDoc(pricingDocRef());
  if (!snap.exists()) return null;
  return parsePricingDocument(snap.data());
}

export type UsePricingConfigResult = {
  data: PricingDocument | null;
  loading: boolean;
  error: Error | null;
};

/**
 * 요금·부스트 금액은 이 훅으로 불러온 `data`만 사용하세요. (문자열 리터럴 금액 금지)
 */
export function usePricingConfig(): UsePricingConfigResult {
  const [data, setData] = useState<PricingDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const ref = pricingDocRef();
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setData(null);
          setError(null);
          setLoading(false);
          return;
        }
        try {
          setData(parsePricingDocument(snap.data()));
          setError(null);
        } catch (e) {
          setError(e instanceof Error ? e : new Error(String(e)));
        }
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  return { data, loading, error };
}

export function getPlanById(
  docData: PricingDocument | null,
  id: string
): PricingPlan | undefined {
  return docData?.plans.find((p) => p.id === id);
}

export function getBoostById(
  docData: PricingDocument | null,
  id: string
): PricingBoost | undefined {
  return docData?.boosts.find((b) => b.id === id);
}

/** @internal Firestore 시드 전용 — 앱에서는 import하지 마세요. */
const SEED_PRICING_DOCUMENT: PricingDocument = {
  plans: [
    { id: "free", label: "최초 1회 무료", price: 0, days: 14 },
    { id: "basic", label: "7일", price: 19000, days: 7 },
    { id: "standard", label: "14일", price: 29000, days: 14 },
    { id: "premium", label: "30일", price: 49000, days: 30 },
  ],
  boosts: [
    { id: "bump", label: "끌어올리기", price: 3900 },
    { id: "top", label: "상단 노출 3일", price: 9900 },
  ],
};
