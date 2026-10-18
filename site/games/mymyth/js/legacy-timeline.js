import { state, legacyScoreFromMyth, legacyMedals, legacyEpigraph } from './state.js';
import { LINES, getCurrentNode } from './data.js';
import { els } from './ui.js';

const STORAGE_KEY = "myMythLegacyTimeline";
const MAX_ENTRIES = 20;

function _load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

function _save(entries) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); } catch (e) {}
}

export function recordMythDeath(myth) {
  myth = myth || state;
  if (!myth || !myth.lineId) return;
  const fLid = myth.crossLineageId || myth.lineId;
  const L = LINES[fLid];
  const node = L && getCurrentNode(L, myth.nodeKey);
  const score = legacyScoreFromMyth(myth);
  const medals = legacyMedals(score);
  const epigraph = legacyEpigraph(score);
  const entry = {
    lineId: myth.lineId,
    lineTitle: L ? L.title : myth.lineId,
    formName: node ? node.name : (myth.nodeKey || "Unknown"),
    formKey: myth.nodeKey || "",
    formEmoji: node ? (node.emoji || "❓") : "❓",
    stage: node ? (node.stage || 0) : 0,
    score: Math.round(score),
    medals: medals.map(function (m) { return m.emoji + " " + m.label; }),
    epigraph: epigraph,
    battlesWon: myth.battles || 0,
    diedAt: Date.now(),
  };
  const entries = _load();
  entries.unshift(entry);
  if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
  _save(entries);
}

export function openLegacyTimeline() {
  const entries = _load();
  const list = els.legacyTimelineList;
  if (!list) return;
  if (!entries.length) {
    list.innerHTML = '<p class="legacy-empty">No myths have fallen yet. Begin a lineage!</p>';
  } else {
    list.innerHTML = entries.map(function (e, i) {
      const date = new Date(e.diedAt).toLocaleDateString();
      const medalHtml = (e.medals || []).join(" &nbsp;");
      return (
        '<div class="legacy-entry">' +
        '<div class="legacy-entry-header">' +
        '<span class="legacy-entry-num">#' + (i + 1) + '</span>' +
        '<span class="legacy-entry-emoji">' + e.formEmoji + '</span>' +
        '<span class="legacy-entry-name">' + _esc(e.formName) + '</span>' +
        '<span class="legacy-entry-line">(' + _esc(e.lineTitle) + ')</span>' +
        '<span class="legacy-entry-date">' + date + '</span>' +
        '</div>' +
        '<div class="legacy-entry-medals">' + (medalHtml || '🕯️ Remembrance') + '</div>' +
        '<div class="legacy-entry-stats">Stage ' + e.stage + ' &nbsp;·&nbsp; Score ' + e.score + ' &nbsp;·&nbsp; ' + e.battlesWon + ' battles</div>' +
        '<div class="legacy-entry-epigraph">' + _esc(e.epigraph || "") + '</div>' +
        '</div>'
      );
    }).join("");
  }
  if (els.modalLegacyTimeline) els.modalLegacyTimeline.classList.add("open");
}

export function closeLegacyTimeline() {
  if (els.modalLegacyTimeline) els.modalLegacyTimeline.classList.remove("open");
}

function _esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
