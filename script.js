const app = document.getElementById("app");

const MODES = [
  { id: "life", name: "生命線", description: "生命線の意味や見方" },
  { id: "head", name: "頭脳線", description: "頭脳線の意味や見方" },
  { id: "heart", name: "感情線", description: "感情線の意味や見方" },
  { id: "marriage", name: "運命線", description: "運命線の意味や見方" },
  { id: "conversation", name: "会話", description: "占い中の受け答え" },
  { id: "other", name: "その他の線", description: "結婚線などの知識" },
  { id: "palmistry", name: "手相とは", description: "手相の基礎や考え方" },
  { id: "multiple", name: "複数選択モード", description: "好きなジャンルを組み合わせる" }
];

const LINE_MODES = ["life", "head", "heart", "marriage"];
const QUESTION_BANK = () => window.PALM_QUESTIONS || {};

const APPEARANCE_KEY = "tesouquiz-appearance";
const SOUND_KEY = "tesouquiz-sound";

const ACCENTS = [
  { id: "black", name: "ブラック", color: "#686b6b" },
  { id: "white", name: "ホワイト", color: "#c7c5bc" },
  { id: "blue", name: "ブルー", color: "#86a9c5" },
  { id: "light-blue", name: "ライトブルー", color: "#b8d9e8" },
  { id: "green", name: "グリーン", color: "#789477" },
  { id: "orange", name: "オレンジ", color: "#d99a62" },
  { id: "light-green", name: "ライトグリーン", color: "#a9c5a0" },
  { id: "light-orange", name: "ライトオレンジ", color: "#efc69b" }
];

let screen = "home";
let currentMode = "life";
let selectedModes = ["life", "head"];
let questionCount = 10;
let settingsReturnScreen = "home";
let settingsReturnAnswered = false;

let quizQuestions = [];
let currentIndex = 0;
let correctCount = 0;
let answered = false;

/* 保存済み設定 */

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

function loadSoundSettings() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(SOUND_KEY) || "{}"
    );

    const volume = Number(saved.volume);

    return {
      volume:
        Number.isInteger(volume) && volume >= 0 && volume <= 5
          ? volume
          : 2
    };
  } catch {
    return { volume: 2 };
  }
}

let appearance = loadAppearance();
let soundSettings = loadSoundSettings();

/* BGM */

const bgm = new Audio("./audio/bgm.mp3");

bgm.loop = false;
bgm.preload = "auto";
bgm.playsInline = true;
bgm.volume = soundSettings.volume / 5;

let bgmTimer = null;
let bgmStartedByUser = false;

function saveSoundSettings() {
  try {
    localStorage.setItem(
      SOUND_KEY,
      JSON.stringify(soundSettings)
    );
  } catch (error) {}
}

function clearBgmTimer() {
  if (bgmTimer !== null) {
    clearTimeout(bgmTimer);
    bgmTimer = null;
  }
}

/*
  音量変更は音量だけに反映する。
  音量0でも再生を停止したり、再生位置を戻したりしない。
*/
function applyVolume() {
  bgm.volume = soundSettings.volume / 5;
  saveSoundSettings();
}

/*
  ユーザー操作から呼び出して再生する。
  再生エラーはコンソールに記録する。
*/
function startBGM() {
  if (soundSettings.volume <= 0) return;

  clearBgmTimer();

  bgm.play().then(() => {
    bgmStartedByUser = true;
  }).catch(error => {
    console.error(
      "BGMの再生に失敗:",
      error.name,
      error.message
    );
  });
}

/*
  曲が終わったら3秒待ってから次の再生を試みる。
*/
bgm.addEventListener("ended", () => {
  clearBgmTimer();

  if (!bgmStartedByUser || soundSettings.volume <= 0) {
    return;
  }

  bgmTimer = setTimeout(() => {
    bgmTimer = null;

    if (bgmStartedByUser && soundSettings.volume > 0) {
      startBGM();
    }
  }, 3000);
});

/*
  読み込み・再生状況の記録。
*/
bgm.addEventListener("error", () => {
  console.error(
    "BGMファイルの読み込みに失敗:",
    bgm.error ? bgm.error.code : "unknown",
    bgm.currentSrc || bgm.src
  );
});

bgm.addEventListener("loadedmetadata", () => {
  console.info(
    "BGMのメタデータを読み込みました:",
    "duration =", bgm.duration,
    "URL =", bgm.currentSrc
  );
});

bgm.addEventListener("playing", () => {
  console.info("BGMを再生しています");
});

/*
  タッチ操作・クリック操作のイベントは重複登録しない。
  開始ボタン以外の操作でも再生を試みるが、
  iOSでは操作の種類やタイミングによって再生が
  許可されない場合がある。
*/
function handleBgmInteraction() {
  if (
    soundSettings.volume > 0 &&
    bgm.paused &&
    bgmTimer === null
  ) {
    startBGM();
  }
}

document.addEventListener(
  "touchend",
  handleBgmInteraction,
  { passive: true }
);

document.addEventListener(
  "click",
  handleBgmInteraction
);

/* 外観 */

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

function countQuestions(modeIds) {
  const bank = QUESTION_BANK();

  return modeIds.reduce((total, id) => {
    return total + (
      Array.isArray(bank[id]) ? bank[id].length : 0
    );
  }, 0);
}

/* 問題データの検証 */

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

  if (modeId === "conversation" && index === 0) {
    return question.choices.length === 2;
  }

  const correctChoice = question.choices[question.answer];

  const distractors = Array.isArray(question.distractors)
    ? question.distractors
    : question.choices.filter(
        (_, i) => i !== question.answer
      );

  return uniqueNonEmptyStrings(distractors)
    .filter(choice => choice !== correctChoice).length >= 3;
}

function getQuestionPool(modeIds) {
  const bank = QUESTION_BANK();
  const pool = [];

  for (const modeId of modeIds) {
    const questions = Array.isArray(bank[modeId])
      ? bank[modeId]
      : [];

    questions.forEach((question, index) => {
      if (!isValidQuestion(question, modeId, index)) return;

      pool.push({
        ...question,
        mode: modeId,
        sourceIndex: index
      });
    });
  }

  return pool;
}

function getLineDistractors(question, pool) {
  return uniqueNonEmptyStrings(
    pool
      .filter(item =>
        item.mode === question.mode &&
        item.sourceIndex > 0 &&
        item.sourceIndex !== question.sourceIndex
      )
      .map(item => item.choices[item.answer])
  ).filter(
    choice => choice !== question.choices[question.answer]
  );
}

function prepareLineQuestion(question, pool) {
  const correctChoice = question.choices[question.answer];

  if (question.sourceIndex === 0) {
    const choices = shuffle(question.choices);

    return {
      ...question,
      choices,
      answer: choices.indexOf(correctChoice)
    };
  }

  const distractors = getLineDistractors(question, pool);

  if (distractors.length < 3) return null;

  const choices = shuffle([
    correctChoice,
    ...shuffle(distractors).slice(0, 3)
  ]);

  return {
    ...question,
    choices,
    answer: choices.indexOf(correctChoice)
  };
}

function prepareGeneralQuestion(question) {
  const correctChoice = question.choices[question.answer];

  if (
    question.mode === "conversation" &&
    question.sourceIndex === 0
  ) {
    const choices = shuffle(question.choices);

    return {
      ...question,
      choices,
      answer: choices.indexOf(correctChoice)
    };
  }

  const distractors = Array.isArray(question.distractors)
    ? question.distractors
    : question.choices.filter(
        (_, i) => i !== question.answer
      );

  const validDistractors = uniqueNonEmptyStrings(distractors)
    .filter(choice => choice !== correctChoice);

  if (validDistractors.length < 3) return null;

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
  return LINE_MODES.includes(question.mode)
    ? prepareLineQuestion(question, pool)
    : prepareGeneralQuestion(question);
}

function buildQuizQuestions(modeIds, count) {
  const pool = getQuestionPool(modeIds);

  if (pool.length === 0 || count <= 0) return [];

  const firstQuestion = pool[0];
  let remainingQuestions = [];

  if (count < pool.length) {
    remainingQuestions = shuffle(pool.slice(1))
      .slice(0, count - 1);
  } else {
    remainingQuestions = shuffle(pool.slice(1));

    while (remainingQuestions.length < count - 1) {
      remainingQuestions.push(
        pool[Math.floor(Math.random() * pool.length)]
      );
    }
  }

  const prepared = [firstQuestion, ...remainingQuestions]
    .map(question => prepareQuestion(question, pool));

  return prepared.some(question => question === null)
    ? []
    : prepared;
}

/* ヘッダー */

function renderHeader(showBack = false) {
  return `
    <div class="app-toolbar">
      <div class="toolbar-left">
        ${showBack ? `
          <button
            type="button"
            class="nav-button"
            id="back-button"
            aria-label="戻る"
            title="戻る">

            <svg viewBox="0 0 24 24"
              class="nav-icon"
              aria-hidden="true">
              <path d="M14.5 5.5 8 12l6.5 6.5"></path>
              <path d="M8.5 12H20"></path>
            </svg>
          </button>
        ` : ""}
      </div>

      <div class="toolbar-actions">
        <button
          type="button"
          class="icon-button"
          id="appearance-button"
          aria-label="設定"
          title="設定">

          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z"></path>
            <path d="M19.4 13.5a7.7 7.7 0 0 0 0-3l1.5-1.2-1.8-3.1-1.8.7a7.6 7.6 0 0 0-2.6-1.5L14.4 3h-3.6l-.3 2.4a7.6 7.6 0 0 0-2.6 1.5l-1.8-.7-1.8 3.1 1.5 1.2a7.7 7.7 0 0 0 0 3l-1.5 1.2 1.8 3.1 1.8-.7a7.6 7.6 0 0 0 2.6 1.5l.3 2.4h3.6l.3-2.4a7.6 7.6 0 0 0 2.6-1.5l1.8.7 1.8-3.1-1.5-1.2Z"></path>
          </svg>
        </button>

        <button
          type="button"
          class="nav-button home-button"
          id="home-button"
          aria-label="ホームに戻る"
          title="ホームに戻る">

          <svg viewBox="0 0 24 24"
            class="nav-icon home-icon"
            aria-hidden="true">
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
      openSettingsMenu
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
    backButton.addEventListener("click", handleBack);
  }
}

function handleBack() {
  if (screen === "settings-menu") {
    returnFromSettingsMenu();
  } else if (
    screen === "style-settings" ||
    screen === "sound-settings"
  ) {
    renderSettingsMenu();
  } else if (screen === "settings") {
    renderHome();
  } else if (screen === "quiz" || screen === "result") {
    renderSettings();
  } else {
    renderHome();
  }
}

/* 設定メニュー */

function openSettingsMenu() {
  settingsReturnScreen = screen;
  settingsReturnAnswered = answered;
  renderSettingsMenu();
}

function returnFromSettingsMenu() {
  if (settingsReturnScreen === "quiz") {
    const wasAnswered = settingsReturnAnswered;

    renderQuestion();

    if (wasAnswered) {
      restoreAnsweredQuestion();
    }
  } else if (settingsReturnScreen === "result") {
    renderResult();
  } else if (settingsReturnScreen === "settings") {
    renderSettings();
  } else {
    renderHome();
  }
}

function renderSettingsMenu() {
  screen = "settings-menu";

  app.innerHTML = `
    ${renderHeader(true)}

    <section class="panel settings-menu-panel">
      <p class="eyebrow">PERSONALIZE</p>
      <h1>設定</h1>
      <p class="intro">自分好みにカスタマイズできます。</p>

      <button
        class="settings-menu-item"
        type="button"
        id="open-style">

        <span class="settings-menu-icon" aria-hidden="true">◐</span>

        <span class="settings-menu-copy">
          <strong>スタイル</strong>
          <span>テーマ・メインカラーを変更</span>
        </span>

        <span class="settings-menu-arrow" aria-hidden="true">›</span>
      </button>

      <button
        class="settings-menu-item"
        type="button"
        id="open-sound">

        <span class="settings-menu-icon" aria-hidden="true">♫</span>

        <span class="settings-menu-copy">
          <strong>サウンド</strong>
          <span>BGMの音量を変更</span>
        </span>

        <span class="settings-menu-arrow" aria-hidden="true">›</span>
      </button>
    </section>
  `;

  attachNavigation();

  app.querySelector("#open-style").addEventListener(
    "click",
    renderStyleSettings
  );

  app.querySelector("#open-sound").addEventListener(
    "click",
    renderSoundSettings
  );
}

/* スタイル設定 */

function renderStyleSettings() {
  screen = "style-settings";

  app.innerHTML = `
    ${renderHeader(true)}

    <section class="panel appearance-panel">
      <p class="eyebrow">STYLE</p>
      <h1>スタイル</h1>
      <p class="intro">画面の明るさとメインカラーを選べます。</p>

      <section class="appearance-section">
        <h2>テーマ</h2>

        <div class="theme-options">
          ${[
            { id: "light", name: "ライト" },
            { id: "dark", name: "ダーク" }
          ].map(item => `
            <button
              type="button"
              class="theme-option ${
                appearance.theme === item.id ? "is-active" : ""
              }"
              data-theme-choice="${item.id}"
              aria-pressed="${appearance.theme === item.id}">

              <span
                class="theme-preview theme-preview-${item.id}"
                aria-hidden="true">
                <i></i><i></i><i></i>
              </span>

              <span>${item.name}</span>

              <span class="option-check">
                ${appearance.theme === item.id ? "✓" : ""}
              </span>
            </button>
          `).join("")}
        </div>
      </section>

      <section class="appearance-section">
        <h2>メインカラー</h2>
        <p class="muted">
          ボタンや選択状態、進捗バーに反映されます。
        </p>

        <div class="accent-grid">
          ${ACCENTS.map(item => `
            <button
              type="button"
              class="accent-option ${
                appearance.accent === item.id ? "is-active" : ""
              }"
              data-accent-choice="${item.id}"
              aria-pressed="${appearance.accent === item.id}">

              <span
                class="accent-swatch"
                style="--swatch:${item.color}"
                aria-hidden="true">
                ${appearance.accent === item.id ? "✓" : ""}
              </span>

              <span>${item.name}</span>
            </button>
          `).join("")}
        </div>
      </section>

      <p class="settings-save-note">
        選んだ設定は自動保存されます。
      </p>
    </section>
  `;

  attachNavigation();

  app.querySelectorAll("[data-theme-choice]").forEach(button => {
    button.addEventListener("click", () => {
      appearance.theme = button.dataset.themeChoice;
      applyAppearance();
      renderStyleSettings();
    });
  });

  app.querySelectorAll("[data-accent-choice]").forEach(button => {
    button.addEventListener("click", () => {
      appearance.accent = button.dataset.accentChoice;
      applyAppearance();
      renderStyleSettings();
    });
  });
}

/* サウンド設定 */

function renderSoundSettings() {
  screen = "sound-settings";

  app.innerHTML = `
    ${renderHeader(true)}

    <section class="panel sound-panel">
      <p class="eyebrow">SOUND</p>
      <h1>サウンド</h1>
      <p class="intro">BGMの音量を調節できます。</p>

      <div class="volume-card">
        <div class="volume-heading">
          <label for="volume-slider">BGM音量</label>

          <strong id="volume-value">
            ${soundSettings.volume === 0
              ? "オフ"
              : `${soundSettings.volume} / 5`}
          </strong>
        </div>

        <input
          id="volume-slider"
          class="volume-slider"
          type="range"
          min="0"
          max="5"
          step="1"
          value="${soundSettings.volume}"
          aria-label="BGM音量"
        >
      </div>
    </section>
  `;

  attachNavigation();

  const slider = app.querySelector("#volume-slider");
  const value = app.querySelector("#volume-value");

  function updateVolumeProgress() {
    const progress = (soundSettings.volume / 5) * 100;

    slider.style.setProperty(
      "--volume-progress",
      `${progress}%`
    );
  }

  updateVolumeProgress();

  slider.addEventListener("input", event => {
    soundSettings.volume = Number(event.target.value);

    updateVolumeProgress();
    applyVolume();

    value.textContent = soundSettings.volume === 0
      ? "オフ"
      : `${soundSettings.volume} / 5`;

    /*
      音量0にしても停止しない。
      0より大きい音量に変更した場合だけ、
      再生中でなければ再生を試みる。
    */
    if (soundSettings.volume > 0 && bgm.paused) {
      startBGM();
    }
  });
}

/* ホーム */

function renderHome() {
  screen = "home";

  app.innerHTML = `
    ${renderHeader(false)}

    <section class="panel home-panel">
      <p class="eyebrow">CULTURAL FESTIVAL</p>
      <h1 class="home-title">手相クイズ</h1>
      <p class="intro home-intro">
        覚える量多くて大変だけどまぁがんばろう。
      </p>

      <h2>出題モードを選ぶ</h2>

      <div class="mode-grid">
        ${MODES.map(mode => {
          const count = mode.id === "multiple"
            ? 0
            : countQuestions([mode.id]);

          return `
            <button
              type="button"
              class="mode-card"
              data-open-mode="${mode.id}">

              <span class="mode-name">
                ${escapeHTML(mode.name)}
              </span>

              <span class="mode-description">
                ${escapeHTML(mode.description)}
              </span>

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

/* クイズ設定 */

function renderSettings() {
  screen = "settings";

  const isMultiple = currentMode === "multiple";
  const activeModes = isMultiple ? selectedModes : [currentMode];
  const available = countQuestions(activeModes);

  app.innerHTML = `
    ${renderHeader(true)}

    <section class="panel settings-panel">
      <p class="eyebrow">QUIZ SETTINGS</p>

      <h1>${
        isMultiple
          ? "複数選択モード"
          : escapeHTML(
              MODES.find(mode => mode.id === currentMode)?.name || "クイズ"
            )
      }</h1>

      ${isMultiple ? `
        <h2>1. 出題ジャンルを選ぶ</h2>
        <p class="muted">
          出題したいジャンルにチェックを入れてください。
        </p>

        <div class="genre-check-list">
          ${MODES.filter(mode => mode.id !== "multiple").map(mode => `
            <label class="genre-check">
              <input
                type="checkbox"
                value="${mode.id}"
                data-genre-check
                ${selectedModes.includes(mode.id) ? "checked" : ""}>

              <span class="genre-check-text">
                <strong>${escapeHTML(mode.name)}</strong>
                <span class="mode-count">
                  登録問題：${countQuestions([mode.id])}問
                </span>
              </span>
            </label>
          `).join("")}
        </div>

        <h2>2. 問題数を選ぶ</h2>
      ` : `
        <p class="intro">
          ${escapeHTML(
            MODES.find(mode => mode.id === currentMode)?.description || ""
          )}
        </p>

        <p class="muted">
          このジャンルの問題だけが出題されます。
        </p>

        <h2>問題数を選ぶ</h2>
      `}

      <div class="count-control">
        <button
          type="button"
          class="button button-secondary"
          id="minus"
          aria-label="問題数を減らす">−</button>

        <strong id="count-value">${questionCount}問</strong>

        <button
          type="button"
          class="button button-secondary"
          id="plus"
          aria-label="問題数を増やす">＋</button>
      </div>

      <p class="muted" id="available-count">
        選択中の問題：${available}問
      </p>

      <p class="notice" id="settings-message" role="status"></p>

      <button
        type="button"
        class="button button-primary button-wide"
        id="start-button">クイズを開始</button>
    </section>
  `;

  attachNavigation();

  function updateAvailable() {
    const total = countQuestions(
      isMultiple ? selectedModes : [currentMode]
    );

    app.querySelector("#available-count").textContent =
      `選択中の問題：${total}問`;

    app.querySelector("#count-value").textContent =
      `${questionCount}問`;

    const message = app.querySelector("#settings-message");

    if (isMultiple && selectedModes.length === 0) {
      message.textContent =
        "出題ジャンルを1つ以上選んでください。";
    } else if (total === 0) {
      message.textContent = "出題できる問題がありません。";
    } else if (questionCount < total) {
      message.textContent =
        `登録問題は${total}問です。今回は先頭の問題を含め、ランダムに${questionCount}問出題します。`;
    } else if (questionCount > total) {
      message.textContent =
        `登録問題は${total}問です。足りない分は登録問題からランダムに再出題します。`;
    } else {
      message.textContent = `登録された${total}問を出題します。`;
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
    /*
      iPhoneでの再生許可を得るため、
      ユーザーが開始ボタンを押した操作の中で
      直接再生を試みる。
    */
    if (soundSettings.volume > 0 && bgm.paused) {
      startBGM();
    }

    const modes = isMultiple ? selectedModes : [currentMode];
    const message = app.querySelector("#settings-message");

    if (modes.length === 0) {
      message.textContent =
        "出題ジャンルを1つ以上選んでください。";
      return;
    }

    const bank = QUESTION_BANK();

    for (const modeId of modes) {
      if (!LINE_MODES.includes(modeId)) continue;

      const questions = Array.isArray(bank[modeId])
        ? bank[modeId]
        : [];

      const first = questions[0];
      const rest = questions.slice(1);

      const modeName =
        MODES.find(mode => mode.id === modeId)?.name || modeId;

      if (!first || !isValidQuestion(first, modeId, 0)) {
        message.textContent =
          `${modeName}の1問目は、4つの選択肢が必要です。`;
        return;
      }

      if (rest.some(
        (question, index) =>
          !isValidQuestion(question, modeId, index + 1)
      )) {
        message.textContent =
          `${modeName}の2問目以降は、正解の選択肢を1つだけ登録してください。`;
        return;
      }

      const answerPool = uniqueNonEmptyStrings(
        rest.map(question => question.choices[0])
      );

      if (answerPool.length < 4) {
        message.textContent =
          `${modeName}の2〜9問目に、少なくとも4種類の異なる正解を登録してください。`;
        return;
      }
    }

    quizQuestions = buildQuizQuestions(modes, questionCount);

    if (quizQuestions.length === 0) {
      message.textContent =
        "このモードはまだ準備中です。てか需要が分からないので要望なかったら多分一生準備中です。";
      return;
    }

    currentIndex = 0;
    correctCount = 0;
    answered = false;

    renderQuestion();
  });

  updateAvailable();
}

/* 問題表示 */

function renderQuestion() {
  screen = "quiz";

  const question = quizQuestions[currentIndex];

  if (!question) {
    renderResult();
    return;
  }

  answered = false;

  const modeName =
    MODES.find(mode => mode.id === question.mode)?.name || "クイズ";

  const imagePath =
    typeof question.image === "string"
      ? question.image.trim()
      : "";

  const imageHTML = imagePath ? `
    <div class="question-image-wrap">
      <img
        class="question-image"
        src="${escapeHTML(imagePath)}"
        alt="問題の画像"
        onerror="this.closest('.question-image-wrap').hidden=true">
    </div>
  ` : "";

  app.innerHTML = `
    ${renderHeader(true)}

    <section class="panel quiz-panel">
      <div class="quiz-top">
        <span class="eyebrow">${escapeHTML(modeName)}</span>
        <span class="progress-label">
          ${currentIndex + 1} / ${quizQuestions.length}問
        </span>
      </div>

      <div class="progress-track">
        <div
          class="progress-fill"
          style="width:${
            ((currentIndex + 1) / quizQuestions.length) * 100
          }%">
        </div>
      </div>

      ${imageHTML}

      <h1 class="question-title" style="white-space:pre-line">${escapeHTML(question.question)}</h1>

      <div class="choices">
        ${question.choices.map((choice, index) => `
          <button
            type="button"
            class="choice-button"
            data-choice="${index}"><span class="choice-letter">${["A", "B", "C", "D"][index]}</span><span class="choice-text">${escapeHTML(choice)}</span></button>
        `).join("")}
      </div>

      <div id="feedback"></div>

      <button
        type="button"
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
      <p>
        <strong>正解：</strong>${escapeHTML(
          question.choices[question.answer]
        )}
      </p>
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

  if (isCorrect) correctCount++;

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
    `feedback ${
      isCorrect ? "feedback-correct" : "feedback-incorrect"
    }`;

  feedback.innerHTML = `
    <h2>${isCorrect ? "正解！" : "不正解"}</h2>
    <p>
      <strong>正解：</strong>${escapeHTML(
        question.choices[question.answer]
      )}
    </p>
    <p>${escapeHTML(question.explanation)}</p>
  `;

  const nextButton = app.querySelector("#next-button");

  nextButton.classList.remove("hidden");

  nextButton.textContent =
    currentIndex === quizQuestions.length - 1
      ? "結果を見る"
      : "次の問題へ";
}

/* 結果 */

function renderResult() {
  screen = "result";

  const total = quizQuestions.length;
  const percentage = total > 0
    ? Math.round((correctCount / total) * 100)
    : 0;

  app.innerHTML = `
    ${renderHeader(true)}

    <section class="panel result-panel">
      <p class="eyebrow">QUIZ COMPLETE</p>
      <h1>スクショでリーダーに自慢しよう</h1>

      <p class="result-score">
        ${correctCount} <span>/ ${total}問正解</span>
      </p>

      <p class="result-percentage">正答率 ${percentage}%</p>

      <div class="result-bar">
        <div style="width:${percentage}%"></div>
      </div>

      <button
        type="button"
        class="button button-primary button-wide"
        id="retry-button">もう一度挑戦する</button>

      <button
        type="button"
        class="button button-secondary button-wide"
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

  app.querySelector("#home-result-button").addEventListener(
    "click",
    renderHome
  );
}

/* 初期化 */

applyAppearance();
applyVolume();
renderHome();