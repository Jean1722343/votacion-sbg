import { state, signIn } from "../store.js";
import { VOTES_PER_VOTER } from "../firebase-config.js";
import { esc, initials } from "../ui.js";

export function render(root) {
  const votedIds = new Set(state.votes.map((v) => v.id));
  root.innerHTML = `
    <section class="login">
      <div class="login-hero">
        <p class="kicker">&gt;_ AWS Student Builder Group</p>
        <h1 class="display">Elegimos a <span class="grad">Group Growth</span></h1>
        <p class="lead">Cada integrante del equipo y el profesor asesor tienen <b>${VOTES_PER_VOTER} votos</b> para repartir entre candidatos distintos. Los dos con más votos ocupan el 1.º y 2.º lugar.</p>
        <ul class="login-steps">
          <li><span>01</span>Toca tu nombre</li>
          <li><span>02</span>Revisa perfiles y entrevistas</li>
          <li><span>03</span>Vota por 2 personas</li>
        </ul>
      </div>

      <div class="panel login-card">
        <h2 class="h3">¿Quién eres?</h2>
        <div class="voter-pick" role="list">
          ${state.voters.map((v) => `
            <button type="button" class="voter-option" data-id="${esc(v.id)}" role="listitem">
              <span class="voter-dot lg">${esc(initials(v.name))}</span>
              <span><b>${esc(v.name)}</b><small>${v.role === "profesor" ? "Profesor asesor" : "Equipo"}</small></span>
              ${votedIds.has(v.id) ? `<span class="tag tag-mint tag-sm">Ya votó</span>` : ""}
            </button>`).join("")}
        </div>
        <p class="muted small">Tu nombre queda guardado en este dispositivo hasta que pulses "Salir".</p>
      </div>
    </section>`;

  root.querySelectorAll(".voter-option").forEach((btn) =>
    btn.addEventListener("click", () => signIn(btn.dataset.id)),
  );
}
