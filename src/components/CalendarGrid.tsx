import BookCover from "./BookCover";
import { MONTH_NAMES, DAY_NAMES_FULL, DAY_NAMES_SHORT } from "../data/books";
import type { DaysMap } from "../types";

interface Props {
  days: DaysMap;
  year: number;
  month: number;
  calendarView: "week" | "biweek" | "month";
  onViewChange: (view: "week" | "biweek" | "month") => void;
  onNavigateMonth: (dir: number) => void;
  onOpenModal: (day: number) => void;
  onToggleRead: (day: number, e?: React.MouseEvent) => void;
  onShowTooltip: (day: number, e: React.MouseEvent) => void;
  onHideTooltip: () => void;
  onTouchStartTooltip: (day: number, e: React.TouchEvent) => void;
  onTouchEndTooltip: () => void;
}

export default function CalendarGrid({
  days,
  year,
  month,
  calendarView,
  onViewChange,
  onNavigateMonth,
  onOpenModal,
  onToggleRead,
  onShowTooltip,
  onHideTooltip,
  onTouchStartTooltip,
  onTouchEndTooltip,
}: Props) {
  const now = new Date();
  const isCurrentMonth =
    year === now.getFullYear() && month === now.getMonth();
  const todayDayNum = now.getDate();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

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

  return (
    <section className="rc-section">
      {/* Month header + navigation */}
      <div className="rc-month-header">
        <h2 className="rc-section-title">{"月曆總覽"}</h2>
        <div className="rc-nav">
          <button
            className="rc-nav-btn"
            onClick={() => onNavigateMonth(-1)}
          >
            {"‹"}
          </button>
          <div className="rc-month-label">
            {MONTH_NAMES[month]} {year}
          </div>
          <button
            className="rc-nav-btn"
            onClick={() => onNavigateMonth(1)}
          >
            {"›"}
          </button>
        </div>
      </div>

      {/* View Tabs */}
      <div className="rc-view-tabs">
        {(["week", "biweek", "month"] as const).map((v) => (
          <button
            key={v}
            className={`rc-view-tab${calendarView === v ? " active" : ""}`}
            onClick={() => onViewChange(v)}
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
      <div
        className={`rc-grid${calendarView !== "month" ? " rc-grid-compact" : ""}`}
      >
        {visibleDays.map((day, i) => {
          if (day === null) {
            return <div key={`e-${i}`} className="rc-cell-empty" />;
          }
          const d = days[day];
          if (!d) return null;
          return (
            <div
              key={day}
              className={`rc-cell${d.isToday ? " today" : ""}`}
              onClick={() => onOpenModal(day)}
            >
              <div className="rc-cell-top">
                <span
                  className={`rc-day-num${d.isToday ? " today-num" : ""}`}
                >
                  {day}
                </span>
              </div>
              <div
                className="rc-cell-book"
                onMouseEnter={(e) => onShowTooltip(day, e)}
                onMouseLeave={onHideTooltip}
                onTouchStart={(e) => onTouchStartTooltip(day, e)}
                onTouchEnd={onTouchEndTooltip}
                onTouchCancel={onTouchEndTooltip}
              >
                <BookCover book={d.book} image={d.image} />
                {d.favorite && (
                  <span className="rc-badge-fav">{"♥"}</span>
                )}
                <span
                  className={`rc-badge-read${d.read ? "" : " rc-badge-unread"}`}
                  onClick={(e) => onToggleRead(day, e)}
                  title={d.read ? "已讀 ✓" : "標記已讀"}
                >
                  {"✓"}
                </span>
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
  );
}
