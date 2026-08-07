/* Identificadores para los documentos de Firestore.
   Aleatorio + hora, que basta de sobra para un uso personal y evita que dos
   dispositivos que apuntan a la vez generen el mismo. */

export function nuevoId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
