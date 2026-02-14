import { useRef } from "react";
import BookCover from "./BookCover";
import ProgressRing from "./ProgressRing";
import { DAY_NAMES_SHORT } from "../data/books";
import type { DaysMap } from "../types";

interface Props {
  days: DaysMap;
  year: number;
  month: number;
  weekOffset: number;
  onWeekOffsetChange: (value: number | ((prev: number) => number)) => void;
  onOpenModal: (day: number) => void;
}

/**
 * CoverFlow-style 3D transform.
 * Center item is flat & pushed forward; all side items share the same
 * rotation angle but are stacked horizontally with tight spacing.
 */
function coverflowStyle(offset: number): React.CSSProperties {
  const abs = Math.abs(offset);
  const sign = Math.sign(offset) || 1;

  if (abs > 4) {
    return { opacity: 0, pointerEvents: "none", position: "absolute" };
  }

  // Center: perfectly flat, pushed forward via translateZ
  if (abs === 0) {
    return {
      transform: "translateX(0) rotateY(0deg) translateZ(80px)",
      opacity: 1,
      zIndex: 10,
      position: "absolute",
      pointerEvents: "auto",
    };
  }

  // CoverFlow: constant tilt for ALL side items
  const TILT = 65;        // degrees
  const GAP = 115;        // % of item width — gap from center to first side item
  const STACK = 48;       // % of item width — spacing between consecutive side items

  const tx = sign * (GAP + (abs - 1) * STACK);
  const ry = -sign * TILT;
  const opacity = Math.max(1 - (abs - 1) * 0.2, 0.1);

  return {
    transform: `translateX(${tx}%) rotateY(${ry}deg) translateZ(0px)`,
    opacity,
    zIndex: 10 - abs,
    position: "absolute",
    pointerEvents: abs > 2 ? "none" : "auto",
  };
}

export default function Carousel({
  days,
  year,
  month,
  weekOffset,
  onWeekOffsetChange,
  onOpenModal,
}: Props) {
  const now = new Date();
  const touchRef = useRef<{ startX: number; startY: number } | null>(null);

  const isCurrentMonth =
    year === now.getFullYear() && month === now.getMonth();

  // Only render carousel in the current month
  if (!isCurrentMonth) return null;

  const readCount = Object.values(days).filter((d) => d.read).length;
  const totalCount = Object.keys(days).length;

  // Build 9 carousel days centered on today + offset
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

  const centerDay = carouselDays[4]; // offset === 0
  const centerDayData = centerDay.inMonth ? days[centerDay.dayNum] : null;

  return (
    <section className="rc-carousel-section">
      {/* Header: title + progress ring */}
      <div className="rc-carousel-header">
        <div>
          <h1 className="rc-title">{"📚 Kira 愛讀冊"}</h1>
          <p className="rc-subtitle">{"每日一書 · track your daily reads"}</p>
        </div>
        <ProgressRing readCount={readCount} totalCount={totalCount} />
      </div>

      {/* Reset button (only when scrolled away from today) */}
      {weekOffset !== 0 && (
        <button
          className="rc-carousel-reset"
          onClick={() => onWeekOffsetChange(0)}
        >
          {"回到今天"}
        </button>
      )}

      {/* CoverFlow 3D Stage */}
      <div
        className="rc-carousel-stage"
        onTouchStart={(e) => {
          touchRef.current = {
            startX: e.touches[0].clientX,
            startY: e.touches[0].clientY,
          };
        }}
        onTouchEnd={(e) => {
          if (!touchRef.current) return;
          const dx =
            e.changedTouches[0].clientX - touchRef.current.startX;
          const dy =
            e.changedTouches[0].clientY - touchRef.current.startY;
          touchRef.current = null;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
            onWeekOffsetChange((o: number) => o + (dx < 0 ? 1 : -1));
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
                style={coverflowStyle(wd.offset)}
                onClick={() => {
                  if (wd.offset === 0) {
                    if (wd.inMonth) onOpenModal(wd.dayNum);
                  } else {
                    onWeekOffsetChange((o: number) => o + wd.offset);
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
                      {d.favorite && (
                        <span className="rc-badge-fav">{"♥"}</span>
                      )}
                      {d.read && (
                        <span className="rc-badge-read">{"✓"}</span>
                      )}
                    </>
                  ) : (
                    <div className="rc-carousel-placeholder" />
                  )}
                  {/* Notes overlay on center today book */}
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

        {/* Arrow navigation */}
        <button
          className="rc-carousel-arrow rc-carousel-arrow-left"
          onClick={(e) => {
            e.stopPropagation();
            onWeekOffsetChange((o: number) => o - 1);
          }}
        >
          {"‹"}
        </button>
        <button
          className="rc-carousel-arrow rc-carousel-arrow-right"
          onClick={(e) => {
            e.stopPropagation();
            onWeekOffsetChange((o: number) => o + 1);
          }}
        >
          {"›"}
        </button>
      </div>

      {/* Center book label */}
      {centerDayData && (
        <div className="rc-carousel-center-label">
          <span className="rc-carousel-center-emoji">
            {centerDayData.book.emoji}
          </span>
          <span className="rc-carousel-center-name">
            {centerDayData.book.title}
          </span>
        </div>
      )}
    </section>
  );
}
