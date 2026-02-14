import { useEffect, useRef, useCallback } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import type { DaysMap } from "../types";
import type { User } from "firebase/auth";

type SavedDay = {
  image: string | null;
  read: boolean;
  favorite?: boolean;
  notes?: string;
  book?: { title: string; author?: string; description?: string; emoji: string; color: string };
};
type SavedData = Record<number, SavedDay>;

function docPath(uid: string, y: number, m: number) {
  return doc(db, "users", uid, "calendars", `${y}-${m}`);
}

function extractSaveData(days: DaysMap): SavedData {
  const data: SavedData = {};
  for (const [k, v] of Object.entries(days)) {
    if (v.image || v.read || v.favorite || v.notes || v.book.author || v.book.description) {
      const entry: SavedDay = {
        image: v.image,
        read: v.read,
        favorite: v.favorite || false,
        notes: v.notes || "",
        book: {
          title: v.book.title,
          author: v.book.author || "",
          description: v.book.description || "",
          emoji: v.book.emoji,
          color: v.book.color,
        },
      };
      data[Number(k)] = entry;
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
  const loadedRef = useRef(false);

  // Load from Firestore when user or month changes
  useEffect(() => {
    if (!user) return;
    loadedRef.current = false;
    let cancelled = false;

    getDoc(docPath(user.uid, year, month))
      .then((snap) => {
        if (cancelled) return;
        loadedRef.current = true;
        if (snap.exists()) {
          applyCloud(snap.data() as SavedData);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        loadedRef.current = true;
        console.error("Firestore load failed:", err);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, year, month]);

  // Save to Firestore (debounced, only after initial load completes)
  const saveToCloud = useCallback(() => {
    if (!user || !loadedRef.current) return;

    const data = extractSaveData(days);
    const json = JSON.stringify(data);
    if (json === lastSavedRef.current) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      lastSavedRef.current = json;
      setDoc(docPath(user.uid, year, month), data).catch((err) => {
        console.error("Firestore save failed:", err);
      });
    }, 1000);
  }, [user, days, year, month]);

  useEffect(() => {
    saveToCloud();
  }, [saveToCloud]);
}
