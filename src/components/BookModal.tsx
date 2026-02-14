import { useState, useEffect } from "react";
import BookCover from "./BookCover";
import type { DayData } from "../types";

interface Props {
  day: number;
  dayData: DayData;
  month: number;
  autoOcr: boolean;
  onClose: () => void;
  onUpload: (day: number) => void;
  onToggleRead: (day: number) => void;
  onToggleFavorite: (day: number) => void;
  onClearImage: (day: number) => void;
  onUpdateNotes: (day: number, text: string) => void;
  onUpdateBook: (day: number, book: { title: string; author: string }) => void;
  onAutoOcrHandled: () => void;
}

export default function BookModal({
  day,
  dayData,
  month,
  autoOcr,
  onClose,
  onUpload,
  onToggleRead,
  onToggleFavorite,
  onClearImage,
  onUpdateNotes,
  onUpdateBook,
  onAutoOcrHandled,
}: Props) {
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [bookEditMode, setBookEditMode] = useState(false);
  const [bookEditTitle, setBookEditTitle] = useState("");
  const [bookEditAuthor, setBookEditAuthor] = useState("");
  const [recognizing, setRecognizing] = useState(false);

  // Auto-OCR when triggered by image upload
  useEffect(() => {
    if (autoOcr && dayData.image) {
      setBookEditMode(true);
      setBookEditTitle(dayData.book.title);
      setBookEditAuthor(dayData.book.author || "");
      recognizeFromImage(dayData.image);
      onAutoOcrHandled();
    }
  }, [autoOcr]); // eslint-disable-line react-hooks/exhaustive-deps

  const openBookEdit = () => {
    setBookEditTitle(dayData.book.title);
    setBookEditAuthor(dayData.book.author || "");
    setBookEditMode(true);
  };

  const saveBookEdit = () => {
    onUpdateBook(day, {
      title: bookEditTitle || dayData.book.title,
      author: bookEditAuthor,
    });
    setBookEditMode(false);
  };

  const recognizeFromImage = async (img: string) => {
    setRecognizing(true);
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng");
      const {
        data: { text },
      } = await worker.recognize(img);
      await worker.terminate();
      const firstLine = text.trim().split("\n")[0]?.trim() || "";
      if (firstLine) {
        setBookEditTitle(firstLine);
      }
    } catch (err) {
      console.error("OCR failed:", err);
    } finally {
      setRecognizing(false);
    }
  };

  const handleClose = () => {
    setBookEditMode(false);
    setEditingNotes(false);
    onClose();
  };

  return (
    <div className="rc-modal-backdrop">
      <div className="rc-modal">
        {/* Header */}
        <div className="rc-modal-header">
          <div className="rc-modal-title">
            {month + 1}月{day}日
            {dayData.isToday && (
              <span style={{ color: "#6b8f71", fontSize: 14, marginLeft: 8 }}>
                Today
              </span>
            )}
          </div>
          <button className="rc-modal-close" onClick={handleClose}>
            {"×"}
          </button>
        </div>

        {/* Cover */}
        <div className="rc-modal-cover">
          <BookCover book={dayData.book} image={dayData.image} />
        </div>

        {/* Book Info */}
        <div className="rc-modal-book-info">
          <div className="rc-modal-book-name">
            {dayData.book.emoji} {dayData.book.title}
          </div>
          {dayData.book.author && (
            <div className="rc-modal-book-author">{dayData.book.author}</div>
          )}
          {!bookEditMode && (
            <button
              className="rc-modal-edit-book-btn"
              onClick={openBookEdit}
            >
              {"✏️ 編輯書籍資訊"}
            </button>
          )}
        </div>

        {/* Book Edit Panel */}
        {bookEditMode && (
          <div className="rc-book-edit-panel">
            <div className="rc-book-edit-fields">
              <input
                className="rc-book-edit-input"
                value={bookEditTitle}
                onChange={(e) => setBookEditTitle(e.target.value)}
                placeholder="書名"
              />
              <input
                className="rc-book-edit-input"
                value={bookEditAuthor}
                onChange={(e) => setBookEditAuthor(e.target.value)}
                placeholder="作者"
              />
            </div>
            {dayData.image && (
              <div className="rc-book-edit-ocr">
                <button
                  className="rc-book-ocr-btn"
                  onClick={() => recognizeFromImage(dayData.image!)}
                  disabled={recognizing}
                >
                  {recognizing ? "辨識中..." : "圖片辨識"}
                </button>
              </div>
            )}
            <div className="rc-book-edit-actions">
              <button className="rc-notes-save-btn" onClick={saveBookEdit}>
                {"儲存"}
              </button>
              <button
                className="rc-notes-cancel-btn"
                onClick={() => setBookEditMode(false)}
              >
                {"取消"}
              </button>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="rc-modal-actions">
          <button
            className="rc-modal-btn rc-btn-upload"
            onClick={() => onUpload(day)}
          >
            {"📷 上傳書籍封面"}
          </button>
          <button
            className="rc-modal-btn rc-btn-toggle"
            onClick={() => onToggleRead(day)}
          >
            {dayData.read ? "↩ 標記為未讀" : "✓ 標記為已讀"}
          </button>
          <button
            className={`rc-modal-btn rc-btn-fav${dayData.favorite ? " active" : ""}`}
            onClick={() => onToggleFavorite(day)}
          >
            {dayData.favorite ? "♥ 取消最愛" : "♡ 加入最愛"}
          </button>
          {dayData.image && (
            <button
              className="rc-modal-btn rc-btn-clear"
              onClick={() => onClearImage(day)}
            >
              {"🗑 移除封面圖片"}
            </button>
          )}
        </div>

        {/* Notes */}
        <div className="rc-modal-notes">
          <div className="rc-modal-notes-header">
            <span className="rc-modal-notes-label">{"筆記"}</span>
            {!editingNotes && (
              <button
                className="rc-notes-edit-btn"
                onClick={() => {
                  setNotesDraft(dayData.notes);
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
                placeholder="寫下閱讀心得..."
                autoFocus
              />
              <div className="rc-notes-actions">
                <button
                  className="rc-notes-save-btn"
                  onClick={() => {
                    onUpdateNotes(day, notesDraft);
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
              className={`rc-notes-display${!dayData.notes ? " rc-notes-empty" : ""}`}
              onClick={() => {
                setNotesDraft(dayData.notes);
                setEditingNotes(true);
              }}
            >
              {dayData.notes || "點擊寫下閱讀心得..."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
