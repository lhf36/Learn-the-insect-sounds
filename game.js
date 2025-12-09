/*
  game.js

  Core logic for the Insect Song Learning Game.

  Depends on:
    - species-data.js       (window.SONGS_DATA)
    - analytics.js          (window.InsectGameAnalytics)
    - DOM structure in index.html (elements with IDs referenced below)
*/

(function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // CONFIG & DATA
  // ---------------------------------------------------------------------------

  const TOTAL_ROUNDS = 5;
  const MODES = {
    SPECTRO: "spectrogram",
    IMAGE: "image",
    FACTS: "facts",
  };

  const MODE_LABEL = {
    [MODES.SPECTRO]: "Spectrogram training",
    [MODES.IMAGE]: "Image recognition",
    [MODES.FACTS]: "Fact knowledge",
  };

  const SONGS = Array.isArray(window.SONGS_DATA)
    ? window.SONGS_DATA.slice()
    : [];

  if (!SONGS.length) {
    console.error("SONGS_DATA is missing or empty. Check species-data.js");
  }

  // ---------------------------------------------------------------------------
  // STATE
  // ---------------------------------------------------------------------------

  let currentMode = MODES.SPECTRO;
  let currentRegion = null; // null = all regions
  let sciNamesOn = false;

  let sessionSongs = []; // 5 songs for the current game
  let sessionIndex = 0;
  let currentSong = null;

  let roundsAnswered = 0;
  let scoreCorrect = 0;
  let hasAnswered = false;
  let hadWrongGuess = false;

  let audioCtx = null;

  // ---------------------------------------------------------------------------
  // DOM REFERENCES
  // ---------------------------------------------------------------------------

  let spectrogramImageEl;
  let specTaglineEl;
  let specRegionEl;
  let specLabelEl;
  let axisXEl;
  let axisYEl;
  let ampBoxEl;
  let specAxesWrapperEl;

  let factBoxEl;
  let factLabelEl;
  let factTextEl;
  let feedbackLineEl;
  let insectPhotoEl;
  let creditsEl;

  let answersListEl;
  let scoreTextEl;
  let playBtnEl;
  let playBtnLabelEl;
  let nextBtnEl;
  let audioPlayerEl;
  let sciToggleBtn;
  let winMarkEl;
  let modeHintTextEl;
  let questionTextEl;
  let questionSubtitleEl;
  let modeLabelEl;
  let modeBubbleEl;
  let regionToggleBtn;

  let startOverlayEl;
  let startBtnEl;

  let hintOverlayEl;
  let hintTextEl;
  let hintCloseBtnEl;

  let modeChangeOverlayEl;
  let modeChangeSpectroEl;
  let modeChangeImageEl;
  let modeChangeFactsEl;
  let modeChangeCancelEl;

  let regionOverlayEl;
  let regionButtonsEl;
  let regionCancelEl;

  let endOverlayEl;
  let endTitleEl;
  let endScoreTextEl;
  let endMessageEl;
  let playAgainBtnEl;
  let changeModeBtnEl;
  let changeRegionBtnEl;

  // ---------------------------------------------------------------------------
  // UTILITIES
  // ---------------------------------------------------------------------------

  function shuffle(arr) {
    return arr
      .map((v) => ({ v, r: Math.random() }))
      .sort((a, b) => a.r - b.r)
      .map((x) => x.v);
  }

  function getActiveRegionName() {
    return currentRegion || "All regions";
  }

  function getRegionPool() {
    // If currentRegion is null => all songs
    if (!currentRegion) return SONGS.slice();
    return SONGS.filter((s) => s.region === currentRegion);
  }

  function ensureAudioCtx() {
    if (audioCtx) return audioCtx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
    return audioCtx;
  }

  // Strong redaction for fact mode (hide common & scientific names + key words)
  function redactFact(song) {
    if (!song || !song.fact) return "";
    let text = song.fact;
    const targets = [];

    if (song.commonName) {
      const full = song.commonName;
      targets.push(full, full.replace(/-/g, " "));
      full
        .replace(/-/g, " ")
        .split(/\s+/)
        .forEach((part) => {
          if (part.length > 2) targets.push(part);
        });
    }

    if (song.species) {
      song.species.split(/\s+/).forEach((part) => {
        if (part.length > 2) targets.push(part);
      });
    }

    const groups = [
      "cricket",
      "crickets",
      "cicada",
      "cicadas",
      "grasshopper",
      "grasshoppers",
      "katydid",
      "katydids",
      "conehead",
      "coneheads",
    ];
    targets.push(...groups);

    // special handling for the periodical cicada
    const commonLower = (song.commonName || "").toLowerCase();
    const speciesLower = (song.species || "").toLowerCase();
    if (commonLower.includes("13-year") || speciesLower.includes("magicicada")) {
      targets.push("13", "13-year", "13 year");
      targets.push("periodical cicadas", "periodical cicada", "periodical");
    }

    const escaped = [
      ...new Set(
        targets
          .filter(Boolean)
          .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      ),
    ];

    if (!escaped.length) return text;
    const re = new RegExp(escaped.join("|"), "gi");
    return text.replace(re, (m) => "•".repeat(m.length));
  }

  function getHintText(song) {
    if (!song) return "";
    if (currentMode === MODES.FACTS) {
      return song.region
        ? `This species is found in: ${song.region}.`
        : "Think about where this insect might live.";
    }
    const fact = song.fact || "";
    const idx = fact.indexOf(".");
    if (idx !== -1) return fact.slice(0, idx + 1);
    return fact || "Listen / look again and pay attention to the patterns.";
  }

  // ---------------------------------------------------------------------------
  // AUDIO EFFECTS
  // ---------------------------------------------------------------------------

  function playDing() {
    const ctx = ensureAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(880, now);
    gain1.gain.setValueAtTime(0.0001, now);
    gain1.gain.exponentialRampToValueAtTime(0.3, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1320, now + 0.04);
    gain2.gain.setValueAtTime(0.0001, now + 0.04);
    gain2.gain.exponentialRampToValueAtTime(0.15, now + 0.06);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.04);
    osc2.stop(now + 0.3);
  }

  function playTriumph() {
    const ctx = ensureAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99];

    notes.forEach((freq, i) => {
      const start = now + i * 0.08;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.35, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.32);
    });
  }

  function playFromStart() {
    if (!audioPlayerEl || !currentSong) return;
    audioPlayerEl.currentTime = 0;
    audioPlayerEl.play().catch(() => {});
  }

  function togglePlayPause() {
    if (!audioPlayerEl) return;
    if (audioPlayerEl.paused) {
      audioPlayerEl.play().catch(() => {});
    } else {
      audioPlayerEl.pause();
    }
  }

  // ---------------------------------------------------------------------------
  // UI UPDATERS
  // ---------------------------------------------------------------------------

  function updateSciToggleUI() {
    if (!sciToggleBtn) return;
    if (sciNamesOn) {
      sciToggleBtn.classList.add("mode-on");
      sciToggleBtn.classList.remove("mode-off");
      sciToggleBtn.textContent = "Show scientific names: ON";
      sciToggleBtn.setAttribute("aria-pressed", "true");
    } else {
      sciToggleBtn.classList.add("mode-off");
      sciToggleBtn.classList.remove("mode-on");
      sciToggleBtn.textContent = "Show scientific names: OFF";
      sciToggleBtn.setAttribute("aria-pressed", "false");
    }
  }

  function applySciToggleToButtons() {
    if (!answersListEl) return;
    const buttons = answersListEl.querySelectorAll(".answer-btn");
    buttons.forEach((btn) => {
      const labelSpan = btn.querySelector(".answer-label");
      if (!labelSpan) return;
      if (sciNamesOn) {
        labelSpan.textContent = btn.dataset.scientificName || "";
      } else {
        labelSpan.textContent = btn.dataset.commonName || "";
      }
    });
  }

  function updateRegionToggleLabel() {
    if (!regionToggleBtn) return;
    const name = getActiveRegionName();
    regionToggleBtn.textContent = `🌍 Region: ${
      name === "All regions" ? "All" : name
    }`;
  }

  function updateModeUI() {
    if (modeLabelEl) {
      modeLabelEl.textContent = `Mode: ${MODE_LABEL[currentMode] || "—"}`;
    }

    // Base fact box state
    if (factBoxEl) factBoxEl.classList.remove("fact-mode");

    if (currentMode === MODES.SPECTRO) {
      if (specLabelEl) specLabelEl.textContent = "Visualizing sound";
      if (axisYEl) axisYEl.textContent = "Frequency (kHz)";
      if (axisXEl) axisXEl.textContent = "Time (seconds)";
      if (ampBoxEl) ampBoxEl.style.display = "";
      if (specAxesWrapperEl) specAxesWrapperEl.classList.remove("hidden");
      if (playBtnEl) playBtnEl.disabled = false;
      if (playBtnLabelEl) playBtnLabelEl.textContent = "Play call";
      if (modeHintTextEl)
        modeHintTextEl.textContent =
          "Tip: match the band of energy and the rhythm of pulses.";
      if (questionTextEl)
        questionTextEl.textContent = "Which insect is producing this sound?";
      if (questionSubtitleEl)
        questionSubtitleEl.textContent =
          "Listen as many times as you like, then choose the common name.";
      if (factLabelEl) factLabelEl.textContent = "After the guess";
    } else if (currentMode === MODES.IMAGE) {
      if (specLabelEl) specLabelEl.textContent = "Insect image";
      if (axisYEl) axisYEl.textContent = "";
      if (axisXEl) axisXEl.textContent = "";
      if (ampBoxEl) ampBoxEl.style.display = "none";
      if (specAxesWrapperEl) specAxesWrapperEl.classList.remove("hidden");
      if (playBtnEl) playBtnEl.disabled = false;
      if (playBtnLabelEl) playBtnLabelEl.textContent = "Play call (optional)";
      if (modeHintTextEl)
        modeHintTextEl.textContent =
          "Tip: look at body shape, wings, and posture.";
      if (questionTextEl)
        questionTextEl.textContent = "Which insect is shown here?";
      if (questionSubtitleEl)
        questionSubtitleEl.textContent =
          "Look closely at the insect's appearance, then choose its name.";
      if (factLabelEl) factLabelEl.textContent = "After the guess";
    } else if (currentMode === MODES.FACTS) {
      if (specLabelEl) specLabelEl.textContent = "Fact training";
      if (axisYEl) axisYEl.textContent = "";
      if (axisXEl) axisXEl.textContent = "";
      if (ampBoxEl) ampBoxEl.style.display = "none";
      if (specAxesWrapperEl) specAxesWrapperEl.classList.add("hidden");
      if (playBtnEl) playBtnEl.disabled = false;
      if (playBtnLabelEl) playBtnLabelEl.textContent = "Play call (optional)";
      if (modeHintTextEl)
        modeHintTextEl.textContent =
          "Tip: read the description carefully before you choose.";
      if (questionTextEl)
        questionTextEl.textContent = "Which insect fits this description?";
      if (questionSubtitleEl)
        questionSubtitleEl.textContent =
          "Read the description, then choose the species.";
      if (factLabelEl) factLabelEl.textContent = "Description";
      if (factBoxEl) factBoxEl.classList.add("fact-mode");
    }

    if (nextBtnEl) {
      if (currentMode === MODES.SPECTRO) {
        nextBtnEl.textContent = "Next spectrogram ➜";
      } else if (currentMode === MODES.IMAGE) {
        nextBtnEl.textContent = "Next image ➜";
      } else {
        nextBtnEl.textContent = "Next description ➜";
      }
    }

    updateRegionToggleLabel();
  }

  function showHintOverlay(song) {
    if (!hintOverlayEl || !hintTextEl) return;
    hintTextEl.textContent = getHintText(song);
    hintOverlayEl.classList.remove("hidden");
  }

  function hideHintOverlay() {
    if (!hintOverlayEl) return;
    hintOverlayEl.classList.add("hidden");
  }

  function showWinMark() {
    if (!winMarkEl) return;
    winMarkEl.classList.add("win-mark-visible");
    setTimeout(() => {
      winMarkEl.classList.remove("win-mark-visible");
    }, 800);
  }

  // ---------------------------------------------------------------------------
  // ROUND RENDERING
  // ---------------------------------------------------------------------------

  function renderCredits(song) {
    if (!creditsEl || !song) return;

    let photoText = "";
    if (song.photoCredit) {
      photoText = `📷 ${song.photoCredit}`;
      if (song.copyrightPhoto) {
        photoText += ` (${song.copyrightPhoto})`;
      }
    }

    let audioText = "";
    if (song.audioCredit) {
      audioText = `🎧 ${song.audioCredit}`;
      if (song.copyrightAudio) {
        audioText += ` (${song.copyrightAudio})`;
      }
    }

    const parts = [];
    if (photoText) parts.push(`<span>${photoText}</span>`);
    if (audioText) parts.push(`<span>${audioText}</span>`);

    creditsEl.innerHTML = parts.join(" ");
  }

  function renderForMode(song) {
    if (!song) {
      console.error("renderForMode called with no song");
      return;
    }

    if (insectPhotoEl) {
      insectPhotoEl.classList.add("hidden");
      insectPhotoEl.src = "";
      insectPhotoEl.alt = "";
    }

    renderCredits(song);

    if (specRegionEl) {
      specRegionEl.textContent = song.region
        ? `Region: ${song.region}`
        : "Region: —";
    }
    if (specTaglineEl) {
      specTaglineEl.textContent =
        currentMode === MODES.FACTS
          ? "Which insect fits this description?"
          : currentMode === MODES.IMAGE
          ? "Who is this insect?"
          : "Who is calling?";
    }
    if (winMarkEl) winMarkEl.classList.remove("win-mark-visible");

    if (currentMode === MODES.SPECTRO) {
      if (specAxesWrapperEl) specAxesWrapperEl.classList.remove("hidden");
      if (spectrogramImageEl) {
        spectrogramImageEl.src = song.spectrogramImage || "";
        spectrogramImageEl.alt = `Spectrogram of ${song.commonName} call`;
      }
      if (audioPlayerEl) audioPlayerEl.src = song.audio || "";
      if (factLabelEl) factLabelEl.textContent = "After the guess";
      if (factTextEl)
        factTextEl.textContent =
          "Identify the caller to reveal a fun fact.";
    } else if (currentMode === MODES.IMAGE) {
      if (specAxesWrapperEl) specAxesWrapperEl.classList.remove("hidden");
      if (spectrogramImageEl) {
        spectrogramImageEl.src = song.photo || "";
        spectrogramImageEl.alt = `Photo of ${song.commonName}`;
      }
      if (audioPlayerEl) audioPlayerEl.src = song.audio || "";
      if (factLabelEl) factLabelEl.textContent = "After the guess";
      if (factTextEl)
        factTextEl.textContent =
          "Identify the insect to reveal a fun fact.";
    } else if (currentMode === MODES.FACTS) {
      if (specAxesWrapperEl) specAxesWrapperEl.classList.add("hidden");
      if (spectrogramImageEl) {
        spectrogramImageEl.src = "";
        spectrogramImageEl.alt = "";
      }
      if (audioPlayerEl) audioPlayerEl.src = song.audio || "";
      if (factLabelEl) factLabelEl.textContent = "Description";
      if (factTextEl) factTextEl.textContent = redactFact(song);
      if (factBoxEl) factBoxEl.classList.add("fact-mode");
    }
  }

  function buildChoices(correctName) {
    const pool = getRegionPool()
      .map((s) => s.commonName)
      .filter(Boolean);
    const others = pool.filter((n) => n !== correctName);
    const wrong = shuffle(others).slice(0, 3);
    return shuffle([correctName, ...wrong]);
  }

  function renderAnswers(song) {
    if (!answersListEl || !song) return;
    answersListEl.innerHTML = "";
    const choices = buildChoices(song.commonName);

    choices.forEach((commonName) => {
      const songObj = SONGS.find((s) => s.commonName === commonName);
      if (!songObj) return;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "answer-btn";
      btn.dataset.commonName = songObj.commonName;
      btn.dataset.scientificName = songObj.species;
      btn.setAttribute("aria-label", `Guess: ${songObj.commonName}`);

      const label = document.createElement("span");
      label.className = "answer-label";
      label.textContent = sciNamesOn ? songObj.species : songObj.commonName;

      const meta = document.createElement("span");
      meta.className = "answer-meta";
      meta.textContent = "Guess";

      btn.appendChild(label);
      btn.appendChild(meta);

      btn.addEventListener("click", () => handleAnswer(songObj, btn));

      answersListEl.appendChild(btn);
    });
  }

  function renderRound() {
    if (!sessionSongs.length) {
      console.error("No songs available for this game.");
      return;
    }
    currentSong = sessionSongs[sessionIndex];
    if (!currentSong) {
      console.error("No song at index", sessionIndex);
      return;
    }

    hasAnswered = false;
    hadWrongGuess = false;

    if (nextBtnEl) nextBtnEl.disabled = true;
    if (feedbackLineEl) {
      feedbackLineEl.textContent = "";
      feedbackLineEl.className = "feedback-line";
    }
    if (audioPlayerEl) {
      audioPlayerEl.pause();
      audioPlayerEl.currentTime = 0;
    }

    renderForMode(currentSong);
    renderAnswers(currentSong);

    if (scoreTextEl) {
      scoreTextEl.innerHTML = `Score this game: <strong>${scoreCorrect}</strong> of ${TOTAL_ROUNDS}`;
    }
  }

  // ---------------------------------------------------------------------------
  // ANSWERING & END OF GAME
  // ---------------------------------------------------------------------------

  function modeCorrectMessage(firstTry) {
    if (currentMode === MODES.SPECTRO) {
      return firstTry
        ? "Correct! Nice listening."
        : "That's it! Now you've found the right caller.";
    } else if (currentMode === MODES.IMAGE) {
      return firstTry
        ? "Correct! Nice observation."
        : "That's it! Now you've picked the right insect.";
    } else if (currentMode === MODES.FACTS) {
      return firstTry
        ? "Correct! Nice recall."
        : "That's it! You've matched the right species.";
    }
    return firstTry ? "Correct!" : "You got it.";
  }

  function endMessage(score, mode) {
    if (mode === MODES.SPECTRO) {
      switch (score) {
        case 0:
          return "You need to clean your ears. Play again...";
        case 1:
          return "You need to learn to listen. Play again...";
        case 2:
          return "Almost half way there!";
        case 3:
          return "Pretty good! Your chance of finding a mate is more than 50%!";
        case 4:
          return "Impressive ears!";
        case 5:
        default:
          return "Master of insect sounds! You must be an insect sound biologist!";
      }
    } else if (mode === MODES.IMAGE) {
      switch (score) {
        case 0:
          return "You need new glasses. Play again...";
        case 1:
          return "You need to look more closely. Play again...";
        case 2:
          return "Almost half way there! Keep sharpening your eyes.";
        case 3:
          return "Pretty good! Your field ID skills are waking up.";
        case 4:
          return "Impressive eye for insects!";
        case 5:
        default:
          return "Master of insect identification! Your field guide game is strong!";
      }
    } else if (mode === MODES.FACTS) {
      switch (score) {
        case 0:
          return "You need to hit the books. Play again...";
        case 1:
          return "You need to brush up your insect trivia.";
        case 2:
          return "Almost half way there! These facts are starting to stick.";
        case 3:
          return "Pretty good! Your insect natural history memory is solid.";
        case 4:
          return "Impressive knowledge! You're almost a walking field guide.";
        case 5:
        default:
          return "Master of insect facts! You must be an insect natural history expert!";
      }
    }
    return "Nice work!";
  }

  function showEndOverlay() {
    if (!endOverlayEl) return;

    const finalScore = scoreCorrect;
    let tintClass = "tint-bad";
    if (finalScore <= 1) tintClass = "tint-bad";
    else if (finalScore <= 3) tintClass = "tint-mid";
    else tintClass = "tint-good";

    endOverlayEl.classList.remove("tint-bad", "tint-mid", "tint-good");
    endOverlayEl.classList.add(tintClass);

    const title =
      currentMode === MODES.SPECTRO
        ? "Listening game complete!"
        : currentMode === MODES.IMAGE
        ? "Image game complete!"
        : "Fact game complete!";

    if (endTitleEl) endTitleEl.textContent = title;
    if (endScoreTextEl)
      endScoreTextEl.textContent = `You scored ${finalScore} / ${TOTAL_ROUNDS}.`;
    if (endMessageEl)
      endMessageEl.textContent = endMessage(finalScore, currentMode);

    endOverlayEl.classList.remove("hidden");
    playTriumph();

    if (window.InsectGameAnalytics) {
      window.InsectGameAnalytics.recordGameCompleted(
        currentMode,
        getActiveRegionName(),
        finalScore,
        TOTAL_ROUNDS
      );
    }
  }

  function hideEndOverlay() {
    if (!endOverlayEl) return;
    endOverlayEl.classList.add("hidden");
  }

  function handleAnswer(songObj, buttonEl) {
    if (hasAnswered || !currentSong || !songObj) return;

    const correct = songObj.commonName === currentSong.commonName;
    const meta = buttonEl.querySelector(".answer-meta");

    if (!correct) {
      if (!hadWrongGuess) {
        hadWrongGuess = true;
        if (meta) {
          meta.textContent = "Try again";
          meta.classList.add("guess");
        }
        buttonEl.classList.add("wrong-choice");

        if (feedbackLineEl) {
          feedbackLineEl.classList.remove("correct");
          feedbackLineEl.classList.add("wrong");
          feedbackLineEl.textContent =
            currentMode === MODES.SPECTRO
              ? "Not quite – listen again and check the hint."
              : currentMode === MODES.IMAGE
              ? "Not quite – look again and check the hint."
              : "Not quite – reread the description and check the hint.";
        }
        showHintOverlay(currentSong);
      }
      return;
    }

    // Correct
    hasAnswered = true;
    roundsAnswered++;

    const firstTry = !hadWrongGuess;
    if (firstTry) {
      scoreCorrect++;
      playDing();
    }

    if (feedbackLineEl) {
      feedbackLineEl.classList.remove("wrong");
      feedbackLineEl.classList.add("correct");
      feedbackLineEl.textContent = modeCorrectMessage(firstTry);
    }

    if (specTaglineEl) specTaglineEl.textContent = currentSong.commonName;
    if (factLabelEl) factLabelEl.textContent = "Fun fact";
    if (factTextEl)
      factTextEl.textContent = currentSong.fact || currentSong.factRedacted || "";

    if (
      (currentMode === MODES.SPECTRO || currentMode === MODES.FACTS) &&
      insectPhotoEl
    ) {
      insectPhotoEl.src = currentSong.photo || "";
      insectPhotoEl.alt = `Photo of ${currentSong.commonName}`;
      insectPhotoEl.classList.remove("hidden");
    }

    if (answersListEl) {
      const buttons = answersListEl.querySelectorAll(".answer-btn");
      buttons.forEach((btn) => {
        const m = btn.querySelector(".answer-meta");
        if (btn.dataset.commonName === currentSong.commonName) {
          btn.classList.add("correct-choice");
          if (m) {
            m.textContent = "Answer";
            m.classList.add("correct");
          }
        }
        btn.disabled = true;
      });
    }

    showWinMark();

    if (scoreTextEl) {
      scoreTextEl.innerHTML = `Score this game: <strong>${scoreCorrect}</strong> of ${TOTAL_ROUNDS}`;
    }

    if (roundsAnswered >= TOTAL_ROUNDS) {
      if (nextBtnEl) nextBtnEl.disabled = true;
      showEndOverlay();
    } else if (nextBtnEl) {
      nextBtnEl.disabled = false;
    }
  }

  function goToNextRound() {
    if (!hasAnswered) return;
    if (roundsAnswered >= TOTAL_ROUNDS) return;
    sessionIndex++;
    if (sessionIndex < sessionSongs.length) {
      renderRound();
    }
  }

  // ---------------------------------------------------------------------------
  // GAME FLOW
  // ---------------------------------------------------------------------------

  function startNewGame() {
    const pool = getRegionPool();
    if (!pool.length) {
      console.error("No songs available for region", currentRegion);
      return;
    }

    sessionSongs = shuffle(pool).slice(0, TOTAL_ROUNDS);
    sessionIndex = 0;
    roundsAnswered = 0;
    scoreCorrect = 0;
    hasAnswered = false;
    hadWrongGuess = false;

    if (audioPlayerEl) {
      audioPlayerEl.pause();
      audioPlayerEl.currentTime = 0;
    }
    if (nextBtnEl) nextBtnEl.disabled = true;
    if (scoreTextEl) {
      scoreTextEl.innerHTML = `Score this game: <strong>0</strong> of ${TOTAL_ROUNDS}`;
    }

    updateModeUI();
    renderRound();

    if (window.InsectGameAnalytics) {
      window.InsectGameAnalytics.recordGameStarted(
        currentMode,
        getActiveRegionName()
      );
    }
  }

  function setModeAndStart(mode) {
    currentMode = mode;
    if (startOverlayEl) startOverlayEl.classList.add("hidden");
    updateModeUI();
    startNewGame();
  }

  function buildRegionButtons() {
    if (!regionButtonsEl) return;
    regionButtonsEl.innerHTML = "";

    // All regions option
    const allBtn = document.createElement("button");
    allBtn.type = "button";
    allBtn.className = "mode-change-btn";
    allBtn.textContent = "All regions";
    allBtn.addEventListener("click", () => {
      currentRegion = null;
      if (window.InsectGameAnalytics) {
        window.InsectGameAnalytics.recordRegionChoice("All regions");
      }
      if (regionOverlayEl) regionOverlayEl.classList.add("hidden");
      updateRegionToggleLabel();
      startNewGame();
    });
    regionButtonsEl.appendChild(allBtn);

    const counts = {};
    SONGS.forEach((s) => {
      const r = s.region || "Unknown region";
      counts[r] = (counts[r] || 0) + 1;
    });

    Object.entries(counts)
      .filter(([, count]) => count > 5) // region appears if >5 species
      .forEach(([name, count]) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "mode-change-btn";
        btn.textContent = `${name} (${count} species)`;
        btn.addEventListener("click", () => {
          currentRegion = name;
          if (window.InsectGameAnalytics) {
            window.InsectGameAnalytics.recordRegionChoice(name);
          }
          if (regionOverlayEl) regionOverlayEl.classList.add("hidden");
          updateRegionToggleLabel();
          startNewGame();
        });
        regionButtonsEl.appendChild(btn);
      });
  }

  // ---------------------------------------------------------------------------
  // INIT
  // ---------------------------------------------------------------------------

  function initDomRefs() {
    spectrogramImageEl = document.getElementById("spectrogram-image");
    specTaglineEl = document.getElementById("spec-tagline");
    specRegionEl = document.getElementById("spec-region");
    specLabelEl = document.getElementById("spec-label");
    axisXEl = document.getElementById("axis-x");
    axisYEl = document.getElementById("axis-y");
    ampBoxEl = document.getElementById("amp-box");
    specAxesWrapperEl = document.getElementById("spec-axes-wrapper");

    factBoxEl = document.getElementById("fact-box");
    factLabelEl = document.getElementById("fact-label");
    factTextEl = document.getElementById("fact-text");
    feedbackLineEl = document.getElementById("feedback-line");
    insectPhotoEl = document.getElementById("insect-photo");
    creditsEl = document.getElementById("credits");

    answersListEl = document.getElementById("answers-list");
    scoreTextEl = document.getElementById("score-text");
    playBtnEl = document.getElementById("play-btn");
    playBtnLabelEl = document.getElementById("play-btn-label");
    nextBtnEl = document.getElementById("next-btn");
    audioPlayerEl = document.getElementById("audio-player");
    sciToggleBtn = document.getElementById("sci-toggle");
    winMarkEl = document.getElementById("win-mark");
    modeHintTextEl = document.getElementById("mode-hint-text");
    questionTextEl = document.getElementById("question-text");
    questionSubtitleEl = document.getElementById("question-subtitle");
    modeLabelEl = document.getElementById("mode-label");
    modeBubbleEl = document.getElementById("mode-bubble");
    regionToggleBtn = document.getElementById("region-toggle");

    startOverlayEl = document.getElementById("start-overlay");
    startBtnEl = document.getElementById("start-btn");

    hintOverlayEl = document.getElementById("hint-overlay");
    hintTextEl = document.getElementById("hint-text");
    hintCloseBtnEl = document.getElementById("hint-close-btn");

    modeChangeOverlayEl = document.getElementById("mode-change-overlay");
    modeChangeSpectroEl = document.getElementById("mode-change-spectro");
    modeChangeImageEl = document.getElementById("mode-change-image");
    modeChangeFactsEl = document.getElementById("mode-change-facts");
    modeChangeCancelEl = document.getElementById("mode-change-cancel");

    regionOverlayEl = document.getElementById("region-overlay");
    regionButtonsEl = document.getElementById("region-buttons");
    regionCancelEl = document.getElementById("region-cancel");

    endOverlayEl = document.getElementById("end-overlay");
    endTitleEl = document.getElementById("end-title");
    endScoreTextEl = document.getElementById("end-score-text");
    endMessageEl = document.getElementById("end-message");
    playAgainBtnEl = document.getElementById("play-again-btn");
    changeModeBtnEl = document.getElementById("change-mode-btn");
    changeRegionBtnEl = document.getElementById("change-region-btn");
  }

  function attachEvents() {
    if (playBtnEl) playBtnEl.addEventListener("click", playFromStart);
    if (nextBtnEl) nextBtnEl.addEventListener("click", goToNextRound);

    if (sciToggleBtn) {
      sciToggleBtn.addEventListener("click", () => {
        sciNamesOn = !sciNamesOn;
        updateSciToggleUI();
        applySciToggleToButtons();
      });
    }

    if (startBtnEl) {
      startBtnEl.addEventListener("click", () => setModeAndStart(MODES.SPECTRO));
    }

    if (hintCloseBtnEl) {
      hintCloseBtnEl.addEventListener("click", hideHintOverlay);
    }

    if (playAgainBtnEl) {
      playAgainBtnEl.addEventListener("click", () => {
        hideEndOverlay();
        startNewGame();
      });
    }

    if (changeModeBtnEl) {
      changeModeBtnEl.addEventListener("click", () => {
        hideEndOverlay();
        if (modeChangeOverlayEl)
          modeChangeOverlayEl.classList.remove("hidden");
      });
    }

    if (changeRegionBtnEl) {
      changeRegionBtnEl.addEventListener("click", () => {
        hideEndOverlay();
        buildRegionButtons();
        if (regionOverlayEl) regionOverlayEl.classList.remove("hidden");
      });
    }

    if (modeBubbleEl) {
      modeBubbleEl.addEventListener("click", () => {
        if (modeChangeOverlayEl)
          modeChangeOverlayEl.classList.remove("hidden");
      });
    }

    if (modeChangeSpectroEl) {
      modeChangeSpectroEl.addEventListener("click", () => {
        if (modeChangeOverlayEl)
          modeChangeOverlayEl.classList.add("hidden");
        setModeAndStart(MODES.SPECTRO);
      });
    }
    if (modeChangeImageEl) {
      modeChangeImageEl.addEventListener("click", () => {
        if (modeChangeOverlayEl)
          modeChangeOverlayEl.classList.add("hidden");
        setModeAndStart(MODES.IMAGE);
      });
    }
    if (modeChangeFactsEl) {
      modeChangeFactsEl.addEventListener("click", () => {
        if (modeChangeOverlayEl)
          modeChangeOverlayEl.classList.add("hidden");
        setModeAndStart(MODES.FACTS);
      });
    }
    if (modeChangeCancelEl) {
      modeChangeCancelEl.addEventListener("click", () => {
        if (modeChangeOverlayEl)
          modeChangeOverlayEl.classList.add("hidden");
      });
    }

    if (regionToggleBtn) {
      regionToggleBtn.addEventListener("click", () => {
        buildRegionButtons();
        if (regionOverlayEl) regionOverlayEl.classList.remove("hidden");
      });
    }
    if (regionCancelEl) {
      regionCancelEl.addEventListener("click", () => {
        if (regionOverlayEl) regionOverlayEl.classList.add("hidden");
      });
    }

    // Spacebar toggles play/pause (except when typing)
    document.addEventListener("keydown", (e) => {
      if (e.code === "Space" || e.key === " ") {
        const tag = (e.target && e.target.tagName) || "";
        const lower = tag.toLowerCase();
        if (
          lower === "input" ||
          lower === "textarea" ||
          e.target.isContentEditable
        ) {
          return;
        }
        e.preventDefault();
        togglePlayPause();
      }
    });

    if (audioPlayerEl) {
      audioPlayerEl.addEventListener("ended", () => {
        if (playBtnLabelEl) {
          playBtnLabelEl.textContent =
            currentMode === MODES.SPECTRO
              ? "Play call"
              : "Play call (optional)";
        }
      });
    }
  }

  function initGame() {
    if (!SONGS.length) return;

    initDomRefs();
    attachEvents();
    updateSciToggleUI();
    updateRegionToggleLabel();
    updateModeUI();

    // Initialise local analytics (browser-only stats)
    if (window.InsectGameAnalytics && document.getElementById("stats-text")) {
      window.InsectGameAnalytics.init("stats-text");
    }
  }

  document.addEventListener("DOMContentLoaded", initGame);
})();
