import type { ActivityPattern } from './patterns'
import {
  type LocalePhraseGroup,
  SAAS_LOCALE_ACTIVITY_TYPE_KEYWORDS,
  SAAS_LOCALE_AGREEMENT_GROUPS,
  SAAS_LOCALE_EVENT_KEYWORDS,
  SAAS_LOCALE_EXCLAMATION_KEYWORDS,
  SAAS_LOCALE_EXCLUSION_PHRASES,
  SAAS_LOCALE_IDEA_KEYWORDS,
  SAAS_LOCALE_PLACE_KEYWORDS,
  SAAS_LOCALE_SUGGESTION_GROUPS
} from './saas-locale-signals'

type PhraseGroup = LocalePhraseGroup

const LOOSE_SCRIPT_PATTERN =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Thai}]/u

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function phraseToPattern(phrase: string): RegExp {
  const escaped = escapeRegExp(phrase.trim()).replace(/\s+/g, '\\s+')
  if (LOOSE_SCRIPT_PATTERN.test(phrase)) {
    return new RegExp(escaped, 'iu')
  }
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?:$|[^\\p{L}\\p{N}])`, 'iu')
}

function buildPatterns(groups: readonly PhraseGroup[]): ActivityPattern[] {
  return groups.flatMap((group) =>
    group.phrases.map((phrase, index) => ({
      name: `ml_${group.lang}_${index + 1}`,
      pattern: phraseToPattern(phrase),
      confidence: group.confidence,
      description: `Multilingual ${group.candidateType}: ${phrase}`,
      candidateType: group.candidateType
    }))
  )
}

function buildKeywordPatterns(phrases: readonly string[]): RegExp[] {
  return phrases.map(phraseToPattern)
}

const SUGGESTION_GROUPS: readonly PhraseGroup[] = [
  {
    lang: 'es',
    confidence: 0.88,
    candidateType: 'suggestion',
    phrases: ['deberíamos ir', 'podríamos ir', 'vamos a ir', 'quiero ir', 'hay que visitar']
  },
  {
    lang: 'pt',
    confidence: 0.88,
    candidateType: 'suggestion',
    phrases: ['deveríamos ir', 'devíamos ir', 'vamos conhecer', 'quero ir', 'temos que visitar']
  },
  {
    lang: 'de',
    confidence: 0.88,
    candidateType: 'suggestion',
    phrases: ['wir sollten', 'lass uns', 'sollen wir', 'ich möchte nach', 'müssen wir besuchen']
  },
  {
    lang: 'fr',
    confidence: 0.88,
    candidateType: 'suggestion',
    phrases: [
      'on devrait',
      'nous devrions',
      'allons visiter',
      "j'aimerais aller",
      'il faut visiter'
    ]
  },
  {
    lang: 'it',
    confidence: 0.88,
    candidateType: 'suggestion',
    phrases: ['dovremmo andare', 'andiamo a', 'vorrei andare', 'bisogna visitare', 'da visitare']
  },
  {
    lang: 'nl',
    confidence: 0.85,
    candidateType: 'suggestion',
    phrases: ['we zouden moeten', 'laten we', 'zullen we', 'ik wil naar', 'moeten we bezoeken']
  },
  {
    lang: 'sv',
    confidence: 0.85,
    candidateType: 'suggestion',
    phrases: ['vi borde', 'ska vi', 'låt oss', 'jag vill gå', 'vill åka till']
  },
  {
    lang: 'da',
    confidence: 0.85,
    candidateType: 'suggestion',
    phrases: ['vi burde', 'skal vi', 'lad os', 'jeg vil gerne til', 'vi skal besøge']
  },
  {
    lang: 'nb',
    confidence: 0.85,
    candidateType: 'suggestion',
    phrases: ['vi burde', 'skal vi', 'la oss', 'jeg vil dra', 'vi må besøke']
  },
  {
    lang: 'pl',
    confidence: 0.85,
    candidateType: 'suggestion',
    phrases: ['powinniśmy', 'chodźmy', 'chcę iść', 'warto odwiedzić', 'możemy pójść']
  },
  {
    lang: 'ru',
    confidence: 0.85,
    candidateType: 'suggestion',
    phrases: ['нам стоит', 'давай сходим', 'давайте сходим', 'хочу сходить', 'надо посетить']
  },
  {
    lang: 'hi',
    confidence: 0.85,
    candidateType: 'suggestion',
    phrases: ['चलो', 'हमें जाना चाहिए', 'जाना चाहिए', 'मैं जाना चाहता', 'घूमने चलें', 'देखने चलते हैं']
  },
  {
    lang: 'id',
    confidence: 0.85,
    candidateType: 'suggestion',
    phrases: ['kita harus', 'ayo pergi', 'mau ke', 'pengen ke', 'coba ke']
  },
  {
    lang: 'tr',
    confidence: 0.85,
    candidateType: 'suggestion',
    phrases: ['gidelim', 'gitmeliyiz', 'gitmek istiyorum', 'deneyelim', 'ziyaret edelim']
  },
  {
    lang: 'ar',
    confidence: 0.85,
    candidateType: 'suggestion',
    phrases: ['لنذهب', 'يجب أن نذهب', 'أريد الذهاب', 'خلينا نروح', 'لازم نزور']
  },
  {
    lang: 'ja',
    confidence: 0.85,
    candidateType: 'suggestion',
    phrases: ['行こう', '行きたい', '行ってみたい', '訪れたい', '見に行こう']
  },
  {
    lang: 'ko',
    confidence: 0.85,
    candidateType: 'suggestion',
    phrases: ['가자', '가고 싶', '가볼까', '해보자', '방문하자']
  },
  {
    lang: 'zh',
    confidence: 0.85,
    candidateType: 'suggestion',
    phrases: ['我们应该去', '我們應該去', '一起去', '想去', '去看看', '值得去']
  }
]

const AGREEMENT_GROUPS: readonly PhraseGroup[] = [
  {
    lang: 'es',
    confidence: 0.55,
    candidateType: 'agreement',
    phrases: ['suena bien', 'me apunto', 'qué buena pinta']
  },
  {
    lang: 'pt',
    confidence: 0.55,
    candidateType: 'agreement',
    phrases: ['parece bom', 'boa ideia', 'eu topo']
  },
  {
    lang: 'de',
    confidence: 0.55,
    candidateType: 'agreement',
    phrases: ['klingt gut', 'ich bin dabei', 'sieht gut aus']
  },
  {
    lang: 'fr',
    confidence: 0.55,
    candidateType: 'agreement',
    phrases: ['ça a l’air bien', "ça a l'air bien", 'ça a l air bien', 'partant', 'bonne idée']
  },
  {
    lang: 'it',
    confidence: 0.55,
    candidateType: 'agreement',
    phrases: ['sembra bello', 'ci sto', 'bella idea']
  },
  {
    lang: 'nl',
    confidence: 0.55,
    candidateType: 'agreement',
    phrases: ['klinkt goed', 'ik ben erbij', 'ziet er leuk uit']
  },
  {
    lang: 'sv',
    confidence: 0.55,
    candidateType: 'agreement',
    phrases: ['låter bra', 'jag är på', 'ser kul ut']
  },
  {
    lang: 'da',
    confidence: 0.55,
    candidateType: 'agreement',
    phrases: ['lyder godt', 'jeg er på', 'ser sjovt ud']
  },
  {
    lang: 'nb',
    confidence: 0.55,
    candidateType: 'agreement',
    phrases: ['høres bra', 'jeg er med', 'ser gøy ut']
  },
  {
    lang: 'pl',
    confidence: 0.55,
    candidateType: 'agreement',
    phrases: ['brzmi dobrze', 'jestem za', 'dobry pomysł']
  },
  {
    lang: 'ru',
    confidence: 0.55,
    candidateType: 'agreement',
    phrases: ['звучит здорово', 'я за', 'выглядит классно']
  },
  {
    lang: 'hi',
    confidence: 0.55,
    candidateType: 'agreement',
    phrases: ['अच्छा लगता है', 'मैं तैयार हूँ', 'बहुत बढ़िया']
  },
  {
    lang: 'id',
    confidence: 0.55,
    candidateType: 'agreement',
    phrases: ['kedengarannya bagus', 'aku ikut', 'ide bagus']
  },
  {
    lang: 'tr',
    confidence: 0.55,
    candidateType: 'agreement',
    phrases: ['kulağa güzel', 'ben varım', 'iyi fikir']
  },
  {
    lang: 'ar',
    confidence: 0.55,
    candidateType: 'agreement',
    phrases: ['يبدو رائع', 'أنا معكم', 'فكرة جيدة']
  },
  {
    lang: 'ja',
    confidence: 0.55,
    candidateType: 'agreement',
    phrases: ['よさそう', 'いいね', '面白そう']
  },
  {
    lang: 'ko',
    confidence: 0.55,
    candidateType: 'agreement',
    phrases: ['좋겠다', '좋아', '재밌겠다']
  },
  {
    lang: 'zh',
    confidence: 0.55,
    candidateType: 'agreement',
    phrases: ['听起来不错', '聽起來不錯', '看起来很好', '看起來很好', '好主意']
  }
]

export const MULTILINGUAL_SUGGESTION_KEYWORDS: readonly string[] = SUGGESTION_GROUPS.flatMap(
  (group) => group.phrases
).concat(SAAS_LOCALE_SUGGESTION_GROUPS.flatMap((group) => group.phrases))

export const MULTILINGUAL_AGREEMENT_KEYWORDS: readonly string[] = AGREEMENT_GROUPS.flatMap(
  (group) => group.phrases
).concat(SAAS_LOCALE_AGREEMENT_GROUPS.flatMap((group) => group.phrases))

export const MULTILINGUAL_EXCLAMATION_KEYWORDS: readonly string[] = [
  'increíble',
  'incrível',
  'unglaublich',
  'incroyable',
  'bellissimo',
  'geweldig',
  'fantastyczne',
  'классно',
  'कमाल',
  'bagus banget',
  'harika',
  'رائع',
  'すごい',
  '대박',
  '太棒了',
  ...SAAS_LOCALE_EXCLAMATION_KEYWORDS
]

export const MULTILINGUAL_PLACE_KEYWORDS: readonly string[] = [
  'restaurante',
  'ristorante',
  'restaurant',
  'restauracja',
  'ресторан',
  'restoran',
  'مطعم',
  'レストラン',
  '식당',
  '餐厅',
  '餐廳',
  'café',
  '咖啡',
  'カフェ',
  '카페',
  'hotel',
  'hôtel',
  'отель',
  'ホテル',
  '호텔',
  '酒店',
  'playa',
  'praia',
  'plage',
  'strand',
  'пляж',
  'pantai',
  'شاطئ',
  'ビーチ',
  '해변',
  '海滩',
  '海灘',
  ...SAAS_LOCALE_PLACE_KEYWORDS
]

export const MULTILINGUAL_EVENT_KEYWORDS: readonly string[] = [
  'concierto',
  'concerto',
  'concert',
  'konzert',
  'концерт',
  'konser',
  'حفلة',
  'コンサート',
  '콘서트',
  '演唱会',
  '演唱會',
  'festival',
  'фестиваль',
  'फेस्टिवल',
  ...SAAS_LOCALE_EVENT_KEYWORDS
]

export const MULTILINGUAL_ACTIVITY_TYPE_KEYWORDS: readonly string[] = [
  'senderismo',
  'trilha',
  'randonnée',
  'wanderung',
  'escursione',
  'wandeling',
  'wędrówka',
  'поход',
  'mendaki',
  'yürüyüş',
  'رحلة مشي',
  'ハイキング',
  '등산',
  '徒步',
  '여행',
  '旅行',
  'viaje',
  'viagem',
  'reise',
  'voyage',
  'podróż',
  'यात्रा',
  ...SAAS_LOCALE_ACTIVITY_TYPE_KEYWORDS
]

export const MULTILINGUAL_IDEA_KEYWORDS: readonly string[] = [
  'algún día',
  'um dia',
  'eines tages',
  'un jour',
  'un giorno',
  'ooit',
  'pewnego dnia',
  'когда-нибудь',
  'एक दिन',
  'suatu hari',
  'bir gün',
  'يومًا ما',
  'いつか',
  '언젠가',
  '有一天',
  ...SAAS_LOCALE_IDEA_KEYWORDS
]

const MULTILINGUAL_EXCLUSION_PHRASES = [
  'no deberíamos',
  'não devemos',
  'nicht hingehen',
  'ne pas aller',
  'non andare',
  'niet gaan',
  'inte gå',
  'ikke gå',
  'nie iść',
  'не идти',
  'मत जाओ',
  'jangan pergi',
  'gitmeyelim',
  'لا نذهب',
  '行きたくない',
  '行かない',
  '가지 말자',
  '不想去',
  '不要去',
  'trabajo',
  'trabalho',
  'arbeit',
  'travail',
  'lavoro',
  'werk',
  'praca',
  'работа',
  'काम',
  'kerja',
  'iş',
  'عمل',
  '仕事',
  '일',
  '工作',
  'médico',
  'medico',
  'arzt',
  'médecin',
  'dottore',
  'dokter',
  'lekarz',
  'врач',
  'डॉक्टर',
  'doktor',
  'طبيب',
  '医者',
  '病院',
  '의사',
  '병원',
  '医生',
  '醫生',
  ...SAAS_LOCALE_EXCLUSION_PHRASES
] as const

export const MULTILINGUAL_ACTIVITY_PATTERNS: readonly ActivityPattern[] = buildPatterns([
  ...SUGGESTION_GROUPS,
  ...SAAS_LOCALE_SUGGESTION_GROUPS,
  ...AGREEMENT_GROUPS,
  ...SAAS_LOCALE_AGREEMENT_GROUPS
])

export const MULTILINGUAL_ACTIVITY_KEYWORDS: readonly RegExp[] = buildKeywordPatterns([
  ...MULTILINGUAL_PLACE_KEYWORDS,
  ...MULTILINGUAL_EVENT_KEYWORDS,
  ...MULTILINGUAL_ACTIVITY_TYPE_KEYWORDS,
  ...MULTILINGUAL_IDEA_KEYWORDS
])

export const MULTILINGUAL_EXCLUSION_PATTERNS: readonly RegExp[] = buildKeywordPatterns(
  MULTILINGUAL_EXCLUSION_PHRASES
)
