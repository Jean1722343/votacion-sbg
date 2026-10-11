export function render(root) {
  root.innerHTML = `
    <section class="panel center narrow">
      <p class="kicker">&gt;_ Configuración pendiente</p>
      <h1 class="h2">Falta conectar Firebase</h1>
      <p class="muted">Pega la configuración de tu web app de Firebase en <code>js/firebase-config.js</code> y recarga la página. Los pasos están en el README del repositorio.</p>
    </section>`;
}
