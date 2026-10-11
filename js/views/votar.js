import { state, me, myVote, viewedProfiles } from "../store.js";
import { db, doc, setDoc, deleteDoc, serverTimestamp } from "../firebase.js";
import { VOTES_PER_VOTER } from "../firebase-config.js";
import { esc, avatar, accentOf, toast, confirmDialog, friendlyError } from "../ui.js";

let picks = [];

// La selección vive en `picks`, así que re-renderizar con datos nuevos no la pierde.
export function shouldUpdate() {
  return true;
}

export function render(root, { fresh }) {
  if (!state.votesReady) {
    root.innerHTML = `<div class="boot"><p>Cargando…</p></div>`;
    return;
  }
  const existing = myVote();
  if (fresh) picks = [...(existing?.picks || [])];
  picks = picks.filter((id) => state.candidates.some((c) => c.id === id));
  const voter = me();
  const open = state.config.votingOpen;

  if (!voter) {
    root.innerHTML = `<section class="panel center narrow"><h1 class="h2">Solo votantes</h1><p class="muted">Tu nombre no está en la lista de votantes.</p></section>`;
    return;
  }

  const byId = new Map(state.candidates.map((c, i) => [c.id, { c, i }]));

  root.innerHTML = `
    <section class="hero hero-compact">
      <div>
        <p class="kicker">&gt;_ Tu boleta · ${esc(voter.name)}</p>
        <h1 class="display sm">Elige a <span class="grad">${VOTES_PER_VOTER} personas distintas</span></h1>
        <p class="lead">Cada voto vale 1 punto. No puedes dar tus dos votos a la misma persona.${existing ? " Ya votaste: puedes cambiar tu voto mientras la votación esté abierta." : ""}</p>
      </div>
    </section>

    ${open ? "" : `<div class="banner">La votación está cerrada. ${existing ? "Este fue tu voto." : "Ya no se pueden registrar votos."}</div>`}

    <section class="grid-cards vote-grid ${open ? "" : "is-locked"}" role="group" aria-label="Candidatos">
      ${state.candidates.map((c, i) => {
        const pos = picks.indexOf(c.id);
        return `
        <button type="button" class="card vote-card ${pos >= 0 ? "is-picked" : ""}" style="--accent:${accentOf(c, i)}" data-id="${esc(c.id)}" aria-pressed="${pos >= 0}" ${open ? "" : "disabled"}>
          <span class="vote-check" aria-hidden="true">${pos >= 0 ? pos + 1 : ""}</span>
          ${avatar(c, "lg", i)}
          <span class="vote-name">${esc(c.name)}</span>
          <span class="cand-meta">${esc(c.career || "")}</span>
          <a class="link-btn small" href="#/c/${esc(c.id)}" onclick="event.stopPropagation()">Ver perfil</a>
        </button>`;
      }).join("")}
    </section>

    <div class="ballot ${open ? "" : "is-locked"}">
      <div class="ballot-slots">
        ${Array.from({ length: VOTES_PER_VOTER }, (_, n) => {
          const entry = byId.get(picks[n]);
          return `<div class="slot ${entry ? "is-filled" : ""}" style="--accent:${entry ? accentOf(entry.c, entry.i) : "var(--line)"}">
            <small>Voto ${n + 1}</small>
            <b>${entry ? esc(entry.c.name) : "—"}</b>
          </div>`;
        }).join("")}
      </div>
      <div class="ballot-actions">
        <span class="ballot-count"><b>${picks.length}</b> de ${VOTES_PER_VOTER}</span>
        ${open && existing ? `<button class="btn btn-ghost btn-sm" id="withdraw">Retirar voto</button>` : ""}
        ${open ? `<button class="btn btn-primary" id="submit" ${picks.length === VOTES_PER_VOTER ? "" : "disabled"}>${existing ? "Actualizar voto" : "Enviar voto"}</button>` : ""}
      </div>
    </div>
  `;

  if (!open) return;

  root.querySelectorAll(".vote-card").forEach((card) =>
    card.addEventListener("click", () => {
      const id = card.dataset.id;
      if (picks.includes(id)) {
        picks = picks.filter((p) => p !== id);
      } else if (picks.length >= VOTES_PER_VOTER) {
        toast(`Ya elegiste ${VOTES_PER_VOTER}. Quita uno para cambiarlo.`, "warn");
        return;
      } else {
        picks.push(id);
      }
      render(root, { fresh: false });
    }),
  );

  root.querySelector("#submit")?.addEventListener("click", async () => {
    if (picks.length !== VOTES_PER_VOTER || new Set(picks).size !== VOTES_PER_VOTER) return;
    const names = picks.map((id) => byId.get(id).c.name);
    const ok = await confirmDialog({
      title: existing ? "¿Actualizar tu voto?" : "¿Confirmas tu voto?",
      body: `${unseenNote()}<p>Vas a votar por:</p><ol class="confirm-list">${names.map((n) => `<li>${esc(n)}</li>`).join("")}</ol><p class="muted small">Tu nombre aparecerá junto a cada candidato que votaste.</p>`,
      confirm: existing ? "Actualizar" : "Votar",
    });
    if (!ok) return;
    try {
      await setDoc(doc(db, "votes", state.voterId), {
        voterName: voter.name,
        picks: [...picks],
        createdAt: existing?.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      toast(existing ? "Voto actualizado" : "¡Voto registrado!");
      location.hash = "#/resultados";
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  });

  root.querySelector("#withdraw")?.addEventListener("click", async () => {
    const ok = await confirmDialog({
      title: "¿Retirar tu voto?",
      body: "<p>Tus dos votos se eliminarán. Podrás volver a votar mientras la votación siga abierta.</p>",
      confirm: "Retirar",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteDoc(doc(db, "votes", state.voterId));
      picks = [];
      toast("Voto retirado");
      render(root, { fresh: false });
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  });
}

function unseenNote() {
  const seen = viewedProfiles();
  const unseen = state.candidates.filter((c) => !seen.has(c.id));
  if (!unseen.length) return "";
  return `<p class="banner banner-warn small">Aún no abres ${unseen.length === 1 ? "el perfil de" : "los perfiles de"} ${unseen.map((c) => `<b>${esc(c.name)}</b>`).join(", ")}. Puedes votar igual o revisarlos primero.</p>`;
}
