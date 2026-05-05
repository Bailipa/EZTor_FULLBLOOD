// Data extracted from wink-lexicon (MIT) — https://github.com/winkjs/wink-lexicon
// which sources irregular verbs from https://en.wikipedia.org/wiki/English_irregular_verbs

const IRREGULAR_NOUNS: Record<string, string[]> = {
  child: ['child', 'children'],
  ephemeris: ['ephemeris', 'ephemerides'],
  ox: ['ox', 'oxen'],
  man: ['man', 'men'],
  woman: ['woman', 'women'],
  person: ['person', 'people'],
  mouse: ['mouse', 'mice'],
  louse: ['louse', 'lice'],
  foot: ['foot', 'feet'],
  tooth: ['tooth', 'teeth'],
  goose: ['goose', 'geese'],
  leaf: ['leaf', 'leaves'],
}

const IRREGULAR_VERBS: Record<string, string[]> = {
  awake: ['awake', 'awoke', 'awoken'],
  bear: ['bear', 'bore', 'borne'],
  beat: ['beat', 'beaten'],
  beget: ['beget', 'begot'],
  begin: ['begin', 'began', 'begun'],
  bend: ['bend', 'bent'],
  bet: ['bet'],
  bid: ['bid'],
  bide: ['bide', 'bode', 'bided'],
  bind: ['bind', 'bound'],
  bite: ['bite', 'bit', 'bitten'],
  bleed: ['bleed', 'bled'],
  blow: ['blow', 'blew', 'blown'],
  break: ['break', 'broke', 'broken'],
  breed: ['breed', 'bred'],
  bring: ['bring', 'brought'],
  build: ['build', 'built'],
  burn: ['burn', 'burnt'],
  burst: ['burst'],
  buy: ['buy', 'bought'],
  cast: ['cast'],
  catch: ['catch', 'caught'],
  choose: ['choose', 'chose', 'chosen'],
  cleave: ['cleave', 'clove', 'cleft'],
  cling: ['cling', 'clung'],
  clothe: ['clothe', 'clad'],
  come: ['come', 'came'],
  cost: ['cost'],
  creep: ['creep', 'crept'],
  cut: ['cut'],
  deal: ['deal', 'dealt'],
  dig: ['dig', 'dug'],
  draw: ['draw', 'drew', 'drawn'],
  dream: ['dream', 'dreamt'],
  drink: ['drink', 'drank', 'drunk'],
  drive: ['drive', 'drove', 'driven'],
  dwell: ['dwell', 'dwelt'],
  eat: ['eat', 'ate', 'eaten'],
  fall: ['fall', 'fell', 'fallen'],
  feed: ['feed', 'fed'],
  feel: ['feel', 'felt'],
  fight: ['fight', 'fought'],
  find: ['find', 'found'],
  flee: ['flee', 'fled'],
  fling: ['fling', 'flung'],
  fly: ['fly', 'flew', 'flown'],
  forbid: ['forbid', 'forbade', 'forbidden'],
  forget: ['forget', 'forgot', 'forgotten'],
  forgive: ['forgive', 'forgave', 'forgiven'],
  forsake: ['forsake', 'forsook', 'forsaken'],
  freeze: ['freeze', 'froze', 'frozen'],
  get: ['get', 'got', 'gotten'],
  give: ['give', 'gave', 'given'],
  go: ['go', 'went', 'gone'],
  grind: ['grind', 'ground'],
  grow: ['grow', 'grew', 'grown'],
  hang: ['hang', 'hung'],
  has: ['has', 'have', 'having', 'had'],
  hear: ['hear', 'heard'],
  hide: ['hide', 'hid', 'hidden'],
  hit: ['hit'],
  hold: ['hold', 'held'],
  hurt: ['hurt'],
  keep: ['keep', 'kept'],
  kneel: ['kneel', 'knelt'],
  know: ['know', 'knew', 'known'],
  lead: ['lead', 'led'],
  lean: ['lean', 'leant'],
  leap: ['leap', 'leapt'],
  learn: ['learn', 'learnt'],
  leave: ['leave', 'left'],
  lend: ['lend', 'lent'],
  let: ['let'],
  lie: ['lie', 'lay', 'lain'],
  light: ['light', 'lit'],
  lose: ['lose', 'lost'],
  make: ['make', 'made'],
  mean: ['mean', 'meant'],
  meet: ['meet', 'met'],
  mow: ['mow', 'mowed', 'mown'],
  pay: ['pay', 'paid'],
  plead: ['plead', 'pled'],
  prove: ['prove', 'proved', 'proven'],
  put: ['put'],
  quit: ['quit'],
  read: ['read'],
  rid: ['rid'],
  ride: ['ride', 'rode', 'ridden'],
  ring: ['ring', 'rang', 'rung'],
  rise: ['rise', 'rose', 'risen'],
  run: ['run', 'ran'],
  saw: ['saw', 'sawn'],
  say: ['say', 'said'],
  see: ['see', 'saw', 'seen'],
  seek: ['seek', 'sought'],
  sell: ['sell', 'sold'],
  send: ['send', 'sent'],
  set: ['set'],
  sew: ['sew', 'sewn'],
  shake: ['shake', 'shook', 'shaken'],
  shear: ['shear', 'shore', 'shorn'],
  shed: ['shed'],
  shine: ['shine', 'shone'],
  shoot: ['shoot', 'shot'],
  show: ['show', 'showed', 'shown'],
  shrink: ['shrink', 'shrank', 'shrunk'],
  shut: ['shut'],
  sing: ['sing', 'sang', 'sung'],
  sink: ['sink', 'sank', 'sunk'],
  sit: ['sit', 'sat'],
  slay: ['slay', 'slew', 'slain'],
  sleep: ['sleep', 'slept'],
  slide: ['slide', 'slid'],
  sling: ['sling', 'slung'],
  slink: ['slink', 'slunk'],
  slit: ['slit'],
  sow: ['sow', 'sown'],
  speak: ['speak', 'spoke', 'spoken'],
  speed: ['speed', 'sped'],
  spend: ['spend', 'spent'],
  spill: ['spill', 'spilt'],
  spin: ['spin', 'spun'],
  spit: ['spit', 'spat'],
  split: ['split'],
  spread: ['spread'],
  spring: ['spring', 'sprang', 'sprung'],
  stand: ['stand', 'stood'],
  steal: ['steal', 'stole', 'stolen'],
  stick: ['stick', 'stuck'],
  sting: ['sting', 'stung'],
  stink: ['stink', 'stank', 'stunk'],
  strew: ['strew', 'strewn'],
  stride: ['stride', 'strode', 'stridden'],
  strike: ['strike', 'struck', 'stricken'],
  string: ['string', 'strung'],
  strive: ['strive', 'strove', 'striven'],
  swear: ['swear', 'swore', 'sworn'],
  sweep: ['sweep', 'swept'],
  swell: ['swell', 'swollen'],
  swim: ['swim', 'swam', 'swum'],
  swing: ['swing', 'swung'],
  take: ['take', 'took', 'taken'],
  teach: ['teach', 'taught'],
  tear: ['tear', 'tore', 'torn'],
  tell: ['tell', 'told'],
  think: ['think', 'thought'],
  thrive: ['thrive', 'throve'],
  throw: ['throw', 'threw', 'thrown'],
  thrust: ['thrust'],
  tread: ['tread', 'trod', 'trodden'],
  understand: ['understand', 'understood'],
  wake: ['wake', 'woke', 'woken'],
  wear: ['wear', 'wore', 'worn'],
  weave: ['weave', 'wove', 'woven'],
  weep: ['weep', 'wept'],
  win: ['win', 'won'],
  wind: ['wind', 'wound'],
  wring: ['wring', 'wrung'],
  write: ['write', 'wrote', 'written'],
  be: ['be', 'is', 'am', 'are', 'was', 'were', 'been'],
  do: ['do', 'does', 'did', 'done'],
}

export function getIrregularForms(word: string): string[] {
  const lower = word.toLowerCase()
  const nouns = IRREGULAR_NOUNS[lower]
  const verbs = IRREGULAR_VERBS[lower]
  const forms = new Set<string>()
  if (nouns) nouns.forEach((f) => forms.add(f))
  if (verbs) verbs.forEach((f) => forms.add(f))
  return forms.size > 0 ? Array.from(forms) : []
}

const KNOWN_PAST_TENSE = new Set([
  'went', 'ran', 'ate', 'saw', 'took', 'made', 'gave', 'came', 'sang', 'drank',
  'swam', 'rang', 'fell', 'felt', 'found', 'got', 'had', 'heard', 'held', 'kept',
  'led', 'left', 'lent', 'lost', 'meant', 'met', 'paid', 'said', 'sat', 'sold',
  'sent', 'stood', 'taught', 'told', 'thought', 'understood', 'won', 'wrote',
  'awoke', 'bore', 'began', 'bent', 'bled', 'blew', 'broke', 'brought', 'built',
  'bought', 'caught', 'chose', 'came', 'crept', 'dealt', 'dug', 'drew', 'dreamt',
  'drove', 'fed', 'fought', 'fled', 'flung', 'flew', 'forgot', 'forgave', 'froze',
  'ground', 'grew', 'hung', 'hid', 'lay', 'leant', 'learnt', 'lit', 'mowed', 'pled',
  'rode', 'rose', 'shook', 'shone', 'shot', 'shrank', 'slid', 'slew', 'slung',
  'slunk', 'spoke', 'sped', 'spun', 'sprang', 'stole', 'strode', 'struck', 'strung',
  'strove', 'swore', 'swept', 'swung', 'throve', 'threw', 'trod', 'woke', 'wore',
  'wove', 'wept', 'wound', 'wrung',
])

const KNOWN_PAST_PARTICIPLE = new Set([
  'gone', 'beaten', 'written', 'taken', 'eaten', 'seen', 'given', 'driven', 'ridden',
  'risen', 'stolen', 'broken', 'chosen', 'spoken', 'hidden', 'fallen', 'known',
  'grown', 'drawn', 'shown', 'thrown', 'blown', 'sworn', 'torn', 'worn', 'woven',
  'frozen', 'forgotten', 'forgiven', 'forsaken', 'bidden', 'bitten', 'forbidden',
  'begun', 'drunk', 'rung', 'shrunk', 'sunk', 'sung', 'sprung', 'stunk', 'swum',
  'swung', 'shaken', 'shorn', 'strewn', 'stridden', 'stricken', 'striven', 'trodden',
  'awoken', 'borne', 'begotten', 'blown', 'bound', 'fed', 'fled', 'flown',
])

const KNOWN_PLURALS = new Set([
  'children', 'men', 'women', 'people', 'mice', 'lice', 'feet', 'teeth', 'geese', 'oxen',
])

export function getFormHint(match: string): string | null {
  const lower = match.toLowerCase()

  if (lower.endsWith('ing')) return '(进行时)'
  if (lower.endsWith('est')) return '(最高级)'
  if (lower.endsWith('er')) return '(比较级)'
  if (lower.endsWith('ed')) return '(过去式)'
  if (lower.endsWith('es')) return '(复数)'
  if (lower.endsWith('s') && !lower.endsWith('ss') && !lower.endsWith('us')) return '(复数)'
  if (KNOWN_PAST_TENSE.has(lower)) return '(过去式)'
  if (KNOWN_PAST_PARTICIPLE.has(lower)) return '(过去分词)'
  if (KNOWN_PLURALS.has(lower)) return '(复数)'

  return null
}

export function isCorrectAnswer(userInput: string, targetWord: string): boolean {
  const user = userInput.toLowerCase().trim()
  const target = targetWord.toLowerCase().trim()
  if (!user || !target) return false

  if (user === target) return true

  if (getIrregularForms(targetWord).includes(user)) return true

  if (user.startsWith(target) && /^[a-z]+$/.test(user)) return true

  // Also check via alternate stems (drop-e, f→v, y→i, ie→y)
  for (const alt of getAlternateStems(targetWord)) {
    if (user === alt) return true
    if (user.startsWith(alt) && /^[a-z]+$/.test(user)) return true
  }

  return false
}

export function getAlternateStems(word: string): string[] {
  let stem = word.toLowerCase()

  if (stem.endsWith('ing')) {
    stem = stem.slice(0, -3)
  } else if (stem.endsWith('ies')) {
    stem = stem.slice(0, -3) + 'y'
  } else if (stem.endsWith('ed')) {
    stem = stem.slice(0, -2)
  } else if (stem.endsWith('es')) {
    stem = stem.slice(0, -2)
  } else if (stem.endsWith('s') && !stem.endsWith('ss') && !stem.endsWith('is')) {
    stem = stem.slice(0, -1)
  }

  if (stem.length < 2) stem = word.toLowerCase()

  const altStems = [stem]

  if (stem.endsWith('e') && stem.length > 2) {
    const prev = stem.charAt(stem.length - 2)
    if (!/[aeiou]/.test(prev)) altStems.push(stem.slice(0, -1))
  }

  if (stem.endsWith('fe')) {
    altStems.push(stem.slice(0, -2) + 'v')
  } else if (stem.endsWith('f') && !stem.endsWith('ff') && stem.length > 2) {
    altStems.push(stem.slice(0, -1) + 'v')
  }

  if (stem.endsWith('y') && stem.length > 2) {
    const prev = stem.charAt(stem.length - 2)
    if (!/[aeiou]/.test(prev)) altStems.push(stem.slice(0, -1) + 'i')
  }

  if (stem.endsWith('ie')) {
    altStems.push(stem.slice(0, -2) + 'y')
  }

  return altStems
}
