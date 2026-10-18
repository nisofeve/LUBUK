// Global data extracted from GDD v2.0

// Item icons and descriptions
export const ITEMS = {
  // T1 Companion drops
  "Mushroom": { icon: "🍄", color: "#a855f7", desc: "A magical glowing mushroom", tier: 1 },
  "Rice": { icon: "🍚", color: "#f5f5dc", desc: "Fluffy grains of dream rice", tier: 1 },
  "Egg": { icon: "🥚", color: "#fef3c7", desc: "A warm, freshly laid egg", tier: 1 },
  "Fresh Dew": { icon: "💧", color: "#3b82f6", desc: "Pure morning dew drops", tier: 1 },
  "Clover Leaf": { icon: "🍀", color: "#22c55e", desc: "A lucky four-leaf clover", tier: 1 },
  
  // T2 Companion drops
  "Spice Dust": { icon: "🌶️", color: "#ef4444", desc: "Warm fragrant spice powder", tier: 2 },
  "Wildflower": { icon: "🌸", color: "#ec4899", desc: "A beautiful wild flower", tier: 2 },
  "Seaweed Noodle": { icon: "🍜", color: "#14b8a6", desc: "Silky strands of seaweed", tier: 2 },
  "Honey Glob": { icon: "🍯", color: "#f59e0b", desc: "Golden sweet honey", tier: 2 },
  "Dream Herb": { icon: "🌿", color: "#8b5cf6", desc: "Mysterious herb from the void", tier: 2 },
  "Dream Thread": { icon: "🕸️", color: "#d1d5db", desc: "Shimmering spider silk", tier: 2 },
  "Resonance Acorn": { icon: "🌰", color: "#b45309", desc: "An acorn that hums one quiet note when held still", tier: 2 },
  
  // T3 Companion drops
  "Sea Crystal": { icon: "💎", color: "#06b6d4", desc: "A fragment of pure light", tier: 3 },
  "Thunder Silk": { icon: "⚡", color: "#eab308", desc: "Crackling static threads", tier: 3 },
  "Bamboo Shoot": { icon: "🎋", color: "#84cc16", desc: "Fresh bamboo sprouts", tier: 3 },
  "Solar Berry": { icon: "☀️", color: "#fbbf24", desc: "Fruit that glows at noon", tier: 3 },
  "Ice Shard": { icon: "❄️", color: "#67e8f9", desc: "Frozen crystal fragment", tier: 3 },
  "Thorn Berry": { icon: "🫐", color: "#6366f1", desc: "Sweet wild berries with thorns", tier: 3 },
  
  // T4 Companion drops
  "Lunar Dust": { icon: "🌙", color: "#a78bfa", desc: "Silvery moon particles", tier: 4 },
  "Fleece Cloud": { icon: "☁️", color: "#f3f4f6", desc: "Soft cloud matter", tier: 4 },
  "Magma Stone": { icon: "🔥", color: "#f97316", desc: "Hot volcanic rock", tier: 4 },
  "Stardust Feather": { icon: "✨", color: "#fcd34d", desc: "Luminous owl feather", tier: 4 },
  
  // T5 Companion drops
  "Rainbow Shard": { icon: "🌈", color: "#ec4899", desc: "Prismatic light fragment", tier: 5 },
  "Prism Pollen": { icon: "🦋", color: "#a855f7", desc: "Aurora butterfly dust", tier: 5 },
  
  // T6 Companion drops
  "Dark Matter Fluff": { icon: "🐱", color: "#374151", desc: "Void kitten essence", tier: 6 },
  "Spirit Ember": { icon: "🐺", color: "#6b7280", desc: "Spectral wolf flame", tier: 6 },
  
  // Consumables
  "Health Potion": { icon: "🧪", color: "#ef4444", desc: "A crimson potion that instantly restores vitality." },

  // Cooked foods (all recipe outputs — icons match dish type)
  "Mushroom Soup": { icon: "🍲", color: "#a855f7", desc: "Warm and comforting soup" },
  "Rice Ball": { icon: "🍙", color: "#f5f5dc", desc: "A perfectly shaped rice ball" },
  "Scrambled Egg": { icon: "🍳", color: "#fbbf24", desc: "Fluffy scrambled eggs" },
  "Clover Salad": { icon: "🥗", color: "#22c55e", desc: "Fresh and healthy salad" },
  "Honey Dew": { icon: "🥤", color: "#38bdf8", desc: "Sweet honey drink with dew" },
  "Steamed Rice": { icon: "🍚", color: "#fef9c3", desc: "Fluffy steamed rice" },
  "Herb Tea": { icon: "🫖", color: "#86efac", desc: "Calming herbal tea" },
  "Egg Rice Bowl": { icon: "🍱", color: "#fcd34d", desc: "Hearty egg over rice" },
  "Mushroom Stir Fry": { icon: "🥘", color: "#c084fc", desc: "Sizzling mushroom stir fry" },
  "Sweet Honey Rice": { icon: "🍛", color: "#fbbf24", desc: "Golden honey rice" },
  "Wild Petal Salad": { icon: "🥗", color: "#f472b6", desc: "Colorful wildflower salad" },
  "Seaweed Egg Soup": { icon: "🍜", color: "#5eead4", desc: "Nourishing noodle soup" },
  "Frost Berry Pudding": { icon: "🍨", color: "#a5f3fc", desc: "Cool berry pudding" },
  "Spiced Mushroom Broth": { icon: "🥣", color: "#d8b4fe", desc: "Aromatic spiced broth" },
  "Bamboo Dumplings": { icon: "🥟", color: "#bef264", desc: "Steamed bamboo dumplings" },
  "Honey Glazed Egg": { icon: "🍳", color: "#fcd34d", desc: "Glossy honey egg" },
  "Coral Crystal Stew": { icon: "🍲", color: "#22d3ee", desc: "Crystal-rich stew" },
  "Thunder Silk Noodles": { icon: "🍜", color: "#facc15", desc: "Electric spicy noodles" },
  "Moon Herb Elixir": { icon: "⚗️", color: "#c4b5fd", desc: "Luminous moon elixir" },
  "Rainbow Congee": { icon: "🥣", color: "#f472b6", desc: "Prismatic rice porridge" },
  "Cloud Fleece Bun": { icon: "🥮", color: "#f8fafc", desc: "Fluffy cloud bun" },
  "Solar Egg Feast": { icon: "🍱", color: "#fb923c", desc: "A blazing feast box" },
  "Void Truffle Soup": { icon: "🍲", color: "#4b5563", desc: "Dark mysterious soup" },
  "Magma Stone Hotpot": { icon: "🫕", color: "#ea580c", desc: "Fiery stone hotpot" },
  "Prism Honey Cake": { icon: "🍰", color: "#ec4899", desc: "Rainbow-layer cake" },
  "Ice Crystal Ramen": { icon: "🍜", color: "#7dd3fc", desc: "Chilled crystal noodles" },
  "Dream Petal Brew": { icon: "🫖", color: "#a78bfa", desc: "Dreamy floral brew" },
  "Fleece Rice Porridge": { icon: "🥣", color: "#e2e8f0", desc: "Soft cloud porridge" },
  "Grand Feast Platter": { icon: "🍱", color: "#f472b6", desc: "A grand celebration platter" },
  "Dreamland Omakase": { icon: "🍽️", color: "#fbbf24", desc: "Chef's ultimate dream course" }
};

export function getItemData(itemName) {
  return ITEMS[itemName] || { icon: "✨", color: "#fcd34d", desc: "A mysterious item" };
}

// ============================================================
// COMPANIONS (25 unique animal species across 6 tiers)
// ============================================================
export const COMPANIONS = [
  // T1 (5) - Common
  {
    id: "hermit_crab",
    name: "Mushroom Hermit Crab",
    tier: 1,
    drop: "Mushroom",
    perk: { stat: "happinessFromFood", value: 1.10, desc: "+10% happiness from food" },
    personality: "Solitary",
    desc: "A crab housing a giant cap mushroom on its shell. Broods alone but secretly watches over others.",
    animal: "Crab",
    icon: "🦀",
    color: "#a855f7",
    art: "assets/art/Mushroom_Hermit_Crab.png"
  },
  {
    id: "rice_turtle",
    name: "Rice Turtle",
    tier: 1,
    drop: "Rice",
    perk: { stat: "thirstDecay", value: 0.95, desc: "+5% thirst decay reduction" },
    personality: "Stoic",
    desc: "A slow, ancient turtle with rice stalks growing from its shell. Rarely speaks but always present.",
    animal: "Turtle",
    icon: "🐢",
    color: "#22c55e",
    art: "assets/art/Rice_Turtle.png"
  },
  {
    id: "chikoon",
    name: "Chikoon",
    tier: 1,
    drop: "Egg",
    perk: { stat: "hpRegen", value: 1, desc: "+1 HP regen per 5 min" },
    personality: "Playful",
    desc: "A round chicken-raccoon hybrid that lays eggs. Energetic, loud, and easily distracted.",
    animal: "Chicken-Raccoon",
    icon: "🐔",
    color: "#eab308",
    art: "assets/art/Chikoon.png"
  },
  {
    id: "dew_snail",
    name: "Dew Snail",
    tier: 1,
    drop: "Fresh Dew",
    perk: { stat: "thirstDecay", value: 0.90, desc: "Thirst drains 10% slower" },
    junkCleaner: true,
    personality: "Shy",
    desc: "Leaves a sparkling trail. Hides in its shell when approached but warms up quickly. Wanders the area cleaning up junk it finds.",
    animal: "Snail",
    icon: "🐌",
    color: "#3b82f6",
    art: "assets/art/Dew_Snail.png"
  },
  {
    id: "clover_bunny",
    name: "Clover Bunny",
    tier: 1,
    drop: "Clover Leaf",
    perk: { stat: "luckBonus", value: 0.05, desc: "+5% luck (rare drops)" },
    personality: "Playful",
    desc: "A bunny with clover-patterned coat. Believes everything can be solved with a hop and a smile.",
    animal: "Bunny",
    icon: "🐰",
    color: "#ec4899",
    art: "assets/art/Clover_Bunny.png"
  },
  
  // T2 (7) - Uncommon
  {
    id: "ember_beetle",
    name: "Ember Beetle",
    tier: 2,
    drop: "Spice Dust",
    perk: { stat: "nightDamageBonus", value: 1, desc: "+1 fire dmg at night" },
    personality: "Brave",
    desc: "A beetle with glowing abdomen. Charges nightmares fearlessly. Faintly smells of cinnamon.",
    animal: "Beetle",
    icon: "🪲",
    color: "#ef4444",
    art: "assets/art/Ember_Beetle.png"
  },
  {
    id: "petal_fox",
    name: "Petal Fox",
    tier: 2,
    drop: "Wildflower",
    perk: { stat: "happinessDecay", value: 0.85, desc: "Happiness decay −15%" },
    personality: "Maternal",
    desc: "A fox draped in living flower petals. Tends to sad companions compulsively.",
    animal: "Fox",
    icon: "🦊",
    color: "#ec4899",
    art: "assets/art/Petal_Fox.png"
  },
  {
    id: "noodle_eel",
    name: "Noodle Eel",
    tier: 2,
    drop: "Seaweed Noodle",
    perk: { stat: "hungerFromFood", value: 1.08, desc: "+8% hunger fill from food" },
    personality: "Clingy",
    desc: "A long ribbon-like eel who wraps around ankles. Can't bear being more than 2 tiles away.",
    animal: "Eel",
    icon: "🐍",
    color: "#14b8a6",
    art: "assets/art/Noodle_Eel.png"
  },
  {
    id: "pudding_bear",
    name: "Pudding Bear",
    tier: 2,
    drop: "Honey Glob",
    perk: { stat: "goldBonus", value: 1.05, desc: "Cooked food sells +5% gold" },
    junkCleaner: true,
    personality: "Gluttonous",
    desc: "A pudgy bear dripping with golden honey. Obsessed with food. Inspects every drop. Sniffs out and scrubs away junk while on its rounds.",
    animal: "Bear",
    icon: "🐻",
    color: "#f59e0b"
  },
  {
    id: "mist_chameleon",
    name: "Mist Chameleon",
    tier: 2,
    drop: "Dream Herb",
    perk: { stat: "foodPerkDuration", value: 1.20, desc: "Food perks last 20% longer" },
    personality: "Shy",
    desc: "A translucent chameleon that shifts colors with its mood. Masters of camouflage and patience.",
    animal: "Chameleon",
    icon: "🦎",
    color: "#8b5cf6"
  },
  {
    id: "silk_spider",
    name: "Silk Spider",
    tier: 2,
    drop: "Dream Thread",
    perk: { stat: "nightmareTrapChance", value: 0.10, desc: "10% chance to trap nightmares 3s" },
    personality: "Solitary",
    desc: "A delicate spider that weaves shimmering webs between props. Its silk glows faintly at night.",
    animal: "Spider",
    icon: "🕷️",
    color: "#d1d5db"
  },
  {
    id: "song_squirrel",
    name: "Song Squirrel",
    tier: 2,
    drop: "Resonance Acorn",
    role: "stunner",
    perk: { stat: "companionProduceSpeed", value: 0.92, desc: "All other companion produce timers −8%" },
    personality: "Playful",
    desc: "A quick, bright-eyed squirrel whose tail twitches in rhythm when it hums. Collects small things carefully. Never misses a beat.",
    animal: "Squirrel",
    icon: "🐿️",
    color: "#a16207",
    child_affinity: "CHILD_1"
  },

  // T3 (6) - Rare
  {
    id: "coral_seahorse",
    name: "Coral Seahorse",
    tier: 3,
    drop: "Sea Crystal",
    role: "healer",
    healAmount: 7,
    healCooldown: 7,
    perk: { stat: "healer", value: 7, desc: "Healer · restores 7 HP every 7s" },
    personality: "Stoic",
    desc: "An elegant seahorse with living coral formations. Its soothing aura mends wounds — a rare Healer-class companion.",
    animal: "Seahorse",
    icon: "🐴",
    color: "#06b6d4"
  },
  {
    id: "storm_moth",
    name: "Storm Moth",
    tier: 3,
    drop: "Thunder Silk",
    perk: { stat: "nightAttackBonus", value: 2, desc: "Player attack +2 at night" },
    personality: "Brave",
    desc: "A massive moth crackling with static. Flies into nightmares on sight.",
    animal: "Moth",
    icon: "🦋",
    color: "#eab308"
  },
  {
    id: "bamboo_crane",
    name: "Bamboo Crane",
    tier: 3,
    drop: "Bamboo Shoot",
    perk: { stat: "craftingCostReduction", value: 0.80, desc: "Crafting costs −20%" },
    junkCleaner: true,
    personality: "Grumpy",
    desc: "A tall graceful crane with bamboo-patterned feathers. Builds intricate nests. Secretly proud of its craft. Despises mess — will sweep away junk on sight.",
    animal: "Crane",
    icon: "🦩",
    color: "#84cc16"
  },
  {
    id: "sundrop_lizard",
    name: "Sundrop Lizard",
    tier: 3,
    drop: "Solar Berry",
    perk: { stat: "dailyHappinessBonus", value: 5, desc: "Happiness starts each day +5" },
    personality: "Playful",
    desc: "A lizard that glows at noon. Sunbathes constantly and radiates warmth.",
    animal: "Lizard",
    icon: "🦎",
    color: "#fbbf24"
  },
  {
    id: "frost_penguin",
    name: "Frost Penguin",
    tier: 3,
    drop: "Ice Shard",
    perk: { stat: "thirstRestoreBonus", value: 15, desc: "Thirst restored +15 from all sources" },
    personality: "Maternal",
    desc: "A penguin with ice crystal wings. Keeps the land cool and tends to others.",
    animal: "Penguin",
    icon: "🐧",
    color: "#67e8f9"
  },
  {
    id: "bramble_hedgehog",
    name: "Bramble Hedgehog",
    tier: 3,
    drop: "Thorn Berry",
    perk: { stat: "reflectDamage", value: 1, desc: "Nightmares take 1 reflect dmg on contact" },
    personality: "Grumpy",
    desc: "A spiky hedgehog wrapped in thorny vines. Rolls into a ball at danger, damaging anything that touches it.",
    animal: "Hedgehog",
    icon: "🦔",
    color: "#6366f1"
  },
  
  // T4 (4) - Epic
  {
    id: "moon_ferret",
    name: "Moon Ferret",
    tier: 4,
    drop: "Lunar Dust",
    perk: { stat: "nightmareIgnoreChance", value: 1, desc: "One nightmare/night ignores you" },
    personality: "Solitary",
    desc: "A silver-furred ferret that emerges after dark. Negotiates silently with nightmares.",
    animal: "Ferret",
    icon: "🐿️",
    color: "#a78bfa"
  },
  {
    id: "cloud_sheep",
    name: "Cloud Sheep",
    tier: 4,
    drop: "Fleece Cloud",
    role: "healer",
    healAmount: 7,
    healCooldown: 7,
    perk: { stat: "healer", value: 7, desc: "Healer · restores 7 HP every 7s" },
    junkCleaner: true,
    personality: "Maternal",
    desc: "A sheep made of cloud matter. Maternal fleece mends wounds — a rare Healer-class companion. Instinctively nuzzles junk away with its fluffy body.",
    animal: "Sheep",
    icon: "🐑",
    color: "#f3f4f6"
  },
  {
    id: "lava_toad",
    name: "Lava Toad",
    tier: 4,
    drop: "Magma Stone",
    perk: { stat: "craftingBonusChance", value: 0.20, desc: "Crafting extra item 20% chance" },
    personality: "Grumpy",
    desc: "A toad with magma cracks on its skin. Sits in corners stewing. Erupts helpfully.",
    animal: "Toad",
    icon: "🐸",
    color: "#f97316"
  },
  {
    id: "starlight_owl",
    name: "Starlight Owl",
    tier: 4,
    drop: "Stardust Feather",
    perk: { stat: "nightmareWarning", value: 2, desc: "Nightmares visible 2s before arrival" },
    personality: "Stoic",
    desc: "A luminous owl whose feathers scatter starlight. Watches over the land from its perch in silence.",
    animal: "Owl",
    icon: "🦉",
    color: "#fcd34d"
  },
  
  // T5 (2) - Mythic
  {
    id: "prism_deer",
    name: "Prism Deer",
    tier: 5,
    drop: "Rainbow Shard",
    perk: { stat: "minHappiness", value: 15, desc: "Happiness never drops below 15%" },
    personality: "Empathetic",
    desc: "A translucent deer refracting light into rainbows. Feels everyone's emotions simultaneously.",
    animal: "Deer",
    icon: "🦌",
    color: "#ec4899"
  },
  {
    id: "aurora_butterfly",
    name: "Aurora Butterfly",
    tier: 5,
    drop: "Prism Pollen",
    perk: { stat: "companionProduceSpeed", value: 0.85, desc: "All companion produce timers −15%" },
    junkCleaner: true,
    personality: "Playful",
    desc: "A massive butterfly trailing aurora borealis particles. Its wings pulse with prismatic energy. Dusts junk away with a single wing-beat — its light is anathema to shadow.",
    animal: "Butterfly",
    icon: "🦋",
    color: "#a855f7"
  },
  
  // T6 (2) - Legendary
  {
    id: "void_kitten",
    name: "Void Kitten",
    tier: 6,
    drop: "Dark Matter Fluff",
    perk: { stat: "reviveOnDeath", value: 20, desc: "On death: revive once/run with 20 HP" },
    junkCleaner: true,
    personality: "Solitary",
    desc: "A kitten-shaped tear in reality. Cold, distant, but will silently die for you. The rarest. Absorbs junk back into the void — it cleans faster than any other.",
    animal: "Cat",
    icon: "🐱",
    color: "#374151"
  },
  {
    id: "phantom_wolf",
    name: "Phantom Wolf",
    tier: 6,
    drop: "Spirit Ember",
    perk: { stat: "nightmareHpReduction", value: 0.70, desc: "All nightmares spawn with −30% HP" },
    personality: "Brave",
    desc: "A spectral wolf that phases between dimensions. Its howl weakens the fabric of nightmares.",
    animal: "Wolf",
    icon: "🐺",
    color: "#6b7280"
  }
];

// ── Combat role + lore for each companion ────────────────────
// role: 'attacker' | 'defender' | 'caster' | 'stunner'
export const COMPANION_ROLES = {
  hermit_crab:    { role: 'stunner',  lore: "Found in the mushroom woods where nightmares refused to follow. It chose the light — once." },
  rice_turtle:    { role: 'defender', lore: "Older than the last great darkness. Moves slowly to make sure no light is ever left behind." },
  chikoon:        { role: 'attacker', lore: "Born in a warm crack between two nightmare territories. It makes noise so the dark can't hear it thinking." },
  dew_snail:      { role: 'caster',   lore: "Appears only at dawn, leaves only a shimmering trail. Nobody has ever seen it arrive — or decided to ask why." },
  clover_bunny:   { role: 'attacker', lore: "Collects lucky clovers from places hope forgot. Believes luck is made by moving your feet first." },
  ember_beetle:   { role: 'attacker', lore: "A lone survivor of a light that burned out long ago. Still carrying the warmth. Still pretending it isn't heavy." },
  petal_fox:      { role: 'defender', lore: "Grew from the last garden swallowed by shadow. It mends broken things with petals first and questions later." },
  noodle_eel:     { role: 'caster',   lore: "Pulled from a stream between dreaming and waking. It wraps around ankles because letting go takes too much courage." },
  pudding_bear:   { role: 'stunner',  lore: "Legend says it was dreaming of dessert when the darkness came. It fights with the conviction of someone defending something sweet." },
  mist_chameleon: { role: 'caster',   lore: "It was the fog before it was a creature. Your light gave it just enough shape to stay." },
  silk_spider:    { role: 'caster',   lore: "Weaves webs in geometries the dark cannot cross. Prefers solitude, but tolerates being needed." },
  coral_seahorse: { role: 'healer',   lore: "Drifted up from a memory of an ocean that no longer exists. It stays because leaving would mean forgetting it ever did." },
  storm_moth:     { role: 'attacker', lore: "Emerged from the first thunderstorm that ever frightened a dreamer. Nightmares smell like fear — and fear makes it hungry." },
  bamboo_crane:   { role: 'stunner',  lore: "Built its first nest in the ruins of something that was once a home. Still sweeps the floor there every night." },
  sundrop_lizard: { role: 'caster',   lore: "Swallowed the last drop of noon-light and has held it warm ever since. Still daydreams about a sky it has never seen." },
  frost_penguin:  { role: 'defender', lore: "Marched from the edge of the frozen world when it heard someone was alone. Came for company. Stayed because it was needed." },
  bramble_hedgehog:{ role: 'stunner', lore: "Grew thorns to protect something soft underneath. It still hasn't figured out how to let anyone see that part." },
  moon_ferret:    { role: 'caster',   lore: "Slips between the waking world and the void on moonbeam bridges. Nightmares mistake it for one of their own — a mistake it uses every time." },
  cloud_sheep:    { role: 'healer',   lore: "A wandering cloud that chose a softer shape. It knows it will rain eventually. It keeps that to itself." },
  lava_toad:      { role: 'stunner',  lore: "Crawled from the earth's oldest wound the night the last volcano went quiet. Still simmering. Still useful." },
  starlight_owl:  { role: 'caster',   lore: "Perches where stars have fallen and pretends to sleep. It has never once been surprised." },
  prism_deer:     { role: 'defender', lore: "Born the moment the last rainbow gave out. Carries all its colours on the inside now." },
  aurora_butterfly:{ role: 'caster',  lore: "Flew down from the light show at the edge of everything. Leaves a little of that magic behind with every wingbeat." },
  void_kitten:    { role: 'caster',   lore: "Tore itself out of the darkness just to see what the fuss was about. It does not explain itself. It never will." },
  phantom_wolf:   { role: 'attacker', lore: "Walked out of the nightmare's own dream and into yours. Whatever it howls at comes apart a little." },
};

export const ROLE_META = {
  attacker: { icon: '⚔️',  label: 'Attacker', color: '#f87171', desc: 'Hunts nightmares aggressively with ranged attacks.' },
  defender: { icon: '🛡️',  label: 'Defender', color: '#60a5fa', desc: 'Intercepts nightmares and casts a shield on the player every 5s.' },
  caster:   { icon: '✨',  label: 'Caster',   color: '#c084fc', desc: 'Fires chain lightning that arcs through up to 3 enemies.' },
  stunner:  { icon: '💫',  label: 'Stunner',  color: '#fbbf24', desc: 'Melee fighter with 50% chance to stun nightmares for 3 seconds.' },
  healer:   { icon: '🩹',  label: 'Healer',   color: '#f472b6', desc: 'Restores 7 HP to the player every 7s while deployed.' },
};

// ============================================================
// PLAYER PERSONALITY SUB-TRAITS
// Mirrors the per-companion personality system but for the player.
// Selected in the Passport. One mechanical bias per trait.
// ============================================================
export const PLAYER_TRAITS = {
  Curious: {
    icon: '🔍',
    color: '#22d3ee',
    short: 'Default',
    desc: '+5% XP from feats. Auto-behavior investigates new drops first.',
    feat: 'born_curious',
  },
  Shy: {
    icon: '🌙',
    color: '#a78bfa',
    short: 'Recovers alone',
    desc: 'Happiness recovers 25% faster when no Compys are within 2 tiles. Social interactions give half value.',
    feat: 'quiet_soul',
  },
  Brave: {
    icon: '⚔️',
    color: '#f87171',
    short: 'Stands ground',
    desc: 'Auto-behavior never flees nightmares. +1 attack while HP is below 30%.',
    feat: 'bold_spirit',
  },
  Gluttonous: {
    icon: '🍖',
    color: '#fb923c',
    short: 'Eats early',
    desc: 'Auto-eats food at 70% hunger (default 50%). +50% happiness bonus from cooked meals.',
    feat: 'hearty_appetite',
  },
  Empathetic: {
    icon: '💞',
    color: '#f472b6',
    short: 'Bonded',
    desc: 'Happiness ticks up while any deployed Compy is at 80%+ mood. Auto-behavior prioritizes sad Compys.',
    feat: 'open_heart',
  },
  Stoic: {
    icon: '🗿',
    color: '#94a3b8',
    short: 'Steady',
    desc: 'Happiness decay halved. Happiness gains also halved. Steady through any storm.',
    feat: 'steady_mind',
  },
};

export const PLAYER_TRAIT_LIST = ['Curious', 'Shy', 'Brave', 'Gluttonous', 'Empathetic', 'Stoic'];
export const DEFAULT_PLAYER_TRAIT = 'Curious';

// Helper functions
export function getCompanionById(id) {
  const c = COMPANIONS.find(c => c.id === id);
  if (!c) return null;
  const extra = COMPANION_ROLES[id] || {};
  return { ...c, ...extra };
}

export function getCompanionsByTier(tier) {
  return COMPANIONS.filter(c => c.tier === tier);
}

export const TIER_COLORS = {
  1: { bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.08)", text: "#a8a3b8", name: "Common" },
  2: { bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.15)", text: "#86efac", name: "Uncommon" },
  3: { bg: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.15)", text: "#93c5fd", name: "Rare" },
  4: { bg: "rgba(139,92,246,0.08)", border: "rgba(139,92,246,0.15)", text: "#c4b5fd", name: "Epic" },
  5: { bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.15)", text: "#fcd34d", name: "Mythic" },
  6: { bg: "rgba(249,112,102,0.10)", border: "rgba(249,112,102,0.20)", text: "#fca5a1", name: "Legendary" }
};

export const GAME_DATA = {
  player: {
    startHp: 100,
    maxHp: 100,
    startHappiness: 20,
    startAttack: 2,
    maxLevel: 50,
    maxCompanions: 3,
    dropInterval: 300000 // 5 minutes in ms
  },

  // Nightmares
  nightmares: [
    { id: 'pup', name: "Shadow Pup", hp: 5, dmg: 1, speed: 'Fast', color: "#52525b", icon: "🐺" },
    { id: 'moth', name: "Dread Moth", hp: 8, dmg: 2, speed: 'Medium', color: "#8b5cf6", icon: "🦋" },
    { id: 'bear', name: "Hollow Bear", hp: 20, dmg: 5, speed: 'Slow', color: "#ef4444", icon: "🐻" },
    { id: 'wisp', name: "Weeping Wisp", hp: 6, dmg: 0, speed: 'Medium', color: "#ec4899", icon: "👻", special: "drainHappiness" },
    { id: 'root', name: "Nightmare Root", hp: 15, dmg: 0, speed: 'Static', color: "#f59e0b", icon: "🌱", special: "spawnPups" },
    { id: 'titan', name: "Void Titan", hp: 80, dmg: 10, speed: 'Slow', color: "#7c3aed", icon: "👹", isBoss: true }
  ],

  // Props (Level Reveal)
  reveals: [
    { lv: 5, name: "Dew Pond", icon: "💧", produces: "Fresh Dew", rate: "Every 5 min", perk: "Passive water source" },
    { lv: 10, name: "Berry Bush", icon: "🫐", produces: "Solar Berry", rate: "Every 15 min", perk: "+2 happiness when collected" },
    { lv: 15, name: "Herb Patch", icon: "🌿", produces: "Dream Herb", rate: "Every 12 min", perk: "Herbs grow faster at high happiness" },
    { lv: 20, name: "Crystal Cave", icon: "💎", produces: "Sea Crystal", rate: "Every 15 min", perk: "+5 max HP permanently when first revealed" },
    { lv: 25, name: "Bamboo Grove", icon: "🎋", produces: "Bamboo Shoot", rate: "Every 10 min", perk: "Crafting cost −10% global" },
    { lv: 30, name: "Moonwell", icon: "🌙", produces: "Lunar Dust", rate: "Every 20 min", perk: "Night lasts 30s shorter" },
    { lv: 35, name: "Lava Vent", icon: "🌋", produces: "Magma Stone", rate: "Every 20 min", perk: "+3 attack permanently" },
    { lv: 40, name: "Rainbow Spring", icon: "🌈", produces: "Rainbow Shard", rate: "Every 25 min", perk: "Happiness minimum +5%" },
    { lv: 45, name: "Cloud Nest", icon: "☁️", produces: "Fleece Cloud", rate: "Every 25 min", perk: "All companion mood +5% passive" },
    { lv: 50, name: "Void Rift", icon: "🕳️", produces: "Dark Matter Fluff", rate: "Every 30 min", perk: "Nightmare HP −10% global" }
  ],

  // Recipes (30 total)
  recipes: [
    // 1★ Basic (7)
    { id: 'mushroom_soup', name: "Mushroom Soup", req: {"Mushroom": 1, "Fresh Dew": 1}, quality: 1, hunger: 30, happy: 5, perk: null },
    { id: 'rice_ball', name: "Rice Ball", req: {"Rice": 1, "Seaweed Noodle": 1}, quality: 1, hunger: 35, happy: 4, perk: null },
    { id: 'scrambled_egg', name: "Scrambled Egg", req: {"Egg": 1, "Spice Dust": 1}, quality: 1, hunger: 25, happy: 6, perk: { stat: "attackBonus", value: 1, duration: 120000, desc: "Atk +1 (2min)" } },
    { id: 'clover_salad', name: "Clover Salad", req: {"Clover Leaf": 1, "Wildflower": 1}, quality: 1, hunger: 15, happy: 8, perk: { stat: "happinessDecay", value: 0.80, duration: 180000, desc: "Happiness decay −20% (3min)" } },
    { id: 'honey_dew', name: "Honey Dew", req: {"Honey Glob": 1, "Fresh Dew": 1}, quality: 1, hunger: 10, happy: 10, thirst: 20, perk: null },
    { id: 'steamed_rice', name: "Steamed Rice", req: {"Rice": 1, "Fresh Dew": 1}, quality: 1, hunger: 40, happy: 3, perk: null },
    { id: 'herb_tea', name: "Herb Tea", req: {"Dream Herb": 1, "Fresh Dew": 1}, quality: 1, hunger: 5, happy: 12, perk: { stat: "hpRegen", value: 2, duration: 300000, desc: "HP regen +2/min (5min)" } },
    
    // 2★ Good (10)
    { id: 'egg_rice_bowl', name: "Egg Rice Bowl", req: {"Egg": 1, "Rice": 1}, quality: 2, hunger: 45, happy: 10, perk: { stat: "hungerDecay", value: 0.85, duration: 300000, desc: "Hunger decay −15% (5min)" } },
    { id: 'mushroom_stir_fry', name: "Mushroom Stir Fry", req: {"Mushroom": 1, "Spice Dust": 1, "Bamboo Shoot": 1}, quality: 2, hunger: 40, happy: 15, perk: { stat: "attackBonus", value: 2, duration: 300000, desc: "Atk +2 (5min)" } },
    { id: 'sweet_honey_rice', name: "Sweet Honey Rice", req: {"Rice": 1, "Honey Glob": 1}, quality: 2, hunger: 50, happy: 12, perk: { stat: "goldBonus", value: 1.10, duration: 600000, desc: "Gold sell +10%" } },
    { id: 'wild_petal_salad', name: "Wild Petal Salad", req: {"Wildflower": 1, "Clover Leaf": 1, "Dream Herb": 1}, quality: 2, hunger: 30, happy: 20, perk: { stat: "happinessDecay", value: 0, duration: 300000, desc: "Happiness decay stop (5min)" } },
    { id: 'seaweed_egg_soup', name: "Seaweed Egg Soup", req: {"Seaweed Noodle": 1, "Egg": 1, "Fresh Dew": 1}, quality: 2, hunger: 45, happy: 15, thirst: 30, perk: null },
    { id: 'frost_berry_pudding', name: "Frost Berry Pudding", req: {"Solar Berry": 1, "Ice Shard": 1}, quality: 2, hunger: 35, happy: 18, perk: { stat: "nightVision", value: 1.15, duration: 480000, desc: "Night vision clarity" } },
    { id: 'spiced_mushroom_broth', name: "Spiced Mushroom Broth", req: {"Mushroom": 1, "Spice Dust": 1, "Dream Herb": 1}, quality: 2, hunger: 40, happy: 16, perk: { stat: "fearImmunity", value: 1, duration: 240000, desc: "Fear immunity (1 night)" } },
    { id: 'bamboo_dumplings', name: "Bamboo Dumplings", req: {"Bamboo Shoot": 1, "Rice": 1, "Seaweed Noodle": 1}, quality: 2, hunger: 55, happy: 14, perk: { stat: "craftingSpeed", value: 1.20, duration: 600000, desc: "Crafting +20% (10min)" } },
    { id: 'honey_glazed_egg', name: "Honey Glazed Egg", req: {"Egg": 1, "Honey Glob": 1, "Spice Dust": 1}, quality: 2, hunger: 45, happy: 18, hpRestore: 15, perk: null },
    { id: 'coral_crystal_stew', name: "Coral Crystal Stew", req: {"Sea Crystal": 1, "Mushroom": 1, "Fresh Dew": 1}, quality: 2, hunger: 40, happy: 20, perk: { stat: "maxHpBonus", value: 10, duration: -1, desc: "Max HP +10 (run)" } },
    
    // 3★ Delicious (13)
    { id: 'thunder_silk_noodles', name: "Thunder Silk Noodles", req: {"Thunder Silk": 1, "Seaweed Noodle": 1, "Spice Dust": 1}, quality: 3, hunger: 55, happy: 25, perk: { stat: "attackBonus", value: 5, duration: 240000, desc: "Atk +5 (full night)" } },
    { id: 'moon_herb_elixir', name: "Moon Herb Elixir", req: {"Lunar Dust": 1, "Dream Herb": 1, "Fresh Dew": 1}, quality: 3, hunger: 20, happy: 30, perk: { stat: "nightmareRepel", value: 3, duration: 240000, desc: "Nightmare repel aura (1 night)" } },
    { id: 'rainbow_congee', name: "Rainbow Congee", req: {"Rainbow Shard": 1, "Rice": 1, "Honey Glob": 1}, quality: 3, hunger: 60, happy: 30, perk: { stat: "allStatsBonus", value: 1.10, duration: 600000, desc: "All stats +10% (10min)" } },
    { id: 'cloud_fleece_bun', name: "Cloud Fleece Bun", req: {"Fleece Cloud": 1, "Bamboo Shoot": 1, "Rice": 1}, quality: 3, hunger: 65, happy: 25, perk: { stat: "happinessLock", value: 25, duration: 300000, desc: "Happiness locked +25 (5min)" } },
    { id: 'solar_egg_feast', name: "Solar Egg Feast", req: {"Solar Berry": 1, "Egg": 1, "Honey Glob": 1, "Spice Dust": 1}, quality: 3, hunger: 70, happy: 28, hpRestore: 100, perk: null },
    { id: 'void_truffle_soup', name: "Void Truffle Soup", req: {"Dark Matter Fluff": 1, "Mushroom": 1, "Dream Herb": 1}, quality: 3, hunger: 60, happy: 35, perk: { stat: "nightmaresFlee", value: 1, duration: 240000, desc: "Nightmares flee you" } },
    { id: 'magma_stone_hotpot', name: "Magma Stone Hotpot", req: {"Magma Stone": 1, "Spice Dust": 1, "Bamboo Shoot": 1}, quality: 3, hunger: 65, happy: 22, hpRestore: 20, perk: { stat: "attackBonus", value: 8, duration: 300000, desc: "Atk +8, HP +20 (5min)" } },
    { id: 'prism_honey_cake', name: "Prism Honey Cake", req: {"Rainbow Shard": 1, "Honey Glob": 1, "Wildflower": 1}, quality: 3, hunger: 55, happy: 40, perk: { stat: "maxHappinessBonus", value: 10, duration: -1, desc: "Max happiness +10 (run)" } },
    { id: 'ice_crystal_ramen', name: "Ice Crystal Ramen", req: {"Ice Shard": 1, "Seaweed Noodle": 1, "Fresh Dew": 1}, quality: 3, hunger: 60, happy: 20, perk: { stat: "thirstImmunity", value: 1, duration: 480000, desc: "Thirst immune (1 day)" } },
    { id: 'dream_petal_brew', name: "Dream Petal Brew", req: {"Dream Herb": 1, "Wildflower": 1, "Lunar Dust": 1}, quality: 3, hunger: 30, happy: 38, perk: { stat: "happinessDecay", value: 0.50, duration: 480000, desc: "Happiness decay −50% (1 day)" } },
    { id: 'fleece_rice_porridge', name: "Fleece Rice Porridge", req: {"Fleece Cloud": 1, "Rice": 1, "Clover Leaf": 1}, quality: 3, hunger: 70, happy: 30, perk: { stat: "skipNight", value: 1, duration: 0, desc: "Skip one night" } },
    { id: 'grand_feast_platter', name: "Grand Feast Platter", req: {"Egg": 1, "Rice": 1, "Mushroom": 1, "Bamboo Shoot": 1, "Honey Glob": 1}, quality: 3, hunger: 80, happy: 35, perk: { stat: "companionMoodBoost", value: 30, duration: 0, desc: "All companions mood +30" } },
    { id: 'dreamland_omakase', name: "Dreamland Omakase", req: {"special": "all_deployed_drops"}, quality: 3, hunger: 100, happy: 50, perk: { stat: "reviveCompanion", value: 1, attackBonus: 5, duration: -1, desc: "Revive companion + perm +5 Atk" } }
  ],

  // Crafting Props (12). Some have an `ability` (active, tap-to-fire with cooldown).
  craftProps: [
    { id: 'cooking_station', icon: "🍳", name: "Cooking Station", req: {"Bamboo Shoot": 3, "Magma Stone": 2}, perk: "Enables all cooking. Required for any recipe.",
      ability: { name: 'Quick Heat', icon: '🔥', cooldown: 60, effect: 'quick_heat',
                 desc: '+30 hunger from any stocked food (instant).' } },
    { id: 'workbench', icon: "🔨", name: "Workbench", req: {"Bamboo Shoot": 4, "Fleece Cloud": 2}, perk: "Enables crafting of all props." },
    { id: 'stone_well', icon: "💧", name: "Stone Well", req: {"Sea Crystal": 5, "Magma Stone": 2}, perk: "Generates 1 Fresh Dew per 3min passively." },
    { id: 'herb_garden', icon: "🌿", name: "Herb Garden", req: {"Clover Leaf": 3, "Wildflower": 2, "Dream Herb": 1}, perk: "Grows 1 Dream Herb per 10min." },
    { id: 'companion_den', icon: "🏠", name: "Companion Den", req: {"Bamboo Shoot": 6, "Fleece Cloud": 3}, perk: "Respawns KO'd companions 30s faster." },
    { id: 'mood_lantern', icon: "🪔", name: "Mood Lantern", req: {"Lunar Dust": 2, "Solar Berry": 1}, perk: "Happiness decay −10% in radius.",
      ability: { name: 'Bright Burst', icon: '✨', cooldown: 120, effect: 'bright_burst',
                 desc: '+15 happiness now; nearby Compys (5 tiles) +10 mood.' } },
    { id: 'ward_stone', icon: "🛡️", name: "Ward Stone", req: {"Sea Crystal": 3, "Thunder Silk": 2}, perk: "Nightmares −2 dmg in ward range.",
      ability: { name: 'Ward Pulse', icon: '🛡️', cooldown: 90, effect: 'ward_pulse',
                 desc: 'Repels nightmares within 4 tiles for 8 seconds.' } },
    { id: 'storage_chest', icon: "📦", name: "Storage Chest", req: {"Bamboo Shoot": 4, "Fleece Cloud": 2}, perk: "+10 inventory slots." },
    { id: 'dream_chime', icon: "🎵", name: "Dream Chime", req: {"Rainbow Shard": 2, "Thunder Silk": 1}, perk: "Happiness decay −5% global.",
      ability: { name: 'Lullaby', icon: '🎵', cooldown: 180, effect: 'lullaby',
                 desc: 'All Compys enter happy idle for 30 seconds; mood decay halts.' } },
    { id: 'night_watcher', icon: "🔭", name: "Night Watcher", req: {"Lunar Dust": 2, "Sea Crystal": 1}, perk: "Nightmare count shown 30s before night." },
    { id: 'companion_pasture', icon: "🌱", name: "Companion Pasture", req: {"Clover Leaf": 5, "Bamboo Shoot": 3}, perk: "Companion produce −30s passive." },
    { id: 'brew_cauldron', icon: "⚗️", name: "Brew Cauldron", req: {"Magma Stone": 2, "Dream Herb": 2, "Ice Shard": 1}, perk: "Unlocks 3★ recipes." }
  ],

  achievements: [
    { id: 'survive_n1', name: "Survive First Night", xp: 50 },
    { id: 'collect_10', name: "Collect 10 Items", xp: 50 },
    { id: 'cook_first', name: "Cook First Meal", xp: 100 },
    { id: 'kill_nm_1', name: "Defeat a Nightmare", xp: 150 },
    { id: 'collect_3_comps', name: "Party of Three", xp: 100 },
    { id: 'collect_all_comps', name: "Full House", xp: 250 }
  ]
};

// Helper to calculate active companion perks
const PERK_PCT_PER_COPY = [0, 0.01, 0.02, 0.03, 0.04, 0.05, 0.1];

export function calculateCompanionPerks(deployedCompanions, companionInventory = {}) {
  const perks = {
    // Stat modifiers (multiplicative)
    happinessFromFood: 1.0,
    hungerFromFood: 1.0,
    thirstDecay: 1.0,
    happinessDecay: 1.0,
    hungerDecay: 1.0,
    goldBonus: 1.0,
    foodPerkDuration: 1.0,
    companionProduceSpeed: 1.0,
    nightmareHpReduction: 1.0,
    
    // Stat bonuses (additive)
    hpRegen: 0,
    luckBonus: 0,
    nightDamageBonus: 0,
    nightAttackBonus: 0,
    maxHpBonus: 0,
    dailyHappinessBonus: 0,
    thirstRestoreBonus: 0,
    reflectDamage: 0,
    minHappiness: 0,
    
    // Special effects (boolean/count)
    nightmareTrapChance: 0,
    nightmareIgnoreChance: 0,
    lightPenaltyReduction: 0,
    craftingCostReduction: 1.0,
    craftingBonusChance: 0,
    nightmareWarning: 0,
    reviveOnDeath: 0,
    lootChance: 0,
    xpBonus: 1.0
  };
  
  for (const companion of deployedCompanions) {
    const compData = getCompanionById(companion.type || companion.id);
    if (!compData || !compData.perk) continue;
    
    const { stat, value } = compData.perk;

    // Copy-based boost: each copy of this companion's tier boosts the perk effect
    const copyCount = companionInventory[compData.id] || 0;
    const pctPerCopy = PERK_PCT_PER_COPY[compData.tier] || 0.01;
    const boost = 1 + (copyCount * pctPerCopy / 100);

    // Handle multiplicative vs additive stats
    const multiplicativeStats = [
      'happinessFromFood', 'hungerFromFood', 'thirstDecay', 'happinessDecay',
      'hungerDecay', 'goldBonus', 'foodPerkDuration', 'companionProduceSpeed',
      'nightmareHpReduction', 'craftingCostReduction', 'xpBonus'
    ];

    if (multiplicativeStats.includes(stat)) {
      // Scale the deviation from 1 by the boost (e.g. 0.9 → more reduction with more copies)
      perks[stat] *= 1 + (value - 1) * boost;
    } else if (perks[stat] !== undefined) {
      perks[stat] += value * boost;
    }
  }
  
  return perks;
}

export function getLevelLightRadius(level) {
  // Halved: starts at ~1.5 tiles at lv1, +0.5 per level
  return level * 0.5 + 1;
}

export function getMaxCompanions(level) {
  if (level < 5) return 3;
  if (level < 15) return 4;
  if (level < 25) return 6;
  if (level < 35) return 7;
  if (level < 45) return 8;
  if (level < 50) return 9;
  return 10;
}

/** True if this item name is a cooked dish (from recipes). */
export function isCookedFood(itemName) {
  return GAME_DATA.recipes.some(r => r.name === itemName);
}

export function getRecipeByFoodName(name) {
  return GAME_DATA.recipes.find(r => r.name === name);
}
