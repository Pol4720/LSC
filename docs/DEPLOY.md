# Despliegue

El sitio es 100 % estático. No hay compilación: lo que está en el repo es lo que
corre en el navegador.

---

## GitHub Pages (lo que usas hoy)

**Settings → Pages → Source: GitHub Actions.**

`.github/workflows/pages.yml` corre las pruebas y despliega en cada push a
`main`. El sitio queda en `https://pol4720.github.io/LSC/`.

También sirve el modo clásico *Deploy from a branch* → `main` / `root`: hay un
`.nojekyll` en la raíz para que Jekyll no toque nada.

**Lo que Pages da:** hosting gratis, HTTPS, CDN global, sin límite práctico de
visitas.
**Lo que Pages no da:** ejecución en el servidor. Por eso las solicitudes entran
por enlace compartido, no en tiempo real — salvo que añadas un relay.

---

## Vercel (cuando puedas crear la cuenta)

Ya está preparado: `vercel.json` y `api/submit.js` están en el repo.

1. Importa `Pol4720/LSC` en Vercel. Framework: **Other**. Sin build command.
2. **Environment Variables**:

   | Variable | Valor |
   |---|---|
   | `GITHUB_TOKEN` | PAT fine-grained, *Contents: Read and write* sobre `Pol4720/LSC` |
   | `GITHUB_OWNER` | `Pol4720` |
   | `GITHUB_REPO` | `LSC` |
   | `GITHUB_BRANCH` | `main` |
   | `ALLOWED_ORIGIN` | `https://pol4720.github.io,https://tu-app.vercel.app` |

3. Deploy.
4. En la consola: **Ajustes → Endpoint de relay** →
   `https://tu-app.vercel.app/api/submit`.

Desde ese momento cada envío se escribe directo en `data/submissions/` y lo ves
al sincronizar. `vercel.json` también añade cabeceras de seguridad y rutas
amigables (`/consola`, `/calculator`).

Vercel pide número de teléfono al registrarse. Si ese es el obstáculo, usa
Cloudflare.

---

## Cloudflare Workers (alternativa sin teléfono)

Cloudflare permite registrarse con solo un correo. El plan gratuito da 100 000
peticiones diarias — muchísimo más de lo que necesitas.

```bash
cd worker
npx wrangler login                # abre el navegador
npx wrangler secret put GITHUB_TOKEN
npx wrangler deploy
```

Ajusta `worker/wrangler.toml` (`GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_BRANCH`,
`ALLOWED_ORIGIN`) y pon la URL del worker en **Ajustes → Endpoint de relay**.

El worker guarda exactamente el ciphertext que le llega: aunque alguien tomara
el control del worker, no podría leer nada.

---

## Otras opciones gratuitas sin teléfono

| Servicio | Registro | Notas |
|---|---|---|
| **Cloudflare Pages + Workers** | Correo | Igual que Pages pero con funciones; la mejor combinación gratuita |
| **Netlify** | Correo o GitHub | Functions gratis; añade un `netlify.toml` con `publish = "."` |
| **Deno Deploy** | Cuenta de GitHub | El worker se adapta casi tal cual |
| **Codeberg Pages** | Correo | Solo estático, sin funciones |

Como el sitio es estático puro, cualquiera de ellos sirve copiando el repo tal
cual. Solo el relay necesita servidor.

---

## Local

```bash
npm run dev              # http://localhost:4173
npm run dev -- 4174 --prefix=/LSC   # igual que Pages: http://localhost:4174/LSC/
```

Sirve el repo tal cual, sin caché. Necesario porque los módulos ES no cargan
desde `file://`.

### Sobre la subruta

GitHub Pages sirve un sitio de proyecto en `https://usuario.github.io/repo/`,
nunca en la raíz del dominio. Todo el sitio usa rutas relativas y los enlaces
que genera (el que el cliente te manda por WhatsApp, los del formulario que
compartes) conservan la subruta. `tests/e2e/subpath.spec.js` levanta un segundo
servidor montado en `/LSC/` y recorre formulario, consola y calculadora ahí para
que esto no se rompa nunca.

---

## Verificación antes de desplegar

```bash
npm run verify   # check estático + unitarias + navegador
```

* `npm run check` — imports, referencias de HTML, integridad del esquema,
  traducciones, tarifas monótonas y ausencia de recursos externos.
* `npm test` — 127 pruebas unitarias.
* `npm run test:e2e` — 62 pruebas de navegador (escritorio y móvil).

CI corre las dos primeras antes de cada despliegue y bloquea el deploy si algo
falla.

---

## Índice de datos

`.github/workflows/data-index.yml` regenera `data/index.json` cuando cambian los
registros. Ese índice permite listar las solicitudes sin token y sin gastar
llamadas a la API. También ejecuta `scripts/check-encrypted.mjs`, que falla el
build si aparece un registro sin cifrar.
