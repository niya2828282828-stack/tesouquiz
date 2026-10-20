
const app = document.getElementById("app");

const MODES = [
  { id: "life", name: "生命線", description: "生命線の意味や見方" },
  { id: "head", name: "頭脳線", description: "頭脳線の意味や見方" },
  { id: "heart", name: "感情線", description: "感情線の意味や見方" },
  { id: "marriage", name: "運命線", description: "運命線の意味や見方" },
  { id: "conversation", name: "会話", description: "占い中の受け答え" },
  { id: "other", name: "その他の線", description: "運命線などの知識" },
  { id: "palmistry", name: "手相とは", description: "手相の基礎や考え方" },
  { id: "multiple", name: "複数選択モード", description: "好きなジャンルを組み合わせる" }
];

const LINE_MODES = ["life", "head", "heart", "marriage"];
const QUESTION_BANK = () => window.PALM_QUESTIONS || {};

let screen = "home";
let currentMode = "life";
let selectedModes = ["life", "head"];
let questionCount = 10;

const APPEARANCE_KEY = "tesouquiz-appearance";
let appearanceReturnScreen = "home";

const ACCENTS = [
  { id: "black", name: "ブラック", color: "#55585a" },
  { id: "white", name: "ホワイト", color: "#d8d5cc" },
  { id: "blue", name: "ブルー", color: "#789bb8" },
  { id: "light-blue", name: "ライトブルー", color: "#b8d9e8" },
  { id: "green", name: "グリーン", color: "#789477" },
  { id: "orange", name: "オレンジ", color: "#d99a62" },
  { id: "light-green", name: "ライトグリーン", color: "#a9c5a0" },
  { id: "light-orange", name: "ライトオレンジ", color: "#efc69b" }
];

let quizQuestions = [];
let currentIndex = 0;
let correctCount = 0;
let answered = false;

function loadAppearance() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(APPEARANCE_KEY) || "{}"
    );

    return {
      theme: saved.theme === "dark" ? "dark" : "light",
      accent: ACCENTS.some(item => item.id === saved.accent)
        ? saved.accent
        : "green"
    };
  } catch {
    return { theme: "light", accent: "green" };
  }
}

let appearance = loadAppearance();

function applyAppearance() {
  document.documentElement.dataset.theme = appearance.theme;
  document.documentElement.dataset.accent = appearance.accent;

  try {
    localStorage.setItem(
      APPEARANCE_KEY,
      JSON.stringify(appearance)
    );
  } catch (error) {}
}

function openAppearanceSettings() {
  appearanceReturnScreen = screen;
  renderAppearanceSettings();
}

function returnFromAppearanceSettings() {
  if (appearanceReturnScreen === "settings") {
    renderSettings();
  } else if (appearanceReturnScreen === "quiz") {
    const wasAnswered = answered;
    renderQuestion();

    if (wasAnswered) {
      restoreAnsweredQuestion();
    }
  } else if (appearanceReturnScreen === "result") {
    renderResult();
  } else {
    renderHome();
  }
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function shuffle(items) {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

function uniqueNonEmptyStrings(items) {
  return [...new Set(
    items.filter(
      item => typeof item === "string" && item.trim() !== ""
    )
  )];
}

// 登録済みの問題数を数える。
function countQuestions(modeIds) {
  const bank = QUESTION_BANK();

  return modeIds.reduce((total, id) => {
    const registered = Array.isArray(bank[id])
      ? bank[id].length
      : 0;

    return total + registered;
  }, 0);
}

// 線モードの1問目は4択。
// 2問目以降は正解の選択肢を1つだけ登録する。
function isValidQuestion(question, modeId, index) {
  if (
    !question ||
    typeof question.question !== "string" ||
    !Array.isArray(question.choices) ||
    !Number.isInteger(question.answer) ||
    question.answer < 0 ||
    question.answer >= question.choices.length ||
    typeof question.explanation !== "string"
  ) {
    return false;
  }

  if (!question.choices.every(
    choice => typeof choice === "string" && choice.trim() !== ""
  )) {
    return false;
  }

  if (LINE_MODES.includes(modeId)) {
    if (index === 0) {
      return question.choices.length === 4;
    }

    return question.choices.length === 1 && question.answer === 0;
  }

  const correctChoice = question.choices[question.answer];

  const distractors = Array.isArray(question.distractors)
    ? question.distractors
    : question.choices.filter(
        (choice, choiceIndex) => choiceIndex !== question.answer
      );

  const validDistractors = uniqueNonEmptyStrings(distractors)
    .filter(choice => choice !== correctChoice);

  return validDistractors.length >= 3;
}

// 登録された問題をモードごとにまとめる。
// 線モードでは配列の先頭が固定の1問目。
function getQuestionPool(modeIds) {
  const bank = QUESTION_BANK();
  const pool = [];

  for (const modeId of modeIds) {
    const questions = Array.isArray(bank[modeId])
      ? bank[modeId]
      : [];

    questions.forEach((question, index) => {
      if (!isValidQuestion(question, modeId, index)) {
        return;
      }

      pool.push({
        ...question,
        mode: modeId,
        sourceIndex: index
      });
    });
  }

  return pool;
}

// 線モードの2問目以降に使う誤答候補。
// そのモードの1問目は候補から完全に除外する。
function getLineDistractors(question, pool) {
  return uniqueNonEmptyStrings(
    pool
      .filter(item =>
        item.mode === question.mode &&
        item.sourceIndex > 0 &&
        item.sourceIndex !== question.sourceIndex
      )
      .map(item => item.choices[item.answer])
  ).filter(choice => {
    const correctChoice = question.choices[question.answer];
    return choice !== correctChoice;
  });
}

// 1問目は登録された4択をそのまま使い、順番だけ変える。
// それ以外の線モードは、他の問題の正解を誤答候補にする。
function prepareLineQuestion(question, pool) {
  let choices;

  if (question.sourceIndex === 0) {
    const correctChoice = question.choices[question.answer];

    choices = shuffle(question.choices);

    return {
      ...question,
      choices,
      answer: choices.indexOf(correctChoice)
    };
  }

  const correctChoice = question.choices[question.answer];
  const distractors = getLineDistractors(question, pool)
    .filter(choice => choice !== correctChoice);

  if (distractors.length < 3) {
    return null;
  }

  choices = shuffle([
    correctChoice,
    ...shuffle(distractors).slice(0, 3)
  ]);

  return {
    ...question,
    choices,
    answer: choices.indexOf(correctChoice)
  };
}

// 会話・その他・手相とはの問題は従来形式もサポートする。
function prepareGeneralQuestion(question) {
  const correctChoice = question.choices[question.answer];

  const distractors = Array.isArray(question.distractors)
    ? question.distractors
    : question.choices.filter(
        (choice, index) => index !== question.answer
      );

  const validDistractors = uniqueNonEmptyStrings(distractors)
    .filter(choice => choice !== correctChoice);

  if (validDistractors.length < 3) {
    return null;
  }

  const choices = shuffle([
    correctChoice,
    ...shuffle(validDistractors).slice(0, 3)
  ]);

  return {
    ...question,
    choices,
    answer: choices.indexOf(correctChoice)
  };
}

function prepareQuestion(question, pool) {
  if (LINE_MODES.includes(question.mode)) {
    return prepareLineQuestion(question, pool);
  }

  return prepareGeneralQuestion(question);
}

// 選択したジャンルの最初の問題を1問目に固定。
// 2問目以降はランダムに選ぶ。
function buildQuizQuestions(modeIds, count) {
  const bank = QUESTION_BANK();
  const pool = getQuestionPool(modeIds);

  if (pool.length === 0 || count <= 0) {
    return [];
  }

  // 選択モードの順番で、最初に見つかった有効問題を1問目にする。
  const firstQuestion = pool[0];
  let remainingQuestions = [];

  if (count < pool.length) {
    remainingQuestions = shuffle(pool.slice(1))
      .slice(0, count - 1);
  } else {
    remainingQuestions = shuffle(pool.slice(1));

    while (remainingQuestions.length < count - 1) {
      const randomQuestion =
        pool[Math.floor(Math.random() * pool.length)];

      remainingQuestions.push(randomQuestion);
    }
  }

  const selectedQuestions = [
    firstQuestion,
    ...remainingQuestions
  ];

  const preparedQuestions = selectedQuestions.map(question =>
    prepareQuestion(question, pool)
  );

  if (preparedQuestions.some(question => question === null)) {
    return [];
  }

  return preparedQuestions;
}

function renderHeader(showBack = false) {
  return `
    <div class="app-toolbar">
      <div class="toolbar-left">
        ${showBack ? `
          <button type="button" class="nav-button" id="back-button"
            aria-label="ひとつ前の画面に戻る" title="戻る">
            <svg viewBox="0 0 24 24" aria-hidden="true" class="nav-icon">
              <path d="M14.5 5.5 8 12l6.5 6.5"></path>
              <path d="M8.5 12H20"></path>
            </svg>
          </button>
        ` : ""}
      </div>

      <div class="toolbar-actions">
        <button type="button" class="icon-button" id="appearance-button"
          aria-label="表示の設定" title="表示の設定">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z"></path>
            <path d="m19.2 13.8 1.1.9-1.5 2.6-1.4-.5a7.8 7.8 0 0 1-1.5.9l-.2 1.5h-3l-.3-1.5a7.8 7.8 0 0 1-1.6-.6l-1.3.7-1.8-2.3 1-1.1a7.1 7.1 0 0 1-.2-1.7l-1.2-.8 1.2-2.7 1.5.3a7.5 7.5 0 0 1 1.4-1l.1-1.5h3l.4 1.4a7.5 7.5 0 0 1 1.6.6l1.3-.7 1.8 2.3-1 1.1c.2.6.3 1.2.3 1.8Z"></path>
          </svg>
        </button>

        <button type="button" class="nav-button home-button" id="home-button"
          aria-label="ホームに戻る" title="ホームに戻る">
          <svg viewBox="0 0 24 24" aria-hidden="true" class="nav-icon home-icon">
            <path d="m3.8 10.7 8.2-7 8.2 7"></path>
            <path d="M6.5 9.4v10h11v-10"></path>
            <path d="M10 19.4v-6h4v6"></path>
          </svg>
        </button>
      </div>
    </div>
  `;
}

function attachNavigation() {
  const appearanceButton =
    document.getElementById("appearance-button");

  if (appearanceButton) {
    appearanceButton.addEventListener(
      "click",
      openAppearanceSettings
    );
  }

  const homeButton = document.getElementById("home-button");

  if (homeButton) {
    homeButton.addEventListener("click", () => {
      screen = "home";
      renderHome();
    });
  }

  const backButton = document.getElementById("back-button");

  if (backButton) {
    backButton.addEventListener("click", () => {
      if (screen === "settings") {
        renderHome();
      } else if (screen === "quiz" || screen === "result") {
        renderSettings();
      } else if (screen === "appearance") {
        returnFromAppearanceSettings();
      }
    });
  }
}

function renderAppearanceSettings() {
  screen = "appearance";

  app.innerHTML = `
    ${renderHeader(true)}
    <section class="panel appearance-panel">
      <p class="eyebrow">PERSONALIZE</p>
      <h1>表示の設定</h1>
      <p class="intro">好きな色と明るさにカスタマイズできます。</p>

      <section class="appearance-section">
        <h2>テーマ</h2>
        <p class="muted">画面全体の明るさを選びます。</p>

        <div class="theme-options" role="group" aria-label="テーマ">
          <button type="button"
            class="theme-option ${appearance.theme === "light" ? "is-active" : ""}"
            data-theme-choice="light"
            aria-pressed="${appearance.theme === "light"}">
            <span class="theme-preview theme-preview-light" aria-hidden="true">
              <i></i><i></i><i></i>
            </span>
            <span>ライト</span>
            <span class="option-check">${appearance.theme === "light" ? "✓" : ""}</span>
          </button>

          <button type="button"
            class="theme-option ${appearance.theme === "dark" ? "is-active" : ""}"
            data-theme-choice="dark"
            aria-pressed="${appearance.theme === "dark"}">
            <span class="theme-preview theme-preview-dark" aria-hidden="true">
              <i></i><i></i><i></i>
            </span>
            <span>ダーク</span>
            <span class="option-check">${appearance.theme === "dark" ? "✓" : ""}</span>
          </button>
        </div>
      </section>

      <section class="appearance-section">
        <h2>スタイル</h2>
        <p class="muted">アプリのアクセントになるメインカラーです。</p>

        <div class="accent-grid">
          ${ACCENTS.map(item => `
            <button type="button"
              class="accent-option ${appearance.accent === item.id ? "is-active" : ""}"
              data-accent-choice="${item.id}"
              aria-pressed="${appearance.accent === item.id}">
              <span class="accent-swatch" style="--swatch:${item.color}"
                aria-hidden="true">${appearance.accent === item.id ? "✓" : ""}</span>
              <span>${item.name}</span>
            </button>
          `).join("")}
        </div>
      </section>

      <p class="settings-save-note" role="status">
        選んだ設定はこのブラウザに自動保存されます。
      </p>

      <button type="button" class="button button-secondary button-wide"
        id="appearance-done">戻る</button>
    </section>
  `;

  attachNavigation();

  app.querySelector("#back-button").addEventListener(
    "click",
    returnFromAppearanceSettings
  );

  app.querySelector("#appearance-done").addEventListener(
    "click",
    returnFromAppearanceSettings
  );

  app.querySelectorAll("[data-theme-choice]").forEach(button => {
    button.addEventListener("click", () => {
      appearance.theme = button.dataset.themeChoice;
      applyAppearance();
      renderAppearanceSettings();
    });
  });

  app.querySelectorAll("[data-accent-choice]").forEach(button => {
    button.addEventListener("click", () => {
      appearance.accent = button.dataset.accentChoice;
      applyAppearance();
      renderAppearanceSettings();
    });
  });
}

function renderHome() {
  screen = "home";

  app.innerHTML = `
    ${renderHeader(false)}
    <section class="panel">
      <p class="eyebrow">CULTURAL FESTIVAL</p>
      <h1>手相クイズ</h1>
      <p class="intro">知識を身につけて、自信を持って占えるようになろう。</p>

      <h2>出題モードを選ぶ</h2>

      <div class="mode-grid">
        ${MODES.map(mode => {
          const count = mode.id === "multiple"
            ? 0
            : countQuestions([mode.id]);

          return `
            <button type="button" class="mode-card"
              data-open-mode="${mode.id}">
              <span class="mode-name">${escapeHTML(mode.name)}</span>
              <span class="mode-description">${escapeHTML(mode.description)}</span>
              ${mode.id !== "multiple"
                ? `<span class="mode-count">登録問題：${count}問</span>`
                : ""}
            </button>
          `;
        }).join("")}
      </div>
    </section>
  `;

  attachNavigation();

  app.querySelectorAll("[data-open-mode]").forEach(button => {
    button.addEventListener("click", () => {
      currentMode = button.dataset.openMode;

      selectedModes = currentMode === "multiple"
        ? []
        : [currentMode];

      renderSettings();
    });
  });
}

function renderSettings() {
  screen = "settings";

  const isMultiple = currentMode === "multiple";
  const activeModes = isMultiple ? selectedModes : [currentMode];
  const available = countQuestions(activeModes);

  app.innerHTML = `
    ${renderHeader(true)}
    <section class="panel">
      <p class="eyebrow">QUIZ SETTINGS</p>

      <h1>${isMultiple
        ? "複数選択モード"
        : escapeHTML(
            MODES.find(mode => mode.id === currentMode)?.name || "クイズ"
          )}</h1>

      ${isMultiple ? `
        <h2>1. 出題ジャンルを選ぶ</h2>
        <p class="muted">出題したいジャンルにチェックを入れてください。</p>

        <div class="genre-check-list">
          ${MODES.filter(mode => mode.id !== "multiple").map(mode => `
            <label class="genre-check">
              <input type="checkbox" value="${mode.id}" data-genre-check
                ${selectedModes.includes(mode.id) ? "checked" : ""}>
              <span class="genre-check-text">
                <strong>${escapeHTML(mode.name)}</strong>
                <span class="mode-count">登録問題：${countQuestions([mode.id])}問</span>
              </span>
            </label>
          `).join("")}
        </div>

        <h2>2. 問題数を選ぶ</h2>
      ` : `
        <p class="intro">${escapeHTML(
          MODES.find(mode => mode.id === currentMode)?.description || ""
        )}</p>

        <p class="muted">このジャンルの問題だけが出題されます。</p>
        <h2>問題数を選ぶ</h2>
      `}

      <div class="count-control">
        <button type="button" class="button button-secondary" id="minus"
          aria-label="問題数を減らす">−</button>

        <strong id="count-value">${questionCount}問</strong>

        <button type="button" class="button button-secondary" id="plus"
          aria-label="問題数を増やす">＋</button>
      </div>

      <p class="muted" id="available-count">選択中の問題：${available}問</p>
      <p class="notice" id="settings-message" role="status"></p>

      <button type="button" class="button button-primary button-wide"
        id="start-button">クイズを開始</button>
    </section>
  `;

  attachNavigation();

  function updateAvailable() {
    const modes = isMultiple ? selectedModes : [currentMode];
    const total = countQuestions(modes);

    app.querySelector("#available-count").textContent =
      `選択中の問題：${total}問`;

    app.querySelector("#count-value").textContent =
      `${questionCount}問`;

    const message = app.querySelector("#settings-message");

    if (isMultiple && selectedModes.length === 0) {
      message.textContent =
        "出題ジャンルを1つ以上選んでください。";
    } else if (total === 0) {
      message.textContent =
        "出題できる問題がありません。";
    } else if (questionCount < total) {
      message.textContent =
        `登録問題は${total}問です。今回は先頭の問題を含め、ランダムに${questionCount}問出題します。`;
    } else if (questionCount > total) {
      message.textContent =
        `登録問題は${total}問です。足りない分は登録問題からランダムに再出題します。`;
    } else {
      message.textContent =
        `登録された${total}問を出題します。`;
    }
  }

  if (isMultiple) {
    app.querySelectorAll("[data-genre-check]").forEach(input => {
      input.addEventListener("change", () => {
        if (input.checked) {
          if (!selectedModes.includes(input.value)) {
            selectedModes.push(input.value);
          }
        } else {
          selectedModes = selectedModes.filter(
            id => id !== input.value
          );
        }

        updateAvailable();
      });
    });
  }

  app.querySelector("#minus").addEventListener("click", () => {
    questionCount = Math.max(9, questionCount - 1);
    updateAvailable();
  });

  app.querySelector("#plus").addEventListener("click", () => {
    questionCount = Math.min(100, questionCount + 1);
    updateAvailable();
  });

  app.querySelector("#start-button").addEventListener("click", () => {
    const modes = isMultiple ? selectedModes : [currentMode];

    if (modes.length === 0) {
      app.querySelector("#settings-message").textContent =
        "出題ジャンルを1つ以上選んでください。";
      return;
    }

    // 選択した各線モードについて、1問目と残りの問題を分けて検証する。
    const bank = QUESTION_BANK();

    for (const modeId of modes) {
      if (!LINE_MODES.includes(modeId)) continue;

      const questions = Array.isArray(bank[modeId]) ? bank[modeId] : [];

      const first = questions[0];
      const rest = questions.slice(1);

      if (!first || !isValidQuestion(first, modeId, 0)) {
        app.querySelector("#settings-message").textContent =
          `${MODES.find(mode => mode.id === modeId)?.name || modeId}の1問目は、4つの選択肢が必要です。`;
        return;
      }

      if (rest.some((question, index) =>
        !isValidQuestion(question, modeId, index + 1)
      )) {
        app.querySelector("#settings-message").textContent =
          `${MODES.find(mode => mode.id === modeId)?.name || modeId}の2問目以降は、正解の選択肢を1つだけ登録してください。`;
        return;
      }

      const answerPool = uniqueNonEmptyStrings(
        rest.map(question => question.choices[0])
      );

      if (answerPool.length < 4) {
        app.querySelector("#settings-message").textContent =
          `${MODES.find(mode => mode.id === modeId)?.name || modeId}の2〜9問目に、少なくとも4種類の異なる正解を登録してください。`;
        return;
      }
    }

    quizQuestions = buildQuizQuestions(modes, questionCount);

    if (quizQuestions.length === 0) {
      app.querySelector("#settings-message").textContent =
        "4択を作れない問題があります。問題の正解や誤答候補を確認してください。";
      return;
    }

    currentIndex = 0;
    correctCount = 0;
    answered = false;

    renderQuestion();
  });

  updateAvailable();
}

function renderQuestion() {
  screen = "quiz";

  const question = quizQuestions[currentIndex];
  answered = false;

  const modeName =
    MODES.find(mode => mode.id === question.mode)?.name || "クイズ";

  const imagePath = typeof question.image === "string"
    ? question.image.trim()
    : "";

  const imageHTML = imagePath ? `
    <div class="question-image-wrap">
      <img class="question-image"
        src="${escapeHTML(imagePath)}"
        alt="問題の画像"
        onerror="this.closest('.question-image-wrap').hidden=true">
    </div>
  ` : "";

  app.innerHTML = `
    ${renderHeader(true)}
    <section class="panel">
      <div class="quiz-top">
        <span class="eyebrow">${escapeHTML(modeName)}</span>
        <span class="progress-label">
          ${currentIndex + 1} / ${quizQuestions.length}問
        </span>
      </div>

      <div class="progress-track">
        <div class="progress-fill"
          style="width:${((currentIndex + 1) / quizQuestions.length) * 100}%">
        </div>
      </div>

      ${imageHTML}

      <h1 class="question-title">${escapeHTML(question.question)}</h1>

      <div class="choices">
        ${question.choices.map((choice, index) => `
          <button type="button" class="choice-button"
            data-choice="${index}">
            <span class="choice-letter">${["A", "B", "C", "D"][index]}</span>
            <span>${escapeHTML(choice)}</span>
          </button>
        `).join("")}
      </div>

      <div id="feedback"></div>

      <button type="button"
        class="button button-primary button-wide hidden"
        id="next-button">次の問題へ</button>
    </section>
  `;

  attachNavigation();

  app.querySelectorAll("[data-choice]").forEach(button => {
    button.addEventListener("click", () => {
      chooseAnswer(Number(button.dataset.choice));
    });
  });

  app.querySelector("#next-button").addEventListener("click", () => {
    currentIndex++;

    if (currentIndex >= quizQuestions.length) {
      renderResult();
    } else {
      renderQuestion();
    }
  });
}

function restoreAnsweredQuestion() {
  answered = true;

  const question = quizQuestions[currentIndex];
  if (!question) return;

  app.querySelectorAll("[data-choice]").forEach((button, index) => {
    button.disabled = true;

    if (index === question.answer) {
      button.classList.add("is-correct");
    }
  });

  const feedback = app.querySelector("#feedback");

  if (feedback) {
    feedback.className = "feedback feedback-correct";
    feedback.innerHTML = `
      <h2>回答済み</h2>
      <p><strong>正解：</strong>${escapeHTML(question.choices[question.answer])}</p>
      <p>${escapeHTML(question.explanation)}</p>
    `;
  }

  const nextButton = app.querySelector("#next-button");

  if (nextButton) {
    nextButton.classList.remove("hidden");
    nextButton.textContent =
      currentIndex === quizQuestions.length - 1
        ? "結果を見る"
        : "次の問題へ";
  }
}

function chooseAnswer(choiceIndex) {
  if (answered) return;

  answered = true;

  const question = quizQuestions[currentIndex];
  const isCorrect = choiceIndex === question.answer;

  if (isCorrect) {
    correctCount++;
  }

  app.querySelectorAll("[data-choice]").forEach((button, index) => {
    button.disabled = true;

    if (index === question.answer) {
      button.classList.add("is-correct");
    } else if (index === choiceIndex) {
      button.classList.add("is-incorrect");
    }
  });

  const feedback = app.querySelector("#feedback");

  feedback.className =
    `feedback ${isCorrect ? "feedback-correct" : "feedback-incorrect"}`;

  feedback.innerHTML = `
    <h2>${isCorrect ? "正解！" : "不正解"}</h2>
    <p><strong>正解：</strong>${escapeHTML(question.choices[question.answer])}</p>
    <p>${escapeHTML(question.explanation)}</p>
  `;

  const nextButton = app.querySelector("#next-button");

  nextButton.classList.remove("hidden");
  nextButton.textContent =
    currentIndex === quizQuestions.length - 1
      ? "結果を見る"
      : "次の問題へ";
}

function renderResult() {
  screen = "result";

  const total = quizQuestions.length;

  const percentage = total > 0
    ? Math.round((correctCount / total) * 100)
    : 0;

  app.innerHTML = `
    ${renderHeader(true)}
    <section class="panel result-panel" style="color:var(--text)">
      <p class="eyebrow">QUIZ COMPLETE</p>
      <h1>お疲れさま！</h1>

      <p class="result-score" style="color:var(--text)">
        ${correctCount} <span>/ ${total}問正解</span>
      </p>

      <p class="result-percentage" style="color:var(--text)">
        正答率 ${percentage}%
      </p>

      <div class="result-bar">
        <div style="width:${percentage}%"></div>
      </div>

      <button type="button" class="button button-primary button-wide"
        id="retry-button">もう一度挑戦する</button>

      <button type="button" class="button button-secondary button-wide"
        id="home-result-button">ホームに戻る</button>
    </section>
  `;

  attachNavigation();

  app.querySelector("#retry-button").addEventListener("click", () => {
    const modes = currentMode === "multiple"
      ? selectedModes
      : [currentMode];

    quizQuestions = buildQuizQuestions(modes, questionCount);

    if (quizQuestions.length === 0) {
      renderSettings();
      return;
    }

    currentIndex = 0;
    correctCount = 0;
    answered = false;

    renderQuestion();
  });

  app.querySelector("#home-result-button").addEventListener("click", () => {
    screen = "home";
    renderHome();
  });
}

applyAppearance();
renderHome();
