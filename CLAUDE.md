# CLAUDE.md — Kira 愛讀冊 Project Context

## Project Overview

**Kira 愛讀冊** is a daily book reading tracker SPA. Users log in with Google, upload book covers, track reading progress, write notes, and mark favorites. All data syncs to Firestore per-user.

- **Live URL**: `https://balafish.github.io/kiraBookCalendar/`
- **Language**: Traditional Chinese (zh-TW) UI, English month/day headers

## Tech Stack

- **Framework**: React 19 + TypeScript + Vite
- **Auth**: Firebase Auth (Google `signInWithPopup`)
- **Database**: Cloud Firestore
- **OCR**: Tesseract.js v7 (lazy-loaded via dynamic import)
- **Book Search**: Google Books API (free, no key required)
- **Deployment**: GitHub Pages via GitHub Actions
- **Styling**: Plain CSS (no framework), dark theme, all classes prefixed `rc-`

## Commands

```bash
npm run dev        # Start dev server (Vite)
npm run build      # TypeScript check + Vite production build
npm run lint       # ESLint
npx tsc --noEmit   # Type check only (no emit)
```

## Project Structure

```
src/
├── main.tsx                  # React entry point
├── App.tsx                   # Main component (~970 lines, all app logic)
├── App.css                   # All styles (dark theme)
├── firebase.ts               # Firebase init (reads VITE_FIREBASE_* env vars)
├── types.ts                  # Book, DayData, DaysMap types
├── components/
│   └── BookCover.tsx         # Book cover renderer (image or emoji placeholder)
├── data/
│   ├── books.ts              # SAMPLE_BOOKS array, month/day name constants
│   └── calendar.ts           # generateInitialData(year, month) → DaysMap
└── hooks/
    ├── useAuth.ts            # Google auth hook (user, loading, login, logout)
    └── useCloudStorage.ts    # Firestore sync hook (load + debounced save)
```

## Architecture Decisions

### Single-component pattern
All app logic lives in `App.tsx`. This is intentional — the app is small enough that extracting components adds complexity without benefit.

### Data model

```typescript
interface Book {
  title: string;
  color: string;      // hex color for placeholder cover
  emoji: string;      // emoji displayed on placeholder cover
  author?: string;    // from OCR / Google Books / manual edit
  description?: string; // book synopsis
}

interface DayData {
  book: Book;
  image: string | null;   // base64 JPEG (compressed to ~25KB)
  read: boolean;
  favorite: boolean;
  isToday: boolean;        // computed, not persisted
  notes: string;
}

type DaysMap = Record<number, DayData>;  // key = day of month (1-31)
```

### Storage

- **localStorage**: `kira-calendar-{uid}-{year}-{month}` — fallback/cache
- **Firestore**: `users/{uid}/calendars/{year}-{month}` — source of truth
- Only days with user data (image, read, favorite, notes, author, description) are persisted
- Images are compressed via Canvas API: 300px max dimension, JPEG, progressive quality reduction, target ~25KB
- Cloud save is debounced (1000ms) and only fires after initial cloud load completes (race condition prevention via `loadedRef`)

### Auth gate
The app requires Google login before any interaction. No anonymous usage is allowed.

## Key Features

1. **Week strip** (本週書單): 7 days centered on today with book covers, badges
2. **Today's notes** (今日筆記): Inline editable note for today's book
3. **Calendar grid** (月曆總覽): Monthly/biweekly/weekly view tabs (每月/雙週/一週)
4. **Book detail modal**: Upload cover, toggle read/favorite, edit book info, OCR + Google Books search
5. **Cover badges**: Green checkmark (bottom-right) for read books, red heart (top-right) for favorites
6. **Tooltip**: Notes preview on hover (desktop) or long-press (mobile)

## CSS Conventions

- All classes prefixed with `rc-` (reading calendar)
- Dark theme: `#0e0d0c` background, `#e8e4df` text, `#6b8f71` accent green
- Responsive breakpoints: 768px (tablet), 520px (mobile), 370px (very small phones)
- Fonts: `'Crimson Text', Georgia, serif` for display, `'JetBrains Mono', monospace` for UI

## Environment Variables

Firebase config via `VITE_FIREBASE_*` env vars. See `.env.example` for the list. In CI/CD these come from GitHub Secrets.

## Deployment

Push to `main` triggers `.github/workflows/deploy.yml`:
1. `npm ci` → `npm run build` (with Firebase env vars from secrets)
2. Upload `dist/` to GitHub Pages

Base path is `/kiraBookCalendar/` (configured in `vite.config.ts`).

## Common Gotchas

- `generateInitialData()` always sets `read: false` and `favorite: false` — cloud data overwrites these after load
- Cloud sync has a `loadedRef` guard: save only fires after `getDoc` completes, preventing local data from overwriting cloud data
- Image compression targets ~25KB base64 to stay within Firestore's 1MB document size limit (one doc per user per month)
- Tesseract.js is dynamically imported (`import("tesseract.js")`) to avoid bundle bloat
- The `prevUidRef` pattern in App.tsx handles first-load vs. account-switch scenarios differently
