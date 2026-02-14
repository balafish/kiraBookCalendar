import type { DaysMap } from "../types";
import { SAMPLE_BOOKS } from "./books";

export function generateInitialData(year: number, month: number): DaysMap {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const data: DaysMap = {};

  for (let d = 1; d <= daysInMonth; d++) {
    const book = SAMPLE_BOOKS[(d - 1) % SAMPLE_BOOKS.length];
    const dateObj = new Date(year, month, d);
    const isPast =
      dateObj < new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const isToday =
      dateObj.getTime() ===
      new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

    data[d] = {
      book,
      image: null,
      read: isPast ? Math.random() > 0.25 : false,
      isToday,
    };
  }

  return data;
}
