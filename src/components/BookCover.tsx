import type { Book } from "../types";

interface BookCoverProps {
  book: Book | null;
  image: string | null;
}

export default function BookCover({ book, image }: BookCoverProps) {
  if (image) {
    return (
      <img
        src={image}
        alt={book?.title || "Book"}
        className="book-cover-img"
      />
    );
  }
  if (!book) return null;

  return (
    <div
      className="book-cover"
      style={{
        background: `linear-gradient(145deg, ${book.color}, ${book.color}cc)`,
      }}
    >
      <div className="book-cover-spine" />
      <span className="book-emoji">{book.emoji}</span>
      <span className="book-title">{book.title}</span>
    </div>
  );
}
