import { state, myVote, me, viewedProfiles } from "../store.js?v=20261011034327";
import { VOTES_PER_VOTER } from "../firebase-config.js?v=20261011034327";
import { esc, avatar, accentOf, socialLinks, formatDateTime } from "../ui.js?v=20261011034327";

export function shouldUpdate() {
  return true;
}

export function render(root) {
  if (!state.votesReady) {
    root.innerHTML = `<div class="boot"><div class="boot-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></div><p>Cargando candidatos…</p></div>`;
    return;
  }
  const vote = myVote();
  const mine = new Set(vote?.picks || []);
  const open = state.config.votingOpen;
  const seen = viewedProfiles();
  const total = state.candidates.length;
  const seenCount = state.candidates.filter((c) => seen.has(c.id)).length;
  const allSeen = total > 0 && seenCount === total;
  const first = me().name.split(" ")[0];
  const byId = new Map(state.candidates.map((c, i) => [c.id, { c, i }]));

  root.innerHTML = `
    <section class="hero">
      <div>
        <p class="kicker">&gt;_ Convocatoria · Core Team</p>
        <h1 class="display">Conoce a los <span class="grad">${total} candidatos</span></h1>
        <p class="lead">Revisa cada perfil, sus redes y las entrevistas. Luego reparte tus ${VOTES_PER_VOTER} votos entre dos personas distintas. Tu voto es secreto.</p>
      </div>
      <aside class="ballot-status ${vote ? "is-done" : ""}">
        ${vote ? `
          <p class="bs-label">✓ Tu voto está registrado</p>
          <div class="bs-picks">${[...mine].map((id) => byId.get(id)).filter(Boolean).map(({ c, i }) => `
            <span class="bs-pick">${avatar(c, "sm", i)}<span>${esc(c.name)}</span></span>`).join("")}</div>
          <small class="muted">${esc(formatDateTime(vote.updatedAt))}</small>
          ${open ? `<a href="#/votar" class="btn btn-ghost btn-sm">Ver o cambiar mi voto</a>` : ""}
        ` : open ? `
          <p class="bs-label">Tienes ${VOTES_PER_VOTER} votos por usar</p>
          <div class="bs-slots"><i></i><i></i></div>
          <a href="#/votar" class="btn btn-primary">Votar ahora →</a>
        ` : `
          <p class="bs-label">Votación cerrada</p>
          <small class="muted">Ya no se registran votos.</small>
        `}
      </aside>
    </section>

    <section class="guide" aria-label="Tu avance">
      <p class="guide-hello">Hola, <b>${esc(first)}</b>. ${vote ? "Ya votaste. ¡Gracias!" : open ? "Así va tu avance:" : "La votación está cerrada."}</p>
      <ol class="guide-steps">
        <li class="${allSeen ? "done" : seenCount || vote ? "progress" : "now"}">
          <span class="guide-num">${allSeen ? "✓" : "1"}</span>
          <div><b>Revisa los perfiles</b><small>${seenCount} de ${total} vistos</small>
            <div class="meter" style="--accent:var(--blue)"><i style="width:${total ? (seenCount / total) * 100 : 0}%"></i></div></div>
        </li>
        <li class="${vote ? "done" : seenCount ? "now" : ""}">
          <span class="guide-num">${vote ? "✓" : "2"}</span>
          <div><b>Vota por ${VOTES_PER_VOTER} personas</b><small>${vote ? "Voto registrado" : open ? `<a href="#/votar">Ir a votar →</a>` : "Votación cerrada"}</small></div>
        </li>
      </ol>
    </section>

    ${total ? `
    <section class="grid-cards">
      ${state.candidates.map((c, i) => {
        const interviews = (c.interviews || []).length;
        return `
        <article class="card cand-card ${mine.has(c.id) ? "is-mine" : ""}" style="--accent:${accentOf(c, i)}" data-href="#/c/${esc(c.id)}" tabindex="0" role="link" aria-label="Ver perfil de ${esc(c.name)}">
          ${mine.has(c.id) ? `<span class="ribbon">Tu voto</span>` : ""}
          <div class="cand-top">
            ${avatar(c, "lg", i)}
            <span class="cand-index">${String(i + 1).padStart(2, "0")}</span>
          </div>
          <h2 class="cand-name">${esc(c.name)}</h2>
          <p class="cand-meta">${esc([c.career, c.semester].filter(Boolean).join(" · ") || "Perfil por completar")}</p>
          ${c.bio ? `<p class="cand-bio">${esc(c.bio)}</p>` : ""}
          ${socialLinks(c.socials, true)}
          <div class="cand-foot">
            <span class="tag">🎙 ${interviews ? `${interviews} entrevista${interviews > 1 ? "s" : ""}` : "Sin entrevistas"}</span>
            ${seen.has(c.id) ? `<span class="tag tag-blue">✓ Visto</span>` : `<span class="tag tag-ghost">Sin revisar</span>`}
          </div>
          <span class="cand-cta">Ver perfil <span aria-hidden="true">→</span></span>
        </article>`;
      }).join("")}
    </section>` : `
    <section class="panel center narrow">
      <h2 class="h3">Aún no hay candidatos</h2>
      <p class="muted">Se agregan en <code>data/candidatos.js</code>.</p>
    </section>`}
  `;

  root.querySelectorAll(".cand-card").forEach((card) => {
    const go = () => (location.hash = card.dataset.href);
    card.addEventListener("click", go);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter") go();
    });
  });
}
