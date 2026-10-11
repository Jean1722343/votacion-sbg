import { state, start, subscribe, me, myVote, signOut, changePassword } from "./store.js";
import { MIN_PASSWORD } from "./firebase-config.js";
import { esc, initials, toast, friendlyError } from "./ui.js";
import * as loginView from "./views/login.js";
import * as candidatosView from "./views/candidatos.js";
import * as perfilView from "./views/perfil.js";
import * as votarView from "./views/votar.js";
import * as resultadosView from "./views/resultados.js";

const root = document.getElementById("app");
const topbar = document.getElementById("topbar");

const ROUTES = [
  { pattern: /^$/, view: candidatosView, nav: "" },
  { pattern: /^c\/([\w-]+)$/, view: perfilView, nav: "" },
  { pattern: /^votar$/, view: votarView, nav: "votar" },
  { pattern: /^resultados$/, view: resultadosView, nav: "resultados" },
];

let current = null;

function parseHash() {
  const path = location.hash.replace(/^#\/?/, "").replace(/\/$/, "");
  for (const route of ROUTES) {
    const m = path.match(route.pattern);
    if (m) return { route, params: m.slice(1) };
  }
  return { route: ROUTES[0], params: [] };
}

function renderTopbar(navKey) {
  const voter = me();
  if (!voter) {
    topbar.hidden = true;
    return;
  }
  const voted = Boolean(myVote());
  const open = state.config.votingOpen;
  const link = (key, label, extra = "") =>
    `<a href="#/${key}" class="nav-link ${navKey === key ? "is-active" : ""}" ${navKey === key ? 'aria-current="page"' : ""}>${label}${extra}</a>`;
  topbar.hidden = false;
  topbar.innerHTML = `
    <div class="topbar-inner">
      <a href="#/" class="brand" aria-label="Inicio">
        <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
        <span class="brand-text"><b>Student Builder Group</b><small>Group Growth · Votación</small></span>
      </a>
      <nav class="nav" aria-label="Principal">
        ${link("", "Candidatos")}
        ${link("votar", "Votar", voted ? ' <span class="nav-badge ok">✓</span>' : open ? ' <span class="nav-badge">2</span>' : "")}
        ${link("resultados", "Resultados")}
      </nav>
      <div class="me">
        <span class="status-pill ${open ? "is-open" : "is-closed"}" title="Estado de la votación">${open ? "Abierta" : "Cerrada"}</span>
        <div class="menu">
          <button class="me-btn" id="me-btn" aria-haspopup="menu" aria-expanded="false">
            <span class="me-avatar">${esc(initials(voter.name))}</span>
            <span class="me-name">${esc(voter.name.split(" ")[0])}</span>
            <span aria-hidden="true">▾</span>
          </button>
          <div class="menu-list" role="menu" hidden>
            <p class="menu-head"><b>${esc(voter.name)}</b><small>${voter.role === "profesor" ? "Profesor asesor" : "Equipo"}</small></p>
            <button role="menuitem" data-act="password">🔑 Cambiar contraseña</button>
            <button role="menuitem" data-act="logout">↩ Salir</button>
          </div>
        </div>
      </div>
    </div>`;

  const btn = topbar.querySelector("#me-btn");
  const list = topbar.querySelector(".menu-list");
  const close = () => {
    list.hidden = true;
    btn.setAttribute("aria-expanded", "false");
  };
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    list.hidden = !list.hidden;
    btn.setAttribute("aria-expanded", String(!list.hidden));
  });
  list.querySelector('[data-act="logout"]').addEventListener("click", () => {
    close();
    signOut();
  });
  list.querySelector('[data-act="password"]').addEventListener("click", () => {
    close();
    openPasswordDialog();
  });
}

function openPasswordDialog() {
  const dialog = document.getElementById("dialog");
  dialog.innerHTML = `
    <form class="dialog-card" id="pw-change" novalidate>
      <h3>Cambiar contraseña</h3>
      <label class="field"><span>Contraseña actual</span><input name="current" type="password" autocomplete="current-password" required /></label>
      <label class="field"><span>Nueva contraseña</span><input name="next" type="password" autocomplete="new-password" minlength="${MIN_PASSWORD}" required /></label>
      <label class="field"><span>Repite la nueva</span><input name="next2" type="password" autocomplete="new-password" required /></label>
      <p class="form-error" role="alert"></p>
      <div class="dialog-actions">
        <button type="button" class="btn btn-ghost" value="cancel">Cancelar</button>
        <button type="submit" class="btn btn-primary">Guardar</button>
      </div>
    </form>`;
  dialog.showModal();
  const form = dialog.querySelector("form");
  const error = form.querySelector(".form-error");
  form.querySelector('[value="cancel"]').addEventListener("click", () => dialog.close());
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (form.next.value.length < MIN_PASSWORD) return (error.textContent = `Mínimo ${MIN_PASSWORD} caracteres.`);
    if (form.next.value !== form.next2.value) return (error.textContent = "Las contraseñas nuevas no coinciden.");
    try {
      await changePassword(form.current.value, form.next.value);
      dialog.close();
      toast("Contraseña actualizada");
    } catch (err) {
      error.textContent = err.code === "auth/invalid-credential" || err.code === "auth/wrong-password"
        ? "La contraseña actual no es correcta."
        : friendlyError(err);
    }
  });
}

function render(reason = "nav") {
  if (!state.authReady || !state.claimedReady) return;
  if (!me()) {
    renderTopbar();
    mount(loginView, [], reason);
    return;
  }
  const { route, params } = parseHash();
  renderTopbar(route.nav);
  if (state.error) {
    current = null;
    root.innerHTML = `<section class="panel center narrow"><h1 class="h2">Ups</h1><p class="muted">${esc(state.error)}</p></section>`;
    return;
  }
  mount(route.view, params, reason);
}

function mount(view, params, reason) {
  const key = params.join("/");
  const same = current && current.view === view && current.key === key;
  if (same && reason !== "nav" && view.shouldUpdate && !view.shouldUpdate(reason)) return;
  if (!same) window.scrollTo({ top: 0 });
  current = { view, key };
  view.render(root, { params, reason, fresh: !same });
}

// Cierra el menú de cuenta al tocar fuera de él o con Escape.
document.addEventListener("click", (e) => {
  if (!e.target.closest(".menu")) topbar.querySelector(".menu-list")?.setAttribute("hidden", "");
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") topbar.querySelector(".menu-list")?.setAttribute("hidden", "");
});

window.addEventListener("hashchange", () => render("nav"));
subscribe((reason) => render(reason));
start();
