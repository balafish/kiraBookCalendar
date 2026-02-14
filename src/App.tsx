import { useState, useRef } from "react";
import BookCover from "./components/BookCover";
import { MONTH_NAMES, DAY_NAMES_FULL, DAY_NAMES_SHORT } from "./data/books";
import { generateInitialData } from "./data/calendar";
import "./App.css";

export default function App() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [days, setDays] = useState(() =>
    generateInitialData(now.getFullYear(), now.getMonth())
  );
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [modal, setModal] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setDays(generateInitialData(ny, nm));
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

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && selectedDay) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setDays((prev) => ({
          ...prev,
          [selectedDay]: {
            ...prev[selectedDay],
            image: ev.target?.result as string,
          },
        }));
        setModal(null);
      };
      reader.readAsDataURL(file);
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

        {/* Month Nav */}
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
                <div className="rc-cell-book">
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
      </div>

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
