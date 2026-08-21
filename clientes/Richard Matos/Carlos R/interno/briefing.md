# Briefing interno — Carlos R (pre-activación)

**Fecha:** 21 ago 2026 · **Asesor:** Richard Matos · **Estado:** aún NO pagó los $149

## Requerimiento del cliente
- Toyota RAV4, 2019–2024, ~100k millas (menos mejor)
- Presupuesto **total** (todo incluido): $15,000
- Preferencia fuerte: **título limpio**
- Aceptaría salvage/rebuilt **solo** si: daños leves cosméticos, sin bolsas desplegadas, sin daño estructural

## Techo real de oferta
Título limpio, con el vehículo real de abajo (ya en Florida): presupuesto $15,000 → **oferta máxima ≈ $11,950**, costo total estimado $14,974.45. Con un salvage lejos (ej. California) el transporte sube y el techo de oferta baja un poco, pero el precio de entrada del salvage es tan bajo que igual sobra margen — ver tabla más abajo.

`[ESTIMADO]` la tarifa de subasta se calculó por escalón (`config/tarifas_subasta.json`), no con la calculadora oficial de LSC — confirmar antes de dar cifra final al cliente. El transporte ahora sí es específico por vehículo: usé `costeo.py ... --estado-vehiculo XX`, que mira `config/distancias_fl.json` (tabla nueva que agregué a la skill) en vez de un monto plano para los tres ejemplos.

## Los 3 ejemplos que van en el PDF del cliente

| # | Vehículo | Millas | Título | Ubicación | Transporte a FL | Precio |
|---|---|---|---|---|---|---|
| 1 | 2023 RAV4 XLE | 38,301 | Título limpio | Florida | $500 | Sin fecha de subasta fija — parece inventario de venta directa, no lote cronometrado. **[PENDIENTE] confirmar mecanismo de compra con LSC antes de mencionárselo como "disponible ya".** |
| 2 | 2022 RAV4 LE | 63,228 | Salvage, daño trasero leve | Pennsburg, PA | $950 | Subasta activa, 3 días — **no puse la oferta actual ($175) porque es solo el punto de partida de la puja, no dice nada del precio final.** |
| 3 | 2020 RAV4 XLE | 69,986 | Salvage, daño frontal leve | Fresno, CA | $1,300 | Compra Inmediata real: $7,800 |

### Sobre las fotos (bug real que arreglé)
El regex que extraía fotos de la ficha estaba desactualizado (el CDN de LSC cambió de patrón hace tiempo) y siempre devolvía 0 fotos — lo arreglé en `scripts/buscar_inventario.py`. Con el fix sí trae fotos reales. **El único de los 3 que tiene fotos en su ficha es el #1** (21 fotos — las miré: RAV4 roja, sin daño visible, con calcomanía de un lote de "X38,301" que coincide con el odómetro; parece un trade-in de dealer, no un siniestro de aseguradora). Los lotes #2 y #3 no tienen fotos cargadas en la ficha todavía — no es que no las busqué, genuinamente el lote no las tiene hoy. Díselo así al cliente si pregunta: "las fotos de estos dos las estamos monitoreando, en cuanto la subasta las suba las revisamos".

### Foto cortada en la tarjeta del PDF — RESUELTO
La card de `.card img` forzaba `height:112px` con `object-fit:cover`, y a ese alto (con el ancho real de la
tarjeta en el layout de 3 columnas, ~222px) el recorte quedaba muy agresivo: la relación de aspecto del
contenedor (~2:1) era mucho más ancha que la foto real (4:3, 1600×1200), así que solo se veía el capó/nariz.
Subí el alto a `160px` en `render_pdf.py` (CSS `.card img` y el estilo inline de la tarjeta en
`html_viabilidad`) — con el ancho real de columna eso da una relación de aspecto ~1.39:1, casi igual al 4:3
de la foto, así que ahora el recorte es mínimo (unos pocos px arriba/abajo) y se ve el carro completo. No
hizo falta cambiar de foto ni tocar `object-position`: la A_0 (3/4 frontal) ya encuadra bien con el nuevo alto.
Lo verifiqué regenerando el PDF y leyéndolo página por página — el carro se ve completo, sin recortar ruedas
ni techo.

De paso encontré y arreglé dos bugs reales en `render_pdf.py` que no dejaban correr el script en absoluto
con Python 3.11 (el intérprete por defecto de este entorno): comillas anidadas repetidas dentro de f-strings
(`f'...{f"{v['odometro']:,}..."}'`), sintaxis que solo Python 3.12+ permite. Extraje una función `millas()`
para no repetir el patrón. También el `pw.chromium.launch()` fallaba porque el paquete `playwright` de pip
(1.62.0) busca una revisión de Chromium distinta a la que existe en `/opt/pw-browsers` — agregué
`_chromium_exe()` para localizar el binario real instalado y pasarlo como `executable_path`.

### Sobre "llaves"
El #1 (título limpio) figura con `llaves: No` en la ficha. Vale la pena preguntarlo/confirmarlo en la llamada — no es descalificante pero si de verdad no tiene llaves hay que sumar el costo de llave con transponder ($200-400) y es una señal a vigilar (aunque el título es limpio, no recuperación de robo).

## Vehículos vendidos como comparables — SIGUE PENDIENTE, pero ya NO es problema de red

**Se abrió una sesión nueva sobre el entorno LSC (21 ago, tarde) y el bloqueo de red de la sesión anterior ya no existe.** Confirmado con `curl`: bid.cars, copart.com e iaai.com responden ahora (antes daban `EGRESS_BLOCKED`). Esto confirma la sospecha de la sesión anterior — el cambio de dominios permitidos no se aplicaba en caliente a una sesión ya corriendo, solo a una nueva.

Pero el diagnóstico real es otro, y sigue bloqueando el mismo dato:

- **bid.cars**: la conexión llega, pero el sitio devuelve un reto anti-bot de Cloudflare (`HTTP 403`, header `cf-mitigated: challenge`, página "Just a moment..."). Probé con `curl`, con `WebFetch` y con un Chromium real vía Playwright (con el proxy del entorno configurado explícitamente) — los tres chocan con el mismo challenge JS, que ninguna de estas herramientas puede resolver. No es un bloqueo de nuestra red, es protección anti-scraping del propio bid.cars.
- **copart.com / iaai.com directos**: sí cargan (HTTP 200), pero son SPAs que se renderizan del lado del cliente — el HTML crudo que se puede leer no trae los datos, solo el esqueleto de la página. Sí conseguí que IAAI mostrara **inventario activo** (ej. RAV4 2021 con millaje/título/daño/precio) en una página de catálogo SEO, pero son subastas *futuras* (fechas del 24-27 de agosto), no ventas cerradas — el campo "precio" ahí es ACV (valor estimado) o Buy Now (precio de pedida), no un precio de cierre real. Probé un parámetro `saleStatus=Sold` sin efecto: el historial de vendidos en Copart/IAAI está detrás de login de miembro, tal como ya decía `busqueda-inventario.md`.
- Revisé también otros agregadores que aparecieron en una búsqueda web (salvagebid.com, autobidmaster.com, cars4.bid, abetter.bid) — no están en la lista de dominios permitidos de este entorno y no se intentó forzar el acceso.

**Conclusión: sigue sin ser posible traer 2-3 comparables VENDIDOS reales y verificables con los medios disponibles en este entorno.** El campo `comparables_vendidos` del JSON se deja vacío (`[]`) — no se inventó ningún precio. **Nota técnica:** contrario a lo que se pensó, la plantilla (`render_pdf.py`, función `html_viabilidad`) todavía NO tiene lógica para renderizar `comparables_vendidos` — solo existe el campo vacío en el JSON como marcador de lo pendiente. Si en algún momento se consigue el dato (ej. con acceso de miembro real a Copart/IAAI, o alguien con browser autenticado copia 2-3 ventas de bid.cars a mano), hay que añadir esa sección a la plantilla además de llenar el JSON.

## Para la llamada
- Lidera con el número bueno: $15,000 totales sí alcanzan, incluso en título limpio — la unidad #1 lo prueba.
- El mensaje no es "renuncia a título limpio", es "el título limpio en este rango se mueve rápido, por eso conviene tener a alguien buscando todos los días" — eso es literalmente lo que vende la asesoría.
- El salvage no es un plan B triste: el #3 cuesta menos de $8,000 de Compra Inmediata y deja mucho margen dentro del presupuesto.
- Confirmar antes de la llamada: mecanismo de compra del #1 (sin fecha de subasta), estado real del cliente (para afinar impuesto/transporte si su destino final no es Florida).
- Los comparables de vendidos siguen sin conseguirse (bid.cars bloquea con anti-bot, Copart/IAAI esconden el histórico detrás de login) — si necesitas cifras de referencia para la llamada, tendrías que sacarlas tú a mano desde un navegador con sesión, no algo que se pudo automatizar hoy.

## Objeción probable
"¿Por qué solo $11,950 si tengo $15,000?" → porque el presupuesto es el costo total: oferta + tarifa de subasta + tarifa LSC ($799) + impuesto (7%) + titulación (~$355) + transporte (varía según dónde esté el carro, por eso el PDF ya no usa un número plano). El desglose completo está en el PDF que se le envía.
