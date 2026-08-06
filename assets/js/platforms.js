/* =========================================================================
   LSC · Platform launcher catalog
   ---------------------------------------------------------------------------
   Every external site the advisor actually opens during a working day, in one
   place, with per-client deep links where the site supports them.

   About the marks: each entry ships a hand-drawn monogram tile in the
   platform's own brand colour rather than the company's real logo. Bundling
   third-party logos would mean redistributing trademarked artwork, and loading
   them from the web would break the site's zero-external-request rule (which
   CI enforces). The tiles are instantly recognisable by colour and letter and
   carry no legal baggage.
   ========================================================================= */

export const PLATFORM_GROUPS = [
  { id: 'house', label: { es: 'La Subasta Cubana', en: 'La Subasta Cubana' }, icon: 'gavel' },
  { id: 'auctions', label: { es: 'Subastas', en: 'Auctions' }, icon: 'car' },
  { id: 'research', label: { es: 'Historial y valoración', en: 'History & valuation' }, icon: 'search' },
  { id: 'logistics', label: { es: 'Transporte', en: 'Transport' }, icon: 'route' },
];

/**
 * @typedef {object} Platform
 * @property {string}   id
 * @property {string}   name
 * @property {string}   group
 * @property {string}   url        home / login page
 * @property {string}   mark       1-3 character monogram
 * @property {string}   color      brand background
 * @property {string}   fg         readable foreground on that background
 * @property {object}   desc       {es,en}
 * @property {function} [search]   (query) => deep link
 * @property {function} [vin]      (vin) => deep link
 */
export const PLATFORMS = [
  /* ---- La Subasta Cubana ------------------------------------------------ */
  {
    id: 'lsc', name: 'La Subasta Cubana', group: 'house',
    url: 'https://lasubastacubana.com/',
    mark: 'LSC', color: '#D1892A', fg: '#2a1c05',
    desc: { es: 'Sitio principal', en: 'Main site' },
  },
  {
    id: 'lsc-inventory', name: 'Inventario', group: 'house',
    url: 'https://lasubastacubana.com/inventory',
    mark: 'INV', color: '#9A5F16', fg: '#ffffff',
    desc: { es: 'Catálogo de autos en subasta', en: 'Auction car catalogue' },
  },
  {
    id: 'lsc-calc', name: 'Calculadora oficial', group: 'house',
    url: 'https://lasubastacubana.com/calculadora',
    mark: 'CAL', color: '#8A5514', fg: '#ffffff',
    desc: { es: 'Costos y tarifas oficiales', en: 'Official costs and fees' },
  },
  {
    id: 'lsc-fees', name: 'Precios y tarifas', group: 'house',
    url: 'https://lasubastacubana.com/precios-tarifas',
    mark: '$', color: '#6E4310', fg: '#ffffff',
    desc: { es: 'Tarifario vigente — contrástalo con el tuyo', en: 'Current fee schedule — check yours against it' },
  },
  {
    id: 'lsc-how', name: 'Cómo comprar', group: 'house',
    url: 'https://lasubastacubana.com/como-comprar',
    mark: '?', color: '#5A370D', fg: '#ffffff',
    desc: { es: 'Guía del proceso, para compartir con el cliente', en: 'Process guide, to share with the client' },
  },

  /* ---- Auctions ---------------------------------------------------------- */
  {
    id: 'copart', name: 'Copart', group: 'auctions',
    url: 'https://www.copart.com/',
    mark: 'CO', color: '#0B5FA5', fg: '#ffffff',
    desc: { es: 'La mayor subasta de aseguradoras de EE.UU.', en: 'Largest US insurance auction' },
    search: (q) => `https://www.copart.com/lotSearchResults?free=true&query=${encodeURIComponent(q)}`,
    vin: (v) => `https://www.copart.com/lotSearchResults?free=true&query=${encodeURIComponent(v)}`,
  },
  {
    id: 'iaai', name: 'IAA (IAAI)', group: 'auctions',
    url: 'https://www.iaai.com/',
    mark: 'IAA', color: '#123A5F', fg: '#ffffff',
    desc: { es: 'Insurance Auto Auctions · start codes y Vehicle Score', en: 'Insurance Auto Auctions · start codes and Vehicle Score' },
    search: (q) => `https://www.iaai.com/Search?Keyword=${encodeURIComponent(q)}`,
    vin: (v) => `https://www.iaai.com/Search?Keyword=${encodeURIComponent(v)}`,
  },
  {
    id: 'manheim', name: 'Manheim', group: 'auctions',
    url: 'https://www.manheim.com/',
    mark: 'MA', color: '#00539B', fg: '#ffffff',
    desc: { es: 'Mayorista dealer-to-dealer · MMR y Condition Report', en: 'Dealer-to-dealer wholesale · MMR and Condition Report' },
    search: (q) => `https://search.manheim.com/results?query=${encodeURIComponent(q)}`,
  },
  {
    id: 'acv', name: 'ACV Auctions', group: 'auctions',
    url: 'https://www.acvauctions.com/',
    mark: 'ACV', color: '#0F7B6C', fg: '#ffffff',
    desc: { es: 'Mayorista digital · inspección y audio del motor', en: 'Digital wholesale · inspection and engine audio' },
  },
  {
    id: 'adesa', name: 'ADESA', group: 'auctions',
    url: 'https://www.adesa.com/',
    mark: 'AD', color: '#C4142C', fg: '#ffffff',
    desc: { es: 'Mayorista alternativo', en: 'Alternative wholesale' },
  },
  {
    id: 'bidcars', name: 'bid.cars', group: 'auctions',
    url: 'https://bid.cars/',
    mark: 'BID', color: '#E08A17', fg: '#2a1c05',
    desc: { es: 'Buscador unificado de Copart e IAA + historial de precios', en: 'Unified Copart + IAA search with sale history' },
    search: (q) => `https://bid.cars/en/search/results?search-type=filters&query=${encodeURIComponent(q)}`,
    vin: (v) => `https://bid.cars/en/search/archived/${encodeURIComponent(v)}`,
  },
  {
    id: 'autoastat', name: 'AutoAstat', group: 'auctions',
    url: 'https://autoastat.com/',
    mark: 'AA', color: '#2D6A4F', fg: '#ffffff',
    desc: { es: 'Historial de precios finales de Copart e IAA', en: 'Final-price history from Copart and IAA' },
    search: (q) => `https://autoastat.com/en/search?query=${encodeURIComponent(q)}`,
    vin: (v) => `https://autoastat.com/en/vin/${encodeURIComponent(v)}`,
  },
  {
    id: 'sca', name: 'SCA Auction', group: 'auctions',
    url: 'https://sca.auction/',
    mark: 'SCA', color: '#1F4E79', fg: '#ffffff',
    desc: { es: 'Broker de salvage con acceso público', en: 'Salvage broker with public access' },
  },

  /* ---- History & valuation ----------------------------------------------- */
  {
    id: 'carfax', name: 'Carfax', group: 'research',
    url: 'https://www.carfax.com/',
    mark: 'CF', color: '#0B4EA2', fg: '#ffffff',
    desc: { es: 'Historial por VIN: accidentes, dueños, títulos, odómetro', en: 'VIN history: accidents, owners, titles, odometer' },
    vin: (v) => `https://www.carfax.com/VehicleHistory/p/Report.cfx?vin=${encodeURIComponent(v)}`,
  },
  {
    id: 'autocheck', name: 'AutoCheck', group: 'research',
    url: 'https://www.autocheck.com/vehiclehistory/',
    mark: 'AC', color: '#1B4F9C', fg: '#ffffff',
    desc: { es: 'Alternativa a Carfax, con puntuación comparativa', en: 'Carfax alternative with a comparative score' },
  },
  {
    id: 'nhtsa', name: 'NHTSA VIN Decoder', group: 'research',
    url: 'https://vpic.nhtsa.dot.gov/decoder/',
    mark: 'VIN', color: '#14213D', fg: '#ffffff',
    desc: { es: 'Decodificador oficial y gratuito de VIN', en: 'Official free VIN decoder' },
    vin: (v) => `https://vpic.nhtsa.dot.gov/decoder/Decoder/DecodeVin?VIN=${encodeURIComponent(v)}`,
  },
  {
    id: 'nicb', name: 'NICB VINCheck', group: 'research',
    url: 'https://www.nicb.org/vincheck',
    mark: 'NI', color: '#1D3557', fg: '#ffffff',
    desc: { es: 'Robo y pérdida total declarada — gratis', en: 'Theft and total-loss records — free' },
  },
  {
    id: 'kbb', name: 'Kelley Blue Book', group: 'research',
    url: 'https://www.kbb.com/',
    mark: 'KBB', color: '#0A2B4E', fg: '#ffffff',
    desc: { es: 'Valor de mercado de referencia', en: 'Reference market value' },
  },
  {
    id: 'edmunds', name: 'Edmunds', group: 'research',
    url: 'https://www.edmunds.com/appraisal/',
    mark: 'ED', color: '#005BAA', fg: '#ffffff',
    desc: { es: 'Tasación y costo de propiedad', en: 'Appraisal and cost of ownership' },
  },

  /* ---- Transport ---------------------------------------------------------- */
  {
    id: 'superdispatch', name: 'Super Dispatch', group: 'logistics',
    url: 'https://superdispatch.com/',
    mark: 'SD', color: '#C63C16', fg: '#ffffff',
    desc: { es: 'Cotizar y contratar el traslado del auto', en: 'Quote and book vehicle transport' },
  },
  {
    id: 'superdispatch-shipper', name: 'Super Dispatch · Shipper', group: 'logistics',
    url: 'https://shipper.superdispatch.com/',
    mark: 'SD+', color: '#8F2A11', fg: '#ffffff',
    desc: { es: 'Panel de envíos y seguimiento', en: 'Shipments dashboard and tracking' },
  },
  {
    id: 'centraldispatch', name: 'Central Dispatch', group: 'logistics',
    url: 'https://www.centraldispatch.com/',
    mark: 'CD', color: '#00436B', fg: '#ffffff',
    desc: { es: 'Bolsa de transportistas alternativa', en: 'Alternative carrier marketplace' },
  },
  {
    id: 'fmcsa', name: 'FMCSA SAFER', group: 'logistics',
    url: 'https://safer.fmcsa.dot.gov/CompanySnapshot.aspx',
    mark: 'DOT', color: '#2B4162', fg: '#ffffff',
    desc: { es: 'Verificar licencia y seguro del transportista', en: 'Verify a carrier licence and insurance' },
  },
];

export const platformById = (id) => PLATFORMS.find((p) => p.id === id) || null;

export const platformsByGroup = (group) => PLATFORMS.filter((p) => p.group === group);

/**
 * Build the most useful link for a platform given what we know about a client.
 * Falls back to the home page whenever no deep link applies.
 */
export function contextualUrl(platform, { vin, query } = {}) {
  if (vin && typeof platform.vin === 'function') return platform.vin(vin);
  if (query && typeof platform.search === 'function') return platform.search(query);
  return platform.url;
}
