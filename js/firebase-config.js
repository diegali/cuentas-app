// Reemplazá estos datos por los de TU proyecto de Firebase
// (Consola de Firebase → Configuración del proyecto → tus apps → SDK setup)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCnZP6m1kOq2X4i8PAIkBKmvA-d3kI1s18",
  authDomain: "cuentas-app-465fd.firebaseapp.com",
  projectId: "cuentas-app-465fd",
  storageBucket: "cuentas-app-465fd.firebasestorage.app",
  messagingSenderId: "1041930556317",
  appId: "1:1041930556317:web:28eef92944468a002c5574"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
