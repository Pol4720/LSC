# Briefing interno — Carlos R

**Fecha de activación:** 21 ago 2026 (pagó los $149) · **Asesor:** Richard Matos
**Estado:** Asesoría ACTIVA · Sesión 1 de 5 programada para el 22 ago 2026 (día 1 de 15)

## Requerimiento del cliente (actualizado 21 ago, tarde — mensaje directo del cliente)
- Toyota RAV4, 2019–2024, ~100k millas (menos mejor)
- Presupuesto **total** (todo incluido): $15,000
- Preferencia fuerte: **título limpio**
- **Nuevo:** priorizar tracción **AWD** y versiones más equipadas (no la base LE)
- **Nuevo:** abierto a Honda **CR-V de última generación (2023+)** como alternativa, si alcanza el presupuesto
- **Nuevo, con matiz importante:** no descarta título **salvage ya reparado previamente** — esto es
  distinto de título **Rebuilt/Reconstruido**, que la política de la empresa bloquea siempre
  (`reglas-compra.md` A.2), sin importar que el cliente lo acepte. Ver la nota completa y el
  ejemplo real (CR-V Rebuilt descartado) en `Sesion1_Guion_Videollamada.md`.

> Mensaje original del cliente (21 ago, vía Richard): *"Si puedes prioriza las Awd y versiones mas
> equipadas, tambien puede ser una honda crv de la última generación si alcanza mi presupuesto, no
> descartes titulos savage si han sido reparados previamente."*

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
El regex que extraía fotos de la ficha estaba desactualizado (el CDN de LSC cambió de patrón hace tiempo) y siempre devolvía 0 fotos — lo arreglé en `scripts/buscar_inventario.py`. Con el fix sí trae fotos reales. **El único de los 3 que tiene fotos en su ficha es el #1** (21 fotos — las miré: RAV4 roja, sin daño visible, con calcomanía de un lote de "X38,301" que coincide con el odómetro; parece un trade-in de dealer, no un siniestro de aseguradora). Los lotes #2 y #3 no tienen fotos cargadas en la ficha todavía — no es que no las busqué, genuinamente el lote no las tiene hoy. **Reconfirmado hoy** con `buscar_inventario.py --vin ... --fotos` sobre los dos VIN (`2T3H1RFV8NC197432` y `2T3W1RFV7LW102815`): siguen en `"fotos": []`. Intenté también Copart/IAAI directo por número de lote, pero esas páginas de detalle de lote dan `403` (mismo tipo de protección anti-bot que bid.cars). Díselo así al cliente si pregunta: "las fotos de estos dos las estamos monitoreando, en cuanto la subasta las suba las revisamos".

Como sí seguían sin foto, cambié el marcador vacío del PDF: antes era una caja blanca sin nada (parecía un
error de render), ahora dice explícitamente "Foto pendiente — la subasta aún no la carga en su ficha"
(`foto_card()` en `render_pdf.py`) para que quede claro que es un estado real del lote, no un bug.

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

## Vehículos vendidos como comparables — DESCARTADO, se sustituyó por "volumen de mercado"

**bid.cars sigue bloqueado, ya no por la red sino por su propio anti-bot.** Se abrió sesión nueva sobre el
entorno LSC y el bloqueo de red de antes ya no existe (`curl` confirma que bid.cars, copart.com e iaai.com
responden). Pero bid.cars devuelve un reto anti-bot de Cloudflare (`HTTP 403`, `cf-mitigated: challenge`,
"Just a moment...") que ni `curl`, ni `WebFetch`, ni un Chromium real vía Playwright (con el proxy del
entorno configurado explícitamente) logran pasar. Copart/IAAI directos cargan pero son SPAs sin datos en el
HTML crudo, y su historial de vendidos está detrás de login de miembro. Con esto, y por indicación del
cliente/asesor, **se abandonó la idea de comparables de venta cerrada.**

**En su lugar se agregó una sección de "Volumen y disponibilidad del mercado"** (nuevo campo
`volumen_mercado` en `datos_viabilidad.json`, nueva sección en `render_pdf.py` → `html_viabilidad`). Usa
inventario ACTIVO (no vendido, pero real y verificable) de dos fuentes:
- El catálogo público de IAAI por año (`iaai.com/Vehiclelisting/Toyota/Rav4/{año}`, 2019-2024): confirma
  volumen total (1,286 RAV4 listadas en ese rango de años, todas condiciones) y aportó 50 precios de Compra
  Inmediata reales (no ACV, que es solo valor estimado de aseguradora, no precio) de vehículos con menos de
  100k millas.
- El barrido propio de LSC (`inventario_barrido_rav4_2019-2024.json`, 41 unidades activas), que sumó 5
  precios de Compra Inmediata más al mismo filtro.
- Muestra combinada: **n=55, promedio $10,278, mediana $9,800, rango $6,700–$16,150.** Con título limpio
  (n=5, muestra chica) el promedio sube a ~$12,140; salvage (n=50) da ~$10,091. El techo de oferta del
  cliente ($11,950) cae en la parte media-alta de ese rango — buen dato para la llamada.
- Está bien etiquetado en el PDF como precios de Compra Inmediata / inventario activo, **no** precios de
  venta cerrada — para no repetir el error de mezclar "disponible" con "vendido".

## Para la llamada
- Lidera con el número bueno: $15,000 totales sí alcanzan, incluso en título limpio — la unidad #1 lo prueba.
- El mensaje no es "renuncia a título limpio", es "el título limpio en este rango se mueve rápido, por eso conviene tener a alguien buscando todos los días" — eso es literalmente lo que vende la asesoría.
- El salvage no es un plan B triste: el #3 cuesta menos de $8,000 de Compra Inmediata y deja mucho margen dentro del presupuesto.
- Nuevo: usa la sección de volumen de mercado del PDF (n=55, promedio $10,278) para mostrar que el techo de $11,950 no es una cifra al azar — está bien plantado dentro del rango real de lo que se pide por estos vehículos hoy.
- Confirmar antes de la llamada: mecanismo de compra del #1 (sin fecha de subasta), estado real del cliente (para afinar impuesto/transporte si su destino final no es Florida).

## Objeción probable
"¿Por qué solo $11,950 si tengo $15,000?" → porque el presupuesto es el costo total: oferta + tarifa de subasta + tarifa LSC ($799) + impuesto (7%) + titulación (~$355) + transporte (varía según dónde esté el carro, por eso el PDF ya no usa un número plano). El desglose completo está en el PDF que se le envía.

---

## Sesión 1 (22 ago 2026) — post-pago, encuadre

El cliente pagó los $149 el 21 ago y esa misma tarde mandó el mensaje de preferencias actualizadas
(ver arriba). Con eso, se preparó el material completo de la Sesión 1 (protocolo de
`proceso-asesoria.md`: encuadre, número, mecanismo — NO la selección de 3, esa es Sesión 2).

**Búsqueda hecha para esta sesión** (`buscar_inventario.py`, 21 ago tarde):
- RAV4 2019-2024, <100k millas: 56 lotes bajados, 11 tras filtro de millaje. Se revisó la ficha de
  los 11 uno por uno (el listado no tiene filtro de tracción) y salieron **5 candidatos AWD reales**
  con versión equipada (XLE, XLE Premium, XSE, Limited, todos AWD, 3 de ellos híbridos) — ver tabla
  completa y costeo en `candidatos_awd_22ago.json`. Ninguno tiene fotos cargadas todavía (igual que
  pasó con los ejemplos de la sesión anterior — patrón que se repite en lotes recién publicados).
- Honda CR-V última generación (2023+): 13 lotes revisados, **ninguno viable** dentro de $15,000
  totales salvo uno con título Rebuilt (bloqueado por política de empresa aunque el precio calzara).
  Detalle completo en el mismo JSON.

**Hallazgo importante para dejar claro en la llamada:** el pedido del cliente de "salvage reparado"
NO es lo mismo que título Rebuilt. Reparado-pero-sigue-Salvage entra dentro de lo que ya se venía
evaluando; Rebuilt sigue bloqueado siempre por política de la empresa (`reglas-compra.md` A.2), sin
importar que el cliente lo acepte. El CR-V Rebuilt de Opa Locka (VIN 2HKRS3H48PH306628, $8,900 Buy
Now) es el ejemplo real para explicarlo con un caso concreto.

**Entregables generados hoy:**
- `entregable-cliente/Sesion1_Bienvenida_Carlos_R.pdf` — nuevo documento de marca LSC (plantilla
  `bienvenida` agregada a `render_pdf.py`): número, calendario de 5 sesiones/15 días, glosario
  (salvage vs limpio vs Rebuilt, Buy Now vs pujar, DS, AS IS), perfil de búsqueda confirmado, y un
  adelanto (no la selección formal) de los 5 candidatos AWD, con la respuesta honesta sobre el CR-V.
- `interno/Sesion1_Guion_Videollamada.md` — guion completo de la llamada: agenda por minutos,
  objeciones, riesgos a decir en voz alta, próximos pasos.
- `interno/candidatos_awd_22ago.json` — los 5 candidatos AWD con costeo completo por vehículo
  (`costeo.py reverso`, transporte estimado por millas reales al estado del cliente) y los 5 lotes
  de CR-V revisados con la razón de descarte de cada uno.
- `interno/Sesion1_Enlaces_y_Logistica.md` — enlaces a GitHub de cada entregable, plantilla del
  evento de Google Meet (no se pudo crear un link real — este entorno no tiene conector de
  Calendar/Meet, así que el asesor lo crea a mano con el texto ya redactado), y un mensaje de
  WhatsApp listo para pegar.

**Pendientes reales, sin resolver, que hay que cerrar antes o durante la sesión:**
1. **Contacto del cliente (correo/teléfono) no está en ningún archivo del expediente.** No se pudo
   generar la invitación de Meet ni el envío del mensaje sin esto — pedirlo apenas se pueda.
2. **Estado real del cliente sigue sin confirmar.** Todos los techos de oferta de hoy (igual que en
   el diagnóstico pre-pago) asumen destino Florida. Si el cliente vive en otro estado, hay que
   re-costear antes de la Sesión 2.
3. Los 5 candidatos AWD no tienen Carfax ni fotos — normal para Sesión 1, pero hay que revalidarlos
   (precios y disponibilidad cambian a diario) antes de usarlos en la Sesión 2, no reutilizar estos
   datos tal cual.
