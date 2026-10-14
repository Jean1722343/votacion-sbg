import {
  auth, db, collection, doc, onSnapshot, setDoc, writeBatch, serverTimestamp, onAuthStateChanged,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut as fbSignOut,
  updatePassword, reauthenticateWithCredential, EmailAuthProvider,
} from "./firebase.js?v=20261013222157";
import { votacionAbierta, votantes, admin } from "../data/config.js?v=20261013222157";
import { VOTES_PER_VOTER, EMAIL_DOMAIN } from "./firebase-config.js?v=20261013222157";
import { registerVoters } from "./ui.js?v=20261013222157";

// Normaliza un candidato (guardado en Firestore con campos en español) al modelo de las vistas.
function toCandidate(c, i) {
  return {
    id: String(c.id),
    order: Number.isFinite(c.orden) ? c.orden : i,
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
    application: c.postulacion ? {
      date: c.postulacion.fecha || "",
      area: c.postulacion.area || "",
      speaking: Number(c.postulacion.hablarEnPublico) || 0,
      content: c.postulacion.contenido || "",
      answers: (c.postulacion.respuestas || []).map((r) => (Array.isArray(r)
        ? { question: r[0], answer: r[1] }
        : { question: r.pregunta, answer: r.respuesta })),
    } : null,
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
    })),
  };
}

export const state = {
  user: null,
  authReady: false,
  voterId: null,
  voters: votantes.map((v) => {
    const advisor = v.rol === "tutora" || v.rol === "profesor";
    return {
      id: String(v.id),
      name: v.nombre,
      role: advisor ? "asesor" : "equipo",
      roleLabel: v.rol === "tutora" ? "Tutora asesora" : v.rol === "profesor" ? "Profesor asesor" : "Equipo",
    };
  }),
  // Votantes que ya crearon su contraseña (colección pública "voters", solo marca de tiempo).
  claimed: new Set(),
  claimedReady: false,
  // Candidatos: privados en Firestore, solo se cargan con sesión iniciada.
  candidates: [],
  candidatesReady: false,
  candidatesSyncedAt: null,
  votes: [],
  votesReady: false,
  config: { votingOpen: votacionAbierta },
  error: null,
};

registerVoters(state.voters);

const listeners = new Set();
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit(reason) {
  for (const fn of listeners) fn(reason);
}

// ---------- Cuentas: cada votante crea su propia contraseña ----------

export const emailOf = (id) => `${id}@${EMAIL_DOMAIN}`;
const idOf = (email) => (email || "").split("@")[0];

export function isClaimed(id) {
  return state.claimed.has(id);
}

async function markClaimed(id) {
  if (state.claimed.has(id)) return;
  await setDoc(doc(db, "voters", id), { claimedAt: serverTimestamp() });
}

/** Primera vez: crea la cuenta del votante con la contraseña que eligió. */
export async function createAccount(id, password) {
  await createUserWithEmailAndPassword(auth, emailOf(id), password);
  await markClaimed(id);
}

export async function signIn(id, password) {
  await signInWithEmailAndPassword(auth, emailOf(id), password);
  // Por si la cuenta se creó pero no alcanzó a marcarse.
  await markClaimed(id).catch(() => {});
}

export function signOut() {
  return fbSignOut(auth);
}

export async function changePassword(current, next) {
  const cred = EmailAuthProvider.credential(state.user.email, current);
  await reauthenticateWithCredential(state.user, cred);
  await updatePassword(state.user, next);
}

// ---------- Avance personal (perfiles vistos), guardado en este navegador ----------

const viewedKey = () => `votacion-sbg:vistos:${state.voterId}`;

export function viewedProfiles() {
  try {
    return new Set(JSON.parse(localStorage.getItem(viewedKey()) || "[]"));
  } catch {
    return new Set();
  }
}

export function markViewed(candidateId) {
  const seen = viewedProfiles();
  if (seen.has(candidateId)) return;
  seen.add(candidateId);
  try {
    localStorage.setItem(viewedKey(), JSON.stringify([...seen]));
  } catch {}
}

let stopVotes = null;
let stopCandidates = null;

// El admin escucha todos los votos; cada votante solo el suyo (las reglas lo exigen).
function watchVotes() {
  stopVotes?.();
  state.votesReady = false;
  const onData = (docs) => {
    state.votes = docs;
    state.votesReady = true;
    state.error = null;
    emit("votes");
  };
  const target = isAdmin()
    ? collection(db, "votes")
    : doc(db, "votes", state.voterId);
  stopVotes = onSnapshot(target, (snap) => {
    if (snap.docs) onData(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    else onData(snap.exists() ? [{ id: snap.id, ...snap.data() }] : []);
  }, (err) => {
    state.votesReady = true;
    state.error = `No se pudieron cargar los votos: ${err.message}`;
    emit("error");
  });
}

// Los candidatos son privados: viven en Firestore y solo los leen los votantes con sesión.
function watchCandidates() {
  stopCandidates?.();
  state.candidatesReady = false;
  stopCandidates = onSnapshot(collection(db, "candidates"), (snap) => {
    const raw = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
    // Un candidato con datos mal formados no debe tumbar a los demás.
    state.candidates = raw.flatMap((c, i) => {
      try {
        return [toCandidate(c, i)];
      } catch (err) {
        console.error("[votacion] candidato inválido", c.id, err);
        return [];
      }
    }).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
    state.candidatesSyncedAt = raw.reduce((max, c) => (c.actualizado?.toMillis?.() > (max?.toMillis?.() || 0) ? c.actualizado : max), null);
    state.candidatesReady = true;
    emit("candidates");
  }, (err) => {
    state.candidatesReady = true;
    state.error = `No se pudieron cargar los candidatos: ${err.message}`;
    emit("error");
  });
}

function stopWatching() {
  stopVotes?.();
  stopCandidates?.();
  stopVotes = stopCandidates = null;
  state.votes = [];
  state.candidates = [];
  state.votesReady = state.candidatesReady = false;
}

/**
 * Solo admin: reemplaza los candidatos en Firestore con el contenido de privado/candidatos.json.
 * Devuelve cuántos se guardaron y qué ids se borraron por no venir en el archivo.
 */
export async function importCandidates(data) {
  const list = Array.isArray(data?.candidatos) ? data.candidatos : null;
  if (!list || !list.length) throw new Error("El archivo no trae una lista de candidatos.");
  const ids = new Set();
  for (const c of list) {
    if (!/^[a-z0-9-]{1,40}$/.test(c.id || "")) throw new Error(`id inválido: "${c.id}"`);
    if (!c.nombre) throw new Error(`Falta el nombre del candidato ${c.id}.`);
    if (ids.has(c.id)) throw new Error(`id repetido: ${c.id}`);
    ids.add(c.id);
  }
  const removed = state.candidates.map((c) => c.id).filter((id) => !ids.has(id));
  const batch = writeBatch(db);
  list.forEach((c, i) => {
    const { id, ...fields } = c;
    batch.set(doc(db, "candidates", id), { ...fields, orden: Number.isFinite(c.orden) ? c.orden : i, actualizado: serverTimestamp() });
  });
  removed.forEach((id) => batch.delete(doc(db, "candidates", id)));
  await batch.commit();
  return { saved: list.length, removed };
}

export function start() {
  onSnapshot(collection(db, "voters"), (snap) => {
    state.claimed = new Set(snap.docs.map((d) => d.id));
    state.claimedReady = true;
    emit("voters");
  }, () => {
    state.claimedReady = true;
    emit("voters");
  });

  onAuthStateChanged(auth, (user) => {
    const id = idOf(user?.email);
    const known = user && state.voters.some((v) => v.id === id);
    if (user && !known) {
      // Cuenta que ya no está en data/config.js: se cierra la sesión.
      fbSignOut(auth);
      return;
    }
    state.user = known ? user : null;
    state.voterId = known ? id : null;
    state.authReady = true;
    if (known) {
      watchVotes();
      watchCandidates();
    } else stopWatching();
    emit("auth");
  });
}

// ---------- Derivados ----------

export function isAdmin() {
  return Boolean(state.voterId) && state.voterId === admin;
}

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
