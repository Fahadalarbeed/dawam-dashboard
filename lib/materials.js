// كتالوج مواد المخزن — مأخوذ من نموذج
// "ISSUE OF MATERIALS FOR INDIVIDUAL JOBS & GATE PASS" (محافظة الفروانية)
//
// كل مادة:
//   id      معرّف ثابت (لا تغيّره بعد الاستخدام — يُحفظ مع السجلات)
//   label   الاسم بالعربي على الأيقونة
//   en      الاسم كما في النموذج
//   icon    اسم أيقونة Tabler (tabler.io/icons) بدون البادئة ti-
//   unit    وحدة العدد ('حبة' افتراضيًا، 'متر' للكيبلات)
//   types   الأنواع / المقاسات — لو نوع واحد فقط يُتخطّى اختيار النوع
//   tone    لون حلقة اختياري (ألمنيوم / نحاس)
//   askText لو المادة تحتاج نصًا بدل نوع (مثل رقم المفتاح)

const AL = '#AEB8C8';
const CU = '#C98A5B';

export const MATERIAL_GROUPS = [
  {
    key: 'joints',
    color: { bg: '#FDE7DF', fg: '#D0592F' },
    title: 'الجوينتات والريزن', short: 'الجوينتات', titleEn: 'Joints & Resin', shortEn: 'Joints',
    items: [
      { id: 'straight_joint', label: 'جوينت مستقيم', en: 'Straight Joint', icon: 'link',
        types: ['300X300', '300X185', '300X150', '240X240', '150X150', '150X70', '95X95', '50X35'] },
      { id: 'branch_joint', label: 'جوينت فرعي', en: 'Branch Joint', icon: 'arrows-split',
        types: ['300X300', '300X185', '300X150', '300X95', '300X70', '300X50', '300X35', '240X95', '240X35', '150X150', '150X35'] },
      { id: 'pot_end', label: 'بوت إند', en: 'Pot End', icon: 'circle-dot',
        types: ['300X300', '240X120', '150X150', '95X95', '70X35'] },
      { id: 'joint_resin', label: 'ريزن جوينت', en: 'Joint Resin', icon: 'flask',
        types: ['RED', 'GREEN', 'YELLOW', 'BLUE', 'L-BROWN', 'BROWN', 'BLACK'] },
    ],
  },
  {
    key: 'cutouts',
    color: { bg: '#FFF1CC', fg: '#B97F00' },
    title: 'الكت آوت والفيوزات', short: 'الفيوزات', titleEn: 'Cut-outs & Fuses', shortEn: 'Fuses',
    items: [
      { id: 'indoor_cutout', label: 'كت آوت داخلي', en: 'Indoor Cut.Out', icon: 'home',
        types: ['300 AMP', '250 AMP', '200 AMP', '160 AMP', '100 AMP'] },
      { id: 'outdoor_cutout', label: 'كت آوت خارجي', en: 'Outdoor Cut.Out', icon: 'sun',
        types: ['200 AMP'] },
      { id: 'cutout_fbase', label: 'قاعدة كت آوت', en: 'Cut.Out F/Base', icon: 'box',
        types: ['300 AMP', '250 AMP', '200 AMP', '160 AMP', '100 AMP'] },
      { id: 'cutout_fuse', label: 'فيوز كت آوت', en: 'Cut.Out Fuse', icon: 'plug',
        types: ['315 AMP', '250 AMP', '200 AMP', '160 AMP', '100 AMP'] },
      { id: 'stn_fuse', label: 'فيوز محطة', en: 'S/STN Fuse', icon: 'bolt',
        types: ['450 AMP', '400 AMP', '355 AMP'] },
      { id: 'vem_fuse', label: 'فيوز VEM', en: 'VEM Type', icon: 'settings',
        types: ['400 AMP'] },
      { id: 'stn_fcarrier', label: 'حامل فيوز محطة', en: 'S/STN F/Carrier', icon: 'archive',
        types: ['PLASTIC'] },
      { id: 'cutout_fcarrier', label: 'حامل فيوز كت آوت', en: 'Cut.Out F/Carrier', icon: 'inbox',
        types: ['PLASTIC', 'PORCELAIN'] },
      { id: 'fuse_puller', label: 'ساحب فيوز', en: 'Fuse Puller', icon: 'tool',
        types: ['PULLER'] },
      { id: 'mccb', label: 'قاطع MCCB', en: 'MCCB', icon: 'toggle-left',
        types: ['400-A', '300-A', '250-A', '200-A', '160-A', '125-A'] },
    ],
  },
  {
    key: 'cables',
    color: { bg: '#DDF3EC', fg: '#13896A' },
    title: 'الكيبلات والأسلاك', short: 'الكيبلات', titleEn: 'Cables & Wires', shortEn: 'Cables',
    items: [
      { id: 'lt_al_cable', label: 'كيبل ألمنيوم L.T', en: 'L.T. AL Cable', icon: 'wave-sine', unit: 'متر', tone: AL,
        types: ['4CX300', '4CX240', '4CX150', '4CX95'] },
      { id: 'lt_cu_cable', label: 'كيبل نحاس L.T', en: 'L.T. CU Cable', icon: 'wave-sine', unit: 'متر', tone: CU,
        types: ['4CX50', '4CX35'] },
      { id: 'score_cu_cable', label: 'كيبل نحاس سنقل', en: 'S/Core CU Cable', icon: 'line', unit: 'متر', tone: CU,
        types: ['1CX185', '1CX120', '1CX70', '1CX50', '1CX35'] },
      { id: 'generator_wire', label: 'سلك مولد', en: 'Generator Wire', icon: 'route', unit: 'متر',
        types: ['GENERATOR WIRE'] },
    ],
  },
  {
    key: 'lugs',
    color: { bg: '#ECE8FD', fg: '#6A5AD6' },
    title: 'اللقز والجلاند', short: 'اللقز', titleEn: 'Lugs & Glands', shortEn: 'Lugs',
    items: [
      { id: 'al_lugs', label: 'لقز ألمنيوم', en: 'AL Cable Lugs', icon: 'nut', tone: AL,
        types: ['300 SQ.MM', '240 SQ.MM', '185 SQ.MM', '150 SQ.MM', '95 SQ.MM'] },
      { id: 'cu_lugs', label: 'لقز نحاس', en: 'CU Cable Lugs', icon: 'nut', tone: CU,
        types: ['300 SQ.MM', '185 SQ.MM', '120 SQ.MM', '95 SQ.MM', '70 SQ.MM', '50 SQ.MM', '35 SQ.MM'] },
      { id: 'cable_gland', label: 'جلاند كيبل', en: 'Cable Gland', icon: 'circle',
        types: ['300 SQ.MM', '200 SQ.MM', '160 SQ.MM', '100 SQ.MM'] },
    ],
  },
  {
    key: 'meters',
    color: { bg: '#E1EEFB', fg: '#2A70C4' },
    title: 'العدادات والطبلونات', short: 'العدادات', titleEn: 'Meters & Boards', shortEn: 'Meters',
    items: [
      { id: 'meter_3ph', label: 'عداد ٣ فاز', en: 'Meter 3/Phase', icon: 'gauge',
        types: ['500 AMP/5', '400 AMP/5', '300 AMP/5', '200 AMP/5', '125 AMP/5', '50 AMP'] },
      { id: 'meter_1ph', label: 'عداد سنقل فاز', en: 'Meter S/Phase', icon: 'clock',
        types: ['40 AMP'] },
      { id: 'ct_meter', label: 'عداد C.T', en: 'C.T. Meter', icon: 'device-tablet',
        types: ['300 AMP/5', '200 AMP/5', 'RISER'] },
      { id: 'meter_board', label: 'لوحة عداد', en: 'Meter Board', icon: 'layout-board',
        types: ['85X45 CMS', '65X45 CMS', '45X45 CMS'] },
    ],
  },
  {
    key: 'misc',
    color: { bg: '#FBE4EE', fg: '#C4467A' },
    title: 'متفرقات', short: 'متفرقات', titleEn: 'Miscellaneous', shortEn: 'Misc',
    items: [
      { id: 'tools', label: 'مسامير وبراغي', en: 'Tools Materials', icon: 'hammer',
        types: ['STEEL NAILS 3"', 'WOODEN SCREW 3/4"'] },
      { id: 'pad_lock', label: 'قفل', en: 'Pad Lock', icon: 'lock',
        types: ['D-4', 'MK-4'] },
      { id: 'master_key', label: 'ماستر كي', en: 'Master Key', icon: 'key',
        askText: 'رقم المفتاح / Key No.' },
    ],
  },
];

export const MATERIAL_BY_ID = Object.fromEntries(
  MATERIAL_GROUPS.flatMap((g) => g.items.map((it) => [it.id, it]))
);

// ترجمة الأنواع النصية (المقاسات والأرقام تبقى كما هي)
export const TYPE_AR = {
  RED: 'أحمر', GREEN: 'أخضر', YELLOW: 'أصفر', BLUE: 'أزرق',
  'L-BROWN': 'بني فاتح', BROWN: 'بني', BLACK: 'أسود',
  PLASTIC: 'بلاستيك', PORCELAIN: 'بورسلين', PULLER: 'ساحب',
  'GENERATOR WIRE': 'سلك مولد', RISER: 'رايزر',
  'STEEL NAILS 3"': 'مسامير حديد ٣ إنش', 'WOODEN SCREW 3/4"': 'براغي خشب ٣/٤ إنش',
};

// ألوان الريزن — دائرة ملونة بجانب النوع
export const TYPE_SWATCH = {
  RED: '#D93A32', GREEN: '#2E9E4F', YELLOW: '#F2C230', BLUE: '#2F6FD6',
  'L-BROWN': '#C4955E', BROWN: '#7A4B2A', BLACK: '#1F1F1F',
};

// لون القسم لكل مادة (خلفية الأيقونة ولونها)
export const ITEM_COLOR = Object.fromEntries(
  MATERIAL_GROUPS.flatMap((g) => g.items.map((it) => [it.id, g.color]))
);

export function unitOf(item) {
  return item?.unit || 'حبة';
}
