# 💸 BorrowTrack

**BorrowTrack** is a minimalist, mobile-first, multi-currency financial tracker designed to manage personal debts, borrowed funds, and expenses. Built with a focus on speed, offline capabilities, and a distraction-free UX, it allows users to track their balances across multiple currencies (EGP, USD, EUR) in real-time.

![UI Theme](https://img.shields.io/badge/UI_Theme-Dark_Glassmorphism-00d4aa?style=flat-square)
![Stack](https://img.shields.io/badge/Stack-Vanilla_JS_%7C_HTML_%7C_CSS-4d9fff?style=flat-square)
![Architecture](https://img.shields.io/badge/Architecture-Offline_First-ff6b6b?style=flat-square)

## ✨ Core Features

* **Multi-Currency Wallets:** Seamlessly switch between EGP, USD, and EUR wallets without page reloads.
* **Live Exchange Rates (API):** Fetches real-time exchange rates (USD/EUR to EGP) to calculate the exact local equivalent of your foreign currency wallets.
* **Smart Transaction Engine:** Prevents illogical inputs (e.g., withdrawing more than the remaining balance, or depositing more than what was spent).
* **History Management:** Full audit trail of transactions with the ability to edit or delete past entries (automatically recalculating current balances).
* **Apple-level Minimalism:** A distraction-free, thumb-friendly UI optimized specifically for mobile screens (max-width: 420px) featuring smooth CSS animations and a dark glassmorphism aesthetic.

---

## 🛠 Tech Stack & Engineering Highlights

BorrowTrack is deliberately built **without** heavy frameworks (like React or Next.js) to prioritize zero-latency interactions and 100% offline functionality.

### 1. Smart API Caching (The 12-Hour TTL Trick)
To prevent rate-limiting and save mobile data, the app doesn't call the ExchangeRate-API on every load. Instead, it uses a custom caching layer:
* Rates are fetched and stored in `localStorage` with a timestamp.
* The app only re-fetches if the cache is older than 12 hours (`CACHE_DURATION = 12 * 60 * 60 * 1000`).
* **Offline Fallback:** If the user opens the app without internet access, it silently falls back to the most recent cached rates without crashing.

### 2. State Management & Data Persistence
The entire application state (Wallets, History, Rates, Active Tab) is managed through a single, predictable JavaScript object (`state`).
* Every transaction triggers the `saveState()` function, committing the JSON-stringified state to the browser's `localStorage`.
* A robust `loadState()` initialization sequence merges saved data with a `DEFAULTS` schema to prevent app crashes in case of version updates or missing keys.

### 3. Floating-Point Precision Guards
Financial applications in JavaScript often suffer from floating-point math errors (e.g., `0.1 + 0.2 = 0.30000000000000004`). 
* BorrowTrack resolves this by sanitizing inputs with `parseFloat()`, applying cross-rate math accurately, and using a custom `fmt()` helper leveraging `toLocaleString` to strictly bind output visuals to 2 decimal places.

### 4. Dynamic DOM Manipulation (MVC approach)
Instead of re-rendering the entire DOM tree, the app updates only the specific text nodes and CSS properties (like the `width` of the progress bar) that change. This micro-updating strategy ensures silky-smooth 60fps performance on low-end mobile devices.

---

## 🚀 How to Run (Local Setup)

Because this is a vanilla web application, no build tools (Webpack/Vite) or package managers (npm) are required.

1. Clone the repository:
   ```bash
   git clone [https://github.com/habashyabdulrahman/BorrowTrack](https://github.com/habashyabdulrahman/BorrowTrack)