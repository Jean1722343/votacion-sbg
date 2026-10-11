import { db, collection, onSnapshot } from "./firebase.js";
import { votacionAbierta, votantes } from "../data/config.js";
import { candidatos } from "../data/candidatos.js";
import { VOTES_PER_VOTER } from "./firebase-config.js";

const SESSION_KEY = "votacion-sbg:votante";

// Normaliza los archivos de /data (en español) al modelo que usan las vistas.
function toCandidate(c, i) {
  return {
    id: String(c.id),
    order: i,
    name: c.nombre || `Candidato ${i + 1}`,
    color: c.color || "",
    career: c.carrera || "",
    semester: c.semestre || "",
    campus: c.campus || "",
    email: c.correo || "",
    phone: c.telefono || "",
    photoUrl: c.foto || "",
    bio: c.bio || "",
    motivation: c.motivacion || "",
    strengths: c.fortalezas || [],
    notes: c.notas || "",
    socials: c.redes || {},
    links: (c.enlaces || []).map((l) => ({ label: l.etiqueta || "", url: l.url || "" })),
    interviews: (c.entrevistas || []).map((e) => ({
      title: e.titulo || "",
      date: e.fecha || "",
      mode: e.modalidad === "presencial" ? "presencial" : "virtual",
      duration: e.duracion || "",
      interviewers: e.entrevistadores || "",
      audioUrl: e.audio || "",
      videoUrl: e.video || "",
      notes: e.notas || "",
      transcript: e.transcripcion || "",
      transcriptFile: e.archivoTranscripcion || "",
    })),
  };
}

export const state = {
  voterId: null,
  voters: votantes.map((v) => ({ id: String(v.id), name: v.nombre, role: v.rol === "profesor" ? "profesor" : "equipo" })),
  candidates: candidatos.map(toCandidate),
  votes: [],
  votesReady: false,
  config: { votingOpen: votacionAbierta },
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

// ---------- Sesión: solo el nombre, guardado en este navegador ----------

function readSession() {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function signIn(id) {
  state.voterId = id;
  try {
    localStorage.setItem(SESSION_KEY, id);
  } catch {}
  emit("auth");
}

export function signOut() {
  state.voterId = null;
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {}
  emit("auth");
}

// Carga las transcripciones que están en archivos .txt aparte.
async function loadTranscriptFiles() {
  const jobs = [];
  for (const c of state.candidates) {
    for (const iv of c.interviews) {
      if (!iv.transcript && iv.transcriptFile) {
        jobs.push(
          fetch(iv.transcriptFile, { cache: "no-cache" })
            .then((r) => (r.ok ? r.text() : ""))
            .then((text) => (iv.transcript = text.trim()))
            .catch(() => {}),
        );
      }
    }
  }
  if (jobs.length) {
    await Promise.all(jobs);
    emit("candidates");
  }
}

export function start() {
  const saved = readSession();
  if (saved && state.voters.some((v) => v.id === saved)) state.voterId = saved;

  onSnapshot(collection(db, "votes"), (snap) => {
    state.votes = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    state.votesReady = true;
    state.error = null;
    emit("votes");
  }, (err) => {
    state.votesReady = true;
    state.error = `No se pudieron cargar los votos: ${err.message}`;
    emit("error");
  });

  loadTranscriptFiles();
  emit("init");
}

// ---------- Derivados ----------

export function me() {
  return state.voters.find((v) => v.id === state.voterId) || null;
}

export function myVote() {
  return state.votes.find((v) => v.id === state.voterId) || null;
}

export function voterName(id) {
  return state.voters.find((v) => v.id === id)?.name || id;
}

/**
 * Calcula el conteo, el ranking (con empates) y la matriz votante × candidato.
 * Solo cuenta votos de votantes de la lista y de candidatos que existen.
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
  rows.sort((a, b) => b.count - a.count || a.candidate.order - b.candidate.order);

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
