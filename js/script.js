/* ═══════════════════════════════════════════
   Quiz App — js/script.js
   ═══════════════════════════════════════════ */

/* ════════════════════════════════
   i18n — LANGUAGE MANAGEMENT
   ════════════════════════════════ */

/**
 * Detect which language to use on first load.
 *
 * Priority order:
 *   1. Value stored in localStorage (explicit user choice from a previous visit)
 *   2. navigator.language prefix (browser / OS locale setting)
 *   3. Fallback → English
 *
 * @returns {"en" | "it"}
 */
function detectLanguage() {
  const stored = localStorage.getItem("quiz-lang");
  if (stored === "en" || stored === "it") return stored;

  const browser = (navigator.language || "en").toLowerCase();
  return browser.startsWith("it") ? "it" : "en";
}

/** Currently active language code ("en" | "it") */
let currentLang = detectLanguage();

/**
 * Translation objects loaded from JSON files.
 * Populated by loadTranslations() before the app renders anything.
 * @type {{ en: object|null, it: object|null }}
 */
const translations = { en: null, it: null };

/**
 * Return the translation object for the currently active language.
 * Assumes translations have already been loaded.
 *
 * @returns {object}
 */
function t() {
  return translations[currentLang];
}

/**
 * Fetch both JSON translation files in parallel, store them in
 * `translations`, then initialise the app.
 *
 * Using JSON (instead of <script> tags) avoids the MIME-type and
 * 500-error issues that can occur when a local dev server (e.g. Live
 * Server) mishandles .js files in subdirectories.
 *
 * @returns {Promise<void>}
 */
async function loadTranslations() {
  try {
    const [enRes, itRes] = await Promise.all([
      fetch("i18n/en.json"),
      fetch("i18n/it.json")
    ]);

    if (!enRes.ok) throw new Error(`Failed to load en.json (${enRes.status})`);
    if (!itRes.ok) throw new Error(`Failed to load it.json (${itRes.status})`);

    translations.en = await enRes.json();
    translations.it = await itRes.json();

    /* Translations ready — render the initial UI */
    applyLanguage();

  } catch (err) {
    /* Surface load errors visibly so they are easy to diagnose */
    console.error("[Quiz App] Translation load error:", err);
    document.body.innerHTML = `
      <div style="font-family:sans-serif;padding:40px;color:#c00">
        <strong>Error loading translations.</strong><br>
        Make sure the app is served via a local HTTP server (not opened as a file://).<br><br>
        <code>${err.message}</code>
      </div>`;
  }
}

/**
 * Switch the active language, persist the choice to localStorage,
 * and re-render the current UI without restarting the quiz.
 */
function toggleLanguage() {
  currentLang = currentLang === "en" ? "it" : "en";
  localStorage.setItem("quiz-lang", currentLang);
  applyLanguage();
}

/**
 * Update every static UI string to match the current language.
 * Called once after translations load and again on every toggle.
 */
function applyLanguage() {
  const tr = t();

  /* -- Navbar -- */
  document.getElementById("lang-label").textContent = tr.langToggle;

  /* -- Intro screen -- */
  document.getElementById("intro-badge").textContent    = tr.badge;
  document.getElementById("intro-title-1").textContent  = tr.introTitle1;
  document.getElementById("intro-title-2").textContent  = tr.introTitle2;
  document.getElementById("intro-title-3").textContent  = tr.introTitle3;
  document.getElementById("intro-desc").textContent     = tr.introDesc;
  document.getElementById("meta-time").textContent      = tr.metaTime;
  document.getElementById("meta-questions").textContent = tr.metaQuestions;
  document.getElementById("meta-score").textContent     = tr.metaScore;
  document.getElementById("btn-start").textContent      = tr.btnStart;

  /* -- Quiz screen: secondary action bar -- */
  document.getElementById("lbl-to-menu").textContent     = tr.btnMenu;
  document.getElementById("lbl-restart-mid").textContent = tr.btnRestartMid;

  /* -- Result screen static labels -- */
  document.getElementById("result-label").textContent = tr.resultLabel;
  document.getElementById("lbl-correct").textContent  = tr.labelCorrect;
  document.getElementById("lbl-wrong").textContent    = tr.labelWrong;
  document.getElementById("lbl-pct").textContent      = tr.labelPct;
  document.getElementById("btn-restart").textContent  = tr.btnRestart;

  /* -- If the quiz screen is active, refresh the question in-place -- */
  if (quizActive) {
    refreshQuizScreen();
  }
}

/* ════════════════════════════════
   QUIZ STATE
   ════════════════════════════════ */

/** Letter badges rendered inside each answer option button */
const LETTERS = ["A", "B", "C", "D"];

let current           = 0;     // index into questionOrder[] for the active question
let score             = 0;     // number of correct answers this round
let answered          = false; // true after the user picks an option (prevents double-clicks)
let quizActive        = false; // true while the quiz screen is visible
let selectedOptionPos = -1;    // visual position (0–3) the user selected; -1 = unanswered

/**
 * Shuffled list of indices into t().questions[].
 * Storing indices (not copied objects) lets every render read text live
 * from the active translation, so a mid-round language switch works instantly.
 * @type {number[]}
 */
let questionOrder = [];

/**
 * For each entry in questionOrder, the shuffled order of its option indices.
 * optionMap[i] = [origIdx0, origIdx1, origIdx2, origIdx3]
 * Kept stable across language switches so the visual layout does not jump.
 * @type {number[][]}
 */
let optionMap = [];

/* ════════════════════════════════
   UTILITIES
   ════════════════════════════════ */

/**
 * Fisher-Yates shuffle — returns a new shuffled copy without mutating the original.
 *
 * @param {Array} arr
 * @returns {Array}
 */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Show the screen with the given id; hide all others.
 *
 * @param {string} id — DOM id of the target screen element
 */
function show(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

/* ════════════════════════════════
   QUIZ RENDERING
   ════════════════════════════════ */

/**
 * Render (or re-render) the current question.
 *
 * All text is read live from t(), so calling this after a language
 * switch produces a fully translated question — including restoring
 * the answered state when the user has already picked an option.
 */
function renderQuestion() {
  const tr         = t();
  const total      = questionOrder.length;
  const qIndex     = questionOrder[current];   // original index into tr.questions[]
  const q          = tr.questions[qIndex];     // live-translated question object
  const optIndices = optionMap[current];       // stable shuffled option order

  /* Progress bar */
  const pct = Math.round((current / total) * 100);
  document.getElementById("prog-fill").style.width = pct + "%";
  document.getElementById("prog-text").textContent = `${tr.questionLabel} ${current + 1} ${tr.of} ${total}`;
  document.getElementById("prog-pct").textContent  = pct + "%";

  /* Question number and text */
  document.getElementById("q-num").textContent  = String(current + 1).padStart(2, "0");
  document.getElementById("q-text").textContent = q.q;

  /* Build option buttons in the pre-shuffled order */
  const container = document.getElementById("q-options");
  container.innerHTML = "";
  optIndices.forEach((origIdx, pos) => {
    const btn = document.createElement("button");
    btn.className = "option";
    btn.innerHTML = `<span class="option-letter">${LETTERS[pos]}</span><span>${q.options[origIdx]}</span>`;
    btn.addEventListener("click", () => selectOption(pos, btn));
    container.appendChild(btn);
  });

  /* Restore visual answered state if the user already picked an option */
  if (answered) {
    restoreAnsweredState(q, optIndices);
  }

  /* Configure the Next button */
  const nextBtn = document.getElementById("btn-next");
  nextBtn.disabled    = !answered;
  nextBtn.textContent = current === total - 1 ? tr.btnResult : tr.btnNext;
}

/**
 * Re-apply correct/wrong CSS classes and feedback text after a
 * language-switch re-render of an already-answered question.
 *
 * @param {object}   q          — current question object from t()
 * @param {number[]} optIndices — shuffled original option indices
 */
function restoreAnsweredState(q, optIndices) {
  const tr         = t();
  const allOptions = document.querySelectorAll(".option");

  /* Lock all options */
  allOptions.forEach((b) => (b.disabled = true));

  /* Visual position of the correct answer in the current shuffle */
  const correctPos = optIndices.indexOf(q.answer);

  const fb = document.getElementById("feedback");

  if (selectedOptionPos === correctPos) {
    allOptions[selectedOptionPos].classList.add("correct", "selected");
    fb.textContent = tr.correct;
    fb.style.color = "var(--correct)";
  } else {
    allOptions[selectedOptionPos].classList.add("wrong", "selected");
    allOptions[correctPos].classList.add("correct");
    /* Build the "wrong" feedback string from the JSON template key */
    fb.textContent = tr.wrongPrefix
      ? `${tr.wrongPrefix} ${q.options[q.answer]}`
      : `✗ ${q.options[q.answer]}`;
    fb.style.color = "var(--wrong)";
  }

  fb.classList.add("show");
}

/**
 * Refresh the entire quiz screen when the language is toggled mid-round.
 * Delegates to renderQuestion() which handles both the fresh and answered states.
 */
function refreshQuizScreen() {
  renderQuestion();
}

/* ════════════════════════════════
   QUIZ LOGIC
   ════════════════════════════════ */

/**
 * Handle an answer option click.
 *
 * Records selectedOptionPos, then applies correct/wrong styling and feedback.
 * Increments score only on a correct pick.
 *
 * @param {number}      pos        — visual position of the clicked option (0–3)
 * @param {HTMLElement} clickedBtn — the button element that was clicked
 */
function selectOption(pos, clickedBtn) {
  if (answered) return;
  answered          = true;
  selectedOptionPos = pos;

  const tr         = t();
  const qIndex     = questionOrder[current];
  const q          = tr.questions[qIndex];
  const optIndices = optionMap[current];
  const allOptions = document.querySelectorAll(".option");
  const fb         = document.getElementById("feedback");

  const clickedOrigIdx = optIndices[pos];            // original index of the clicked option
  const correctPos     = optIndices.indexOf(q.answer); // visual position of correct answer

  /* Lock all options */
  allOptions.forEach((b) => (b.disabled = true));

  if (clickedOrigIdx === q.answer) {
    /* Correct */
    clickedBtn.classList.add("correct", "selected");
    score++;
    fb.textContent = tr.correct;
    fb.style.color = "var(--correct)";
  } else {
    /* Wrong — shake the clicked button, highlight the correct one */
    clickedBtn.classList.add("wrong", "selected", "shake");
    clickedBtn.addEventListener(
      "animationend",
      () => clickedBtn.classList.remove("shake"),
      { once: true }
    );
    allOptions[correctPos].classList.add("correct");
    fb.textContent = tr.wrongPrefix
      ? `${tr.wrongPrefix} ${q.options[q.answer]}`
      : `✗ ${q.options[q.answer]}`;
    fb.style.color = "var(--wrong)";
  }

  fb.classList.add("show");
  document.getElementById("btn-next").disabled = false;
}

/**
 * Advance to the next question, or show the result screen
 * when all questions have been answered.
 */
function nextQuestion() {
  current++;
  selectedOptionPos = -1;
  answered          = false;
  if (current < questionOrder.length) {
    renderQuestion();
  } else {
    showResult();
  }
}

/**
 * Build and display the result screen with score, breakdown, and message.
 */
function showResult() {
  /* Complete the progress bar */
  document.getElementById("prog-fill").style.width = "100%";

  const total = questionOrder.length;
  const wrong = total - score;
  const pct   = Math.round((score / total) * 100);
  const tr    = t();

  /* Find the matching result message for the final score */
  const entry = tr.msgs.find(([min, max]) => score >= min && score <= max);

  document.getElementById("res-score").textContent   = `${score}/${total}`;
  document.getElementById("res-correct").textContent = score;
  document.getElementById("res-wrong").textContent   = wrong;
  document.getElementById("res-pct").textContent     = pct + "%";
  document.getElementById("res-msg").textContent     = entry ? entry[2] : "";

  quizActive = false;
  show("screen-result");
}

/**
 * Return to the intro / menu screen without starting a new round.
 * Fully resets quiz state so a subsequent start is clean.
 */
function goToMenu() {
  quizActive        = false;
  current           = 0;
  score             = 0;
  answered          = false;
  selectedOptionPos = -1;
  questionOrder     = [];
  optionMap         = [];
  show("screen-intro");
}

/**
 * Start (or restart) a quiz round.
 *
 * Builds shuffled index arrays for question order and per-question
 * option order. Text is always read from t() at render time, so
 * language switches work without restarting.
 */
function startQuiz() {
  current           = 0;
  score             = 0;
  answered          = false;
  selectedOptionPos = -1;
  quizActive        = true;

  const sourceQuestions = t().questions;
  const totalQ          = sourceQuestions.length;

  /* Shuffle question order as an array of original indices */
  questionOrder = shuffle([...Array(totalQ).keys()]);

  /* Shuffle each question's option indices independently */
  optionMap = questionOrder.map((qIdx) => {
    const optCount = sourceQuestions[qIdx].options.length;
    return shuffle([...Array(optCount).keys()]);
  });

  show("screen-quiz");
  renderQuestion();
}

/* ════════════════════════════════
   EVENT LISTENERS
   ════════════════════════════════ */
document.getElementById("btn-start").addEventListener("click", startQuiz);
document.getElementById("btn-next").addEventListener("click", nextQuestion);
document.getElementById("btn-restart").addEventListener("click", startQuiz);
document.getElementById("btn-to-menu").addEventListener("click", goToMenu);
document.getElementById("btn-restart-mid").addEventListener("click", startQuiz);
document.getElementById("lang-btn").addEventListener("click", toggleLanguage);

/* ════════════════════════════════
   INITIALISATION
   ════════════════════════════════ */

/* Fetch translation files, then boot the app */
loadTranslations();
