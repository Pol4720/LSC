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

### Sobre "llaves"
El #1 (título limpio) figura con `llaves: No` en la ficha. Vale la pena preguntarlo/confirmarlo en la llamada — no es descalificante pero si de verdad no tiene llaves hay que sumar el costo de llave con transponder ($200-400) y es una señal a vigilar (aunque el título es limpio, no recuperación de robo).

## Vehículos vendidos como comparables (pedido del cliente/lo que pidió Richard)
Pediste incluir comparables ya vendidos para reforzar la viabilidad — es una buena idea y coincide con lo que dice `busqueda-inventario.md` sobre usar bid.cars para calibrar precios. **No pude traerlos yo: bid.cars está bloqueado por la política de red de este entorno (egress bloqueado).** El inventario propio de lasubastacubana.com tampoco guarda histórico de vendidos, solo lotes activos — lo confirmé con `--descubrir` sobre el formulario de filtros.

Acción para ti: si tienes acceso normal a internet, entra a bid.cars y busca "Toyota RAV4" 2019-2024, título limpio y salvage con daño leve, para sacar 2-3 precios de cierre reales de las últimas semanas. Eso sí lo puedes meter en la próxima versión del PDF como prueba de mercado — yo no puedo inventar esa cifra.

## Para la llamada
- Lidera con el número bueno: $15,000 totales sí alcanzan, incluso en título limpio — la unidad #1 lo prueba.
- El mensaje no es "renuncia a título limpio", es "el título limpio en este rango se mueve rápido, por eso conviene tener a alguien buscando todos los días" — eso es literalmente lo que vende la asesoría.
- El salvage no es un plan B triste: el #3 cuesta menos de $8,000 de Compra Inmediata y deja mucho margen dentro del presupuesto.
- Confirmar antes de la llamada: mecanismo de compra del #1 (sin fecha de subasta), estado real del cliente (para afinar impuesto/transporte si su destino final no es Florida), y si puedes, 2-3 comparables vendidos de bid.cars.

## Objeción probable
"¿Por qué solo $11,950 si tengo $15,000?" → porque el presupuesto es el costo total: oferta + tarifa de subasta + tarifa LSC ($799) + impuesto (7%) + titulación (~$355) + transporte (varía según dónde esté el carro, por eso el PDF ya no usa un número plano). El desglose completo está en el PDF que se le envía.
