/*
  analytics.js

  Local-only analytics for the Insect Song Learning Game.

  This uses localStorage to track stats PER BROWSER ONLY.
  It does NOT send any data to a server.

  It tracks:
    - pageViews     : times this browser loaded the page
    - gamesStarted  : total games started (all modes)
    - gamesCompleted: total games completed (all modes)
    - modeStats     : stats per mode (spectrogram, image, facts)
    - regionStats   : stats per region (and "All regions")
    - referrers     : which sites (if any) linked to this page (per browser)

  API exposed on window.InsectGameAnalytics:

    InsectGameAnalytics.init(statsElementId?)
    InsectGameAnalytics.recordGameStarted(mode, regionName)
    InsectGameAnalytics.recordGameCompleted(mode, regionName, score, roundsTotal)
    InsectGameAnalytics.recordRegionChoice(regionName)
    InsectGameAnalytics.getSummary()       // returns a clean summary object
    InsectGameAnalytics.renderStatsPanel() // re-renders the stats element, if provided
*/

(function () {
  const STATS_KEY = "insectGameStats_v2";

  let stats = loadStats();
  let statsElementId = null;

  function loadStats() {
    try {
      const raw = localStorage.getItem(STATS_KEY);
      if (!raw) {
        return createEmptyStats();
      }
      const parsed = JSON.parse(raw);
      // ensure some keys exist even if structure changes later
      return {
        firstVisitAt: parsed.firstVisitAt || new Date().toISOString(),
        pageViews: typeof parsed.pageViews === "number" ? parsed.pageViews : 0,
        gamesStarted: parsed.gamesStarted || 0,
        gamesCompleted: parsed.gamesCompleted || 0,
        modeStats: parsed.modeStats || {},
        regionStats: parsed.regionStats || {},
        referrers: parsed.referrers || {}
      };
    } catch (e) {
      return createEmptyStats();
    }
  }

  function createEmptyStats() {
    return {
      firstVisitAt: new Date().toISOString(),
      pageViews: 0,
      gamesStarted: 0,
      gamesCompleted: 0,
      modeStats: {},   // mode -> {gamesStarted, gamesCompleted, totalScore, totalRounds}
      regionStats: {}, // region -> {gamesStarted, gamesCompleted, totalScore, totalRounds, chosenCount}
      referrers: {}    // referrerHost -> count
    };
  }

  function saveStats() {
    try {
      localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    } catch (e) {
      // ignore storage errors (e.g. private mode)
    }
    renderStatsPanel();
  }

  function ensureModeStats(mode) {
    if (!stats.modeStats[mode]) {
      stats.modeStats[mode] = {
        gamesStarted: 0,
        gamesCompleted: 0,
        totalScore: 0,
        totalRounds: 0
      };
    }
    return stats.modeStats[mode];
  }

  function ensureRegionStats(regionName) {
    const key = regionName || "All regions";
    if (!stats.regionStats[key]) {
      stats.regionStats[key] = {
        gamesStarted: 0,
        gamesCompleted: 0,
        totalScore: 0,
        totalRounds: 0,
        chosenCount: 0
      };
    }
    return stats.regionStats[key];
  }

  function recordPageView() {
    stats.pageViews += 1;

    // approximate referrer info (browser-local only)
    try {
      const ref = document.referrer || "";
      if (ref) {
        const url = new URL(ref);
        const host = url.host || "unknown";
        if (!stats.referrers[host]) {
          stats.referrers[host] = 0;
        }
        stats.referrers[host] += 1;
      }
    } catch (e) {
      // ignore invalid referrers
    }

    saveStats();
  }

  function recordGameStarted(mode, regionName) {
    const regKey = regionName || "All regions";
    stats.gamesStarted += 1;
    ensureModeStats(mode).gamesStarted += 1;
    ensureRegionStats(regKey).gamesStarted += 1;
    saveStats();
  }

  function recordGameCompleted(mode, regionName, score, roundsTotal) {
    const regKey = regionName || "All regions";
    stats.gamesCompleted += 1;

    const ms = ensureModeStats(mode);
    ms.gamesCompleted += 1;
    ms.totalScore += score;
    ms.totalRounds += roundsTotal;

    const rs = ensureRegionStats(regKey);
    rs.gamesCompleted += 1;
    rs.totalScore += score;
    rs.totalRounds += roundsTotal;

    saveStats();
  }

  function recordRegionChoice(regionName) {
    const regKey = regionName || "All regions";
    const rs = ensureRegionStats(regKey);
    rs.chosenCount += 1;
    saveStats();
  }

  function averageScore(totalScore, totalRounds) {
    if (!totalRounds || totalRounds <= 0) return 0;
    // totalRounds is (#gamesCompleted * roundsPerGame), so we divide by that
    return +(totalScore / totalRounds).toFixed(2);
  }

  function getSummary() {
    // produce a clean, derived summary (no internal details)
    const modeStatsSummary = {};
    for (const [mode, ms] of Object.entries(stats.modeStats)) {
      const totalRounds = ms.totalRounds || (ms.gamesCompleted * 5) || 0;
      modeStatsSummary[mode] = {
        gamesStarted: ms.gamesStarted,
        gamesCompleted: ms.gamesCompleted,
        averageScore: averageScore(ms.totalScore, totalRounds)
      };
    }

    const regionStatsSummary = {};
    for (const [reg, rs] of Object.entries(stats.regionStats)) {
      const totalRounds = rs.totalRounds || (rs.gamesCompleted * 5) || 0;
      regionStatsSummary[reg] = {
        gamesStarted: rs.gamesStarted,
        gamesCompleted: rs.gamesCompleted,
        chosenCount: rs.chosenCount || 0,
        averageScore: averageScore(rs.totalScore, totalRounds)
      };
    }

    return {
      firstVisitAt: stats.firstVisitAt,
      pageViews: stats.pageViews,
      gamesStarted: stats.gamesStarted,
      gamesCompleted: stats.gamesCompleted,
      modeStats: modeStatsSummary,
      regionStats: regionStatsSummary,
      referrers: stats.referrers
    };
  }

  function renderStatsPanel() {
    if (!statsElementId) return;
    const el = document.getElementById(statsElementId);
    if (!el) return;

    const summary = getSummary();
    el.textContent = JSON.stringify(summary, null, 2);
  }

  function init(statsElId) {
    if (statsElId) {
      statsElementId = statsElId;
    }
    // count a page view on init
    recordPageView();
    // ensure panel is drawn
    renderStatsPanel();
  }

  // Expose API on window
  window.InsectGameAnalytics = {
    init,
    recordGameStarted,
    recordGameCompleted,
    recordRegionChoice,
    getSummary,
    renderStatsPanel
  };
})();
