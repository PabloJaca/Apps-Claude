/* ─────────────────────────────────────────────────────────────────────────
   Configuración de Firebase (sincronización entre móvil y ordenador).

   Este archivo se lee tal cual desde el navegador: se puede editar aquí, subir
   y listo, no hace falta volver a compilar nada.

   Cómo se rellena (cinco minutos, plan gratuito de sobra):

     1. Entra en https://console.firebase.google.com y crea un proyecto.
        Puedes decir que no a Google Analytics.
     2. Dentro del proyecto, botón «</>» (Web) para registrar una app.
        Te enseña un bloque `firebaseConfig`: copia esos valores aquí abajo.
     3. Menú «Compilación → Authentication → Comenzar» y activa
        «Correo electrónico/contraseña».
     4. Menú «Compilación → Firestore Database → Crear base de datos»,
        modo producción, y pega las reglas del README (están en firestore.rules).
     5. En «Authentication → Settings → Dominios autorizados» añade el dominio
        donde tengas subidas las apps.

   Mientras esto siga con los PON_AQUI_… las dos apps funcionan igual, pero
   guardando solo en el dispositivo, como hasta ahora.
   ───────────────────────────────────────────────────────────────────────── */

window.MISAPPS_FIREBASE = {
  apiKey: "PON_AQUI_TU_API_KEY",
  authDomain: "PON_AQUI_TU_PROYECTO.firebaseapp.com",
  projectId: "PON_AQUI_TU_PROYECTO",
  storageBucket: "PON_AQUI_TU_PROYECTO.firebasestorage.app",
  messagingSenderId: "PON_AQUI_TU_SENDER_ID",
  appId: "PON_AQUI_TU_APP_ID",
};
