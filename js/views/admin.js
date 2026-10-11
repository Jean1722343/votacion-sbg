import { state, results, me } from "../store.js";
import {
  db, doc, setDoc, deleteDoc, writeBatch, collection, getDocs, serverTimestamp, createVoterAccount,
} from "../firebase.js";
import { EMAIL_DOMAIN, ADMIN_EMAIL } from "../firebase-config.js";
import {
  esc, ACCENTS, SOCIALS, slug, toast, confirmDialog, friendlyError, avatar, voterChip,
} from "../ui.js";
import { templateCandidates } from "../seed.js";

let tab = "votacion";
let editingId = null;
let draft = null;
let dirty = false;

export function shouldUpdate(reason) {
  // Nunca re-renderizar a media edición: se perdería lo escrito.
  if (dirty) return false;
  return reason !== "votes" || tab === "votacion";
}

export function render(root) {
  root.innerHTML = `
    <section class="hero hero-compact">
      <div>
        <p class="kicker">&gt;_ Panel de administración</p>
        <h1 class="display sm">Admin</h1>
      </div>
    </section>
    <div class="tabs" role="tablist">
      ${[["votacion", "Votación"], ["candidatos", "Candidatos"], ["votantes", "Votantes"]]
        .map(([k, l]) => `<button role="tab" class="tab ${tab === k ? "is-active" : ""}" aria-selected="${tab === k}" data-tab="${k}">${l}</button>`).join("")}
    </div>
    <div id="admin-body"></div>`;

  root.querySelectorAll(".tab").forEach((b) =>
    b.addEventListener("click", async () => {
      if (dirty && !(await confirmDiscard())) return;
      dirty = false;
      tab = b.dataset.tab;
      render(root);
    }),
  );

  const body = root.querySelector("#admin-body");
  if (tab === "votacion") renderVotacion(body, root);
  if (tab === "candidatos") renderCandidatos(body, root);
  if (tab === "votantes") renderVotantes(body, root);
}

function confirmDiscard() {
  return confirmDialog({
    title: "Cambios sin guardar",
    body: "<p>Tienes cambios sin guardar. ¿Descartarlos?</p>",
    confirm: "Descartar",
    danger: true,
  });
}

// ---------------- Votación ----------------

function renderVotacion(body, root) {
  const r = results();
  const open = state.config.votingOpen;
  const missing = state.config.missing;
  const site = location.href.split("#")[0];
  const selfVoter = me();

  body.innerHTML = `
    ${missing || !selfVoter ? `
      <section class="panel highlight">
        <h2 class="h3">Primeros pasos</h2>
        <ol class="steps">
          <li class="${missing ? "" : "done"}">Inicializar la configuración ${missing ? `<button class="btn btn-primary btn-sm" id="init">Inicializar</button>` : "✓"}</li>
          <li class="${selfVoter ? "done" : ""}">Registrarte como votante ${selfVoter ? "✓" : `<span class="inline-form"><input id="self-name" class="input-sm" placeholder="Tu nombre" value="Jean" /><button class="btn btn-primary btn-sm" id="self-add">Agregarme</button></span>`}</li>
          <li class="${state.candidates.length ? "done" : ""}">Cargar a los candidatos ${state.candidates.length ? "✓" : `<button class="btn btn-ghost btn-sm" data-goto="candidatos">Ir a Candidatos</button>`}</li>
          <li class="${state.voters.length > 1 ? "done" : ""}">Dar de alta al equipo y al profesor ${state.voters.length > 1 ? "✓" : `<button class="btn btn-ghost btn-sm" data-goto="votantes">Ir a Votantes</button>`}</li>
        </ol>
      </section>` : ""}

    <div class="two-col">
      <section class="panel">
        <h2 class="h3">Estado de la votación</h2>
        <p class="status-big ${open ? "is-open" : "is-closed"}">${open ? "Abierta" : "Cerrada"}</p>
        <p class="muted small">${open ? "Los votantes pueden votar y cambiar su voto." : "Nadie puede votar ni cambiar su voto."}</p>
        <button class="btn ${open ? "btn-danger" : "btn-primary"}" id="toggle" ${missing ? "disabled" : ""}>${open ? "Cerrar votación" : "Abrir votación"}</button>
      </section>
      <section class="panel">
        <h2 class="h3">Resumen</h2>
        <dl class="facts">
          <dt>Candidatos</dt><dd>${state.candidates.length}</dd>
          <dt>Votantes</dt><dd>${state.voters.length}</dd>
          <dt>Ya votaron</dt><dd>${r.votedCount} de ${r.voterCount}</dd>
          <dt>Votos emitidos</dt><dd>${r.totalCast} de ${r.totalPossible}</dd>
        </dl>
        <a class="btn btn-ghost btn-sm" href="#/resultados">Ver analítica completa</a>
      </section>
    </div>

    <section class="panel">
      <h2 class="h3">Compartir</h2>
      <p class="muted small">Manda este enlace a cada votante junto con su PIN.</p>
      <div class="copy-row"><input class="input" readonly value="${esc(site)}" /><button class="btn btn-ghost" id="copy-link">Copiar</button></div>
    </section>

    <section class="panel danger-zone">
      <h2 class="h3">Zona de riesgo</h2>
      <p class="muted small">Borra todos los votos registrados (los candidatos y votantes se quedan).</p>
      <button class="btn btn-danger btn-sm" id="reset" ${state.votes.length ? "" : "disabled"}>Borrar todos los votos (${state.votes.length})</button>
    </section>`;

  body.querySelectorAll("[data-goto]").forEach((b) =>
    b.addEventListener("click", () => {
      tab = b.dataset.goto;
      render(root);
    }),
  );

  body.querySelector("#init")?.addEventListener("click", () =>
    run(() => setDoc(doc(db, "config", "app"), { votingOpen: true, title: "Group Growth" }), "Configuración creada"),
  );

  body.querySelector("#self-add")?.addEventListener("click", () => {
    const name = body.querySelector("#self-name").value.trim();
    if (!name) return toast("Escribe tu nombre", "warn");
    run(() => setDoc(doc(db, "voters", state.user.email), {
      name, role: "equipo", isAdmin: state.user.email === ADMIN_EMAIL, createdAt: serverTimestamp(),
    }), "Te agregaste como votante");
  });

  body.querySelector("#toggle").addEventListener("click", async () => {
    const ok = await confirmDialog({
      title: open ? "¿Cerrar la votación?" : "¿Abrir la votación?",
      body: open ? "<p>Los resultados quedan congelados. Puedes reabrirla después.</p>" : "<p>El equipo podrá votar y cambiar su voto.</p>",
      confirm: open ? "Cerrar" : "Abrir",
      danger: open,
    });
    if (ok) run(() => setDoc(doc(db, "config", "app"), { votingOpen: !open }, { merge: true }), open ? "Votación cerrada" : "Votación abierta");
  });

  body.querySelector("#copy-link").addEventListener("click", async () => {
    await navigator.clipboard.writeText(site).catch(() => {});
    toast("Enlace copiado");
  });

  body.querySelector("#reset").addEventListener("click", async () => {
    const ok = await confirmDialog({
      title: "¿Borrar todos los votos?",
      body: "<p>Esto no se puede deshacer.</p>",
      confirm: "Borrar votos",
      danger: true,
    });
    if (!ok) return;
    run(async () => {
      const snap = await getDocs(collection(db, "votes"));
      const batch = writeBatch(db);
      snap.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }, "Votos borrados");
  });
}

// ---------------- Candidatos ----------------

const emptyInterview = () => ({
  title: "", date: new Date().toISOString().slice(0, 10), mode: "virtual", duration: "",
  interviewers: "", audioUrl: "", videoUrl: "", notes: "", transcript: "",
});

function loadDraft(id) {
  editingId = id;
  if (id === "new") {
    draft = {
      name: "", order: state.candidates.length, color: "", career: "", semester: "", campus: "", email: "", phone: "",
      photoUrl: "", bio: "", motivation: "", strengths: [], notes: "", socials: {}, links: [], interviews: [],
    };
  } else {
    const c = state.candidates.find((x) => x.id === id);
    draft = c ? structuredClone({ ...c, id: undefined }) : null;
  }
  dirty = false;
}

function renderCandidatos(body, root) {
  if (!editingId || (editingId !== "new" && !state.candidates.some((c) => c.id === editingId))) {
    if (state.candidates.length) loadDraft(state.candidates[0].id);
    else {
      editingId = null;
      draft = null;
    }
  } else if (!dirty) {
    loadDraft(editingId);
  }

  body.innerHTML = `
    <div class="editor-layout">
      <aside class="panel editor-list">
        <div class="panel-head"><h2 class="h4">Candidatos</h2><button class="btn btn-primary btn-sm" id="new">+ Nuevo</button></div>
        ${state.candidates.length ? `<ul>${state.candidates.map((c, i) => `
          <li><button class="editor-item ${c.id === editingId ? "is-active" : ""}" data-id="${esc(c.id)}">${avatar(c, "sm", i)}<span>${esc(c.name)}</span><small>${(c.interviews || []).length} 🎙</small></button></li>`).join("")}</ul>`
          : `<p class="muted small">No hay candidatos.</p><button class="btn btn-primary btn-block" id="seed">Cargar plantilla (6)</button>`}
      </aside>
      <section class="panel editor">${draft ? editorHtml() : `<p class="muted">Crea un candidato o carga la plantilla.</p>`}</section>
    </div>`;

  body.querySelector("#seed")?.addEventListener("click", () =>
    run(async () => {
      const batch = writeBatch(db);
      for (const c of templateCandidates()) {
        const { id, ...data } = c;
        batch.set(doc(db, "candidates", id), data);
      }
      await batch.commit();
    }, "Plantilla cargada: 6 candidatos"),
  );

  const switchTo = async (id) => {
    if (dirty && !(await confirmDiscard())) return;
    loadDraft(id);
    render(root);
  };
  body.querySelector("#new").addEventListener("click", () => switchTo("new"));
  body.querySelectorAll(".editor-item").forEach((b) => b.addEventListener("click", () => switchTo(b.dataset.id)));

  if (draft) bindEditor(body.querySelector(".editor"), root);
}

function field(label, name, value, { type = "text", textarea = false, rows = 3, placeholder = "", hint = "" } = {}) {
  const input = textarea
    ? `<textarea name="${name}" rows="${rows}" placeholder="${esc(placeholder)}">${esc(value)}</textarea>`
    : `<input name="${name}" type="${type}" value="${esc(value)}" placeholder="${esc(placeholder)}" />`;
  return `<label class="field"><span>${label}</span>${input}${hint ? `<small class="muted">${hint}</small>` : ""}</label>`;
}

function editorHtml() {
  const d = draft;
  return `
    <form id="cand-form" novalidate>
      <div class="panel-head">
        <h2 class="h3">${editingId === "new" ? "Nuevo candidato" : esc(d.name || "Sin nombre")}</h2>
        <div class="row-actions">
          ${editingId !== "new" ? `<a class="btn btn-ghost btn-sm" href="#/c/${esc(editingId)}">Ver perfil</a>` : ""}
          <button type="submit" class="btn btn-primary btn-sm">Guardar</button>
        </div>
      </div>

      <fieldset>
        <legend>Datos básicos</legend>
        <div class="form-grid">
          ${field("Nombre completo *", "name", d.name)}
          ${field("Carrera", "career", d.career, { placeholder: "Ing. en Sistemas" })}
          ${field("Semestre", "semester", d.semester, { placeholder: "5.º semestre" })}
          ${field("Campus / universidad", "campus", d.campus)}
          ${field("Correo", "email", d.email, { type: "email" })}
          ${field("Teléfono", "phone", d.phone)}
          ${field("Foto (URL)", "photoUrl", d.photoUrl, { placeholder: "https://…", hint: "Link directo a una imagen (por ejemplo, la foto de LinkedIn o GitHub)." })}
          <label class="field"><span>Orden</span><input name="order" type="number" min="0" value="${esc(d.order ?? 0)}" /></label>
        </div>
        <div class="field"><span>Color de acento</span>
          <div class="swatches">
            <label class="swatch"><input type="radio" name="color" value="" ${!d.color ? "checked" : ""} /><i class="auto">Auto</i></label>
            ${ACCENTS.map((c) => `<label class="swatch"><input type="radio" name="color" value="${c}" ${d.color === c ? "checked" : ""} /><i style="background:${c}"></i></label>`).join("")}
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend>Perfil</legend>
        ${field("Bio corta", "bio", d.bio, { textarea: true, rows: 3 })}
        ${field("Motivación: ¿por qué Group Growth?", "motivation", d.motivation, { textarea: true, rows: 4 })}
        ${field("Fortalezas", "strengths", (d.strengths || []).join(", "), { placeholder: "Diseño, Redes, Oratoria", hint: "Separadas por comas." })}
        ${field("Notas del equipo", "notes", d.notes, { textarea: true, rows: 3 })}
      </fieldset>

      <fieldset>
        <legend>Redes sociales</legend>
        <div class="form-grid">
          ${SOCIALS.map((s) => field(s.label, `social.${s.key}`, d.socials?.[s.key] || "", { placeholder: "https://…" })).join("")}
        </div>
        ${field("Otros enlaces", "links", (d.links || []).map((l) => `${l.label} | ${l.url}`).join("\n"), { textarea: true, rows: 3, placeholder: "CV | https://…\nPortafolio | https://…", hint: "Uno por línea: Etiqueta | URL" })}
      </fieldset>

      <fieldset>
        <legend>Entrevistas</legend>
        <p class="muted small">Sube el audio a Google Drive (compartido como "cualquiera con el enlace"), YouTube (oculto) o SoundCloud y pega el enlace. Para la transcripción usa el formato <code>[00:12] Nombre: texto</code> para que se vea por hablante.</p>
        <div id="interviews">
          ${(d.interviews || []).map((iv, i) => `
            <div class="iv-edit" data-i="${i}">
              <div class="panel-head"><h3 class="h4">Entrevista ${i + 1}</h3><button type="button" class="btn btn-ghost btn-sm" data-remove="${i}">Quitar</button></div>
              <div class="form-grid">
                ${field("Título", `iv.${i}.title`, iv.title, { placeholder: "Entrevista inicial" })}
                ${field("Fecha", `iv.${i}.date`, iv.date, { type: "date" })}
                <label class="field"><span>Modalidad</span>
                  <select name="iv.${i}.mode">
                    <option value="virtual" ${iv.mode !== "presencial" ? "selected" : ""}>Virtual</option>
                    <option value="presencial" ${iv.mode === "presencial" ? "selected" : ""}>Presencial</option>
                  </select>
                </label>
                ${field("Duración", `iv.${i}.duration`, iv.duration, { placeholder: "25 min" })}
                ${field("Entrevistadores", `iv.${i}.interviewers`, iv.interviewers, { placeholder: "Jean, Ana" })}
                ${field("Audio (URL)", `iv.${i}.audioUrl`, iv.audioUrl, { placeholder: "Drive / SoundCloud / .mp3" })}
                ${field("Video (URL)", `iv.${i}.videoUrl`, iv.videoUrl, { placeholder: "YouTube / Drive" })}
              </div>
              ${field("Notas", `iv.${i}.notes`, iv.notes, { textarea: true, rows: 2 })}
              ${field("Transcripción", `iv.${i}.transcript`, iv.transcript, { textarea: true, rows: 8, placeholder: "[00:00] Jean: …\n[00:10] Candidato: …" })}
            </div>`).join("")}
        </div>
        <button type="button" class="btn btn-ghost" id="add-iv">+ Agregar entrevista</button>
      </fieldset>

      <div class="form-foot">
        ${editingId !== "new" ? `<button type="button" class="btn btn-danger btn-sm" id="delete">Eliminar candidato</button>` : "<span></span>"}
        <button type="submit" class="btn btn-primary">Guardar cambios</button>
      </div>
    </form>`;
}

function readForm(form) {
  const fd = new FormData(form);
  const get = (k) => String(fd.get(k) ?? "").trim();
  const socials = {};
  for (const s of SOCIALS) socials[s.key] = get(`social.${s.key}`);
  const interviews = [...form.querySelectorAll(".iv-edit")].map((el) => {
    const i = el.dataset.i;
    const iv = {};
    for (const k of Object.keys(emptyInterview())) iv[k] = String(fd.get(`iv.${i}.${k}`) ?? "").trim();
    return iv;
  });
  return {
    name: get("name"),
    order: Number(get("order")) || 0,
    color: get("color"),
    career: get("career"),
    semester: get("semester"),
    campus: get("campus"),
    email: get("email"),
    phone: get("phone"),
    photoUrl: get("photoUrl"),
    bio: get("bio"),
    motivation: get("motivation"),
    strengths: get("strengths").split(",").map((s) => s.trim()).filter(Boolean),
    notes: get("notes"),
    socials,
    links: get("links").split("\n").map((line) => {
      const [label, ...rest] = line.split("|");
      const url = rest.join("|").trim() || label.trim();
      return { label: rest.length ? label.trim() : "", url };
    }).filter((l) => l.url),
    interviews,
  };
}

function bindEditor(section, root) {
  const form = section.querySelector("#cand-form");
  form.addEventListener("input", () => (dirty = true));

  section.querySelector("#add-iv").addEventListener("click", () => {
    draft = readForm(form);
    draft.interviews.push(emptyInterview());
    dirty = true;
    section.innerHTML = editorHtml();
    bindEditor(section, root);
    section.querySelector(".iv-edit:last-child")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  section.querySelectorAll("[data-remove]").forEach((b) =>
    b.addEventListener("click", async () => {
      const ok = await confirmDialog({ title: "¿Quitar esta entrevista?", body: "<p>Se elimina al guardar.</p>", confirm: "Quitar", danger: true });
      if (!ok) return;
      draft = readForm(form);
      draft.interviews.splice(Number(b.dataset.remove), 1);
      dirty = true;
      section.innerHTML = editorHtml();
      bindEditor(section, root);
    }),
  );

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = readForm(form);
    if (!data.name) return toast("El nombre es obligatorio", "warn");
    const id = editingId === "new" ? `${slug(data.name).slice(0, 24) || "cand"}-${Date.now().toString(36).slice(-4)}` : editingId;
    try {
      await setDoc(doc(db, "candidates", id), { ...data, updatedAt: serverTimestamp() });
      dirty = false;
      editingId = id;
      toast("Guardado");
      render(root);
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  });

  section.querySelector("#delete")?.addEventListener("click", async () => {
    const ok = await confirmDialog({
      title: `¿Eliminar a ${draft.name}?`,
      body: "<p>Se borra su perfil y sus entrevistas. Los votos que tenga dejarán de contar.</p>",
      confirm: "Eliminar",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteDoc(doc(db, "candidates", editingId));
      dirty = false;
      editingId = null;
      toast("Candidato eliminado");
      render(root);
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  });
}

// ---------------- Votantes ----------------

function randomPin() {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 900000;
  return String(100000 + n);
}

function renderVotantes(body, root) {
  const votedIds = new Set(state.votes.map((v) => v.id));
  body.innerHTML = `
    <div class="two-col wide-left">
      <section class="panel">
        <div class="panel-head"><h2 class="h3">Votantes</h2><span class="tag">${state.voters.length}</span></div>
        ${state.voters.length ? `<ul class="voter-list">${state.voters.map((v) => `
          <li>
            ${voterChip(v.name)}
            <span class="muted small mono">${esc(v.id)}</span>
            <span class="tag tag-sm">${v.role === "profesor" ? "Profesor" : "Equipo"}</span>
            ${v.isAdmin ? `<span class="tag tag-sm tag-accent">Admin</span>` : ""}
            <span class="tag tag-sm ${votedIds.has(v.id) ? "tag-mint" : ""}">${votedIds.has(v.id) ? "Votó" : "Pendiente"}</span>
            ${v.id !== state.user.email ? `<button class="btn btn-ghost btn-sm" data-del="${esc(v.id)}">Quitar</button>` : `<span class="muted small">(tú)</span>`}
          </li>`).join("")}</ul>` : `<p class="muted">Aún no hay votantes.</p>`}
        <p class="muted small">Para cambiar el PIN de alguien: Firebase Console → Authentication → usuario → Restablecer contraseña, o quítalo y vuelve a darlo de alta con otro nombre.</p>
      </section>

      <section class="panel">
        <h2 class="h3">Dar de alta</h2>
        <form id="voter-form" class="stack">
          ${field("Nombre", "name", "", { placeholder: "Ana López" })}
          <label class="field"><span>Rol</span>
            <select name="role"><option value="equipo">Equipo</option><option value="profesor">Profesor asesor</option></select>
          </label>
          <label class="field"><span>PIN (mín. 6 dígitos)</span>
            <span class="copy-row"><input name="pin" value="${randomPin()}" minlength="6" required /><button type="button" class="btn btn-ghost btn-sm" id="regen">↻</button></span>
          </label>
          <label class="check"><input type="checkbox" name="isAdmin" /> También es admin</label>
          <p class="muted small">Correo de acceso: <span class="mono" id="email-preview">—</span></p>
          <button class="btn btn-primary btn-block">Crear votante</button>
        </form>
      </section>
    </div>`;

  const form = body.querySelector("#voter-form");
  const emailFor = (name) => `${slug(name.split(" ")[0]) || "votante"}@${EMAIL_DOMAIN}`;
  const preview = () => {
    const name = form.name.value.trim();
    let email = emailFor(name);
    if (state.voters.some((v) => v.id === email)) email = `${slug(name) || "votante"}@${EMAIL_DOMAIN}`;
    body.querySelector("#email-preview").textContent = name ? email : "—";
    return email;
  };
  form.name.addEventListener("input", preview);
  body.querySelector("#regen").addEventListener("click", () => (form.pin.value = randomPin()));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = form.name.value.trim();
    const pin = form.pin.value.trim();
    if (!name) return toast("Escribe el nombre", "warn");
    if (pin.length < 6) return toast("El PIN debe tener al menos 6 caracteres", "warn");
    const email = preview();
    const button = form.querySelector("button:not([type])");
    button.disabled = true;
    button.textContent = "Creando…";
    try {
      let reused = false;
      try {
        await createVoterAccount(email, pin);
      } catch (err) {
        if (err.code !== "auth/email-already-in-use") throw err;
        reused = true;
      }
      await setDoc(doc(db, "voters", email), {
        name, role: form.role.value, isAdmin: form.isAdmin.checked, createdAt: serverTimestamp(),
      });
      const site = location.href.split("#")[0];
      const message = `Hola ${name.split(" ")[0]} 👋 Ya puedes votar por Group Growth del AWS Student Builder Group.\n\n1) Entra a ${site}\n2) Elige tu nombre: ${name}\n3) Tu PIN: ${reused ? "(el que ya tenías)" : pin}\n\nTienes 2 votos para 2 personas distintas.`;
      await confirmDialog({
        title: `${name} dado de alta`,
        body: `${reused ? `<p class="banner banner-warn">Ya existía una cuenta con ${esc(email)}; se conservó su PIN anterior.</p>` : ""}
          <p>Envíale este mensaje (cópialo ahora, el PIN no se vuelve a mostrar):</p>
          <textarea class="input" rows="7" readonly id="share-msg">${esc(message)}</textarea>`,
        confirm: "Copiar y cerrar",
        cancel: "Cerrar",
      }).then(async (copy) => {
        if (copy) {
          await navigator.clipboard.writeText(message).catch(() => {});
          toast("Mensaje copiado");
        }
      });
      render(root);
    } catch (err) {
      toast(friendlyError(err), "error");
      button.disabled = false;
      button.textContent = "Crear votante";
    }
  });

  body.querySelectorAll("[data-del]").forEach((b) =>
    b.addEventListener("click", async () => {
      const id = b.dataset.del;
      const v = state.voters.find((x) => x.id === id);
      const ok = await confirmDialog({
        title: `¿Quitar a ${v?.name}?`,
        body: "<p>Ya no podrá entrar ni votar, y su voto (si existe) se elimina.</p>",
        confirm: "Quitar",
        danger: true,
      });
      if (!ok) return;
      run(async () => {
        const batch = writeBatch(db);
        batch.delete(doc(db, "voters", id));
        batch.delete(doc(db, "votes", id));
        await batch.commit();
      }, "Votante quitado");
    }),
  );
}

async function run(fn, message) {
  try {
    await fn();
    toast(message);
  } catch (err) {
    toast(friendlyError(err), "error");
  }
}
