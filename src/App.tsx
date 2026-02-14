import { useState, useRef, useEffect, useCallback } from "react";
import AuthGate from "./components/AuthGate";
import AuthBar from "./components/AuthBar";
import ProgressRing from "./components/ProgressRing";
import Carousel from "./components/Carousel";
import CalendarGrid from "./components/CalendarGrid";
import BookModal from "./components/BookModal";
import Tooltip from "./components/Tooltip";
import { generateInitialData } from "./data/calendar";
import { useAuth } from "./hooks/useAuth";
import { useCloudStorage } from "./hooks/useCloudStorage";
import type { DaysMap } from "./types";
import "./App.css";

/* ── localStorage helpers ── */

type SavedDay = {
  image: string | null;
  read: boolean;
  favorite?: boolean;
  notes?: string;
  book?: {
    title: string;
    author?: string;
    description?: string;
    emoji: string;
    color: string;
  };
};

function storageKey(uid: string | null, y: number, m: number) {
  return `kira-calendar-${uid || "local"}-${y}-${m}`;
}

function saveToStorage(
  uid: string | null,
  y: number,
  m: number,
  days: DaysMap,
) {
  const toSave: Record<number, SavedDay> = {};
  for (const [k, v] of Object.entries(days)) {
    if (
      v.image ||
      v.read ||
      v.favorite ||
      v.notes ||
      v.book.author ||
      v.book.description
    ) {
      toSave[Number(k)] = {
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
    }
  }
  if (Object.keys(toSave).length > 0) {
    localStorage.setItem(storageKey(uid, y, m), JSON.stringify(toSave));
  } else {
    localStorage.removeItem(storageKey(uid, y, m));
  }
}

function loadFromStorage(
  uid: string | null,
  y: number,
  m: number,
  base: DaysMap,
): DaysMap {
  const raw = localStorage.getItem(storageKey(uid, y, m));
  if (!raw) return base;
  try {
    const saved: Record<number, SavedDay> = JSON.parse(raw);
    const result = { ...base };
    for (const [k, v] of Object.entries(saved)) {
      const day = Number(k);
      if (result[day]) {
        result[day] = {
          ...result[day],
          image: v.image,
          read: v.read,
          favorite: v.favorite || false,
          notes: v.notes || "",
          book: v.book
            ? { ...result[day].book, ...v.book }
            : result[day].book,
        };
      }
    }
    return result;
  } catch {
    return base;
  }
}

/* ── Image compression ── */

function compressImage(file: File, maxSize: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      const maxDim = 300;
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      let quality = 0.8;
      let result = canvas.toDataURL("image/jpeg", quality);
      while (result.length > maxSize && quality > 0.1) {
        quality -= 0.1;
        result = canvas.toDataURL("image/jpeg", quality);
      }
      resolve(result);
    };
    img.src = url;
  });
}

/* ── App ── */

export default function App() {
  const now = new Date();
  const { user, loading: authLoading, login, logout } = useAuth();

  // Date & data state
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [days, setDays] = useState<DaysMap>(() => {
    const base = generateInitialData(now.getFullYear(), now.getMonth());
    return loadFromStorage(null, now.getFullYear(), now.getMonth(), base);
  });

  // UI state
  const [modal, setModal] = useState<number | null>(null);
  const [modalAutoOcr, setModalAutoOcr] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [calendarView, setCalendarView] = useState<
    "week" | "biweek" | "month"
  >("biweek");
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<{
    day: number;
    x: number;
    y: number;
  } | null>(null);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevUidRef = useRef<string | null | undefined>(undefined);
  const longPressRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  /* ── Effects ── */

  // Reset data when user changes (login / logout / switch account)
  useEffect(() => {
    if (authLoading) return;
    const currentUid = user?.uid ?? null;
    if (prevUidRef.current === undefined) {
      prevUidRef.current = currentUid;
      if (currentUid) {
        const base = generateInitialData(year, month);
        setDays(loadFromStorage(currentUid, year, month, base)); // eslint-disable-line react-hooks/set-state-in-effect
      }
      return;
    }
    if (prevUidRef.current === currentUid) return;
    prevUidRef.current = currentUid;
    const base = generateInitialData(year, month);
    setDays(loadFromStorage(currentUid, year, month, base));
    setModal(null);
  }, [user?.uid, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // localStorage persistence
  useEffect(() => {
    saveToStorage(user?.uid ?? null, year, month, days);
  }, [days, year, month, user?.uid]);

  // Cloud sync
  const applyCloud = useCallback(
    (saved: Record<number, SavedDay>) => {
      setDays((prev) => {
        const result = { ...prev };
        for (const [k, v] of Object.entries(saved)) {
          const day = Number(k);
          if (result[day]) {
            result[day] = {
              ...result[day],
              image: v.image,
              read: v.read,
              favorite: v.favorite || false,
              notes: v.notes || "",
              book: v.book
                ? { ...result[day].book, ...v.book }
                : result[day].book,
            };
          }
        }
        return result;
      });
    },
    [],
  );

  useCloudStorage(user, year, month, days, applyCloud);

  /* ── Handlers ── */

  const navigateMonth = (dir: number) => {
    let nm = month + dir;
    let ny = year;
    if (nm < 0) {
      nm = 11;
      ny--;
    }
    if (nm > 11) {
      nm = 0;
      ny++;
    }
    setYear(ny);
    setMonth(nm);
    const base = generateInitialData(ny, nm);
    setDays(loadFromStorage(user?.uid ?? null, ny, nm, base));
    setSelectedDay(null);
    setModal(null);
  };

  const toggleRead = (day: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDays((prev) => ({
      ...prev,
      [day]: { ...prev[day], read: !prev[day].read },
    }));
  };

  const toggleFavorite = (day: number) => {
    setDays((prev) => ({
      ...prev,
      [day]: { ...prev[day], favorite: !prev[day].favorite },
    }));
  };

  const triggerUpload = (day: number) => {
    setSelectedDay(day);
    fileInputRef.current?.click();
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && selectedDay) {
      const compressed = await compressImage(file, 25_000);
      const day = selectedDay;
      setDays((prev) => ({
        ...prev,
        [day]: { ...prev[day], image: compressed },
      }));
      setModal(day);
      setModalAutoOcr(true);
    }
    e.target.value = "";
  };

  const clearImage = (day: number) => {
    setDays((prev) => ({
      ...prev,
      [day]: { ...prev[day], image: null },
    }));
  };

  const updateNotes = (day: number, text: string) => {
    setDays((prev) => ({
      ...prev,
      [day]: { ...prev[day], notes: text },
    }));
  };

  const updateBook = (
    day: number,
    book: { title: string; author: string },
  ) => {
    setDays((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        book: {
          ...prev[day].book,
          title: book.title || prev[day].book.title,
          author: book.author,
        },
      },
    }));
  };

  // Tooltip handlers
  const showTooltip = (day: number, e: React.MouseEvent) => {
    if (!days[day]?.notes) return;
    setTooltip({ day, x: e.clientX, y: e.clientY });
  };

  const hideTooltip = () => {
    setTooltip(null);
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = undefined;
    }
  };

  const touchStartTooltip = (day: number, e: React.TouchEvent) => {
    if (!days[day]?.notes) return;
    const touch = e.touches[0];
    longPressRef.current = setTimeout(() => {
      setTooltip({ day, x: touch.clientX, y: touch.clientY });
    }, 500);
  };

  /* ── Computed ── */

  const isCurrentMonth =
    year === now.getFullYear() && month === now.getMonth();
  const readCount = Object.values(days).filter((d) => d.read).length;
  const totalCount = Object.keys(days).length;

  /* ── Render ── */

  // Auth gate
  if (authLoading || !user) {
    return <AuthGate loading={authLoading} login={login} />;
  }

  return (
    <div className="rc-root">
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={onFileChange}
        style={{ display: "none" }}
      />

      <div className="rc-container">
        <AuthBar user={user} logout={logout} />

        {/* CoverFlow Carousel (current month only) */}
        <Carousel
          days={days}
          year={year}
          month={month}
          weekOffset={weekOffset}
          onWeekOffsetChange={setWeekOffset}
          onOpenModal={setModal}
        />

        {/* Non-current-month header fallback */}
        {!isCurrentMonth && (
          <div className="rc-carousel-header" style={{ marginBottom: 20 }}>
            <div>
              <h1 className="rc-title">{"📚 Kira 愛讀冊"}</h1>
              <p className="rc-subtitle">
                {"每日一書 · track your daily reads"}
              </p>
            </div>
            <ProgressRing readCount={readCount} totalCount={totalCount} />
          </div>
        )}

        {/* Calendar Grid */}
        <CalendarGrid
          days={days}
          year={year}
          month={month}
          calendarView={calendarView}
          onViewChange={setCalendarView}
          onNavigateMonth={navigateMonth}
          onOpenModal={setModal}
          onToggleRead={toggleRead}
          onShowTooltip={showTooltip}
          onHideTooltip={hideTooltip}
          onTouchStartTooltip={touchStartTooltip}
          onTouchEndTooltip={hideTooltip}
        />
      </div>

      {/* Notes Tooltip */}
      <Tooltip tooltip={tooltip} days={days} />

      {/* Book Modal */}
      {modal && days[modal] && (
        <BookModal
          day={modal}
          dayData={days[modal]}
          month={month}
          autoOcr={modalAutoOcr}
          onClose={() => {
            setModal(null);
            setModalAutoOcr(false);
          }}
          onUpload={triggerUpload}
          onToggleRead={toggleRead}
          onToggleFavorite={toggleFavorite}
          onClearImage={clearImage}
          onUpdateNotes={updateNotes}
          onUpdateBook={updateBook}
          onAutoOcrHandled={() => setModalAutoOcr(false)}
        />
      )}
    </div>
  );
}
