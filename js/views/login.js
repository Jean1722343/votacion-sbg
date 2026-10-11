import { state, isClaimed, createAccount, signIn } from "../store.js";
import { VOTES_PER_VOTER, MIN_PASSWORD } from "../firebase-config.js";
import { esc, initials, friendlyError } from "../ui.js";

let selected = null;
// Si la cuenta existe pero aún no aparece como reclamada, forzamos el modo "entrar".
let forceSignIn = false;

export function shouldUpdate() {
  // Con un nombre elegido no re-renderizamos: se borraría lo que la persona está escribiendo.
  return !selected;
}

export function render(root) {
  if (selected && !state.voters.some((v) => v.id === selected)) selected = null;
  root.innerHTML = `
    <section class="login">
      <div class="login-hero">
        <p class="kicker">&gt;_ AWS Student Builder Group</p>
        <h1 class="display">Elegimos al <span class="grad">Core Team</span></h1>
        <p class="lead">Cada integrante del equipo y la tutora tienen <b>${VOTES_PER_VOTER} votos</b> para repartir entre candidatos distintos. Los dos con más votos ocupan el 1.º y 2.º lugar.</p>
        <ol class="login-steps">
          <li><span>01</span><div><b>Toca tu nombre</b><small>La primera vez creas tu contraseña.</small></div></li>
          <li><span>02</span><div><b>Revisa a los candidatos</b><small>Perfiles, redes y entrevistas con audio y transcripción.</small></div></li>
          <li><span>03</span><div><b>Vota por 2 personas</b><small>Puedes cambiar tu voto mientras siga abierta.</small></div></li>
        </ol>
      </div>
      <div class="panel login-card" id="login-card">
        ${selected ? passwordStep() : nameStep()}
      </div>
    </section>`;

  const card = root.querySelector("#login-card");
  if (selected) bindPasswordStep(root, card);
  else bindNameStep(root, card);
}

// ---------- Paso 1: elegir nombre ----------

function nameStep() {
  return `
    <h2 class="h3">¿Quién eres?</h2>
    <p class="muted small">Toca tu nombre para continuar.</p>
    <div class="voter-pick" role="list">
      ${state.voters.map((v) => {
        const claimed = isClaimed(v.id);
        return `
        <button type="button" class="voter-option" data-id="${esc(v.id)}" role="listitem">
          <span class="voter-dot lg">${esc(initials(v.name))}</span>
          <span class="voter-text"><b>${esc(v.name)}</b><small>${esc(v.roleLabel)}</small></span>
          <span class="tag tag-sm ${claimed ? "" : "tag-accent"}">${claimed ? "🔒 Con contraseña" : "✨ Primera vez"}</span>
          <span class="chev" aria-hidden="true">›</span>
        </button>`;
      }).join("")}
    </div>`;
}

function bindNameStep(root, card) {
  card.querySelectorAll(".voter-option").forEach((btn) =>
    btn.addEventListener("click", () => {
      selected = btn.dataset.id;
      forceSignIn = false;
      render(root);
    }),
  );
}

// ---------- Paso 2: contraseña ----------

function passwordStep() {
  const voter = state.voters.find((v) => v.id === selected);
  const first = voter.name.split(" ")[0];
  const creating = !isClaimed(selected) && !forceSignIn;
  return `
    <button type="button" class="link-btn back" id="back">← No soy ${esc(first)}</button>
    <div class="who">
      <span class="voter-dot xl">${esc(initials(voter.name))}</span>
      <div>
        <h2 class="h3">Hola, ${esc(first)} 👋</h2>
        <p class="muted small">${creating ? "Es tu primera vez. Crea una contraseña que solo tú sepas." : "Escribe tu contraseña para entrar."}</p>
      </div>
    </div>
    <form id="pw-form" novalidate>
      <label class="field">
        <span>${creating ? "Crea tu contraseña" : "Contraseña"}</span>
        <span class="pw-wrap">
          <input name="pw" type="password" required minlength="${MIN_PASSWORD}"
            autocomplete="${creating ? "new-password" : "current-password"}" autofocus />
          <button type="button" class="pw-toggle" data-toggle aria-label="Mostrar contraseña">Ver</button>
        </span>
      </label>
      ${creating ? `
        <div class="strength" aria-live="polite"><i></i><span>Escribe al menos ${MIN_PASSWORD} caracteres</span></div>
        <label class="field">
          <span>Repítela</span>
          <span class="pw-wrap"><input name="pw2" type="password" required autocomplete="new-password" /></span>
        </label>
        <ul class="checks">
          <li data-check="len">Mínimo ${MIN_PASSWORD} caracteres</li>
          <li data-check="match">Las dos coinciden</li>
        </ul>` : ""}
      <p class="form-error" id="pw-error" role="alert"></p>
      <button class="btn btn-primary btn-block" type="submit" ${creating ? "disabled" : ""}>${creating ? "Crear contraseña y entrar" : "Entrar"}</button>
      <p class="muted small hint">${creating
        ? "Guárdala bien. Si la olvidas, Jean tendrá que restablecerla desde Firebase."
        : "¿La olvidaste? Pídele a Jean que la restablezca."}</p>
    </form>`;
}

function strength(pw) {
  let score = 0;
  if (pw.length >= MIN_PASSWORD) score++;
  if (pw.length >= 10) score++;
  if (/[a-zA-Z]/.test(pw) && /\d/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw) || (/[a-z]/.test(pw) && /[A-Z]/.test(pw))) score++;
  return score;
}
const LEVELS = [
  ["Muy corta", "var(--danger)"],
  ["Débil", "var(--danger)"],
  ["Aceptable", "var(--amber)"],
  ["Buena", "var(--blue)"],
  ["Fuerte", "var(--mint)"],
];

function bindPasswordStep(root, card) {
  const form = card.querySelector("#pw-form");
  const error = card.querySelector("#pw-error");
  const submit = form.querySelector('button[type="submit"]');
  const creating = Boolean(form.pw2);

  card.querySelector("#back").addEventListener("click", () => {
    selected = null;
    render(root);
  });
  root.ownerDocument.onkeydown = (e) => {
    if (e.key === "Escape" && selected) {
      selected = null;
      render(root);
    }
  };

  card.querySelector("[data-toggle]").addEventListener("click", (e) => {
    const show = form.pw.type === "password";
    for (const input of [form.pw, form.pw2].filter(Boolean)) input.type = show ? "text" : "password";
    e.currentTarget.textContent = show ? "Ocultar" : "Ver";
    e.currentTarget.setAttribute("aria-label", show ? "Ocultar contraseña" : "Mostrar contraseña");
  });

  const validate = () => {
    if (!creating) return form.pw.value.length > 0;
    const pw = form.pw.value;
    const okLen = pw.length >= MIN_PASSWORD;
    const okMatch = okLen && pw === form.pw2.value;
    const score = pw ? strength(pw) : 0;
    const bar = card.querySelector(".strength");
    bar.style.setProperty("--w", `${(score / 4) * 100}%`);
    bar.style.setProperty("--c", LEVELS[score][1]);
    bar.querySelector("span").textContent = pw ? `Seguridad: ${LEVELS[score][0]}` : `Escribe al menos ${MIN_PASSWORD} caracteres`;
    card.querySelector('[data-check="len"]').classList.toggle("ok", okLen);
    card.querySelector('[data-check="match"]').classList.toggle("ok", okMatch);
    return okMatch;
  };

  form.addEventListener("input", () => {
    error.textContent = "";
    submit.disabled = !validate();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validate()) return;
    const id = selected;
    submit.disabled = true;
    submit.textContent = creating ? "Creando…" : "Entrando…";
    try {
      if (creating) await createAccount(id, form.pw.value);
      else await signIn(id, form.pw.value);
      selected = null;
      root.ownerDocument.onkeydown = null;
    } catch (err) {
      if (creating && err.code === "auth/email-already-in-use") {
        // Ya tenía contraseña: pasamos a pedirla.
        forceSignIn = true;
        render(root);
        root.querySelector("#pw-error").textContent = "Este nombre ya tiene contraseña. Escríbela para entrar.";
        return;
      }
      error.textContent = err.code === "auth/invalid-credential" || err.code === "auth/wrong-password"
        ? "Contraseña incorrecta. Revisa mayúsculas y vuelve a intentar."
        : friendlyError(err);
      submit.disabled = false;
      submit.textContent = creating ? "Crear contraseña y entrar" : "Entrar";
      form.pw.select();
    }
  });
}
