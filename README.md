# AuctionAssist · Centro de Asesoría

Herramienta de trabajo para asesores de ventas: un **formulario dinámico** que
levanta las necesidades del cliente y una **consola privada** donde se guardan,
buscan, editan, cotizan y exportan.

Todo es estático, gratuito y sin servidor propio. El repositorio hace de base de
datos y los datos de cada cliente viajan **cifrados de extremo a extremo**, así
que el repo puede ser público sin exponer a nadie.

| | |
|---|---|
| **Formulario (cliente)** | https://pol4720.github.io/LSC/ |
| **Consola (asesor)** | https://pol4720.github.io/LSC/console.html |
| **Calculadora** | https://pol4720.github.io/LSC/calculadora.html |

---

## Qué hace

### Formulario de levantamiento

* **10 pasos, dos modos.** Exprés (≈3 min, lo esencial) o Completo (≈8 min, con
  el que se llega a la asesoría con lotes ya seleccionados).
* **Preguntas condicionales.** Si marcas «Uber/Lyft» aparece el aviso sobre los
  requisitos de las plataformas; si marcas «exportar» aparecen país, puerto y
  modalidad de embarque; si aceptas daños aparece el presupuesto de reparación.
* **Vocabulario real de subasta**, explicado. Cada término difícil —*salvage*,
  *rebuilt*, *Run & Drive*, *start code*, ACV, *gate fee*, marca de odómetro—
  tiene un «?» con una explicación en lenguaje llano.
* **Se guarda solo.** El borrador vive en el navegador del cliente; puede cerrar
  la pestaña y volver días después.
* **Español e inglés, claro y oscuro**, con memoria de la preferencia.
* **Estimado de poder de puja** en el paso de revisión: con su presupuesto
  todo-incluido calcula hasta cuánto se puede pujar.
* **Accesible**: navegable con teclado, etiquetas ARIA, contraste alto,
  `prefers-reduced-motion`, sin desbordes horizontales en móvil.

### Consola del asesor

* **Panel** con métricas, embudo, solicitudes por semana y distribución de
  presupuestos.
* **Clientes**: búsqueda difusa e insensible a acentos sobre nombre, teléfono,
  ciudad, auto, notas y etiquetas; filtros por etapa, prioridad y presupuesto.
* **Embudo Kanban** de 10 etapas con arrastrar y soltar.
* **Ficha de cliente** en pestañas: perfil con señales derivadas (tolerancia al
  riesgo, temperatura del lead, avisos para la asesoría), requisitos completos y
  editables, bitácora de llamadas y sesiones, lotes objetivo con detección
  automática de Copart / IAA / bid.cars, y plan de costos.
* **Calculadora de costo total** en las dos direcciones: de puja a total, y de
  presupuesto a puja máxima recomendada.
* **Exportaciones**: CSV ancho (Excel), CSV largo (una fila por respuesta),
  JSON, Markdown, vCard, iCal, ficha imprimible / PDF, resumen para WhatsApp.
* **Menú flotante de plataformas** (botón *Plataformas*, o la tecla `P`): acceso
  en un clic a Copart, IAA, Manheim, ACV, ADESA, bid.cars, AutoAstat, SCA,
  Carfax, AutoCheck, el decodificador VIN de la NHTSA, NICB VINCheck, KBB,
  Edmunds, Super Dispatch, Central Dispatch, FMCSA y tu propio sitio (nombre y
  URL vienen de `config.js`).
  Con un cliente abierto los enlaces se rellenan solos con su marca y modelo, y
  si algún lote guardado trae VIN saltan directo al VIN. Clic derecho copia el
  enlace.
* **Sincronización con GitHub** con un token que solo vive en tu navegador.
* **Control de acceso a la consola**: intentos fallidos penalizados con espera
  creciente, bloqueo automático por inactividad, y códigos de acceso temporal
  que puedes generar, mandar por WhatsApp y revocar cuando quieras — para
  darle uso a alguien por un rato sin entregar tu contraseña real.

---

## Cómo empezar (10 minutos, una sola vez)

### 1 · Publica el sitio

**Settings → Pages → Source: «Deploy from a branch» → `main` → `/ (root)`.**

Eso es todo. El sitio son archivos estáticos con un `.nojekyll` en la raíz, así
que GitHub los sirve tal cual, sin compilar ni ejecutar nada. En un par de
minutos queda en `https://pol4720.github.io/LSC/` y cada push a `main` se
publica solo.

> Existe también `.github/workflows/pages.yml` por si prefieres
> *Source: GitHub Actions*; se lanza a mano desde la pestaña Actions. No hace
> falta: la opción de rama es más simple y no depende de que haya runners
> disponibles.

### 2 · Crea tus claves

Abre `console.html`. La primera vez te pide una contraseña (mínimo 10
caracteres) y genera un par de claves:

* la **privada** se queda cifrada en tu navegador y se descarga como respaldo,
* la **pública** se publica en `data/config/advisor-key.json`.

> ⚠️ **Guarda el archivo de respaldo y recuerda la contraseña.** Sin ellos los
> registros cifrados no se recuperan. Nadie tiene una copia.

### 3 · Conecta el repositorio

En **Ajustes → Repositorio**, pega un
[token fine-grained](https://github.com/settings/personal-access-tokens/new)
con acceso **solo a este repositorio** y permiso **Contents: Read and write**.
Pulsa «Guardar y probar».

El token se guarda únicamente en el `localStorage` de tu navegador. Nunca se
sube al repo, nunca aparece en una URL, nunca sale de tu máquina salvo hacia
`api.github.com`.

### 4 · Comparte el formulario

En **Clientes → Enlace del formulario** tienes los enlaces listos: completo en
español, completo en inglés, exprés y modo asesor (para rellenarlo tú en una
videollamada con pantalla compartida).

---

## Cómo llegan los datos al repositorio

Hay tres caminos, y el sistema usa el mejor disponible sin que tengas que
decidir nada:

| Camino | Cuándo | Tiempo real |
|---|---|---|
| **Relay** | Hay un endpoint desplegado (`api/submit.js` en Vercel o `worker/index.js` en Cloudflare) | ✅ Sí — se escribe en el repo al pulsar «Enviar» |
| **Enlace compartido** | Sin relay (la situación por defecto en GitHub Pages) | El cliente envía un enlace por WhatsApp; lo abres y se guarda con un clic |
| **Archivo** | Sin conexión o si el cliente prefiere | Descarga un `.json` y lo arrastras a la consola |

En los tres casos el contenido ya viaja cifrado: quien intercepte el enlace, el
archivo o el commit no ve nada.

### Activar el tiempo real cuando puedas

El repositorio ya está listo para las dos opciones gratuitas que **no piden un
teléfono de fuera de Cuba**:

**Cloudflare Workers** (registro solo con correo):

```bash
cd worker
npx wrangler secret put GITHUB_TOKEN
npx wrangler deploy
```

**Vercel** (`vercel.json` y `api/submit.js` ya están en el repo): importa el
repositorio y define `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`,
`GITHUB_BRANCH` y `ALLOWED_ORIGIN`.

Después pon la URL en **Ajustes → Endpoint de relay** (o en
`assets/js/config.js`) y listo: las solicitudes entran solas.

---

## Seguridad

* **ECDH P-256 → HKDF-SHA256 → AES-256-GCM**, con clave efímera por registro
  (secreto hacia adelante). Todo con WebCrypto del navegador.
* La clave privada se guarda envuelta con **PBKDF2-SHA256 (310 000 iteraciones)
  → AES-GCM**.
* `scripts/check-encrypted.mjs` corre en CI y **falla el build** si alguien
  comete un registro sin cifrar.
* Sin CDN, sin analítica, sin cookies, sin peticiones a terceros: el sitio
  funciona entero desde su propio origen.
* El relay nunca puede leer lo que almacena: recibe y guarda ciphertext.
* **Solo tú entras a la consola** (o quien autorices tú, por un tiempo): intentos
  fallidos con espera creciente, bloqueo automático por inactividad, y códigos
  de acceso temporales y revocables — nunca hace falta compartir tu contraseña
  real.

Detalle completo en [`docs/SECURITY.md`](docs/SECURITY.md).

---

## Desarrollo

```bash
npm install          # solo Playwright, para las pruebas
npm run dev          # servidor estático en http://localhost:4173
npm run check        # integridad del esquema, imports, i18n y cifrado
npm test             # pruebas unitarias (node --test)
npm run test:e2e     # pruebas de navegador (Playwright)
npm run verify       # las tres cosas
```

No hay paso de compilación. El sitio son módulos ES nativos, CSS y HTML: lo que
está en el repo es exactamente lo que corre en el navegador.

### Estructura

```
index.html            formulario del cliente
console.html          consola del asesor
calculadora.html      calculadora pública
assets/js/
  schema.js           ← las preguntas viven aquí (edita esto para cambiar el formulario)
  catalogs.js         vocabulario de subasta (marcas, títulos, daños, glosario)
  fees.js             motor de costos y tablas de tarifas
  fields.js           renderizadores de cada tipo de campo
  form.js             asistente del formulario
  console.js          consola / CRM
  calculator.js       panel de costos compartido
  crypto.js           cifrado extremo a extremo
  github.js           el repositorio como base de datos
  exports.js          CSV, JSON, vCard, iCal, Markdown, HTML
  platforms.js        catálogo de plataformas externas y enlaces profundos
  launcher.js         menú flotante de plataformas
  summary.js          resumen legible + perfil derivado
data/                 los registros cifrados
api/ · worker/        relays opcionales para tiempo real
scripts/              servidor local, verificaciones, índice
tests/                unitarias + e2e
```

### Cambiar las preguntas

Todo el cuestionario está declarado en `assets/js/schema.js`. Añadir una
pregunta es añadir un objeto al array de su paso:

```js
{
  id: 'vehicle.roofRack',
  type: 'segmented',
  label: { es: '¿Necesitas parrilla de techo?', en: 'Do you need a roof rack?' },
  options: [
    { id: 'yes', label: { es: 'Sí', en: 'Yes' } },
    { id: 'no', label: { es: 'No', en: 'No' } },
  ],
  showIf: (d) => (d?.vehicle?.bodyTypes || []).includes('suv'),
}
```

El renderizador, la validación, el resumen, el CSV y la ficha imprimible la
recogen solas. `npm run check` avisa si falta una traducción.

### Actualizar las tarifas

Las subastas cambian sus tarifarios. Edítalos en **Ajustes → Tablas de
tarifas** (se guardan en tu navegador) o en `assets/js/fees.js` para que
cambien para todos. Los números que trae por defecto son **estimados
editables**, no una cotización oficial: confirma siempre contra el tarifario
vigente antes de pujar.

---

## Documentación

* [`docs/GUIA-ASESOR.md`](docs/GUIA-ASESOR.md) — manual de uso, en español.
* [`docs/SECURITY.md`](docs/SECURITY.md) — modelo de amenazas y criptografía.
* [`docs/DEPLOY.md`](docs/DEPLOY.md) — Pages, Vercel, Cloudflare y alternativas.
* [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — decisiones de diseño.
