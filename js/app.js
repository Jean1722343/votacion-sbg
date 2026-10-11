import { state, start, subscribe, me, myVote, signOut } from "./store.js";
import { esc, initials } from "./ui.js";
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
        <span class="me-avatar" title="${esc(voter.name)}">${esc(initials(voter.name))}</span>
        <button class="btn btn-ghost btn-sm" id="logout">Salir</button>
      </div>
    </div>`;
  topbar.querySelector("#logout").addEventListener("click", signOut);
}

function render(reason = "nav") {
  if (!me()) {
    renderTopbar();
    current = null;
    loginView.render(root);
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

window.addEventListener("hashchange", () => render("nav"));
subscribe((reason) => render(reason));
start();
