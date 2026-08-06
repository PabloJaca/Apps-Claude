/* ─────────────────────────────────────────────────────────────────────────
   Tabla de alimentos.

   `k` son kilocalorías de una ración casera normal (lo que uno se pone en el
   plato, no 100 g de laboratorio) y `g` los grupos que sirven para valorar la
   calidad del día. Está escrita para comida de casa española, que es lo que
   se va a escribir en la app.

   Los términos van sin tildes a propósito: el texto se normaliza antes de
   compararlo, así "plátano" y "platano" caen en el mismo sitio.
   ───────────────────────────────────────────────────────────────────────── */

export const ALIMENTOS = [
  /* ── verdura y hortalizas ─────────────────────────────────────────── */
  { t: ["ensalada mixta", "ensalada completa"], k: 180, g: ["verdura"] },
  { t: ["ensalada cesar", "ensalada césar"], k: 350, g: ["verdura", "salsa"] },
  { t: ["ensalada"], k: 110, g: ["verdura"] },
  { t: ["verdura", "verduras", "salteado de verduras", "verduras salteadas"], k: 130, g: ["verdura"] },
  { t: ["menestra"], k: 140, g: ["verdura"] },
  { t: ["pisto"], k: 160, g: ["verdura"] },
  { t: ["parrillada de verduras", "verduras a la plancha"], k: 140, g: ["verdura"] },
  { t: ["brocoli", "brócoli"], k: 70, g: ["verdura"] },
  { t: ["judias verdes", "judías verdes"], k: 90, g: ["verdura"] },
  { t: ["espinacas"], k: 70, g: ["verdura"] },
  { t: ["acelgas"], k: 70, g: ["verdura"] },
  { t: ["coliflor"], k: 70, g: ["verdura"] },
  { t: ["calabacin", "calabacín"], k: 60, g: ["verdura"] },
  { t: ["berenjena"], k: 70, g: ["verdura"] },
  { t: ["pimiento", "pimientos"], k: 55, g: ["verdura"] },
  { t: ["tomate", "tomates"], k: 35, g: ["verdura"] },
  { t: ["lechuga"], k: 20, g: ["verdura"] },
  { t: ["pepino"], k: 20, g: ["verdura"] },
  { t: ["zanahoria", "zanahorias"], k: 45, g: ["verdura"] },
  { t: ["cebolla"], k: 45, g: ["verdura"] },
  { t: ["champinones", "champiñones", "setas"], k: 50, g: ["verdura"] },
  { t: ["alcachofas", "alcachofa"], k: 80, g: ["verdura"] },
  { t: ["esparragos", "espárragos"], k: 45, g: ["verdura"] },
  { t: ["guisantes"], k: 120, g: ["verdura", "legumbre"] },
  { t: ["gazpacho", "salmorejo"], k: 150, g: ["verdura"] },
  { t: ["crema de verduras", "crema de calabaza", "puré de verduras", "pure de verduras"], k: 160, g: ["verdura"] },
  { t: ["sopa de verduras", "sopa"], k: 130, g: ["verdura"] },
  { t: ["caldo"], k: 60, g: ["verdura"] },

  /* ── fruta ────────────────────────────────────────────────────────── */
  { u: true, t: ["fruta"], k: 85, g: ["fruta"] },
  { u: true, t: ["manzana"], k: 80, g: ["fruta"] },
  { u: true, t: ["platano", "plátano"], k: 105, g: ["fruta"] },
  { u: true, t: ["naranja"], k: 70, g: ["fruta"] },
  { u: true, t: ["mandarina", "mandarinas"], k: 50, g: ["fruta"] },
  { u: true, t: ["pera"], k: 90, g: ["fruta"] },
  { t: ["uvas"], k: 100, g: ["fruta"] },
  { t: ["fresas"], k: 55, g: ["fruta"] },
  { t: ["sandia", "sandía"], k: 60, g: ["fruta"] },
  { t: ["melon", "melón"], k: 65, g: ["fruta"] },
  { u: true, t: ["kiwi"], k: 50, g: ["fruta"] },
  { t: ["pina", "piña"], k: 75, g: ["fruta"] },
  { u: true, t: ["melocoton", "melocotón"], k: 65, g: ["fruta"] },
  { t: ["cerezas"], k: 90, g: ["fruta"] },
  { t: ["arandanos", "arándanos"], k: 60, g: ["fruta"] },
  { t: ["aguacate"], k: 230, g: ["fruta", "grasa_buena"] },
  { t: ["macedonia", "macedonia de frutas"], k: 120, g: ["fruta"] },

  /* ── legumbres ────────────────────────────────────────────────────── */
  { t: ["lentejas"], k: 360, g: ["legumbre"] },
  { t: ["garbanzos", "cocido", "potaje"], k: 400, g: ["legumbre"] },
  { t: ["alubias", "judias blancas", "judías blancas", "fabada"], k: 450, g: ["legumbre"] },
  { t: ["hummus"], k: 180, g: ["legumbre"] },
  { t: ["soja", "tofu"], k: 180, g: ["legumbre", "proteina"] },
  { t: ["edamame"], k: 130, g: ["legumbre"] },

  /* ── cereales, pasta, arroz, pan ──────────────────────────────────── */
  { t: ["arroz integral"], k: 300, g: ["cereal", "integral"] },
  { t: ["arroz"], k: 310, g: ["cereal"] },
  { t: ["paella"], k: 560, g: ["cereal", "proteina"] },
  { t: ["risotto"], k: 480, g: ["cereal"] },
  { t: ["pasta integral"], k: 400, g: ["cereal", "integral"] },
  { t: ["pasta", "espaguetis", "macarrones", "tallarines", "fideos"], k: 420, g: ["cereal"] },
  { t: ["lasana", "lasaña", "canelones"], k: 560, g: ["cereal", "proteina"] },
  { t: ["quinoa"], k: 280, g: ["cereal", "integral"] },
  { t: ["cuscus", "cuscús"], k: 300, g: ["cereal"] },
  { u: true, t: ["pan integral"], k: 100, g: ["cereal", "integral"] },
  { u: true, t: ["pan"], k: 110, g: ["cereal"] },
  { u: true, t: ["tostadas", "tostada"], k: 150, g: ["cereal"] },
  { u: true, t: ["bocadillo", "bocata"], k: 480, g: ["cereal", "proteina"] },
  { u: true, t: ["sandwich", "sándwich"], k: 380, g: ["cereal", "proteina"] },
  { t: ["wrap", "durum"], k: 420, g: ["cereal", "proteina"] },
  { t: ["cereales"], k: 220, g: ["cereal", "azucar"] },
  { t: ["muesli", "granola"], k: 260, g: ["cereal", "azucar"] },
  { t: ["avena", "porridge"], k: 220, g: ["cereal", "integral"] },
  { t: ["tortitas", "pancakes"], k: 380, g: ["cereal", "dulce"] },

  /* ── patata ───────────────────────────────────────────────────────── */
  { t: ["patatas fritas", "patatas bravas"], k: 380, g: ["tuberculo", "frito"] },
  { t: ["pure de patata", "puré de patata"], k: 200, g: ["tuberculo"] },
  { t: ["patata", "patatas"], k: 200, g: ["tuberculo"] },
  { t: ["tortilla de patata", "tortilla espanola", "tortilla española"], k: 380, g: ["tuberculo", "huevo", "frito"] },
  { t: ["boniato"], k: 180, g: ["tuberculo"] },

  /* ── carnes ───────────────────────────────────────────────────────── */
  { t: ["pechuga de pollo", "pechuga"], k: 200, g: ["proteina", "carne_blanca"] },
  { t: ["pollo asado", "pollo"], k: 250, g: ["proteina", "carne_blanca"] },
  { t: ["pavo"], k: 180, g: ["proteina", "carne_blanca"] },
  { t: ["conejo"], k: 220, g: ["proteina", "carne_blanca"] },
  { t: ["ternera", "filete", "entrecot", "solomillo"], k: 300, g: ["proteina", "carne_roja"] },
  { t: ["cerdo", "lomo", "secreto", "presa"], k: 320, g: ["proteina", "carne_roja"] },
  { t: ["cordero", "chuletas"], k: 400, g: ["proteina", "carne_roja"] },
  { t: ["costillas"], k: 520, g: ["proteina", "carne_roja"] },
  { t: ["hamburguesa"], k: 520, g: ["proteina", "carne_roja", "procesado"] },
  { t: ["albondigas", "albóndigas"], k: 380, g: ["proteina", "carne_roja"] },
  { t: ["carne picada"], k: 320, g: ["proteina", "carne_roja"] },
  { t: ["jamon serrano", "jamón serrano", "jamon iberico", "jamón ibérico"], k: 140, g: ["proteina", "procesado"] },
  { t: ["jamon york", "jamón york", "jamon cocido", "pavo cocido", "fiambre"], k: 90, g: ["proteina", "procesado"] },
  { t: ["chorizo", "salchichon", "salchichón", "fuet", "salami"], k: 240, g: ["procesado", "carne_roja"] },
  { t: ["salchichas"], k: 260, g: ["procesado", "carne_roja"] },
  { t: ["bacon", "beicon", "panceta"], k: 220, g: ["procesado", "carne_roja"] },
  { t: ["morcilla"], k: 300, g: ["procesado", "carne_roja"] },

  /* ── pescado y marisco ────────────────────────────────────────────── */
  { t: ["salmon", "salmón"], k: 300, g: ["proteina", "pescado", "azul", "grasa_buena"] },
  { t: ["atun", "atún"], k: 200, g: ["proteina", "pescado", "azul"] },
  { t: ["sardinas", "caballa", "boquerones"], k: 220, g: ["proteina", "pescado", "azul"] },
  { t: ["merluza", "bacalao", "dorada", "lubina", "lenguado", "rape"], k: 200, g: ["proteina", "pescado"] },
  { t: ["pescado"], k: 220, g: ["proteina", "pescado"] },
  { t: ["gambas", "langostinos"], k: 120, g: ["proteina", "marisco"] },
  { t: ["mejillones", "almejas"], k: 130, g: ["proteina", "marisco"] },
  { t: ["pulpo"], k: 170, g: ["proteina", "marisco"] },
  { t: ["calamares"], k: 280, g: ["proteina", "marisco", "frito"] },
  { t: ["sushi", "poke"], k: 480, g: ["proteina", "pescado", "cereal"] },

  /* ── huevos ───────────────────────────────────────────────────────── */
  { t: ["huevos fritos", "huevo frito"], k: 190, g: ["huevo", "proteina", "frito"] },
  { t: ["tortilla francesa"], k: 200, g: ["huevo", "proteina"] },
  { t: ["revuelto", "huevos revueltos"], k: 230, g: ["huevo", "proteina"] },
  { u: true, t: ["huevo cocido", "huevos cocidos", "huevo duro"], k: 80, g: ["huevo", "proteina"] },
  { u: true, t: ["huevo", "huevos"], k: 90, g: ["huevo", "proteina"] },

  /* ── lácteos ──────────────────────────────────────────────────────── */
  { u: true, t: ["yogur griego"], k: 140, g: ["lacteo", "proteina"] },
  { u: true, t: ["yogur natural", "yogur"], k: 85, g: ["lacteo"] },
  { t: ["kefir", "kéfir"], k: 90, g: ["lacteo"] },
  { t: ["leche"], k: 125, g: ["lacteo"] },
  { t: ["queso fresco", "requeson", "requesón", "cuajada"], k: 110, g: ["lacteo", "proteina"] },
  { t: ["queso"], k: 160, g: ["lacteo", "grasa"] },
  { t: ["batido de proteinas", "proteina en polvo", "batido proteico"], k: 140, g: ["proteina"] },

  /* ── frutos secos y grasas ────────────────────────────────────────── */
  { t: ["frutos secos", "almendras", "nueces", "anacardos", "pistachos"], k: 190, g: ["frutosseco", "grasa_buena"] },
  { t: ["cacahuetes", "crema de cacahuete"], k: 190, g: ["frutosseco", "grasa_buena"] },
  { t: ["aceite de oliva", "aceite"], k: 90, g: ["grasa_buena"] },
  { t: ["aceitunas", "olivas"], k: 110, g: ["grasa_buena"] },
  { t: ["mantequilla"], k: 110, g: ["grasa"] },
  { t: ["mayonesa", "alioli", "salsa"], k: 110, g: ["salsa", "grasa"] },
  { t: ["ketchup", "mostaza"], k: 35, g: ["salsa"] },

  /* ── platos de fuera y ultraprocesados ────────────────────────────── */
  { t: ["pizza"], k: 750, g: ["fastfood", "cereal", "procesado"] },
  { t: ["kebab", "doner"], k: 700, g: ["fastfood", "procesado"] },
  { t: ["mcdonalds", "burger king", "menu del burger", "comida rapida", "comida rápida"], k: 900, g: ["fastfood", "procesado", "frito"] },
  { t: ["nuggets"], k: 340, g: ["fastfood", "frito", "procesado"] },
  { t: ["croquetas"], k: 320, g: ["frito", "procesado"] },
  { t: ["empanadillas", "empanada"], k: 380, g: ["frito", "procesado"] },
  { t: ["tacos", "burrito", "quesadilla"], k: 550, g: ["fastfood", "cereal"] },
  { t: ["ramen", "noodles"], k: 500, g: ["cereal", "procesado"] },
  { t: ["curry"], k: 500, g: ["proteina", "cereal"] },
  { t: ["pizza casera"], k: 600, g: ["cereal"] },
  { t: ["precocinado", "congelado", "pizza congelada"], k: 500, g: ["procesado"] },

  /* ── dulces y picoteo ─────────────────────────────────────────────── */
  { t: ["chocolate", "onzas de chocolate"], k: 220, g: ["dulce"] },
  { t: ["galletas"], k: 240, g: ["dulce", "bolleria"] },
  { t: ["bolleria", "bollería", "croissant", "napolitana", "donut", "dónut"], k: 350, g: ["dulce", "bolleria"] },
  { u: true, t: ["magdalena", "magdalenas", "muffin"], k: 220, g: ["dulce", "bolleria"] },
  { t: ["tarta", "pastel"], k: 400, g: ["dulce", "bolleria"] },
  { t: ["helado"], k: 250, g: ["dulce"] },
  { t: ["flan", "natillas", "arroz con leche", "postre"], k: 200, g: ["dulce"] },
  { t: ["churros"], k: 420, g: ["dulce", "frito", "bolleria"] },
  { t: ["gominolas", "chuches", "caramelos"], k: 180, g: ["dulce", "azucar"] },
  { t: ["patatas de bolsa", "doritos", "snacks", "aperitivos"], k: 300, g: ["snack_salado", "procesado", "frito"] },
  { t: ["palomitas"], k: 160, g: ["snack_salado"] },
  { u: true, t: ["barrita", "barrita energetica", "barrita energética"], k: 180, g: ["dulce", "procesado"] },

  /* ── bebidas ──────────────────────────────────────────────────────── */
  { u: true, t: ["cerveza", "cana", "caña", "cervezas"], k: 150, g: ["alcohol"] },
  { u: true, t: ["vino", "copa de vino", "tinto"], k: 130, g: ["alcohol"] },
  { u: true, t: ["gin tonic", "cubata", "copa"], k: 230, g: ["alcohol"] },
  { u: true, t: ["vermut"], k: 160, g: ["alcohol"] },
  { u: true, t: ["refresco", "coca cola", "cocacola", "fanta", "nestea"], k: 140, g: ["azucar", "refresco"] },
  { t: ["zero", "light", "sin azucar", "sin azúcar"], k: 0, g: [] },
  { u: true, t: ["zumo", "zumo de naranja"], k: 110, g: ["azucar", "fruta"] },
  { u: true, t: ["cafe con leche", "café con leche"], k: 80, g: ["bebida"] },
  { u: true, t: ["cortado"], k: 45, g: ["bebida"] },
  { t: ["cafe", "café", "te", "té", "infusion", "infusión"], k: 5, g: ["bebida"] },
  { t: ["agua"], k: 0, g: ["bebida"] },
];

/* Índice ordenado de más largo a más corto: así "arroz integral" gana a "arroz"
   y "ensalada mixta" gana a "ensalada". */
export const INDICE = ALIMENTOS.flatMap((a, i) =>
  a.t.map((termino) => ({ termino, indice: i, largo: termino.length }))
).sort((a, b) => b.largo - a.largo);

/* Ración por defecto cuando no se reconoce nada, según el momento del día. */
export const RACION_GENERICA = {
  desayuno: 330,
  comida: 700,
  snack: 220,
  cena: 560,
};
