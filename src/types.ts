export interface Book {
  title: string;
  color: string;
  emoji: string;
}

export interface DayData {
  book: Book;
  image: string | null;
  read: boolean;
  isToday: boolean;
}

export type DaysMap = Record<number, DayData>;
