import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  getFirestore, collection, doc, onSnapshot, setDoc, deleteDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

// Firebase solo guarda los votos; candidatos y votantes viven en /data.
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export { collection, doc, onSnapshot, setDoc, deleteDoc, serverTimestamp };
