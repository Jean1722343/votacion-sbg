// Utilidades de interfaz compartidas por todas las vistas.

export const ACCENTS = ["#FF9900", "#FF57E9", "#00E582", "#42B4FF", "#AD5CFF", "#FFC266"];

export function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function initials(name) {
  const parts = String(name || "?").trim().split(/\s+/);
  // Un solo nombre: dos letras ("Jean" → "Je") para distinguir nombres parecidos.
  if (parts.length === 1) return parts[0].slice(0, 2).replace(/^./, (c) => c.toUpperCase());
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() || "").join("");
}

// Color fijo por votante (según su orden en data/config.js).
const VOTER_COLORS = ["#FF9900", "#42B4FF", "#00E582", "#FF57E9", "#AD5CFF", "#FFC266"];
const voterColorByName = new Map();
export function registerVoters(voters) {
  voters.forEach((v, i) => voterColorByName.set(v.name, VOTER_COLORS[i % VOTER_COLORS.length]));
}
export function voterColor(name) {
  return voterColorByName.get(name) || "var(--purple)";
}

export function accentOf(candidate, index = 0) {
  return candidate?.color || ACCENTS[(candidate?.order ?? index) % ACCENTS.length];
}

export function slug(text) {
  return String(text)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

export function safeUrl(url) {
  const u = String(url || "").trim();
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  // Archivos del propio repo (carpetas media/ y transcripciones/).
  if (/^(\.\/)?(media|transcripciones)\/[^\s]+$/i.test(u)) return u;
  if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(u)) return `https://${u}`;
  return "";
}

export function avatar(candidate, size = "md", index = 0) {
  const color = accentOf(candidate, index);
  const photo = safeUrl(candidate?.photoUrl);
  if (photo) {
    return `<span class="avatar avatar-${size}" style="--accent:${color}"><img src="${esc(photo)}" alt="" loading="lazy" referrerpolicy="no-referrer" /></span>`;
  }
  return `<span class="avatar avatar-${size}" style="--accent:${color}" aria-hidden="true">${esc(initials(candidate?.name))}</span>`;
}

export function voterChip(name, extra = "") {
  return `<span class="voter-chip ${extra}" title="${esc(name)}"><span class="voter-dot" style="--vc:${voterColor(name)}">${esc(initials(name))}</span>${esc(name)}</span>`;
}

export const SOCIALS = [
  { key: "linkedin", label: "LinkedIn", glyph: "in" },
  { key: "github", label: "GitHub", glyph: "GH" },
  { key: "instagram", label: "Instagram", glyph: "IG" },
  { key: "tiktok", label: "TikTok", glyph: "TT" },
  { key: "x", label: "X", glyph: "X" },
  { key: "facebook", label: "Facebook", glyph: "f" },
  { key: "web", label: "Web / portafolio", glyph: "↗" },
];

export function socialLinks(socials = {}, compact = false) {
  const items = SOCIALS.filter((s) => safeUrl(socials[s.key]));
  if (!items.length) return compact ? "" : `<p class="muted small">Sin redes registradas todavía.</p>`;
  return `<div class="socials ${compact ? "socials-compact" : ""}">${items
    .map((s) => `<a class="social" href="${esc(safeUrl(socials[s.key]))}" target="_blank" rel="noopener" title="${s.label}" onclick="event.stopPropagation()"><b>${s.glyph}</b>${compact ? "" : `<span>${s.label}</span>`}</a>`)
    .join("")}</div>`;
}

export function formatDate(value) {
  if (!value) return "";
  const date = value.toDate ? value.toDate() : new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(value) {
  if (!value) return "";
  const date = value.toDate ? value.toDate() : new Date(value);
  return date.toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Reproductor embebido según el tipo de enlace (YouTube, Drive, SoundCloud, archivo directo). */
export function mediaEmbed(rawUrl, kind = "audio") {
  const url = safeUrl(rawUrl);
  if (!url) return "";
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/);
  if (yt) {
    return `<div class="embed embed-video"><iframe src="https://www.youtube-nocookie.com/embed/${yt[1]}" title="Video" allow="encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`;
  }
  const drive = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([\w-]+)/);
  if (drive) {
    const cls = kind === "video" ? "embed-video" : "embed-audio";
    return `<div class="embed ${cls}"><iframe src="https://drive.google.com/file/d/${drive[1]}/preview" title="Archivo de Drive" allow="autoplay" loading="lazy"></iframe></div>
      <a class="link-out" href="${esc(url)}" target="_blank" rel="noopener">Abrir en Drive ↗</a>`;
  }
  if (/soundcloud\.com\//.test(url)) {
    return `<div class="embed embed-audio"><iframe src="https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23ff9900" title="SoundCloud" loading="lazy"></iframe></div>`;
  }
  if (/\.(mp3|m4a|wav|ogg|oga|aac|opus|flac)(\?|$)/i.test(url)) {
    return `<audio class="player" controls preload="none" src="${esc(url)}"></audio>`;
  }
  if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(url)) {
    return `<video class="player player-video" controls preload="none" src="${esc(url)}"></video>`;
  }
  return `<a class="btn btn-ghost btn-sm" href="${esc(url)}" target="_blank" rel="noopener">Abrir ${kind === "video" ? "video" : "audio"} ↗</a>`;
}

const SPEAKER_LINE = /^\s*(?:\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*[-–]?\s*)?([^:\n]{1,40}?):\s+(.+)$/;

function highlight(text, query) {
  const safe = esc(text);
  if (!query) return safe;
  const pattern = new RegExp(`(${esc(query).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  return safe.replace(pattern, "<mark>$1</mark>");
}

/** Convierte una transcripción en texto plano a líneas con hablante y marca de tiempo, si las tiene. */
export function renderTranscript(text, query = "") {
  const lines = String(text || "").split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return { html: `<p class="muted small">Sin transcripción todavía.</p>`, hits: 0, total: 0 };
  const q = query.trim().toLowerCase();
  let hits = 0;
  const speakers = new Map();
  const html = lines.map((line) => {
    const match = line.match(SPEAKER_LINE);
    const hit = q && line.toLowerCase().includes(q);
    if (hit) hits += 1;
    const cls = `tline${hit ? " is-hit" : ""}${q && !hit ? " is-dim" : ""}`;
    if (match) {
      const [, time, speaker, body] = match;
      const key = speaker.trim().toLowerCase();
      if (!speakers.has(key)) speakers.set(key, speakers.size % 4);
      return `<p class="${cls}">${time ? `<time>${esc(time)}</time>` : ""}<b class="speaker spk-${speakers.get(key)}">${highlight(speaker, q)}</b><span>${highlight(body, q)}</span></p>`;
    }
    return `<p class="${cls}"><span>${highlight(line, q)}</span></p>`;
  }).join("");
  return { html, hits, total: lines.length };
}

export function wordCount(text) {
  return String(text || "").trim().split(/\s+/).filter(Boolean).length;
}

// ---------- Toast y diálogo ----------

let toastTimer;
export function toast(message, type = "ok") {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.dataset.type = type;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
}

// Resuelve en cuanto se toca un botón (no depende del evento "close", que Chrome
// puede retrasar si la pestaña pasa a segundo plano justo al confirmar).
export function confirmDialog({ title, body, confirm = "Confirmar", cancel = "Cancelar", danger = false }) {
  const dialog = document.getElementById("dialog");
  if (dialog.open) dialog.close();
  dialog.innerHTML = `
    <div class="dialog-card" role="document">
      <h3>${esc(title)}</h3>
      <div class="dialog-body">${body}</div>
      <div class="dialog-actions">
        <button type="button" class="btn btn-ghost" data-answer="cancel">${esc(cancel)}</button>
        <button type="button" class="btn ${danger ? "btn-danger" : "btn-primary"}" data-answer="ok" autofocus>${esc(confirm)}</button>
      </div>
    </div>`;
  dialog.showModal();
  return new Promise((resolve) => {
    let settled = false;
    const finish = (answer) => {
      if (settled) return;
      settled = true;
      dialog.removeEventListener("cancel", onCancel);
      if (dialog.open) dialog.close(answer);
      resolve(answer === "ok");
    };
    const onCancel = (e) => {
      e.preventDefault();
      finish("cancel");
    };
    dialog.addEventListener("cancel", onCancel); // tecla Escape
    dialog.querySelectorAll("[data-answer]").forEach((b) =>
      b.addEventListener("click", () => finish(b.dataset.answer)),
    );
  });
}

export function friendlyError(err) {
  const code = err?.code || "";
  const map = {
    "auth/invalid-credential": "Contraseña incorrecta.",
    "auth/wrong-password": "Contraseña incorrecta.",
    "auth/user-not-found": "Ese votante no tiene cuenta todavía.",
    "auth/too-many-requests": "Demasiados intentos. Espera un momento.",
    "auth/network-request-failed": "Sin conexión. Revisa tu internet.",
    "auth/email-already-in-use": "Ya existe una cuenta con ese nombre.",
    "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
    "auth/operation-not-allowed": "El inicio con correo/contraseña no está habilitado en Firebase.",
    "permission-denied": "No tienes permiso para esto (o la votación está cerrada).",
  };
  return map[code] || err?.message || "Algo salió mal.";
}
