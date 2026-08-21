# Guion interno — Sesión 1 (Encuadre) — Carlos R

**Fecha de la sesión:** 22 de agosto de 2026 (día 1 de 15) · **Asesor:** Richard Matos
**Estado del cliente:** PAGÓ los $149 el 21 de agosto. Asesoría activa.
**Duración sugerida:** 30–40 min.

---

## Objetivo de esta sesión

Por protocolo (`proceso-asesoria.md`, Sesión 1 — Encuadre), en esta llamada NO se muestran los 3
finalistas todavía — eso es la Sesión 2. Aquí se cierra el número, se explica el mecanismo completo,
y se confirma el perfil de búsqueda. Los 5 candidatos AWD que se traen abajo son un **adelanto**
para demostrar que ya hay movimiento real, no la selección formal.

Salida de la sesión: perfil cerrado, expectativas alineadas, cliente entiende el proceso y el número.

---

## 1. Confirmar necesidades y presupuesto (5 min)

Ya lo tenemos del diagnóstico pre-pago, pero se repite en voz para que el cliente lo escuche
confirmado: Toyota RAV4 2019–2024, menos de 100,000 millas, presupuesto **total** $15,000.

**Actualización que llegó por mensaje del cliente la tarde del 21 ago — leerla en voz alta y
confirmar que se entendió bien:**
1. Priorizar tracción **AWD** y versiones más equipadas (no la base LE).
2. Honda **CR-V de última generación** como alternativa, **si alcanza el presupuesto**.
3. No descartar título **salvage ya reparado previamente**.

**Sobre el punto 3 — explicar la distinción con cuidado, es la parte más delicada de la sesión:**
"Salvage reparado" (alguien ya arregló la carrocería, pero el título sigue siendo Salvage) **sí
entra** dentro de lo que ya evaluamos — es lo mismo que "salvage con daño leve" que el cliente ya
había aceptado, solo que ahora la reparación ya se hizo antes de subastarlo. Es distinto de un
título **Rebuilt / Reconstruido** (el estado ya lo re-certificó como legal para circular) — **ese
tipo de título la empresa no lo compra bajo ninguna circunstancia**, aunque el cliente lo acepte.
Usa el ejemplo real de abajo (CR-V 2023 Rebuilt de Opa Locka) para que quede claro con un caso
concreto, no en abstracto.

**Preguntas pendientes de confirmar en esta sesión** (bloquean el costeo fino):
- Estado real donde vive/recibirá el carro (hasta ahora se ha asumido FL en los cálculos —
  **confirmar**, cambia transporte e impuesto).
- Si financia o paga de contado.
- Si quiere que LSC gestione transporte y chapa, o lo hace él mismo.

---

## 2. Entregar el número (10 min)

"Tus $15,000 totales son aproximadamente $11,950 de oferta en subasta con título limpio, o hasta
~$11,225–$11,775 en salvage AWD dependiendo de dónde esté el carro (el transporte varía)." — Ver
`entregable-cliente/Sesion1_Bienvenida_Carlos_R.pdf`, hero de la página 1.

Explicar por qué la diferencia no se pierde: tarifa de subasta + tarifa LSC ($799) + impuesto (7%
sobre la oferta) + titulación (~$355) + transporte (varía por ubicación real del vehículo, $500 en
Florida hasta $1,300+ costa a costa).

---

## 3. Explicar el mecanismo (10 min)

Usar el PDF de bienvenida como guía visual compartiendo pantalla — ya trae el glosario completo:
- Salvage vs título limpio vs Rebuilt (la distinción del punto 1 arriba).
- Buy Now (compra segura, precio cerrado) vs pujar (sube contra otros compradores, nunca por
  encima del techo que se fija juntos).
- Qué cubre la asesoría (5 sesiones Meet, subastas privadas dealer, historial, Carfax bajo pedido,
  recomendación de oferta) y qué no (inspección física, prueba de manejo).
- El Depósito de Seguridad: se pide en la Sesión 4, no hoy. Mencionarlo ahora para que no
  sorprenda.

**Las tres frases que hay que decir en voz alta, siempre:**
1. "El depósito no se devuelve si ganamos el carro y tú decides no seguir."
2. "El almacenaje lo pagas tú desde el día que se gana la subasta, aunque nosotros coordinemos el
   transporte."
3. "El carro se compra AS IS: como está. Analizamos historial, ficha e imágenes, pero nadie lo
   prueba en carretera antes."

---

## 4. Adelanto: lo que ya hay en su perfil actualizado (10 min)

**Búsqueda hecha el 21 ago (tarde) sobre `lasubastacubana.com`, filtrando por AWD real en la ficha
de cada lote** (no por el listado, que no tiene ese filtro — se revisó ficha por ficha). Detalle
completo, con costeo y fuente, en `interno/candidatos_awd_22ago.json`.

| # | Vehículo | Millas | Título | Ubicación | Subasta | Techo de oferta |
|---|---|---|---|---|---|---|
| 1 | 2024 RAV4 XLE AWD | 34,588 | Salvage — robo recuperado, llaves, Run&Drive | Lawrenceburg, KY | 26 ago | $11,775 |
| 2 | 2024 RAV4 LE Híbrida AWD | 18,557 | **Título limpio** — recuperación de robo, llaves, Run&Drive | Brookhaven, NY | 27 ago | $11,550 |
| 3 | 2021 RAV4 XSE Híbrida AWD | 55,526 | Salvage — daño frontal colisión, llaves, Run&Drive | Lebanon, TN | 24 ago | $11,775 |
| 4 | 2021 RAV4 XLE Premium Híbrida AWD | 70,208 | Salvage — robo recuperado, llaves, Run&Drive | Theodore, AL | 25 ago | $11,775 |
| 5 | 2019 RAV4 Limited AWD | 63,216 | Salvage — robo recuperado, llaves, Run&Drive | Littleton, CO | 24 ago | $11,225 |

**Ojo, decirlo con honestidad al cliente:** ninguno de los 5 tiene fotos cargadas en su ficha
todavía — se confirmó lote por lote con `buscar_inventario.py --fotos`. No es que no se buscaron;
la ficha genuinamente no las tiene hoy. Se están monitoreando a diario.

**Sobre "robo recuperado" (Recuperación de Robo)** en 3 de los 5: el carro fue robado y apareció.
Riesgo real: piezas faltantes, daño de encendido forzado. Hay que mirar el interior con lupa en
cuanto haya fotos — pendiente explícito, no ocultarlo.

**Fechas de subasta:** las 5 son en 2–5 días (24–27 ago), caben bien dentro de la ventana de 15
días. Si el cliente reacciona bien a alguno en esta sesión, se puede adelantar el Carfax para la
Sesión 2 en vez de esperar a la Sesión 3.

**Sobre el Honda CR-V (última generación, 2023+):** se buscó a fondo (13 lotes revisados). **No es
viable hoy dentro de $15,000 totales.** El Compra Inmediata real más barato que cumple política de
empresa es $14,800 — ya por encima del techo de oferta. Apareció uno de $8,900 que sí calzaría en
presupuesto, pero tiene título **Rebuilt/Reconstruido** — bloqueado por política de la empresa, no
se puede ofrecer aunque el precio sea bueno. Es el ejemplo perfecto para explicar la distinción
Salvage-reparado vs Rebuilt del punto 1. Decirle al cliente que se sigue monitoreando el CR-V a
diario, sin prometer que va a aparecer algo.

---

## Objeciones probables

**"¿Por qué el techo es $11,950/$11,775 si tengo $15,000?"**
→ Presupuesto = costo total. Oferta + tarifa subasta (~$330, estimada) + tarifa LSC ($799) +
impuesto 7% + titulación (~$355) + transporte ($500–$1,300 según ubicación real del carro).
Desglose completo en el PDF.

**"¿Por qué no me buscan CR-V si lo pedí?"**
→ Sí se buscó (13 lotes revisados). El más barato que cumple con la política de la empresa cuesta
$14,800, fuera de presupuesto. El único dentro de presupuesto tiene título Rebuilt, que la empresa
no compra. Seguimos monitoreando, pero hoy el volumen real está en RAV4 AWD.

**"¿Un salvage reparado no es lo mismo que uno Rebuilt?"**
→ No. Reparado-pero-sigue-Salvage sí se puede comprar (ya estaba dentro de lo que aceptaba antes).
Rebuilt es una categoría de título distinta, ya recertificada por el estado, y la empresa no la
compra — política fija, no depende de que al cliente le parezca bien.

**"¿Por qué ninguno de los 5 tiene foto?"**
→ Son lotes recién publicados (fecha de actualización 18 ago) — todavía no cargan fotos en la
ficha pública. Se monitorean a diario; en cuanto aparezcan se revisan antes de presentarlas.

**"¿Puedo recuperar el depósito si me arrepiento?"**
→ Depende de cuándo. Antes de ganar la subasta, sí (cláusula 5.4, con 24h hábiles de antelación).
Si ya ganamos el carro y te echas atrás, no (cláusula 6.8).

---

## Riesgos que hay que decir en voz alta esta sesión

- 3 de los 5 candidatos AWD son "robo recuperado" — riesgo de piezas faltantes/encendido forzado,
  pendiente de fotos para confirmar.
- Ninguno de los 5 tiene Carfax todavía — se pide en Sesión 2/3 sobre el favorito.
- La tarifa de subasta en todos los cálculos es **estimada**, se confirma en la calculadora oficial
  de LSC antes de dar una cifra final de compra.
- El estado de destino del cliente sigue sin confirmar — todos los cálculos de techo de oferta
  asumen Florida. Si el cliente vive en otro estado, el impuesto y el transporte cambian y hay que
  re-costear antes de la Sesión 2.

---

## Próximo paso concreto

1. Confirmar estado de destino, financiamiento, y si gestiona transporte/chapa él mismo.
2. Preguntar reacción a los 5 AWD y a la explicación del CR-V — anotar cuáles le laten más.
3. Agendar Sesión 2 dentro de la ventana 24–26 ago (según lo que reaccione mejor: si le gusta
   alguno de los que se subasta el 24, puede convenir adelantar la sesión a esa fecha).
4. Antes de la Sesión 2: revalidar los 5 candidatos (precios/fechas cambian a diario — no
   reutilizar estos datos sin revisar de nuevo), y sumar 2–3 más para tener respaldo si alguno se
   vende o se retira.
