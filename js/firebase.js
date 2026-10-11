import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut,
  createUserWithEmailAndPassword, updatePassword,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  getFirestore, collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc,
  getDocs, writeBatch, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

export const configured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

export const app = configured ? initializeApp(firebaseConfig) : null;
export const auth = configured ? getAuth(app) : null;
export const db = configured ? getFirestore(app) : null;

export {
  onAuthStateChanged, signInWithEmailAndPassword, signOut, updatePassword, createUserWithEmailAndPassword,
  collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, getDocs, writeBatch, serverTimestamp,
};

// Crea una cuenta de votante sin cerrar la sesión del admin: usa una instancia secundaria de Firebase.
export async function createVoterAccount(email, pin) {
  const secondary = initializeApp(firebaseConfig, `alta-${Date.now()}`);
  try {
    const cred = await createUserWithEmailAndPassword(getAuth(secondary), email, pin);
    return cred.user.uid;
  } finally {
    await deleteApp(secondary);
  }
}
