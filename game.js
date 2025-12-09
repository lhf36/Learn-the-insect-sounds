// game.js
// Core logic for the Insect Song Learning Game

// ----- Config / constants ---------------------------------------------------

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

// End-game messages by mode + score
function getEndMessage(mode, score) {
  // Clamp 0–5 just in case
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
        return "You’re just getting warmed up—look more closely!";
      case 2:
        return "Almost halfway there—those field marks are adding up.";
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

// ----- Simple “ding” and “triumphant” sounds (no external files) -----------

let audioContext = null;

function ensureAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
}

// Short “ding” on correct answer
function playCorrectDing() {
  try {
    ensureAudioContext();
    const ctx = audioContext;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.value = 880; // A5
    gain.gain.setValueAtTime(0.0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch (e) {
    // Non-fatal
  }
}

// Longer triumphant chord on end screen
function playEndFanfare() {
  try {
    ensureAudioContext();
    const ctx = audioContext;

    const freqs = [523.25, 659.25, 783.99]; // C major-ish
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = f;
      const start = ctx.currentTime + 0.02 * idx;
      const end = start + 0.6;

      gain.gain.setValueAtTime(0.0, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, end);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(end + 0.05);
    });
  } catch (e) {
    // Non-fatal
  }
}

// ----- Species data helper --------------------------------------------------

// Try a few common global names; whichever your species-data.js defines
const ALL_SPECIES =
  (window.SPECIES_DATA && Array.isArray(window.SPECIES_DATA) && window.SPECIES_DATA) ||
  (window.SPECIES && Array.isArray(window.SPECIES) && window.SPECIES) ||
  (window.SONGS && Array.isArray(window.SONGS) && window.SONGS) ||
  [];

if (!ALL_SPECIES.length) {
  console.warn(
    "No species data found. Expecting SPECIES_DATA / SPECIES / SONGS as an array."
  );
}

function getRegionsFromSpecies(data) {
  const counts = new Map();
  data.forEach((sp) => {
    const regions = sp.regions && sp.regions.length ? sp.regions : ["All"];
    regions.forEach((r) => {
      counts.set(r, (counts.get(r) || 0) + 1);
    });
  });
  return counts;
}

// ----- Game state -----------------------------------------------------------

let currentMode = MODES.SPECTRO;
let currentRegion = "All regions";
let showScientificNames = false;

let filteredSpecies = [];
let speciesQueue = []; // shuffled indices for correct answers
let currentRound = 0;
let correctFirstTry = 0;
let currentSpecies = null;
let currentOptions = [];
let firstGuessThisRound = true;
let hasAnsweredThisRound = false;

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
  elSpecLabel,
  elStatsPanel;

let audioElement;

// ----- Utility helpers ------------------------------------------------------

function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickOtherIndices(pool, correctIndex, count) {
  const others = pool.filter((idx) => idx !== correctIndex);
  const shuffled = shuffleArray(others);
  return shuffled.slice(0, count);
}

function hideElement(el) {
  if (!el) return;
  el.classList.add("hidden");
}

function showElement(el) {
  if (!el) return;
  el.classList.remove("hidden");
}

// ----- Mode / region / sci-name UI -----------------------------------------

function updateModeLabel() {
  if (!elModeLabel) return;
  elModeLabel.textContent = `Mode: ${MODE_LABELS[currentMode] || "—"}`;

  if (!elModeHintText) return;
  if (currentMode === MODES.SPECTRO) {
    elModeHintText.textContent = "Match the call’s spectrogram to the correct species.";
  } else if (currentMode === MODES.IMAGE) {
    elModeHintText.textContent = "Match the insect photo to the correct species.";
  } else if (currentMode === MODES.FACTS) {
    elModeHintText.textContent = "Match each natural history fact to the right species.";
  } else {
    elModeHintText.textContent = "";
  }
}

function updateSciToggle() {
  if (!elSciToggle) return;
  elSciToggle.setAttribute("aria-pressed", showScientificNames ? "true" : "false");
  if (showScientificNames) {
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
      currentRegion === "All regions" ? "🌍 Region: All" : `🌍 Region: ${currentRegion}`;
  }
  if (elSpecRegion) {
    elSpecRegion.textContent = `Region: ${currentRegion}`;
  }
}

// ----- Species filtering & region buttons ----------------------------------

function applyRegionFilter() {
  if (currentRegion === "All regions") {
    filteredSpecies = ALL_SPECIES.slice();
    return;
  }
  filteredSpecies = ALL_SPECIES.filter((sp) => {
    if (!sp.regions || !sp.regions.length) return false;
    return sp.regions.includes(currentRegion);
  });
  if (!filteredSpecies.length) {
    // Fallback to all
    filteredSpecies = ALL_SPECIES.slice();
  }
}

function buildRegionButtons() {
  if (!elRegionButtons) return;

  const counts = getRegionsFromSpecies(ALL_SPECIES);
  const entries = Array.from(counts.entries()).filter(
    ([region, count]) => count > 5 // threshold
  );

  // Always include All regions option
  const regions = ["All regions", ...entries.map(([region]) => region)];

  elRegionButtons.innerHTML = "";

  regions.forEach((region) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mode-change-btn";
    btn.textContent = region === "All regions" ? "All regions" : region;
    btn.addEventListener("click", () => {
      currentRegion = region;
      updateRegionLabel();
      applyRegionFilter();
      startNewGame();
      hideElement(elRegionOverlay);
    });
    elRegionButtons.appendChild(btn);
  });
}

// ----- Round / question generation -----------------------------------------

function resetSpeciesQueue() {
  if (!filteredSpecies.length) {
    filteredSpecies = ALL_SPECIES.slice();
  }
  const indices = filteredSpecies.map((_, i) => i);
  speciesQueue = shuffleArray(indices);
}

function pickNextSpeciesIndex() {
  if (!speciesQueue.length) {
    resetSpeciesQueue();
  }
  return speciesQueue.shift();
}

function buildOptions(correctIdx) {
  const indices = filteredSpecies.map((_, i) => i);
  const others = pickOtherIndices(indices, correctIdx, 3);
  const pool = shuffleArray([correctIdx, ...others]);
  return pool.map((i) => filteredSpecies[i]);
}

function getDisplayName(sp) {
  if (!sp) return "";
  if (showScientificNames && sp.scientificName) return sp.scientificName;
  return sp.commonName || sp.name || "";
}

// ----- Rendering for current mode ------------------------------------------

function renderQuestion() {
  if (!currentSpecies) return;

  // Spectrogram / image / fact content
  const isSpectro = currentMode === MODES.SPECTRO;
  const isImage = currentMode === MODES.IMAGE;
  const isFacts = currentMode === MODES.FACTS;

  // Question text
  if (elQuestionText) {
    if (isSpectro) {
      elQuestionText.textContent = "Which insect is producing this sound?";
    } else if (isImage) {
      elQuestionText.textContent = "Which insect is shown in this photo?";
    } else if (isFacts) {
      elQuestionText.textContent = "Which insect does this fact describe?";
    }
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

  // Spectrogram vs photo vs fact emphasis
  if (elSpectrogramImage) {
    if (isSpectro || isFacts) {
      // Spectrogram visible
      elSpectrogramImage.src = currentSpecies.spectrogramImage || "";
      elSpectrogramImage.alt = `Spectrogram of ${currentSpecies.commonName || ""}`;
      elSpectrogramImage.classList.remove("hidden");
    } else {
      // In image mode we can still show the spectrogram OR hide; for now keep it visible.
      elSpectrogramImage.src = currentSpecies.spectrogramImage || "";
      elSpectrogramImage.alt = `Spectrogram of ${currentSpecies.commonName || ""}`;
      elSpectrogramImage.classList.remove("hidden");
    }
  }

  if (elInsectPhoto) {
    if (isImage) {
      // Show photo prominently
      elInsectPhoto.src = currentSpecies.photoImage || "";
      elInsectPhoto.alt = currentSpecies.commonName || "Insect photo";
      elInsectPhoto.classList.remove("hidden");
    } else {
      // Still show below in spectro/fact modes, but not essential
      elInsectPhoto.src = currentSpecies.photoImage || "";
      elInsectPhoto.alt = currentSpecies.commonName || "Insect photo";
      elInsectPhoto.classList.remove("hidden");
    }
  }

  if (elSpecLabel) {
    elSpecLabel.textContent = isSpectro
      ? "Visualizing sound"
      : isImage
      ? "Image training"
      : "Fact training";
  }

  // Fact box
  if (elFactBox && elFactLabel && elFactText) {
    if (isFacts) {
      elFactBox.classList.add("fact-mode");
      elFactLabel.textContent = "Fact to match";
      const redacted = currentSpecies.factRedacted || currentSpecies.fact;
      elFactText.textContent =
        redacted ||
        "Read the natural history clues and choose the correct insect.";
    } else {
      elFactBox.classList.remove("fact-mode");
      elFactLabel.textContent = "After the guess";
      elFactText.textContent = "Identify the caller to reveal a fun fact.";
    }
  }

  // Credits
  if (elCredits) {
    let parts = [];
    if (currentSpecies.photoCredit) {
      let t = `📷 ${currentSpecies.photoCredit}`;
      if (currentSpecies.copyrightPhoto) {
        t += ` (${currentSpecies.copyrightPhoto})`;
      }
      parts.push(`<span>${t}</span>`);
    }
    if (currentSpecies.audioCredit) {
      let t = `🎧 ${currentSpecies.audioCredit}`;
      if (currentSpecies.copyrightAudio) {
        t += ` (${currentSpecies.copyrightAudio})`;
      }
      parts.push(`<span>${t}</span>`);
    }
    elCredits.innerHTML = parts.join(" ");
  }

  // Audio src
  if (audioElement) {
    if (currentSpecies.audioFile) {
      audioElement.src = currentSpecies.audioFile;
      audioElement.load();
    } else {
      audioElement.removeAttribute("src");
    }
  }

  // Answer buttons
  if (elAnswersList) {
    elAnswersList.innerHTML = "";
    currentOptions.forEach((sp) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "answer-btn";
      btn.dataset.speciesId = sp.id || sp.commonName || "";

      const labelSpan = document.createElement("span");
      labelSpan.className = "answer-label";
      labelSpan.textContent = getDisplayName(sp);

      const metaSpan = document.createElement("span");
      metaSpan.className = "answer-meta";
      metaSpan.textContent = "Guess";

      btn.appendChild(labelSpan);
      btn.appendChild(metaSpan);

      btn.addEventListener("click", () => handleAnswer(sp, btn, metaSpan));

      elAnswersList.appendChild(btn);
    });
  }

  // Reset feedback, win mark, next button
  if (elFeedbackLine) {
    elFeedbackLine.textContent = "";
    elFeedbackLine.classList.remove("correct", "wrong");
  }
  if (elWinMark) {
    elWinMark.classList.remove("win-mark-visible");
  }
  if (elPlayBtnLabel) {
    elPlayBtnLabel.textContent = isSpectro ? "Play call" : "Play audio";
  }
  if (elScoreText) {
    elScoreText.innerHTML = `Score this game: <strong>${correctFirstTry}</strong> of ${ROUNDS_PER_GAME}`;
  }
  const nextBtn = document.getElementById("next-btn");
  if (nextBtn) {
    nextBtn.disabled = true;
  }
}

// ----- Answer handling ------------------------------------------------------

function showHintFromFact() {
  if (!currentSpecies || !elHintOverlay || !elHintText) return;

  const base = currentSpecies.fact || "";
  const shortHint = currentSpecies.hint || base;
  elHintText.textContent = shortHint;
  showElement(elHintOverlay);
}

function handleAnswer(chosenSpecies, buttonEl, metaSpan) {
  if (!currentSpecies || hasAnsweredThisRound) {
    return;
  }

  const isCorrect = chosenSpecies === currentSpecies;

  if (isCorrect) {
    // First-try correctness
    if (firstGuessThisRound) {
      correctFirstTry += 1;
      if (elScoreText) {
        elScoreText.innerHTML = `Score this game: <strong>${correctFirstTry}</strong> of ${ROUNDS_PER_GAME}`;
      }
    }

    hasAnsweredThisRound = true;

    // Visual feedback
    buttonEl.classList.add("correct-choice");
    metaSpan.classList.add("correct");
    metaSpan.textContent = "Correct";

    if (elFeedbackLine) {
      elFeedbackLine.classList.remove("wrong");
      elFeedbackLine.classList.add("correct");

      if (currentMode === MODES.SPECTRO) {
        elFeedbackLine.textContent = "Nice listening!";
      } else if (currentMode === MODES.IMAGE) {
        elFeedbackLine.textContent = "Nice recognition!";
      } else if (currentMode === MODES.FACTS) {
        elFeedbackLine.textContent = "Great fact matching!";
      }
    }

    if (elWinMark) {
      elWinMark.classList.add("win-mark-visible");
    }

    // Reveal full fact
    if (elFactBox && elFactLabel && elFactText) {
      elFactLabel.textContent = "Fact";
      elFactBox.classList.add("fact-mode");
      const fullFact = currentSpecies.fact || currentSpecies.factRedacted || "";
      elFactText.textContent = fullFact;
    }

    // Disable other buttons
    if (elAnswersList) {
      const allButtons = elAnswersList.querySelectorAll(".answer-btn");
      allButtons.forEach((b) => {
        b.disabled = true;
        if (b !== buttonEl && b.classList.contains("correct-choice") === false) {
          // leave them neutral
        }
      });
    }

    playCorrectDing();

    // Enable next
    const nextBtn = document.getElementById("next-btn");
    if (nextBtn) {
      nextBtn.disabled = false;
    }
  } else {
    // Wrong answer: show hint overlay
    firstGuessThisRound = false;
    if (elFeedbackLine) {
      elFeedbackLine.classList.remove("correct");
      elFeedbackLine.classList.add("wrong");
      if (currentMode === MODES.SPECTRO) {
        elFeedbackLine.textContent = "Not quite—listen again and check the hint.";
      } else if (currentMode === MODES.IMAGE) {
        elFeedbackLine.textContent = "Not quite—look again and check the hint.";
      } else if (currentMode === MODES.FACTS) {
        elFeedbackLine.textContent = "Not quite—read the fact again and check the hint.";
      }
    }

    // Mark this button briefly as wrong
    buttonEl.classList.add("wrong-choice");
    metaSpan.textContent = "Try again";

    showHintFromFact();
  }
}

// ----- Rounds & game flow ---------------------------------------------------

function startNewRound() {
  if (!filteredSpecies.length) {
    applyRegionFilter();
  }
  const correctIdx = pickNextSpeciesIndex();
  currentSpecies = filteredSpecies[correctIdx];
  currentOptions = buildOptions(correctIdx);
  firstGuessThisRound = true;
  hasAnsweredThisRound = false;
  currentRound += 1;

  if (audioElement) {
    audioElement.pause();
    audioElement.currentTime = 0;
  }

  renderQuestion();
}

function showEndOverlay() {
  if (!elEndOverlay || !elEndTitle || !elEndScoreText || !elEndMessage) return;

  // Tint based on score
  const ratio = correctFirstTry / ROUNDS_PER_GAME;
  elEndOverlay.classList.remove("tint-bad", "tint-mid", "tint-good");
  if (ratio <= 0.3) {
    elEndOverlay.classList.add("tint-bad");
  } else if (ratio <= 0.7) {
    elEndOverlay.classList.add("tint-mid");
  } else {
    elEndOverlay.classList.add("tint-good");
  }

  elEndTitle.textContent = "Game complete!";
  elEndScoreText.textContent = `You scored ${correctFirstTry} / ${ROUNDS_PER_GAME}.`;
  elEndMessage.textContent = getEndMessage(currentMode, correctFirstTry);

  showElement(elEndOverlay);
  playEndFanfare();
}

function startNewGame() {
  currentRound = 0;
  correctFirstTry = 0;
  firstGuessThisRound = true;
  hasAnsweredThisRound = false;

  applyRegionFilter();
  resetSpeciesQueue();

  if (elWinMark) {
    elWinMark.classList.remove("win-mark-visible");
  }
  if (elScoreText) {
    elScoreText.innerHTML = `Score this game: <strong>${correctFirstTry}</strong> of ${ROUNDS_PER_GAME}`;
  }
  hideElement(elEndOverlay);

  startNewRound();
}

// ----- Audio + controls -----------------------------------------------------

function togglePlayPause() {
  if (!audioElement || !currentSpecies) return;

  if (audioElement.paused) {
    audioElement.play().catch(() => {});
    if (elPlayBtnLabel) elPlayBtnLabel.textContent = "Pause audio";
  } else {
    audioElement.pause();
    if (elPlayBtnLabel) {
      elPlayBtnLabel.textContent =
        currentMode === MODES.SPECTRO ? "Play call" : "Play audio";
    }
  }
}

// ----- Overlay helpers ------------------------------------------------------

function resetAllOverlaysOnLoad() {
  showElement(elStartOverlay);
  hideElement(elEndOverlay);
  hideElement(elHintOverlay);
  hideElement(elModeChangeOverlay);
  hideElement(elRegionOverlay);
}

// ----- Initialization -------------------------------------------------------

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

  elStatsPanel = document.getElementById("stats-panel");

  audioElement = document.getElementById("audio-player");
}

function attachEventListeners() {
  if (elStartBtn) {
    elStartBtn.addEventListener("click", () => {
      hideElement(elStartOverlay);
      startNewGame();
    });
  }

  if (elPlayBtn) {
    elPlayBtn.addEventListener("click", () => togglePlayPause());
  }

  // Spacebar play/pause
  window.addEventListener("keydown", (evt) => {
    if (evt.code === "Space" || evt.key === " ") {
      evt.preventDefault();
      // Avoid reacting when focus is in a button we might need; but for now, global toggle is fine.
      togglePlayPause();
    }
  });

  if (audioElement) {
    audioElement.addEventListener("ended", () => {
      if (elPlayBtnLabel) {
        elPlayBtnLabel.textContent =
          currentMode === MODES.SPECTRO ? "Play call" : "Play audio";
      }
    });
  }

  // Next question
  const nextBtn = document.getElementById("next-btn");
  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      if (currentRound >= ROUNDS_PER_GAME) {
        showEndOverlay();
      } else {
        startNewRound();
      }
    });
  }

  // Hint close
  if (elHintCloseBtn) {
    elHintCloseBtn.addEventListener("click", () => hideElement(elHintOverlay));
  }

  // Mode bubble -> open mode change overlay
  if (elModeBubble) {
    elModeBubble.addEventListener("click", () => {
      showElement(elModeChangeOverlay);
    });
  }

  // Mode change buttons
  if (elModeChangeSpectro) {
    elModeChangeSpectro.addEventListener("click", () => {
      currentMode = MODES.SPECTRO;
      updateModeLabel();
      hideElement(elModeChangeOverlay);
      startNewGame();
    });
  }
  if (elModeChangeImage) {
    elModeChangeImage.addEventListener("click", () => {
      currentMode = MODES.IMAGE;
      updateModeLabel();
      hideElement(elModeChangeOverlay);
      startNewGame();
    });
  }
  if (elModeChangeFacts) {
    elModeChangeFacts.addEventListener("click", () => {
      currentMode = MODES.FACTS;
      updateModeLabel();
      hideElement(elModeChangeOverlay);
      startNewGame();
    });
  }
  if (elModeChangeCancel) {
    elModeChangeCancel.addEventListener("click", () =>
      hideElement(elModeChangeOverlay)
    );
  }

  // Region toggle
  if (elRegionToggle) {
    elRegionToggle.addEventListener("click", () => {
      showElement(elRegionOverlay);
    });
  }
  if (elRegionCancel) {
    elRegionCancel.addEventListener("click", () => hideElement(elRegionOverlay));
  }

  // End overlay buttons
  if (elPlayAgainBtn) {
    elPlayAgainBtn.addEventListener("click", () => {
      hideElement(elEndOverlay);
      startNewGame();
    });
  }
  if (elChangeModeBtn) {
    elChangeModeBtn.addEventListener("click", () => {
      hideElement(elEndOverlay);
      showElement(elModeChangeOverlay);
    });
  }
  if (elChangeRegionBtn) {
    elChangeRegionBtn.addEventListener("click", () => {
      hideElement(elEndOverlay);
      showElement(elRegionOverlay);
    });
  }

  // Sci-name toggle
  if (elSciToggle) {
    elSciToggle.addEventListener("click", () => {
      showScientificNames = !showScientificNames;
      updateSciToggle();
      // Re-render answer labels
      renderQuestion();
    });
  }
}

// ----- Main init ------------------------------------------------------------

window.addEventListener("DOMContentLoaded", () => {
  initDomRefs();
  resetAllOverlaysOnLoad();
  applyRegionFilter();
  buildRegionButtons();
  updateModeLabel();
  updateRegionLabel();
  updateSciToggle();
  attachEventListeners();
});
