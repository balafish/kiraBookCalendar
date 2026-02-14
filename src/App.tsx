import { useState, useRef, useEffect, useCallback } from "react";
import BookCover from "./components/BookCover";
import { MONTH_NAMES, DAY_NAMES_FULL, DAY_NAMES_SHORT } from "./data/books";
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
  book?: { title: string; author?: string; description?: string; emoji: string; color: string };
};

function storageKey(uid: string | null, y: number, m: number) {
  return `kira-calendar-${uid || "local"}-${y}-${m}`;
}

function saveToStorage(uid: string | null, y: number, m: number, days: DaysMap) {
  const toSave: Record<number, SavedDay> = {};
  for (const [k, v] of Object.entries(days)) {
    if (v.image || v.read || v.favorite || v.notes || v.book.author || v.book.description) {
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

function loadFromStorage(uid: string | null, y: number, m: number, base: DaysMap): DaysMap {
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
          book: v.book ? { ...result[day].book, ...v.book } : result[day].book,
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
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
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

  // Calendar state
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [days, setDays] = useState(() => {
    const base = generateInitialData(now.getFullYear(), now.getMonth());
    return loadFromStorage(null, now.getFullYear(), now.getMonth(), base);
  });
  const [calendarView, setCalendarView] = useState<"week" | "biweek" | "month">("biweek");

  // Carousel state
  const [weekOffset, setWeekOffset] = useState(0);
  const weekTouchRef = useRef<{ startX: number; startY: number } | null>(null);

  // Modal state
  const [modal, setModal] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Notes state
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");

  // Tooltip state
  const [tooltip, setTooltip] = useState<{ day: number; x: number; y: number } | null>(null);
  const longPressRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Book edit state
  const [bookEditMode, setBookEditMode] = useState(false);
  const [bookEditTitle, setBookEditTitle] = useState("");
  const [bookEditAuthor, setBookEditAuthor] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [bookSearchResults, setBookSearchResults] = useState<any[]>([]);
  const [recognizing, setRecognizing] = useState(false);
  const [searching, setSearching] = useState(false);

  // User change tracking
  const prevUidRef = useRef<string | null | undefined>(undefined);

  /* ── Effects ── */

  // Reset data when user changes (login/logout/switch account)
  useEffect(() => {
    if (authLoading) return;
    const currentUid = user?.uid ?? null;
    if (prevUidRef.current === undefined) {
      prevUidRef.current = currentUid;
      if (currentUid) {
        const base = generateInitialData(year, month);
        setDays(loadFromStorage(currentUid, year, month, base));
      }
      return;
    }
    if (prevUidRef.current === currentUid) return;
    prevUidRef.current = currentUid;
    const base = generateInitialData(year, month);
    setDays(loadFromStorage(currentUid, year, month, base));
    closeModal();
    setEditingNotes(false);
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
              book: v.book ? { ...result[day].book, ...v.book } : result[day].book,
            };
          }
        }
        return result;
      });
    },
    [],
  );
  useCloudStorage(user, year, month, days, applyCloud);

  /* ── Derived values ── */

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const todayDayNum = now.getDate();
  const readCount = Object.values(days).filter((d) => d.read).length;
  const totalCount = Object.keys(days).length;
  const progress = Math.round((readCount / totalCount) * 100);

  /* ── Carousel computed ── */

  const carouselDays: {
    date: Date;
    dayNum: number;
    dayOfWeek: number;
    inMonth: boolean;
    offset: number;
    isToday: boolean;
  }[] = [];
  for (let i = -4; i <= 4; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + weekOffset + i);
    carouselDays.push({
      date: d,
      dayNum: d.getDate(),
      dayOfWeek: d.getDay(),
      inMonth: d.getFullYear() === year && d.getMonth() === month,
      offset: i,
      isToday: weekOffset + i === 0,
    });
  }
  const centerDay = carouselDays[4];
  const centerDayData = centerDay.inMonth ? days[centerDay.dayNum] : null;

  const carouselTransform = (offset: number): React.CSSProperties => {
    const abs = Math.abs(offset);
    if (abs > 3) return { opacity: 0, pointerEvents: "none", position: "absolute" };
    const tx = offset * 52;
    const ry = offset * -20;
    const tz = -abs * 100;
    const s = Math.max(1 - abs * 0.18, 0.5);
    const o = Math.max(1 - abs * 0.25, 0);
    return {
      transform: `translateX(${tx}%) rotateY(${ry}deg) translateZ(${tz}px) scale(${s})`,
      opacity: o,
      zIndex: 10 - abs,
      position: "absolute",
      pointerEvents: abs > 2 ? "none" : "auto",
    };
  };

  /* ── Calendar grid computation ── */

  const computeVisibleDays = (): (number | null)[] => {
    if (calendarView === "month") {
      return [
        ...Array(firstDayOfWeek).fill(null),
        ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
      ];
    }
    const anchorDay = isCurrentMonth ? todayDayNum : 1;
    const anchorDate = new Date(year, month, anchorDay);
    const sundayDayNum = anchorDay - anchorDate.getDay();
    const numDays = calendarView === "week" ? 7 : 14;
    const result: (number | null)[] = [];
    for (let i = 0; i < numDays; i++) {
      const d = sundayDayNum + i;
      result.push(d >= 1 && d <= daysInMonth ? d : null);
    }
    return result;
  };
  const visibleDays = computeVisibleDays();

  /* ── Actions ── */

  const navigateMonth = (dir: number) => {
    let nm = month + dir;
    let ny = year;
    if (nm < 0) { nm = 11; ny--; }
    if (nm > 11) { nm = 0; ny++; }
    setYear(ny);
    setMonth(nm);
    const base = generateInitialData(ny, nm);
    setDays(loadFromStorage(user?.uid ?? null, ny, nm, base));
    setSelectedDay(null);
    closeModal();
  };

  const toggleRead = (day: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDays((prev) => ({ ...prev, [day]: { ...prev[day], read: !prev[day].read } }));
  };

  const toggleFavorite = (day: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDays((prev) => ({ ...prev, [day]: { ...prev[day], favorite: !prev[day].favorite } }));
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
      setDays((prev) => ({ ...prev, [day]: { ...prev[day], image: compressed } }));
      setModal(day);
      setBookEditMode(true);
      setBookEditTitle(days[day].book.title);
      setBookEditAuthor(days[day].book.author || "");
      recognizeFromImage(day, compressed);
    }
    e.target.value = "";
  };

  const clearImage = (day: number) => {
    setDays((prev) => ({ ...prev, [day]: { ...prev[day], image: null } }));
  };

  const updateNotes = (day: number, text: string) => {
    setDays((prev) => ({ ...prev, [day]: { ...prev[day], notes: text } }));
  };

  /* ── Tooltip ── */

  const showTooltip = (day: number, e: React.MouseEvent | Touch) => {
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

  const bookMouseEnter = (day: number, e: React.MouseEvent) => showTooltip(day, e);

  const bookTouchStart = (day: number, e: React.TouchEvent) => {
    if (!days[day]?.notes) return;
    const touch = e.touches[0];
    longPressRef.current = setTimeout(() => {
      setTooltip({ day, x: touch.clientX, y: touch.clientY });
    }, 500);
  };

  const bookTouchEnd = () => hideTooltip();

  /* ── Modal helpers ── */

  const closeModal = () => {
    setModal(null);
    setBookEditMode(false);
    setBookSearchResults([]);
    setSearchQuery("");
    setEditingNotes(false);
  };

  const openBookEdit = (day: number) => {
    setBookEditTitle(days[day].book.title);
    setBookEditAuthor(days[day].book.author || "");
    setSearchQuery(days[day].book.title);
    setBookSearchResults([]);
    setBookEditMode(true);
  };

  const saveBookEdit = (day: number) => {
    setDays((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        book: {
          ...prev[day].book,
          title: bookEditTitle || prev[day].book.title,
          author: bookEditAuthor,
        },
      },
    }));
    setBookEditMode(false);
    setBookSearchResults([]);
    setSearchQuery("");
  };

  /* ── Google Books search ── */

  const searchGoogleBooks = async (query: string) => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const resp = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=5`,
      );
      const data = await resp.json();
      setBookSearchResults(data.items || []);
    } catch {
      setBookSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  /* ── OCR ── */

  const recognizeFromImage = async (day: number, imgOverride?: string) => {
    const img = imgOverride || days[day]?.image;
    if (!img) return;
    setRecognizing(true);
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng");
      const { data: { text } } = await worker.recognize(img);
      await worker.terminate();
      const firstLine = text.trim().split("\n")[0]?.trim() || "";
      if (firstLine) {
        setBookEditTitle(firstLine);
        setSearchQuery(firstLine);
        await searchGoogleBooks(firstLine);
      }
    } catch (err) {
      console.error("OCR failed:", err);
    } finally {
      setRecognizing(false);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyBookResult = (day: number, item: any) => {
    const info = item.volumeInfo;
    setDays((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        book: {
          ...prev[day].book,
          title: info.title || prev[day].book.title,
          author: info.authors?.[0] || "",
          description: info.description?.slice(0, 200) || "",
        },
      },
    }));
    setBookEditMode(false);
    setBookSearchResults([]);
    setSearchQuery("");
  };

  /* ── Render: Loading ── */

  if (authLoading) {
    return (
      <div className="rc-root">
        <div className="rc-login-screen">
          <div className="rc-login-loading">載入中...</div>
        </div>
      </div>
    );
  }

  /* ── Render: Login gate ── */

  if (!user) {
    return (
      <div className="rc-root">
        <div className="rc-login-screen">
          <h1 className="rc-login-title">{"📚 Kira 愛讀冊"}</h1>
          <p className="rc-login-subtitle">{"每日一書 · track your daily reads"}</p>
          <button className="rc-login-btn" onClick={login}>
            Google 帳號登入
          </button>
          <p className="rc-login-hint">登入後即可使用所有功能並同步資料</p>
        </div>
      </div>
    );
  }

  /* ── Render: Progress ring (shared between sections) ── */

  const progressRing = (
    <div className="rc-inline-progress">
      <span className="rc-progress-text">
        {readCount}<span>/{totalCount}</span>
      </span>
      <div
        className="rc-ring-small"
        style={{ background: `conic-gradient(#6b8f71 ${progress}%, #2a2520 ${progress}%)` }}
      >
        <div className="rc-ring-small-inner">{progress}%</div>
      </div>
    </div>
  );

  /* ── Render: Main app ── */

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
        {/* Auth bar */}
        <div className="rc-auth-bar">
          <img
            src={user.photoURL || undefined}
            alt=""
            className="rc-avatar"
            referrerPolicy="no-referrer"
          />
          <span className="rc-auth-name">{user.displayName}</span>
          <button className="rc-auth-btn" onClick={logout}>登出</button>
        </div>

        {/* ── Carousel Section (only on current month) ── */}
        {isCurrentMonth && (
          <section className="rc-carousel-section">
            <div className="rc-carousel-header">
              <div>
                <h1 className="rc-title">{"📚 Kira 愛讀冊"}</h1>
                <p className="rc-subtitle">{"每日一書 · track your daily reads"}</p>
              </div>
              {progressRing}
            </div>

            {weekOffset !== 0 && (
              <button className="rc-carousel-reset" onClick={() => setWeekOffset(0)}>
                {"回到今天"}
              </button>
            )}

            {/* 3D Carousel */}
            <div
              className="rc-carousel-stage"
              onTouchStart={(e) => {
                weekTouchRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY };
              }}
              onTouchEnd={(e) => {
                if (!weekTouchRef.current) return;
                const dx = e.changedTouches[0].clientX - weekTouchRef.current.startX;
                const dy = e.changedTouches[0].clientY - weekTouchRef.current.startY;
                weekTouchRef.current = null;
                if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
                  setWeekOffset((o) => o + (dx < 0 ? 1 : -1));
                }
              }}
            >
              <div className="rc-carousel-track">
                {carouselDays.map((wd, idx) => {
                  const d = wd.inMonth ? days[wd.dayNum] : null;
                  return (
                    <div
                      key={idx}
                      className={`rc-carousel-item${wd.isToday ? " rc-carousel-today" : ""}${!wd.inMonth ? " rc-carousel-outside" : ""}`}
                      data-offset={wd.offset}
                      style={carouselTransform(wd.offset)}
                      onClick={() => {
                        if (wd.offset === 0) {
                          setModal(wd.dayNum);
                        } else {
                          setWeekOffset((o) => o + wd.offset);
                        }
                      }}
                    >
                      <div className="rc-carousel-day-label">
                        {DAY_NAMES_SHORT[wd.dayOfWeek]}
                      </div>
                      <div className="rc-carousel-day-num">{wd.dayNum}</div>
                      <div className="rc-carousel-book-wrapper">
                        {d ? (
                          <>
                            <BookCover book={d.book} image={d.image} />
                            {d.favorite && <span className="rc-badge-fav">{"♥"}</span>}
                            {d.read && <span className="rc-badge-read">{"✓"}</span>}
                          </>
                        ) : (
                          <div className="rc-carousel-placeholder" />
                        )}
                        {wd.offset === 0 && wd.isToday && d?.notes && (
                          <div className="rc-carousel-notes-overlay">
                            <p>{d.notes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                className="rc-carousel-arrow rc-carousel-arrow-left"
                onClick={(e) => { e.stopPropagation(); setWeekOffset((o) => o - 1); }}
              >{"‹"}</button>
              <button
                className="rc-carousel-arrow rc-carousel-arrow-right"
                onClick={(e) => { e.stopPropagation(); setWeekOffset((o) => o + 1); }}
              >{"›"}</button>
            </div>

            {centerDayData && (
              <div className="rc-carousel-center-label">
                <span className="rc-carousel-center-emoji">{centerDayData.book.emoji}</span>
                <span className="rc-carousel-center-name">{centerDayData.book.title}</span>
              </div>
            )}
          </section>
        )}

        {/* Non-current-month header fallback */}
        {!isCurrentMonth && (
          <div className="rc-carousel-header" style={{ marginBottom: 20 }}>
            <div>
              <h1 className="rc-title">{"📚 Kira 愛讀冊"}</h1>
              <p className="rc-subtitle">{"每日一書 · track your daily reads"}</p>
            </div>
            {progressRing}
          </div>
        )}

        {/* ── Monthly Calendar Section ── */}
        <section className="rc-section">
          <div className="rc-month-header">
            <h2 className="rc-section-title">{"月曆總覽"}</h2>
            <div className="rc-nav">
              <button className="rc-nav-btn" onClick={() => navigateMonth(-1)}>{"‹"}</button>
              <div className="rc-month-label">{MONTH_NAMES[month]} {year}</div>
              <button className="rc-nav-btn" onClick={() => navigateMonth(1)}>{"›"}</button>
            </div>
          </div>

          {/* View Tabs */}
          <div className="rc-view-tabs">
            {(["week", "biweek", "month"] as const).map((v) => (
              <button
                key={v}
                className={`rc-view-tab${calendarView === v ? " active" : ""}`}
                onClick={() => setCalendarView(v)}
              >
                {v === "week" ? "一週" : v === "biweek" ? "雙週" : "每月"}
              </button>
            ))}
          </div>

          {/* Day headers */}
          <div className="rc-day-headers">
            {DAY_NAMES_FULL.map((d, i) => (
              <div key={d} className="rc-day-header">
                <span className="rc-day-header-full">{d}</span>
                <span className="rc-day-header-short">{DAY_NAMES_SHORT[i]}</span>
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className={`rc-grid${calendarView !== "month" ? " rc-grid-compact" : ""}`}>
            {visibleDays.map((day, i) => {
              if (day === null) return <div key={`e-${i}`} className="rc-cell-empty" />;
              const d = days[day];
              if (!d) return null;
              return (
                <div
                  key={day}
                  className={`rc-cell${d.isToday ? " today" : ""}`}
                  onClick={() => setModal(day)}
                >
                  <div className="rc-cell-top">
                    <span className={`rc-day-num${d.isToday ? " today-num" : ""}`}>{day}</span>
                  </div>
                  <div
                    className="rc-cell-book"
                    onMouseEnter={(e) => bookMouseEnter(day, e)}
                    onMouseLeave={hideTooltip}
                    onTouchStart={(e) => bookTouchStart(day, e)}
                    onTouchEnd={bookTouchEnd}
                    onTouchCancel={bookTouchEnd}
                  >
                    <BookCover book={d.book} image={d.image} />
                    {d.favorite && <span className="rc-badge-fav">{"♥"}</span>}
                    <span
                      className={`rc-badge-read${d.read ? "" : " rc-badge-unread"}`}
                      onClick={(e) => toggleRead(day, e)}
                      title={d.read ? "已讀 ✓" : "標記已讀"}
                    >{"✓"}</span>
                  </div>
                  <div className="rc-hover-overlay">{"📷"}</div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="rc-legend">
            <div className="rc-legend-item">
              <div className="rc-legend-box rc-legend-badge-read">{"✓"}</div>
              <span>已讀</span>
            </div>
            <div className="rc-legend-item">
              <div className="rc-legend-box rc-legend-badge-unread">{"✓"}</div>
              <span>未讀（點 ✓ 標記）</span>
            </div>
            <div className="rc-legend-item">
              <span>{"📷"}</span>
              <span>點擊格子管理封面</span>
            </div>
          </div>
        </section>
      </div>

      {/* ── Notes Tooltip ── */}
      {tooltip && days[tooltip.day]?.notes && (
        <div className="rc-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          <div className="rc-tooltip-title">
            {days[tooltip.day].book.emoji} {days[tooltip.day].book.title}
          </div>
          <div className="rc-tooltip-notes">{days[tooltip.day].notes}</div>
        </div>
      )}

      {/* ── Modal ── */}
      {modal && days[modal] && (
        <div className="rc-modal-backdrop">
          <div className="rc-modal">
            {/* Header */}
            <div className="rc-modal-header">
              <div className="rc-modal-title">
                {month + 1}月{modal}日
                {days[modal].isToday && (
                  <span style={{ color: "#6b8f71", fontSize: 14, marginLeft: 8 }}>Today</span>
                )}
              </div>
              <button className="rc-modal-close" onClick={closeModal}>{"×"}</button>
            </div>

            {/* Cover */}
            <div className="rc-modal-cover">
              <BookCover book={days[modal].book} image={days[modal].image} />
            </div>

            {/* Book Info */}
            <div className="rc-modal-book-info">
              <div className="rc-modal-book-name">
                {days[modal].book.emoji} {days[modal].book.title}
              </div>
              {days[modal].book.author && (
                <div className="rc-modal-book-author">{days[modal].book.author}</div>
              )}
              {!bookEditMode && (
                <button className="rc-modal-edit-book-btn" onClick={() => openBookEdit(modal)}>
                  {"✏️ 編輯書籍資訊"}
                </button>
              )}
            </div>

            {/* Book Edit Panel */}
            {bookEditMode && (
              <div className="rc-book-edit-panel">
                <div className="rc-book-edit-fields">
                  <input
                    className="rc-book-edit-input"
                    value={bookEditTitle}
                    onChange={(e) => setBookEditTitle(e.target.value)}
                    placeholder="書名"
                  />
                  <input
                    className="rc-book-edit-input"
                    value={bookEditAuthor}
                    onChange={(e) => setBookEditAuthor(e.target.value)}
                    placeholder="作者"
                  />
                </div>
                <div className="rc-book-edit-search">
                  <input
                    className="rc-book-edit-input rc-book-search-input"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="搜尋書名..."
                    onKeyDown={(e) => e.key === "Enter" && searchGoogleBooks(searchQuery)}
                  />
                  <button
                    className="rc-book-search-btn"
                    onClick={() => searchGoogleBooks(searchQuery)}
                    disabled={searching}
                  >
                    {searching ? "..." : "搜尋"}
                  </button>
                  {days[modal].image && (
                    <button
                      className="rc-book-ocr-btn"
                      onClick={() => recognizeFromImage(modal)}
                      disabled={recognizing}
                    >
                      {recognizing ? "辨識中..." : "圖片辨識"}
                    </button>
                  )}
                </div>
                {bookSearchResults.length > 0 && (
                  <div className="rc-book-search-results">
                    {bookSearchResults.map((item: { id: string; volumeInfo: { title?: string; authors?: string[] } }, idx: number) => (
                      <div
                        key={item.id || idx}
                        className="rc-book-search-item"
                        onClick={() => applyBookResult(modal, item)}
                      >
                        <span className="rc-book-search-item-title">{item.volumeInfo.title}</span>
                        {item.volumeInfo.authors && (
                          <span className="rc-book-search-item-author">{item.volumeInfo.authors[0]}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <div className="rc-book-edit-actions">
                  <button className="rc-notes-save-btn" onClick={() => saveBookEdit(modal)}>{"儲存"}</button>
                  <button className="rc-notes-cancel-btn" onClick={() => { setBookEditMode(false); setBookSearchResults([]); }}>{"取消"}</button>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="rc-modal-actions">
              <button className="rc-modal-btn rc-btn-upload" onClick={() => triggerUpload(modal)}>
                {"📷 上傳書籍封面"}
              </button>
              <button className="rc-modal-btn rc-btn-toggle" onClick={() => toggleRead(modal)}>
                {days[modal].read ? "↩ 標記為未讀" : "✓ 標記為已讀"}
              </button>
              <button
                className={`rc-modal-btn rc-btn-fav${days[modal].favorite ? " active" : ""}`}
                onClick={() => toggleFavorite(modal)}
              >
                {days[modal].favorite ? "♥ 取消最愛" : "♡ 加入最愛"}
              </button>
              {days[modal].image && (
                <button className="rc-modal-btn rc-btn-clear" onClick={() => clearImage(modal)}>
                  {"🗑 移除封面圖片"}
                </button>
              )}
            </div>

            {/* Notes */}
            <div className="rc-modal-notes">
              <div className="rc-modal-notes-header">
                <span className="rc-modal-notes-label">{"筆記"}</span>
                {!editingNotes && (
                  <button
                    className="rc-notes-edit-btn"
                    onClick={() => { setNotesDraft(days[modal].notes); setEditingNotes(true); }}
                  >{"編輯"}</button>
                )}
              </div>
              {editingNotes ? (
                <div className="rc-notes-editor">
                  <textarea
                    className="rc-notes-textarea"
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    placeholder="寫下閱讀心得..."
                    autoFocus
                  />
                  <div className="rc-notes-actions">
                    <button
                      className="rc-notes-save-btn"
                      onClick={() => { updateNotes(modal, notesDraft); setEditingNotes(false); }}
                    >{"儲存"}</button>
                    <button className="rc-notes-cancel-btn" onClick={() => setEditingNotes(false)}>
                      {"取消"}
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className={`rc-notes-display${!days[modal].notes ? " rc-notes-empty" : ""}`}
                  onClick={() => { setNotesDraft(days[modal].notes); setEditingNotes(true); }}
                >
                  {days[modal].notes || "點擊寫下閱讀心得..."}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
