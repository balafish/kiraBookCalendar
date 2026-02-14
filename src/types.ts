export interface Book {
  title: string;
  color: string;
  emoji: string;
  author?: string;
  description?: string;
}

export interface DayData {
  book: Book;
  image: string | null;
  read: boolean;
  favorite: boolean;
  isToday: boolean;
  notes: string;
}

export type DaysMap = Record<number, DayData>;
