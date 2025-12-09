// game.js — clean, working version
// --------------------------------

// ----- CONFIG --------------------------------------------------------------

const MODES = {
  SPECTRO: "spectrogram",
  IMAGE: "image",
  FACTS: "facts",
};

const MODE_LABELS = {
  [MODES.SPECTRO]: "Spectrogram training",
  [MODES.IMAGE]: "Image recognition",
  [MODES.FACTS]: "Fact matching",
};

const ROUNDS_PER_GAME = 5;

// Expect SPECIES_DATA to be defined in species-data.js
const ALL_SPECIES =
  typeof SPECIES_DATA !== "undefined" && Array.isArray(SPECIES_DATA)
    ? SPECIES_DATA
    : [];

if (!ALL_SPECIES.length) {
  console.warn(
    "SPECIES_DATA is missing or not an array. Check species-data.js (must define const SPECIES_DATA = [...])."
  );
}

// ----- END SCREEN MESSAGES -------------------------------------------------

function getEndMessage(mode, score) {
  const s = Math.max(0, Math.min(5, score));

  if (mode === MODES.SPECTRO) {
    switch (s) {
      case 0:
        return "You need to clean your ears. Play again…";
      case 1:
        return "You need to learn to listen. Play again…";
      case 2:
        return "Almost halfway there!";
      case 3:
        return "Pretty good! Your chance of finding a mate is more than 50%!";
      case 4:
        return "Impressive ears!";
      case 5:
        return "Master of insect sounds! You must be an insect sound biologist!";
    }
  } else if (mode === MODES.IMAGE) {
    switch (s) {
      case 0:
        return "You might need new glasses. Try again!";
      case 1:
        return "Look a little closer—these insects have great camouflage!";
      case 2:
        return "Almost halfway there—those field marks are sinking in.";
      case 3:
        return "Pretty good insect spotting!";
      case 4:
        return "Excellent eye for detail!";
      case 5:
        return "Visual ID master! You’d make a great field guide illustrator.";
    }
  } else if (mode === MODES.FACTS) {
    switch (s) {
      case 0:
        return "You need to study your insect facts. Try again!";
      case 1:
        return "You’re just getting to know these species—keep reading!";
      case 2:
        return "Almost halfway there—those natural history facts are sinking in.";
      case 3:
        return "Pretty good knowledge! The insects are impressed.";
      case 4:
        return "Great memory for insect trivia!";
      case 5:
        return "Natural history wizard! You definitely think like an insect biologist.";
    }
  }
  return "Nice work!";
}

// ----- SIMPLE SOUND EFFECTS (DING + FANFARE) -------------------------------

let audioCtx = null;

function ensureAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function playCorrectDing() {
  try {
    ensureAudioCtx();
    const ctx = audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch (e) {
    // ignore
  }
}

function playEndFanfare() {
  try {
    ensureAudioCtx();
    const ctx = audioCtx;
    const freqs = [523.25, 659.25, 783.99]; // C E G-ish

    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + i * 0.03;
      const end = start + 0.5;

      osc.type = "triangle";
      osc.frequency.value = f;

      gain.gain.setValueAtTime(0.0, start);
      gain.gain.linearRampToValueAtTime(0.2, start + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, end);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(end + 0.05);
    });
  } catch (e) {
    // ignore
  }
}

// ----- HELPERS --------------------------------------------------------------

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function hide(el) {
  if (el) el.classList.add("hidden");
}
function show(el) {
  if (el) el.classList.remove("hidden");
}

function getRegionsFromSpecies() {
  const counts = new Map();
  ALL_SPECIES.forEach((sp) => {
    const regs = sp.regions && sp.regions.length ? sp.regions : ["All regions"];
    regs.forEach((r) => counts.set(r, (counts.get(r) || 0) + 1));
  });
  return counts;
}

function displayName(sp, sciMode) {
  if (!sp) return "";
  if (sciMode && sp.scientificName) return sp.scientificName;
  return sp.commonName || sp.name || "";
}

// ----- STATE ----------------------------------------------------------------

let currentMode = MODES.SPECTRO;
let currentRegion = "All regions";
let showSci = false;

let filtered = [];
let queue = [];
let currentRound = 0;
let correctFirstTry = 0;

let currentSpecies = null;
let currentOptions = [];
let firstGuess = true;
let answered = false;

// DOM refs
let elModeLabel,
  elRegionToggle,
  elModeBubble,
  elSciToggle,
  elSpecRegion,
  elModeHintText,
  elQuestionText,
  elQuestionSubtitle,
  elAnswersList,
  elScoreText,
  elPlayBtn,
  elPlayBtnLabel,
  elFeedbackLine,
  elSpectrogramImage,
  elInsectPhoto,
  elFactBox,
  elFactLabel,
  elFactText,
  elCredits,
  elStartOverlay,
  elStartBtn,
  elHintOverlay,
  elHintText,
  elHintCloseBtn,
  elModeChangeOverlay,
  elRegionOverlay,
  elRegionButtons,
  elRegionCancel,
  elModeChangeSpectro,
  elModeChangeImage,
  elModeChangeFacts,
  elModeChangeCancel,
  elEndOverlay,
  elEndTitle,
  elEndScoreText,
  elEndMessage,
  elPlayAgainBtn,
  elChangeModeBtn,
  elChangeRegionBtn,
  elWinMark,
  elSpecLabel;

let audioEl;

// ----- MODE / REGION UI -----------------------------------------------------

function updateModeLabel() {
  if (elModeLabel) {
    elModeLabel.textContent = `Mode: ${MODE_LABELS[currentMode]}`;
  }
  if (!elModeHintText) return;
  if (currentMode === MODES.SPECTRO) {
    elModeHintText.textContent = "Match the call’s spectrogram to the correct species.";
  } else if (currentMode === MODES.IMAGE) {
    elModeHintText.textContent = "Match the insect photo to the correct species.";
  } else if (currentMode === MODES.FACTS) {
    elModeHintText.textContent = "Match the natural history fact to the right species.";
  }
}

function updateSciToggle() {
  if (!elSciToggle) return;
  elSciToggle.setAttribute("aria-pressed", showSci ? "true" : "false");
  if (showSci) {
    elSciToggle.textContent = "Show scientific names: ON";
    elSciToggle.classList.remove("mode-off");
    elSciToggle.classList.add("mode-on");
  } else {
    elSciToggle.textContent = "Show scientific names: OFF";
    elSciToggle.classList.remove("mode-on");
    elSciToggle.classList.add("mode-off");
  }
}

function updateRegionLabel() {
  if (elRegionToggle) {
    elRegionToggle.textContent =
      currentRegion === "All regions"
        ? "🌍 Region: All"
        : `🌍 Region: ${currentRegion}`;
  }
  if (elSpecRegion) {
    elSpecRegion.textContent = `Region: ${currentRegion}`;
  }
}

function applyRegionFilter() {
  if (currentRegion === "All regions") {
    filtered = ALL_SPECIES.slice();
  } else {
    filtered = ALL_SPECIES.filter(
      (sp) => sp.regions && sp.regions.includes(currentRegion)
    );
    if (!filtered.length) filtered = ALL_SPECIES.slice();
  }
}

function buildRegionButtons() {
  if (!elRegionButtons) return;
  const counts = getRegionsFromSpecies();
  const entries = Array.from(counts.entries()).filter(
    ([, count]) => count > 5
  );

  const regions = ["All regions", ...entries.map(([r]) => r)];
  elRegionButtons.innerHTML = "";
  regions.forEach((region) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "mode-change-btn";
    b.textContent = region === "All regions" ? "All regions" : region;
    b.addEventListener("click", () => {
      currentRegion = region;
      updateRegionLabel();
      applyRegionFilter();
      startNewGame();
      hide(elRegionOverlay);
    });
    elRegionButtons.appendChild(b);
  });
}

// ----- ROUND MANAGEMENT -----------------------------------------------------

function resetQueue() {
  const indices = filtered.map((_, i) => i);
  queue = shuffle(indices);
}

function nextSpeciesIndex() {
  if (!queue.length) resetQueue();
  return queue.shift();
}

function buildOptions(correctIdx) {
  const indices = filtered.map((_, i) => i);
  const others = shuffle(indices.filter((i) => i !== correctIdx)).slice(0, 3);
  const all = shuffle([correctIdx, ...others]);
  return all.map((i) => filtered[i]);
}

// ----- RENDERING ------------------------------------------------------------

function renderQuestion() {
  if (!currentSpecies) return;

  const isSpectro = currentMode === MODES.SPECTRO;
  const isImage = currentMode === MODES.IMAGE;
  const isFacts = currentMode === MODES.FACTS;

  if (elQuestionText) {
    elQuestionText.textContent =
      currentMode === MODES.SPECTRO
        ? "Which insect is producing this sound?"
        : currentMode === MODES.IMAGE
        ? "Which insect is shown in this photo?"
        : "Which insect does this fact describe?";
  }

  if (elQuestionSubtitle) {
    if (isSpectro) {
      elQuestionSubtitle.textContent =
        "Listen and study the spectrogram, then choose the correct name.";
    } else if (isImage) {
      elQuestionSubtitle.textContent =
        "Use color, shape, and posture to identify the insect.";
    } else if (isFacts) {
      elQuestionSubtitle.textContent =
        "Read the fact carefully and match it to the right species.";
    }
  }

  if (elSpecLabel) {
    elSpecLabel.textContent = isSpectro
      ? "VISUALIZING SOUND"
      : isImage
      ? "IMAGE TRAINING"
      : "FACT TRAINING";
  }

  // Spectrogram image (always shown, but content varies by mode)
  if (elSpectrogramImage) {
    elSpectrogramImage.src = currentSpecies.spectrogramImage || "";
    elSpectrogramImage.alt = `Spectrogram of ${
      currentSpecies.commonName || ""
    }`;
    elSpectrogramImage.classList.remove("hidden");
  }

  // Photo box
  if (elInsectPhoto) {
    elInsectPhoto.src = currentSpecies.photoImage || "";
    elInsectPhoto.alt = currentSpecies.commonName || "Insect photo";
    elInsectPhoto.classList.remove("hidden");
  }

  // Fact box
  if (elFactBox && elFactLabel && elFactText) {
    if (isFacts) {
      elFactBox.classList.add("fact-mode");
      elFactLabel.textContent = "Fact to match";
      elFactText.textContent =
        currentSpecies.factRedacted || currentSpecies.fact || "";
    } else {
      elFactBox.classList.remove("fact-mode");
      elFactLabel.textContent = "After the guess";
      elFactText.textContent = "Identify the caller to reveal a fun fact.";
    }
  }

  // Credits
  if (elCredits) {
    const parts = [];
    if (currentSpecies.photoCredit) {
      let s = `📷 ${currentSpecies.photoCredit}`;
      if (currentSpecies.copyrightPhoto) s += ` (${currentSpecies.copyrightPhoto})`;
      parts.push(`<span>${s}</span>`);
    }
    if (currentSpecies.audioCredit) {
      let s = `🎧 ${currentSpecies.audioCredit}`;
      if (currentSpecies.copyrightAudio) s += ` (${currentSpecies.copyrightAudio})`;
      parts.push(`<span>${s}</span>`);
    }
    elCredits.innerHTML = parts.join(" ");
  }

  // Audio src
  if (audioEl) {
    if (currentSpecies.audioFile) {
      audioEl.src = currentSpecies.audioFile;
      audioEl.load();
    } else {
      audioEl.removeAttribute("src");
    }
  }

  // Answer buttons
  if (elAnswersList) {
    elAnswersList.innerHTML = "";
    currentOptions.forEach((sp) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "answer-btn";

      const label = document.createElement("span");
      label.className = "answer-label";
      label.textContent = displayName(sp, showSci);

      const meta = document.createElement("span");
      meta.className = "answer-meta";
      meta.textContent = "Guess";

      btn.appendChild(label);
      btn.appendChild(meta);

      btn.addEventListener("click", () => handleAnswer(sp, btn, meta));
      elAnswersList.appendChild(btn);
    });
  }

  // Feedback / score / controls
  if (elFeedbackLine) {
    elFeedbackLine.textContent = "";
    elFeedbackLine.classList.remove("correct", "wrong");
  }
  if (elWinMark) {
    elWinMark.classList.remove("win-mark-visible");
  }
  const nextBtn = document.getElementById("next-btn");
  if (nextBtn) nextBtn.disabled = true;
  if (elScoreText) {
    elScoreText.innerHTML = `Score this game: <strong>${correctFirstTry}</strong> of ${ROUNDS_PER_GAME}`;
  }
  if (elPlayBtnLabel) {
    elPlayBtnLabel.textContent = isSpectro ? "Play call" : "Play audio";
  }
}

// ----- HINTS & ANSWERS ------------------------------------------------------

function showHintOverlay() {
  if (!currentSpecies || !elHintOverlay || !elHintText) return;
  const hint = currentSpecies.hint || currentSpecies.fact || "";
  elHintText.textContent = hint;
  show(elHintOverlay);
}

function handleAnswer(chosen, btn, metaSpan) {
  if (!currentSpecies || answered) return;

  const correct = chosen === currentSpecies;

  if (correct) {
    if (firstGuess) {
      correctFirstTry += 1;
      if (elScoreText) {
        elScoreText.innerHTML = `Score this game: <strong>${correctFirstTry}</strong> of ${ROUNDS_PER_GAME}`;
      }
    }
    answered = true;

    btn.classList.add("correct-choice");
    metaSpan.classList.add("correct");
    metaSpan.textContent = "Correct";

    if (elFeedbackLine) {
      elFeedbackLine.classList.remove("wrong");
      elFeedbackLine.classList.add("correct");
      if (currentMode === MODES.SPECTRO) {
        elFeedbackLine.textContent = "Nice listening!";
      } else if (currentMode === MODES.IMAGE) {
        elFeedbackLine.textContent = "Nice recognition!";
      } else {
        elFeedbackLine.textContent = "Great fact matching!";
      }
    }
    if (elWinMark) elWinMark.classList.add("win-mark-visible");

    // Reveal full fact
    if (elFactBox && elFactLabel && elFactText) {
      elFactBox.classList.add("fact-mode");
      elFactLabel.textContent = "Fact";
      elFactText.textContent =
        currentSpecies.fact || currentSpecies.factRedacted || "";
    }

    // disable other buttons
    if (elAnswersList) {
      elAnswersList
        .querySelectorAll(".answer-btn")
        .forEach((b) => (b.disabled = true));
    }

    playCorrectDing();

    const nextBtn = document.getElementById("next-btn");
    if (nextBtn) nextBtn.disabled = false;
  } else {
    firstGuess = false;
    if (elFeedbackLine) {
      elFeedbackLine.classList.remove("correct");
      elFeedbackLine.classList.add("wrong");
      if (currentMode === MODES.SPECTRO) {
        elFeedbackLine.textContent =
          "Not quite—listen again and check the hint.";
      } else if (currentMode === MODES.IMAGE) {
        elFeedbackLine.textContent =
          "Not quite—look again and check the hint.";
      } else {
        elFeedbackLine.textContent =
          "Not quite—read the fact again and check the hint.";
      }
    }
    btn.classList.add("wrong-choice");
    metaSpan.textContent = "Try again";
    showHintOverlay();
  }
}

// ----- GAME FLOW ------------------------------------------------------------

function startRound() {
  if (!filtered.length) applyRegionFilter();
  const idx = nextSpeciesIndex();
  currentSpecies = filtered[idx];
  currentOptions = buildOptions(idx);
  firstGuess = true;
  answered = false;
  currentRound += 1;

  if (audioEl) {
    audioEl.pause();
    audioEl.currentTime = 0;
  }

  renderQuestion();
}

function showEndOverlay() {
  if (!elEndOverlay) return;

  const ratio = correctFirstTry / ROUNDS_PER_GAME;
  elEndOverlay.classList.remove("tint-bad", "tint-mid", "tint-good");
  if (ratio <= 0.3) {
    elEndOverlay.classList.add("tint-bad");
  } else if (ratio <= 0.7) {
    elEndOverlay.classList.add("tint-mid");
  } else {
    elEndOverlay.classList.add("tint-good");
  }

  if (elEndTitle) elEndTitle.textContent = "Game complete!";
  if (elEndScoreText)
    elEndScoreText.textContent = `You scored ${correctFirstTry} / ${ROUNDS_PER_GAME}.`;
  if (elEndMessage)
    elEndMessage.textContent = getEndMessage(currentMode, correctFirstTry);

  show(elEndOverlay);
  playEndFanfare();
}

function startNewGame() {
  currentRound = 0;
  correctFirstTry = 0;
  firstGuess = true;
  answered = false;

  applyRegionFilter();
  resetQueue();

  hide(elEndOverlay);
  if (elWinMark) elWinMark.classList.remove("win-mark-visible");
  if (elScoreText) {
    elScoreText.innerHTML = `Score this game: <strong>0</strong> of ${ROUNDS_PER_GAME}`;
  }

  startRound();
}

// ----- AUDIO CONTROLS -------------------------------------------------------

function togglePlayPause() {
  if (!audioEl || !currentSpecies) return;
  if (audioEl.paused) {
    audioEl.play().catch(() => {});
    if (elPlayBtnLabel)
      elPlayBtnLabel.textContent =
        currentMode === MODES.SPECTRO ? "Pause call" : "Pause audio";
  } else {
    audioEl.pause();
    if (elPlayBtnLabel)
      elPlayBtnLabel.textContent =
        currentMode === MODES.SPECTRO ? "Play call" : "Play audio";
  }
}

// ----- INIT -----------------------------------------------------------------

function initDomRefs() {
  elModeLabel = document.getElementById("mode-label");
  elRegionToggle = document.getElementById("region-toggle");
  elModeBubble = document.getElementById("mode-bubble");
  elSciToggle = document.getElementById("sci-toggle");
  elSpecRegion = document.getElementById("spec-region");
  elModeHintText = document.getElementById("mode-hint-text");

  elQuestionText = document.getElementById("question-text");
  elQuestionSubtitle = document.getElementById("question-subtitle");
  elAnswersList = document.getElementById("answers-list");
  elScoreText = document.getElementById("score-text");

  elPlayBtn = document.getElementById("play-btn");
  elPlayBtnLabel = document.getElementById("play-btn-label");
  elFeedbackLine = document.getElementById("feedback-line");

  elSpectrogramImage = document.getElementById("spectrogram-image");
  elInsectPhoto = document.getElementById("insect-photo");

  elFactBox = document.getElementById("fact-box");
  elFactLabel = document.getElementById("fact-label");
  elFactText = document.getElementById("fact-text");

  elCredits = document.getElementById("credits");
  elStartOverlay = document.getElementById("start-overlay");
  elStartBtn = document.getElementById("start-btn");

  elHintOverlay = document.getElementById("hint-overlay");
  elHintText = document.getElementById("hint-text");
  elHintCloseBtn = document.getElementById("hint-close-btn");

  elModeChangeOverlay = document.getElementById("mode-change-overlay");
  elRegionOverlay = document.getElementById("region-overlay");
  elRegionButtons = document.getElementById("region-buttons");
  elRegionCancel = document.getElementById("region-cancel");

  elModeChangeSpectro = document.getElementById("mode-change-spectro");
  elModeChangeImage = document.getElementById("mode-change-image");
  elModeChangeFacts = document.getElementById("mode-change-facts");
  elModeChangeCancel = document.getElementById("mode-change-cancel");

  elEndOverlay = document.getElementById("end-overlay");
  elEndTitle = document.getElementById("end-title");
  elEndScoreText = document.getElementById("end-score-text");
  elEndMessage = document.getElementById("end-message");
  elPlayAgainBtn = document.getElementById("play-again-btn");
  elChangeModeBtn = document.getElementById("change-mode-btn");
  elChangeRegionBtn = document.getElementById("change-region-btn");

  elWinMark = document.getElementById("win-mark");
  elSpecLabel = document.getElementById("spec-label");

  audioEl = document.getElementById("audio-player");
}

function attachListeners() {
  if (elStartBtn) {
    elStartBtn.addEventListener("click", () => {
      hide(elStartOverlay);
      startNewGame();
    });
  }

  if (elPlayBtn) elPlayBtn.addEventListener("click", togglePlayPause);

  window.addEventListener("keydown", (ev) => {
    if (ev.code === "Space" || ev.key === " ") {
      ev.preventDefault();
      togglePlayPause();
    }
  });

  if (audioEl) {
    audioEl.addEventListener("ended", () => {
      if (elPlayBtnLabel)
        elPlayBtnLabel.textContent =
          currentMode === MODES.SPECTRO ? "Play call" : "Play audio";
    });
  }

  const nextBtn = document.getElementById("next-btn");
  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      if (currentRound >= ROUNDS_PER_GAME) {
        showEndOverlay();
      } else {
        startRound();
      }
    });
  }

  if (elHintCloseBtn) {
    elHintCloseBtn.addEventListener("click", () => hide(elHintOverlay));
  }

  if (elModeBubble) {
    elModeBubble.addEventListener("click", () => show(elModeChangeOverlay));
  }

  if (elModeChangeSpectro) {
    elModeChangeSpectro.addEventListener("click", () => {
      currentMode = MODES.SPECTRO;
      updateModeLabel();
      hide(elModeChangeOverlay);
      startNewGame();
    });
  }
  if (elModeChangeImage) {
    elModeChangeImage.addEventListener("click", () => {
      currentMode = MODES.IMAGE;
      updateModeLabel();
      hide(elModeChangeOverlay);
      startNewGame();
    });
  }
  if (elModeChangeFacts) {
    elModeChangeFacts.addEventListener("click", () => {
      currentMode = MODES.FACTS;
      updateModeLabel();
      hide(elModeChangeOverlay);
      startNewGame();
    });
  }
  if (elModeChangeCancel) {
    elModeChangeCancel.addEventListener("click", () =>
      hide(elModeChangeOverlay)
    );
  }

  if (elRegionToggle) {
    elRegionToggle.addEventListener("click", () => show(elRegionOverlay));
  }
  if (elRegionCancel) {
    elRegionCancel.addEventListener("click", () => hide(elRegionOverlay));
  }

  if (elPlayAgainBtn) {
    elPlayAgainBtn.addEventListener("click", () => {
      hide(elEndOverlay);
      startNewGame();
    });
  }
  if (elChangeModeBtn) {
    elChangeModeBtn.addEventListener("click", () => {
      hide(elEndOverlay);
      show(elModeChangeOverlay);
    });
  }
  if (elChangeRegionBtn) {
    elChangeRegionBtn.addEventListener("click", () => {
      hide(elEndOverlay);
      show(elRegionOverlay);
    });
  }

  if (elSciToggle) {
    elSciToggle.addEventListener("click", () => {
      showSci = !showSci;
      updateSciToggle();
      renderQuestion();
    });
  }
}

function resetOverlaysOnLoad() {
  show(elStartOverlay);
  hide(elEndOverlay);
  hide(elHintOverlay);
  hide(elModeChangeOverlay);
  hide(elRegionOverlay);
}

window.addEventListener("DOMContentLoaded", () => {
  initDomRefs();
  resetOverlaysOnLoad();
  updateModeLabel();
  updateRegionLabel();
  updateSciToggle();
  buildRegionButtons();
  attachListeners();
});
