import { state, results, voterName } from "../store.js";
import { VOTES_PER_VOTER } from "../firebase-config.js";
import { esc, avatar, accentOf, voterChip, initials, formatDateTime } from "../ui.js";

export function shouldUpdate() {
  return true;
}

const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);

export function render(root) {
  if (!state.votesReady) {
    root.innerHTML = `<div class="boot"><p>Cargando resultados…</p></div>`;
    return;
  }
  const r = results();
  const idx = new Map(state.candidates.map((c, i) => [c.id, i]));
  const color = (c) => accentOf(c, idx.get(c.id));
  const maxScale = Math.max(r.voterCount, 1);
  const [first, second] = r.rows;
  const tie = r.ties[0];
  const leader = first?.count ? first : null;
  const finished = r.voterCount > 0 && r.votedCount === r.voterCount;

  // Parejas votadas juntas: muestra afinidades del equipo.
  const pairs = new Map();
  for (const v of r.validVotes) {
    const p = [...new Set(v.picks || [])].filter((id) => idx.has(id)).sort();
    if (p.length === 2) {
      const key = p.join("|");
      pairs.set(key, (pairs.get(key) || 0) + 1);
    }
  }
  const pairList = [...pairs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const candById = new Map(state.candidates.map((c) => [c.id, c]));

  const activity = [...r.validVotes]
    .filter((v) => v.updatedAt)
    .sort((a, b) => b.updatedAt.toMillis() - a.updatedAt.toMillis());

  const voteOf = new Map(r.validVotes.map((v) => [v.id, new Set(v.picks || [])]));

  root.innerHTML = `
    <section class="hero hero-compact">
      <div>
        <p class="kicker">&gt;_ Resultados en vivo</p>
        <h1 class="display sm">${finished ? "Votación completa" : "Así va la votación"}</h1>
        <p class="lead">${state.config.votingOpen ? "Se actualiza en tiempo real conforme el equipo vota." : "La votación está cerrada. Estos son los resultados finales."}</p>
      </div>
      <button class="btn btn-ghost" id="export">Exportar CSV</button>
    </section>

    <section class="kpis">
      <div class="kpi" style="--accent:var(--orange)">
        <small>Participación</small>
        <b>${r.votedCount}<span>/${r.voterCount}</span></b>
        <div class="meter"><i style="width:${pct(r.votedCount, r.voterCount)}%"></i></div>
        <span class="muted small">${pct(r.votedCount, r.voterCount)}% del equipo votó</span>
      </div>
      <div class="kpi" style="--accent:var(--mint)">
        <small>Votos emitidos</small>
        <b>${r.totalCast}<span>/${r.totalPossible}</span></b>
        <div class="meter"><i style="width:${pct(r.totalCast, r.totalPossible)}%"></i></div>
        <span class="muted small">${VOTES_PER_VOTER} votos por persona</span>
      </div>
      <div class="kpi" style="--accent:var(--magenta)">
        <small>Va ganando</small>
        <b class="kpi-name">${leader ? (tie?.place === 1 ? "Empate" : esc(leader.candidate.name)) : "—"}</b>
        <span class="muted small">${leader ? `${leader.count} voto${leader.count === 1 ? "" : "s"} · ${pct(leader.count, r.totalCast)}% del total` : "Aún no hay votos"}</span>
      </div>
      <div class="kpi" style="--accent:var(--blue)">
        <small>Faltan por votar</small>
        <b>${r.pending.length}</b>
        <div class="kpi-chips">${r.pending.length ? r.pending.map((v) => voterChip(v.name, "sm")).join("") : `<span class="muted small">¡Todos votaron!</span>`}</div>
      </div>
    </section>

    ${tie ? `<div class="banner banner-warn"><b>Empate ${tie.place === 1 ? "en el primer lugar" : "por el segundo lugar"}:</b> ${tie.rows.map((row) => esc(row.candidate.name)).join(", ")} con ${tie.rows[0].count} voto${tie.rows[0].count === 1 ? "" : "s"}. ${r.votedCount < r.voterCount ? "Todavía faltan votos." : "El equipo debe desempatar."}</div>` : ""}

    <section class="podium">
      ${[first, second].map((row, n) => row && row.count ? `
        <article class="podium-card place-${n + 1}" style="--accent:${color(row.candidate)}">
          <span class="podium-place">${n + 1}.º lugar${tie && tie.rows.includes(row) ? " · empate" : ""}</span>
          ${avatar(row.candidate, "lg", idx.get(row.candidate.id))}
          <h2 class="h3"><a href="#/c/${esc(row.candidate.id)}">${esc(row.candidate.name)}</a></h2>
          <p class="podium-votes"><b>${row.count}</b> voto${row.count === 1 ? "" : "s"} · ${pct(row.count, r.totalCast)}%</p>
          <div class="cand-voters">${row.voters.map((id) => voterChip(voterName(id), "sm")).join("")}</div>
        </article>` : `
        <article class="podium-card is-empty place-${n + 1}">
          <span class="podium-place">${n + 1}.º lugar</span>
          <p class="muted">Por definir</p>
        </article>`).join("")}
    </section>

    <section class="panel">
      <div class="panel-head"><h2 class="h3">Ranking</h2><span class="muted small">Máximo posible por candidato: ${r.voterCount}</span></div>
      <ol class="bars">
        ${r.rows.map((row) => `
          <li class="bar-row" style="--accent:${color(row.candidate)}">
            <span class="bar-rank">${row.rank ? `#${row.rank}` : "—"}</span>
            <a class="bar-who" href="#/c/${esc(row.candidate.id)}">${avatar(row.candidate, "sm", idx.get(row.candidate.id))}<span>${esc(row.candidate.name)}</span></a>
            <div class="bar-track" role="img" aria-label="${row.count} votos">
              <i style="width:${(row.count / maxScale) * 100}%"></i>
            </div>
            <span class="bar-value"><b>${row.count}</b><small>${pct(row.count, r.totalCast)}%</small></span>
            <div class="bar-voters">${row.voters.length ? row.voters.map((id) => voterChip(voterName(id), "sm")).join("") : `<span class="muted small">Sin votos</span>`}</div>
          </li>`).join("")}
      </ol>
    </section>

    <section class="panel">
      <div class="panel-head"><h2 class="h3">¿Quién votó por quién?</h2></div>
      <div class="matrix-wrap">
        <table class="matrix">
          <thead>
            <tr>
              <th scope="col" class="sticky">Votante</th>
              ${state.candidates.map((c) => `<th scope="col" title="${esc(c.name)}"><span class="mx-head" style="--accent:${color(c)}">${esc(initials(c.name))}</span><span class="mx-name">${esc(c.name.split(" ")[0])}</span></th>`).join("")}
              <th scope="col">Estado</th>
            </tr>
          </thead>
          <tbody>
            ${state.voters.map((v) => {
              const picks = voteOf.get(v.id);
              const vote = r.validVotes.find((x) => x.id === v.id);
              return `<tr>
                <th scope="row" class="sticky">${voterChip(v.name)}${v.role === "profesor" ? ' <span class="tag tag-sm">Profesor</span>' : ""}</th>
                ${state.candidates.map((c) => `<td>${picks?.has(c.id) ? `<span class="mx-cell" style="--accent:${color(c)}" aria-label="Votó">✓</span>` : `<span class="mx-empty" aria-label="No">·</span>`}</td>`).join("")}
                <td>${vote ? `<span class="tag tag-mint tag-sm">Votó</span><small class="muted block">${esc(formatDateTime(vote.updatedAt))}</small>` : `<span class="tag tag-sm">Pendiente</span>`}</td>
              </tr>`;
            }).join("")}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" class="sticky">Total</th>
              ${state.candidates.map((c) => `<td><b>${r.rows.find((row) => row.candidate.id === c.id).count}</b></td>`).join("")}
              <td><b>${r.totalCast}</b></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>

    <div class="two-col">
      <section class="panel">
        <h2 class="h3">Duplas más elegidas</h2>
        <p class="muted small">Qué pares de candidatos se votaron juntos en la misma boleta.</p>
        ${pairList.length ? `<ul class="pairs">${pairList.map(([key, n]) => {
          const [a, b] = key.split("|").map((id) => candById.get(id));
          return `<li><span class="pair">${avatar(a, "sm", idx.get(a.id))}${avatar(b, "sm", idx.get(b.id))}</span><span>${esc(a.name)} + ${esc(b.name)}</span><b>${n}×</b></li>`;
        }).join("")}</ul>` : `<p class="muted">Aún no hay boletas.</p>`}
      </section>
      <section class="panel">
        <h2 class="h3">Actividad</h2>
        ${activity.length ? `<ul class="activity">${activity.map((v) => `
          <li>${voterChip(voterName(v.id), "sm")}<span>votó por ${(v.picks || []).map((id) => `<b>${esc(candById.get(id)?.name || "?")}</b>`).join(" y ")}</span><time class="muted small">${esc(formatDateTime(v.updatedAt))}</time></li>`).join("")}</ul>`
          : `<p class="muted">Sin actividad todavía.</p>`}
      </section>
    </div>
  `;

  root.querySelector("#export").addEventListener("click", () => exportCsv(r));
}

function exportCsv(r) {
  const q = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const lines = [
    ["Lugar", "Candidato", "Votos", "% de votos", "Votaron por él/ella"].map(q).join(","),
    ...r.rows.map((row) => [row.rank ?? "", row.candidate.name, row.count, pct(row.count, r.totalCast), row.voters.map(voterName).join("; ")].map(q).join(",")),
    "",
    ["Votante", ...state.candidates.map((c) => c.name)].map(q).join(","),
    ...state.voters.map((v) => {
      const vote = r.validVotes.find((x) => x.id === v.id);
      return [v.name, ...state.candidates.map((c) => (vote?.picks?.includes(c.id) ? 1 : 0))].map(q).join(",");
    }),
  ];
  const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `votacion-group-growth-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
