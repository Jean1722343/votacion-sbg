// Plantilla inicial: 6 candidatos vacíos para llenar desde Admin.
// El primero trae una entrevista de ejemplo que muestra el formato de transcripción.

const blank = (n) => ({
  name: `Candidato ${n}`,
  order: n - 1,
  career: "",
  semester: "",
  campus: "",
  email: "",
  phone: "",
  photoUrl: "",
  bio: "",
  motivation: "",
  strengths: [],
  notes: "",
  socials: { linkedin: "", github: "", instagram: "", tiktok: "", x: "", facebook: "", web: "" },
  links: [],
  interviews: [],
});

export function templateCandidates() {
  const list = Array.from({ length: 6 }, (_, i) => ({ id: `c${i + 1}`, ...blank(i + 1) }));
  list[0].interviews = [
    {
      title: "Entrevista de ejemplo (bórrala)",
      date: new Date().toISOString().slice(0, 10),
      mode: "virtual",
      duration: "20 min",
      interviewers: "Jean",
      audioUrl: "",
      videoUrl: "",
      notes: "Así se ven las notas. Puedes pegar aquí impresiones rápidas de la reunión.",
      transcript: [
        "[00:00] Jean: Gracias por venir. Cuéntanos por qué te interesa Community Growth.",
        "[00:12] Candidato: Me gusta organizar eventos y hacer crecer comunidades en mi universidad.",
        "[00:40] Jean: ¿Qué harías en tu primer mes?",
        "[00:45] Candidato: Lanzaría una campaña en redes y un taller introductorio de AWS.",
      ].join("\n"),
    },
  ];
  return list;
}
