import { useState, useRef, useEffect, useCallback } from "react";
import BookCover from "./components/BookCover";
import { MONTH_NAMES, DAY_NAMES_FULL, DAY_NAMES_SHORT } from "./data/books";
import { generateInitialData } from "./data/calendar";
import { useAuth } from "./hooks/useAuth";
import { useCloudStorage } from "./hooks/useCloudStorage";
import type { DaysMap } from "./types";
import "./App.css";

function storageKey(uid: string | null, y: number, m: number) {
  const prefix = uid || "local";
  return `kira-calendar-${prefix}-${y}-${m}`;
}

function saveToStorage(
  uid: string | null,
  y: number,
  m: number,
  days: DaysMap,
) {
  const toSave: Record<
    number,
    { image: string | null; read: boolean; notes?: string }
  > = {};
  for (const [k, v] of Object.entries(days)) {
    if (v.image || v.read || v.notes) {
      toSave[Number(k)] = {
        image: v.image,
        read: v.read,
        notes: v.notes || "",
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
    const saved: Record<
      number,
      { image: string | null; read: boolean; notes?: string }
    > = JSON.parse(raw);
    const result = { ...base };
    for (const [k, v] of Object.entries(saved)) {
      const day = Number(k);
      if (result[day]) {
        result[day] = {
          ...result[day],
          image: v.image,
          read: v.read,
          notes: v.notes || "",
        };
      }
    }
    return result;
  } catch {
    return base;
  }
}

export default function App() {
  const now = new Date();
  const { user, loading: authLoading, login, logout } = useAuth();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [days, setDays] = useState(() => {
    const base = generateInitialData(now.getFullYear(), now.getMonth());
    return loadFromStorage(null, now.getFullYear(), now.getMonth(), base);
  });
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [modal, setModal] = useState<number | null>(null);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [tooltip, setTooltip] = useState<{
    day: number;
    x: number;
    y: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevUidRef = useRef<string | null | undefined>(undefined);
  const longPressRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Reset data when user changes (login/logout/switch account)
  useEffect(() => {
    if (authLoading) return;
    const currentUid = user?.uid ?? null;
    if (prevUidRef.current === undefined) {
      // First load — just record the uid
      prevUidRef.current = currentUid;
      return;
    }
    if (prevUidRef.current === currentUid) return;
    prevUidRef.current = currentUid;
    // Reload data for the new user
    const base = generateInitialData(year, month);
    setDays(loadFromStorage(currentUid, year, month, base));
    setModal(null);
    setEditingNotes(false);
  }, [user?.uid, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // localStorage persistence (per user)
  useEffect(() => {
    saveToStorage(user?.uid ?? null, year, month, days);
  }, [days, year, month, user?.uid]);

  // Cloud sync: apply data from Firestore when loaded
  const applyCloud = useCallback(
    (
      saved: Record<
        number,
        { image: string | null; read: boolean; notes?: string }
      >,
    ) => {
      setDays((prev) => {
        const result = { ...prev };
        for (const [k, v] of Object.entries(saved)) {
          const day = Number(k);
          if (result[day]) {
            result[day] = {
              ...result[day],
              image: v.image,
              read: v.read,
              notes: v.notes || "",
            };
          }
        }
        return result;
      });
    },
    [],
  );

  useCloudStorage(user, year, month, days, applyCloud);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

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

  const triggerUpload = (day: number) => {
    setSelectedDay(day);
    fileInputRef.current?.click();
  };

  const compressImage = (file: File, maxSize: number): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement("canvas");
        // Scale down to fit within maxDim while keeping aspect ratio
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
        // Try progressively lower quality until under maxSize
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
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && selectedDay) {
      // Compress to ~25KB (base64 string length) to stay within Firestore 1MB doc limit
      const compressed = await compressImage(file, 25_000);
      setDays((prev) => ({
        ...prev,
        [selectedDay]: {
          ...prev[selectedDay],
          image: compressed,
        },
      }));
      setModal(null);
    }
    e.target.value = "";
  };

  const clearImage = (day: number) => {
    setDays((prev) => ({
      ...prev,
      [day]: { ...prev[day], image: null },
    }));
  };

  const readCount = Object.values(days).filter((d) => d.read).length;
  const totalCount = Object.keys(days).length;
  const progress = Math.round((readCount / totalCount) * 100);

  // Compute week centered on today: 3 days before | TODAY | 3 days after
  const isCurrentMonth =
    year === now.getFullYear() && month === now.getMonth();
  const todayDayNum = now.getDate();

  const weekDays: {
    date: Date;
    dayNum: number;
    dayOfWeek: number;
    inMonth: boolean;
    isCenter: boolean;
  }[] = [];
  for (let i = -3; i <= 3; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    weekDays.push({
      date: d,
      dayNum: d.getDate(),
      dayOfWeek: d.getDay(),
      inMonth: d.getFullYear() === year && d.getMonth() === month,
      isCenter: i === 0,
    });
  }

  const todayData = isCurrentMonth ? days[todayDayNum] : null;

  const updateNotes = (day: number, text: string) => {
    setDays((prev) => ({
      ...prev,
      [day]: { ...prev[day], notes: text },
    }));
  };

  // Tooltip handlers for showing notes on hover / long-press
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

  const bookMouseEnter = (day: number, e: React.MouseEvent) => {
    showTooltip(day, e);
  };

  const bookTouchStart = (day: number, e: React.TouchEvent) => {
    if (!days[day]?.notes) return;
    const touch = e.touches[0];
    longPressRef.current = setTimeout(() => {
      setTooltip({ day, x: touch.clientX, y: touch.clientY });
    }, 500);
  };

  const bookTouchEnd = () => {
    hideTooltip();
  };

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
          {authLoading ? null : user ? (
            <>
              <img
                src={user.photoURL || undefined}
                alt=""
                className="rc-avatar"
                referrerPolicy="no-referrer"
              />
              <span className="rc-auth-name">{user.displayName}</span>
              <button className="rc-auth-btn" onClick={logout}>
                登出
              </button>
            </>
          ) : (
            <button className="rc-auth-btn rc-auth-login" onClick={login}>
              Google 登入（雲端同步）
            </button>
          )}
        </div>

        {/* Header */}
        <div className="rc-header">
          <div>
            <h1 className="rc-title">{"📚 Kira 愛讀冊"}</h1>
            <p className="rc-subtitle">{"每日一書 · track your daily reads"}</p>
          </div>
          <div className="rc-stats">
            <div>
              <div className="rc-stat-num">
                {readCount}
                <span>/{totalCount}</span>
              </div>
              <div className="rc-stat-label">completed</div>
            </div>
            <div
              className="rc-ring"
              style={{
                background: `conic-gradient(#6b8f71 ${progress}%, #2a2520 ${progress}%)`,
              }}
            >
              <div className="rc-ring-inner">{progress}%</div>
            </div>
          </div>
        </div>

        {/* === This Week Section (centered on today) === */}
        {isCurrentMonth && (
          <section className="rc-section">
            <h2 className="rc-section-title">{"本週書單"}</h2>
            <div className="rc-week-strip">
              {weekDays.map((wd, idx) => {
                const d = wd.inMonth ? days[wd.dayNum] : null;
                return (
                  <div
                    key={idx}
                    className={`rc-week-card${wd.isCenter ? " rc-week-today" : ""}${!wd.inMonth ? " rc-week-outside" : ""}`}
                    onClick={() => wd.inMonth && d && setModal(wd.dayNum)}
                  >
                    <div className="rc-week-day-label">
                      {DAY_NAMES_SHORT[wd.dayOfWeek]}
                    </div>
                    <div className="rc-week-day-num">{wd.dayNum}</div>
                    <div
                      className="rc-week-book"
                      onMouseEnter={(e) =>
                        wd.inMonth && d && bookMouseEnter(wd.dayNum, e)
                      }
                      onMouseLeave={hideTooltip}
                      onTouchStart={(e) =>
                        wd.inMonth && d && bookTouchStart(wd.dayNum, e)
                      }
                      onTouchEnd={bookTouchEnd}
                      onTouchCancel={bookTouchEnd}
                    >
                      {d ? (
                        <BookCover book={d.book} image={d.image} />
                      ) : (
                        <div className="rc-week-book-placeholder" />
                      )}
                    </div>
                    {wd.isCenter && d && (
                      <div className="rc-week-center-title">
                        {d.book.title}
                      </div>
                    )}
                    {d && (
                      <div
                        className={`rc-week-status ${d.read ? "read" : "unread"}`}
                      >
                        {d.read ? "✓" : ""}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* === Today's Notes Section === */}
        {isCurrentMonth && todayData && (
          <section className="rc-section">
            <h2 className="rc-section-title">{"今日筆記"}</h2>
            <div className="rc-notes-card">
              <div className="rc-notes-header">
                <span className="rc-notes-date">
                  {todayData.book.emoji} {todayData.book.title} — {month + 1}月
                  {todayDayNum}日
                </span>
                {!editingNotes && (
                  <button
                    className="rc-notes-edit-btn"
                    onClick={() => {
                      setNotesDraft(todayData.notes);
                      setEditingNotes(true);
                    }}
                  >
                    {"編輯"}
                  </button>
                )}
              </div>
              {editingNotes ? (
                <div className="rc-notes-editor">
                  <textarea
                    className="rc-notes-textarea"
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    placeholder="寫下今天的閱讀心得..."
                    autoFocus
                  />
                  <div className="rc-notes-actions">
                    <button
                      className="rc-notes-save-btn"
                      onClick={() => {
                        updateNotes(todayDayNum, notesDraft);
                        setEditingNotes(false);
                      }}
                    >
                      {"儲存"}
                    </button>
                    <button
                      className="rc-notes-cancel-btn"
                      onClick={() => setEditingNotes(false)}
                    >
                      {"取消"}
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className={`rc-notes-display${!todayData.notes ? " rc-notes-empty" : ""}`}
                  onClick={() => {
                    setNotesDraft(todayData.notes);
                    setEditingNotes(true);
                  }}
                >
                  {todayData.notes || "點擊此處寫下今天的閱讀心得..."}
                </div>
              )}
            </div>
          </section>
        )}

        {/* === Monthly Calendar Section === */}
        <section className="rc-section">
          <div className="rc-month-header">
            <h2 className="rc-section-title">{"月曆總覽"}</h2>
            <div className="rc-nav">
              <button className="rc-nav-btn" onClick={() => navigateMonth(-1)}>
                {"‹"}
              </button>
              <div className="rc-month-label">
                {MONTH_NAMES[month]} {year}
              </div>
              <button className="rc-nav-btn" onClick={() => navigateMonth(1)}>
                {"›"}
              </button>
            </div>
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
          <div className="rc-grid">
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`e-${i}`} className="rc-cell-empty" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const d = days[day];
              if (!d) return null;
              return (
                <div
                  key={day}
                  className={`rc-cell${d.isToday ? " today" : ""}`}
                  onClick={() => setModal(day)}
                >
                  <div className="rc-cell-top">
                    <span
                      className={`rc-day-num${d.isToday ? " today-num" : ""}`}
                    >
                      {day}
                    </span>
                    <button
                      className={`rc-check ${d.read ? "read" : "unread"}`}
                      onClick={(e) => toggleRead(day, e)}
                      title={d.read ? "已讀 ✓" : "未讀"}
                    >
                      {d.read ? "✓" : ""}
                    </button>
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
                  </div>
                  <div className="rc-hover-overlay">{"📷"}</div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="rc-legend">
            <div className="rc-legend-item">
              <div className="rc-legend-box" style={{ background: "#6b8f71" }}>
                {"✓"}
              </div>
              <span>已讀</span>
            </div>
            <div className="rc-legend-item">
              <div
                className="rc-legend-box"
                style={{ border: "1.5px solid #3a3530" }}
              />
              <span>未讀</span>
            </div>
            <div className="rc-legend-item">
              <span>{"📷"}</span>
              <span>點擊格子管理封面</span>
            </div>
          </div>
        </section>
      </div>

      {/* Notes Tooltip */}
      {tooltip && days[tooltip.day]?.notes && (
        <div
          className="rc-tooltip"
          style={{
            left: tooltip.x,
            top: tooltip.y,
          }}
        >
          <div className="rc-tooltip-title">
            {days[tooltip.day].book.emoji} {days[tooltip.day].book.title}
          </div>
          <div className="rc-tooltip-notes">{days[tooltip.day].notes}</div>
        </div>
      )}

      {/* Modal */}
      {modal && days[modal] && (
        <div className="rc-modal-backdrop" onClick={() => setModal(null)}>
          <div className="rc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rc-modal-header">
              <div className="rc-modal-title">
                {month + 1}月{modal}日
                {days[modal].isToday && (
                  <span
                    style={{ color: "#6b8f71", fontSize: 14, marginLeft: 8 }}
                  >
                    Today
                  </span>
                )}
              </div>
              <button
                className="rc-modal-close"
                onClick={() => setModal(null)}
              >
                {"×"}
              </button>
            </div>
            <div className="rc-modal-cover">
              <BookCover book={days[modal].book} image={days[modal].image} />
            </div>
            <div className="rc-modal-book-name">
              {days[modal].book.emoji} {days[modal].book.title}
            </div>
            <div className="rc-modal-actions">
              <button
                className="rc-modal-btn rc-btn-upload"
                onClick={() => triggerUpload(modal)}
              >
                {"📷 上傳書籍封面"}
              </button>
              <button
                className="rc-modal-btn rc-btn-toggle"
                onClick={() => toggleRead(modal)}
              >
                {days[modal].read ? "↩ 標記為未讀" : "✓ 標記為已讀"}
              </button>
              {days[modal].image && (
                <button
                  className="rc-modal-btn rc-btn-clear"
                  onClick={() => clearImage(modal)}
                >
                  {"🗑 移除封面圖片"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
