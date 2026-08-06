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

   Si algún día se vacían estos valores, las dos apps siguen funcionando igual,
   pero guardando solo en el dispositivo.

   Nota: el `measurementId` de Google Analytics no se incluye a propósito. Las
   apps no cargan Analytics, así que ahí no pintaba nada.
   ───────────────────────────────────────────────────────────────────────── */

window.MISAPPS_FIREBASE = {
  apiKey: "AIzaSyB5_Ekb-y-WJu7qKxsbEaSB94UP9xlK6GM",
  authDomain: "apps-claude-c52fa.firebaseapp.com",
  projectId: "apps-claude-c52fa",
  storageBucket: "apps-claude-c52fa.firebasestorage.app",
  messagingSenderId: "670121467675",
  appId: "1:670121467675:web:6d6fc2211c9d2e78233dbe",
};
