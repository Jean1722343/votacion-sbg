// Genera privado/candidatos.json a partir de privado/candidatos.js,
// metiendo dentro el texto de las transcripciones de privado/transcripciones/.
// Ese JSON se sube desde la web como Jean (Resultados → Datos de candidatos) y queda
// en Firestore, visible solo para los votantes con sesión. Nada de esto va a GitHub.
//
// Uso:  node tools/candidatos.mjs
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const privado = path.join(root, "privado");
const { candidatos } = await import(pathToFileURL(path.join(privado, "candidatos.js")).href + `?t=${Date.now()}`);

const ids = new Set();
const out = [];
for (const [i, c] of candidatos.entries()) {
  if (!/^[a-z0-9-]{1,40}$/.test(c.id || "")) throw new Error(`id inválido en el candidato ${i + 1}: "${c.id}"`);
  if (ids.has(c.id)) throw new Error(`id repetido: ${c.id}`);
  ids.add(c.id);
  const entrevistas = [];
  for (const e of c.entrevistas || []) {
    let transcripcion = e.transcripcion || "";
    if (!transcripcion && e.archivoTranscripcion) {
      const file = path.join(privado, "transcripciones", path.basename(e.archivoTranscripcion));
      transcripcion = (await readFile(file, "utf8")).trim();
    }
    const { archivoTranscripcion, ...rest } = e;
    entrevistas.push({ ...rest, transcripcion });
  }
  // Firestore no admite listas dentro de listas: [pregunta, respuesta] → { pregunta, respuesta }.
  const postulacion = c.postulacion && {
    ...c.postulacion,
    respuestas: (c.postulacion.respuestas || []).map((r) => (Array.isArray(r) ? { pregunta: r[0], respuesta: r[1] } : r)),
  };
  out.push({ ...c, ...(postulacion ? { postulacion } : {}), orden: i, entrevistas });
}

const data = { generado: new Date().toISOString(), candidatos: out };
const json = JSON.stringify(data, null, 2);
if (Buffer.byteLength(json) > 900_000) console.warn("Ojo: el archivo pesa más de 900 KB; Firestore admite ~1 MB por candidato.");
await writeFile(path.join(privado, "candidatos.json"), json, "utf8");
console.log(`privado/candidatos.json listo: ${out.length} candidatos, ${out.reduce((n, c) => n + c.entrevistas.length, 0)} entrevistas.`);
