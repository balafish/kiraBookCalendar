import { useEffect, useRef, useCallback } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import type { DaysMap } from "../types";
import type { User } from "firebase/auth";

type SavedDay = { image: string | null; read: boolean; notes?: string };
type SavedData = Record<number, SavedDay>;

function docPath(uid: string, y: number, m: number) {
  return doc(db, "users", uid, "calendars", `${y}-${m}`);
}

function extractSaveData(days: DaysMap): SavedData {
  const data: SavedData = {};
  for (const [k, v] of Object.entries(days)) {
    if (v.image || v.read || v.notes) {
      data[Number(k)] = { image: v.image, read: v.read, notes: v.notes || "" };
    }
  }
  return data;
}

export function useCloudStorage(
  user: User | null,
  year: number,
  month: number,
  days: DaysMap,
  applyCloud: (saved: SavedData) => void,
) {
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastSavedRef = useRef<string>("");

  // Load from Firestore when user or month changes
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    getDoc(docPath(user.uid, year, month)).then((snap) => {
      if (cancelled) return;
      if (snap.exists()) {
        applyCloud(snap.data() as SavedData);
      }
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, year, month]);

  // Save to Firestore (debounced)
  const saveToCloud = useCallback(() => {
    if (!user) return;

    const data = extractSaveData(days);
    const json = JSON.stringify(data);
    if (json === lastSavedRef.current) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      lastSavedRef.current = json;
      setDoc(docPath(user.uid, year, month), data);
    }, 1000);
  }, [user, days, year, month]);

  useEffect(() => {
    saveToCloud();
  }, [saveToCloud]);
}
