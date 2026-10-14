import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider, connectAuthEmulator,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  getFirestore, collection, doc, onSnapshot, setDoc, deleteDoc, writeBatch, serverTimestamp, connectFirestoreEmulator,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js?v=20261013222157";

// Firebase guarda las cuentas (contraseña de cada votante) y los votos.
// Los candidatos son privados (colección "candidates"); la lista de votantes vive en data/config.js.
// Pruebas locales: http://127.0.0.1:5173/?emulador usa el Firebase local (cd tests && npm run emulador).
const useEmulator = ["localhost", "127.0.0.1"].includes(location.hostname)
  && new URLSearchParams(location.search).has("emulador");

export const app = initializeApp(useEmulator ? { ...firebaseConfig, projectId: "demo-votacion" } : firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
if (useEmulator) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}

export {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider,
  collection, doc, onSnapshot, setDoc, deleteDoc, writeBatch, serverTimestamp,
};
