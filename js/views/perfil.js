import { state, myVote, markViewed } from "../store.js?v=20261011034327";
import {
  esc, avatar, accentOf, socialLinks, mediaEmbed, renderTranscript,
  formatDate, safeUrl, wordCount, toast,
} from "../ui.js?v=20261011034327";

const openTranscripts = new Set();
const queries = new Map();

export function shouldUpdate(reason) {
  return reason === "candidates" || reason === "votes" || reason === "config";
}

export function render(root, { params, fresh }) {
  if (!state.votesReady) {
    root.innerHTML = `<div class="boot"><p>Cargando…</p></div>`;
    return;
  }
  const [id] = params;
  const index = state.candidates.findIndex((c) => c.id === id);
  const c = state.candidates[index];
  if (!c) {
    root.innerHTML = `<section class="panel center narrow"><h1 class="h2">No encontrado</h1><p><a href="#/">← Volver a candidatos</a></p></section>`;
    return;
  }
  markViewed(c.id);
  if (fresh) {
    openTranscripts.clear();
    queries.clear();
  }
  const accent = accentOf(c, index);
  const mine = (myVote()?.picks || []).includes(c.id);
  const prev = state.candidates[(index - 1 + state.candidates.length) % state.candidates.length];
  const next = state.candidates[(index + 1) % state.candidates.length];
  const interviews = [...(c.interviews || [])]
    .map((iv, i) => ({ ...iv, _i: i }))
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  const facts = [
    ["Carrera", c.career],
    ["Semestre", c.semester],
    ["Campus / universidad", c.campus],
    ["Correo", c.email],
    ["Teléfono", c.phone],
  ].filter(([, v]) => v);

  root.innerHTML = `
    <nav class="crumbs">
      <a href="#/">← Candidatos</a>
      <span class="crumbs-nav">
        <a href="#/c/${esc(prev.id)}" title="${esc(prev.name)}">‹ Anterior</a>
        <a href="#/c/${esc(next.id)}" title="${esc(next.name)}">Siguiente ›</a>
      </span>
    </nav>

    <section class="profile-head" style="--accent:${accent}">
      ${avatar(c, "xl", index)}
      <div class="profile-id">
        <p class="kicker">&gt;_ Candidato ${String(index + 1).padStart(2, "0")}</p>
        <h1 class="display sm">${esc(c.name)}</h1>
        <p class="lead">${esc([c.career, c.semester].filter(Boolean).join(" · ") || "Perfil por completar")}</p>
        ${socialLinks(c.socials)}
      </div>
      ${mine ? `<aside class="profile-score"><span class="ribbon static">✓ Tu voto</span></aside>` : ""}
    </section>

    <div class="profile-body">
      <div class="profile-main">
        ${c.bio ? `<section class="panel"><h2 class="h3">Sobre ${esc(c.name.split(" ")[0])}</h2><p class="prose">${esc(c.bio)}</p></section>` : ""}
        ${c.motivation ? `<section class="panel"><h2 class="h3">¿Por qué quiere entrar al Core Team?</h2><p class="prose">${esc(c.motivation)}</p></section>` : ""}

        <section class="panel">
          <div class="panel-head">
            <h2 class="h3">Entrevistas</h2>
            <span class="tag">${interviews.length}</span>
          </div>
          ${interviews.length ? `<ol class="timeline">${interviews.map((iv) => interviewHtml(iv)).join("")}</ol>`
            : `<p class="muted">Todavía no hay entrevistas registradas. Se agregan después de cada reunión.</p>`}
        </section>
      </div>

      <aside class="profile-side">
        ${facts.length ? `<section class="panel"><h2 class="h4">Datos</h2><dl class="facts">${facts.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl></section>` : ""}
        ${(c.strengths || []).length ? `<section class="panel"><h2 class="h4">Fortalezas</h2><div class="tags">${c.strengths.map((s) => `<span class="tag">${esc(s)}</span>`).join("")}</div></section>` : ""}
        ${c.links?.length ? `<section class="panel"><h2 class="h4">Enlaces</h2><ul class="link-list">${c.links.filter((l) => safeUrl(l.url)).map((l) => `<li><a href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener">${esc(l.label || l.url)} ↗</a></li>`).join("")}</ul></section>` : ""}
        ${c.notes ? `<section class="panel"><h2 class="h4">Notas del equipo</h2><p class="prose small">${esc(c.notes)}</p></section>` : ""}
        ${state.config.votingOpen ? `<a href="#/votar" class="btn btn-primary btn-block">${mine ? "Ver mi voto" : "Ir a votar"}</a>` : ""}
      </aside>
    </div>
  `;

  bindTranscripts(root, c);
}

function interviewHtml(iv) {
  const key = String(iv._i);
  const isOpen = openTranscripts.has(key);
  const query = queries.get(key) || "";
  const t = renderTranscript(iv.transcript, query);
  const words = wordCount(iv.transcript);
  return `
    <li class="tl-item" data-key="${key}">
      <div class="tl-dot ${iv.mode === "presencial" ? "is-live" : ""}" aria-hidden="true"></div>
      <div class="tl-card">
        <header class="tl-head">
          <div>
            <h3 class="h4">${esc(iv.title || "Entrevista")}</h3>
            <p class="muted small">${esc(formatDate(iv.date) || "Sin fecha")}${iv.duration ? ` · ${esc(iv.duration)}` : ""}${iv.interviewers ? ` · Con ${esc(iv.interviewers)}` : ""}</p>
          </div>
          <span class="tag ${iv.mode === "presencial" ? "tag-mint" : "tag-blue"}">${iv.mode === "presencial" ? "Presencial" : "Virtual"}</span>
        </header>
        ${iv.audioUrl ? `<div class="media-block"><span class="media-label">Audio</span>${mediaEmbed(iv.audioUrl, "audio")}</div>` : ""}
        ${iv.videoUrl ? `<div class="media-block"><span class="media-label">Video</span>${mediaEmbed(iv.videoUrl, "video")}</div>` : ""}
        ${iv.notes ? `<div class="notes"><span class="media-label">Notas</span><p class="prose small">${esc(iv.notes)}</p></div>` : ""}
        ${iv.transcript ? `
          <div class="transcript ${isOpen ? "is-open" : ""}">
            <div class="transcript-bar">
              <button class="btn btn-ghost btn-sm" data-act="toggle">${isOpen ? "Ocultar" : "Ver"} transcripción <span class="muted">· ${words} palabras</span></button>
              <div class="transcript-tools" ${isOpen ? "" : "hidden"}>
                <input type="search" class="input-sm" placeholder="Buscar en la transcripción" value="${esc(query)}" data-act="search" aria-label="Buscar en la transcripción" />
                <span class="muted small" data-hits>${query ? `${t.hits} coincidencia${t.hits === 1 ? "" : "s"}` : ""}</span>
                <button class="btn btn-ghost btn-sm" data-act="copy">Copiar</button>
              </div>
            </div>
            <div class="transcript-body" ${isOpen ? "" : "hidden"}>${t.html}</div>
          </div>` : ""}
      </div>
    </li>`;
}

function bindTranscripts(root, candidate) {
  root.querySelectorAll(".tl-item").forEach((item) => {
    const key = item.dataset.key;
    const iv = candidate.interviews[Number(key)];
    const box = item.querySelector(".transcript");
    if (!box) return;
    const body = box.querySelector(".transcript-body");
    const tools = box.querySelector(".transcript-tools");
    const toggle = box.querySelector('[data-act="toggle"]');

    toggle.addEventListener("click", () => {
      const open = !openTranscripts.has(key);
      if (open) openTranscripts.add(key);
      else openTranscripts.delete(key);
      box.classList.toggle("is-open", open);
      body.hidden = !open;
      tools.hidden = !open;
      toggle.firstChild.textContent = `${open ? "Ocultar" : "Ver"} transcripción `;
    });

    box.querySelector('[data-act="search"]').addEventListener("input", (e) => {
      const q = e.target.value;
      queries.set(key, q);
      const t = renderTranscript(iv.transcript, q);
      body.innerHTML = t.html;
      box.querySelector("[data-hits]").textContent = q ? `${t.hits} coincidencia${t.hits === 1 ? "" : "s"}` : "";
      body.querySelector(".is-hit")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });

    box.querySelector('[data-act="copy"]').addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(iv.transcript);
        toast("Transcripción copiada");
      } catch {
        toast("No se pudo copiar", "error");
      }
    });
  });
}
