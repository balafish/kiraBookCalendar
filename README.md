# Kira 愛讀冊

每日一書 · track your daily reads

A personal daily book reading tracker built with React + TypeScript. Upload book covers, track reading progress, write notes, and sync everything to the cloud.

**Live**: [https://balafish.github.io/kiraBookCalendar/](https://balafish.github.io/kiraBookCalendar/)

## Features

- **Google Login** — Sign in with Google to sync data across devices
- **Book Cover Upload** — Upload and compress book cover images
- **OCR Recognition** — Auto-detect book titles from cover images using Tesseract.js
- **Google Books Search** — Search and apply book metadata (title, author, synopsis)
- **Reading Tracker** — Mark books as read with visual checkmark badges on covers
- **Favorites** — Mark books as favorites with heart icons on covers
- **Daily Notes** — Write reading notes for each day
- **Calendar Views** — Switch between weekly, biweekly, and monthly calendar views
- **Cloud Sync** — All data automatically synced to Firestore per user
- **Responsive Design** — Works on desktop, tablet, and mobile

## Screenshots

| Week Strip | Calendar Grid | Book Detail |
|:---:|:---:|:---:|
| 本週書單 with badges | 月曆總覽 with view tabs | Upload, OCR, edit |

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite |
| Auth | Firebase Auth (Google) |
| Database | Cloud Firestore |
| OCR | Tesseract.js v7 |
| Book Data | Google Books API |
| Deployment | GitHub Pages + GitHub Actions |

## Getting Started

### Prerequisites

- Node.js 20+
- A Firebase project with Auth and Firestore enabled

### Setup

1. Clone the repository:

```bash
git clone https://github.com/balafish/kiraBookCalendar.git
cd kiraBookCalendar
```

2. Install dependencies:

```bash
npm install
```

3. Configure Firebase — copy `.env.example` to `.env` and fill in your Firebase credentials:

```bash
cp .env.example .env
```

```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
```

4. Start the dev server:

```bash
npm run dev
```

### Firebase Setup

1. Create a project at [Firebase Console](https://console.firebase.google.com/)
2. Enable **Authentication** > **Google** sign-in provider
3. Enable **Cloud Firestore** (start in test mode or configure security rules)
4. Add your domain to **Authentication** > **Settings** > **Authorized domains**

### Firestore Security Rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/calendars/{docId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Scripts

```bash
npm run dev       # Start development server
npm run build     # Type-check and build for production
npm run lint      # Run ESLint
npm run preview   # Preview production build locally
```

## Deployment

The app auto-deploys to GitHub Pages on push to `main` via GitHub Actions.

### Required GitHub Secrets

Set these in **Settings** > **Secrets and variables** > **Actions**:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

### GitHub Pages Setup

1. Go to **Settings** > **Pages**
2. Set **Source** to **GitHub Actions**

## Data Model

Each user's data is stored per month in Firestore at `users/{uid}/calendars/{year}-{month}`:

```json
{
  "1": {
    "image": "data:image/jpeg;base64,...",
    "read": true,
    "favorite": false,
    "notes": "Great book about habits",
    "book": {
      "title": "Atomic Habits",
      "author": "James Clear",
      "description": "A guide to building good habits...",
      "emoji": "⚛️",
      "color": "#E8A87C"
    }
  },
  "2": { ... }
}
```

Images are compressed to ~25KB (300px max, JPEG) to stay within Firestore's 1MB document limit.

## License

Private project.
