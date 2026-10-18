// ============================================================
// GLIMMERS — narrative NPC data for "She Who Keeps the Light".
// Six small living embers (the "Glimmers") scattered when the
// Hearth dimmed. Discovery order is REVERSED (smallest first):
// array index 0 = the oldest spark (last found),
// array index 5 = the smallest spark (present from Day 1).
// ============================================================

// ─── The Hearth (the central campfire as a persona) ───────────────────
// Referenced by narration and any UI line that used to say "husband".
// The campfire IS the Old Hearth — the founding flame.
export const HEARTH = {
  id:       'HEARTH',
  name:     'Ember',
  title:    'The Old Hearth',
  nickname: 'The First Flame',
};

// Home-zone enums — placement strategy used by ChildNPC.aiTick().
export const HOME_ZONE = {
  PLAYER_TILE:  'player_tile',   // smallest spark — clings within ~2 tiles of Keeper
  ROAM:         'roam',          // brightspark — covers entire lit area
  LOWEST_MOOD:  'lowest_mood',   // tender — migrates to whichever spark is dimmest
  QUIET_CORNER: 'quiet_corner',  // dreamwick — tucked-away corner near edge
  CRAFT_CENTRE: 'craft_centre',  // forgespark — near workbench/cooking
  LIGHT_EDGE:   'light_edge',    // tuneflame — sits at light boundary
};

// ─── 6 Glimmers ─────────────────────────────────────────────────────────
export const CHILDREN = [
  // Index 0 — The Tuneflame (oldest spark, last to find)
  {
    id:              'CHILD_1',
    birthOrder:      1,
    name:            'Ren',
    label:           'The Tuneflame',
    nickname:        'The oldest spark',
    discoveryLevel:  25,
    icon:            '🎵',
    color:           '#3b82f6',
    glowColor:       '#dbeafe',
    look: {
      scale:      1.05,
      bodyColor:  '#bfdbfe',
      legColor:   '#475569',
      footColor:  '#334155',
      skinColor:  '#fde7c4',
      hairStyle:  'long_bangs',
      hairColor:  '#1e3a5f',
      accessory:  'music_note',
      defaultEmotion: 'calm',
    },
    camp: { type: 'music_stand', angle: -Math.PI / 2, distance: 13.5 },
    homeZone:        HOME_ZONE.LIGHT_EDGE,
    compyAffinity:   'song_squirrel',
    personalityTags: ['Quiet','Musical','Watchful','Patient'],
    discoveryLines: [
      'A blue flame at the very edge of the warmth.',
      'Sitting. Watching. Not lost.',
      'It had been making sure none of the others were lost. Reach it last.',
    ],
    greetingLine:  '"I knew you\'d get here eventually."',
    bondLine:      '"I played it on the bad nights. I turned it up a little louder. Not for me."',
    nightBehaviour:'Sits closest to the Hearth. Hums quietly during nightmare fights.',
    flags: { boundarySpot: true, longestTrustDelay: true },
  },
  // Index 1 — The Forgespark
  {
    id:              'CHILD_2',
    birthOrder:      2,
    name:            'Bram',
    label:           'The Forgespark',
    nickname:        'The stubborn ember',
    discoveryLevel:  20,
    icon:            '🐻',
    color:           '#22c55e',
    glowColor:       '#bbf7d0',
    look: {
      scale:      1.0,
      bodyColor:  '#86efac',
      legColor:   '#5b3a1d',
      footColor:  '#3f2611',
      skinColor:  '#fdd9b8',
      hairStyle:  'messy_short',
      hairColor:  '#7c2d12',
      accessory:  'bandage_cheek',
      defaultEmotion: 'determined',
    },
    camp: { type: 'workbench', angle: -3 * Math.PI / 4, distance: 11.0 },
    homeZone:        HOME_ZONE.CRAFT_CENTRE,
    compyAffinity:   'pudding_bear',
    personalityTags: ['Determined','Honest','Moth-shy','Clumsy'],
    discoveryLines: [
      'A green flame deep in the dark, doing something on its own.',
      '"Clearing the way," it said. "For when you came."',
      'It always gets up. The Hearth forgot to say it noticed.',
    ],
    greetingLine:  '"I\'m not scared. (The moth flew away anyway.) I was going to deal with it."',
    bondLine:      '"It\'s not perfect. But it\'s — here. I made it for you."',
    nightBehaviour:'Watches the fight, fists clenched. Freezes briefly when a Dread Moth appears.',
    flags: { stumbleOnReturn: true, dreadMothFreeze: true },
  },
  // Index 2 — The Dreamwick
  {
    id:              'CHILD_3',
    birthOrder:      3,
    name:            'Wren',
    label:           'The Dreamwick',
    nickname:        'The slow flame that watches',
    discoveryLevel:  15,
    icon:            '🦎',
    color:           '#06b6d4',
    glowColor:       '#cffafe',
    look: {
      scale:      0.98,
      bodyColor:  '#a5f3fc',
      legColor:   '#c2410c',
      footColor:  '#7c2d12',
      skinColor:  '#fde7c4',
      hairStyle:  'side_braid',
      hairColor:  '#a16207',
      accessory:  'paint_smudge',
      defaultEmotion: 'dreamy',
    },
    camp: { type: 'easel', angle: Math.PI, distance: 8.5 },
    homeZone:        HOME_ZONE.QUIET_CORNER,
    compyAffinity:   'mist_chameleon',
    personalityTags: ['Artistic','Observant','Distractible','Colour-tasting'],
    discoveryLines: [
      'A coral glow studying the dark instead of fearing it.',
      'It was trying to name the colour of its own shadow.',
      'It has been painting the warmth for as long as it has burned.',
    ],
    greetingLine:  '"You placed the flowers there on purpose, didn\'t you. I notice everything."',
    bondLine:      '"I\'ve been making it since I got here. I think it was always for you."',
    nightBehaviour:'Watches nightmares from the inside edge with genuine curiosity.',
    flags: { edgeWander: true, gifts: 'handmade_lantern' },
  },
  // Index 3 — The Tender
  {
    id:              'CHILD_4',
    birthOrder:      4,
    name:            'Mira',
    label:           'The Tender',
    nickname:        'The warm glow that drifts',
    discoveryLevel:  10,
    icon:            '🦊',
    color:           '#ec4899',
    glowColor:       '#fbcfe8',
    look: {
      scale:      1.0,
      bodyColor:  '#fda4af',
      legColor:   '#fbcfe8',
      footColor:  '#ec4899',
      skinColor:  '#fde7c4',
      hairStyle:  'twin_buns',
      hairColor:  '#be185d',
      accessory:  'apron_heart',
      defaultEmotion: 'happy',
    },
    camp: { type: 'picnic', angle: 3 * Math.PI / 4, distance: 6.0 },
    homeZone:        HOME_ZONE.LOWEST_MOOD,
    compyAffinity:   'petal_fox',
    personalityTags: ['Soft','Helpful','Slow-burning','Performs cheer'],
    discoveryLines: [
      'A pink shimmer asking after every other spark before its own.',
      'Performing brightness so long it forgot brightness wasn\'t the same as warmth.',
      'It is learning, slowly, to be loved without earning it.',
    ],
    greetingLine:  '"Everyone seems fine! Is everyone fine? I\'m fine. (Nobody asked.)"',
    bondLine:      '"That was really good. I didn\'t know it could just be like that. Just — given. Just mine."',
    nightBehaviour:'Last to settle. Drifts to whichever spark is dimmest.',
    flags: { slowEater: true, lastToRest: true },
  },
  // Index 4 — The Brightspark
  {
    id:              'CHILD_5',
    birthOrder:      5,
    name:            'Pip',
    label:           'The Brightspark',
    nickname:        'The loudest flame',
    discoveryLevel:  5,
    icon:            '🐰',
    color:           '#eab308',
    glowColor:       '#fef9c3',
    look: {
      scale:      0.95,
      bodyColor:  '#fef08a',
      legColor:   '#7c2d12',
      footColor:  '#1f2937',
      skinColor:  '#fde7c4',
      hairStyle:  'spiky',
      hairColor:  '#92400e',
      accessory:  'headband',
      defaultEmotion: 'smug',
    },
    camp: { type: 'arena', angle: Math.PI / 4, distance: 3.5 },
    homeZone:        HOME_ZONE.ROAM,
    compyAffinity:   'clover_bunny',
    personalityTags: ['Bold','Loud','Hard-headed','Picky-burning'],
    discoveryLines: [
      'A sudden crackle of amber leaping at the dark.',
      'It arrived already declaring victory.',
      'Its stubbornness is the same shape as the Hearth\'s own.',
    ],
    greetingLine:  '"I already know how this goes. I win. What are we doing?"',
    bondLine:      '"Okay. Fixed. It was already mostly fine. I helped. You\'re welcome."',
    nightBehaviour:'Stands at the light-edge taunting nightmares (animation only, safe).',
    flags: { highEnergy: true, foodQualityGate: 2, runResponseDelay: 3.0 },
  },
  // Index 5 — The Hearthmote (smallest spark, present Day 1)
  {
    id:              'CHILD_6',
    birthOrder:      6,
    name:            'Tobi',
    label:           'The Hearthmote',
    nickname:        'The smallest spark',
    discoveryLevel:  0, // present from Day 1
    icon:            '🐍',
    color:           '#9333ea',
    glowColor:       '#f3e8ff',
    look: {
      scale:      0.85,
      bodyColor:  '#d8b4fe',
      legColor:   '#a78bfa',
      footColor:  '#7c3aed',
      skinColor:  '#fdedd3',
      hairStyle:  'fluffy',
      hairColor:  '#581c87',
      accessory:  'plush',
      defaultEmotion: 'sleepy',
    },
    camp: { type: 'pillow_fort', angle: -Math.PI / 4, distance: 2.4 },
    homeZone:        HOME_ZONE.PLAYER_TILE,
    compyAffinity:   'noodle_eel',
    personalityTags: ['Tiny','Clingy','Alert','Soft-glow'],
    discoveryLines: [
      'A faint mauve flicker, never far from the warmth.',
      'Smaller than the others. Brighter than it looks.',
      'It noticed everything before it could even speak.',
    ],
    greetingLine:  '"Oh — you opened your eyes. I\'ve been watching the warmth."',
    bondLine:      '"I drew the warmth. I drew you. You\'re the part that glows."',
    nightBehaviour:'Stays within two tiles of the Keeper. Never drifts during nightmares.',
    flags: { clingyMaxDist: 2, sulkAfterAway: 90 },
  },
];

// Helper: fetch by index (0..5).
export function getChildByIndex(idx) {
  return CHILDREN[idx] || null;
}
// Helper: fetch by id ('CHILD_1' … 'CHILD_6').
export function getChildById(id) {
  return CHILDREN.find(c => c.id === id) || null;
}
// Helper: convert birth order (1..6) to array index.
export function birthOrderToIndex(birthOrder) { return birthOrder - 1; }

// ─── 24 Tasks (4 per Glimmer) ─────────────────────────────────────────────
// Each task is gameplay-oriented and polled against an existing achievement
// counter. Difficulty ramps with the Glimmer's discovery level so early
// tasks are intro chores and late tasks are real milestones.
//
// Task fields:
//   id            — 'T#.#' string (T6.1, T1.4, etc.)
//   childIdx      — index into CHILDREN (0..5)
//   slot          — task number for that Glimmer (1..4)
//   name          — short, ACTION-FIRST title shown in the HUD strip
//                   (e.g. "Cook 5 Meals", "Build 3 Props"). The flavour
//                   line lives in `dialogue` so the HUD reads as a TODO.
//   counter       — achievement counter key polled via game.ach.c[counter]
//   target        — counter must be >= target for completion
//   composite     — if true, ticker dispatch falls through to a special handler
//   dialogue      — 1–2 short lines from the Glimmer when tapped
//   requirement   — concrete gameplay text shown in the task dialog: WHAT to
//                   do, WHERE to do it, and HOW the counter ticks. Be direct.
//   progress      — { type: 'count' | 'flag' | 'pct', total?: number }
//   completionLine— Glimmer's line on completion
//   storyReveal   — narrative reflection that follows (no family terms)
//   memoryEcho    — optional reframing for the FINAL task only (slot === 4)
//   shardTrigger  — optional: shardIdx (0..9) to fire when this task completes
// ────────────────────────────────────────────────────────────────────────
export const TASKS = [
  // ── The Hearthmote (idx 5) — TUTORIAL CHAIN ──────────────────────────
  // Tobi is present from Day 1 and acts as the player's first guide. Their
  // four tasks walk a brand-new player through the core gameplay loop:
  // collect → sell → cook → build. Each task explains the action in plain
  // gameplay terms in `requirement` so it doubles as a tutorial card.
  {
    id: 'T6.1', childIdx: 5, slot: 1,
    name: 'Collect Your First Resource',
    counter: 'drops', target: 1,
    dialogue: ['"There\'s shiny things in the grass. I want to see one up close."'],
    requirement: 'Pick up your very first resource drop. Compies (like the one you chose at the fire) drop ingredients near them as they wander. Walk into a drop or tap on it to collect it — it lands in your inventory.',
    progress: { type: 'count', total: 1 },
    completionLine: '"Oh — it\'s warm. The world is just *full* of these, isn\'t it?"',
    storyReveal: 'It was the smallest spark — the one that never let the warmth out of sight. It noticed everything: every flicker, every dim moment, every time the light grew tired. It stayed bright anyway.',
  },
  {
    id: 'T6.2', childIdx: 5, slot: 2,
    name: 'Sell Your First Item',
    counter: 'items_sold', target: 1,
    dialogue: ['"The traveler with the cart — they give SHINY ROUNDS for things. Try it once?"'],
    requirement: 'Sell any 1 item to the Merchant for gold. Walk to the merchant when they visit during the day, open their menu, switch to the Sell tab, pick an item from your inventory, and tap Sell. Gold is what buys decor, food, and rare items.',
    progress: { type: 'count', total: 1 },
    completionLine: '"You did it! That clinking sound is the BEST sound."',
    storyReveal: 'It understood things before it had words for them. It wanted to know the warmth while it still could.',
  },
  {
    id: 'T6.3', childIdx: 5, slot: 3,
    name: 'Cook Your First Meal',
    counter: 'cook_total', target: 1,
    dialogue: ['"If we cook one of those things… it\'d feel less cold here. Just one. Please?"'],
    requirement: 'Cook any 1 recipe. Tap the Craft button (🔨) in the bottom HUD, switch to the Cooking tab, pick a recipe whose ingredients you already have (it\'ll be highlighted), and tap Cook. Cooked food restores hunger and feeds your Compies.',
    progress: { type: 'count', total: 1 },
    completionLine: '"It smells like the kind of warmth I remember. Don\'t forget how to do that."',
    storyReveal: 'It clung because letting go was a skill no one had taught it yet. The lesson wasn\'t that the warmth stayed. It was that the warmth always came back.',
  },
  {
    id: 'T6.4', childIdx: 5, slot: 4,
    name: 'Build the Cooking Station',
    counter: 'prop_cooking_station', target: 1,
    dialogue: ['"If you build the cooking spot proper, I\'ll never have to worry."'],
    requirement: 'Build the Cooking Station prop. Open Craft (🔨) → Build, find the Cooking Station card, gather the few materials it asks for (just by collecting more drops), and tap Build. Once placed, it makes cooking faster and unlocks better recipes.',
    progress: { type: 'flag' },
    completionLine: '"It\'s real now. The smell-of-home, but stuck to the ground."',
    storyReveal: 'It was the spark still reaching for the warmth\'s hand. Even now. Even here. It never stopped.',
    memoryEcho: 'The warmth almost forgot — in all the forgetting — that this was the spark still reaching.',
  },

  // ── The Brightspark (idx 4) — show off: cook a few, fight, level, quality
  {
    id: 'T5.1', childIdx: 4, slot: 1,
    name: 'Cook 5 Meals',
    counter: 'cook_total', target: 5,
    dialogue: ['"Five meals. Minimum. I\'m measuring."'],
    requirement: 'Cook 5 meals total at the Cooking Station. Any recipe counts — repeats are fine.',
    progress: { type: 'count', total: 5 },
    completionLine: '"Acceptable. I will write a song about it."',
    storyReveal: 'It arrived like weather — loud, inevitable, impossible to be indoors about. The Hearth was laughing two seconds after the exhaustion.',
  },
  {
    id: 'T5.2', childIdx: 4, slot: 2,
    name: 'Defeat 8 Nightmares',
    counter: 'nm_killed', target: 8,
    dialogue: ['"Eight. Easy. Watch."'],
    requirement: 'Defeat 8 nightmares. They spawn at night around the lit area — engage with your Compies nearby for damage support.',
    progress: { type: 'count', total: 8 },
    completionLine: '"Did you see the last part especially? I just invented that."',
    storyReveal: 'Its standards were never stubbornness. They were integrity wearing a very small, very loud coat.',
  },
  {
    id: 'T5.3', childIdx: 4, slot: 3,
    name: 'Reach Keeper Lv.10',
    counter: 'level', target: 10,
    dialogue: ['"Get bigger. I\'ll wait. I won\'t wait quietly."'],
    requirement: 'Reach Keeper Level 10. Earn XP by feeding Compies, cooking meals, defeating nightmares, and revealing land.',
    progress: { type: 'pct', total: 100 },
    completionLine: '"There. Now we\'re a real fire."',
    storyReveal: 'If the warmth waited — if it gave the spark time to arrive at it on its own — the spark always came around.',
  },
  {
    id: 'T5.4', childIdx: 4, slot: 4,
    name: 'Cook a 2★ Recipe',
    counter: 'cook_2', target: 1,
    dialogue: ['"I am NOT eating that. Bring me the GOOD stuff. I\'ll wait."'],
    requirement: 'Cook any 2★ (Tasty) recipe once. Recipes are tier-rated — 2★ ones need T2 ingredients (Honey Glob, Dream Herb, Fleece Cloud, etc.).',
    progress: { type: 'flag' },
    completionLine: '"THAT. That right there. Only that. Every time."',
    storyReveal: 'The Hearth forgot that this spark\'s stubbornness came from the same place as its own. It hadn\'t lost it. The Hearth had six sparks. One of them was keeping it for the rest.',
    memoryEcho: 'The warmth looked at this spark and remembered itself: certain, impossible, magnificent.',
  },

  // ── The Tender (idx 3) — care for everyone: decor, compies, cooking, warmth
  {
    id: 'T4.1', childIdx: 3, slot: 1,
    name: 'Place 8 Decor',
    counter: 'decor_placed', target: 8,
    dialogue: ['"You should put more pretty things out. It\'d help."', '"…I have ideas."'],
    requirement: 'Place 8 decor items on the island. Buy from the Merchant\'s Decor tab, then drop them via Edit mode (✏️). Repeats of the same decor count.',
    progress: { type: 'count', total: 8 },
    completionLine: '"Good. Everyone has somewhere soft to sit now."',
    storyReveal: 'It started performing brightness early. Not lying — performing. There\'s a difference. The Hearth saw through it immediately. And glowed more fiercely for the effort.',
  },
  {
    id: 'T4.2', childIdx: 3, slot: 2,
    name: 'Welcome 7 Compies',
    counter: 'comp_unique', target: 7,
    dialogue: ['"Are there enough of us? I\'m worried there aren\'t enough."'],
    requirement: 'Welcome at least 7 different Compy species. Check the Compy menu (🐾) to see which species you\'ve found. Buy Booster Packs from the Merchant to unlock new ones, or convert 3× of the same Compy into a random next-tier species.',
    progress: { type: 'count', total: 7 },
    completionLine: '"Now. Yes. We can all watch each other."',
    storyReveal: 'It never said what it wanted. The Hearth had to detect it. It became a kind of fluency. Reading this spark.',
  },
  {
    id: 'T4.3', childIdx: 3, slot: 3,
    name: 'Discover 8 Recipes',
    counter: 'cook_unique', target: 8,
    dialogue: ['"What if you tried something new? Just once. Just to see."'],
    requirement: 'Cook 8 different recipes (each one only counts the first time). Combine new ingredient sets at the Cooking Station to discover them.',
    progress: { type: 'count', total: 8 },
    completionLine: '"That\'s — eight. Different ones. I counted. Sorry. I always count."',
    storyReveal: 'It asked once if it could just stay near the warmth. Not perform. Not fix anything. The Hearth said yes before it finished the question. One of the warmest moments either of them remembered.',
  },
  {
    id: 'T4.4', childIdx: 3, slot: 4,
    name: 'Reach 70% Warmth',
    counter: 'max_happy', target: 70,
    dialogue: ['"You don\'t have to do anything. You really don\'t."', '"…unless you want to."'],
    requirement: 'Get the Warmth (happiness) bar up to 70%. Feed Compies their favourite foods, cook meals, and place decor to raise it. Hunger and night damage drop it.',
    progress: { type: 'pct', total: 100 },
    completionLine: '"That was really good. I didn\'t know it could just be like that. Just — given. Just mine."',
    storyReveal: 'This spark was four flickers old when the Hearth realised: it doesn\'t know how to be loved quietly. It only knew how to earn it. So the Hearth started giving warmth for nothing.',
    memoryEcho: 'For sitting. For breathing. For burning. It is still sinking in. They have time.',
    shardTrigger: 6,
  },

  // ── The Dreamwick (idx 2) — beautify: decor, reveals, cook, decor variety
  {
    id: 'T3.1', childIdx: 2, slot: 1,
    name: 'Place 15 Decor',
    counter: 'decor_placed', target: 15,
    dialogue: ['"More. Just a little. Anywhere."'],
    requirement: 'Place 15 decor items total on the island. Repeats of the same decor count — focus the cheap ones if you\'re short on gold.',
    progress: { type: 'count', total: 15 },
    completionLine: '"It\'s not finished. It\'s never finished. But it\'s more right than it was."',
    storyReveal: 'It noticed the bruise on the Hearth\'s heart before any other spark. Didn\'t say anything. Just started painting beside it.',
  },
  {
    id: 'T3.2', childIdx: 2, slot: 2,
    name: 'Reveal 5 Land Treasures',
    counter: 'reveals', target: 5,
    dialogue: ['"There are colours past the dark. I want to see them."'],
    requirement: 'Reveal 5 hidden land features. Each Keeper level-up expands the light and uncovers one — so you need to gain 5 levels.',
    progress: { type: 'count', total: 5 },
    completionLine: '"Five new colours. I\'ll need names for them."',
    storyReveal: 'Its corner of the dark was always full of unfinished colours. The Hearth used to find it maddening. Then it looked at its own life and thought: maybe ninety percent finished is its own kind of complete.',
  },
  {
    id: 'T3.3', childIdx: 2, slot: 3,
    name: 'Cook 15 Meals',
    counter: 'cook_total', target: 15,
    dialogue: ['"It\'s easier to think when something is cooking."'],
    requirement: 'Cook 15 meals total at the Cooking Station. Any tier — keep your Compies fed and progress will tick steadily.',
    progress: { type: 'count', total: 15 },
    completionLine: '"Yes. Now I can think. Thank you for not making it a thing."',
    storyReveal: 'The Hearth used to call this spark back — gently, by name, many times a day. Calling it back wasn\'t frustration. It was: I need you here. I want you with me.',
  },
  {
    id: 'T3.4', childIdx: 2, slot: 4,
    name: 'Own 14 Decor Types',
    counter: 'decor_unique', target: 14,
    dialogue: ['"Different things. Lots of different things. So I can study."'],
    requirement: 'Own 14 different decor types (placed or in inventory). Buy each unique decor from the Merchant\'s Decor tab — duplicates of the same item don\'t count.',
    progress: { type: 'count', total: 14 },
    completionLine: '"I\'ve been making it since I got here. I think it was always for you."',
    storyReveal: 'It slid a drawing across the embers once. No note. No name. The Hearth kept it. The Hearth still has it.',
    memoryEcho: 'It had drawn the warmth the way it truly saw it: not tired, not small. Larger than life and luminous.',
  },

  // ── The Forgespark (idx 1) — build & defend: props, ward, fight, more props
  {
    id: 'T2.1', childIdx: 1, slot: 1,
    name: 'Build 5 Props',
    counter: 'props_built', target: 5,
    dialogue: ['"I\'ll handle it. You don\'t have to do everything."'],
    requirement: 'Build 5 props of any kind. Open Craft → Build and tap Build on any prop card whose materials you can afford.',
    progress: { type: 'count', total: 5 },
    completionLine: '"See? Done. (I dropped some. That doesn\'t count.)"',
    storyReveal: 'It came out ready to work. The trying was the point. It wasn\'t reckless. It just believed things were worth attempting. It got that from the Hearth.',
  },
  {
    id: 'T2.2', childIdx: 1, slot: 2,
    name: 'Build the Ward Stone',
    counter: 'prop_ward_stone', target: 1,
    dialogue: ['"Build the stone. The defending one. Then I can stop watching the dark."'],
    requirement: 'Build the Ward Stone prop. Find it in Craft → Build — it slows nightmares within its aura once placed.',
    progress: { type: 'flag' },
    completionLine: '"Yeah. That\'s better. Not that I was worried. It\'s just. Better."',
    storyReveal: 'It called the Hearth once. Late. Said nothing was wrong. Talked for forty minutes. The Hearth listened. The spark said: \'Yeah.\' That was enough.',
  },
  {
    id: 'T2.3', childIdx: 1, slot: 3,
    name: 'Defeat 35 Nightmares',
    counter: 'nm_killed', target: 35,
    dialogue: ['"I want to see what you\'re really made of."'],
    requirement: 'Defeat 35 nightmares total (run-wide, accumulates across nights). Bring more Compies and stronger weapons to clear bigger waves faster.',
    progress: { type: 'count', total: 35 },
    completionLine: '"Okay. So that\'s what that is. Good. Now I know."',
    storyReveal: 'It needed the truth more than the comfort. The Hearth learned that about it.',
  },
  {
    id: 'T2.4', childIdx: 1, slot: 4,
    name: 'Build 12 Props',
    counter: 'props_built', target: 12,
    dialogue: ['"Twelve things, then we can rest. Twelve is enough."'],
    requirement: 'Build 12 props of any kind (cumulative, including the ones from Task 1). You\'ll likely need to gather T2/T3 materials for the higher-tier props.',
    progress: { type: 'count', total: 12 },
    completionLine: '"It\'s not perfect. But it\'s — here. I made it for you."',
    storyReveal: 'It started doing the small chores without being asked. There are sparks who see the work. This one always was.',
    memoryEcho: 'The Hearth pretended not to notice so the spark wouldn\'t stop. The spark never stopped.',
  },

  // ── The Tuneflame (idx 0) — capstone: huge compy roster, prop, quality, all-bond
  {
    id: 'T1.1', childIdx: 0, slot: 1,
    name: 'Welcome 11 Compies',
    counter: 'comp_unique', target: 11,
    dialogue: ['"Eleven voices. Then we can sing properly."'],
    requirement: 'Welcome at least 11 different Compy species. You\'ll need to push into the higher tiers — buy Booster Packs from the Merchant for guaranteed unlocks.',
    progress: { type: 'count', total: 11 },
    completionLine: '"Yes. That\'s — that\'s a chord."',
    storyReveal: 'It learned to be fine before it knew what fine meant. The oldest sparks always do. It held the door open while every other spark walked through.',
  },
  {
    id: 'T1.2', childIdx: 0, slot: 2,
    name: 'Build the Dream Chime',
    counter: 'prop_dream_chime', target: 1,
    dialogue: ['"I\'ve been working on something. I don\'t know where to put it."'],
    requirement: 'Build the Dream Chime prop. It\'s a higher-tier craft — find it in Craft → Build once you have the rare materials.',
    progress: { type: 'flag' },
    completionLine: '"I\'ve been working on that for a while. I think it goes here."',
    storyReveal: 'It started playing music early. The same phrase, over and over, getting better. The same discipline the Hearth once gave to ink and paper. It learned by watching.',
  },
  {
    id: 'T1.3', childIdx: 0, slot: 3,
    name: 'Cook a 3★ Recipe',
    counter: 'cook_3', target: 1,
    dialogue: ['"It\'s nothing. Don\'t make it a thing. But — if you wanted to."'],
    requirement: 'Cook any 3★ (Delicious) recipe once. These need T3 rare ingredients (Sea Crystal, Solar Berry, Ice Shard, Thunder Silk, Bamboo Shoot) — try the Dream Seed rare from the Merchant for a guaranteed drop.',
    progress: { type: 'flag' },
    completionLine: '"It\'s just nice. Having something everyone agreed about."',
    storyReveal: 'It never demanded anything. That was the danger of it. The Hearth started saving it the warmest spot. The quietest hour. The first piece. Not because it asked — because it never would.',
  },
  {
    id: 'T1.4', childIdx: 0, slot: 4,
    name: 'All Glimmers + 88% Warmth',
    composite: true,
    counter: 'max_happy', target: 88, // also requires all 6 found — composite check
    dialogue: ['"I\'m glad they\'re all here. I\'m glad you came to me last."'],
    requirement: 'Find all 6 Glimmers AND reach 88% Warmth at the same time. Glimmers appear at Keeper Levels 0/5/10/15/20/25 — reach Lv.25 to find the last one, then push happiness to 88%.',
    progress: { type: 'pct', total: 100 },
    completionLine: '"I played it for you. On the bad nights. I turned it up a little louder. Not for me."',
    storyReveal: 'It saw the Hearth on the hard nights. It didn\'t have the words. But it stayed close. It turned its music up a little louder on those nights. Not for itself. For the warmth.',
    memoryEcho: 'It thought the Hearth didn\'t notice. The Hearth noticed everything.',
  },
];

// Helper: tasks for a given child idx, in slot order.
export function tasksForChild(childIdx) {
  return TASKS.filter(t => t.childIdx === childIdx).sort((a, b) => a.slot - b.slot);
}

// Helper: the active task (next incomplete) for a child given slot count.
// slotsDone in 0..4. Returns null if all 4 done.
export function activeTaskFor(childIdx, slotsDone) {
  if (slotsDone >= 4) return null;
  return TASKS.find(t => t.childIdx === childIdx && t.slot === slotsDone + 1) || null;
}

// Helper: lookup by id ('T6.1' etc.)
export function getTaskById(id) {
  return TASKS.find(t => t.id === id) || null;
}
