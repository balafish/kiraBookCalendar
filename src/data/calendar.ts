import type { DaysMap } from "../types";
import { SAMPLE_BOOKS } from "./books";

export function generateInitialData(year: number, month: number): DaysMap {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const data: DaysMap = {};

  for (let d = 1; d <= daysInMonth; d++) {
    const book = SAMPLE_BOOKS[(d - 1) % SAMPLE_BOOKS.length];
    const isToday =
      d === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear();

    data[d] = {
      book,
      image: null,
      read: false,
      isToday,
      notes: "",
    };
  }

  return data;
}
