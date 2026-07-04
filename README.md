# 🟢 Quiz App

An interactive quiz web application built with plain HTML, CSS, and JavaScript — no frameworks, no dependencies, no build step required.

---

## 📁 Project structure

```
quiz-app/
├── index.html              # Markup for all three screens (Intro, Quiz, Result)
├── assets/
│   └── favicon/
│       ├── favicon.svg     # SVG favicon — scalable, used by modern browsers
│       └── favicon.ico     # Multi-size ICO (16 × 16, 32 × 32, 48 × 48 px)
├── css/
│   └── style.css           # Design tokens, layout, animations, media queries
├── js/
│   └── script.js           # Quiz logic, i18n engine, state management, event listeners
├── i18n/
│   ├── en.json             # English translations + questions
│   └── it.json             # Italian translations + questions
└── README.md
```

---

## 🚀 Getting started

> **⚠️ A local HTTP server is required.**
> Translation files are loaded via `fetch()`, which is blocked by browsers when opening `index.html` directly as a `file://` URL. Always use one of the options below.

```bash
# Option 1 — VS Code Live Server (recommended)
# Install the "Live Server" extension, right-click index.html → "Open with Live Server"

# Option 2 — Node
npx serve .

# Option 3 — Python
python3 -m http.server 8080
```

Then open `http://127.0.0.1:5500` (Live Server) or `http://localhost:8080` (Python/Node) in your browser.

---

## ✨ Features

| Feature | Details |
|---|---|
| **3 screens** | Intro → Quiz → Result, managed via CSS `.active` class |
| **10 questions** | General knowledge, science, and curiosities |
| **Random order** | Questions and options independently shuffled each round (Fisher-Yates) |
| **Instant feedback** | Correct answer highlighted green; wrong answer in red with shake animation |
| **Progress bar** | Smooth animated fill tracking the percentage of questions answered |
| **Final score** | Correct / wrong / percentage breakdown + contextual result message |
| **Mid-quiz controls** | Menu and Restart buttons available at any point during the quiz |
| **i18n (EN / IT)** | Auto-detected from `navigator.language`; manual toggle in the navbar; choice persisted in `localStorage` |
| **Live language switch** | Toggling language mid-quiz instantly translates the active question, options, and feedback without losing progress |
| **Favicons** | SVG (scalable) + multi-size `.ico` (16, 32, 48 px) |
| **Responsive** | Optimised for mobile, tablet, and desktop via media queries |
| **Accessible** | Visible focus rings, `prefers-reduced-motion` respected, WCAG AA contrast |

---

## 🌐 Language system

### Detection priority

Language is resolved in this order on every page load:

1. **`localStorage`** — value saved from a previous visit (`quiz-lang: "en"` or `"it"`)
2. **`navigator.language`** — browser / OS locale (e.g. `it-IT` → Italian, anything else → English)
3. **Fallback** → English

### Manual toggle

The globe button in the top-right navbar lets the user switch language at any time. The choice is saved to `localStorage` immediately.

### Mid-quiz language switch

Switching language during an active quiz re-renders the current question in the new language **without restarting the round**. This works because the quiz engine stores only shuffled **indices** into `t().questions[]` rather than copied string objects. Every render reads text live from the active translation object, so a language change is reflected instantly — including the feedback message if the user has already answered.

### Translation format

Translations are stored as `.json` files in `i18n/` and loaded via `fetch()` at startup. This avoids MIME-type errors that can occur when a dev server serves `.js` files from subdirectories with incorrect content-type headers.

### Adding a new language

1. Create `i18n/xx.json` (e.g. `fr.json`) following the same structure as `en.json`.
2. In `js/script.js`, add `xx: null` to the `translations` object.
3. Add a `fetch("i18n/xx.json")` call inside `loadTranslations()`.
4. Update `detectLanguage()` to recognise the new locale prefix (e.g. `browser.startsWith("fr")`).
5. Update `toggleLanguage()` to cycle through the new language.

---

## 🧩 Architecture — quiz engine

The quiz state is managed through these core variables in `script.js`:

| Variable | Type | Purpose |
|---|---|---|
| `questionOrder` | `number[]` | Shuffled array of original question indices into `t().questions[]` |
| `optionMap` | `number[][]` | For each question, the shuffled order of its option indices |
| `current` | `number` | Index into `questionOrder[]` pointing to the active question |
| `score` | `number` | Running count of correct answers |
| `answered` | `boolean` | Locks options after the user picks one; prevents double-clicks |
| `selectedOptionPos` | `number` | Visual position (0–3) of the option the user selected; `-1` if unanswered |
| `quizActive` | `boolean` | `true` while the quiz screen is visible; gates mid-quiz language refresh |

The separation between **index order** (`questionOrder`, `optionMap`) and **text content** (`t().questions[]`) is what makes the live language switch possible: the visual layout is stable across renders, only the strings change.

---

## 🎨 Design system

All design tokens are CSS custom properties defined in `:root` inside `css/style.css`. Changing a value there updates the entire UI automatically.

| Variable | Value | Usage |
|---|---|---|
| `--bg` | `#F2F5F3` | Page background |
| `--card` | `#FFFFFF` | Card surface |
| `--accent` | `#25D366` | Primary green (WhatsApp green) |
| `--accent-l` | `#1DAF54` | Darker green — hover states and headings |
| `--text` | `#111B17` | Primary text |
| `--muted` | `#7A8C83` | Secondary / placeholder text |
| `--correct` | `#25D366` | Correct answer highlight |
| `--wrong` | `#E05252` | Wrong answer highlight |
| `--border` | `#D9E5DF` | Borders and neutral backgrounds |

**Fonts** (loaded via Google Fonts CDN):

| Font | Weights | Usage |
|---|---|---|
| `Syne` | 700, 800 | Headings, question text, score display |
| `Inter` | 400, 500, 600 | Body text, buttons, labels |

To change the primary colour, update `--accent` and `--accent-l` in `:root`. All states (hover, correct, progress bar, focus ring) inherit automatically.

---

## 📐 Responsive breakpoints

| Breakpoint | Behaviour |
|---|---|
| `> 600px` | Full layout — card padding `40px 44px`, option gap `10px` |
| `≤ 600px` | Reduced card padding (`28px 20px`), tighter option gaps (`8px`), smaller option font |
| `≤ 360px` | Further reduced card padding (`22px 14px`), smaller button font |
| `prefers-reduced-motion` | Shake animation and progress bar CSS transition disabled |

---

## ➕ Adding questions

Open `i18n/en.js` and `i18n/it.js` and add a matching object to the `questions` array in each file:

```js
// i18n/en.js
{
  q: "What is the largest planet in the solar system?",
  options: ["Saturn", "Jupiter", "Uranus", "Neptune"],
  answer: 1   // 0-based index → "Jupiter"
},

// i18n/it.js
{
  q: "Qual è il pianeta più grande del sistema solare?",
  options: ["Saturno", "Giove", "Urano", "Nettuno"],
  answer: 1   // indice 0-based → "Giove"
},
```

Rules:
- Each question must have exactly **4 options**.
- `answer` is the **0-based index** (0, 1, 2, or 3) of the correct option in the original (non-shuffled) `options` array.
- Both language files must have the **same number of questions** and the same `answer` indices, since the question order is shared across languages.

---

## ♿ Accessibility

- Visible focus ring on all interactive elements via `:focus-visible` (does not affect mouse users)
- `prefers-reduced-motion: reduce` disables the shake animation and the progress bar transition
- Colour contrasts meet WCAG AA guidelines on both the card and the page background
- All three screens are fully keyboard-navigable (Tab, Space, Enter) without a mouse
- `aria-label` on the language toggle button for screen readers

---

## 🧩 Tech stack

| Technology | Version | Notes |
|---|---|---|
| HTML5 | — | Semantic markup, no template engine |
| CSS3 | — | Custom properties, Flexbox, Grid, `clamp()` |
| JavaScript | ES2020 | Vanilla — no framework, no bundler |
| Google Fonts | — | Syne + Inter loaded via CDN `<link>` |

---

## 📄 Changelog

| Version | Changes |
|---|---|
| 1.0 | Initial release — single self-contained HTML file |
| 2.0 | Multi-file structure (`css/`, `js/`, `i18n/`, `assets/`); i18n EN/IT with `localStorage` persistence; full English codebase and comments; favicons (SVG + ICO) |
| 2.1 | Mid-quiz Menu and Restart controls; live language switch mid-round (index-based engine rewrite); bug fix: language toggle now correctly re-renders question text and options |
| 2.2 | i18n files converted from `.js` to `.json`; translations loaded via `fetch()` to fix MIME-type 500 errors in Live Server; `file://` limitation documented |

---

## 📄 License

Open source — free to use, modify, and distribute.
