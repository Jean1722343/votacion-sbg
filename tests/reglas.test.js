// Pruebas de las reglas de Firestore contra el emulador local (no toca el proyecto real).
// Correr con:  cd tests && npm run test:reglas
import { readFileSync } from "node:fs";
import { after, before, beforeEach, describe, test } from "node:test";
import {
  assertFails, assertSucceeds, initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc,
} from "firebase/firestore";

let env;

const as = (id) => env.authenticatedContext(`uid-${id}`, { email: `${id}@sbg-vota.app` }).firestore();
const anon = () => env.unauthenticatedContext().firestore();
const vote = (picks, extra = {}) => ({
  voterName: "X", picks, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...extra,
});

before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-votacion",
    firestore: {
      rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});
after(() => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  // Votos ya existentes de Joan y Jeovanni, escritos sin reglas.
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "votes/joan"), { voterName: "Joan", picks: ["c1", "c2"] });
    await setDoc(doc(db, "votes/jeovanni"), { voterName: "Jeovanni", picks: ["c3", "c4"] });
  });
});

describe("Resultados privados: solo Jean ve todos los votos", () => {
  test("Jean puede listar todos los votos", async () => {
    await assertSucceeds(getDocs(collection(as("jean"), "votes")));
  });
  test("Jean puede leer el voto de cualquiera", async () => {
    await assertSucceeds(getDoc(doc(as("jean"), "votes/jeovanni")));
  });
  test("Joan NO puede listar los votos", async () => {
    await assertFails(getDocs(collection(as("joan"), "votes")));
  });
  test("Joan NO puede leer el voto de Jeovanni", async () => {
    await assertFails(getDoc(doc(as("joan"), "votes/jeovanni")));
  });
  test("Joan sí puede leer su propio voto", async () => {
    await assertSucceeds(getDoc(doc(as("joan"), "votes/joan")));
  });
  test("La tutora NO puede listar los votos", async () => {
    await assertFails(getDocs(collection(as("tutora"), "votes")));
  });
  test("Sin sesión NO se puede leer ningún voto", async () => {
    await assertFails(getDocs(collection(anon(), "votes")));
    await assertFails(getDoc(doc(anon(), "votes/joan")));
  });
  test("Un correo parecido a Jean de otro dominio NO ve los resultados", async () => {
    const fake = env.authenticatedContext("uid-x", { email: "jean@otro.com" }).firestore();
    await assertFails(getDocs(collection(fake, "votes")));
  });
});

describe("Votar: 2 candidatos distintos y solo a tu nombre", () => {
  test("Gerónimo puede votar por 2 candidatos distintos", async () => {
    await assertSucceeds(setDoc(doc(as("geronimo"), "votes/geronimo"), vote(["c1", "c5"])));
  });
  test("NO se puede votar 2 veces por la misma persona", async () => {
    await assertFails(setDoc(doc(as("geronimo"), "votes/geronimo"), vote(["c1", "c1"])));
  });
  test("NO se puede votar por 1 ni por 3", async () => {
    await assertFails(setDoc(doc(as("geronimo"), "votes/geronimo"), vote(["c1"])));
    await assertFails(setDoc(doc(as("geronimo"), "votes/geronimo"), vote(["c1", "c2", "c3"])));
  });
  test("NO se puede votar a nombre de otro", async () => {
    await assertFails(setDoc(doc(as("geronimo"), "votes/joan"), vote(["c5", "c6"])));
  });
  test("Ni Jean puede escribir el voto de otro", async () => {
    await assertFails(setDoc(doc(as("jean"), "votes/joan"), vote(["c5", "c6"])));
  });
  test("NO se aceptan campos extra", async () => {
    await assertFails(setDoc(doc(as("geronimo"), "votes/geronimo"), vote(["c1", "c2"], { trampa: 1 })));
  });
  test("Sin sesión NO se puede votar", async () => {
    await assertFails(setDoc(doc(anon(), "votes/geronimo"), vote(["c1", "c2"])));
  });
  test("Joan puede cambiar y retirar su voto", async () => {
    await assertSucceeds(setDoc(doc(as("joan"), "votes/joan"), vote(["c5", "c6"])));
    await assertSucceeds(deleteDoc(doc(as("joan"), "votes/joan")));
  });
  test("Joan NO puede borrar el voto de otro", async () => {
    await assertFails(deleteDoc(doc(as("joan"), "votes/jeovanni")));
  });
});

describe("Contraseñas: marca de 'ya tiene contraseña'", () => {
  test("Cualquiera puede ver qué nombres ya tienen contraseña", async () => {
    await assertSucceeds(getDocs(collection(anon(), "voters")));
  });
  test("Joan puede marcar su propio nombre", async () => {
    await assertSucceeds(setDoc(doc(as("joan"), "voters/joan"), { claimedAt: serverTimestamp() }));
  });
  test("Joan NO puede marcar el nombre de otro", async () => {
    await assertFails(setDoc(doc(as("joan"), "voters/jeovanni"), { claimedAt: serverTimestamp() }));
  });
  test("Nadie puede borrar o cambiar la marca", async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), "voters/joan"), { claimedAt: new Date() }));
    await assertFails(deleteDoc(doc(as("joan"), "voters/joan")));
    await assertFails(setDoc(doc(as("joan"), "voters/joan"), { claimedAt: serverTimestamp() }));
  });
});

describe("Candidatos privados", () => {
  beforeEach(() => env.withSecurityRulesDisabled((ctx) =>
    setDoc(doc(ctx.firestore(), "candidates/candidato-x"), { nombre: "Ejemplo" })));
  test("Los votantes con sesión pueden ver a los candidatos", async () => {
    for (const id of ["jean", "joan", "jeovanni", "geronimo", "tutora"]) {
      await assertSucceeds(getDocs(collection(as(id), "candidates")));
    }
  });
  test("Sin sesión NO se ven los candidatos", async () => {
    await assertFails(getDocs(collection(anon(), "candidates")));
    await assertFails(getDoc(doc(anon(), "candidates/candidato-x")));
  });
  test("Una cuenta que no está en la lista NO ve los candidatos", async () => {
    await assertFails(getDocs(collection(as("intruso"), "candidates")));
    const fake = env.authenticatedContext("uid-x", { email: "jean@otro.com" }).firestore();
    await assertFails(getDocs(collection(fake, "candidates")));
  });
  test("Solo Jean puede actualizar candidatos", async () => {
    await assertSucceeds(setDoc(doc(as("jean"), "candidates/candidato-x"), { nombre: "Ejemplo 2" }));
    await assertFails(setDoc(doc(as("joan"), "candidates/candidato-x"), { nombre: "Otra" }));
    await assertFails(deleteDoc(doc(as("tutora"), "candidates/candidato-x")));
  });
});

describe("Todo lo demás está bloqueado", () => {
  test("NO se puede escribir ni leer otras colecciones", async () => {
    await assertFails(setDoc(doc(as("jean"), "otra/x"), { a: 1 }));
    await assertFails(getDoc(doc(as("jean"), "otra/x")));
  });
});
