# Briefing interno — Carlos R (pre-activación)

**Fecha:** 21 ago 2026 · **Asesor:** Richard Matos · **Estado:** aún NO pagó los $149

## Requerimiento del cliente
- Toyota RAV4, 2019–2024, ~100k millas (menos mejor)
- Presupuesto **total** (todo incluido): $15,000
- Preferencia fuerte: **título limpio**
- Aceptaría salvage/rebuilt **solo** si: daños leves cosméticos, sin bolsas desplegadas, sin daño estructural

## Techo real de oferta (costeo.py reverso, estado FL, transporte estimado $700)
- Presupuesto $15,000 → **oferta máxima en subasta ≈ $11,775** (título limpio)
- Costo total estimado con esa oferta: $14,981.96 (holgura $18)
- Con salvage la matemática es prácticamente igual (mismas tarifas/impuesto en este ejercicio) —
  el título limpio no penaliza el bolsillo aquí, penaliza la **disponibilidad**.

`[ESTIMADO]` la tarifa de subasta se calculó por escalón (`config/tarifas_subasta.json`), NO con
la calculadora oficial de LSC. El transporte también es estimado por distancia — falta el estado
real del cliente para afinarlo (asumí FL como placeholder). **Confirmar ambos antes de dar cifra
final al cliente.**

## Barrido preliminar (no intensivo — 113 lotes descargados, 31 tras filtrar año/modelo)
Fuente: `inventario_barrido_rav4_2019-2024.json`. Sin activación aún no se miraron fotos ni se
subió Carfax — todo lo de daño/bolsas está `[PENDIENTE FOTO]`.

Título limpio real en el rango de años/millaje: **solo 1** unidad (VIN 2T3W1RFV6PW276445, 2023,
38,301 mi, FL, XLE, "sin daños reportados" según ficha) — sin ofertas activas todavía, sin llaves
(`llaves: No`), sin Run & Drive. Ojo con eso en la llamada: aunque diga "sin daños reportados", sin
llaves es señal a investigar (robo recuperado / pérdida de llaves).

Salvage con daño leve, llaves sí, dentro de la oferta máxima ($11,775):
| VIN | Año | Millas | Título | Daño 1° | Llaves | R&D | Precio hoy |
|---|---|---|---|---|---|---|---|
| 2T3H1RFV8NC197432 | 2022 | 63,228 | Salvage colisión | Trasero | Sí | Sí | Oferta actual $175 (subasta 3 días) |
| 2T3W1RFV7LW102815 | 2020 | 69,986 | Salvage colisión | Frontal | Sí | **No** | Buy Now $7,800 (subasta 3 días) |
| 2T3A1RFVXKW071424 | 2019 | 80,594 | Salvage colisión | Frontal | Sí | No | Buy Now $7,500 (subasta vencida, revisar vigencia) |

También hay un "Título Limpio – Recuperación de Robo" 2024, AWD híbrido, 18,557 mi, NY, oferta
actual $225 — millaje excelente pero **hay que explicarle el matiz de recuperación de robo** (no es
lo mismo que limpio "normal"; cuenta 11/15 en la rúbrica, no 15/15).

## Para la llamada
- Sé claro con el número: de $15,000 solo ~$11,775 son para pujar. Es la conversación entera.
- Con título limpio puro, hoy hay 1 candidato real y sin oferta activa — no hay 3 para mostrarle
  todavía. No prometas 3 opciones limpias; ofrece monitoreo diario post-activación.
- Con salvage leve sí hay 2–3 reales y baratos, dejando margen para pujar sin acercarse al techo.
- Faltan por confirmar: estado real del cliente (para tax bracket y transporte), tarifa real de
  subasta en la calculadora de LSC, fotos y Carfax de cada candidato (todo eso es ya trabajo de la
  búsqueda intensiva post-pago, no de este adelanto).

## Objeción probable
"¿Por qué solo $11,775 si tengo $15,000?" → porque el presupuesto es el costo total: oferta +
tarifa de subasta + tarifa LSC ($799) + impuesto (7%) + titulación (~$355) + transporte (~$820).
El desglose completo está en el PDF que se le envía.
