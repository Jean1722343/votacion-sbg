import { state, results, myVote, voterName, me, viewedProfiles } from "../store.js";
import { VOTES_PER_VOTER } from "../firebase-config.js";
import { esc, avatar, accentOf, socialLinks, voterChip } from "../ui.js";

export function shouldUpdate() {
  return true;
}

export function render(root) {
  if (!state.votesReady) {
    root.innerHTML = `<div class="boot"><p>Cargando candidatos…</p></div>`;
    return;
  }
  const r = results();
  const mine = new Set(myVote()?.picks || []);
  const counts = new Map(r.rows.map((row) => [row.candidate.id, row]));
  const open = state.config.votingOpen;
  const hasVoted = mine.size > 0;
  const seen = viewedProfiles();
  const seenCount = state.candidates.filter((c) => seen.has(c.id)).length;
  const total = state.candidates.length;
  const first = me().name.split(" ")[0];

  root.innerHTML = `
    <section class="hero">
      <div>
        <p class="kicker">&gt;_ Convocatoria · Group Growth</p>
        <h1 class="display">${state.candidates.length} candidatos, <span class="grad">2 lugares</span></h1>
        <p class="lead">Revisa cada perfil, sus redes y las entrevistas. Luego reparte tus ${VOTES_PER_VOTER} votos entre dos personas distintas.</p>
      </div>
      <div class="hero-side">
        <div class="stat-ring" style="--p:${r.voterCount ? (r.votedCount / r.voterCount) * 100 : 0}">
          <div><b>${r.votedCount}/${r.voterCount}</b><small>ya votaron</small></div>
        </div>
        ${open
          ? `<a href="#/votar" class="btn ${hasVoted ? "btn-ghost" : "btn-primary"}">${hasVoted ? "Cambiar mi voto" : "Votar ahora →"}</a>`
          : `<span class="status-pill is-closed">Votación cerrada</span>`}
      </div>
    </section>

    <section class="guide" aria-label="Tu avance">
      <p class="guide-hello">Hola, <b>${esc(first)}</b>. ${hasVoted ? "Ya votaste. ¡Gracias!" : open ? "Así va tu avance:" : "La votación está cerrada."}</p>
      <ol class="guide-steps">
        <li class="${seenCount === total && total ? "done" : seenCount || hasVoted ? "progress" : "now"}">
          <span class="guide-num">${seenCount === total && total ? "✓" : "1"}</span>
          <div><b>Revisa los perfiles</b><small>${seenCount} de ${total} vistos</small>
            <div class="meter" style="--accent:var(--blue)"><i style="width:${total ? (seenCount / total) * 100 : 0}%"></i></div></div>
        </li>
        <li class="${hasVoted ? "done" : seenCount ? "now" : ""}">
          <span class="guide-num">${hasVoted ? "✓" : "2"}</span>
          <div><b>Vota por 2 personas</b><small>${hasVoted ? "Voto registrado" : open ? `<a href="#/votar">Ir a votar →</a>` : "Votación cerrada"}</small></div>
        </li>
        <li class="${hasVoted ? "now" : ""}">
          <span class="guide-num">3</span>
          <div><b>Mira los resultados</b><small><a href="#/resultados">En vivo →</a></small></div>
        </li>
      </ol>
    </section>

    ${state.candidates.length ? `
    <section class="grid-cards">
      ${state.candidates.map((c, i) => {
        const row = counts.get(c.id);
        const interviews = (c.interviews || []).length;
        return `
        <article class="card cand-card ${mine.has(c.id) ? "is-mine" : ""}" style="--accent:${accentOf(c, i)}" data-href="#/c/${esc(c.id)}" tabindex="0" role="link" aria-label="Ver perfil de ${esc(c.name)}">
          <div class="cand-top">
            ${avatar(c, "lg", i)}
            <div class="cand-votes" title="Votos recibidos">
              <b>${row?.count ?? 0}</b><small>votos</small>
            </div>
          </div>
          <h2 class="cand-name">${esc(c.name)}</h2>
          <p class="cand-meta">${esc([c.career, c.semester && `${c.semester}`].filter(Boolean).join(" · ") || "Perfil por completar")}</p>
          ${c.bio ? `<p class="cand-bio">${esc(c.bio)}</p>` : ""}
          ${socialLinks(c.socials, true)}
          <div class="cand-foot">
            <span class="tag">${interviews ? `${interviews} entrevista${interviews > 1 ? "s" : ""}` : "Sin entrevistas"}</span>
            ${mine.has(c.id) ? `<span class="tag tag-accent">Tu voto</span>` : ""}
            ${seen.has(c.id) ? `<span class="tag tag-blue">Visto</span>` : `<span class="tag tag-ghost">Sin revisar</span>`}
          </div>
          <div class="cand-voters">
            ${row?.voters.length
              ? row.voters.map((id) => voterChip(voterName(id), "sm")).join("")
              : `<span class="muted small">Nadie ha votado por ${esc(c.name.split(" ")[0])} aún</span>`}
          </div>
        </article>`;
      }).join("")}
    </section>` : `
    <section class="panel center narrow">
      <h2 class="h3">Aún no hay candidatos</h2>
      <p class="muted">Agrega candidatos en <code>data/candidatos.js</code>.</p>
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
