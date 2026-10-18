// ============================================================
// SHARDS — the 10 Memory Shards in "She Who Keeps the Light".
//
// Indexing:
//   shards[0] = Shard 01  …  shards[9] = Shard 10
//
// Each shard fires from exactly one trigger event:
//   campfire_upgrade · level_reveal · junk_total · task_complete · bond_filled · all_shards
//
// Trigger condition payload schema:
//   { upgradeId?: 'CAMP_01' … 'CAMP_06' }     // for campfire_upgrade
//   { level?: number }                         // for level_reveal
//   { total?: number }                         // for junk_total
//   { taskId?: 'T4.4' }                        // for task_complete
//   { othersCollected?: 9 }                    // for all_shards (Shard 10 alt)
//
// Order on screen (broken-mirror grid) follows array index, not narrative chronology.
// ============================================================

export const SHARDS = [
  {
    idx: 0, num: '01', title: 'The Lines She Used to Draw',
    triggerType: 'campfire_upgrade',
    triggerCondition: { upgradeId: 'CAMP_01' },
    feat: 'memory_shard_01',
    icon: '🪨',
    lines: [
      'She used to draw lines for a living.',
      'Not just any lines — the kind that meant something.',
      'Blueprints. Then brushstrokes. Both needed the same stillness.',
      'She can\'t remember the last time her hand moved like that.',
      'Unhurried. Certain. Hers.',
    ],
  },
  {
    idx: 1, num: '02', title: 'The Work She Set Aside',
    triggerType: 'campfire_upgrade',
    triggerCondition: { upgradeId: 'CAMP_05' },
    feat: 'memory_shard_02',
    icon: '🌿',
    lines: [
      'She studied buildings once.',
      'How space holds people. How a wall decides what you feel when you walk in.',
      'Then she found ink, and the wall became a page, and the page became her.',
      'She was good at it. Really good.',
      'She put the brush down when the sixth one came.',
      'She told herself: later.',
      'Later has been very quiet.',
    ],
  },
  {
    idx: 2, num: '03', title: 'The Moment Before It All Changed',
    triggerType: 'campfire_upgrade',
    triggerCondition: { upgradeId: 'CAMP_02' },
    feat: 'memory_shard_03',
    icon: '🌬️',
    lines: [
      'The night before he was born she lay awake and thought:',
      'I am about to become someone\'s whole world.',
      'I don\'t know if I am enough for that.',
      'The answer, it turned out,',
      'was both yes and no and yes and yes and yes.',
      'And she learned to live in that.',
    ],
  },
  {
    idx: 3, num: '04', title: 'The Week Nobody Said Her Name',
    triggerType: 'campfire_upgrade',
    triggerCondition: { upgradeId: 'CAMP_04' },
    feat: 'memory_shard_04',
    icon: '🌸',
    lines: [
      'There was a week nobody said her name.',
      'They said Mum. They said her.',
      'They said can you, have you, did you.',
      'But not her name.',
      'She started to wonder if she was disappearing.',
      'She was not disappearing.',
      'She was just very, very tired.',
      'But it felt the same.',
    ],
  },
  {
    idx: 4, num: '05', title: 'The Night the Dream Began',
    triggerType: 'campfire_upgrade',
    triggerCondition: { upgradeId: 'CAMP_03' },
    feat: 'memory_shard_05',
    icon: '🪵',
    lines: [
      'It was a Tuesday.',
      'Nothing special happened.',
      'She made dinner. She cleaned up.',
      'She sat down.',
      'And something inside her said: not yet.',
      'Not one more thing tonight.',
      'So she closed her eyes.',
      'And the dream began.',
    ],
  },
  {
    idx: 5, num: '06', title: 'The Invisible Architecture',
    triggerType: 'junk_total',
    triggerCondition: { total: 50 },
    feat: 'memory_shard_06',
    icon: '🧹',
    lines: [
      'Nobody counted the meals.',
      'Nobody tallied the trips, the forms, the appointments, the nights.',
      'She did not count them either.',
      'She just kept going.',
      'But she had spent years learning to see the structure beneath things —',
      'the load-bearing walls, the joints that hold the whole shape up.',
      'She was the load-bearing wall.',
      'She kept counting anyway.',
      'Everything was being counted.',
      'It all mattered. It all still matters.',
    ],
  },
  {
    idx: 6, num: '07', title: 'Herself in Photographs',
    triggerType: 'task_complete',
    triggerCondition: { taskId: 'T4.4' },
    feat: 'memory_shard_07',
    icon: '🪞',
    lines: [
      'She stopped recognising herself in photographs.',
      'Not her face — her hands.',
      'They were always busy.',
      'But not with the thing they used to do.',
      'They looked like someone else\'s hands now.',
      'Capable. Constant. Carrying.',
      'She didn\'t know she was allowed to let them make something beautiful again.',
      'Again. Right now. Even now.',
    ],
  },
  {
    idx: 7, num: '08', title: 'The Student With Ink on Her Hands',
    triggerType: 'level_reveal',
    triggerCondition: { level: 35 },
    feat: 'memory_shard_08',
    icon: '🖋️',
    lines: [
      'At nineteen she drew floor plans in the margins of her lecture notes.',
      'She wanted to build things that outlasted her.',
      'Then someone handed her a brush and she understood:',
      'a single character, written well, is also a building.',
      'It has weight. It has rooms inside it.',
      'She had ink on her hands constantly.',
      'She was happy constantly.',
      'There is room now.',
      'Pick up the brush.',
    ],
  },
  {
    idx: 8, num: '09', title: 'What They Actually Did to Her',
    triggerType: 'bond_filled',
    triggerCondition: {},
    feat: 'memory_shard_09',
    icon: '✦',
    lines: [
      'Six times she looked at someone brand new',
      'and understood, immediately and without question,',
      'that she would burn the world down for them.',
      'They didn\'t take her from herself.',
      'They just made her harder to find.',
      'She is findable.',
      'She is here.',
      'And her hands still remember',
      'exactly what they know how to do.',
    ],
  },
  {
    idx: 9, num: '10', title: 'The One That Was Always Hers',
    triggerType: 'all_shards',
    triggerCondition: { othersCollected: 9, levelFallback: 50 },
    feat: 'memory_shard_10',
    icon: '🌟',
    finale: true,
    lines: [
      'She has a name.',
      'Not Mum. Not her.',
      'A name.',
      'Someone gave it to her before she could carry anything.',
      'When she was just a person, new and whole.',
      'She would like to be called it again.',
      'Just once.',
      'Just to remember it fits.',
    ],
  },
];

export function getShardByIdx(idx) { return SHARDS[idx] || null; }
export function getShardById(id)   { return SHARDS.find(s => s.idx === id) || null; }
