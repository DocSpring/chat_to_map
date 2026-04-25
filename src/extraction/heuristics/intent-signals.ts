import {
  MULTILINGUAL_AGREEMENT_KEYWORDS,
  MULTILINGUAL_EXCLAMATION_KEYWORDS,
  MULTILINGUAL_SUGGESTION_KEYWORDS
} from './multilingual-signals'

export const EXCLAMATION_KEYWORDS: readonly string[] = [
  'amazing',
  'awesome',
  'beautiful',
  'delicious',
  'incredible',
  ...MULTILINGUAL_EXCLAMATION_KEYWORDS
]

export const AGREEMENT_KEYWORDS: readonly string[] = [
  'looks fun',
  'looks good',
  'looks great',
  'looks cool',
  'looks nice',
  'sounds fun',
  'sounds good',
  'sounds great',
  'so good',
  'so cool',
  "i'm keen",
  "i'm down",
  "let's book",
  "let's do it",
  ...MULTILINGUAL_AGREEMENT_KEYWORDS
]

export const SUGGESTION_KEYWORDS: readonly string[] = [
  'we should',
  'should we',
  "let's go",
  "let's try",
  "let's visit",
  "let's check",
  'want to go',
  'want to try',
  'want to visit',
  'wanna go',
  'wanna try',
  'wanna visit',
  'have to go',
  'have to try',
  'have to visit',
  'need to go',
  'need to try',
  'gotta try',
  'gotta go',
  'must visit',
  'must try',
  'check this out',
  'check it out',
  'this place',
  'this spot',
  'next time',
  'bucket list',
  'on my list',
  'adding to list',
  ...MULTILINGUAL_SUGGESTION_KEYWORDS
]

export const HIGH_SIGNAL_KEYWORDS: readonly string[] = [
  ...EXCLAMATION_KEYWORDS,
  ...AGREEMENT_KEYWORDS,
  ...SUGGESTION_KEYWORDS
]
