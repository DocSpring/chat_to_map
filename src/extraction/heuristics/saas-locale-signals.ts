import type { QueryType } from '../../types'

export interface LocalePhraseGroup {
  readonly lang: string
  readonly confidence: number
  readonly candidateType: QueryType
  readonly phrases: readonly string[]
}

export const SAAS_LOCALE_SUGGESTION_GROUPS: readonly LocalePhraseGroup[] = [
  {
    lang: 'fa',
    confidence: 0.85,
    candidateType: 'suggestion',
    phrases: ['باید برویم', 'بریم', 'می‌خوام برم', 'دوست دارم بروم', 'باید دیدن کنیم']
  },
  {
    lang: 'vi',
    confidence: 0.85,
    candidateType: 'suggestion',
    phrases: ['chúng ta nên đi', 'mình nên đi', 'đi thử', 'muốn đi', 'nên ghé thăm']
  },
  {
    lang: 'cs',
    confidence: 0.85,
    candidateType: 'suggestion',
    phrases: ['měli bychom jít', 'pojďme', 'chci jít', 'stojí za návštěvu', 'zkusíme']
  },
  {
    lang: 'uk',
    confidence: 0.85,
    candidateType: 'suggestion',
    phrases: ['нам варто піти', 'давай сходимо', 'хочу піти', 'треба відвідати']
  },
  {
    lang: 'hu',
    confidence: 0.85,
    candidateType: 'suggestion',
    phrases: ['el kellene mennünk', 'menjünk', 'szeretnék menni', 'próbáljuk ki']
  },
  {
    lang: 'ro',
    confidence: 0.85,
    candidateType: 'suggestion',
    phrases: ['ar trebui să mergem', 'hai să mergem', 'vreau să merg', 'merită vizitat']
  },
  {
    lang: 'el',
    confidence: 0.85,
    candidateType: 'suggestion',
    phrases: ['να πάμε', 'πρέπει να πάμε', 'θέλω να πάω', 'αξίζει να επισκεφτούμε']
  },
  {
    lang: 'fi',
    confidence: 0.85,
    candidateType: 'suggestion',
    phrases: ['meidän pitäisi mennä', 'mennään', 'haluan mennä', 'kannattaa käydä']
  },
  {
    lang: 'he',
    confidence: 0.85,
    candidateType: 'suggestion',
    phrases: ['כדאי שנלך', 'בוא נלך', 'בואו נלך', 'אני רוצה ללכת', 'כדאי לבקר']
  },
  {
    lang: 'sk',
    confidence: 0.85,
    candidateType: 'suggestion',
    phrases: ['mali by sme ísť', 'poďme', 'chcem ísť', 'stojí za návštevu', 'skúsme']
  },
  {
    lang: 'th',
    confidence: 0.85,
    candidateType: 'suggestion',
    phrases: ['เราควรไป', 'ไปกันเถอะ', 'อยากไป', 'น่าไป', 'ลองไป']
  },
  {
    lang: 'bg',
    confidence: 0.85,
    candidateType: 'suggestion',
    phrases: ['трябва да отидем', 'хайде да отидем', 'искам да отида', 'да пробваме']
  }
]

export const SAAS_LOCALE_AGREEMENT_GROUPS: readonly LocalePhraseGroup[] = [
  {
    lang: 'fa',
    confidence: 0.55,
    candidateType: 'agreement',
    phrases: ['به نظر خوبه', 'من هستم', 'ایده خوبیه', 'عالیه']
  },
  {
    lang: 'vi',
    confidence: 0.55,
    candidateType: 'agreement',
    phrases: ['nghe hay đó', 'mình tham gia', 'ý hay', 'trông vui']
  },
  {
    lang: 'cs',
    confidence: 0.55,
    candidateType: 'agreement',
    phrases: ['zní to dobře', 'jdu do toho', 'dobrý nápad', 'vypadá to dobře']
  },
  {
    lang: 'uk',
    confidence: 0.55,
    candidateType: 'agreement',
    phrases: ['звучить добре', 'я підтримую', 'гарна ідея', 'виглядає класно']
  },
  {
    lang: 'hu',
    confidence: 0.55,
    candidateType: 'agreement',
    phrases: ['jól hangzik', 'benne vagyok', 'jó ötlet', 'jónak tűnik']
  },
  {
    lang: 'ro',
    confidence: 0.55,
    candidateType: 'agreement',
    phrases: ['sună bine', 'mă bag', 'idee bună', 'arată bine']
  },
  {
    lang: 'el',
    confidence: 0.55,
    candidateType: 'agreement',
    phrases: ['ακούγεται καλό', 'είμαι μέσα', 'καλή ιδέα', 'φαίνεται ωραίο']
  },
  {
    lang: 'fi',
    confidence: 0.55,
    candidateType: 'agreement',
    phrases: ['kuulostaa hyvältä', 'olen mukana', 'hyvä idea', 'näyttää kivalta']
  },
  {
    lang: 'he',
    confidence: 0.55,
    candidateType: 'agreement',
    phrases: ['נשמע טוב', 'אני בפנים', 'רעיון טוב', 'נראה כיף']
  },
  {
    lang: 'sk',
    confidence: 0.55,
    candidateType: 'agreement',
    phrases: ['znie to dobre', 'idem do toho', 'dobrý nápad', 'vyzerá to dobre']
  },
  {
    lang: 'th',
    confidence: 0.55,
    candidateType: 'agreement',
    phrases: ['ฟังดูดี', 'ไปด้วย', 'ไอเดียดี', 'น่าสนุก']
  },
  {
    lang: 'bg',
    confidence: 0.55,
    candidateType: 'agreement',
    phrases: ['звучи добре', 'аз съм за', 'добра идея', 'изглежда забавно']
  }
]

export const SAAS_LOCALE_EXCLAMATION_KEYWORDS: readonly string[] = [
  'فوق‌العاده',
  'tuyệt vời',
  'úžasné',
  'неймовірно',
  'szuper',
  'minunat',
  'καταπληκτικό',
  'mahtavaa',
  'מדהים',
  'paráda',
  'สุดยอด',
  'страхотно'
]

export const SAAS_LOCALE_PLACE_KEYWORDS: readonly string[] = [
  'رستوران',
  'کافه',
  'ساحل',
  'nhà hàng',
  'quán cà phê',
  'bãi biển',
  'restaurace',
  'kavárna',
  'pláž',
  'ресторан',
  'кафе',
  'пляж',
  'étterem',
  'kávézó',
  'strand',
  'cafenea',
  'plajă',
  'εστιατόριο',
  'ξενοδοχείο',
  'παραλία',
  'ravintola',
  'kahvila',
  'ranta',
  'מסעדה',
  'מלון',
  'חוף',
  'reštaurácia',
  'kaviareň',
  'ร้านอาหาร',
  'คาเฟ่',
  'ชายหาด',
  'ресторант',
  'кафене',
  'плаж'
]

export const SAAS_LOCALE_EVENT_KEYWORDS: readonly string[] = [
  'کنسرت',
  'جشنواره',
  'buổi hòa nhạc',
  'lễ hội',
  'koncert',
  'festival',
  'концерт',
  'фестиваль',
  'koncert',
  'fesztivál',
  'concert',
  'festival',
  'συναυλία',
  'φεστιβάλ',
  'konsertti',
  'festivaali',
  'הופעה',
  'פסטיבל',
  'koncert',
  'เทศกาล',
  'คอนเสิร์ต',
  'концерт',
  'фестивал'
]

export const SAAS_LOCALE_ACTIVITY_TYPE_KEYWORDS: readonly string[] = [
  'پیاده‌روی',
  'سفر',
  'đi bộ đường dài',
  'du lịch',
  'výlet',
  'turistika',
  'похід',
  'подорож',
  'túra',
  'utazás',
  'drumeție',
  'călătorie',
  'πεζοπορία',
  'ταξίδι',
  'vaellus',
  'matka',
  'טיול',
  'נסיעה',
  'turistika',
  'cesta',
  'เดินป่า',
  'เที่ยว',
  'поход',
  'пътуване'
]

export const SAAS_LOCALE_IDEA_KEYWORDS: readonly string[] = [
  'یک روزی',
  'một ngày nào đó',
  'někdy',
  'колись',
  'egyszer',
  'într-o zi',
  'κάποια μέρα',
  'jonain päivänä',
  'יום אחד',
  'niekedy',
  'สักวัน',
  'някой ден'
]

export const SAAS_LOCALE_EXCLUSION_PHRASES: readonly string[] = [
  'نباید برویم',
  'کار',
  'دکتر',
  'không nên đi',
  'công việc',
  'bác sĩ',
  'neměli bychom jít',
  'práce',
  'doktor',
  'не варто йти',
  'робота',
  'лікар',
  'ne menjünk',
  'munka',
  'orvos',
  'să nu mergem',
  'muncă',
  'doctor',
  'να μην πάμε',
  'δουλειά',
  'γιατρός',
  'ei mennä',
  'työ',
  'lääkäri',
  'לא נלך',
  'עבודה',
  'רופא',
  'nemali by sme ísť',
  'práca',
  'lekár',
  'ไม่ควรไป',
  'งาน',
  'หมอ',
  'да не ходим',
  'работа',
  'лекар'
]
