import type { DaysMap } from "../types";

interface Props {
  tooltip: { day: number; x: number; y: number } | null;
  days: DaysMap;
}

export default function Tooltip({ tooltip, days }: Props) {
  if (!tooltip || !days[tooltip.day]?.notes) return null;

  return (
    <div
      className="rc-tooltip"
      style={{ left: tooltip.x, top: tooltip.y }}
    >
      <div className="rc-tooltip-title">
        {days[tooltip.day].book.emoji} {days[tooltip.day].book.title}
      </div>
      <div className="rc-tooltip-notes">{days[tooltip.day].notes}</div>
    </div>
  );
}
