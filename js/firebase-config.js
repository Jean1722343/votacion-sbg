// Config pública de la web app de Firebase. No es secreta: la seguridad la ponen las reglas de Firestore.
export const firebaseConfig = {
  apiKey: "AIzaSyB-i6bgCrlPdhBOtPG83v3PnbI7VwazGsE",
  authDomain: "votacion-sbg.firebaseapp.com",
  projectId: "votacion-sbg",
  storageBucket: "votacion-sbg.firebasestorage.app",
  messagingSenderId: "965771235257",
  appId: "1:965771235257:web:b93be39e392c5760113068",
};

// Cada votante reparte este número de votos entre candidatos distintos.
export const VOTES_PER_VOTER = 2;
