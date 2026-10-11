import { state } from "../store.js";
import { auth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "../firebase.js";
import { ADMIN_EMAIL, VOTES_PER_VOTER } from "../firebase-config.js";
import { esc, initials, friendlyError } from "../ui.js";

let selected = null;
let manual = false;

export function shouldUpdate(reason) {
  return reason === "voters" || reason === "auth";
}

export function render(root) {
  const voters = state.voters;
  if (!voters.length) manual = true;
  if (selected && !voters.some((v) => v.id === selected)) selected = null;

  root.innerHTML = `
    <section class="login">
      <div class="login-hero">
        <p class="kicker">&gt;_ AWS Student Builder Group</p>
        <h1 class="display">Elegimos a <span class="grad">Group Growth</span></h1>
        <p class="lead">Cada integrante del equipo y el profesor asesor tienen <b>${VOTES_PER_VOTER} votos</b> para repartir entre candidatos distintos. Los dos con más votos ocupan el 1.º y 2.º lugar.</p>
        <ul class="login-steps">
          <li><span>01</span>Elige tu nombre</li>
          <li><span>02</span>Escribe tu PIN</li>
          <li><span>03</span>Revisa perfiles y vota</li>
        </ul>
      </div>

      <form class="panel login-card" id="login-form" autocomplete="off">
        <h2 class="h3">¿Quién eres?</h2>
        ${manual ? `
          <label class="field">
            <span>Correo de la cuenta</span>
            <input name="email" type="email" required placeholder="${esc(ADMIN_EMAIL)}" value="${voters.length ? "" : esc(ADMIN_EMAIL)}" />
          </label>
        ` : `
          <div class="voter-pick" role="radiogroup" aria-label="Votante">
            ${voters.map((v) => `
              <button type="button" role="radio" aria-checked="${selected === v.id}" class="voter-option ${selected === v.id ? "is-selected" : ""}" data-id="${esc(v.id)}">
                <span class="voter-dot lg">${esc(initials(v.name))}</span>
                <span><b>${esc(v.name)}</b><small>${v.role === "profesor" ? "Profesor asesor" : "Equipo"}</small></span>
              </button>`).join("")}
          </div>
        `}
        <label class="field">
          <span>PIN</span>
          <input name="pin" type="password" inputmode="numeric" required minlength="6" placeholder="••••••" autocomplete="current-password" />
        </label>
        <p class="form-error" id="login-error" role="alert"></p>
        <button class="btn btn-primary btn-block" type="submit">Entrar</button>
        ${voters.length ? `<button type="button" class="link-btn" id="toggle-manual">${manual ? "← Elegir de la lista" : "Entrar con correo"}</button>` : `
          <div class="first-run">
            <p class="muted small">Primera vez: aún no hay votantes. Si eres el admin y todavía no tienes cuenta, elige tu PIN arriba y créala aquí.</p>
            <button type="button" class="btn btn-ghost btn-block" id="create-admin">Crear cuenta de admin</button>
          </div>`}
      </form>
    </section>`;

  root.querySelectorAll(".voter-option").forEach((btn) =>
    btn.addEventListener("click", () => {
      selected = btn.dataset.id;
      root.querySelectorAll(".voter-option").forEach((b) => {
        const on = b === btn;
        b.classList.toggle("is-selected", on);
        b.setAttribute("aria-checked", on);
      });
      root.querySelector('input[name="pin"]').focus();
    }),
  );

  root.querySelector("#toggle-manual")?.addEventListener("click", () => {
    manual = !manual;
    render(root);
  });

  const form = root.querySelector("#login-form");

  root.querySelector("#create-admin")?.addEventListener("click", async () => {
    const error = root.querySelector("#login-error");
    const pin = form.pin.value.trim();
    if (form.email.value.trim().toLowerCase() !== ADMIN_EMAIL) {
      error.textContent = `La cuenta de admin debe ser ${ADMIN_EMAIL}.`;
      return;
    }
    if (pin.length < 6) {
      error.textContent = "Elige un PIN de al menos 6 caracteres.";
      return;
    }
    try {
      await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, pin);
    } catch (err) {
      error.textContent = err.code === "auth/email-already-in-use"
        ? "La cuenta de admin ya existe: usa Entrar con tu PIN."
        : friendlyError(err);
    }
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const error = root.querySelector("#login-error");
    const email = manual ? form.email.value.trim().toLowerCase() : selected;
    if (!email) {
      error.textContent = "Elige tu nombre primero.";
      return;
    }
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = "Entrando…";
    error.textContent = "";
    try {
      await signInWithEmailAndPassword(auth, email, form.pin.value.trim());
      selected = null;
    } catch (err) {
      error.textContent = friendlyError(err);
      button.disabled = false;
      button.textContent = "Entrar";
    }
  });
}
