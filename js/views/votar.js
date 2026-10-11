import { state, me, myVote, viewedProfiles } from "../store.js";
import { db, doc, setDoc, deleteDoc, serverTimestamp } from "../firebase.js";
import { VOTES_PER_VOTER } from "../firebase-config.js";
import { esc, avatar, accentOf, toast, confirmDialog, friendlyError, formatDateTime } from "../ui.js";

let picks = [];
// Con voto ya registrado se muestra el comprobante; "editing" abre la boleta para cambiarlo.
let editing = false;

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
  if (fresh) {
    picks = [...(existing?.picks || [])];
    editing = false;
  }
  picks = picks.filter((id) => state.candidates.some((c) => c.id === id));
  const voter = me();
  const open = state.config.votingOpen;

  if (!voter) {
    root.innerHTML = `<section class="panel center narrow"><h1 class="h2">Solo votantes</h1><p class="muted">Tu nombre no está en la lista de votantes.</p></section>`;
    return;
  }

  const byId = new Map(state.candidates.map((c, i) => [c.id, { c, i }]));

  if (existing && !editing) return renderReceipt(root, existing, byId, open);

  root.innerHTML = `
    <section class="hero hero-compact">
      <div>
        <p class="kicker">&gt;_ Tu boleta · ${esc(voter.name)}</p>
        <h1 class="display sm">Elige a <span class="grad">${VOTES_PER_VOTER} personas distintas</span></h1>
        <p class="lead">Toca a dos candidatos. Cada voto vale 1 punto y no puedes dárselos a la misma persona. Tu voto es secreto: nadie del equipo verá por quién votaste.</p>
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
        ${existing ? `<button class="btn btn-ghost btn-sm" id="cancel-edit">Cancelar</button>` : ""}
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
      body: `${unseenNote()}<p>Vas a votar por:</p><ol class="confirm-list">${names.map((n) => `<li>${esc(n)}</li>`).join("")}</ol><p class="muted small">Tu voto es secreto. Podrás cambiarlo mientras la votación siga abierta.</p>`,
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
      editing = false;
      toast(existing ? "Voto actualizado" : "¡Voto registrado!");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  });

  root.querySelector("#cancel-edit")?.addEventListener("click", () => {
    editing = false;
    picks = [...(existing?.picks || [])];
    render(root, { fresh: false });
  });
}

function renderReceipt(root, vote, byId, open) {
  const chosen = (vote.picks || []).map((id) => byId.get(id)).filter(Boolean);
  root.innerHTML = `
    <section class="receipt">
      <div class="receipt-check" aria-hidden="true">✓</div>
      <p class="kicker">&gt;_ Comprobante de voto</p>
      <h1 class="display sm">¡Tu voto quedó registrado!</h1>
      <p class="lead">Gracias, ${esc(me().name.split(" ")[0])}. Tu voto es secreto: solo cuenta para el resultado final.</p>
      <div class="receipt-picks">
        ${chosen.map(({ c, i }, n) => `
          <a class="receipt-pick" href="#/c/${esc(c.id)}" style="--accent:${accentOf(c, i)}">
            <small>Voto ${n + 1}</small>
            ${avatar(c, "lg", i)}
            <b>${esc(c.name)}</b>
          </a>`).join("")}
      </div>
      <p class="muted small">Registrado: ${esc(formatDateTime(vote.updatedAt) || "ahora")}</p>
      <div class="receipt-actions">
        <a class="btn btn-ghost" href="#/">Volver a candidatos</a>
        ${open ? `<button class="btn btn-primary" id="edit-vote">Cambiar mi voto</button>` : `<span class="status-pill is-closed">Votación cerrada</span>`}
        ${open ? `<button class="link-btn danger" id="withdraw">Retirar mi voto</button>` : ""}
      </div>
    </section>`;

  root.querySelector("#edit-vote")?.addEventListener("click", () => {
    editing = true;
    picks = [...(vote.picks || [])];
    render(root, { fresh: false });
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
      editing = false;
      toast("Voto retirado");
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
