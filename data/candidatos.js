// Candidatos a Group Growth. Edita este archivo y sube los cambios a GitHub.
//
// Campos (todos opcionales salvo id y nombre):
//   id            identificador fijo, minúsculas sin espacios. No lo cambies después de que haya votos.
//   foto          URL de imagen o ruta local, por ejemplo "media/maria.jpg"
//   color         uno de "#FF9900" "#FF57E9" "#00E582" "#42B4FF" "#AD5CFF" "#FFC266" (si no, se asigna solo)
//   redes         linkedin, github, instagram, tiktok, x, facebook, web
//   enlaces       [{ etiqueta, url }] para CV, portafolio, etc.
//   entrevistas   lista de entrevistas (ver ejemplo en el candidato 1)
//
// Entrevistas:
//   audio / video        link de Drive, YouTube, SoundCloud, o archivo en la carpeta media/ ("media/maria-1.mp3")
//   transcripcion        texto directo, o
//   archivoTranscripcion ruta a un .txt en la carpeta transcripciones/ ("transcripciones/maria-1.txt")
//   Formato recomendado por línea:  [00:12] Nombre: lo que dijo

export const candidatos = [
  {
    id: "c1",
    nombre: "Candidato 1",
    carrera: "",
    semestre: "",
    campus: "",
    correo: "",
    telefono: "",
    foto: "",
    bio: "",
    motivacion: "",
    fortalezas: [],
    notas: "",
    redes: { linkedin: "", github: "", instagram: "", tiktok: "", x: "", facebook: "", web: "" },
    enlaces: [],
    entrevistas: [
      {
        titulo: "Entrevista de ejemplo (bórrala)",
        fecha: "2026-10-12",
        modalidad: "virtual", // "virtual" o "presencial"
        duracion: "20 min",
        entrevistadores: "Jean",
        audio: "",
        video: "",
        notas: "Así se ven las notas. Pon aquí impresiones rápidas de la reunión.",
        archivoTranscripcion: "transcripciones/ejemplo.txt",
      },
    ],
  },
  { id: "c2", nombre: "Candidato 2", redes: {}, entrevistas: [] },
  { id: "c3", nombre: "Candidato 3", redes: {}, entrevistas: [] },
  { id: "c4", nombre: "Candidato 4", redes: {}, entrevistas: [] },
  { id: "c5", nombre: "Candidato 5", redes: {}, entrevistas: [] },
  { id: "c6", nombre: "Candidato 6", redes: {}, entrevistas: [] },
];
