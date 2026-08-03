import { auth } from "./firebase-config.js";
import { signInWithEmailAndPassword, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Si ya está logueado, mandar directo a app.html
onAuthStateChanged(auth, (user) => {
  if (user) window.location.href = "app.html";
});

const form = document.getElementById("form-login");
const errorMsg = document.getElementById("error-msg");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  errorMsg.textContent = "";

  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = "app.html";
  } catch (err) {
    errorMsg.textContent = "Correo o contraseña incorrectos.";
  }
});
