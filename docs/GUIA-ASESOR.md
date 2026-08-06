# Guía del asesor

Todo lo que necesitas para usar la herramienta, sin tecnicismos.

---

## 1 · La primera vez

### Crea tus claves

Abre **`console.html`**. Verás una pantalla que te pide una contraseña.

1. Escribe una contraseña de al menos 10 caracteres. **Anótala donde no se
   pierda.** Es la única llave de tus datos.
2. Pulsa *Crear claves y continuar*. Se descarga automáticamente un archivo
   `lsc-backup-XXXX.json`: **guárdalo** en un lugar seguro (una memoria USB, un
   correo a ti mismo, tu gestor de contraseñas).
3. Aparece tu **clave pública**. Publícala para que el formulario pueda cifrar
   lo que envían los clientes:
   * si ya configuraste el token de GitHub → *Publicar en el repo*;
   * si no → *Descargar* y súbela a mano a `data/config/advisor-key.json`.

> Sin esa clave pública el formulario sigue funcionando, pero los envíos van sin
> cifrar por el enlace en vez de guardarse sellados.

### Conecta el repositorio

**Ajustes → Repositorio**:

1. Ve a <https://github.com/settings/personal-access-tokens/new>.
2. *Repository access* → **Only select repositories** → `Pol4720/LSC`.
3. *Permissions* → *Repository permissions* → **Contents: Read and write**.
4. Copia el token (`github_pat_…`) y pégalo en Ajustes.
5. Pulsa **Guardar y probar**. Debe salir `✅ Pol4720/LSC · con permiso de escritura`.

El token vive solo en este navegador. Si cambias de computadora tendrás que
volver a pegarlo (y a restaurar tu respaldo de claves).

---

## 2 · Conseguir la información del cliente

Tienes tres formas, y todas terminan igual: el cliente aparece en tu consola.

### a) Enviarle el enlace

**Clientes → Enlace del formulario**. Copia el que necesites:

| Enlace | Cuándo usarlo |
|---|---|
| Formulario completo (español) | El caso normal |
| Formulario completo (inglés) | Cliente que prefiere inglés |
| Formulario exprés | Cliente con prisa o poco paciente |
| Modo asesor | Lo rellenas tú |

El cliente lo abre en el celular, responde cuando quiera (se guarda solo si lo
deja a medias) y al final elige **WhatsApp**. Te llega un enlace. Lo abres, y el
cliente entra en tu consola ya descifrado.

### b) Rellenarlo tú en la videollamada

Abre el enlace de **modo asesor** y comparte pantalla. Ir preguntando en voz
alta mientras el cliente ve las opciones funciona muy bien: los cuadros con
emoji y las explicaciones de cada término hacen la conversación sola.

### c) Un archivo

Si el cliente descargó el `.json`, arrástralo a **Importar**.

---

## 3 · Trabajar la cartera

### Buscar

La barra de arriba busca en todo: nombre, teléfono, ciudad, marca, modelo,
notas y etiquetas. No hace falta poner acentos — *"maria"* encuentra *"María"*.

### Filtrar

Debajo del título: etapa, prioridad y rango de presupuesto.

### Mover por el embudo

**Embudo** muestra las 10 etapas. Arrastra la tarjeta de una columna a otra.
También puedes cambiar la etapa desde la ficha del cliente.

```
Nuevo → Contactado → Asesoría agendada → Requisitos levantados
      → Buscando ofertas → Ofertas enviadas → Pujando → Ganado → Entregado
                                                              ↘ Perdido
```

### La ficha del cliente

| Pestaña | Para qué |
|---|---|
| **Perfil** | Lo esencial de un vistazo + *Claves para la asesoría*: avisos automáticos ("necesita que le expliques cómo funciona la subasta", "caso de exportación", "reglas de Uber"). |
| **Requisitos** | Todo lo que respondió. *Editar respuestas* para corregir lo que cambió en la llamada. |
| **Embudo y notas** | Etapa, prioridad, etiquetas y la bitácora: una entrada por llamada, sesión u oferta enviada. |
| **Lotes objetivo** | Pega enlaces de Copart / IAA / bid.cars. Detecta solo el número de lote y el VIN. Abajo tienes los atajos a Copart, IAA, bid.cars, AutoAstat, Carfax y Super Dispatch ya filtrados por la marca del cliente. |
| **Plan de costos** | La calculadora con los datos del cliente precargados. *Guardar en el cliente* deja el desglose en la bitácora. |

---

## 4 · La calculadora

Funciona en dos direcciones:

* **Tengo un presupuesto** → te dice hasta cuánto puedes pujar sin pasarte.
  Redondea a múltiplos de $25, que es como incrementan las subastas.
* **Sé la puja** → te dice el total real que pagará el cliente.

Incluye buyer fee, cargo por puja en línea, gate fee, cargo ambiental,
documentación, impuesto, comisión de representación, transporte terrestre,
título y notaría, exportación (RoRo o contenedor) y reparación.

> Las tarifas por defecto son **estimados editables**. Cuando Copart o IAA
> cambien su tarifario, actualízalo en **Ajustes → Tablas de tarifas**.
> Confirma siempre contra el tarifario vigente antes de comprometer una puja.

---

## 5 · Exportar

Botón **Exportar** (en Panel, en Clientes o en la ficha de un cliente).

| Formato | Para qué |
|---|---|
| **CSV (Excel)** | Una fila por cliente, una columna por pregunta. Abre en Excel con los acentos correctos. |
| **CSV — una fila por respuesta** | Para tablas dinámicas y análisis. |
| **JSON** | Respaldo completo. |
| **Markdown** | Un informe legible de toda la cartera. |
| **vCard** | Los contactos, para importarlos al teléfono. |
| **Ficha imprimible / PDF** | Se abre lista para imprimir; elige "Guardar como PDF". |
| **Resumen WhatsApp** | Copia un resumen corto para pegar en un chat. |
| **iCal** | Las sesiones de asesoría, para tu calendario. |

Puedes exportar solo algunos: marca las casillas de las tarjetas
(o **Ctrl/Cmd + clic** sobre la tarjeta) y usa la barra que aparece abajo.

---

## 6 · Sincronizar

**Sincronizar** hace dos cosas:

* **baja** del repositorio las solicitudes que no tengas y las descifra;
* **sube** tus cambios de CRM (etapa, notas, etiquetas, lotes) ya cifrados.

Con *Sincronizar automáticamente* activado ocurre solo tras cada cambio.

Si trabajas en dos computadoras, restaura el respaldo de claves en la segunda
y sincroniza: verás la misma cartera.

---

## 7 · Preguntas frecuentes

**¿Y si pierdo la contraseña?**
Los registros cifrados no se recuperan. Por eso el respaldo. Si aún tienes la
consola abierta y desbloqueada, exporta todo a JSON antes de nada.

**¿Puede alguien leer los datos en GitHub?**
No. Lo que se sube es texto cifrado. Sin tu clave privada no hay forma de
leerlo.

**¿Y si un cliente no quiere llenar el formulario?**
Usa el modo asesor y lo llenas tú mientras hablan. O el exprés: 6 preguntas.

**¿Funciona sin internet?**
El formulario sí: el cliente puede responder offline y enviarlo después. La
consola necesita internet solo para sincronizar; buscar y editar funciona
offline con lo que ya tienes descargado.

**¿Cómo cambio o añado preguntas?**
`assets/js/schema.js`. Ver el README.

**¿Cómo borro un cliente?**
Selecciónalo y usa *Eliminar*. Eso lo quita de tu equipo; el archivo cifrado
sigue en el repositorio hasta que lo borres también allí.
