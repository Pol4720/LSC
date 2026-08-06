/* =========================================================================
   LSC · Auction domain catalogs (bilingual ES/EN)
   ---------------------------------------------------------------------------
   Vocabulary mirrors what a buyer actually sees on Copart, IAA (IAAI),
   Manheim, ACV and aggregators such as bid.cars / AutoAstat, so the intake
   maps 1:1 onto the filters the advisor uses when hunting lots.
   ========================================================================= */

/* --------------------------------------------------------- auctions ------ */
export const AUCTIONS = [
  {
    id: 'copart', label: 'Copart', emoji: '🔨',
    desc: {
      es: 'La mayor subasta de vehículos de aseguradoras en EE.UU. Gran volumen de salvage y también autos con título limpio.',
      en: 'The largest US insurance-vehicle auction. Huge salvage volume plus clean-title cars.',
    },
  },
  {
    id: 'iaai', label: 'IAA (IAAI)', emoji: '🏢',
    desc: {
      es: 'Insurance Auto Auctions. Muy fuerte en pérdidas totales; usa "start codes" (Run & Drive / Starts / Stationary).',
      en: 'Insurance Auto Auctions. Strong on total losses; uses start codes (Run & Drive / Starts / Stationary).',
    },
  },
  {
    id: 'manheim', label: 'Manheim', emoji: '🏁',
    desc: {
      es: 'Subasta mayorista dealer-to-dealer. Autos en mejor estado, con Condition Report y valor MMR de referencia.',
      en: 'Dealer-to-dealer wholesale auction. Better condition cars with Condition Reports and MMR benchmark values.',
    },
  },
  {
    id: 'acv', label: 'ACV Auctions', emoji: '📱',
    desc: {
      es: 'Mayorista digital con inspección detallada, grabación del motor y reporte de condición muy completo.',
      en: 'Digital wholesale with detailed inspections, engine audio recording and a thorough condition report.',
    },
  },
  {
    id: 'other', label: { es: 'Otras / no sé', en: 'Other / not sure' }, emoji: '🤝',
    desc: {
      es: 'Adesa, Sca, Autoastat, bid.cars y otras plataformas. Déjanos elegir la mejor fuente para tu caso.',
      en: 'Adesa, SCA, AutoAstat, bid.cars and others. Let us pick the best source for your case.',
    },
  },
];

/* ------------------------------------------------------- title types ----- */
export const TITLE_TYPES = [
  {
    id: 'clean', label: { es: 'Título limpio (Clean)', en: 'Clean title' }, emoji: '✅',
    desc: {
      es: 'Nunca fue declarado pérdida total. Es el más caro pero el más fácil de asegurar, registrar y revender.',
      en: 'Never declared a total loss. Priciest, but easiest to insure, register and resell.',
    },
  },
  {
    id: 'salvage', label: { es: 'Salvage (pérdida total)', en: 'Salvage' }, emoji: '🛠️',
    desc: {
      es: 'La aseguradora lo declaró pérdida total. Precio mucho menor; requiere reparación e inspección para poder circular.',
      en: 'Declared a total loss by the insurer. Much cheaper; needs repair and inspection before it can be driven.',
    },
  },
  {
    id: 'rebuilt', label: { es: 'Rebuilt / Reconstruido', en: 'Rebuilt / Reconstructed' }, emoji: '🔧',
    desc: {
      es: 'Fue salvage, ya está reparado e inspeccionado. Circula legalmente, pero vale menos que uno con título limpio.',
      en: 'Was salvage, now repaired and inspected. Road-legal, but worth less than a clean-title car.',
    },
  },
  {
    id: 'billofsale', label: { es: 'Bill of Sale', en: 'Bill of Sale' }, emoji: '📄',
    desc: {
      es: 'Se vende sin título formal. En muchos estados no se puede registrar para calle: úsalo solo con conocimiento.',
      en: 'Sold without a formal title. In many states it cannot be registered for road use — advanced buyers only.',
    },
  },
  {
    id: 'nonrepairable', label: { es: 'Non-repairable / Parts only', en: 'Non-repairable / Parts only' }, emoji: '⚙️',
    desc: {
      es: 'Solo para piezas o desguace. Nunca se podrá registrar como vehículo de calle.',
      en: 'Parts or scrap only. It can never be registered as a road vehicle.',
    },
  },
];

/* ------------------------------------------------------ damage types ----- */
export const DAMAGE_TYPES = [
  { id: 'front', label: { es: 'Frontal', en: 'Front end' }, emoji: '💥' },
  { id: 'rear', label: { es: 'Trasero', en: 'Rear end' }, emoji: '🔙' },
  { id: 'side', label: { es: 'Lateral', en: 'Side' }, emoji: '↔️' },
  { id: 'allover', label: { es: 'Todo el vehículo (All Over)', en: 'All over' }, emoji: '🌀' },
  { id: 'minor', label: { es: 'Menor: golpes y rayones', en: 'Minor dents & scratches' }, emoji: '🩹' },
  { id: 'hail', label: { es: 'Granizo (Hail)', en: 'Hail' }, emoji: '🧊' },
  { id: 'water', label: { es: 'Agua / inundación (Flood)', en: 'Water / flood' }, emoji: '🌊' },
  { id: 'burn', label: { es: 'Fuego / quemado', en: 'Fire / burn' }, emoji: '🔥' },
  { id: 'rollover', label: { es: 'Vuelco (Rollover)', en: 'Rollover' }, emoji: '🔄' },
  { id: 'vandalism', label: { es: 'Robo / vandalismo', en: 'Theft / vandalism' }, emoji: '🔓' },
  { id: 'mechanical', label: { es: 'Mecánico / motor', en: 'Mechanical / engine' }, emoji: '🔩' },
  { id: 'undercarriage', label: { es: 'Bajos / chasis', en: 'Undercarriage / frame' }, emoji: '🧱' },
  { id: 'normalwear', label: { es: 'Desgaste normal', en: 'Normal wear' }, emoji: '🚗' },
  { id: 'biohazard', label: { es: 'Biohazard / químico', en: 'Biohazard / chemical' }, emoji: '☣️' },
];

/* -------------------------------------------------------- body types ----- */
export const BODY_TYPES = [
  { id: 'sedan', label: { es: 'Sedán', en: 'Sedan' }, emoji: '🚘', desc: { es: 'Económico y cómodo para ciudad', en: 'Economical and comfortable for the city' } },
  { id: 'suv', label: { es: 'SUV / Crossover', en: 'SUV / Crossover' }, emoji: '🚙', desc: { es: 'Espacio, altura y versatilidad', en: 'Space, ride height and versatility' } },
  { id: 'pickup', label: { es: 'Pickup / Camioneta', en: 'Pickup truck' }, emoji: '🛻', desc: { es: 'Carga, trabajo y remolque', en: 'Hauling, work and towing' } },
  { id: 'hatchback', label: { es: 'Hatchback', en: 'Hatchback' }, emoji: '🚗', desc: { es: 'Compacto y de bajo consumo', en: 'Compact and fuel efficient' } },
  { id: 'minivan', label: { es: 'Minivan', en: 'Minivan' }, emoji: '🚐', desc: { es: 'Familias grandes, 7-8 plazas', en: 'Large families, 7-8 seats' } },
  { id: 'coupe', label: { es: 'Coupé', en: 'Coupe' }, emoji: '🏎️', desc: { es: 'Deportivo de dos puertas', en: 'Sporty two-door' } },
  { id: 'convertible', label: { es: 'Convertible', en: 'Convertible' }, emoji: '🌤️', desc: { es: 'Techo descapotable', en: 'Drop-top' } },
  { id: 'wagon', label: { es: 'Familiar / Wagon', en: 'Wagon' }, emoji: '🚋', desc: { es: 'Maletero enorme, manejo de sedán', en: 'Huge trunk, sedan-like handling' } },
  { id: 'van', label: { es: 'Van de carga', en: 'Cargo van' }, emoji: '🚚', desc: { es: 'Negocio, reparto y herramientas', en: 'Business, delivery and tools' } },
  { id: 'moto', label: { es: 'Moto', en: 'Motorcycle' }, emoji: '🏍️', desc: { es: 'Dos ruedas', en: 'Two wheels' } },
  { id: 'heavy', label: { es: 'Camión / equipo pesado', en: 'Truck / heavy equipment' }, emoji: '🚛', desc: { es: 'Comercial y maquinaria', en: 'Commercial and machinery' } },
];

/* ------------------------------------------------------------- makes ----- */
export const MAKES = [
  'Toyota', 'Honda', 'Nissan', 'Mazda', 'Subaru', 'Mitsubishi', 'Lexus', 'Acura', 'Infiniti',
  'Hyundai', 'Kia', 'Genesis',
  'Ford', 'Chevrolet', 'GMC', 'Buick', 'Cadillac', 'Chrysler', 'Dodge', 'Jeep', 'Ram', 'Lincoln',
  'Volkswagen', 'Audi', 'BMW', 'Mercedes-Benz', 'Porsche', 'MINI', 'Volvo',
  'Tesla', 'Rivian', 'Polestar',
  'Land Rover', 'Jaguar', 'Fiat', 'Alfa Romeo', 'Maserati',
  'Suzuki', 'Isuzu', 'Peugeot', 'Renault', 'Citroën', 'SEAT', 'Škoda', 'Opel',
];

/** Fast, dependable, cheap-to-fix picks worth surfacing first for newcomers. */
export const POPULAR_MAKES = ['Toyota', 'Honda', 'Nissan', 'Hyundai', 'Kia', 'Ford', 'Chevrolet', 'Mazda', 'Jeep', 'BMW'];

/* ---------------------------------------------------------- features ----- */
export const FEATURES = [
  { id: 'camera', label: { es: 'Cámara de retroceso', en: 'Backup camera' }, emoji: '📷' },
  { id: 'carplay', label: { es: 'CarPlay / Android Auto', en: 'CarPlay / Android Auto' }, emoji: '📱' },
  { id: 'leather', label: { es: 'Asientos de piel', en: 'Leather seats' }, emoji: '🛋️' },
  { id: 'sunroof', label: { es: 'Techo solar', en: 'Sunroof / moonroof' }, emoji: '☀️' },
  { id: 'ac', label: { es: 'Aire acondicionado', en: 'Air conditioning' }, emoji: '❄️' },
  { id: 'heatedseats', label: { es: 'Asientos calefactables', en: 'Heated seats' }, emoji: '🔥' },
  { id: 'thirdrow', label: { es: 'Tercera fila de asientos', en: 'Third-row seating' }, emoji: '👨‍👩‍👧‍👦' },
  { id: 'towing', label: { es: 'Enganche / remolque', en: 'Tow hitch / towing' }, emoji: '🪝' },
  { id: 'awd', label: { es: 'Tracción total (AWD/4x4)', en: 'All-wheel / 4x4 drive' }, emoji: '🏔️' },
  { id: 'sensors', label: { es: 'Sensores de parqueo', en: 'Parking sensors' }, emoji: '📡' },
  { id: 'cruise', label: { es: 'Control crucero', en: 'Cruise control' }, emoji: '🛣️' },
  { id: 'adas', label: { es: 'Asistencias (frenado, carril)', en: 'Driver assist (AEB, lane keep)' }, emoji: '🛡️' },
  { id: 'remotestart', label: { es: 'Arranque remoto', en: 'Remote start' }, emoji: '🔑' },
  { id: 'lowmiles', label: { es: 'Millaje muy bajo', en: 'Very low mileage' }, emoji: '📉' },
  { id: 'alloy', label: { es: 'Llantas de aleación', en: 'Alloy wheels' }, emoji: '🛞' },
  { id: 'apple', label: { es: 'Pantalla grande', en: 'Large infotainment screen' }, emoji: '🖥️' },
];

/* --------------------------------------------------------- use cases ----- */
export const USE_CASES = [
  { id: 'daily', label: { es: 'Uso diario / ir al trabajo', en: 'Daily driving / commuting' }, emoji: '🏙️' },
  { id: 'family', label: { es: 'Familia', en: 'Family' }, emoji: '👨‍👩‍👧' },
  { id: 'work', label: { es: 'Trabajo o negocio', en: 'Work or business' }, emoji: '🧰' },
  { id: 'rideshare', label: { es: 'Uber / Lyft / taxi', en: 'Uber / Lyft / rideshare' }, emoji: '🚕' },
  { id: 'first', label: { es: 'Primer auto', en: 'First car' }, emoji: '🌱' },
  { id: 'resale', label: { es: 'Reparar y revender', en: 'Repair and resell' }, emoji: '💹' },
  { id: 'parts', label: { es: 'Piezas / repuestos', en: 'Parts' }, emoji: '⚙️' },
  { id: 'export', label: { es: 'Exportar fuera de EE.UU.', en: 'Export outside the US' }, emoji: '🚢' },
  { id: 'collection', label: { es: 'Colección / proyecto', en: 'Collection / project car' }, emoji: '🏆' },
];

/* ------------------------------------------------------------ payment ---- */
export const PAYMENT_METHODS = [
  { id: 'zelle', label: 'Zelle', emoji: '⚡' },
  { id: 'paypal', label: 'PayPal', emoji: '🅿️' },
  { id: 'wire', label: { es: 'Transferencia bancaria', en: 'Bank wire transfer' }, emoji: '🏦' },
  { id: 'cashier', label: { es: 'Cashier check', en: 'Cashier check' }, emoji: '🧾' },
  { id: 'cash', label: { es: 'Efectivo', en: 'Cash' }, emoji: '💵' },
  { id: 'card', label: { es: 'Tarjeta', en: 'Card' }, emoji: '💳' },
  { id: 'financing', label: { es: 'Necesito financiamiento', en: 'I need financing' }, emoji: '📊' },
];

/* ------------------------------------------------------------ contact ---- */
export const CONTACT_CHANNELS = [
  { id: 'whatsapp', label: 'WhatsApp', emoji: '💬' },
  { id: 'call', label: { es: 'Llamada telefónica', en: 'Phone call' }, emoji: '📞' },
  { id: 'email', label: { es: 'Correo electrónico', en: 'Email' }, emoji: '✉️' },
  { id: 'telegram', label: 'Telegram', emoji: '✈️' },
  { id: 'videocall', label: { es: 'Videollamada (Meet/Zoom)', en: 'Video call (Meet/Zoom)' }, emoji: '🎥' },
];

export const HEARD_FROM = [
  { id: 'referral', label: { es: 'Un amigo o familiar', en: 'Friend or family' } },
  { id: 'facebook', label: 'Facebook' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'google', label: { es: 'Búsqueda en Google', en: 'Google search' } },
  { id: 'whatsappgroup', label: { es: 'Grupo de WhatsApp', en: 'WhatsApp group' } },
  { id: 'other', label: { es: 'Otro', en: 'Other' } },
];

/* ------------------------------------------------------------ US states -- */
export const US_STATES = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'], ['CA', 'California'],
  ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'], ['DC', 'District of Columbia'],
  ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'], ['ID', 'Idaho'], ['IL', 'Illinois'],
  ['IN', 'Indiana'], ['IA', 'Iowa'], ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'],
  ['ME', 'Maine'], ['MD', 'Maryland'], ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'],
  ['MS', 'Mississippi'], ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'],
  ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'], ['NY', 'New York'],
  ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'], ['OK', 'Oklahoma'], ['OR', 'Oregon'],
  ['PA', 'Pennsylvania'], ['PR', 'Puerto Rico'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'],
  ['SD', 'South Dakota'], ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'], ['VT', 'Vermont'],
  ['VA', 'Virginia'], ['WA', 'Washington'], ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming'],
];

/* ------------------------------------------------------------ pipeline --- */
export const PIPELINE_STAGES = [
  { id: 'new', label: { es: 'Nuevo', en: 'New' }, color: 'info', emoji: '🆕' },
  { id: 'contacted', label: { es: 'Contactado', en: 'Contacted' }, color: 'info', emoji: '📞' },
  { id: 'scheduled', label: { es: 'Asesoría agendada', en: 'Session scheduled' }, color: 'brand', emoji: '📅' },
  { id: 'requirements', label: { es: 'Requisitos levantados', en: 'Requirements captured' }, color: 'brand', emoji: '📝' },
  { id: 'searching', label: { es: 'Buscando ofertas', en: 'Sourcing lots' }, color: 'warn', emoji: '🔍' },
  { id: 'offers', label: { es: 'Ofertas enviadas', en: 'Offers sent' }, color: 'warn', emoji: '📤' },
  { id: 'bidding', label: { es: 'Pujando', en: 'Bidding' }, color: 'warn', emoji: '🔨' },
  { id: 'won', label: { es: 'Ganado', en: 'Won' }, color: 'ok', emoji: '🏆' },
  { id: 'delivered', label: { es: 'Entregado', en: 'Delivered' }, color: 'ok', emoji: '🚚' },
  { id: 'lost', label: { es: 'Perdido / inactivo', en: 'Lost / inactive' }, color: 'danger', emoji: '🚫' },
];

export const PRIORITIES = [
  { id: 'hot', label: { es: 'Alta', en: 'High' }, color: 'danger', emoji: '🔥' },
  { id: 'warm', label: { es: 'Media', en: 'Medium' }, color: 'warn', emoji: '🌤️' },
  { id: 'cold', label: { es: 'Baja', en: 'Low' }, color: 'info', emoji: '❄️' },
];

/* ---------------------------------------------------------- glossary ----- */
/** Plain-language explanations surfaced as "?" tooltips throughout the form. */
export const GLOSSARY = {
  salvage: {
    term: { es: 'Salvage', en: 'Salvage' },
    text: {
      es: 'Título que emite el estado cuando la aseguradora declara el auto pérdida total (normalmente cuando reparar cuesta más del 70-80% de su valor). Se compra mucho más barato, pero necesita reparación e inspección estatal antes de poder circular.',
      en: 'A state-issued title given when an insurer declares the car a total loss (usually when repairs exceed ~70-80% of its value). Far cheaper to buy, but it needs repairs and a state inspection before it can be driven.',
    },
  },
  rebuilt: {
    term: { es: 'Rebuilt / Reconstruido', en: 'Rebuilt / Reconstructed' },
    text: {
      es: 'Un auto que fue salvage, se reparó y pasó la inspección estatal. Ya se puede registrar y manejar legalmente, pero su valor de reventa es entre 20% y 40% menor que uno con título limpio.',
      en: 'A car that was salvage, got repaired and passed state inspection. It can be registered and driven legally, but resale value runs 20-40% below a clean-title equivalent.',
    },
  },
  runAndDrive: {
    term: { es: 'Run & Drive', en: 'Run & Drive' },
    text: {
      es: 'Al llegar al patio de la subasta el motor arrancó, engranó marchas y el auto se movió. NO es garantía de que siga funcionando el día que lo recojas, ni de que sea apto para circular — pero es una señal muy buena.',
      en: 'On arrival at the yard the engine started, gears engaged and the car moved. It is NOT a guarantee that it still runs on pickup day or that it is roadworthy — but it is a strong positive signal.',
    },
  },
  startCode: {
    term: { es: 'Start Code (IAA)', en: 'Start Code (IAA)' },
    text: {
      es: 'IAA clasifica en tres niveles: "Run & Drive" (arranca y se mueve), "Starts" (arranca pero no se comprobó que ande) y "Stationary" (no arranca o no se probó).',
      en: 'IAA grades three levels: "Run & Drive" (starts and moves), "Starts" (starts but movement untested) and "Stationary" (does not start or was untested).',
    },
  },
  acv: {
    term: { es: 'ACV / Est. Retail Value', en: 'ACV / Est. Retail Value' },
    text: {
      es: 'El valor estimado que tendría el vehículo SIN daños, según la aseguradora. Sirve de referencia para saber si una puja es buen negocio, no es el precio de venta.',
      en: 'The estimated value the vehicle would have UNDAMAGED, per the insurer. A benchmark for judging whether a bid is a good deal — not the sale price.',
    },
  },
  maxBid: {
    term: { es: 'Puja máxima', en: 'Maximum bid' },
    text: {
      es: 'El monto tope que autorizas. Pujamos en tu nombre hasta ese límite y ni un dólar más; si el auto se gana por menos, el ahorro es tuyo.',
      en: 'The ceiling you authorise. We bid on your behalf up to that limit and not a dollar more; if the car wins for less, the savings are yours.',
    },
  },
  deposit: {
    term: { es: 'Depósito de seguridad', en: 'Security deposit' },
    text: {
      es: 'Garantía reembolsable que habilita tu poder de puja. Si no ganas el auto, se devuelve completo. Si ganas y no completas el pago, se pierde.',
      en: 'A refundable guarantee that unlocks your bidding power. If you do not win, it is fully returned. If you win and do not complete payment, it is forfeited.',
    },
  },
  buyerFee: {
    term: { es: 'Buyer fee', en: 'Buyer fee' },
    text: {
      es: 'Comisión que cobra la subasta sobre el precio del martillo. Crece por tramos según el precio y se suma a gate fee, cargo de internet y documentación.',
      en: 'The auction house commission on the hammer price. It scales in brackets and stacks with gate fee, internet bid fee and documentation.',
    },
  },
  gateFee: {
    term: { es: 'Gate fee', en: 'Gate fee' },
    text: {
      es: 'Cargo fijo por sacar el vehículo del patio de la subasta. Suele rondar los $79-$95.',
      en: 'A flat charge for removing the vehicle from the auction yard. Typically $79-$95.',
    },
  },
  carfax: {
    term: 'Carfax',
    text: {
      es: 'Reporte de historial por VIN: accidentes reportados, dueños anteriores, mantenimiento, marcas de título y posible fraude de odómetro. Es la mejor defensa antes de pujar.',
      en: 'A VIN history report: reported accidents, previous owners, service records, title brands and possible odometer fraud. Your best defence before bidding.',
    },
  },
  mmr: {
    term: 'MMR (Manheim Market Report)',
    text: {
      es: 'Valor mayorista de referencia de Manheim, calculado con ventas reales recientes de vehículos iguales. Es el termómetro del precio justo en el mercado dealer.',
      en: "Manheim's wholesale benchmark, computed from recent real sales of identical vehicles. The thermometer for fair dealer-market pricing.",
    },
  },
  odometer: {
    term: { es: 'Marca de odómetro', en: 'Odometer brand' },
    text: {
      es: '"Actual" = el millaje es real. "Not Actual" / TMU = no se puede verificar. "Exempt" = el vehículo es tan antiguo que la ley no exige declararlo.',
      en: '"Actual" = mileage is genuine. "Not Actual" / TMU = unverifiable. "Exempt" = the vehicle is old enough that reporting is not legally required.',
    },
  },
  superdispatch: {
    term: 'Super Dispatch',
    text: {
      es: 'Plataforma de transportistas donde se cotiza y contrata el traslado del auto desde el patio hasta tu destino. El costo depende de distancia, tipo de vehículo y si arranca.',
      en: 'A carrier marketplace used to quote and book transport from the yard to your destination. Cost depends on distance, vehicle type and whether it runs.',
    },
  },
  autoastat: {
    term: 'AutoAstat / bid.cars',
    text: {
      es: 'Agregadores que muestran el historial de precios finales de Copart e IAA. Sirven para saber en cuánto se vendieron autos idénticos y calibrar tu puja.',
      en: 'Aggregators showing final-price history from Copart and IAA. Use them to see what identical cars sold for and calibrate your bid.',
    },
  },
};

/* ------------------------------------------------------------ helpers ---- */
export const byId = (list, id) => list.find((x) => x.id === id) || null;

export const CURRENT_YEAR = new Date().getFullYear();

/** Auction lot URL parser: recognises Copart, IAA and bid.cars links. */
export function parseLotUrl(url) {
  const u = String(url || '').trim();
  if (!u) return null;
  const out = { url: u, source: null, lot: null, vin: null };
  let m;
  if ((m = /copart\.com\/lot\/(\d+)/i.exec(u))) { out.source = 'copart'; out.lot = m[1]; }
  else if ((m = /iaai\.com\/(?:Vehicle|VehicleDetail|vehicledetails)[^\d]*(\d{6,})/i.exec(u))) { out.source = 'iaai'; out.lot = m[1]; }
  else if ((m = /iaai\.com\/.*?[?&](?:itemid|stockNumber)=(\d+)/i.exec(u))) { out.source = 'iaai'; out.lot = m[1]; }
  else if (/bid\.cars/i.test(u)) {
    out.source = 'bidcars';
    if ((m = /lot[/=](\d+)/i.exec(u))) out.lot = m[1];
  } else if (/autoastat/i.test(u)) out.source = 'autoastat';
  else if (/manheim/i.test(u)) out.source = 'manheim';
  else if (/acvauctions/i.test(u)) out.source = 'acv';
  if ((m = /\b([A-HJ-NPR-Z0-9]{17})\b/i.exec(u))) out.vin = m[1].toUpperCase();
  return out;
}

/** VIN check-digit validation (ISO 3779, North America). */
export function isValidVin(vin) {
  const v = String(vin || '').toUpperCase().trim();
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(v)) return false;
  const map = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9, S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9 };
  const weights = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const c = v[i];
    const val = /\d/.test(c) ? Number(c) : map[c];
    if (val === undefined) return false;
    sum += val * weights[i];
  }
  const rem = sum % 11;
  const expected = rem === 10 ? 'X' : String(rem);
  return v[8] === expected;
}
