# Enlaces y logística — Sesión 1, 22 de agosto de 2026

## Aviso importante sobre el link de la videollamada

**Este entorno de trabajo no tiene acceso a Google Calendar/Meet — no existe conector disponible
para crearlo automáticamente.** No se generó ningún link de Meet real; cualquier link
`meet.google.com/xxx-xxxx-xxx` que no salga de tu propia cuenta de Google sería inventado, y la
regla de esta skill es no inventar datos. **Tienes que crear tú el evento** con el texto de abajo
(copiar/pegar en Google Calendar) — el link se genera solo al crear el evento y ahí sí es real.

**Plantilla del evento (copiar en Google Calendar → Nuevo evento → Agregar videollamada de Meet):**

```
Título:     La Subasta Cubana — Asesoría Carlos R — Sesión 1 de 5 (Encuadre)
Fecha:      22 de agosto de 2026
Duración:   30–40 min (sugerido: bloquear 45 min por si se extiende)
Invitados:  [correo de Carlos R — PENDIENTE, no está guardado en el expediente del cliente]
Descripción:
  Sesión 1 de 5 de tu asesoría en La Subasta Cubana.
  Vamos a revisar: tu número real de oferta, cómo funciona el proceso paso a paso,
  y tu perfil de búsqueda actualizado (RAV4 AWD, alternativa CR-V, salvage reparado).
  Documento de apoyo: se comparte en pantalla durante la llamada.
```

**Falta el contacto del cliente (correo y/o teléfono) para poder invitarlo — no está en ningún
archivo del expediente.** Pídeselo a Carlos R por el canal donde ya se coordinó el pago de los
$149, y agrégalo a este archivo o a `briefing.md` en cuanto lo tengas, para no volver a
preguntarlo.

---

## Entregables de esta sesión (rutas locales, dentro del repo)

**Para compartir con el cliente:**
- `clientes/Richard Matos/Carlos R/entregable-cliente/Sesion1_Bienvenida_Carlos_R.pdf` — documento
  nuevo de esta sesión: número, calendario de 5 sesiones, glosario, perfil confirmado, adelanto de
  5 candidatos AWD, respuesta honesta sobre el CR-V.
- `clientes/Richard Matos/Carlos R/entregable-cliente/Diagnostico_Viabilidad_Carlos_R.pdf` — el de
  la sesión pre-pago, sigue siendo válido como respaldo del número.

**Para ti (interno, no se le manda al cliente):**
- `clientes/Richard Matos/Carlos R/interno/Sesion1_Guion_Videollamada.md` — guion completo con
  objeciones y riesgos.
- `clientes/Richard Matos/Carlos R/interno/candidatos_awd_22ago.json` — los 5 candidatos AWD con
  costeo completo y las notas del CR-V descartado, con la fuente de cada dato.
- `clientes/Richard Matos/Carlos R/interno/briefing.md` — historial completo del caso, actualizado
  hoy con el mensaje del cliente y los hallazgos de esta búsqueda.

## Enlaces en GitHub (rama `claude/rav4-search-carlos-r-9qpid8`)

Una vez el push termine, estos enlaces abren directo en el navegador (usa el de "blob" para vista
previa en GitHub, o el "raw" para descarga directa — útil si quieres reenviar el PDF por WhatsApp
Web sin pasar por GitHub):

- Bienvenida (cliente): `https://github.com/Pol4720/LSC/blob/claude/rav4-search-carlos-r-9qpid8/clientes/Richard%20Matos/Carlos%20R/entregable-cliente/Sesion1_Bienvenida_Carlos_R.pdf`
- Diagnóstico de Viabilidad (cliente): `https://github.com/Pol4720/LSC/blob/claude/rav4-search-carlos-r-9qpid8/clientes/Richard%20Matos/Carlos%20R/entregable-cliente/Diagnostico_Viabilidad_Carlos_R.pdf`
- Guion de la sesión (interno): `https://github.com/Pol4720/LSC/blob/claude/rav4-search-carlos-r-9qpid8/clientes/Richard%20Matos/Carlos%20R/interno/Sesion1_Guion_Videollamada.md`
- Candidatos AWD con costeo (interno): `https://github.com/Pol4720/LSC/blob/claude/rav4-search-carlos-r-9qpid8/clientes/Richard%20Matos/Carlos%20R/interno/candidatos_awd_22ago.json`
- Briefing completo (interno): `https://github.com/Pol4720/LSC/blob/claude/rav4-search-carlos-r-9qpid8/clientes/Richard%20Matos/Carlos%20R/interno/briefing.md`

Estos links apuntan a la rama de trabajo, no a `main` — mientras no se abra y mezcle un PR, es
donde vive el contenido más reciente. Si en algún momento se hace merge a `main`, cambia
`claude/rav4-search-carlos-r-9qpid8` por `main` en la URL.

## Mensaje listo para WhatsApp (al cliente, antes de la llamada)

Cámbialo si hace falta, pero está redactado para pegar directo:

```
Hola Carlos, aquí Richard de La Subasta Cubana. Ya activamos tu asesoría — mañana [22 de agosto]
tenemos nuestra primera sesión. Te mando el link de la videollamada [PENDIENTE: pegar aquí el link
de Meet una vez creado el evento] y un documento con el número real con el que vamos a trabajar,
cómo funciona el proceso paso a paso, y ya estamos mirando varias opciones con lo que me
comentaste (tracción AWD, más equipados, y la Honda CR-V). Cualquier duda antes de la llamada,
escríbeme por aquí.

[adjuntar Sesion1_Bienvenida_Carlos_R.pdf]
```

**Pendientes antes de poder mandar esto de verdad:** contacto del cliente (correo/teléfono) y el
link real de Meet una vez creado el evento arriba.
