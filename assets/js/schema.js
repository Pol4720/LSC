/* =========================================================================
   LSC · Intake schema
   ---------------------------------------------------------------------------
   Declarative definition of the whole client questionnaire. The renderer in
   form.js knows nothing about cars — everything domain-specific lives here,
   so the advisor can add, reorder or reword questions without touching UI code.

   Field contract
   ──────────────
   id        dotted path into the answer object
   type      text | textarea | tel | email | url | number | money | year |
             select | segmented | radio | multi | chips | tags | slider |
             yearrange | switch | date | repeater | priority | info
   label     {es,en}                required for every visible field
   help      {es,en}                secondary line under the label
   glossary  key into GLOSSARY      renders an inline "?" explainer
   required  boolean | (data)=>bool
   showIf    (data) => boolean      conditional visibility
   express   boolean                included in the 5-minute express mode
   options   [{id,label,desc,emoji}]
   cols      1|2|3|4                grid density for choice tiles
   ========================================================================= */

import {
  AUCTIONS, TITLE_TYPES, DAMAGE_TYPES, BODY_TYPES, MAKES, POPULAR_MAKES,
  FEATURES, USE_CASES, PAYMENT_METHODS, CONTACT_CHANNELS, HEARD_FROM,
  US_STATES, CURRENT_YEAR,
} from './catalogs.js';

const yesNo = (extra = []) => [
  { id: 'yes', label: { es: 'Sí', en: 'Yes' } },
  { id: 'no', label: { es: 'No', en: 'No' } },
  ...extra,
];

const notSure = { id: 'unsure', label: { es: 'No estoy seguro', en: 'Not sure' } };

/* ========================================================================= */
export const STEPS = [

  /* ---------------------------------------------------------- 1 · welcome */
  {
    id: 'welcome',
    icon: 'sparkles',
    kind: 'intro',
    title: { es: 'Encontremos tu auto ideal', en: "Let's find your ideal car" },
    subtitle: {
      es: 'Cuéntanos qué necesitas y buscaremos por ti en Copart, IAA, Manheim y ACV hasta dar con la mejor oferta. Son unos minutos y puedes pausar cuando quieras: tus respuestas se guardan solas.',
      en: 'Tell us what you need and we will hunt across Copart, IAA, Manheim and ACV until we find the best deal. It takes a few minutes and you can pause anytime — your answers save themselves.',
    },
    fields: [],
  },

  /* ---------------------------------------------------------- 2 · contact */
  {
    id: 'contact',
    icon: 'user',
    emoji: '👋',
    express: true,
    title: { es: 'Cómo te contactamos', en: 'How we reach you' },
    subtitle: {
      es: 'Solo lo necesario para responderte rápido. Tus datos viajan cifrados y no se comparten con nadie.',
      en: 'Only what we need to get back to you fast. Your data travels encrypted and is never shared.',
    },
    fields: [
      {
        id: 'contact.fullName', type: 'text', express: true, required: true,
        label: { es: '¿Cómo te llamas?', en: "What's your name?" },
        placeholder: { es: 'Nombre y apellidos', en: 'First and last name' },
        autocomplete: 'name', width: 'full',
        validate: (v) => (String(v).trim().length < 3 ? 'err.minLen:3' : null),
      },
      {
        id: 'contact.phone', type: 'tel', express: true, required: true,
        label: { es: 'Teléfono / WhatsApp', en: 'Phone / WhatsApp' },
        help: { es: 'Incluye el código de país, por ejemplo +1 786 555 0100.', en: 'Include the country code, e.g. +1 786 555 0100.' },
        placeholder: '+1 786 555 0100', autocomplete: 'tel', width: 'half',
      },
      {
        id: 'contact.email', type: 'email', express: true,
        label: { es: 'Correo electrónico', en: 'Email' },
        help: { es: 'Para enviarte las fichas de los autos y el resumen.', en: 'So we can send you lot sheets and your summary.' },
        placeholder: 'tucorreo@ejemplo.com', autocomplete: 'email', width: 'half',
      },
      {
        id: 'contact.city', type: 'text',
        label: { es: 'Ciudad', en: 'City' }, placeholder: { es: 'Hialeah, Miami…', en: 'Hialeah, Miami…' },
        autocomplete: 'address-level2', width: 'half',
      },
      {
        id: 'contact.state', type: 'select',
        label: { es: 'Estado', en: 'State' }, width: 'half',
        options: US_STATES.map(([id, label]) => ({ id, label: `${id} · ${label}` })),
      },
      {
        id: 'contact.channel', type: 'multi', express: true, cols: 3,
        label: { es: '¿Por dónde prefieres que te escribamos?', en: 'How should we contact you?' },
        options: CONTACT_CHANNELS,
        required: true,
        validate: (v) => (!v || !v.length ? 'err.minSelect:1' : null),
      },
      {
        id: 'contact.bestTime', type: 'segmented',
        label: { es: '¿Mejor momento para hablar?', en: 'Best time to talk?' },
        options: [
          { id: 'morning', label: { es: 'Mañana', en: 'Morning' }, emoji: '🌅' },
          { id: 'afternoon', label: { es: 'Tarde', en: 'Afternoon' }, emoji: '🌤️' },
          { id: 'evening', label: { es: 'Noche', en: 'Evening' }, emoji: '🌙' },
          { id: 'any', label: { es: 'Cualquiera', en: 'Anytime' }, emoji: '⏰' },
        ],
      },
      {
        id: 'contact.language', type: 'segmented',
        label: { es: 'Idioma para la asesoría', en: 'Language for the advisory' },
        options: [
          { id: 'es', label: 'Español', emoji: '🇪🇸' },
          { id: 'en', label: 'English', emoji: '🇺🇸' },
          { id: 'both', label: { es: 'Cualquiera', en: 'Either' }, emoji: '🌎' },
        ],
      },
      {
        id: 'contact.heardFrom', type: 'select',
        label: { es: '¿Cómo nos conociste?', en: 'How did you hear about us?' },
        options: HEARD_FROM, width: 'half',
      },
      {
        id: 'contact.heardFromDetail', type: 'text',
        label: { es: 'Cuéntanos más', en: 'Tell us more' },
        placeholder: { es: '¿Quién te recomendó?', en: 'Who referred you?' },
        width: 'half',
        showIf: (d) => ['referral', 'other'].includes(d?.contact?.heardFrom),
      },
    ],
  },

  /* ------------------------------------------------------------- 3 · goal */
  {
    id: 'goal',
    icon: 'route',
    emoji: '🎯',
    express: true,
    title: { es: '¿Para qué necesitas el auto?', en: 'What do you need the car for?' },
    subtitle: {
      es: 'Esto cambia por completo qué autos te conviene comprar. Sé honesto: no hay respuesta incorrecta.',
      en: 'This completely changes which cars make sense for you. Be honest — there is no wrong answer.',
    },
    fields: [
      {
        id: 'goal.useCases', type: 'multi', express: true, required: true, cols: 3,
        label: { es: 'Selecciona todo lo que aplique', en: 'Select everything that applies' },
        options: USE_CASES,
        validate: (v) => (!v || !v.length ? 'err.minSelect:1' : null),
      },
      {
        id: 'goal.rideshareNote', type: 'info', variant: 'warn',
        showIf: (d) => (d?.goal?.useCases || []).includes('rideshare'),
        label: { es: 'Ojo con los requisitos de Uber/Lyft', en: 'Mind the Uber/Lyft requirements' },
        help: {
          es: 'Las plataformas exigen normalmente un auto de 15 años o menos, 4 puertas, en buen estado y con título limpio (rebuilt suele ser rechazado). Lo tendremos en cuenta al buscar.',
          en: 'These platforms typically require a car 15 years old or newer, 4 doors, in good condition and with a clean title (rebuilt is usually rejected). We will factor that in.',
        },
      },
      {
        id: 'goal.exportNote', type: 'info', variant: 'brand',
        showIf: (d) => (d?.goal?.useCases || []).includes('export'),
        label: { es: 'Exportación', en: 'Export' },
        help: {
          es: 'Más adelante te preguntamos el país y puerto de destino para calcular naviera, aduana y seguro marítimo.',
          en: 'We will ask for destination country and port later so we can price ocean freight, customs and marine insurance.',
        },
      },
      {
        id: 'goal.experience', type: 'radio', express: true, cols: 3,
        label: { es: '¿Has comprado antes en subasta?', en: 'Have you bought at auction before?' },
        options: [
          { id: 'none', label: { es: 'Es mi primera vez', en: 'First time' }, emoji: '🌱', desc: { es: 'Te explicaremos todo paso a paso', en: 'We will walk you through everything' } },
          { id: 'some', label: { es: 'Algo sé', en: 'Some experience' }, emoji: '📘', desc: { es: 'He mirado lotes pero nunca compré', en: 'I have browsed lots but never bought' } },
          { id: 'expert', label: { es: 'Ya he comprado', en: 'I have bought before' }, emoji: '🎓', desc: { es: 'Conozco fees, títulos y transporte', en: 'I know fees, titles and transport' } },
        ],
      },
      {
        id: 'goal.passengers', type: 'segmented',
        label: { es: '¿Cuántas personas viajan normalmente?', en: 'How many people usually ride?' },
        options: [
          { id: '1-2', label: '1-2' }, { id: '3-4', label: '3-4' },
          { id: '5', label: '5' }, { id: '6+', label: '6+' },
        ],
      },
      {
        id: 'goal.monthlyMiles', type: 'segmented',
        label: { es: '¿Cuánto manejas al mes?', en: 'How much do you drive monthly?' },
        help: { es: 'Ayuda a decidir entre consumo bajo o durabilidad.', en: 'Helps us weigh fuel economy versus durability.' },
        options: [
          { id: 'low', label: { es: 'Poco (<500 mi)', en: 'Little (<500 mi)' } },
          { id: 'mid', label: { es: 'Normal (500-1500 mi)', en: 'Normal (500-1500 mi)' } },
          { id: 'high', label: { es: 'Mucho (>1500 mi)', en: 'A lot (>1500 mi)' } },
        ],
      },
    ],
  },

  /* ----------------------------------------------------------- 4 · budget */
  {
    id: 'budget',
    icon: 'calc',
    emoji: '💵',
    express: true,
    title: { es: 'Tu presupuesto', en: 'Your budget' },
    subtitle: {
      es: 'Trabajamos con números reales: precio del auto + comisiones + transporte + papeles. Dinos cuánto puedes gastar en total y calculamos hasta dónde podemos pujar.',
      en: 'We work with real numbers: car price + fees + transport + paperwork. Tell us your all-in ceiling and we compute how high we can bid.',
    },
    fields: [
      {
        id: 'budget.total', type: 'money', express: true, required: true,
        label: { es: 'Presupuesto total, todo incluido', en: 'Total all-in budget' },
        help: {
          es: 'Todo lo que estás dispuesto a gastar hasta tener el auto en tus manos.',
          en: 'Everything you are willing to spend until the car is in your hands.',
        },
        min: 500, max: 150000, step: 250, slider: true, sliderMax: 60000,
        validate: (v) => (Number(v) < 500 ? 'err.min:500' : null),
      },
      {
        id: 'budget.includesEverything', type: 'radio', cols: 3,
        label: { es: '¿Ese monto incluye comisiones y transporte?', en: 'Does that amount include fees and transport?' },
        options: [
          { id: 'all', label: { es: 'Sí, todo incluido', en: 'Yes, all in' }, emoji: '✅' },
          { id: 'caronly', label: { es: 'No, es solo el auto', en: 'No, that is just the car' }, emoji: '🚗' },
          { ...notSure, emoji: '🤔' },
        ],
      },
      {
        id: 'budget.flexibility', type: 'slider',
        label: { es: '¿Cuánta flexibilidad tienes?', en: 'How flexible is that number?' },
        help: { es: 'Si aparece la oportunidad perfecta, ¿cuánto más podrías estirar?', en: 'If the perfect opportunity shows up, how much further could you stretch?' },
        min: 0, max: 40, step: 5, unit: '%', default: 10,
        format: (v, lang) => (Number(v) === 0
          ? (lang === 'en' ? 'Not a dollar more' : 'Ni un dólar más')
          : `+${v}%`),
      },
      {
        id: 'budget.payment', type: 'multi', cols: 3, express: true,
        label: { es: '¿Cómo pagarías?', en: 'How would you pay?' },
        options: PAYMENT_METHODS,
      },
      {
        id: 'budget.financingNote', type: 'info', variant: 'info',
        showIf: (d) => (d?.budget?.payment || []).includes('financing'),
        label: { es: 'Sobre el financiamiento', en: 'About financing' },
        help: {
          es: 'Los autos de subasta con título salvage no suelen aceptarse como garantía de un préstamo bancario. Lo hablamos en la asesoría y buscamos alternativas.',
          en: 'Salvage-title auction cars are rarely accepted as collateral for a bank loan. We will discuss alternatives during your session.',
        },
      },
      {
        id: 'budget.depositReady', type: 'radio', cols: 3,
        label: { es: '¿Estás listo para el depósito de seguridad?', en: 'Are you ready for the security deposit?' },
        glossary: 'deposit',
        options: [
          { id: 'ready', label: { es: 'Sí, listo', en: 'Yes, ready' }, emoji: '💪' },
          { id: 'soon', label: { es: 'En unos días', en: 'In a few days' }, emoji: '📆' },
          { id: 'explain', label: { es: 'Explícame primero', en: 'Explain it to me first' }, emoji: '❓' },
        ],
      },
      {
        id: 'budget.urgency', type: 'radio', express: true, cols: 3,
        label: { es: '¿Para cuándo lo necesitas?', en: 'When do you need it?' },
        options: [
          { id: 'asap', label: { es: 'Lo antes posible', en: 'As soon as possible' }, emoji: '🚨' },
          { id: '2weeks', label: { es: 'En 2 semanas', en: 'Within 2 weeks' }, emoji: '⏳' },
          { id: 'month', label: { es: 'Este mes', en: 'This month' }, emoji: '📅' },
          { id: 'quarter', label: { es: 'En 1-3 meses', en: 'In 1-3 months' }, emoji: '🗓️' },
          { id: 'browsing', label: { es: 'Sin prisa, explorando', en: 'No rush, exploring' }, emoji: '🔭' },
        ],
      },
    ],
  },

  /* ---------------------------------------------------------- 5 · vehicle */
  {
    id: 'vehicle',
    icon: 'car',
    emoji: '🚙',
    express: true,
    title: { es: 'El auto que buscas', en: 'The car you want' },
    subtitle: {
      es: 'Mientras más nos cuentes, más fino afinamos la búsqueda. Si algo te da igual, déjalo en blanco.',
      en: 'The more you tell us, the sharper our search. Leave anything you do not care about blank.',
    },
    fields: [
      {
        id: 'vehicle.bodyTypes', type: 'multi', express: true, required: true, cols: 3,
        label: { es: '¿Qué tipo de vehículo?', en: 'What kind of vehicle?' },
        options: BODY_TYPES,
        validate: (v) => (!v || !v.length ? 'err.minSelect:1' : null),
      },
      {
        id: 'vehicle.makes', type: 'chips', express: true,
        label: { es: 'Marcas que te gustan', en: 'Makes you like' },
        help: { es: 'Opcional. Si no tienes preferencia, sáltalo y te proponemos las más confiables por tu presupuesto.', en: 'Optional. Skip it and we will propose the most reliable options for your budget.' },
        options: MAKES.map((m) => ({ id: m, label: m })),
        highlight: POPULAR_MAKES, searchable: true,
      },
      {
        id: 'vehicle.models', type: 'tags',
        label: { es: 'Modelos concretos', en: 'Specific models' },
        help: { es: 'Ej.: Corolla, CR-V, F-150. Escribe y pulsa Enter.', en: 'e.g. Corolla, CR-V, F-150. Type and press Enter.' },
        placeholder: { es: 'Escribe un modelo y pulsa Enter', en: 'Type a model and press Enter' },
      },
      {
        id: 'vehicle.avoidMakes', type: 'tags',
        label: { es: 'Marcas o modelos que NO quieres', en: 'Makes or models you do NOT want' },
        placeholder: { es: 'Escribe y pulsa Enter', en: 'Type and press Enter' },
      },
      {
        id: 'vehicle.years', type: 'yearrange', express: true,
        label: { es: 'Rango de año', en: 'Year range' },
        help: { es: 'Autos más nuevos cuestan más pero tienen menos sorpresas.', en: 'Newer cars cost more but bring fewer surprises.' },
        min: 1990, max: CURRENT_YEAR + 1,
        default: { from: CURRENT_YEAR - 12, to: CURRENT_YEAR },
      },
      {
        id: 'vehicle.maxMileage', type: 'slider', express: true,
        label: { es: 'Millaje máximo aceptable', en: 'Maximum acceptable mileage' },
        min: 0, max: 250000, step: 5000, default: 120000, unit: 'mi',
        format: (v, lang) => (Number(v) >= 250000
          ? (lang === 'en' ? 'No limit' : 'Sin límite')
          : `${Number(v).toLocaleString(lang === 'en' ? 'en-US' : 'es-ES')} mi`),
      },
      {
        id: 'vehicle.transmission', type: 'segmented',
        label: { es: 'Transmisión', en: 'Transmission' },
        options: [
          { id: 'auto', label: { es: 'Automática', en: 'Automatic' } },
          { id: 'manual', label: { es: 'Manual', en: 'Manual' } },
          { id: 'any', label: { es: 'Me da igual', en: 'No preference' } },
        ],
      },
      {
        id: 'vehicle.drivetrain', type: 'segmented',
        label: { es: 'Tracción', en: 'Drivetrain' },
        options: [
          { id: 'fwd', label: 'FWD' }, { id: 'rwd', label: 'RWD' },
          { id: 'awd', label: 'AWD / 4x4' }, { id: 'any', label: { es: 'Me da igual', en: 'No preference' } },
        ],
      },
      {
        id: 'vehicle.fuel', type: 'multi', cols: 3,
        label: { es: 'Combustible', en: 'Fuel' },
        options: [
          { id: 'gas', label: { es: 'Gasolina', en: 'Gasoline' }, emoji: '⛽' },
          { id: 'diesel', label: { es: 'Diésel', en: 'Diesel' }, emoji: '🛢️' },
          { id: 'hybrid', label: { es: 'Híbrido', en: 'Hybrid' }, emoji: '🔋' },
          { id: 'ev', label: { es: 'Eléctrico', en: 'Electric' }, emoji: '⚡' },
          { id: 'any', label: { es: 'Cualquiera', en: 'Any' }, emoji: '🤷' },
        ],
      },
      {
        id: 'vehicle.priority', type: 'slider',
        label: { es: '¿Qué pesa más para ti?', en: 'What matters more to you?' },
        min: 0, max: 100, step: 10, default: 50,
        format: (v, lang) => {
          const n = Number(v);
          if (lang === 'en') return n <= 20 ? 'Fuel economy above all' : n <= 40 ? 'Leaning economy' : n < 60 ? 'Balanced' : n < 80 ? 'Leaning power' : 'Power and size above all';
          return n <= 20 ? 'Ahorro de gasolina ante todo' : n <= 40 ? 'Más hacia el ahorro' : n < 60 ? 'Equilibrado' : n < 80 ? 'Más hacia la potencia' : 'Potencia y tamaño ante todo';
        },
        scaleLabels: [
          { es: '⛽ Ahorro', en: '⛽ Economy' },
          { es: '💪 Potencia', en: '💪 Power' },
        ],
      },
      {
        id: 'vehicle.features', type: 'multi', cols: 3,
        label: { es: 'Equipamiento que te importa', en: 'Features that matter to you' },
        help: { es: 'Marca lo que de verdad usarías.', en: 'Tick only what you would genuinely use.' },
        options: FEATURES,
      },
      {
        id: 'vehicle.mustHave', type: 'priority',
        label: { es: 'De todo lo anterior, ¿qué es innegociable?', en: 'Of all of the above, what is non-negotiable?' },
        help: { es: 'Elige hasta 3. Nos ayuda a decidir cuando dos autos compiten.', en: 'Pick up to 3. It breaks the tie when two cars compete.' },
        sourceField: 'vehicle.features', max: 3, options: FEATURES,
        showIf: (d) => (d?.vehicle?.features || []).length > 0,
      },
      {
        id: 'vehicle.colors', type: 'chips',
        label: { es: 'Colores preferidos', en: 'Preferred colours' },
        options: [
          { id: 'white', label: { es: 'Blanco', en: 'White' } },
          { id: 'black', label: { es: 'Negro', en: 'Black' } },
          { id: 'silver', label: { es: 'Plata / gris', en: 'Silver / grey' } },
          { id: 'blue', label: { es: 'Azul', en: 'Blue' } },
          { id: 'red', label: { es: 'Rojo', en: 'Red' } },
          { id: 'other', label: { es: 'Otro', en: 'Other' } },
          { id: 'any', label: { es: 'Me da igual', en: 'No preference' } },
        ],
      },
    ],
  },

  /* --------------------------------------------------------- 6 · condition */
  {
    id: 'condition',
    icon: 'wrench',
    emoji: '🛠️',
    express: true,
    title: { es: 'Condición y nivel de riesgo', en: 'Condition and risk appetite' },
    subtitle: {
      es: 'Aquí está el verdadero secreto del precio. Un auto con daño reparable puede costar la mitad — si sabes en qué te metes. Te explicamos cada término.',
      en: 'This is where the price really comes from. A repairable-damage car can cost half — if you know what you are getting into. Every term is explained.',
    },
    fields: [
      {
        id: 'condition.titles', type: 'multi', express: true, required: true, cols: 1,
        label: { es: '¿Qué tipos de título aceptas?', en: 'Which title types do you accept?' },
        glossary: 'salvage',
        options: TITLE_TYPES,
        validate: (v) => (!v || !v.length ? 'err.minSelect:1' : null),
      },
      {
        id: 'condition.rebuiltNote', type: 'info', variant: 'info',
        showIf: (d) => (d?.condition?.titles || []).some((t) => ['salvage', 'rebuilt'].includes(t)),
        label: { es: 'Lo que debes saber del salvage', en: 'What you should know about salvage' },
        help: {
          es: 'Se compra mucho más barato, pero suma costos: reparación, inspección estatal y un seguro que puede ser más caro o limitado. Su reventa vale 20-40% menos. Con un buen taller sigue siendo el mejor negocio del mercado.',
          en: 'Much cheaper up front, but it adds costs: repairs, state inspection and insurance that may be pricier or limited. Resale runs 20-40% lower. With a good shop it is still the best value on the market.',
        },
      },
      {
        id: 'condition.damageTolerance', type: 'radio', express: true, cols: 2,
        label: { es: '¿Cuánto daño estás dispuesto a asumir?', en: 'How much damage are you willing to take on?' },
        required: true,
        options: [
          { id: 'none', label: { es: 'Ninguno', en: 'None' }, emoji: '✨', desc: { es: 'Quiero un auto listo para manejar hoy', en: 'I want a car ready to drive today' } },
          { id: 'cosmetic', label: { es: 'Solo cosmético', en: 'Cosmetic only' }, emoji: '🎨', desc: { es: 'Rayones, golpes menores, granizo', en: 'Scratches, small dents, hail' } },
          { id: 'moderate', label: { es: 'Reparable moderado', en: 'Moderate repairable' }, emoji: '🔧', desc: { es: 'Frontal o trasero reparable en taller', en: 'Front or rear damage a shop can fix' } },
          { id: 'heavy', label: { es: 'Cualquier cosa reparable', en: 'Anything repairable' }, emoji: '🏗️', desc: { es: 'Tengo taller y sé lo que hago', en: 'I have a shop and know what I am doing' } },
        ],
      },
      {
        id: 'condition.dealBreakers', type: 'multi', cols: 3,
        label: { es: 'Daños que NO aceptas bajo ningún concepto', en: 'Damage you will NEVER accept' },
        help: { es: 'Lo descartamos automáticamente de la búsqueda.', en: 'We filter these out of the search automatically.' },
        options: DAMAGE_TYPES.filter((d) => !['normalwear', 'minor'].includes(d.id)),
      },
      {
        id: 'condition.runDrive', type: 'radio', express: true, cols: 3,
        label: { es: '¿Necesitas que arranque y ande (Run & Drive)?', en: 'Does it need to start and drive (Run & Drive)?' },
        glossary: 'runAndDrive',
        options: [
          { id: 'required', label: { es: 'Obligatorio', en: 'Required' }, emoji: '✅', desc: { es: 'Solo autos marcados Run & Drive', en: 'Only Run & Drive flagged lots' } },
          { id: 'preferred', label: { es: 'Preferible', en: 'Preferred' }, emoji: '👍', desc: { es: 'Si el precio compensa, lo consideramos', en: 'If the price is right we will consider it' } },
          { id: 'no', label: { es: 'No importa', en: "Doesn't matter" }, emoji: '🤷', desc: { es: 'Voy a repararlo de todas formas', en: 'I am rebuilding it anyway' } },
        ],
      },
      {
        id: 'condition.keys', type: 'segmented',
        label: { es: '¿Exiges que traiga llaves?', en: 'Do you require keys?' },
        options: yesNo([{ id: 'preferred', label: { es: 'Preferible', en: 'Preferred' } }]),
      },
      {
        id: 'condition.airbags', type: 'segmented',
        label: { es: '¿Aceptas airbags desplegados?', en: 'Do you accept deployed airbags?' },
        help: { es: 'Reponerlos cuesta entre $800 y $3,000 según el modelo.', en: 'Replacing them runs $800-$3,000 depending on the model.' },
        options: yesNo([notSure]),
      },
      {
        id: 'condition.odometer', type: 'segmented',
        label: { es: '¿Exiges millaje verificado (Actual)?', en: 'Do you require verified mileage (Actual)?' },
        glossary: 'odometer',
        options: yesNo([{ id: 'preferred', label: { es: 'Preferible', en: 'Preferred' } }]),
      },
      {
        id: 'condition.repairBudget', type: 'money',
        label: { es: 'Presupuesto extra para reparación', en: 'Extra budget for repairs' },
        help: { es: 'Aparte del precio del auto. Déjalo en 0 si no piensas reparar.', en: 'On top of the car price. Leave at 0 if you do not plan to repair.' },
        min: 0, max: 30000, step: 250, slider: true, sliderMax: 15000, default: 0,
        showIf: (d) => ['cosmetic', 'moderate', 'heavy'].includes(d?.condition?.damageTolerance),
      },
      {
        id: 'condition.hasShop', type: 'radio', cols: 3,
        label: { es: '¿Quién repararía el auto?', en: 'Who would repair the car?' },
        showIf: (d) => ['cosmetic', 'moderate', 'heavy'].includes(d?.condition?.damageTolerance),
        options: [
          { id: 'self', label: { es: 'Yo mismo', en: 'Myself' }, emoji: '🧑‍🔧' },
          { id: 'shop', label: { es: 'Mi taller de confianza', en: 'My trusted shop' }, emoji: '🏪' },
          { id: 'need', label: { es: 'Necesito que me recomienden uno', en: 'I need a recommendation' }, emoji: '🔎' },
        ],
      },
      {
        id: 'condition.sightUnseen', type: 'radio', cols: 3,
        label: { es: '¿Comprarías sin ver el auto en persona?', en: 'Would you buy without seeing the car in person?' },
        help: { es: 'La mayoría de las compras en subasta son solo con fotos y el reporte.', en: 'Most auction purchases happen from photos and the report alone.' },
        options: [
          { id: 'yes', label: { es: 'Sí, confío en las fotos y el reporte', en: 'Yes, I trust photos and the report' }, emoji: '📸' },
          { id: 'inspection', label: { es: 'Solo con inspección presencial', en: 'Only with an on-site inspection' }, emoji: '🔍' },
          { id: 'unsure', label: { es: 'Depende del auto', en: 'Depends on the car' }, emoji: '🤔' },
        ],
      },
      {
        id: 'condition.history', type: 'segmented',
        label: { es: '¿Quieres reporte Carfax antes de pujar?', en: 'Do you want a Carfax report before bidding?' },
        glossary: 'carfax',
        options: yesNo([notSure]),
      },
    ],
  },

  /* ---------------------------------------------------------- 7 · sourcing */
  {
    id: 'sourcing',
    icon: 'gavel',
    emoji: '🔨',
    title: { es: 'Dónde buscamos', en: 'Where we search' },
    subtitle: {
      es: 'Cada plataforma tiene su fuerte. Si no las conoces, marca "no sé" y elegimos por ti la que mejor se ajuste.',
      en: 'Each platform has its strengths. If you are not familiar, pick "not sure" and we will choose for you.',
    },
    fields: [
      {
        id: 'sourcing.platforms', type: 'multi', cols: 1,
        label: { es: '¿Alguna preferencia de subasta?', en: 'Any auction preference?' },
        options: AUCTIONS,
      },
      {
        id: 'sourcing.geoFlexible', type: 'radio', cols: 3,
        label: { es: '¿Importa dónde esté el auto?', en: 'Does the car location matter?' },
        help: { es: 'Un auto más lejos puede salir más barato aunque el transporte suba.', en: 'A car further away can still be cheaper even with higher transport.' },
        options: [
          { id: 'anywhere', label: { es: 'Cualquier estado', en: 'Any state' }, emoji: '🇺🇸', desc: { es: 'Quiero el mejor precio, punto', en: 'I want the best price, period' } },
          { id: 'region', label: { es: 'Cerca de mí', en: 'Near me' }, emoji: '📍', desc: { es: 'Prefiero recogerlo yo', en: 'I would rather pick it up myself' } },
          { id: 'states', label: { es: 'Estados específicos', en: 'Specific states' }, emoji: '🗺️', desc: { es: 'Te digo cuáles', en: 'I will tell you which' } },
        ],
      },
      {
        id: 'sourcing.states', type: 'chips', searchable: true,
        label: { es: '¿Qué estados?', en: 'Which states?' },
        showIf: (d) => d?.sourcing?.geoFlexible === 'states',
        options: US_STATES.map(([id, label]) => ({ id, label: `${id} · ${label}` })),
      },
      {
        id: 'sourcing.radius', type: 'slider',
        label: { es: 'Radio de búsqueda desde tu ciudad', en: 'Search radius from your city' },
        showIf: (d) => d?.sourcing?.geoFlexible === 'region',
        min: 50, max: 1500, step: 50, default: 300, unit: 'mi',
      },
      {
        id: 'sourcing.zip', type: 'text',
        label: { es: 'Código postal de referencia', en: 'Reference ZIP code' },
        placeholder: '33012', width: 'half', maxLength: 10,
        showIf: (d) => ['region', 'states'].includes(d?.sourcing?.geoFlexible),
      },
      {
        id: 'sourcing.alerts', type: 'segmented',
        label: { es: '¿Quieres alertas cuando aparezca algo que encaje?', en: 'Want alerts when a matching lot appears?' },
        options: yesNo(),
      },
    ],
  },

  /* --------------------------------------------------------- 8 · logistics */
  {
    id: 'logistics',
    icon: 'route',
    emoji: '🚚',
    title: { es: 'Entrega y papeles', en: 'Delivery and paperwork' },
    subtitle: {
      es: 'Ganar la subasta es la mitad del trabajo. La otra mitad es sacarlo del patio, moverlo y ponerlo a tu nombre.',
      en: 'Winning the auction is half the job. The other half is getting it out of the yard, moved and titled in your name.',
    },
    fields: [
      {
        id: 'logistics.transport', type: 'radio', cols: 3, required: true,
        label: { es: '¿Cómo se recoge el auto?', en: 'How is the car collected?' },
        glossary: 'superdispatch',
        options: [
          { id: 'managed', label: { es: 'Gestionen el transporte', en: 'Arrange transport for me' }, emoji: '🚛', desc: { es: 'Buscamos transportista asegurado y negociamos precio', en: 'We find an insured carrier and negotiate the price' } },
          { id: 'self', label: { es: 'Lo recojo yo', en: 'I will pick it up' }, emoji: '🔑', desc: { es: 'Voy al patio con mi propio remolque', en: 'I will go to the yard with my own trailer' } },
          { id: 'unsure', label: { es: 'Aún no lo sé', en: 'Not sure yet' }, emoji: '🤔' },
        ],
      },
      {
        id: 'logistics.destinationCity', type: 'text',
        label: { es: 'Ciudad de destino', en: 'Destination city' },
        placeholder: { es: 'Miami, FL', en: 'Miami, FL' }, width: 'half',
        showIf: (d) => d?.logistics?.transport === 'managed',
      },
      {
        id: 'logistics.destinationZip', type: 'text',
        label: { es: 'Código postal de destino', en: 'Destination ZIP' },
        placeholder: '33012', width: 'half', maxLength: 10,
        showIf: (d) => d?.logistics?.transport === 'managed',
      },
      {
        id: 'logistics.carrierType', type: 'segmented',
        label: { es: 'Tipo de transporte', en: 'Carrier type' },
        showIf: (d) => d?.logistics?.transport === 'managed',
        options: [
          { id: 'open', label: { es: 'Abierto (más barato)', en: 'Open (cheaper)' } },
          { id: 'enclosed', label: { es: 'Cerrado (más protegido)', en: 'Enclosed (more protection)' } },
          { id: 'any', label: { es: 'Lo que salga mejor', en: 'Whatever works best' } },
        ],
      },
      {
        id: 'logistics.finalDestination', type: 'radio', cols: 2,
        label: { es: '¿Dónde vivirá el auto?', en: 'Where will the car live?' },
        options: [
          { id: 'usa', label: { es: 'En Estados Unidos', en: 'In the United States' }, emoji: '🇺🇸' },
          { id: 'export', label: { es: 'Se exporta a otro país', en: 'It will be exported' }, emoji: '🚢' },
        ],
      },
      {
        id: 'logistics.exportCountry', type: 'text',
        label: { es: 'País de destino', en: 'Destination country' },
        width: 'half',
        showIf: (d) => d?.logistics?.finalDestination === 'export',
      },
      {
        id: 'logistics.exportPort', type: 'text',
        label: { es: 'Puerto de destino (si lo sabes)', en: 'Destination port (if known)' },
        width: 'half',
        showIf: (d) => d?.logistics?.finalDestination === 'export',
      },
      {
        id: 'logistics.exportMode', type: 'radio', cols: 3,
        label: { es: 'Modalidad de embarque', en: 'Shipping mode' },
        showIf: (d) => d?.logistics?.finalDestination === 'export',
        options: [
          { id: 'roro', label: { es: 'RoRo (rodado)', en: 'RoRo (roll-on/roll-off)' }, emoji: '⛴️', desc: { es: 'Más económico, el auto debe rodar', en: 'Cheapest, the car must roll' } },
          { id: 'container20', label: { es: 'Contenedor compartido', en: 'Shared container' }, emoji: '📦', desc: { es: 'Protegido, se comparte el costo', en: 'Protected, cost is shared' } },
          { id: 'container40', label: { es: 'Contenedor exclusivo', en: 'Exclusive container' }, emoji: '🚢', desc: { es: 'Máxima protección y control', en: 'Maximum protection and control' } },
        ],
      },
      {
        id: 'logistics.titleHelp', type: 'segmented',
        label: { es: '¿Necesitas ayuda con el título y el registro (DMV)?', en: 'Do you need help with title and registration (DMV)?' },
        options: yesNo([notSure]),
      },
      {
        id: 'logistics.registrationState', type: 'select',
        label: { es: '¿En qué estado lo registrarías?', en: 'Which state would you register it in?' },
        options: US_STATES.map(([id, label]) => ({ id, label: `${id} · ${label}` })),
        width: 'half',
        showIf: (d) => d?.logistics?.titleHelp === 'yes' && d?.logistics?.finalDestination !== 'export',
      },
      {
        id: 'logistics.hasLicense', type: 'segmented',
        label: { es: '¿Tienes licencia de conducir o ID vigente de EE.UU.?', en: 'Do you have a valid US driver license or ID?' },
        help: { es: 'Necesario para poner el título a tu nombre.', en: 'Required to put the title in your name.' },
        options: yesNo([notSure]),
      },
      {
        id: 'logistics.deadline', type: 'date',
        label: { es: 'Fecha límite para tenerlo', en: 'Deadline to have it' },
        help: { es: 'Opcional, pero nos ayuda a priorizar subastas por fecha de venta.', en: 'Optional, but it helps us prioritise auctions by sale date.' },
        width: 'half',
      },
    ],
  },

  /* --------------------------------------------------------- 9 · references */
  {
    id: 'references',
    icon: 'link',
    emoji: '🔗',
    title: { es: 'Referencias y notas', en: 'References and notes' },
    subtitle: {
      es: '¿Viste algún lote que te gustó? Pega el enlace de Copart, IAA o bid.cars y lo analizamos contigo.',
      en: 'Spotted a lot you liked? Paste the Copart, IAA or bid.cars link and we will analyse it with you.',
    },
    fields: [
      {
        id: 'references.lots', type: 'repeater',
        label: { es: 'Lotes que te interesaron', en: 'Lots that caught your eye' },
        addLabel: { es: 'Añadir otro lote', en: 'Add another lot' },
        max: 8,
        item: [
          { id: 'url', type: 'url', label: { es: 'Enlace del lote', en: 'Lot link' }, placeholder: 'https://www.copart.com/lot/…' },
          { id: 'note', type: 'text', label: { es: 'Qué te gustó', en: 'What you liked' }, placeholder: { es: 'Precio, estado, modelo…', en: 'Price, condition, model…' } },
        ],
      },
      {
        id: 'references.previousCars', type: 'tags',
        label: { es: 'Autos que has tenido antes', en: 'Cars you have owned before' },
        help: { es: 'Nos dice mucho sobre lo que te va a gustar.', en: 'It tells us a lot about what you will enjoy.' },
        placeholder: { es: 'Ej.: Honda Civic 2012', en: 'e.g. Honda Civic 2012' },
      },
      {
        id: 'references.notes', type: 'textarea',
        label: { es: '¿Algo más que debamos saber?', en: 'Anything else we should know?' },
        placeholder: {
          es: 'Cuéntanos cualquier detalle: alergias a marcas, historias previas, necesidades especiales, quién más decide contigo…',
          en: 'Tell us anything: brand aversions, past experiences, special needs, who else is deciding with you…',
        },
        rows: 5, maxLength: 2000,
      },
    ],
  },

  /* ----------------------------------------------------------- 10 · review */
  {
    id: 'review',
    icon: 'check',
    emoji: '✅',
    kind: 'review',
    express: true,
    title: { es: 'Revisa y envía', en: 'Review and send' },
    subtitle: {
      es: 'Comprueba que todo esté bien. Puedes volver a cualquier paso para cambiar algo.',
      en: 'Check that everything looks right. You can jump back to any step to change something.',
    },
    fields: [
      {
        id: 'consent.dataUse', type: 'switch', required: true, express: true,
        label: { es: 'Autorizo a La Subasta Cubana a usar estos datos para asesorarme y buscar vehículos.', en: 'I authorise La Subasta Cubana to use this data to advise me and search for vehicles.' },
        validate: (v) => (v === true ? null : 'err.required'),
      },
      {
        id: 'consent.contact', type: 'switch', express: true,
        label: { es: 'Acepto que me contacten por los canales que indiqué.', en: 'I agree to be contacted through the channels I selected.' },
      },
      {
        id: 'consent.signature', type: 'text', express: true,
        label: { es: 'Escribe tu nombre para confirmar', en: 'Type your name to confirm' },
        placeholder: { es: 'Tu nombre completo', en: 'Your full name' },
        width: 'half',
      },
    ],
  },
];

/* ------------------------------------------------------------- helpers --- */

/** Every field in the schema, flattened. */
export function allFields() {
  return STEPS.flatMap((s) => s.fields);
}

export function findField(id) {
  return allFields().find((f) => f.id === id) || null;
}

/** Steps visible for the given mode ('full' | 'express'). */
export function visibleSteps(mode = 'full') {
  return mode === 'express' ? STEPS.filter((s) => s.express || s.kind === 'intro') : STEPS;
}

/** Fields of a step that should render for the current answers and mode. */
export function visibleFields(step, data, mode = 'full') {
  return step.fields.filter((f) => {
    if (mode === 'express' && !f.express && f.type !== 'info') return false;
    if (typeof f.showIf === 'function' && !f.showIf(data)) return false;
    return true;
  });
}

export function isRequired(field, data) {
  return typeof field.required === 'function' ? Boolean(field.required(data)) : Boolean(field.required);
}

/** Default answer object with every declared default pre-filled. */
export function makeDefaults() {
  const data = {};
  for (const f of allFields()) {
    if (f.default === undefined) continue;
    const parts = f.id.split('.');
    let cur = data;
    for (let i = 0; i < parts.length - 1; i++) cur = (cur[parts[i]] ??= {});
    cur[parts[parts.length - 1]] = typeof f.default === 'object' && f.default !== null
      ? JSON.parse(JSON.stringify(f.default))
      : f.default;
  }
  return data;
}

/** Schema fingerprint, stored with each record so old answers stay readable. */
export const SCHEMA_VERSION = 3;
