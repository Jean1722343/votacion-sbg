// Configuración de la votación. Edita y sube los cambios a GitHub.

// Ponla en false para cerrar la votación (ya nadie podrá votar ni cambiar su voto).
export const votacionAbierta = true;

// Quién puede ver los resultados (conteos y quién votó por quién). Nadie más los ve.
// Si lo cambias, cambia también el id escrito en firestore.rules.
export const admin = "jean";

// Quiénes votan. El `id` no debe cambiar una vez que alguien creó su contraseña o votó.
// Usa solo minúsculas, números y guiones en el id.
export const votantes = [
  { id: "jean", nombre: "Jean", rol: "equipo" },
  { id: "joan", nombre: "Joan", rol: "equipo" },
  { id: "jeovanni", nombre: "Jeovanni", rol: "equipo" },
  { id: "geronimo", nombre: "Gerónimo", rol: "equipo" },
  { id: "tutora", nombre: "Tutora", rol: "tutora" },
];
