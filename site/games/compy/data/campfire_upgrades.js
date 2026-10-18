// ============================================================
// CAMPFIRE UPGRADES — the 6 "Rememberings" in "She Who Keeps the Light".
//
// Each upgrade is a Tend-the-Fire event:
//   1. Player taps the campfire while a Tend is available.
//   2. Resource gate (precondition) and cost are both checked.
//   3. On commit: visual layer turns on, Remembering panel plays
//      (a memory of the Hearth — the flame that has always kept her
//      warm), then a Memory Shard fires for shards 01–05. The 6th
//      (Crown Flame) plays the Hearth's final memory in the
//      Remembering panel itself — no further shard.
//
// Indexing: array index 0 = CAMP_01 … index 5 = CAMP_06.
// ============================================================

export const CAMPFIRE_UPGRADES = [
  {
    idx: 0, id: 'CAMP_01',
    name: 'Warm Stones',
    icon: '🪨',
    childIdx: 5,                     // Child 6 (Youngest) — present Day 1
    requirementText: '10 ingredients of any kind.',
    cost: { type: 'anyIngredient', count: 10 },
    gate: { type: 'childFound', childIdx: 5 },
    rememberingTitle: 'Remembering 1 — Warm Stones',
    rememberingLines: [
      'The fire wasn\'t expected that day. There were other things in the way, other duties pulling.',
      'But it burned anyway, and said nothing, and stood close enough that the cold couldn\'t reach her.',
      'She didn\'t ask. It just knew.',
    ],
    shardIdx: 0,                     // Shard 01 — "The Lines She Used to Draw"
  },
  {
    idx: 1, id: 'CAMP_02',
    name: 'Wind Shield',
    icon: '🌬️',
    childIdx: 4,                     // Child 5
    requirementText: 'Survive 3 nights, then 5 ingredients of any kind.',
    cost: { type: 'anyIngredient', count: 5 },
    gate: { type: 'and', of: [
      { type: 'childFound',    childIdx: 4 },
      { type: 'nightsSurvived', count:    3 },
    ]},
    rememberingTitle: 'Remembering 2 — Wind Shield',
    rememberingLines: [
      'It got the small things wrong sometimes. Too loud. The wrong moment. She wanted to disappear.',
      'Later, in the quiet, the heat leaned toward her: "I just didn\'t want them to see you tired."',
      'It was trying to protect her. It just doesn\'t always know how.',
    ],
    shardIdx: 2,                     // Shard 03 — "The Moment Before It All Changed"
  },
  {
    idx: 2, id: 'CAMP_03',
    name: 'Carved Log',
    icon: '🪵',
    childIdx: 3,                     // Child 4
    requirementText: 'Cook 5 recipes total, then offer 1 cooked meal.',
    cost: { type: 'anyCooked', count: 1 },
    gate: { type: 'and', of: [
      { type: 'childFound',  childIdx: 3 },
      { type: 'recipesCooked', count: 5 },
    ]},
    rememberingTitle: 'Remembering 3 — Carved Log',
    rememberingLines: [
      'It was there at every dark hour. Not heroic. Not steady, actually — flickering, each time. She could feel it tremble.',
      'But there. Always there.',
      'She counted on that more than she ever said.',
    ],
    shardIdx: 4,                     // Shard 05 — "The Night the Dream Began" (The Tuesday)
  },
  {
    idx: 3, id: 'CAMP_04',
    name: 'Flower Ring',
    icon: '🌸',
    childIdx: 2,                     // Child 3
    requirementText: 'Place 5 decor items.',
    cost: { type: 'none' },
    gate: { type: 'and', of: [
      { type: 'childFound',  childIdx: 2 },
      { type: 'decorPlaced', count:    5 },
    ]},
    rememberingTitle: 'Remembering 4 — Flower Ring',
    rememberingLines: [
      'There were months when nothing made sense. The flame knew. She knew. Nobody named it.',
      'It started mending small things — things that had been broken for years.',
      'It was the only way it knew to say: I am doing everything I can. She understood.',
    ],
    shardIdx: 3,                     // Shard 04 — "The Week Nobody Said Her Name" (Invisible)
  },
  {
    idx: 4, id: 'CAMP_05',
    name: 'Deep Roots',
    icon: '🌿',
    childIdx: 1,                     // Child 2
    requirementText: 'Reach Player Level 22.',
    cost: { type: 'none' },
    gate: { type: 'and', of: [
      { type: 'childFound',  childIdx: 1 },
      { type: 'playerLevel', value:   22 },
    ]},
    rememberingTitle: 'Remembering 5 — Deep Roots',
    rememberingLines: [
      'It knew her before the dark. Before the weight of it.',
      'It knew her when she still came home with ink on her wrists, talking too fast about negative space and the shape of a single character.',
      'It loved someone whose hands were always making something. It stayed when the hands went still.',
      'Roots don\'t move. That\'s the whole point of them.',
    ],
    shardIdx: 1,                     // Shard 02 — "The Work She Set Aside"
  },
  {
    idx: 5, id: 'CAMP_06',
    name: 'The Crown Flame',
    icon: '👑',
    childIdx: 0,                     // Child 1 (Eldest)
    requirementText: 'All 5 previous Rememberings complete.',
    cost: { type: 'none' },
    gate: { type: 'and', of: [
      { type: 'childFound',  childIdx: 0 },
      { type: 'priorAll',    count:    5 },
    ]},
    rememberingTitle: 'Remembering 6 — The Crown Flame',
    rememberingLines: [
      'She used to wonder if she was loved correctly. The right words. The right moments. The grand gestures.',
      'But it was there for every ordinary hour. Every weight. Every fevered night. Every silent meal after a hard one.',
      'It kept the last thing she ever made. It never moved it.',
      'Love, she eventually understood, is not a feeling that visits.',
      'It is a fire that stays lit.',
      'She had been tending it all along. She just didn\'t know it yet.',
    ],
    shardIdx: null,                  // No shard — this IS the Hearth's final memory.
  },
];

export function getUpgradeByIdx(idx) { return CAMPFIRE_UPGRADES[idx] || null; }
export function getUpgradeById(id)   { return CAMPFIRE_UPGRADES.find(u => u.id === id) || null; }

// Returns the first NOT-yet-completed upgrade given a story.campfire.upgrades[] array.
export function nextPendingUpgrade(upgradesArr) {
  if (!Array.isArray(upgradesArr)) return CAMPFIRE_UPGRADES[0];
  for (let i = 0; i < CAMPFIRE_UPGRADES.length; i++) {
    if (!upgradesArr[i]) return CAMPFIRE_UPGRADES[i];
  }
  return null;
}
