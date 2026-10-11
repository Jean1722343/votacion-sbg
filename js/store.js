import {
  configured, auth, db, onAuthStateChanged, collection, doc, onSnapshot,
} from "./firebase.js";
import { ADMIN_EMAIL, VOTES_PER_VOTER } from "./firebase-config.js";

export const state = {
  configured,
  authReady: false,
  user: null,
  voters: [],
  votersReady: false,
  candidates: [],
  candidatesReady: false,
  votes: [],
  config: { votingOpen: false },
  error: null,
};

const listeners = new Set();
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit(reason) {
  for (const fn of listeners) fn(reason);
}

let privateUnsubs = [];

function watchPrivate() {
  stopPrivate();
  const fail = (err) => {
    state.error = err.code === "permission-denied"
      ? "Tu cuenta no está registrada como votante. Pide al admin que te dé de alta."
      : err.message;
    emit("error");
  };
  privateUnsubs = [
    onSnapshot(collection(db, "candidates"), (snap) => {
      state.candidates = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.name.localeCompare(b.name));
      state.candidatesReady = true;
      state.error = null;
      emit("candidates");
    }, fail),
    onSnapshot(collection(db, "votes"), (snap) => {
      state.votes = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      emit("votes");
    }, fail),
    onSnapshot(doc(db, "config", "app"), (snap) => {
      state.config = snap.exists() ? snap.data() : { votingOpen: false, missing: true };
      emit("config");
    }, fail),
  ];
}

function stopPrivate() {
  privateUnsubs.forEach((u) => u());
  privateUnsubs = [];
  state.candidates = [];
  state.candidatesReady = false;
  state.votes = [];
  state.config = { votingOpen: false };
}

export function start() {
  if (!configured) {
    state.authReady = true;
    emit("init");
    return;
  }
  onSnapshot(collection(db, "voters"), (snap) => {
    state.voters = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.role === "profesor") - (b.role === "profesor") || a.name.localeCompare(b.name));
    state.votersReady = true;
    emit("voters");
  }, (err) => {
    state.votersReady = true;
    state.error = err.message;
    emit("error");
  });

  onAuthStateChanged(auth, (user) => {
    state.user = user;
    state.authReady = true;
    state.error = null;
    if (user) watchPrivate();
    else stopPrivate();
    emit("auth");
  });
}

// ---------- Derivados ----------

export function me() {
  if (!state.user) return null;
  return state.voters.find((v) => v.id === state.user.email) || null;
}

export function isAdmin() {
  if (!state.user) return false;
  return state.user.email === ADMIN_EMAIL || Boolean(me()?.isAdmin);
}

export function myVote() {
  if (!state.user) return null;
  return state.votes.find((v) => v.id === state.user.email) || null;
}

export function voterName(id) {
  return state.voters.find((v) => v.id === id)?.name || id.split("@")[0];
}

/**
 * Calcula el conteo, el ranking (con empates) y la matriz votante × candidato.
 * Solo cuenta votos de votantes registrados y de candidatos que siguen existiendo.
 */
export function results() {
  const voterIds = new Set(state.voters.map((v) => v.id));
  const candIds = new Set(state.candidates.map((c) => c.id));
  const validVotes = state.votes.filter((v) => voterIds.has(v.id));

  const byCandidate = new Map(state.candidates.map((c) => [c.id, []]));
  for (const vote of validVotes) {
    for (const pick of new Set(vote.picks || [])) {
      if (candIds.has(pick)) byCandidate.get(pick).push(vote.id);
    }
  }

  const rows = state.candidates.map((c) => ({
    candidate: c,
    voters: byCandidate.get(c.id),
    count: byCandidate.get(c.id).length,
  }));
  rows.sort((a, b) => b.count - a.count || (a.candidate.order ?? 99) - (b.candidate.order ?? 99));

  // Ranking de competición: dos empatados en 1.º comparten el 1.º y el siguiente es 3.º.
  let rank = 0;
  rows.forEach((row, i) => {
    if (i === 0 || row.count !== rows[i - 1].count) rank = i + 1;
    row.rank = row.count > 0 ? rank : null;
  });

  const totalCast = rows.reduce((s, r) => s + r.count, 0);
  const totalPossible = state.voters.length * VOTES_PER_VOTER;
  const votedIds = new Set(validVotes.map((v) => v.id));
  const pending = state.voters.filter((v) => !votedIds.has(v.id));

  // Empates que afectan al 1.º o al 2.º lugar.
  const ties = [];
  const [a, b, c] = rows;
  if (a && b && a.count > 0 && a.count === b.count) {
    ties.push({ place: 1, rows: rows.filter((r) => r.count === a.count) });
  } else if (b && c && b.count > 0 && b.count === c.count) {
    ties.push({ place: 2, rows: rows.filter((r) => r.count === b.count) });
  }
  return {
    rows,
    totalCast,
    totalPossible,
    votedCount: votedIds.size,
    voterCount: state.voters.length,
    pending,
    ties,
    validVotes,
  };
}
