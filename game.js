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

  const TOTAL_ROUNDS = 5;
  const SONGS = (window.SONGS_DATA || []).slice();

  // ---- State ----
  let currentMode = null;       // "spectrogram" | "image" | "facts"
  let currentRegion = null;     // null => all regions
  let sessionSongs = [];        // array of SONGS for this 5-round game
  let sessionIndex = 0;         // which of the 5 we're on
  let currentSong = null;

  let roundsAnswered = 0;
  let scoreCorrect = 0;
  let hasAnswered = false;
  let hadWrongGuess = false;
  let sciNamesOn = false;

  let audioCtx = null;

  // ---- DOM refs ----
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

  // NEW: reveal overlay refs
  let revealOverlayEl;
  let revealTitleEl;
  let revealPhotoEl;
  let revealFactTextEl;
  let revealCloseBtnEl;

  // ---- Helpers ----

  function shuffleArray(arr) {
    return arr
      .map(v => ({ v, r: Math.random() }))
      .sort((a, b) => a.r - b.r)
      .map(x => x.v);
  }

  function getActiveRegionName() {
    return currentRegion || "All regions";
  }

  function getRegionPool() {
    if (!currentRegion) return SONGS.slice();
    return SONGS.filter(s => s.region === currentRegion);
  }

  // strong redaction for fact mode
  function redactFact(song) {
    let text = song.fact || "";
    if (!text) return text;

    let targets = [];

    const fullName = song.commonName;
    if (fullName) {
      const noHyphen = fullName.replace(/-/g, " ");
      targets.push(fullName);
      targets.push(noHyphen);
      noHyphen.split(/\s+/).forEach(part => {
        if (part.length > 2) targets.push(part);
      });
    }

    if (song.species) {
      song.species.split(/\s+/).forEach(part => {
        if (part.length > 2) targets.push(part);
      });
    }

    const groups = [
      "cricket","crickets",
      "cicada","cicadas",
      "grasshopper","grasshoppers",
      "katydid","katydids",
      "conehead","coneheads"
    ];
    targets.push(...groups);

    // special handling for periodical cicada
    if (
      song.commonName.toLowerCase().includes("13-year") ||
      song.species.toLowerCase().includes("magicicada")
    ) {
      targets.push("13", "13-year", "13 year");
      targets.push("periodical cicadas", "periodical cicada", "periodical");
    }

    const escaped = [...new Set(
      targets
        .filter(Boolean)
        .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    )];

    if (!escaped.length) return text;

    const re = new RegExp(escaped.join("|"), "gi");
    return text.replace(re, match => "•".repeat(match.length));
  }

  function getHintText(song) {
    if (currentMode === "facts") {
      return `This species is found in: ${song.region}.`;
    }
    const fact = song.fact || "";
    const idx = fact.indexOf(".");
    if (idx !== -1) return fact.slice(0, idx + 1);
    return fact || "Listen / look again and pay attention to the patterns.";
  }

  function updateNextLabel() {
    if (currentMode === "spectrogram") {
      nextBtnEl.textContent = "Next spectrogram ➜";
    } else if (currentMode === "image") {
      nextBtnEl.textContent = "Next image ➜";
    } else if (currentMode === "facts") {
      nextBtnEl.textContent = "Next description ➜";
    } else {
      nextBtnEl.textContent = "Next ➜";
    }
  }

  function updateRegionToggleLabel() {
    const name = getActiveRegionName();
    regionToggleBtn.textContent = `🌍 Region: ${
      name === "All regions" ? "All" : name
    }`;
  }

  function updateModeUI() {
    factBoxEl.classList.remove("fact-mode");

    if (currentMode === "spectrogram") {
      modeLabelEl.textContent = "Mode: Spectrogram training";
      specLabelEl.textContent = "Visualizing sound";
      axisYEl.textContent = "Frequency (kHz)";
      axisXEl.textContent = "Time (seconds)";
      ampBoxEl.style.display = "";
      specAxesWrapperEl.classList.remove("hidden");
      playBtnEl.disabled = false;
      playBtnLabelEl.textContent = "Play call";
      modeHintTextEl.textContent =
        "Tip: match the band of energy and the rhythm of pulses.";
      questionTextEl.textContent = "Which insect is producing this sound?";
      questionSubtitleEl.textContent =
        "Listen as many times as you like, then choose the common name.";
      factLabelEl.textContent = "After the guess";
    } else if (currentMode === "image") {
      modeLabelEl.textContent = "Mode: Image recognition";
      specLabelEl.textContent = "Insect image";
      axisYEl.textContent = "";
      axisXEl.textContent = "";
      ampBoxEl.style.display = "none";
      specAxesWrapperEl.classList.remove("hidden");
      playBtnEl.disabled = false;
      playBtnLabelEl.textContent = "Play call (optional)";
      modeHintTextEl.textContent =
        "Tip: look at body shape, wings, and posture.";
      questionTextEl.textContent = "Which insect is shown here?";
      questionSubtitleEl.textContent =
        "Look closely at the insect's appearance, then choose its name.";
      factLabelEl.textContent = "After the guess";
    } else if (currentMode === "facts") {
      modeLabelEl.textContent = "Mode: Fact knowledge";
      specLabelEl.textContent = "Fact training";
      axisYEl.textContent = "";
      axisXEl.textContent = "";
      ampBoxEl.style.display = "none";
      specAxesWrapperEl.classList.add("hidden");
      playBtnEl.disabled = false;
      playBtnLabelEl.textContent = "Play call (optional)";
      modeHintTextEl.textContent =
        "Tip: read the description carefully before you choose.";
      questionTextEl.textContent = "Which insect fits this description?";
      questionSubtitleEl.textContent =
        "Read the description, then choose the species.";
      factLabelEl.textContent = "Description";
      factBoxEl.classList.add("fact-mode");
    } else {
      modeLabelEl.textContent = "Mode: —";
    }

    updateNextLabel();
    updateRegionToggleLabel();
  }

  function startNewGame() {
    if (!currentMode) return;

    const pool = getRegionPool();
    // pick up to TOTAL_ROUNDS distinct species from this region
    sessionSongs = shuffleArray(pool).slice(0, TOTAL_ROUNDS);
    sessionIndex = 0;
    roundsAnswered = 0;
    scoreCorrect = 0;
    hasAnswered = false;
    hadWrongGuess = false;

    audioPlayerEl.pause();
    audioPlayerEl.currentTime = 0;
    nextBtnEl.disabled = true;

    scoreTextEl.innerHTML = `Score this game: <strong>0</strong> of ${TOTAL_ROUNDS}`;
    updateModeUI();
    renderRound();

    if (window.InsectGameAnalytics) {
      window.InsectGameAnalytics.recordGameStarted(
        currentMode,
        getActiveRegionName()
      );
    }
  }

  function renderRound() {
    hasAnswered = false;
    hadWrongGuess = false;
    nextBtnEl.disabled = true;
    feedbackLineEl.textContent = "";
    feedbackLineEl.className = "feedback-line";

    currentSong = sessionSongs[sessionIndex];
    renderForMode(currentSong);
    renderAnswers(currentSong);
  }

  function renderForMode(song) {
    insectPhotoEl.classList.add("hidden");
    insectPhotoEl.src = "";
    insectPhotoEl.alt = "";

    // Build photo/audio credit lines.
    // If license fields are empty, don't show any placeholder text.
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

    const creditParts = [];
    if (photoText) creditParts.push(`<span>${photoText}</span>`);
    if (audioText) creditParts.push(`<span>${audioText}</span>`);

    creditsEl.innerHTML = creditParts.join(" ");

    specRegionEl.textContent = song.region
      ? `Region: ${song.region}`
      : "Region: —";
    winMarkEl.classList.remove("win-mark-visible");

    if (currentMode === "spectrogram") {
      specAxesWrapperEl.classList.remove("hidden");
      spectrogramImageEl.src = song.spectrogramImage;
      spectrogramImageEl.alt = `Spectrogram of ${song.commonName} call`;
      audioPlayerEl.src = song.audio;
      specTaglineEl.textContent = "Who is calling?";
      factLabelEl.textContent = "After the guess";
      factTextEl.textContent = "Identify the caller to reveal a fun fact.";
    } else if (currentMode === "image") {
      specAxesWrapperEl.classList.remove("hidden");
      spectrogramImageEl.src = song.photo;
      spectrogramImageEl.alt = `Photo of ${song.commonName}`;
      audioPlayerEl.src = song.audio;
      specTaglineEl.textContent = "Who is this insect?";
      factLabelEl.textContent = "After the guess";
      factTextEl.textContent = "Identify the insect to reveal a fun fact.";
    } else if (currentMode === "facts") {
      specAxesWrapperEl.classList.add("hidden");
      spectrogramImageEl.src = "";
      spectrogramImageEl.alt = "";
      audioPlayerEl.src = song.audio;
      specTaglineEl.textContent = "Which insect fits this description?";
      factLabelEl.textContent = "Description";
      factTextEl.textContent = redactFact(song);
    }
  }

  function buildChoices(correctName) {
    const pool = getRegionPool().map(s => s.commonName);
    const others = pool.filter(n => n !== correctName);
    const wrong = shuffleArray(others).slice(0, 3);
    return shuffleArray([correctName, ...wrong]);
  }

  function renderAnswers(song) {
    answersListEl.innerHTML = "";
    const choices = buildChoices(song.commonName);

    choices.forEach(commonName => {
      const songObj = SONGS.find(s => s.commonName === commonName);
      if (!songObj) return;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "answer-btn";
      btn.setAttribute("aria-label", `Guess: ${commonName}`);

      btn.dataset.commonName = songObj.commonName;
      btn.dataset.scientificName = songObj.species;

      const label = document.createElement("span");
      label.className = "answer-label";
      label.textContent = sciNamesOn ? songObj.species : songObj.commonName;

      const meta = document.createElement("span");
      meta.className = "answer-meta";
      meta.textContent = "Guess";

      btn.appendChild(label);
      btn.appendChild(meta);

      btn.addEventListener("click", () =>
        handleAnswer(songObj.commonName, btn)
      );
      answersListEl.appendChild(btn);
    });
  }

  function updateSciToggleUI() {
    if (sciToggleBtn) {
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
  }

  function applySciToggleToButtons() {
    const buttons = answersListEl.querySelectorAll(".answer-btn");
    buttons.forEach(btn => {
      const labelSpan = btn.querySelector(".answer-label");
      if (!labelSpan) return;
      if (sciNamesOn) {
        labelSpan.textContent = btn.dataset.scientificName;
      } else {
        labelSpan.textContent = btn.dataset.commonName;
      }
    });
  }

  function showWinMark() {
    winMarkEl.classList.add("win-mark-visible");
    setTimeout(() => {
      winMarkEl.classList.remove("win-mark-visible");
    }, 800);
  }

  function getAudioCtx() {
    if (audioCtx) return audioCtx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
    return audioCtx;
  }

  function playDing() {
    const ctx = getAudioCtx();
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
    const ctx = getAudioCtx();
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
    if (!currentSong || !audioPlayerEl) return;
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

  function showHintOverlay(song) {
    hintTextEl.textContent = getHintText(song);
    hintOverlayEl.classList.remove("hidden");
  }

  function hideHintOverlay() {
    hintOverlayEl.classList.add("hidden");
  }

  function getModeCorrectMessage(firstTry) {
    if (currentMode === "spectrogram") {
      return firstTry
        ? "Correct! Nice listening."
        : "That's it! Now you've found the right caller.";
    } else if (currentMode === "image") {
      return firstTry
        ? "Correct! Nice observation."
        : "That's it! Now you've picked the right insect.";
    } else if (currentMode === "facts") {
      return firstTry
        ? "Correct! Nice recall."
        : "That's it! You've matched the right species.";
    }
    return firstTry ? "Correct!" : "You got it.";
  }

  function getEndMessage(score, mode) {
    if (mode === "spectrogram") {
      switch (score) {
        case 0: return "You need to clean your ears. Play again...";
        case 1: return "You need to learn to listen. Play again...";
        case 2: return "Almost half way there!";
        case 3: return "Pretty good! Your chance of finding a mate is more than 50%!";
        case 4: return "Impressive ears!";
        case 5:
        default:
          return "Master of insect sounds! You must be an insect sound biologist!";
      }
    } else if (mode === "image") {
      switch (score) {
        case 0: return "You need new glasses. Play again...";
        case 1: return "You need to look more closely. Play again...";
        case 2: return "Almost half way there! Keep sharpening your eyes.";
        case 3: return "Pretty good! Your field ID skills are waking up.";
        case 4: return "Impressive eye for insects!";
        case 5:
        default:
          return "Master of insect identification! Your field guide game is strong!";
      }
    } else if (mode === "facts") {
      switch (score) {
        case 0: return "You need to hit the books. Play again...";
        case 1: return "You need to brush up your insect trivia.";
        case 2: return "Almost half way there! These facts are starting to stick.";
        case 3: return "Pretty good! Your insect natural history memory is solid.";
        case 4: return "Impressive knowledge! You're almost a walking field guide.";
        case 5:
        default:
          return "Master of insect facts! You must be an insect natural history expert!";
      }
    }
    // fallback
    switch (score) {
      case 0: return "Play again and see what you can learn!";
      case 1: return "Keep practicing!";
      case 2: return "Almost half way there!";
      case 3: return "Pretty good!";
      case 4: return "Nice work!";
      case 5:
      default: return "Excellent!";
    }
  }

  function showEndOverlay() {
    const finalScore = scoreCorrect;
    let tintClass = "tint-bad";
    if (finalScore <= 1) tintClass = "tint-bad";
    else if (finalScore <= 3) tintClass = "tint-mid";
    else tintClass = "tint-good";

    endOverlayEl.classList.remove("tint-bad", "tint-mid", "tint-good");
    endOverlayEl.classList.add(tintClass);

    const title =
      currentMode === "spectrogram"
        ? "Listening game complete!"
        : currentMode === "image"
        ? "Image game complete!"
        : currentMode === "facts"
        ? "Fact game complete!"
        : "Game complete!";

    endTitleEl.textContent = title;
    endScoreTextEl.textContent = `You scored ${finalScore} / ${TOTAL_ROUNDS}.`;
    endMessageEl.textContent = getEndMessage(finalScore, currentMode);

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
    endOverlayEl.classList.add("hidden");
  }

  // NEW: show reveal overlay after a correct answer (fact + photo)
  function showRevealOverlay(song, firstTry) {
    if (!revealOverlayEl) return;

    revealTitleEl.textContent = getModeCorrectMessage(firstTry);
    revealFactTextEl.textContent = song.fact || "";

    if (song.photo) {
      revealPhotoEl.src = song.photo;
      revealPhotoEl.alt = `Photo of ${song.commonName}`;
      revealPhotoEl.classList.remove("hidden");
    } else {
      revealPhotoEl.src = "";
      revealPhotoEl.alt = "";
      revealPhotoEl.classList.add("hidden");
    }

    revealOverlayEl.classList.remove("hidden");
  }

  function handleAnswer(selectedName, buttonEl) {
    if (hasAnswered) return;

    const correct = selectedName === currentSong.commonName;
    const meta = buttonEl.querySelector(".answer-meta");

    if (!correct) {
      if (!hadWrongGuess) {
        hadWrongGuess = true;
        if (meta) {
          meta.textContent = "Try again";
          meta.classList.add("guess");
        }
        buttonEl.classList.add("wrong-choice");

        const msg =
          currentMode === "spectrogram"
            ? "Not quite – listen again and check the hint."
            : currentMode === "image"
            ? "Not quite – look again and check the hint."
            : "Not quite – reread the description and check the hint.";

        feedbackLineEl.textContent = msg;
        feedbackLineEl.classList.add("wrong");
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
      feedbackLineEl.textContent = getModeCorrectMessage(true);
      feedbackLineEl.classList.add("correct");
      playDing();
    } else {
      feedbackLineEl.textContent = getModeCorrectMessage(false);
      feedbackLineEl.classList.add("correct");
    }

    specTaglineEl.textContent = currentSong.commonName;

    factLabelEl.textContent = "Fun fact";
    factTextEl.textContent = currentSong.fact || "";

    if (currentMode === "spectrogram" || currentMode === "facts") {
      insectPhotoEl.src = currentSong.photo;
      insectPhotoEl.alt = `Photo of ${currentSong.commonName}`;
      insectPhotoEl.classList.remove("hidden");
    }

    const buttons = answersListEl.querySelectorAll(".answer-btn");
    buttons.forEach(btn => {
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

    showWinMark();

    scoreTextEl.innerHTML = `Score this game: <strong>${scoreCorrect}</strong> of ${TOTAL_ROUNDS}`;

    // Force them to see the reveal overlay (fact + image) before advancing
    nextBtnEl.disabled = true;
    showRevealOverlay(currentSong, firstTry);
  }

  function goToNextRound() {
    if (!hasAnswered) return;
    if (roundsAnswered >= TOTAL_ROUNDS) return;

    sessionIndex++;
    if (sessionIndex < sessionSongs.length) {
      renderRound();
    }
  }

  function setModeAndStart(mode) {
    currentMode = mode;
    startOverlayEl.classList.add("hidden");
    updateModeUI();
    startNewGame();
  }

  function buildRegionButtons() {
    regionButtonsEl.innerHTML = "";

    // "All regions" option
    const allBtn = document.createElement("button");
    allBtn.type = "button";
    allBtn.className = "mode-change-btn";
    allBtn.textContent = "All regions";
    allBtn.addEventListener("click", () => {
      currentRegion = null;
      if (window.InsectGameAnalytics) {
        window.InsectGameAnalytics.recordRegionChoice("All regions");
      }
      regionOverlayEl.classList.add("hidden");
      updateRegionToggleLabel();
      startNewGame();
    });
    regionButtonsEl.appendChild(allBtn);

    const counts = {};
    SONGS.forEach(s => {
      if (!counts[s.region]) counts[s.region] = 0;
      counts[s.region] += 1;
    });

    Object.entries(counts)
      .filter(([, count]) => count > 5) // appears only if >5 species
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
          regionOverlayEl.classList.add("hidden");
          updateRegionToggleLabel();
          startNewGame();
        });
        regionButtonsEl.appendChild(btn);
      });
  }

  // ---- Init ----

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

    // NEW: reveal overlay
    revealOverlayEl = document.getElementById("reveal-overlay");
    revealTitleEl = document.getElementById("reveal-title");
    revealPhotoEl = document.getElementById("reveal-photo");
    revealFactTextEl = document.getElementById("reveal-fact-text");
    revealCloseBtnEl = document.getElementById("reveal-close-btn");
  }

  function attachEvents() {
    if (playBtnEl) {
      playBtnEl.addEventListener("click", playFromStart);
    }
    if (nextBtnEl) {
      nextBtnEl.addEventListener("click", goToNextRound);
    }
    if (sciToggleBtn) {
      sciToggleBtn.addEventListener("click", () => {
        sciNamesOn = !sciNamesOn;
        updateSciToggleUI();
        applySciToggleToButtons();
      });
    }
    if (startBtnEl) {
      startBtnEl.addEventListener("click", () => setModeAndStart("spectrogram"));
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
        modeChangeOverlayEl.classList.remove("hidden");
      });
    }
    if (changeRegionBtnEl) {
      changeRegionBtnEl.addEventListener("click", () => {
        hideEndOverlay();
        buildRegionButtons();
        regionOverlayEl.classList.remove("hidden");
      });
    }
    if (modeBubbleEl) {
      modeBubbleEl.addEventListener("click", () => {
        modeChangeOverlayEl.classList.remove("hidden");
      });
    }
    if (modeChangeSpectroEl) {
      modeChangeSpectroEl.addEventListener("click", () => {
        modeChangeOverlayEl.classList.add("hidden");
        setModeAndStart("spectrogram");
      });
    }
    if (modeChangeImageEl) {
      modeChangeImageEl.addEventListener("click", () => {
        modeChangeOverlayEl.classList.add("hidden");
        setModeAndStart("image");
      });
    }
    if (modeChangeFactsEl) {
      modeChangeFactsEl.addEventListener("click", () => {
        modeChangeOverlayEl.classList.add("hidden");
        setModeAndStart("facts");
      });
    }
    if (modeChangeCancelEl) {
      modeChangeCancelEl.addEventListener("click", () => {
        modeChangeOverlayEl.classList.add("hidden");
      });
    }
    if (regionToggleBtn) {
      regionToggleBtn.addEventListener("click", () => {
        buildRegionButtons();
        regionOverlayEl.classList.remove("hidden");
      });
    }
    if (regionCancelEl) {
      regionCancelEl.addEventListener("click", () => {
        regionOverlayEl.classList.add("hidden");
      });
    }

    // NEW: reveal overlay close
    if (revealCloseBtnEl) {
      revealCloseBtnEl.addEventListener("click", () => {
        if (!revealOverlayEl) return;
        revealOverlayEl.classList.add("hidden");

        if (roundsAnswered >= TOTAL_ROUNDS) {
          showEndOverlay();
        } else {
          nextBtnEl.disabled = false;
        }
      });
    }

    // Spacebar toggles play/pause (but not in text inputs)
    document.addEventListener("keydown", e => {
      if (e.code === "Space" || e.key === " ") {
        const tag = (e.target && e.target.tagName || "").toLowerCase();
        if (tag === "input" || tag === "textarea" || e.target.isContentEditable) {
          return;
        }
        e.preventDefault();
        togglePlayPause();
      }
    });
  }

  function initGame() {
    if (!SONGS.length) {
      console.error("No SONGS_DATA found.");
      return;
    }

    initDomRefs();
    attachEvents();
    updateSciToggleUI();
    updateRegionToggleLabel();

    // Initialize analytics and stats panel if available
    if (window.InsectGameAnalytics && document.getElementById("stats-text")) {
      window.InsectGameAnalytics.init("stats-text");
    }
  }

  document.addEventListener("DOMContentLoaded", initGame);
})();
