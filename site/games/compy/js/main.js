import { Engine } from './engine.js';
import { World } from './world.js';
import { Player, Companion, Nightmare, ItemDrop, Merchant, AttackVFX, Bullet, MerchantCamp, Junk, ChainLightningVFX, ShieldCastVFX } from './entities.js';
import { Campfire, CookingStation } from './campfire.js';
import { LIFE_QUOTES } from '../data/quotes.js';
import { GAME_DATA, COMPANIONS, TIER_COLORS, getLevelLightRadius, getItemData, getCompanionById, getMaxCompanions, calculateCompanionPerks, isCookedFood, getRecipeByFoodName, ROLE_META, PLAYER_TRAITS, PLAYER_TRAIT_LIST, DEFAULT_PLAYER_TRAIT } from '../data/data.js';
import { AchievementTracker, ALL_ACHIEVEMENTS, RESOURCE_COUNTER_MAP, NIGHTMARE_COUNTER_MAP, RECIPE_COUNTER_MAP, COMPANION_FOUND_MAP, ACH_CATEGORIES } from '../data/achievements.js';
import { EditMode } from './editmode.js';
import { AVATAR_DEFS, drawPassportAvatar } from './passport.js';
import './story_panel.js'; // attaches window.StoryPanel for narrative flows
import { ChildrenManager } from './children.js';
import { CHILDREN, TASKS, getChildByIndex, activeTaskFor, tasksForChild, getTaskById } from '../data/children_data.js';
import { ShardSystem, getShardForReread } from './shard_system.js';
import { SHARDS } from '../data/shards.js';
import { CAMPFIRE_UPGRADES, nextPendingUpgrade } from '../data/campfire_upgrades.js';
import { FinaleDirector } from './finale.js';
import { wireStoryAudio } from './audio.js';

window.AVATAR_DEFS = AVATAR_DEFS;

function _dimHex(hex, amt) {
  const r = Math.max(0, parseInt(hex.slice(1,3),16) - amt);
  const g = Math.max(0, parseInt(hex.slice(3,5),16) - amt);
  const b = Math.max(0, parseInt(hex.slice(5,7),16) - amt);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

function _applyAvatarColors(picIdx) {
  const def = AVATAR_DEFS[picIdx] || AVATAR_DEFS[0];
  window._avatarColors = {
    body:  def.bg,
    skin:  def.skin,
    hair:  def.hairCol,
    leg:   _dimHex(def.bg, 40),
    foot:  _dimHex(def.bg, 55),
    arm:   def.bg,
    hand:  def.skin,
  };
}
// Initialise from active profile
(function() {
  const profiles = JSON.parse(localStorage.getItem('cmm_profiles') || '[]');
  const activeId = localStorage.getItem('cmm_active_profile') || 'p1';
  const profile = profiles.find(p => p.id === activeId);
  _applyAvatarColors(profile?.pic ?? 0);
})();

// ── Sell values (gold per item) ──────────────────────────────────────
const SELL_VALUES = {
  // T1 Ingredients (1-2g)
  'Mushroom': 1,      'Rice': 1,          'Egg': 1,
  'Fresh Dew': 1,     'Clover Leaf': 1,   'Seaweed Noodle': 1,
  'Wildflower': 1,    'Bamboo Shoot': 2,  'Spice Dust': 2,
  'Honey Glob': 2,    'Dream Herb': 2,    'Fleece Cloud': 2,
  // T2 Rare ingredients (4-6g)
  'Sea Crystal': 4,   'Ice Shard': 4,     'Thunder Silk': 5,
  'Solar Berry': 4,   'Lunar Dust': 5,    'Magma Stone': 4,
  // T3 Legendary (8-12g)
  'Rainbow Shard': 10,'Dark Matter Fluff': 12,
  // 1★ Cooked Food (3g)
  'Mushroom Soup': 3, 'Rice Ball': 3,     'Scrambled Egg': 3,
  'Clover Salad': 3,  'Honey Dew': 3,     'Steamed Rice': 3,
  'Herb Tea': 3,
  // 2★ Cooked Food (7g)
  'Egg Rice Bowl': 7,          'Mushroom Stir Fry': 7,
  'Sweet Honey Rice': 7,       'Wild Petal Salad': 7,
  'Seaweed Egg Soup': 7,       'Frost Berry Pudding': 8,
  'Spiced Mushroom Broth': 7,  'Bamboo Dumplings': 7,
  'Honey Glazed Egg': 7,       'Coral Crystal Stew': 8,
  // 3★ Cooked Food (14-20g)
  'Thunder Silk Noodles': 14,  'Moon Herb Elixir': 15,
  'Rainbow Congee': 18,        'Cloud Fleece Bun': 15,
  'Solar Egg Feast': 16,       'Void Truffle Soup': 17,
  'Magma Stone Hotpot': 16,    'Prism Honey Cake': 18,
  'Ice Crystal Ramen': 14,     'Dream Petal Brew': 15,
  'Fleece Rice Porridge': 16,  'Grand Feast Platter': 20,
  'Dreamland Omakase': 25,
};

// ── Witty food descriptions ────────────────────────────────
const FOOD_LORE = {
  'Mushroom Soup':        "Humble beginnings. The void judges not your taste, only your survival.",
  'Rice Ball':            "Compact. Efficient. A little sad, like eating alone during a nightmare.",
  'Scrambled Egg':        "Your companion watched you make this. They\'re politely concerned.",
  'Clover Salad':         "You picked these yourself. Probably still has dirt in it. +Vibe.",
  'Honey Dew':            "Sweet, strange, and slightly glowing. Definitely fine.",
  'Steamed Rice':         "The chef\'s answer: more rice. The companion\'s answer: also more rice.",
  'Herb Tea':             "Smells like the forest after rain. Feels like a warm hug from a fern.",
  'Egg Rice Bowl':        "Breakfast? Dinner? Time is void. Eat.",
  'Mushroom Stir Fry':    "The sizzle echoed across the darkness. Something stirred. It was hunger.",
  'Sweet Honey Rice':     "Gold-adjacent. The merchant approves of this lifestyle.",
  'Wild Petal Salad':     "Your companion ate the petals first. You had to start over.",
  'Seaweed Egg Soup':     "The ocean is far away, yet here we are. Life is mysterious.",
  'Frost Berry Pudding':  "Cold to the bite, warm in the heart. Also your fingers are numb.",
  'Spiced Mushroom Broth':"A nightmare walked through the aroma. It chose not to attack today.",
  'Bamboo Dumplings':     "Eight per batch. Your companion counted. They ate none. Suspicious.",
  'Honey Glazed Egg':     "This is art. Don\'t eat it. You already ate it, didn\'t you.",
  'Coral Crystal Stew':   "Contains real crystals? Surprisingly nutritious. Crunchy.",
  'Thunder Silk Noodles': "Slurp with intent. Lightning doesn\'t strike the same noodle twice.",
  'Moon Herb Elixir':     "Nightmares avoid this scent. Your companion loves it a little too much.",
  'Rainbow Congee':       "Every colour is a different flavour. You don\'t know which is which. Delightful.",
  'Cloud Fleece Bun':     "Softer than a dream. Your jaw is confused. Your heart is not.",
  'Solar Egg Feast':      "The sun, captured in a shell. You feel invincible. You are not, but still.",
  'Void Truffle Soup':    "Made from something that shouldn\'t exist. Tastes like forbidden knowledge.",
  'Magma Stone Hotpot':   "Lava-temperature. Companion backed away slowly. Medic recommended.",
  'Prism Honey Cake':     "Tastes like all 7 emotions at once. You only wanted 3.",
  'Ice Crystal Ramen':    "Perfectly balanced, as all noodles should be. Brought inner peace.",
  'Dream Petal Brew':     "You sipped it. The nightmares blinked. Something has changed.",
  'Fleece Rice Porridge': "Impossibly fluffy. You skipped an entire night of terror. Worth it.",
  'Grand Feast Platter':  "For when survival isn\'t enough. You deserve this. The void disagrees.",
  'Dreamland Omakase':    "A legendary meal from a legendary chef who may or may not be real.",
};

// ── Cosmetic Structures (20 decorative decor items) ───────────────
const COSMETIC_DEFS = [
  { id: 'oak_tree',      icon: '🌳', name: 'Oak Tree',        cost: 20, r: 0.4  },
  { id: 'pine_tree',     icon: '🌲', name: 'Pine Tree',        cost: 18, r: 0.4  },
  { id: 'palm_tree',     icon: '🌴', name: 'Palm Tree',        cost: 22, r: 0.35 },
  { id: 'cactus',        icon: '🌵', name: 'Cactus',           cost: 12, r: 0.3  },
  { id: 'cherry_bloom',  icon: '🌸', name: 'Cherry Blossom',   cost: 28, r: 0.45 },
  { id: 'giant_mush',    icon: '🍄', name: 'Giant Mushroom',   cost: 15, r: 0.3  },
  { id: 'fern_patch',    icon: '🌿', name: 'Fern Patch',       cost: 8,  r: 0.25 },
  { id: 'flower_pot',    icon: '🌷', name: 'Flower Pot',       cost: 8,  r: 0.2  },
  { id: 'sunflower',     icon: '🌻', name: 'Sunflower',        cost: 10, r: 0.25 },
  { id: 'hibiscus',      icon: '🌺', name: 'Hibiscus Bush',    cost: 12, r: 0.3  },
  { id: 'mossy_rock',    icon: '🪨', name: 'Mossy Rock',       cost: 12, r: 0.3  },
  { id: 'log_bench',     icon: '🪵', name: 'Log Bench',        cost: 15, r: 0.35 },
  { id: 'paper_lantern', icon: '🏮', name: 'Paper Lantern',    cost: 18, r: 0.2  },
  { id: 'candle_post',   icon: '🪔', name: 'Candle Post',      cost: 10, r: 0.2  },
  { id: 'fountain',      icon: '⛲', name: 'Stone Fountain',   cost: 30, r: 0.45 },
  { id: 'planter',       icon: '🪴', name: 'Hanging Planter',  cost: 12, r: 0.2  },
  { id: 'clay_vase',     icon: '🏺', name: 'Clay Vase',        cost: 10, r: 0.2  },
  { id: 'bamboo_grove',  icon: '🎋', name: 'Bamboo Grove',     cost: 16, r: 0.4  },
  { id: 'moon_shrine',   icon: '🌙', name: 'Moon Shrine',      cost: 35, r: 0.35 },
  { id: 'wood_fence',   icon: '🧱', name: 'Wooden Fence',      cost: 10, r: 0.2  },
  // New 30 structures
  { id: 'tulip_patch',     icon: '🌷', name: 'Tulip Patch',        cost: 10, r: 0.28 },
  { id: 'lavender_bush',   icon: '💜', name: 'Lavender Bush',       cost: 12, r: 0.28 },
  { id: 'mushroom_ring',   icon: '🍄', name: 'Fairy Ring',          cost: 14, r: 0.35 },
  { id: 'lotus_pond',      icon: '🪷', name: 'Lotus Pond',          cost: 22, r: 0.40 },
  { id: 'bonsai',          icon: '🌳', name: 'Bonsai Tree',         cost: 20, r: 0.30 },
  { id: 'wildflower_bed',  icon: '🌼', name: 'Wildflower Bed',      cost: 10, r: 0.32 },
  { id: 'clover_patch',    icon: '🍀', name: 'Clover Patch',        cost: 8,  r: 0.25 },
  { id: 'pine_sapling',    icon: '🌲', name: 'Pine Sapling',        cost: 8,  r: 0.28 },
  { id: 'garden_chair',    icon: '🪑', name: 'Garden Chair',        cost: 12, r: 0.28 },
  { id: 'garden_swing',    icon: '🎪', name: 'Garden Swing',        cost: 18, r: 0.40 },
  { id: 'bird_bath',       icon: '🐦', name: 'Bird Bath',           cost: 16, r: 0.30 },
  { id: 'scarecrow',       icon: '🌾', name: 'Scarecrow',           cost: 14, r: 0.30 },
  { id: 'stone_well',      icon: '🪣', name: 'Stone Well',          cost: 24, r: 0.38 },
  { id: 'barrel',          icon: '🪵', name: 'Wooden Barrel',       cost: 8,  r: 0.22 },
  { id: 'crate_stack',     icon: '📦', name: 'Crate Stack',         cost: 10, r: 0.28 },
  { id: 'hammock',         icon: '🛌', name: 'Hammock',             cost: 16, r: 0.42 },
  { id: 'fairy_ring',      icon: '✨', name: 'Fairy Circle',        cost: 18, r: 0.35 },
  { id: 'crystal_cluster', icon: '💎', name: 'Crystal Cluster',     cost: 22, r: 0.32 },
  { id: 'dream_orb',       icon: '🔮', name: 'Dream Orb',           cost: 28, r: 0.30 },
  { id: 'torch_stand',     icon: '🔥', name: 'Torch Stand',         cost: 12, r: 0.22 },
  { id: 'wind_chime',      icon: '🎐', name: 'Wind Chime',          cost: 14, r: 0.28 },
  { id: 'star_post',       icon: '⭐', name: 'Star Post',           cost: 16, r: 0.22 },
  { id: 'stone_arch',      icon: '🪨', name: 'Stone Arch',          cost: 30, r: 0.45 },
  { id: 'garden_wall_low', icon: '🧱', name: 'Low Garden Wall',     cost: 12, r: 0.32 },
  { id: 'stone_pillar',    icon: '🗿', name: 'Stone Pillar',        cost: 14, r: 0.24 },
  { id: 'sundial',         icon: '☀️', name: 'Sundial',             cost: 20, r: 0.30 },
  { id: 'stepping_stones', icon: '🪨', name: 'Stepping Stones',     cost: 10, r: 0.35 },
  { id: 'beehive',         icon: '🐝', name: 'Beehive',             cost: 14, r: 0.28 },
  { id: 'windmill',        icon: '🌀', name: 'Decorative Windmill', cost: 25, r: 0.40 },
  { id: 'treasure_chest',  icon: '🗝️', name: 'Treasure Chest',     cost: 20, r: 0.30 },

  // ── 10 House designs (Cottage / Cabin / Manor / Pagoda / etc.) ──
  // Bigger footprints than typical decor; sizes (r) reflect real estate.
  { id: 'house_cottage',    icon: '🏠', name: 'Cozy Cottage',         cost:  60, r: 0.55 },
  { id: 'house_red_roof',   icon: '🏡', name: 'Red-Roof Home',        cost:  65, r: 0.55 },
  { id: 'house_row',        icon: '🏘️', name: 'Cottage Row',          cost:  85, r: 0.70 },
  { id: 'house_hut',        icon: '🛖', name: 'Thatched Hut',         cost:  45, r: 0.45 },
  { id: 'house_lantern',    icon: '🏮', name: 'Lantern House',        cost:  70, r: 0.50 },
  { id: 'house_shrine',     icon: '⛩️', name: 'Garden Shrine',        cost:  80, r: 0.50 },
  { id: 'house_pagoda',     icon: '🏯', name: 'Tiered Pagoda',        cost:  95, r: 0.55 },
  { id: 'house_temple',     icon: '🛕', name: 'Stone Temple',         cost:  90, r: 0.55 },
  { id: 'house_castle',     icon: '🏰', name: 'Tiny Castle',          cost: 110, r: 0.60 },
  { id: 'house_hall',       icon: '🏛️', name: 'Pillared Hall',        cost: 100, r: 0.55 },
];

// ── Append crafted-prop placement entries ──────────────────────────────
// After a player crafts a prop (Stone Well, Mood Lantern, etc.) we add a
// placeable token to their cosmetic inventory so they can drop it into the
// world via Edit Mode. Each entry uses a `cp_` prefix to avoid colliding
// with existing decor that shares a name (the merchant sells a stone_well
// decor item). The `isCraftProp` tag tells the placement code to skip the
// generic decor achievements — those count actual cottage-core decor only.
GAME_DATA.craftProps.forEach(p => {
  // Skip cooking_station — `this.cookingStation` is already a fixed
  // movable structure in the world; crafting it is just an unlock gate.
  if (p.id === 'cooking_station') return;
  COSMETIC_DEFS.push({
    id:          `cp_${p.id}`,
    icon:        p.icon,
    name:        p.name,
    cost:        0,             // already paid for via crafting materials
    r:           0.34,
    isCraftProp: true,
    propId:      p.id,
  });
});

window.COSMETIC_DEFS = COSMETIC_DEFS;

class Game extends Engine {
  constructor() {
    super('game-canvas');
    
    // Initialize world
    this.world = new World();
    
    // Initialize entities
    this.player = new Player(0, 0, {
      name: "Player",
      startHp: GAME_DATA.player.startHp,
      maxHp: GAME_DATA.player.maxHp,
      personality: Game._getProfileTrait()
    });
    this.player.stats.happy = GAME_DATA.player.startHappiness;

    // Notify companions when player is hit
    this.player.onDamaged = () => {
      const nearestNm = this.nightmares.filter(n => !n.isDead)
        .sort((a, b) => Math.hypot(a.x - this.player.x, a.y - this.player.y) - Math.hypot(b.x - this.player.x, b.y - this.player.y))[0];
      if (nearestNm) {
        for (const c of this.companions) c._onPlayerAttacked(nearestNm);
        // Bramble Hedgehog: reflect damage onto the attacker on contact
        const reflect = this.perkBonuses.reflectDamage || 0;
        if (reflect > 0 && Math.hypot(nearestNm.x - this.player.x, nearestNm.y - this.player.y) < 1.6) {
          nearestNm.takeDamage(Math.max(1, Math.floor(reflect)));
          if (nearestNm.isDead) this.ach.inc('hedgehog_revenge');
        }
      }
    };

    this.companions = [];
    this._newlyPlacedStructure = null; // curiosity target for companions
    this.nightmares = [];
    this._nightmareWarnings = []; // Starlight Owl: pending spawns shown as warnings for N seconds
    this.items = [];
    
    // Track which companion types we've collected (by id)
    this.collectedCompanionIds = new Set();
    
    // Companion inventory: id -> count (for duplicate stacking / tier conversion)
    this.companionInventory = {};
    
    // Max companions based on level
    this.getMaxDeployedCompanions = () => getMaxCompanions(this.player.stats.level);

    // Auto-save timer (every 30 seconds)
    this.autoSaveTimer = 30;

    /** @type {number} */
    this.eatSfxTimer = 0;
    
    // ── Achievement System ──────────────────────────────
    this.ach = new AchievementTracker();
    this._achToastQueue = [];   // queued achievement toasts
    this._achToastTimer  = 0;
    this._achNotif       = null; // canvas-drawn notification { icon, label, name, sub, timer, maxTimer }
    this._bossNightNotif = null; // { timer, maxTimer } — full-screen boss warning
    this._duskWarned     = false; // per-day dusk warning flag
    this._ambientPhase   = null;  // 'day'|'night' for ambient audio
    this._ambientTimer   = null;
    this._legacyNmSlow   = 1;     // nightmare spawn interval multiplier from legacy perks
    this._pendingModal = null; // { entity, menuId, stopOffset, threshold } — walk-to-open-UI queue

    // ── Gold Economy ────────────────────────────────────
    this.gold = 0;
    this.totalGoldEarned = 0;
    this.totalGoldSpent  = 0;
    this.tradeCount      = 0;
    this.packCount       = 0;
    this.rareBoughtCount = 0;

    // ── Merchant ────────────────────────────────────────
    this.merchant        = null;   // Merchant entity (null when not on map)
    this.merchantTimer   = 0;      // when > 0 merchant is scheduled to arrive
    this.merchantPresent = false;
    this.MERCHANT_ARRIVE_TIME = 3;   // Arrive very early in the day
    this._merchantScaredRun  = false; // merchant running to camp at night

    // ── Merchant Camp ────────────────────────────────────
    this.merchantCamp = new MerchantCamp(-2.4, -2.4);

    // ── Crafting ────────────────────────────────────────
    this.builtProps = {};  // propId -> true
    this.craftProgress = {}; // propId -> count
    this._lastPlayTime   = 0;
    
    // Perk bonuses calculated from deployed companions
    this.perkBonuses = {};

    // No starting Compy at construction — the intro sequence (or a loaded
    // save) is the only source of the player's first companion. loadGame()
    // resets `this.companions = []` and rebuilds from save data, and
    // _startNewGame() routes through the intro picker which calls
    // _grantStartingCompy() with the chosen species.

    // ── Campfire (permanent fixture at origin) ────────────────────
    this.campfire = new Campfire();

    // ── Story state (per-run, save schema v4) ─────────────────────
    // Legacy story (cross-run progress) loaded later by _loadLegacy().
    this.story       = this._defaultRunStory();
    this.legacyStory = this._defaultLegacyStory();

    // ── Children NPC manager ─────────────────────────────────────
    this.children = new ChildrenManager(this);
    // EditMode was constructed before the manager — register the 6 child camps
    // so they show up as movable structures.
    this.editMode?.registerChildCamps?.();

    // ── Memory Shard trigger engine ──────────────────────────────
    this.shardSystem = new ShardSystem(this);

    // ── Finale director (queues + plays "She Remembered" scene) ──
    this.finale = new FinaleDirector(this);

    // ── Story audio (auto-wires shard SFX to cmm:shard-unlocked) ──
    wireStoryAudio();

    // ── Cooking Station (placed in level-3 expansion zone) ────────
    this.cookingStation = new CookingStation();

    // ── Edit Mode ───────────────────────────────────────────────
    this.editMode = new EditMode(this);

    // ── Unlocked cooking recipe tiers (1 = Tier 1 unlocked by default) ──
    this.unlockedCookTiers = new Set([1]);

    // ── Attack VFX / Bullet pool ────────────────────────
    this.attackVFXList = [];
    this.bullets = [];
    this.specialVFX = []; // chain lightning, shield cast bursts
    this._pickupFloats = []; // floating item-pickup notifications
    this._itemPoofs = [];    // small pastel bursts when items magnet into the player
    this._celebrations = []; // task-completion confetti bursts
    this._invDroppedRefs = new Set(); // items dropped from inventory (pending cooldown)

    // ── Cosmetic structure inventory (id → count) ───────────
    this.cosmeticInventory = {};

    // ── Fountain happiness regen tick ─────────────
    this._fountainHappyTimer  = 120;

    // ── Junk system ─────────────────────────────────────
    this.junks = [];
    this._junkSpawnTimer = 20; // first junk spawns after 20s
    this._junkCleanTarget = null; // junk player is currently cleaning
    this._junkCleanProgress = 0;
    this._junkDayCount = 0; // junks cleaned today

    // ── Quote display state ──────────────────────────────
    this._usedQuoteIndices = new Set();
    this._quoteDisplay = { text: '', timer: 0, maxTime: 8 };

    // ── Butterfly particles ──────────────────────────────
    this._butterflies = [];
    this._butterflySpawnTimer = 0;

    // ── Level-up cinematic state ─────────────────────────
    this._levelUpAnim = {
      active: false,
      timer: 0,
      duration: 3.5,
      newLevel: 1,
      ringRadius: 0,
      maxRingRadius: 0,
      startZoom: 1.44,
      startCamX: 0,
      startCamY: 0,
    };

    // Recalculate perks based on deployed companions
    this.recalculatePerks();

    this.entities = [this.player, ...this.companions, ...this.nightmares, ...this.items];

    // Time & Cycle
    this.time = {
      phase: 'Day', // Day or Night
      seconds: 0,
      dayCount: 1,
      multiplier: 1, // 1 real time. Use 't' to speed up
      nextSpawn: 0
    };
    
    // UI bindings
    this.ui = {
      hp: document.getElementById('bar-hp'),
      hpVal: document.getElementById('val-hp'),
      hunger: document.getElementById('bar-hunger'),
      hungerVal: document.getElementById('val-hunger'),
      thirst: document.getElementById('bar-thirst'),
      thirstVal: document.getElementById('val-thirst'),
      happy: document.getElementById('bar-happy'),
      happyVal: document.getElementById('val-happy'),
      level: document.getElementById('info-level')
    };

    // Follow camera init - adjust for mobile (20% closer than before)
    const isMobile = window.innerWidth <= 480;
    this.camera.zoom = isMobile ? 1.08 : 1.44; // was 0.9/1.2 × 1.2
    
    // Keyboard controls for demo/cheats
    window.addEventListener('keydown', (e) => {
      // Cheat level up to show light expanding
      if (e.key === 'l' || e.key === 'L') {
        if(this.player.stats.level < 50) {
          this.player.stats.level++;
        }
      }
      if (e.key === 't' || e.key === 'T') {
        this.time.multiplier = this.time.multiplier === 1 ? 60 : 1; // 60x speed
      }
    });

    // Drag-to-move + edit mode drag
    this._dragMove = false;
    this.canvas.addEventListener('pointermove', (e) => {
      if (this.editMode?.active) {
        const ts = this.world.tileSize;
        const cx = (this.input.worldX / ts + this.input.worldY / (ts/2)) / 2;
        const cy = (this.input.worldY / (ts/2) - this.input.worldX / ts) / 2;
        this.editMode.handleMove(e.clientX, e.clientY, cx, cy);
        return;
      }
      // Drag-to-move: while pointer held, continuously walk toward drag position
      if (this._dragMove && e.buttons > 0 && !this._levelUpAnim?.active && !this.player.isCleaningJunk) {
        const ts = this.world.tileSize;
        const calcX = (this.input.worldX / ts + this.input.worldY / (ts / 2)) / 2;
        const calcY = (this.input.worldY / (ts / 2) - this.input.worldX / ts) / 2;
        const tapWalk = this._clampToWalkable(calcX, calcY, getLevelLightRadius(this.player.stats.level));
        this.player.targetX = tapWalk.x;
        this.player.targetY = tapWalk.y;
        this.player.pickupItemTarget = null;
        this.player.isAuto = false;
        this.player.noteManualControl?.();
      }
    });
    this.canvas.addEventListener('pointerup', () => {
      this._dragMove = false;
      if (this.editMode?.active) this.editMode.handleUp();
    });
    this.canvas.addEventListener('pointercancel', () => { this._dragMove = false; });

    // Mobile click / Desktop click to move / interact
    this.canvas.addEventListener('pointerdown', (e) => {
      // Only the level-up cinematic blocks ALL input
      if (this._levelUpAnim.active) return;

      const ts = this.world.tileSize;
      const calcX = (this.input.worldX / ts + this.input.worldY / (ts/2)) / 2;
      const calcY = (this.input.worldY / (ts/2) - this.input.worldX / ts) / 2;

      // ── Edit mode intercepts all canvas input ─────────────
      if (this.editMode?.active) {
        this.editMode.handleDown(e.clientX, e.clientY, calcX, calcY);
        return;
      }

      this.ach.inc('taps');
      this._checkSpeedTapper();

      // Track latest input for T4.3 inaction timer.
      this.children?.noteInputActivity?.();

      // ── Merchant: tap to walk to them, shop opens on arrival ──────
      if (this.merchant && !this.merchant.isDead) {
        if (Math.hypot(this.merchant.x - calcX, this.merchant.y - calcY) < 0.35) {
          this.merchant.tapBobble = 1.0;
          this._queueModalWalk(this.merchant, 'merchant', 1.0);
          return;
        }
      }

      // ── Child NPC: tap to walk-to-open task dialog ────────────────
      if (this.children) {
        for (const ch of this.children.list) {
          if (ch.phase !== 'PRESENT') continue;
          if (Math.hypot(ch.x - calcX, ch.y - calcY) < 0.45) {
            ch.tapBobble = 1.0;
            // Finale routing — during the Circle stage, taps show final lines instead.
            if (this.finale?.handleChildTap?.(ch.childIdx)) return;
            this._queueModalWalk(ch, `child-${ch.childIdx}`, 0.9, 1.2);
            // Side-channel taps for T5.1 (3 in 5s) and T5.3 (after 1 day).
            const helpers = this.children._taskTickerHelpers;
            if (ch.childIdx === 4 && helpers) {
              const arr = helpers.get('T5.1', 'taps', []);
              const now = Date.now();
              arr.push(now);
              while (arr.length && now - arr[0] > 5000) arr.shift();
              helpers.set('T5.1', 'taps', arr);
              helpers.bump('T5.3', 'taps', 1);
            }
            // Tap-on-N-days bookkeeping for T6.1 / T1.1.
            if (ch.childIdx === 5 || ch.childIdx === 0) {
              if (!this.children._tapDayMarks) this.children._tapDayMarks = {};
              const marks = this.children._tapDayMarks[ch.childIdx]
                          = (this.children._tapDayMarks[ch.childIdx] || new Set());
              marks.add(this.time?.dayCount || 1);
            }
            return;
          }
        }
      }

      // ── Companion: tap directly on them to pet ────────────────────
      if (!this.player.isPetting) {
        for (const c of this.companions) {
          if (Math.hypot(c.x - calcX, c.y - calcY) < 0.45) {
            c.tapBobble = 1.0;
            if (c.petCooldown > 0) { c.showEmote('😊', 1.0); return; }
            this.player.petTarget = c;
            this.player.targetEntity = null;
            this.player.pickupItemTarget = null;
            this._pendingModal = null;
            this.player.onPetComplete = (companion) => {
              const wasSad = companion.needsPetting === true;
              if (companion.pet()) {
                this.player.showEmote('🤗', 1.5);
                this.player.stats.happy = Math.min(100, this.player.stats.happy + this._modHappyGain(2, true));
                this._grantXP(3);
                this.ach.inc('comp_interact');
                this.ach.inc('comp_tap_prod');
                window.tutorialMark?.('pet_compy');
                // T5.4 — cheer up a sad companion by interacting with it.
                if (wasSad) this.children?._taskTickerHelpers?.set?.('T5.4', 'compyCheered', true);
              }
            };
            this.player.onPetStart = (companion) => { companion.startBeingPetted(); };
            this.player.isAuto = false;
            this.player.noteManualControl?.();
            clearTimeout(this.player.autoTimer);
            this.player.autoTimer = setTimeout(() => { this.player.isAuto = true; }, 5000);
            return;
          }
        }
      }

      // ── Junk: tap to start cleaning (return early) ───────────────
      for (const jk of this.junks) {
        if (jk.isDead) continue;
        if (Math.hypot(jk.x - calcX, jk.y - calcY) < 0.5 + (jk.level - 1) * 0.2) {
          this._junkCleanTarget = jk;
          this._junkCleanProgress = jk.cleanProgress * jk.cleanTime;
          // Clear any competing auto-actions so junk cleaning has full priority
          this.player.pickupItemTarget = null;
          this.player.petTarget        = null;
          this.player.targetEntity     = null;
          this._pendingModal           = null;
          const angle = Math.atan2(this.player.y - jk.y, this.player.x - jk.x);
          this.player.targetX = jk.x + Math.cos(angle) * 1.0;
          this.player.targetY = jk.y + Math.sin(angle) * 1.0;
          this.player.isAuto = false;
          this.player.noteManualControl?.();
          clearTimeout(this.player.autoTimer);
          this.player.autoTimer = setTimeout(() => { this.player.isAuto = true; }, 3000);
          return;
        }
      }
      // Cancel junk cleaning only if not actively in progress (player still walking to junk)
      if (this._junkCleanTarget && !this.player.isCleaningJunk) {
        this._junkCleanTarget = null;
        this._junkCleanProgress = 0;
      }
      // If mid-clean, block the tap entirely
      if (this.player.isCleaningJunk) return;

      // ── Default: ALWAYS move player to tapped position ────────────
      this._dragMove = true;
      this._pendingModal = null; // cancel any queued walk-to-open-UI intent
      const tapWalk = this._clampToWalkable(calcX, calcY, getLevelLightRadius(this.player.stats.level));
      this.player.targetX = tapWalk.x;
      this.player.targetY = tapWalk.y;
      this.player.pickupItemTarget = null;
      this.player.isAuto = false;
      this.player.noteManualControl?.();
      clearTimeout(this.player.autoTimer);

      // Nightmare targeting layered on top (player walks toward it)
      this.player.targetEntity = null;
      for (const n of this.nightmares) {
        if (!n.isDead && Math.hypot(n.x - calcX, n.y - calcY) < 0.3) {
          this.player.targetEntity = n;
          break;
        }
      }

      // Cooking station: if tapping near it, walk to its edge then open the cook menu
      if (this.cookingStation && !this.editMode?.stored?.cookingStation) {
        const stDist = Math.hypot(this.cookingStation.x - calcX, this.cookingStation.y - calcY);
        if (stDist < 0.9) {
          this.cookingStation.tapBobble = 1.0;
          this._queueModalWalk(this.cookingStation, 'cook', 1.05, 1.3);
        }
      }

      // Campfire: tap near (0,0) walks the player to the fire and shows a daily-warmth line.
      // Phase 4 will extend this with the Tend the Fire upgrade flow.
      if (this.campfire) {
        const cfDist = Math.hypot(this.campfire.x - calcX, this.campfire.y - calcY);
        if (cfDist < 0.9) {
          // Finale routing — campfire tap during the Circle stage skips the wait.
          if (this.finale?.handleCampfireTap?.()) return;
          this._queueModalWalk(this.campfire, 'campfire', 1.05, 1.3);
        }
      }

      this.player.autoTimer = setTimeout(() => { this.player.isAuto = true; }, 3000);
    });
  }

  // (Auto-walk-to-item logic removed — items now magnet to the player.
  //  See the magnet block inside Game.update().)

  // Pause check — true if any main game window/modal is currently visible.
  // Includes all the solo modals + the tutorial / death overlays so the
  // simulation always freezes while the player is reading any UI.
  _isMainWindowOpen() {
    const PAUSE_IDS = [
      'modal-passport', 'modal-inv', 'modal-craft', 'modal-tiers',
      'modal-ach', 'modal-merchant', 'modal-cook',
      'modal-perks', 'modal-struct', 'modal-tutorial', 'modal-death',
      'modal-settings',
    ];
    for (let i = 0; i < PAUSE_IDS.length; i++) {
      const m = document.getElementById(PAUSE_IDS[i]);
      if (m && m.style.display === 'flex') return true;
    }
    return false;
  }

  _isNightmareNearby(radius = 8) {
    return this.nightmares?.some(n => !n.isDead && Math.hypot(n.x - this.player.x, n.y - this.player.y) < radius);
  }

  // Speed tapper achievement helper
  _checkSpeedTapper() {
    const now = Date.now();
    if (!this._tapTimes) this._tapTimes = [];
    this._tapTimes.push(now);
    this._tapTimes = this._tapTimes.filter(t => now - t < 5000);
    if (this._tapTimes.length >= 10) this.ach.inc('speed_tapper');
  }

  update(dt) {
    this._lastDt = dt; // exposed for throttled per-frame helpers
    // Pause the simulation while any main window is open. Draw still runs
    // (the world renders its current frozen state) but no entity logic,
    // time-of-day, hunger/thirst decay, achievement ticks, etc. advance.
    if (this._isMainWindowOpen()) return;
    const timeStep = dt * this.time.multiplier;
    this.time.seconds += timeStep;

    // ── Achievement play-time ticking ───────────────────
    this.ach.tick(dt);

    // ── Day / Night cycle ──────────────────────────────
    // Dusk warning — 30 seconds before night
    if (this.time.phase === 'Day' && this.time.seconds >= 205 && !this._duskWarned) {
      this._duskWarned = true;
      this._achNotif = { icon: '🌙', label: 'DUSK WARNING', name: 'Night is falling…', sub: 'Prepare yourself!', timer: 3.5, maxTimer: 3.5 };
      this._playDuskBellSFX();
      window.tutorialMark?.('watch_dusk');
    }

    if (this.time.phase === 'Day' && this.time.seconds >= 235) {
      this.time.phase = 'Night';
      this.time.seconds = 0;
      this.time.nextSpawn = 5;
      if (this.merchant && !this._merchantScaredRun) {
        this._merchantScaredRun = true;
        this.merchant.showEmote('😱', 2.5);
        this.merchant.speed = 4.5;
      }
      this._bossSpawnedThisNight = false;
      // Mysterious nightfall chime — plays for every night, but skipped when
      // a boss-night warning fires (the boss SFX takes priority and would
      // otherwise muddy the mix).
      const nextDay = this.time.dayCount;
      const isBossNight = nextDay >= 5 && (nextDay - 1) % 5 === 0;
      if (isBossNight) {
        this._bossNightNotif = { timer: 5.0, maxTimer: 5.0 };
        this._playBossWarnSFX();
      } else {
        this._playNightfallChime();
      }
      this._startAmbientNight();
    } else if (this.time.phase === 'Night' && this.time.seconds >= 101) {
      this.time.phase = 'Day';
      this.time.seconds = 0;
      this.time.dayCount++;
      this.nightmares.forEach(n => n.state = 'retreat');
      this._nightmareWarnings.length = 0;   // cancel any pending Starlight Owl warnings at dawn
      this.ach.inc('nights');
      this.ach.inc('days');
      // Story bookkeeping: was this a boss night the player survived?
      this._lastNightWasBoss = !!this._bossSpawnedThisNight;
      if (this._lastNightWasBoss) {
        // T2.3 — survive a Void Titan with Child 2 present.
        const c2 = this.children?.list?.[1];
        if (c2 && c2.phase === 'PRESENT') {
          this.children?._taskTickerHelpers?.set?.('T2.3', 'survivedBoss', true);
        }
      }
      this._bossSpawnedThisNight = false;
      this._nightmaresFledThisNight = 0;
      this._untouchedThisNight = true;
      // Moon Ferret: reset the once-per-night ignore budget at dawn
      this._moonFerretIgnoresUsed = 0;
      this._junkDayCount = 0;
      this._duskWarned = false;
      this._merchantScaredRun = false;
      this.merchantCamp.merchantInside = false;
      this._spawnMerchantAtCamp();
      this.merchantPresent = true;
      this._showMerchantToast();
      this._startAmbientDay();
      // Sundrop Lizard (and stacking copies): daily happiness bonus on day rollover
      if (this.perkBonuses.dailyHappinessBonus) {
        this.player.stats.happy = Math.min(100, this.player.stats.happy + this._modHappyGain(this.perkBonuses.dailyHappinessBonus, false));
      }
    }

    // First day start (day 1)
    if (this.time.dayCount === 1 && this.time.phase === 'Day' && !this._day1tracked) {
      this._day1tracked = true;
      this.ach.set('days', 1);
    }

    // ── Merchant spawn (early day, only on day 1 since subsequent days handled at night→day) ──
    if (this.time.phase === 'Day' && this.time.dayCount === 1) {
      if (!this.merchantPresent && this.time.seconds >= this.MERCHANT_ARRIVE_TIME) {
        this._spawnMerchantAtCamp();
        this.merchantPresent = true;
        this._showMerchantToast();
      }
    }

    // ── Merchant scared run update ────────────────────────
    if (this._merchantScaredRun && this.merchant) {
      const campIso = this.world.toIso(this.merchantCamp.x, this.merchantCamp.y);
      const dx = this.merchantCamp.x - this.merchant.x;
      const dy = this.merchantCamp.y - this.merchant.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.25) {
        // Reached camp
        this.merchantCamp.merchantInside = true;
        this.merchant = null;
        this.merchantPresent = false;
      }
    }

    // Light radius
    let currentRadius = getLevelLightRadius(this.player.stats.level);
    if (this.time.phase === 'Night' && this.perkBonuses.lightPenaltyReduction) {
      currentRadius += currentRadius * this.perkBonuses.lightPenaltyReduction;
    }

    // ── Nightmare spawning (difficulty scales with days) ──────
    if (this.time.phase === 'Night') {
      this.time.nextSpawn -= timeStep;
      // Moonlight Lantern (rare item) suppresses spawns through the next dawn
      const moonlit = this._moonlightUntilDayCount && this.time.dayCount <= this._moonlightUntilDayCount;
      if (this.time.nextSpawn <= 0 && !moonlit) {
        // Night 1 = 2 nightmares max; +1 cap every 2 days; hard cap 10
        const maxEnemies = Math.min(2 + Math.floor((this.time.dayCount - 1) / 2), 10);
        const aliveCount = this.nightmares.filter(n => !n.isDead).length + this._nightmareWarnings.length;
        if (aliveCount < maxEnemies) {
          this._queueNightmareSpawn(currentRadius);
        }
        const baseInterval = Math.max(8, 25 - this.time.dayCount * 1.5);
        const happyMult  = this.player.stats.happy < 40 ? 0.72 : 1.0; // 28% faster when unhappy
        const legacyMult = this._legacyNmSlow || 1;
        this.time.nextSpawn = (baseInterval + Math.random() * 10) * happyMult * legacyMult;
      }
    }

    // ── Nightmare warning timers (Starlight Owl) ────────
    if (this._nightmareWarnings.length) {
      for (let i = this._nightmareWarnings.length - 1; i >= 0; i--) {
        const w = this._nightmareWarnings[i];
        w.timer -= timeStep;
        if (w.timer <= 0) {
          this.spawnNightmare(w.lightRadius, w.x, w.y);
          this._nightmareWarnings.splice(i, 1);
        }
      }
    }

    // ── Happiness Candle (rare item) tick ────────────────
    if (this._happinessCandleTimer && this._happinessCandleTimer > 0) {
      this._happinessCandleTimer -= timeStep;
    }

    // ── Prop active ability cooldowns ────────────────────
    this._tickPropAbilityCDs(dt);

    // ── Recipe timed buffs (ate cooked food → temporary stat changes) ──
    this._tickFoodBuffs(dt);

    // ── Passive prop perks (built-prop ticks) ──
    this._tickPropPassives(dt);

    // Companions now only obtained via Booster Packs from the Merchant


    // ── Clamp player target/position to walkable area ─────
    {
      const wp = this._clampToWalkable(this.player.targetX, this.player.targetY, currentRadius);
      this.player.targetX = wp.x; this.player.targetY = wp.y;
      const pp = this._clampToWalkable(this.player.x, this.player.y, currentRadius);
      this.player.x = pp.x; this.player.y = pp.y;
    }

    // ── Player update (locked during level-up cinematic and edit mode) ───
    if (!this._levelUpAnim.active && !this.editMode?.active) {
      this.player.update(dt, this.input, currentRadius, this);
      this._applyTraitEffects(dt);
    } else {
      // Still update visuals/timers but skip input
      if (this.player.hitFlashTimer > 0) this.player.hitFlashTimer -= dt;
    }

    // ── Happiness passive drains ────────────────────────
    // Night anxiety (gradual drain in darkness)
    if (this.time.phase === 'Night') {
      this.player.stats.happy = Math.max(0, this.player.stats.happy - 1.2 * timeStep);
    }
    // Low-HP anxiety drain
    if (this.player.stats.hp < this.player.stats.maxHp * 0.25) {
      this.player.stats.happy = Math.max(0, this.player.stats.happy - 0.8 * timeStep);
    }

    // ── Nightmare spawn faster at low happiness ─────────
    // (applied in nextSpawn calc below — stored as flag for the spawn block)

    // ── Happiness achievement tracking ─────────────────
    const happy = this.player.stats.happy;
    this.ach.max('max_happy', Math.floor(happy));
    if (happy >= 80) {
      this._happy80Acc = (this._happy80Acc || 0) + timeStep;
      this.ach.max('happy_80_time', Math.floor(this._happy80Acc));
    } else { this._happy80Acc = 0; }
    if (happy < 5) this.ach.inc('sad_5');

    // ── Hunger / Thirst tracking ───────────────────────
    if (this.player.stats.hunger >= 80) {
      this._hunger80Acc = (this._hunger80Acc || 0) + timeStep;
      this.ach.max('hunger_80_time', Math.floor(this._hunger80Acc));
    } else { this._hunger80Acc = 0; }
    if (this.player.stats.thirst >= 80) {
      this._thirst80Acc = (this._thirst80Acc || 0) + timeStep;
      this.ach.max('thirst_80_time', Math.floor(this._thirst80Acc));
    } else { this._thirst80Acc = 0; }
    if (this.player.stats.hunger <= 0) {
      this._starveAcc = (this._starveAcc || 0) + timeStep;
      this.ach.max('starve_survive_time', Math.floor(this._starveAcc));
    } else { this._starveAcc = 0; }

    // ── Item collection ────────────────────────────────
    if (this.player.pendingCollectedItem) {
      const ref = this.player.pendingCollectedItem;
      this.player.pendingCollectedItem = null;
      const idx = this.items.indexOf(ref);
      if (idx >= 0) {
        const item = this.items[idx];
        const itemName = item.itemName;
        // Spawn the poof at the item's last position before it disappears,
        // so the burst feels like the item itself bursting (not the player).
        this._spawnItemPoof(item.x, item.y);
        this._playItemPoofSFX();
        this.player.collectItem(item);
        this.items.splice(idx, 1);
        this._playPickupSFX();
        // Floating pickup notification
        const _pfd = getItemData(itemName);
        this._pickupFloats.push({ icon: _pfd.icon, name: itemName, wx: this.player.x, wy: this.player.y, timer: 0, life: 1.6 });
        // XP for picking up item
        this._grantXP(2);
        // Resource achievement counters
        this.ach.inc('resources');
        this.ach.inc('drops');
        const rcKey = RESOURCE_COUNTER_MAP[itemName];
        if (rcKey) this.ach.inc(rcKey);
        // Story task: T3.3 — pick up 5 dropped ingredients (raw drops only).
        if (this.children?._taskTickerHelpers) {
          const tier = (getItemData(itemName) || {}).tier;
          if (tier) this.children._taskTickerHelpers.bump('T3.3', 'picked', 1);
        }
        if (window.updateInventoryUI) window.updateInventoryUI(this.player.inventory);
        if (window.updateCookUI)      window.updateCookUI(this.player.inventory);
        window.tutorialMark?.('collect');
      }
    }

    // Eat SFX
    if (this.player.isEating && this.player.eatingTime > 0.38 && this.player.eatingTime < 1.85) {
      this.eatSfxTimer -= timeStep;
      if (this.eatSfxTimer <= 0) { this.playEatCrunchSfx(); this.eatSfxTimer = 0.42; }
    }

    // ── Entity updates ─────────────────────────────────
    for (let c of this.companions) {
      c.update(dt * this.time.multiplier, this.player, currentRadius, this);
      // Push companions out of structure zones
      const cp = this._clampToWalkable(c.x, c.y, currentRadius);
      c.x = cp.x; c.y = cp.y;
    }

    // ── Pet-chase timeout: abandon petTarget if player can't reach it in 8s ──
    if (this.player.petTarget && !this.player.isPetting) {
      this._petChaseTimer = (this._petChaseTimer || 0) + dt;
      if (this._petChaseTimer > 8) {
        const staleTarget = this.player.petTarget;
        if (staleTarget) staleTarget.beingPetted = false;
        this.player.petTarget = null;
        this.player.onPetStart = null;
        this.player.onPetComplete = null;
        this._petChaseTimer = 0;
      }
    } else {
      this._petChaseTimer = 0;
    }

    // ── Auto-idle: instantly mark idle when player stops moving with no pending actions ──
    if (!this.player.isAuto &&
        !this.player.isWalking && !this.player.isPetting &&
        !this.player.isEating && !this.player.isPickingUp &&
        !this.player.petTarget && !this.player.targetEntity &&
        !this._junkCleanTarget) {
      clearTimeout(this.player.autoTimer);
      this.player.isAuto = true;
    }

    // ── Player auto-pets nearby companions occasionally ────
    // Prioritise companions that "needsPetting" (not petted in a long time)
    if (this.player.isAuto && !this.player.petTarget && !this.player.isCleaningJunk &&
        !this._junkCleanTarget &&
        !this.player.isPetting && !this.player.isPickingUp && !this.player.isEating) {

      // Check for a needy companion first — faster response (every 5s)
      this._autoPetNeedyTimer = (this._autoPetNeedyTimer || 0) - dt;
      if (this._autoPetNeedyTimer <= 0) {
        this._autoPetNeedyTimer = 5;
        // Nightmares nearby: 50% chance to suppress auto-pet this tick.
        if (this._isNightmareNearby() && Math.random() < 0.5) { /* skip */ }
        else {
        let needyTarget = null, needyDist = 10.0; // wider radius for needy compys
        for (const c of this.companions) {
          if (c.needsPetting && !c.beingPetted && !c.isKO) {
            const d = Math.hypot(c.x - this.player.x, c.y - this.player.y);
            if (d < needyDist) { needyTarget = c; needyDist = d; }
          }
        }
        if (needyTarget) {
          this.player.petTarget = needyTarget;
          this.player.targetEntity = null;
          this.player.pickupItemTarget = null;
          this.player.onPetStart = (comp) => comp.startBeingPetted();
          this.player.onPetComplete = (comp) => {
            if (comp.pet()) {
              this.player.showEmote('🤗', 1.5);
              this.player.stats.happy = Math.min(100, this.player.stats.happy + this._modHappyGain(2, true));
              this._grantXP(3);
              this.ach.inc('comp_interact');
              this.ach.inc('comp_tap_prod');
              window.tutorialMark?.('pet_compy');
            }
          };
        }
        } // end nightmare-nearby else
      }

      // Regular auto-pet (lower priority, only if no needy comp was found)
      if (!this.player.petTarget) {
        this._autoPetTimer = (this._autoPetTimer || 0) - dt;
        if (this._autoPetTimer <= 0) {
          this._autoPetTimer = 12 + Math.random() * 10; // next check in 12-22s
          // Nightmares nearby: 50% chance to suppress auto-pet this tick.
          if (!(this._isNightmareNearby() && Math.random() < 0.5)) {
          // Find nearest pettable companion within 6 tiles
          let nearest = null, nearDist = 6.0;
          for (const c of this.companions) {
            if (c.petCooldown <= 0 && !c.beingPetted && !c.isKO) {
              const d = Math.hypot(c.x - this.player.x, c.y - this.player.y);
              if (d < nearDist) { nearest = c; nearDist = d; }
            }
          }
          if (nearest) {
            this.player.petTarget = nearest;
            this.player.targetEntity = null;
            this.player.pickupItemTarget = null;
            this.player.onPetStart = (comp) => comp.startBeingPetted();
            this.player.onPetComplete = (comp) => {
              if (comp.pet()) {
                this.player.showEmote('🤗', 1.5);
                this.player.stats.happy = Math.min(100, this.player.stats.happy + 2);
                this._grantXP(3);
                this.ach.inc('comp_interact');
                this.ach.inc('comp_tap_prod');
              }
            };
          }
          } // end nightmare-nearby guard
        }
      }
    } else if (!this.player.isAuto) {
      this._autoPetTimer = 8; // reset timer when player takes manual control
      this._autoPetNeedyTimer = 5;
    }

    for (let n of this.nightmares) {
      n.update(dt * this.time.multiplier, this.player, currentRadius, this);
      // Push nightmares out of structure zones (they can't walk through them)
      const np = this._clampToWalkable(n.x, n.y, currentRadius + 5);
      n.x = np.x; n.y = np.y;
    }
    if (this.merchant) this.merchant.update(dt, currentRadius);
    if (this.merchantCamp) this.merchantCamp.update(dt);

    // ── Nightmare cleanup + kill tracking ─────────────
    // _untouchedThisNight is reset to true at night→day transition
    // Ingredient pool for nightmare drops
    const NM_INGREDIENT_POOL = [
      'Mushroom','Rice','Egg','Fresh Dew','Clover Leaf','Spice Dust',
      'Honey Glob','Dream Herb','Wildflower','Bamboo Shoot','Seaweed Noodle','Fleece Cloud'
    ];
    for (let i = this.nightmares.length - 1; i >= 0; i--) {
      const n = this.nightmares[i];
      if (n.isDead) {
        // Start 2-second dissipation timer on freshly-killed nightmares
        if (n._dissipateTimer === undefined) {
          // Trigger rewards immediately on death
          n._dissipateTimer = 2.0;
          // XP for defeating nightmare
          const nmXp = n.isBoss ? 50 : (n.special ? 10 : 5);
          this._grantXP(nmXp);
          if (n.isBoss) {
            // Boss: guaranteed rare + ingredient drops + gold reward
            const RARE_POOL = ['Lunar Dust','Stardust Feather','Rainbow Shard','Prism Pollen','Dark Matter Fluff'];
            this.spawnItem(n.x, n.y, RARE_POOL[Math.floor(Math.random() * RARE_POOL.length)]);
            this.spawnItem(n.x + 0.5, n.y, NM_INGREDIENT_POOL[Math.floor(Math.random() * NM_INGREDIENT_POOL.length)]);
            this.spawnItem(n.x - 0.5, n.y + 0.3, NM_INGREDIENT_POOL[Math.floor(Math.random() * NM_INGREDIENT_POOL.length)]);
            this.gold += 25;
            this._achNotif = { icon: '👹', label: 'BOSS DEFEATED', name: 'Void Titan slain!', sub: '+25g · Rare loot dropped!', timer: 4.5, maxTimer: 4.5 };
            this.ach.inc('boss_killed');
          } else {
            // Regular: 50% chance ingredient drop, +luck. Clover Bunny adds +N% chance.
            const dropChance = 0.5 + (this.perkBonuses.luckBonus || 0);
            if (Math.random() < dropChance) {
              this.spawnItem(n.x, n.y, NM_INGREDIENT_POOL[Math.floor(Math.random() * NM_INGREDIENT_POOL.length)]);
              // Luck bonus: small chance to upgrade a regular drop to a rare T3+ drop
              if ((this.perkBonuses.luckBonus || 0) > 0 && Math.random() < (this.perkBonuses.luckBonus * 2)) {
                const RARE_LUCK_POOL = ['Sea Crystal','Solar Berry','Ice Shard','Bamboo Shoot'];
                this.spawnItem(n.x + 0.4, n.y - 0.2, RARE_LUCK_POOL[Math.floor(Math.random() * RARE_LUCK_POOL.length)]);
              }
            }
          }
          // Achievement counters
          this.ach.inc('nm_killed');
          const nKey = NIGHTMARE_COUNTER_MAP[n.id];
          if (nKey) this.ach.inc(nKey);
          // Low HP brave heart
          if (this.player.stats.hp <= 10) this.ach.inc('brave_heart');
          window.tutorialMark?.('survive_nm');
        } else {
          // Tick dissipation timer
          n._dissipateTimer -= timeStep;
          if (n._dissipateTimer <= 0) {
            this.nightmares.splice(i, 1);
          }
        }
      } else if (n.state === 'retreat') {
        if (Math.hypot(n.x, n.y) > currentRadius + 20) this.nightmares.splice(i, 1);
      } else {
        // Nightmare attacked player - mark not untouched
        if (n.attackTimer < 1.4) this._untouchedThisNight = false;
      }
    }

    // Untouched night check at end of night
    if (this.time.phase === 'Day' && this._nightTracked !== this.time.dayCount) {
      this._nightTracked = this.time.dayCount;
      if (this._untouchedThisNight) this.ach.inc('untouched_night');
      this._untouchedThisNight = true;
    }

    for (let item of this.items) item.update(dt);

    // ── Magnet pickup ─────────────────────────────────────────
    // Items within range FLY toward the player; the closer they are, the
    // faster they go (quadratic ease-in). On contact the existing collection
    // pipeline (player.pendingCollectedItem) takes over, so all the SFX /
    // achievement / inventory hookups still fire as before.
    {
      const p = this.player;
      if (!p.isDead) {
        const MAG_RANGE     = 4.5;            // tiles — items inside start sucking
        const MAG_RANGE_SQ  = MAG_RANGE * MAG_RANGE;
        const PICKUP_DIST_SQ = 0.45 * 0.45;   // touch radius
        const BASE_SPEED    = 0.75;           // tiles/s at edge of range (50% slower)
        const PEAK_SPEED    = 8.0;            // tiles/s near the player (50% slower)
        for (let i = 0; i < this.items.length; i++) {
          const it = this.items[i];
          if ((it._pickupCooldown || 0) > 0) continue;
          if (it._playerDropped) continue;     // ignore items the player just dropped
          const dx = p.x - it.x, dy = p.y - it.y;
          const dsq = dx * dx + dy * dy;
          if (dsq > MAG_RANGE_SQ) continue;
          if (dsq < PICKUP_DIST_SQ) {
            // Touched — hand off to the pendingCollectedItem pipeline.
            if (!p.pendingCollectedItem) p.pendingCollectedItem = it;
            continue;
          }
          const d = Math.sqrt(dsq);
          const t = 1 - (d / MAG_RANGE);                   // 0 at edge, 1 at point-blank
          const speed = BASE_SPEED + (PEAK_SPEED - BASE_SPEED) * t * t;
          const step = speed * dt;
          it.x += (dx / d) * step;
          it.y += (dy / d) * step;
        }
      }
    }

    // ── Campfire update ───────────────────────────────────────
    if (this.campfire) this.campfire.update(dt, this.player.stats.level);
    if (this.cookingStation) this.cookingStation.update(dt);

    // ── Children update (AI, discovery walk-in, task tickers) ─
    if (this.children) this.children.update(dt);

    // ── Finale director ───────────────────────────────────────
    if (this.finale) this.finale.update(dt);

    // ── Campfire Tend pulse cue: refresh once per second.
    // Glows the stone ring when the next Remembering's gate is satisfied.
    this._tendPulseAcc = (this._tendPulseAcc || 0) + dt;
    if (this._tendPulseAcc > 1) {
      this._tendPulseAcc = 0;
      if (this.campfire) {
        const pending = nextPendingUpgrade(this.story?.campfire?.upgrades);
        this.campfire.pulseForTend = !!(pending && this._checkUpgradeGate(pending));
      }
    }

    // ── Campfire happiness regen — continuous, scales inversely with distance ─
    // Cozy-by-fire feel: at the fire you regen fastest; falls off smoothly to zero at ~3 tiles.
    if (this.campfire && !this.player.isDead) {
      const WARMTH_RADIUS = 3;
      const dist = Math.hypot(this.player.x - this.campfire.x, this.player.y - this.campfire.y);
      const falloff = Math.max(0, 1 - dist / WARMTH_RADIUS);
      if (falloff > 0) {
        const lvl       = this.player.stats.level;
        // Center rate: ~1/45s at level 1, scaling with fire level. Falloff² = warmer-at-core curve.
        const maxRate   = (1 + (lvl - 1) * 0.1) / 45;
        const gain      = maxRate * falloff * falloff * timeStep;
        this.player.stats.happy = Math.min(100, this.player.stats.happy + this._modHappyGain(gain, false));
      }
    }

    // ── Healer companions — tick each healer's own cooldown and heal the player ──
    if (!this.player.isDead) {
      for (const c of this.companions) {
        const cd = getCompanionById(c.type || c.id);
        if (!cd || cd.role !== 'healer' || c.isKO) continue;
        c._healTimer = Math.max(0, (c._healTimer || 0) - dt);
        if (c._healTimer <= 0 && this.player.stats.hp < this.player.stats.maxHp) {
          const amt = cd.healAmount || 7;
          this.player.stats.hp = Math.min(this.player.stats.maxHp, this.player.stats.hp + amt);
          c._healTimer = cd.healCooldown || 7;
          c.showEmote?.('❤️', 1.2);
          this.player.showEmote?.('✨', 0.8);
        }
      }
    }

    // ── Fountain happiness regen (boosted by T4+ deployed compys) ─
    {
      const placedCosmetics = this.editMode?.placedCosmetics || [];
      const fountainCount   = placedCosmetics.filter(c => c.id === 'fountain').length;
      if (fountainCount > 0) {
        this._fountainHappyTimer -= timeStep;
        if (this._fountainHappyTimer <= 0) {
          this._fountainHappyTimer = 120;
          const t4plus   = this.companions.filter(c => {
            const cd = getCompanionById(c.type || c.id);
            return cd && cd.tier >= 4;
          }).length;
          const baseGain = 0.5 * fountainCount;
          const boost    = 1 + t4plus * 0.5; // +50% per T4+ compy
          this.player.stats.happy = Math.min(100, this.player.stats.happy + this._modHappyGain(baseGain * boost, false));
        }
      }
    }

    // ── Junk update + spawn ────────────────────────────────
    {
      const lightR = getLevelLightRadius(this.player.stats.level);
      // Update each junk (animation, poof)
      for (let i = this.junks.length - 1; i >= 0; i--) {
        const jk = this.junks[i];
        jk.update(dt);
        if (jk.isDead && jk._poofTimer <= 0) {
          this.junks.splice(i, 1);
          if (this._junkCleanTarget === jk) this._junkCleanTarget = null;
        }
      }
      // Happiness drain from nearby junks
      for (const jk of this.junks) {
        if (jk.isDead) continue;
        const d = Math.hypot(this.player.x - jk.x, this.player.y - jk.y);
        if (d < 2.5) {
          this.player.stats.happy = Math.max(0, this.player.stats.happy - jk.happyDrainRate * dt);
        }
      }
      // Player cleaning logic
      if (this._junkCleanTarget) {
        const jk = this._junkCleanTarget;
        if (jk.isDead) {
          this._junkCleanTarget = null;
          this._junkCleanProgress = 0;
          this.player.isCleaningJunk = false;
        } else {
          const d = Math.hypot(this.player.x - jk.x, this.player.y - jk.y);
          if (d < 1.5) {
            this.player.isCleaningJunk = true;
            this._junkCleanProgress += dt;
            jk.cleanProgress = Math.min(1, this._junkCleanProgress / jk.cleanTime);
            if (this._junkCleanProgress >= jk.cleanTime) {
              // Completed cleaning
              const lvl = jk.level;
              jk.triggerPoof();
              this._junkCleanTarget = null;
              this._junkCleanProgress = 0;
              this.player.isCleaningJunk = false;
              this._grantXP(5 + lvl * 5);
              this._junkDayCount++;
              this.ach.inc('junk_cleaned');
              if (lvl === 3) this.ach.inc('junk3_cleaned');
              this.ach.max('junk_day', this._junkDayCount);
              // Lifetime cumulative across all runs — Shard 06 ("What She Carried") trigger.
              if (this.legacyStory) {
                this.legacyStory.junkLifetime = (this.legacyStory.junkLifetime || 0) + 1;
                this._commitLegacyStory();
              }
              // Per-child clean counter for T6.2 / T2.1 (clean while child is present).
              if (this.children?.list) {
                this.children._junkCleanByChild ??= {};
                for (const ch of this.children.list) {
                  if (ch.phase !== 'PRESENT') continue;
                  this.children._junkCleanByChild[ch.childIdx] =
                    (this.children._junkCleanByChild[ch.childIdx] || 0) + 1;
                }
                window.dispatchEvent(new CustomEvent('cmm:shard-trigger', { detail: { source: 'junk_clean' } }));
              }
              // Count simultaneous living junks when one is cleaned
              const stillAlive = this.junks.filter(j => !j.isDead).length;
              this.ach.max('junk_simultaneous', stillAlive + 1); // +1 because we just killed it
              // Possible item drop
              if (Math.random() < jk.dropChance) {
                const pool = jk._dropPool;
                const itemName = pool[Math.floor(Math.random() * pool.length)];
                this.spawnItem(jk.x, jk.y, itemName);
                this.ach.inc('junk_item_found');
              }
            }
          } else {
            this.player.isCleaningJunk = false; // still walking to junk
          }
        }
      } else {
        this.player.isCleaningJunk = false;
      }
      // Junk spawn timer (only during day, max 3)
      if (this.time.phase === 'Day' && this.junks.filter(j => !j.isDead).length < 3) {
        this._junkSpawnTimer -= dt;
        if (this._junkSpawnTimer <= 0) {
          this._junkSpawnTimer = 30 + Math.random() * 30;
          // Spawn near light edge
          let clamped, attempts = 0;
          const cosmetics = this.editMode?.placedCosmetics || [];
          do {
            const angle = Math.random() * Math.PI * 2;
            const dist = lightR * 0.75 + Math.random() * lightR * 0.2;
            const jx = Math.cos(angle) * dist;
            const jy = Math.sin(angle) * dist;
            clamped = this._clampToWalkable(jx, jy, lightR);
            attempts++;
          } while (
            attempts < 8 &&
            cosmetics.some(c => Math.hypot(c.x - clamped.x, c.y - clamped.y) < 1.0)
          );
          if (!cosmetics.some(c => Math.hypot(c.x - clamped.x, c.y - clamped.y) < 1.0)) {
            // Randomize level (L1=60%, L2=30%, L3=10%)
            const r = Math.random();
            const lvl = r < 0.6 ? 1 : r < 0.9 ? 2 : 3;
            this.junks.push(new Junk(clamped.x, clamped.y, lvl));
          }
        }
      }
    }

    // ── Attack VFX update ──────────────────────────────────
    for (let i = this.attackVFXList.length - 1; i >= 0; i--) {
      this.attackVFXList[i].update(dt);
      if (this.attackVFXList[i].done) this.attackVFXList.splice(i, 1);
    }
    for (let i = this.specialVFX.length - 1; i >= 0; i--) {
      this.specialVFX[i].update(dt);
      if (this.specialVFX[i].done) this.specialVFX.splice(i, 1);
    }
    for (let i = this._pickupFloats.length - 1; i >= 0; i--) {
      this._pickupFloats[i].timer += dt;
      if (this._pickupFloats[i].timer >= this._pickupFloats[i].life) this._pickupFloats.splice(i, 1);
    }
    // Item-poof particles (small burst when a magneted item disappears).
    if (this._itemPoofs && this._itemPoofs.length) {
      for (let i = this._itemPoofs.length - 1; i >= 0; i--) {
        const pf = this._itemPoofs[i];
        pf.t += dt;
        if (pf.t >= pf.life) { this._itemPoofs.splice(i, 1); continue; }
        // Each particle drifts outward and slows toward end-of-life.
        for (const pa of pf.particles) {
          pa.ox += pa.vx * dt;
          pa.oy += pa.vy * dt;
          pa.vx *= 0.92;            // friction
          pa.vy *= 0.92;
          pa.vy += 30 * dt;         // gentle gravity for the upward bias to ease back down
        }
      }
    }
    // Celebration confetti bursts (task completion). Stronger gravity and
    // confetti-piece rotation, sparkle stars share the same easing.
    if (this._celebrations && this._celebrations.length) {
      for (let i = this._celebrations.length - 1; i >= 0; i--) {
        const cb = this._celebrations[i];
        cb.t += dt;
        if (cb.t >= cb.life) { this._celebrations.splice(i, 1); continue; }
        for (const pa of cb.particles) {
          pa.ox += pa.vx * dt;
          pa.oy += pa.vy * dt;
          pa.vx *= 0.94;
          pa.vy *= 0.94;
          pa.vy += 140 * dt;        // gravity for confetti rain
          if (pa.kind === 'confetti') pa.rot += pa.vrot * dt;
        }
      }
    }

    // ── Bullet update + hit detection ─────────────────────
    const nightmaresAlive = this.nightmares.filter(n => !n.isDead);
    const companionsAlive = this.companions.filter(c => !c.isKO);
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.update(dt);
      if (!b.hit) {
        if (b.ownerType === 'companion') {
          // Companion bullets hit nightmares
          for (const nm of nightmaresAlive) {
            if (Math.hypot(nm.x - b.x, nm.y - b.y) < 0.4) {
              nm.takeDamage(b.damage, b.ownerEntity);
              b.hit = true;
              this._spawnHitVFX(b.x, b.y, b.color);
              break;
            }
          }
        } else {
          // Nightmare bullets hit player and companions
          if (Math.hypot(this.player.x - b.x, this.player.y - b.y) < 0.4) {
            this.player.takeDamage(b.damage, b.ownerEntity);
            b.hit = true;
            this._spawnHitVFX(b.x, b.y, b.color);
          } else {
            for (const c of companionsAlive) {
              if (Math.hypot(c.x - b.x, c.y - b.y) < 0.4) {
                c.takeDamage(b.damage);
                b.hit = true;
                this._spawnHitVFX(b.x, b.y, b.color);
                break;
              }
            }
          }
        }
      }
      if (b.hit) this.bullets.splice(i, 1);
    }

    // ── Character separation (no overlapping) ─────────────
    const CHAR_RADIUS = 0.32; // minimum separation between character centers
    const SEP_DIAM = CHAR_RADIUS * 2;
    const allChars = [this.player, ...this.companions, ...this.nightmares.filter(n => !n.isDead)];
    const petTarget = this.player.petTarget;
    for (let i = 0; i < allChars.length; i++) {
      for (let j = i + 1; j < allChars.length; j++) {
        const a = allChars[i], b = allChars[j];
        // Skip separation between player and their pet target so player can reach the companion
        if ((a === this.player && b === petTarget) || (b === this.player && a === petTarget)) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.001;
        if (dist < SEP_DIAM) {
          const push = (SEP_DIAM - dist) * 0.5;
          const nx = dx / dist, ny = dy / dist;
          if (a === this.player) {
            b.x += nx * push * 1.6; b.y += ny * push * 1.6;
          } else if (b === this.player) {
            a.x -= nx * push * 1.6; a.y -= ny * push * 1.6;
          } else {
            a.x -= nx * push; a.y -= ny * push;
            b.x += nx * push; b.y += ny * push;
          }
        }
      }
    }

    // ── Victory jump: cancel if enemies still nearby ───────
    for (const c of this.companions) {
      if (c.victoryJumpTimer > 0) {
        const nearEnemy = nightmaresAlive.some(n => Math.hypot(n.x - c.x, n.y - c.y) < 3);
        if (nearEnemy) c.victoryJumpTimer = 0;
      }
    }

    // Deployed companion count for achievements
    this.ach.max('comp_deployed', this.companions.length);
    // Full moon: moon_ferret + starlight_owl deployed together
    const types = this.companions.map(c => c.type || c.id);
    if (types.includes('moon_ferret') && types.includes('starlight_owl')) this.ach.inc('full_moon');

    // ── Flush achievement toasts ───────────────────────
    this._achToastTimer -= dt;
    const fresh = this.ach.flush();
    for (const a of fresh) {
      // XP from achievement
      this._grantAchXP(a.xp);
      this._achToastQueue.push(a);
    }
    if (this._achToastQueue.length > 0 && this._achToastTimer <= 0) {
      this._showAchToast(this._achToastQueue.shift());
      this._achToastTimer = 4.5;
    }

    // ── Update level achievement counter ───────────────
    this.ach.set('level', this.player.stats.level);

    // ── Entity list for depth sort ─────────────────────
    // Reuse the same array (clear + push) rather than allocating fresh per frame.
    // At high item counts this saves a sizeable arr-spread + GC each frame.
    const ents = this.entities || (this.entities = []);
    ents.length = 0;
    ents.push(this.player);
    for (const c of this.companions)     ents.push(c);
    for (const n of this.nightmares)     ents.push(n);
    for (const i of this.items)          ents.push(i);
    if (this.merchant) ents.push(this.merchant);
    if (this.children) {
      // Camps render once the silhouette has spawned at the edge of light —
      // the prop arrives WITH the child rather than haunting the world ahead
      // of discovery. Stowed camps (Edit Mode → bag icon) skip rendering too.
      const storedMap = this.editMode?.stored || {};
      for (let i = 0; i < this.children.camps.length; i++) {
        const cmp   = this.children.camps[i];
        const child = this.children.list[i];
        if (storedMap[`child_camp_${i}`]) continue;
        if (cmp && child && child.phase !== 'HIDDEN') ents.push(cmp);
      }
      for (const ch of this.children.list) {
        if (ch.phase !== 'HIDDEN') ents.push(ch);
      }
    }

    // ── Walk-to-open-UI: approach pending entity, open its modal on arrival ──
    if (this._pendingModal) {
      const e = this._pendingModal.entity;
      if (!e || e.isDead) {
        this._pendingModal = null;
      } else {
        const d = Math.hypot(this.player.x - e.x, this.player.y - e.y);
        if (d < this._pendingModal.threshold) {
          const menuId = this._pendingModal.menuId;
          this._pendingModal = null;
          this.player.targetX = this.player.x;
          this.player.targetY = this.player.y;
          if (menuId === 'campfire') {
            this._onCampfireArrive();
          } else if (typeof menuId === 'string' && menuId.startsWith('child-')) {
            const idx = parseInt(menuId.slice(6), 10);
            window.openChildDialog?.(idx);
          } else {
            window.openMenu(menuId);
          }
        } else {
          // Re-track the entity in case it has moved (e.g. merchant wandering).
          const angle = Math.atan2(this.player.y - e.y, this.player.x - e.x);
          this.player.targetX = e.x + Math.cos(angle) * this._pendingModal.stopOffset;
          this.player.targetY = e.y + Math.sin(angle) * this._pendingModal.stopOffset;
        }
      }
    }

    // ── Level-up cinematic camera ──────────────────────────
    if (this._levelUpAnim.active) {
      const la = this._levelUpAnim;
      la.timer += dt;
      const fireIso = this.world.toIso(0, 0);
      const ease = p => p < 0.5 ? 2*p*p : -1+(4-2*p)*p;
      if (la.timer < 0.9) {
        // Fly camera toward campfire
        const p = ease(la.timer / 0.9);
        this.camera.x = la.startCamX + (fireIso.x - la.startCamX) * p;
        this.camera.y = la.startCamY + (fireIso.y - la.startCamY) * p;
        this.camera.zoom = la.startZoom + (0.75 - la.startZoom) * p;
      } else if (la.timer < 2.8) {
        // Hold at campfire, ring expands
        this.camera.x = fireIso.x;
        this.camera.y = fireIso.y;
        this.camera.zoom = 0.75;
        la.ringRadius = ((la.timer - 0.9) / 1.9) * la.maxRingRadius;
      } else if (la.timer < la.duration) {
        // Fly back to player
        const p = ease((la.timer - 2.8) / (la.duration - 2.8));
        const playerIso = this.world.toIso(this.player.visualX, this.player.visualY);
        this.camera.x = fireIso.x + (playerIso.x - fireIso.x) * p;
        this.camera.y = fireIso.y + (playerIso.y - fireIso.y) * p;
        this.camera.zoom = 0.75 + (la.startZoom - 0.75) * p;
      } else {
        la.active = false;
        this.camera.zoom = la.startZoom;
        this._showLevelUpQuote();
      }
    } else if (this.editMode?.active) {
      // Edit mode: camera panned manually; run zoom lerp
      this.editMode.update(dt);
    } else {
      // Normal camera follow (also handles zoom-back lerp after exiting edit)
      if (this.editMode) this.editMode.update(dt);
      const targetIso = this.world.toIso(this.player.visualX, this.player.visualY);
      this.camera.x += (targetIso.x - this.camera.x) * 4 * dt;
      this.camera.y += (targetIso.y - this.camera.y) * 4 * dt;
    }

    // ── Quote display countdown ────────────────────────
    if (this._quoteDisplay.timer > 0) this._quoteDisplay.timer -= dt;

    // ── Achievement notification countdown ─────────────
    if (this._achNotif) {
      this._achNotif.timer -= dt;
      if (this._achNotif.timer <= 0) this._achNotif = null;
    }
    // ── Boss night notification countdown ───────────────
    if (this._bossNightNotif) {
      this._bossNightNotif.timer -= dt;
      if (this._bossNightNotif.timer <= 0) this._bossNightNotif = null;
    }

    // ── Butterfly particle system ─────────────────────
    this._updateButterflies(dt, this.player.stats.happy);

    this.updateHUD();

    this.autoSaveTimer -= dt;
    if (this.autoSaveTimer <= 0) { this.saveGame(); this.autoSaveTimer = 30; }
  }

  _drawInteractionPrompts(ctx) {
    const px = this.player.x, py = this.player.y;

    // Cooking station prompt
    if (this.cookingStation) {
      const d = Math.hypot(this.cookingStation.x - px, this.cookingStation.y - py);
      if (d < 1.8) {
        const iso = this.world.toIso(this.cookingStation.x, this.cookingStation.y);
        this._drawPromptBubble(ctx, iso.x, iso.y - 56, '🍳 Tap to Cook');
      }
    }

    // Merchant prompt
    if (this.merchant && !this.merchant.isDead) {
      const d = Math.hypot(this.merchant.x - px, this.merchant.y - py);
      if (d < 1.5) {
        const iso = this.world.toIso(this.merchant.visualX, this.merchant.visualY);
        this._drawPromptBubble(ctx, iso.x, iso.y - 52, '🛒 Tap to Shop');
      }
    }
  }

  _drawPromptBubble(ctx, cx, cy, label) {
    ctx.save();
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    const tw = ctx.measureText(label).width;
    const pw = tw + 18, ph = 20, px2 = cx - pw / 2, py2 = cy - ph;
    ctx.fillStyle = 'rgba(10,11,20,0.88)';
    ctx.strokeStyle = 'rgba(245,158,11,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(px2, py2, pw, ph, 6);
    else ctx.rect(px2, py2, pw, ph);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fbbf24';
    ctx.fillText(label, cx, cy - 5);
    ctx.restore();
  }

  _drawLevelUpOverlay(ctx) {
    const la = this._levelUpAnim;
    const t = la.timer;
    const fireIso = this.world.toIso(0, 0);
    const ts = this.world.tileSize;

    ctx.save();
    ctx.translate(fireIso.x, fireIso.y);

    // Expanding ring waves
    if (t > 0.9 && t < 3.0) {
      const expand = (t - 0.9) / 1.9;
      const ringAlpha = (1 - expand) * 0.9;
      const r = la.ringRadius;
      const ellipseX = r;
      const ellipseY = r * 0.5;

      // Multiple rings
      for (let ri = 0; ri < 3; ri++) {
        const offset = ri * 0.15;
        const rFrac = Math.max(0, expand - offset);
        const rPx = rFrac * la.maxRingRadius;
        const alpha = Math.max(0, (1 - rFrac) * 0.8);
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = ri === 0 ? '#a0e8ff' : ri === 1 ? '#60b8ff' : '#8b5cf6';
        ctx.lineWidth = ri === 0 ? 4 : 2;
        ctx.shadowColor = ctx.strokeStyle;
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.ellipse(0, 0, rPx, rPx * 0.5, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;

      // Burst sparkles from campfire
      const numSparks = 12;
      for (let si = 0; si < numSparks; si++) {
        const a = (si / numSparks) * Math.PI * 2 + t * 1.5;
        const r2 = expand * la.maxRingRadius * 0.6;
        const sx = Math.cos(a) * r2;
        const sy = Math.sin(a) * r2 * 0.5;
        const alpha2 = (1 - expand) * 0.8;
        ctx.globalAlpha = alpha2;
        ctx.font = `${10 + Math.sin(t * 4 + si) * 3}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(['✨','💫','⭐'][si % 3], sx, sy - 12);
      }
      ctx.globalAlpha = 1;
    }

    // Level-up text (appears at 1.0s, fades out after 2.5s) — below campfire
    const textAlpha = t < 1.0 ? 0 : t < 1.5 ? (t - 1.0) / 0.5
                      : t < 2.6 ? 1 : Math.max(0, 1 - (t - 2.6) / 0.5);
    if (textAlpha > 0) {
      // In light mode the bright whites + cyan glow vanish on the cream sky.
      // Swap to deep plum/violet that still reads as "celebratory + magical".
      const isLight = !document.body.classList.contains('dark-mode');
      const titleColor    = isLight ? '#3b1d52' : '#ffffff';
      const titleGlow     = isLight ? '#fff4ec' : '#a0e8ff';
      const subtitleColor = isLight ? '#6d28d9' : '#c4b5fd';
      const subtitleGlow  = isLight ? '#ffffff' : '#8b5cf6';
      ctx.globalAlpha = textAlpha;
      const bounce = Math.sin(t * 6) * (t < 2.0 ? 3 : 0);
      ctx.shadowColor = titleGlow; ctx.shadowBlur = 24;
      ctx.font = 'bold 28px Inter, sans-serif';
      ctx.fillStyle = titleColor;
      ctx.textAlign = 'center';
      ctx.fillText(`✨ Level ${la.newLevel}! ✨`, 0, 82 + bounce);
      ctx.shadowColor = subtitleGlow; ctx.shadowBlur = 12;
      ctx.font = 'bold 15px Inter, sans-serif';
      ctx.fillStyle = subtitleColor;
      ctx.fillText('Light Expands!', 0, 108 + bounce);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  _drawAchNotif(ctx) {
    const n = this._achNotif;
    const frac = n.timer / n.maxTimer;
    const alpha = frac > 0.85 ? ((1 - frac) / 0.15) : (frac < 0.18 ? frac / 0.18 : 1);
    if (alpha <= 0) return;

    ctx.save();
    ctx.resetTransform();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const floatY = Math.sin((1 - frac) * Math.PI * 1.5) * 4;
    const cx = this.canvas.width / 2;
    // HUD now scales on mobile (85-110px tall). Place toast a touch below HUD bottom.
    const isNarrow = this.canvas.width < 480;
    const isTiny   = this.canvas.width < 360;
    const by = (isTiny ? 210 : isNarrow ? 230 : 260) + floatY;

    // Word-wrap helper for the description line (max 2 lines, ellipsize the rest)
    const wrapLines = (text, maxWidth, maxLines = 2) => {
      if (!text) return [];
      const words = String(text).split(/\s+/);
      const lines = [];
      let cur = '';
      for (const w of words) {
        const test = cur ? cur + ' ' + w : w;
        if (ctx.measureText(test).width <= maxWidth) {
          cur = test;
        } else {
          if (cur) lines.push(cur);
          cur = w;
          if (lines.length >= maxLines) break;
        }
      }
      if (cur && lines.length < maxLines) lines.push(cur);
      // Ellipsize last line if we ran out of room
      if (lines.length === maxLines) {
        let last = lines[maxLines - 1];
        while (last.length > 4 && ctx.measureText(last + '…').width > maxWidth) last = last.slice(0, -1);
        // Append ellipsis only if we actually truncated
        const remaining = words.slice(words.indexOf(last.split(' ').pop()) + 1).length;
        if (remaining > 0) lines[maxLines - 1] = last + '…';
      }
      return lines;
    };

    // Light-mode palette swap — the original cyan/white/silver tones bleach
    // out against the daytime cream sky. Re-tone to deep plum/amber/teal
    // that match the rest of the light-mode UI.
    const isLight = !document.body.classList.contains('dark-mode');
    const labelCol = isLight ? '#6d28d9' : '#c4b5fd';
    const nameCol  = isLight ? '#3b1d52' : '#ffffff';
    const nameGlow = isLight ? '#ffffff' : '#a0e8ff';
    const descCol  = isLight ? '#4a2f5a' : '#cdd9e8';
    const descGlow = isLight ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)';
    const subCol   = isLight ? '#b45309' : '#a0e8ff';
    const subGlow  = isLight ? '#fde6c4' : '#60b8ff';
    const iconGlow = isLight ? '#ffffff' : '#8b5cf6';

    // Icon
    ctx.font = '34px Arial';
    ctx.shadowColor = iconGlow;
    ctx.shadowBlur = 14;
    ctx.fillText(n.icon, cx, by - 62);

    // Label
    ctx.font = 'bold 12px Inter, sans-serif';
    ctx.fillStyle = labelCol;
    ctx.shadowColor = iconGlow;
    ctx.shadowBlur = 8;
    ctx.fillText(n.label, cx, by - 31);

    // Name
    ctx.font = 'bold 21px Inter, sans-serif';
    ctx.fillStyle = nameCol;
    ctx.shadowColor = nameGlow;
    ctx.shadowBlur = 22;
    ctx.fillText(n.name, cx, by - 5);

    // Description (optional — wraps to max 2 lines)
    let subY = by + 23; // default sub Y when no desc
    if (n.desc) {
      ctx.font = '14px Inter, sans-serif';
      ctx.fillStyle = descCol;
      ctx.shadowColor = descGlow;
      ctx.shadowBlur = 4;
      const maxW = Math.min(this.canvas.width - 40, 360);
      const lines = wrapLines(n.desc, maxW, 2);
      lines.forEach((line, i) => ctx.fillText(line, cx, by + 18 + i * 18));
      subY = by + 18 + lines.length * 18 + 8;
    }

    // Sub text (XP / detail line)
    ctx.font = 'bold 14px Inter, sans-serif';
    ctx.fillStyle = subCol;
    ctx.shadowColor = subGlow;
    ctx.shadowBlur = 10;
    ctx.fillText(n.sub, cx, subY);

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  _drawBossNightBanner(ctx) {
    const bn = this._bossNightNotif;
    const frac = bn.timer / bn.maxTimer;
    const alpha = frac > 0.85 ? ((1 - frac) / 0.15) : (frac < 0.15 ? frac / 0.15 : 1);
    if (alpha <= 0) return;
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    const t  = Date.now() / 1000;

    ctx.save();
    ctx.resetTransform();
    ctx.globalAlpha = alpha * 0.18;
    ctx.fillStyle = '#7c3aed';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.globalAlpha = alpha;

    // Pulsing icon
    const pulse = 1 + Math.sin(t * 6) * 0.08;
    ctx.font = `${56 * pulse}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 30;
    ctx.fillText('👹', cx, cy - 54);

    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 20;
    ctx.font = 'bold 13px Inter, sans-serif';
    ctx.fillStyle = '#fca5a1';
    ctx.fillText('B O S S  N I G H T', cx, cy + 4);

    ctx.shadowColor = '#a21caf';
    ctx.shadowBlur = 12;
    ctx.font = 'bold 22px Outfit, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Void Titan Approaches!', cx, cy + 30);

    ctx.font = '12px Inter, sans-serif';
    ctx.fillStyle = '#fca5a1';
    ctx.shadowBlur = 0;
    ctx.fillText('Defeat it for rare rewards', cx, cy + 54);

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  _drawTreeCosmetic(ctx, iso, def) {
    const t = Date.now() / 1000;
    const phase = iso.x * 0.008;
    const sway  = Math.sin(t * 0.60 + phase) * 0.048;
    const sway2 = Math.sin(t * 0.85 + phase + 1.2) * 0.028;

    ctx.save();
    ctx.translate(iso.x, iso.y);

    if (def.id === 'oak_tree' || def.id === 'cherry_bloom') {
      const cherry = def.id === 'cherry_bloom';
      // Isometric cute round tree — layered sphere with bushy puff rim
      const ck = cherry ? {
        trA:'#c47a50', trB:'#8a4e2e',
        shad:'#7d1348',
        c0:'#c2185b', c1:'#e91e8c', c2:'#f472b6',
        c3:'#fb7ec6', c4:'#fda4cf', hl:'#fde8f3'
      } : {
        trA:'#a06b3c', trB:'#6b4220',
        shad:'#0a2e0a',
        c0:'#145214', c1:'#1a7a1a', c2:'#229922',
        c3:'#2ebb2e', c4:'#50dd50', hl:'#90f090'
      };

      // Isometric ground shadow (wider than tall)
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      ctx.ellipse(6, 10, 38, 16, 0, 0, Math.PI * 2);
      ctx.fill();

      // Cute stubby trunk
      ctx.fillStyle = ck.trA;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(-6, -34, 12, 34, 5);
      else ctx.rect(-6, -34, 12, 34);
      ctx.fill();
      // Trunk left shadow face (isometric depth)
      ctx.fillStyle = ck.trB;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(-6, -34, 5, 34, [5, 0, 0, 5]);
      else ctx.fillRect(-6, -34, 5, 34);
      ctx.fill();
      // Trunk highlight stripe
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(2, -30, 2, 26);

      // ── Canopy ──
      ctx.save();
      ctx.translate(0, -50);
      ctx.rotate(sway);

      // Cast shadow under canopy
      ctx.fillStyle = ck.shad;
      ctx.globalAlpha = 0.38;
      ctx.beginPath();
      ctx.ellipse(sway * 70, 22, 48, 24, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Isometric sphere — 5 layers from dark bottom → bright top
      [
        [14, 44, 34, ck.c0, 0],
        [ 4, 42, 32, ck.c1, 1],
        [-7, 40, 30, ck.c2, 2],
        [-18,36, 27, ck.c3, 3],
        [-30,28, 21, ck.c4, 4],
      ].forEach(([y, rx, ry, col, li]) => {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.ellipse(sway * (28 - li * 5), y, rx, ry, sway * 0.18, 0, Math.PI * 2);
        ctx.fill();
      });

      // ── Bushy puff rim — clusters all around the canopy edge ──
      const puffs = [
        // [x, y, rx, ry, colorKey]  — densely packed around the sphere silhouette
        [-46,  -4, 20, 16, ck.c1], [ 46,  -4, 20, 16, ck.c1],  // far sides
        [-40, -20, 18, 14, ck.c2], [ 40, -20, 18, 14, ck.c2],  // upper-side
        [-38,  12, 17, 13, ck.c1], [ 38,  12, 17, 13, ck.c1],  // lower-side
        [-28, -34, 17, 14, ck.c3], [ 28, -34, 17, 14, ck.c3],  // near-top
        [-12, -42, 18, 14, ck.c4], [ 12, -42, 18, 14, ck.c4],  // top-crown
        [  0,  20, 22, 15, ck.c0],                               // front bottom
        [-50,   2, 14, 11, ck.c1], [ 50,   2, 14, 11, ck.c1],  // outer sides
        [-22,  16, 16, 12, ck.c0], [ 22,  16, 16, 12, ck.c0],  // front lower
        [-32,  -8, 16, 12, ck.c2], [ 32,  -8, 16, 12, ck.c2],  // mid sides
        [ -6, -46, 16, 12, ck.c4], [  6, -46, 16, 12, ck.c4],  // very top
      ];
      puffs.forEach(([px, py, prx, pry, col], i) => {
        const ps = Math.sin(t * (0.68 + i * 0.07) + phase + i * 0.82) * sway * 0.55;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.ellipse(px + ps * 28, py, prx, pry, ps * 0.32, 0, Math.PI * 2);
        ctx.fill();
      });

      // Tiny bright leaf highlights scattered across canopy
      ctx.fillStyle = ck.hl;
      const hpts = [
        [-22,-38],[12,-40],[-36,-18],[36,-16],[-16,-48],[16,-46],[2,-52],
        [-28,  6],[28,  6],[ -8, 20],[  8, 20],[-42, -6],[42, -4],
        [-14,-28],[14,-28],[  0,-36],[-34,-12],[34,-10],[0,-20],[-20,-14],[20,-12],
      ];
      hpts.forEach(([lx, ly], i) => {
        const wb = Math.sin(t * (0.82 + i * 0.054) + i * 1.18) * 2.2;
        ctx.beginPath();
        ctx.ellipse(lx + wb * sway * 7, ly, 5.5, 4.5, i * 0.42, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.restore();

    } else if (def.id === 'pine_tree') {

      // Isometric cute pine — wide flat tiers
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.ellipse(4, 7, 22, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      // Stubby trunk
      ctx.fillStyle = '#9b6b3c';
      ctx.fillRect(-5, -24, 10, 24);
      ctx.fillStyle = '#6b4220';
      ctx.fillRect(-5, -24, 4, 24);
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(2, -20, 2, 18);

      // 4 tiers — each an isometric ellipse layer with shadow + main + highlight
      const tiers = [
        { y:-28, rx:46, ry:19, dark:'#0a2e0a', main:'#145214', lite:'#1e7a1e' },
        { y:-48, rx:36, ry:15, dark:'#0d3b0d', main:'#1a6b1a', lite:'#25952a' },
        { y:-66, rx:24, ry:11, dark:'#145214', main:'#228b22', lite:'#33bb33' },
        { y:-82, rx:14, ry: 7, dark:'#1a7a1a', main:'#33bb33', lite:'#50dd50' },
      ];
      tiers.forEach(({ y, rx, ry, dark, main, lite }, i) => {
        const ts = Math.sin(t * 0.62 + phase + i * 0.82) * (sway + i * 0.008);
        const tx = Math.sin(t * 0.62 + phase + i * 0.70) * (i + 1) * 2.2;
        ctx.save();
        ctx.translate(tx, 0);
        ctx.rotate(ts * 0.5);
        // Bottom shadow face (isometric depth)
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.ellipse(ts * 55, y + 8, rx * 0.9, ry * 0.78, 0, 0, Math.PI * 2);
        ctx.fill();
        // Main tier
        ctx.fillStyle = main;
        ctx.beginPath();
        ctx.ellipse(ts * 38, y, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        // Top highlight (light comes from upper-left)
        ctx.fillStyle = lite;
        ctx.beginPath();
        ctx.ellipse(ts * 18 - rx * 0.15, y - ry * 0.28, rx * 0.62, ry * 0.55, ts * 0.35, 0, Math.PI * 2);
        ctx.fill();
        // Small puff bumps on tier edge for bushy look
        for (let b = 0; b < 5; b++) {
          const ba = (b / 5) * Math.PI * 2 + ts;
          const bx = Math.cos(ba) * rx * 0.88;
          const by = Math.sin(ba) * ry * 0.88 + y;
          ctx.fillStyle = b % 2 === 0 ? lite : main;
          ctx.beginPath();
          ctx.ellipse(bx + ts * 25, by, rx * 0.14, ry * 0.38, ba, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });

      // Tip spike + tiny crown puff
      const tipS = Math.sin(t * 0.62 + phase) * 5;
      ctx.fillStyle = '#1e7a1e';
      ctx.beginPath();
      ctx.moveTo(tipS, -100);
      ctx.lineTo(tipS - 9, -84);
      ctx.lineTo(tipS + 9, -84);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#50dd50';
      ctx.beginPath();
      ctx.ellipse(tipS, -96, 6, 5, 0, 0, Math.PI * 2);
      ctx.fill();

    } else if (def.id === 'palm_tree') {

      const lean = sway * 0.7;

      ctx.fillStyle = 'rgba(0,0,0,0.20)';
      ctx.beginPath();
      ctx.ellipse(12, 8, 26, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      // Chubby curved trunk with isometric light/shadow
      ctx.strokeStyle = '#c48040';
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(16 + lean * 38, -40, 12 + sway * 30, -82);
      ctx.stroke();
      ctx.strokeStyle = '#8a5422';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(-2, 0);
      ctx.quadraticCurveTo(11 + lean * 38, -40, 7 + sway * 30, -82);
      ctx.stroke();
      ctx.strokeStyle = '#dda050';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(3, -4);
      ctx.quadraticCurveTo(19 + lean * 38, -40, 15 + sway * 30, -82);
      ctx.stroke();
      // Ring markings
      ctx.strokeStyle = '#6a3e18';
      ctx.lineWidth = 2.5;
      for (let i = 1; i <= 7; i++) {
        const fy = -i * 11;
        const fx = (12 + sway * 30) * (i / 7) * 0.68;
        ctx.beginPath();
        ctx.moveTo(fx - 8, fy);
        ctx.lineTo(fx + 9, fy);
        ctx.stroke();
      }

      // Coconuts (cute!)
      const cx2 = 12 + sway * 30, cy2 = -86;
      ctx.fillStyle = '#7a5c14';
      ctx.beginPath(); ctx.ellipse(cx2 - 6, cy2 + 12, 6, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx2 + 5, cy2 + 14, 5, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx2 - 1, cy2 + 18, 5, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#a07828';
      ctx.beginPath(); ctx.ellipse(cx2 - 7, cy2 + 11, 3, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx2 + 4, cy2 + 13, 2.5, 2.5, 0, 0, Math.PI * 2); ctx.fill();

      // 9 fronds with leaflets
      const frondDefs = [
        { a:-0.18, len:58 }, { a: 0.52, len:56 }, { a:-0.95, len:52 },
        { a: 1.20, len:50 }, { a:-1.65, len:44 }, { a: 1.85, len:42 },
        { a:-2.30, len:38 }, { a: 2.55, len:36 }, { a: Math.PI, len:32 },
      ];
      frondDefs.forEach(({ a, len }, i) => {
        const fs2 = sway * (1.0 + i * 0.12);
        const ex = cx2 + Math.cos(a + fs2) * len;
        const ey = cy2 + Math.sin(a + fs2) * len * 0.55;
        ctx.strokeStyle = i < 3 ? '#38b023' : '#2a8818';
        ctx.lineWidth = Math.max(2, 5 - i * 0.3);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx2, cy2);
        ctx.quadraticCurveTo(
          cx2 + Math.cos(a + fs2) * len * 0.52,
          cy2 + Math.sin(a + fs2) * len * 0.52 - 14,
          ex, ey
        );
        ctx.stroke();
        // Leaflet blobs along each frond
        ctx.fillStyle = i < 3 ? '#4ec834' : '#38a020';
        ctx.globalAlpha = 0.75;
        const mx = cx2 + Math.cos(a + fs2) * len * 0.62;
        const my = cy2 + Math.sin(a + fs2) * len * 0.52 - 10;
        ctx.beginPath();
        ctx.ellipse(mx, my, 9, 5, a + fs2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      });

    } else if (def.id === 'bamboo_grove') {

      const stalks = [
        { x:-17, h:100, sc:1.0, col:'#7bc719' },
        { x: -6, h: 86, sc:0.8, col:'#8fd420' },
        { x:  8, h:112, sc:1.1, col:'#70b815' },
        { x: 18, h: 94, sc:0.9, col:'#88cc1c' },
        { x:  1, h: 80, sc:0.7, col:'#9cdd22' },
      ];
      stalks.forEach(({ x, h, sc, col }, i) => {
        const ss = Math.sin(t * 0.62 + phase + i * 0.72) * sway * 2.2 * sc;
        ctx.save();
        ctx.translate(x, 0);
        ctx.rotate(ss);

        // Stalk with gradient + rounded ends
        const grd = ctx.createLinearGradient(-3.5, -h, 3.5, 0);
        grd.addColorStop(0, col);
        grd.addColorStop(1, '#3a6e0a');
        ctx.fillStyle = grd;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(-3.5, -h, 7, h, 3);
        else ctx.fillRect(-3.5, -h, 7, h);
        ctx.fill();
        // Isometric highlight stripe
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.fillRect(-3.5, -h, 2.5, h);
        // Shadow stripe
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(2, -h, 1.5, h);

        // Joints
        ctx.fillStyle = '#2c5606';
        for (let j = 1; j <= 5; j++) {
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(-4.5, -h * j / 5.5, 9, 3.5, 1.5);
          else ctx.fillRect(-4.5, -h * j / 5.5, 9, 3.5);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.15)';
          ctx.fillRect(-4.5, -h * j / 5.5, 9, 1);
          ctx.fillStyle = '#2c5606';
        }

        // More leaves at two heights — bigger and more of them
        const leafSets = [
          // top cluster
          { lx:-20, ly:-h+ 8, rx:20, ry:6, rot:-0.55 },
          { lx: 18, ly:-h+16, rx:18, ry:5, rot: 0.50 },
          { lx:-14, ly:-h+28, rx:15, ry:5, rot:-0.40 },
          { lx: 12, ly:-h+40, rx:14, ry:4, rot: 0.35 },
          { lx: -8, ly:-h+50, rx:12, ry:4, rot:-0.28 },
          // mid cluster
          { lx:-18, ly:-h*0.52+4,  rx:16, ry:5, rot:-0.50 },
          { lx: 16, ly:-h*0.52+14, rx:14, ry:4, rot: 0.42 },
          { lx:-10, ly:-h*0.52+24, rx:12, ry:4, rot:-0.32 },
        ];
        leafSets.forEach(({ lx, ly, rx, ry, rot }) => {
          const lw = Math.sin(t * (0.78 + i * 0.09) + i) * sway * 30;
          ctx.fillStyle = '#5ab012';
          ctx.save();
          ctx.translate(lx, ly);
          ctx.rotate(rot + lw * 0.07);
          ctx.beginPath();
          ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
          ctx.fill();
          // Leaf vein/highlight
          ctx.fillStyle = 'rgba(190,255,110,0.35)';
          ctx.beginPath();
          ctx.ellipse(-rx * 0.2, 0, rx * 0.45, ry * 0.55, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        });

        ctx.restore();
      });
    }

    ctx.restore();
  }

  _drawDecorCosmetic(ctx, iso, def) {
    const t = Date.now() / 1000;
    const phase = iso.x * 0.008;
    const sway = Math.sin(t * 0.60 + phase) * 0.048;

    ctx.save();
    ctx.translate(iso.x, iso.y);

    const gndShadow = (rx, ry, ox = 4, oy = 7) => {
      ctx.fillStyle = 'rgba(0,0,0,0.20)';
      ctx.beginPath(); ctx.ellipse(ox, oy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    };

    switch (def.id) {

      case 'cactus': {
        const sw = Math.sin(t * 0.5 + phase) * 0.038;
        gndShadow(18, 8);
        ctx.save(); ctx.rotate(sw);
        // Body
        ctx.fillStyle = '#1e9022'; ctx.fillRect(-11, -54, 22, 54);
        ctx.fillStyle = '#0f5012'; ctx.fillRect(-11, -54, 6, 54);
        ctx.fillStyle = '#34c234'; ctx.fillRect(8, -50, 3, 44);
        // Top cap
        ctx.fillStyle = '#34cc34'; ctx.beginPath(); ctx.ellipse(0, -54, 11, 5.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#58ee58'; ctx.beginPath(); ctx.ellipse(-2, -58, 6, 4, 0, 0, Math.PI * 2); ctx.fill();
        // Left arm
        ctx.fillStyle = '#1e9022'; ctx.fillRect(-26, -38, 16, 16);
        ctx.fillStyle = '#0f5012'; ctx.fillRect(-26, -38, 5, 16);
        ctx.fillStyle = '#34cc34'; ctx.beginPath(); ctx.ellipse(-18, -38, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
        // Right arm
        ctx.fillStyle = '#1e9022'; ctx.fillRect(11, -30, 16, 16);
        ctx.fillStyle = '#0f5012'; ctx.fillRect(11, -30, 5, 16);
        ctx.fillStyle = '#34cc34'; ctx.beginPath(); ctx.ellipse(19, -30, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
        // Spines
        ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
        [[-4, -46], [5, -36], [-5, -24], [4, -14], [-4, -4]].forEach(([sx, sy]) => {
          ctx.beginPath(); ctx.moveTo(sx, sy - 4); ctx.lineTo(sx, sy + 4); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(sx - 4, sy); ctx.lineTo(sx + 4, sy); ctx.stroke();
        });
        ctx.restore();
        break;
      }

      case 'giant_mush': {
        gndShadow(22, 9);
        // Stalk
        ctx.fillStyle = '#f0ead8'; ctx.fillRect(-8, -38, 16, 38);
        ctx.fillStyle = '#c8c0a8'; ctx.fillRect(-8, -38, 5, 38);
        ctx.fillStyle = '#fffaf0'; ctx.fillRect(5, -34, 3, 30);
        // Stalk top (isometric cap)
        ctx.fillStyle = '#fff8e8'; ctx.beginPath(); ctx.ellipse(0, -38, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
        // Cap layers (isometric dome)
        [[12, 42, 32, '#7a1508'], [4, 40, 30, '#b02010'], [-6, 36, 26, '#d83018'], [-18, 28, 20, '#ee5528']].forEach(([y, rx, ry, col]) => {
          ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
        });
        // White spots
        ctx.fillStyle = 'rgba(255,255,255,0.88)';
        [[-14, -2], [10, -5], [0, -14], [-8, -13], [14, -11], [-18, -8], [6, -19]].forEach(([sx, sy]) => {
          ctx.beginPath(); ctx.arc(sx, sy, 4, 0, Math.PI * 2); ctx.fill();
        });
        // Cap highlight
        ctx.fillStyle = 'rgba(255,160,140,0.45)';
        ctx.beginPath(); ctx.ellipse(-8, -18, 14, 10, -0.3, 0, Math.PI * 2); ctx.fill();
        break;
      }

      case 'fern_patch': {
        gndShadow(20, 8, 2, 4);
        const frondAngles = [-1.65, -1.05, -0.42, 0.20, 0.82, 1.45, Math.PI];
        frondAngles.forEach((a, i) => {
          const len = 28 + (i % 3) * 6;
          const fs = Math.sin(t * (0.58 + i * 0.07) + phase + i * 0.7) * sway * 0.8;
          ctx.strokeStyle = i % 2 === 0 ? '#1a7a1a' : '#228b22'; ctx.lineWidth = 3; ctx.lineCap = 'round';
          const ex = Math.cos(a + fs) * len, ey = Math.sin(a + fs) * len * 0.55 - 4;
          ctx.beginPath(); ctx.moveTo(0, -2);
          ctx.quadraticCurveTo(Math.cos(a + fs) * len * 0.5, Math.sin(a + fs) * len * 0.5 * 0.55 - 6, ex, ey);
          ctx.stroke();
          ctx.fillStyle = '#38b022'; ctx.globalAlpha = 0.85;
          for (let li = 1; li <= 3; li++) {
            const lp = li / 3.8;
            const lx = Math.cos(a + fs) * len * lp, ly = Math.sin(a + fs) * len * lp * 0.55 - 4 * lp;
            ctx.beginPath(); ctx.ellipse(lx, ly, 7, 3, a + fs + Math.PI * 0.5, 0, Math.PI * 2); ctx.fill();
          }
          ctx.globalAlpha = 1;
        });
        break;
      }

      case 'flower_pot': {
        gndShadow(14, 6, 2, 4);
        // Pot body
        ctx.fillStyle = '#b85c2a';
        ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(12, 0); ctx.lineTo(9, -22); ctx.lineTo(-9, -22); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#8a3e18';
        ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(-9, -22); ctx.lineTo(-4, -22); ctx.lineTo(-7, 0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#cc6e38'; ctx.beginPath(); ctx.ellipse(0, -22, 9, 4.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e08040'; ctx.beginPath(); ctx.ellipse(-2, -24, 5, 2.8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#5c3810'; ctx.beginPath(); ctx.ellipse(0, -22, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
        // Flowers
        [[-5, -32], [5, -36], [0, -44]].forEach(([fx, fy], i) => {
          const fw = Math.sin(t * (0.8 + i * 0.2) + i) * sway * 0.8;
          ctx.save(); ctx.translate(fx, fy); ctx.rotate(fw);
          ctx.strokeStyle = '#228b22'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(0, 0); ctx.stroke();
          const pc = ['#f472b6', '#fb923c', '#fbbf24'][i];
          ctx.fillStyle = pc;
          for (let p = 0; p < 5; p++) {
            const pa = p / 5 * Math.PI * 2;
            ctx.beginPath(); ctx.ellipse(Math.cos(pa) * 5, Math.sin(pa) * 5, 4, 3, pa, 0, Math.PI * 2); ctx.fill();
          }
          ctx.fillStyle = '#fef08a'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        });
        break;
      }

      case 'sunflower': {
        const sw = Math.sin(t * 0.5 + phase) * 0.04;
        gndShadow(12, 5, 2, 4);
        ctx.save(); ctx.rotate(sw);
        ctx.strokeStyle = '#228b22'; ctx.lineWidth = 5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -62); ctx.stroke();
        ctx.strokeStyle = '#2ebb2e'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(2, -58); ctx.stroke();
        // Leaves
        ctx.fillStyle = '#1a7a1a';
        ctx.beginPath(); ctx.ellipse(-10, -30, 14, 6, -0.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(10, -44, 14, 6, 0.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#2ebb2e';
        ctx.beginPath(); ctx.ellipse(-6, -32, 6, 3, -0.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(6, -46, 6, 3, 0.5, 0, Math.PI * 2); ctx.fill();
        // Outer petals
        ctx.fillStyle = '#fbbf24';
        for (let p = 0; p < 12; p++) {
          const pa = p / 12 * Math.PI * 2;
          ctx.beginPath(); ctx.ellipse(Math.cos(pa) * 18, Math.sin(pa) * 18 - 62, 7, 4, pa, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = '#f59e0b';
        for (let p = 0; p < 12; p++) {
          const pa = (p + 0.5) / 12 * Math.PI * 2;
          ctx.beginPath(); ctx.ellipse(Math.cos(pa) * 13, Math.sin(pa) * 13 - 62, 5, 3, pa, 0, Math.PI * 2); ctx.fill();
        }
        // Center disk
        ctx.fillStyle = '#78350f'; ctx.beginPath(); ctx.arc(0, -62, 11, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#92400e'; ctx.beginPath(); ctx.arc(-2, -64, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#451a03';
        [[-3, -64], [3, -61], [0, -58], [-4, -59], [4, -66], [0, -68], [-2, -56]].forEach(([sx, sy]) => {
          ctx.beginPath(); ctx.arc(sx, sy, 1.5, 0, Math.PI * 2); ctx.fill();
        });
        ctx.restore();
        break;
      }

      case 'hibiscus': {
        gndShadow(26, 11, 4, 7);
        // Bush base
        [[8, 30, 22, '#0f5012'], [0, 28, 20, '#1a7a1a'], [-9, 26, 18, '#228b22'], [-18, 22, 15, '#33aa33']].forEach(([y, rx, ry, col]) => {
          ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(sway * 20, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
        });
        // Puff rim
        [[-28, 0, 13, 10], [28, 0, 13, 10], [-22, -12, 12, 9], [22, -12, 12, 9], [0, -20, 13, 10]].forEach(([px, py, prx, pry]) => {
          ctx.fillStyle = '#2ebb2e'; ctx.beginPath(); ctx.ellipse(px + sway * 15, py, prx, pry, sway * 0.2, 0, Math.PI * 2); ctx.fill();
        });
        // Flowers
        const hibColors = ['#ef4444', '#f97316', '#ec4899', '#e11d48', '#f43f5e'];
        [[-12, -4], [14, 2], [0, -14], [-18, -10], [16, -12]].forEach(([fx, fy], i) => {
          ctx.fillStyle = hibColors[i];
          for (let p = 0; p < 5; p++) {
            const pa = p / 5 * Math.PI * 2 + t * 0.04;
            ctx.beginPath(); ctx.ellipse(fx + Math.cos(pa) * 7, fy + Math.sin(pa) * 7, 5, 3, pa, 0, Math.PI * 2); ctx.fill();
          }
          ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.arc(fx, fy, 3, 0, Math.PI * 2); ctx.fill();
        });
        break;
      }

      case 'mossy_rock': {
        gndShadow(26, 11, 4, 5);
        // Isometric boulder — 3 faces
        ctx.fillStyle = '#4a4848';
        ctx.beginPath(); ctx.moveTo(-24, 0); ctx.lineTo(-24, -20); ctx.lineTo(0, -28); ctx.lineTo(0, -8); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#6a6868';
        ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(0, -28); ctx.lineTo(24, -20); ctx.lineTo(24, 0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#8e8c8c';
        ctx.beginPath(); ctx.moveTo(-24, -20); ctx.lineTo(0, -28); ctx.lineTo(24, -20); ctx.lineTo(0, -12); ctx.closePath(); ctx.fill();
        // Top highlight
        ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.beginPath(); ctx.ellipse(-4, -22, 10, 5, -0.3, 0, Math.PI * 2); ctx.fill();
        // Moss on top face
        ctx.fillStyle = '#3a8a1a'; ctx.beginPath(); ctx.ellipse(-5, -20, 8, 4, -0.3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(8, -22, 6, 3, 0.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#50aa22'; ctx.beginPath(); ctx.ellipse(-7, -21, 5, 2.5, -0.3, 0, Math.PI * 2); ctx.fill();
        // Crack
        ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(-2, -26); ctx.lineTo(4, -16); ctx.lineTo(8, -8); ctx.stroke();
        break;
      }

      case 'log_bench': {
        gndShadow(28, 10, 2, 5);
        // Back end cap
        ctx.fillStyle = '#7a4e1e'; ctx.beginPath(); ctx.ellipse(-24, -14, 6, 10, 0, 0, Math.PI * 2); ctx.fill();
        // Body
        ctx.fillStyle = '#a06830'; ctx.fillRect(-24, -24, 48, 20);
        // Top strip
        ctx.fillStyle = '#c08848'; ctx.fillRect(-20, -24, 44, 7);
        ctx.fillStyle = '#7a4e1e'; ctx.fillRect(-20, -17, 44, 4);
        // Front end cap (lighter face)
        ctx.fillStyle = '#b87840'; ctx.beginPath(); ctx.ellipse(24, -14, 6, 10, 0, 0, Math.PI * 2); ctx.fill();
        // Tree rings on front
        ctx.strokeStyle = '#8a5820'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(24, -14, 3, 5, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(24, -14, 5, 8, 0, 0, Math.PI * 2); ctx.stroke();
        // Legs
        ctx.fillStyle = '#8a5820'; ctx.fillRect(-18, 0, 8, 10); ctx.fillRect(10, 0, 8, 10);
        ctx.fillStyle = '#c88848';
        ctx.beginPath(); ctx.ellipse(-14, 0, 4, 2.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(14, 0, 4, 2.5, 0, 0, Math.PI * 2); ctx.fill();
        break;
      }

      case 'paper_lantern': {
        gndShadow(10, 4, 2, 4);
        // Post
        ctx.fillStyle = '#6b4220'; ctx.fillRect(-3, -72, 6, 72);
        ctx.fillStyle = '#4a2c14'; ctx.fillRect(-3, -72, 2.5, 72);
        ctx.fillStyle = '#8a5630'; ctx.fillRect(1.5, -68, 1.5, 64);
        ctx.fillStyle = '#5a3418'; ctx.beginPath(); ctx.ellipse(0, -72, 3, 1.5, 0, 0, Math.PI * 2); ctx.fill();
        // Glow aura
        const flick = 0.9 + Math.sin(t * 3.8 + phase) * 0.1;
        ctx.fillStyle = `rgba(255,170,40,${0.14 * flick})`;
        ctx.beginPath(); ctx.arc(0, -50, 28, 0, Math.PI * 2); ctx.fill();
        // Lantern top/bottom caps
        ctx.fillStyle = '#c89030';
        ctx.beginPath(); ctx.ellipse(0, -60, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(0, -36, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e0a840';
        ctx.beginPath(); ctx.ellipse(-3, -62, 6, 3, 0, 0, Math.PI * 2); ctx.fill();
        // Lantern body
        ctx.fillStyle = '#c0220e'; ctx.beginPath(); ctx.ellipse(0, -48, 8, 14, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#8a1008'; ctx.beginPath(); ctx.ellipse(-3, -48, 5, 14, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e8381a'; ctx.beginPath(); ctx.ellipse(2, -52, 4, 8, 0, 0, Math.PI * 2); ctx.fill();
        // Stripes
        ctx.strokeStyle = '#7a0e06'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(-8, -50); ctx.lineTo(8, -50); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-8, -46); ctx.lineTo(8, -46); ctx.stroke();
        // Inner glow
        ctx.fillStyle = `rgba(255,220,100,${0.5 * flick})`;
        ctx.beginPath(); ctx.ellipse(0, -50, 5, 9, 0, 0, Math.PI * 2); ctx.fill();
        // Tassel
        ctx.strokeStyle = '#c89030'; ctx.lineWidth = 1.5;
        [[-2, 0], [2, 0], [0, 2]].forEach(([tx]) => {
          ctx.beginPath(); ctx.moveTo(tx, -36); ctx.lineTo(tx, -28 + tx); ctx.stroke();
        });
        break;
      }

      case 'candle_post': {
        gndShadow(8, 3.5, 2, 4);
        // Post
        ctx.fillStyle = '#5a3414'; ctx.fillRect(-2.5, -52, 5, 52);
        ctx.fillStyle = '#3a1e08'; ctx.fillRect(-2.5, -52, 2, 52);
        ctx.fillStyle = '#7a4c24'; ctx.fillRect(1, -48, 1.5, 44);
        ctx.fillStyle = '#4a2c10'; ctx.beginPath(); ctx.ellipse(0, -52, 2.5, 1.2, 0, 0, Math.PI * 2); ctx.fill();
        // Holder plate
        ctx.fillStyle = '#999'; ctx.beginPath(); ctx.ellipse(0, -52, 7, 3.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#bbb'; ctx.beginPath(); ctx.ellipse(-2, -53, 4, 2, 0, 0, Math.PI * 2); ctx.fill();
        // Candle body
        ctx.fillStyle = '#fef9c3'; ctx.fillRect(-4, -64, 8, 12);
        ctx.fillStyle = '#fef3c7'; ctx.fillRect(-4, -64, 3, 12);
        ctx.fillStyle = '#fffde7'; ctx.fillRect(2, -62, 2, 8);
        ctx.fillStyle = '#fef9c3'; ctx.beginPath(); ctx.ellipse(0, -64, 4, 2, 0, 0, Math.PI * 2); ctx.fill();
        // Wax drip
        ctx.fillStyle = '#fef3c7'; ctx.beginPath(); ctx.ellipse(-3, -56, 2, 3, 0.3, 0, Math.PI * 2); ctx.fill();
        // Flame glow
        const fl = 0.85 + Math.sin(t * 4.8 + phase) * 0.15;
        ctx.fillStyle = `rgba(255,160,20,${0.25 * fl})`;
        ctx.beginPath(); ctx.arc(0, -68, 11, 0, Math.PI * 2); ctx.fill();
        // Flame
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath(); ctx.moveTo(0, -78); ctx.quadraticCurveTo(6, -71, 0, -64); ctx.quadraticCurveTo(-6, -71, 0, -78); ctx.fill();
        ctx.fillStyle = '#fed7aa';
        ctx.beginPath(); ctx.moveTo(0, -77); ctx.quadraticCurveTo(3, -72, 0, -66); ctx.quadraticCurveTo(-3, -72, 0, -77); ctx.fill();
        ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(0, -73, 1.5, 0, Math.PI * 2); ctx.fill();
        break;
      }

      case 'fountain': {
        gndShadow(34, 14, 5, 8);
        // Basin outer
        ctx.fillStyle = '#7a7068'; ctx.beginPath(); ctx.ellipse(0, 4, 34, 16, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#6a6058'; ctx.beginPath(); ctx.ellipse(0, 0, 34, 16, 0, 0, Math.PI * 2); ctx.fill();
        // Water
        ctx.fillStyle = '#3b82f6'; ctx.beginPath(); ctx.ellipse(0, -1, 26, 12, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#60a5fa'; ctx.beginPath(); ctx.ellipse(-3, -3, 14, 7, -0.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.ellipse(-6, -2, 8, 4, -0.3, 0, Math.PI * 2); ctx.fill();
        // Rim top
        ctx.fillStyle = '#9a9088'; ctx.beginPath(); ctx.ellipse(0, 0, 34, 16, 0, Math.PI, 2 * Math.PI); ctx.fill();
        ctx.fillStyle = '#c0b8a8'; ctx.beginPath(); ctx.ellipse(-2, -1, 14, 7, -0.1, 0, Math.PI * 2); ctx.fill();
        // Column
        ctx.fillStyle = '#9a9088'; ctx.fillRect(-4, -32, 8, 30);
        ctx.fillStyle = '#7a7068'; ctx.fillRect(-4, -32, 3, 30);
        ctx.fillStyle = '#b0a898'; ctx.beginPath(); ctx.ellipse(0, -32, 5, 2.5, 0, 0, Math.PI * 2); ctx.fill();
        // Animated water arcs
        for (let wa = 0; wa < 6; wa++) {
          const waPhase = wa / 6 * Math.PI * 2 + t * 1.2;
          const waProg = (t * 0.85 + wa * 0.166) % 1;
          const wx = Math.cos(waPhase) * 22 * waProg;
          const wy = -32 + 32 * waProg - Math.sin(waProg * Math.PI) * 22;
          ctx.fillStyle = `rgba(147,210,255,${(1 - waProg) * 0.85})`;
          ctx.beginPath(); ctx.arc(wx, wy, 2.5 * (1 - waProg * 0.4), 0, Math.PI * 2); ctx.fill();
        }
        break;
      }

      case 'planter': {
        gndShadow(14, 6, 2, 4);
        // Post
        ctx.fillStyle = '#6b4a2a'; ctx.fillRect(-2, -70, 4, 50);
        ctx.fillStyle = '#4a3018'; ctx.fillRect(-2, -70, 1.5, 50);
        // Hook arm
        ctx.strokeStyle = '#8b6a3a'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(0, -66); ctx.lineTo(14, -62); ctx.lineTo(14, -52); ctx.stroke();
        // Pot
        ctx.fillStyle = '#c06030';
        ctx.beginPath(); ctx.moveTo(5, -52); ctx.lineTo(23, -52); ctx.lineTo(20, -32); ctx.lineTo(8, -32); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#8a4020';
        ctx.beginPath(); ctx.moveTo(5, -52); ctx.lineTo(8, -32); ctx.lineTo(12, -32); ctx.lineTo(9, -52); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#d87040'; ctx.beginPath(); ctx.ellipse(14, -52, 9, 4.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e88050'; ctx.beginPath(); ctx.ellipse(12, -54, 5.5, 2.8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#5c3810'; ctx.beginPath(); ctx.ellipse(14, -52, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
        // Trailing vines
        [[0.3, 24], [-0.1, 28], [0.7, 22]].forEach(([a, len], i) => {
          const vs = Math.sin(t * (0.5 + i * 0.1) + i) * sway * 0.6;
          ctx.strokeStyle = '#2a7a18'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(14, -32);
          ctx.quadraticCurveTo(14 + Math.cos(a + vs) * len * 0.5, -32 + len * 0.4, 14 + Math.cos(a + vs) * len, -32 + len * 0.85);
          ctx.stroke();
          ctx.fillStyle = '#38a022';
          ctx.beginPath(); ctx.ellipse(14 + Math.cos(a + vs) * len * 0.7, -32 + len * 0.6, 7, 4, a + vs, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.ellipse(14 + Math.cos(a + vs) * len, -32 + len * 0.85, 6, 3.5, a + vs + 0.5, 0, Math.PI * 2); ctx.fill();
        });
        break;
      }

      case 'clay_vase': {
        gndShadow(12, 5, 2, 4);
        // Base
        ctx.fillStyle = '#7a3c14'; ctx.fillRect(-6, -4, 12, 4);
        ctx.fillStyle = '#c06030'; ctx.beginPath(); ctx.ellipse(0, -4, 6, 3, 0, 0, Math.PI * 2); ctx.fill();
        // Lower body
        ctx.fillStyle = '#b85820';
        ctx.beginPath(); ctx.moveTo(-8, -4); ctx.lineTo(-13, -28); ctx.lineTo(13, -28); ctx.lineTo(8, -4); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#8a3e14';
        ctx.beginPath(); ctx.moveTo(-8, -4); ctx.lineTo(-13, -28); ctx.lineTo(-8, -28); ctx.lineTo(-3, -4); ctx.closePath(); ctx.fill();
        // Top ellipse of lower body
        ctx.fillStyle = '#cc6438'; ctx.beginPath(); ctx.ellipse(0, -28, 13, 6, 0, 0, Math.PI * 2); ctx.fill();
        // Neck
        ctx.fillStyle = '#c06030'; ctx.fillRect(-5, -38, 10, 10);
        ctx.fillStyle = '#8a3e14'; ctx.fillRect(-5, -38, 4, 10);
        ctx.fillStyle = '#cc6c38'; ctx.beginPath(); ctx.ellipse(0, -38, 5, 2.5, 0, 0, Math.PI * 2); ctx.fill();
        // Lip
        ctx.fillStyle = '#b85820'; ctx.fillRect(-7, -42, 14, 4);
        ctx.fillStyle = '#d47040'; ctx.beginPath(); ctx.ellipse(0, -42, 7, 3.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#5a2808'; ctx.beginPath(); ctx.ellipse(0, -42, 5, 2.5, 0, 0, Math.PI * 2); ctx.fill();
        // Decorative bands
        ctx.strokeStyle = '#f09050'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-12, -14); ctx.lineTo(12, -14); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-12, -18); ctx.lineTo(12, -18); ctx.stroke();
        // Diamond pattern
        ctx.fillStyle = '#e07838';
        [[-4, -11], [4, -11], [0, -22]].forEach(([dx, dy]) => {
          ctx.save(); ctx.translate(dx, dy); ctx.rotate(0.785); ctx.fillRect(-2.5, -2.5, 5, 5); ctx.restore();
        });
        break;
      }

      case 'moon_shrine': {
        gndShadow(28, 12, 4, 6);
        // Two pillars
        [-16, 16].forEach(px => {
          ctx.fillStyle = '#c8b888'; ctx.fillRect(px - 4, -72, 8, 72);
          ctx.fillStyle = '#9a8c5c'; ctx.fillRect(px - 4, -72, 3, 72);
          ctx.fillStyle = '#ddd098'; ctx.fillRect(px + 2, -68, 2, 64);
          ctx.fillStyle = '#b8a870'; ctx.beginPath(); ctx.ellipse(px, -72, 4, 2, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#ddd098'; ctx.fillRect(px - 6, -2, 12, 2);
          ctx.beginPath(); ctx.ellipse(px, -2, 6, 3, 0, 0, Math.PI * 2); ctx.fill();
        });
        // Top beam
        ctx.fillStyle = '#c8b888'; ctx.fillRect(-22, -80, 44, 8);
        ctx.fillStyle = '#9a8c5c'; ctx.fillRect(-22, -80, 8, 8);
        ctx.fillStyle = '#ddd098'; ctx.fillRect(-22, -80, 44, 3);
        ctx.fillStyle = '#b8a870'; ctx.beginPath(); ctx.ellipse(0, -80, 22, 5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ddd098'; ctx.beginPath(); ctx.ellipse(-5, -82, 12, 3, 0, 0, Math.PI * 2); ctx.fill();
        // Moon glow
        const mb = 0.85 + Math.sin(t * 0.8 + phase) * 0.15;
        ctx.fillStyle = `rgba(139,92,246,${0.22 * mb})`;
        ctx.beginPath(); ctx.arc(0, -56, 18, 0, Math.PI * 2); ctx.fill();
        // Moon crescent
        ctx.fillStyle = '#c4b5fd'; ctx.beginPath(); ctx.arc(0, -56, 13, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#7c3aed'; ctx.beginPath(); ctx.arc(5, -54, 10, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ede9fe'; ctx.beginPath(); ctx.arc(-2, -60, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(-3, -62, 3, 0, Math.PI * 2); ctx.fill();
        // Stars
        ctx.fillStyle = '#e9d5ff';
        [[-22, -50], [22, -48], [-24, -64], [24, -66], [0, -88]].forEach(([sx, sy]) => {
          const ss = 0.6 + Math.sin(t * 2.2 + sx) * 0.4;
          ctx.globalAlpha = ss;
          ctx.beginPath(); ctx.arc(sx, sy, 1.8, 0, Math.PI * 2); ctx.fill();
        });
        ctx.globalAlpha = 1;
        break;
      }

      case 'wood_fence': {
        gndShadow(26, 9, 2, 5);
        // Rails
        ctx.fillStyle = '#9a6a2a'; ctx.fillRect(-24, -20, 48, 5); ctx.fillRect(-24, -10, 48, 5);
        ctx.fillStyle = '#6a4a18'; ctx.fillRect(-24, -20, 8, 5); ctx.fillRect(-24, -10, 8, 5);
        ctx.fillStyle = '#c89040'; ctx.fillRect(-22, -20, 48, 2); ctx.fillRect(-22, -10, 48, 2);
        // Pickets
        [-16, 0, 16].forEach(px => {
          ctx.fillStyle = '#9a6a2a'; ctx.fillRect(px - 4, -40, 8, 44);
          ctx.fillStyle = '#6a4a18'; ctx.fillRect(px - 4, -40, 3, 44);
          ctx.fillStyle = '#c89040'; ctx.fillRect(px + 2, -36, 2, 36);
          // Pointed top
          ctx.fillStyle = '#9a6a2a';
          ctx.beginPath(); ctx.moveTo(px, -46); ctx.lineTo(px - 4, -40); ctx.lineTo(px + 4, -40); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#c89040'; ctx.beginPath(); ctx.ellipse(px, -46, 4, 2, 0, 0, Math.PI * 2); ctx.fill();
        });
        // Wood grain
        ctx.strokeStyle = 'rgba(80,50,10,0.22)'; ctx.lineWidth = 1;
        [-16, 0, 16].forEach(px => { ctx.beginPath(); ctx.moveTo(px - 1, -38); ctx.lineTo(px - 1, -6); ctx.stroke(); });
        break;
      }

      case 'tulip_patch': {
        gndShadow(20, 8, 2, 4);
        const tulipColors = ['#ef4444','#ec4899','#fbbf24','#f97316','#e11d48'];
        [[-10,-2],[10,0],[0,2],[-4,-4],[6,-3]].forEach(([tx,ty],i) => {
          const ts = Math.sin(t*(0.6+i*0.1)+i)*sway*0.9;
          ctx.save(); ctx.translate(tx,ty); ctx.rotate(ts);
          ctx.strokeStyle='#228b22'; ctx.lineWidth=2; ctx.lineCap='round';
          ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-22); ctx.stroke();
          ctx.fillStyle='#2ebb22'; ctx.beginPath(); ctx.ellipse(-5,-12,8,3,0.6,0,Math.PI*2); ctx.fill();
          ctx.fillStyle=tulipColors[i];
          ctx.beginPath(); ctx.ellipse(0,-22,5,7,0,0,Math.PI*2); ctx.fill();
          ctx.fillStyle='rgba(255,255,255,0.28)'; ctx.beginPath(); ctx.ellipse(-1,-24,2.5,3,0,0,Math.PI*2); ctx.fill();
          ctx.restore();
        });
        break;
      }

      case 'lavender_bush': {
        gndShadow(22, 9, 2, 4);
        ctx.fillStyle='#2a7a22'; ctx.beginPath(); ctx.ellipse(0,-4,20,12,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#38aa28'; ctx.beginPath(); ctx.ellipse(-3,-6,14,9,0,0,Math.PI*2); ctx.fill();
        [[-14,0],[-8,-2],[0,-4],[8,-2],[14,0],[-5,2],[5,2]].forEach(([lx,ly],i) => {
          const ls = Math.sin(t*(0.5+i*0.08)+i*0.9)*sway;
          ctx.save(); ctx.translate(lx,ly); ctx.rotate(ls);
          ctx.strokeStyle='#8a6a2a'; ctx.lineWidth=1.5; ctx.lineCap='round';
          ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-18); ctx.stroke();
          for(let s=0;s<5;s++) {
            const sz = 3-s*0.3;
            ctx.fillStyle = s<2 ? '#c084fc' : '#a855f7';
            ctx.beginPath(); ctx.ellipse(0,-8-s*2,sz,sz*1.2,0,0,Math.PI*2); ctx.fill();
          }
          ctx.restore();
        });
        break;
      }

      case 'mushroom_ring': {
        gndShadow(28, 11, 2, 5);
        const mg = 0.5+Math.sin(t*0.7+phase)*0.2;
        ctx.fillStyle=`rgba(180,255,140,${0.12*mg})`; ctx.beginPath(); ctx.ellipse(0,-4,26,14,0,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle=`rgba(100,200,80,${0.35*mg})`; ctx.lineWidth=2;
        ctx.beginPath(); ctx.ellipse(0,-2,20,10,0,0,Math.PI*2); ctx.stroke();
        for(let m=0;m<7;m++) {
          const ma=m/7*Math.PI*2; const mx=Math.cos(ma)*18, my=Math.sin(ma)*9-4;
          const sc=0.7+m%3*0.2;
          ctx.save(); ctx.translate(mx,my); ctx.scale(sc,sc);
          ctx.fillStyle='#f0ead8'; ctx.fillRect(-3,-12,6,12);
          ctx.fillStyle='#c8c0a8'; ctx.fillRect(-3,-12,2,12);
          ctx.fillStyle=m%2===0?'#c81808':'#8b4513';
          ctx.beginPath(); ctx.ellipse(0,-12,8,5,0,0,Math.PI*2); ctx.fill();
          ctx.fillStyle='rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(-2,-13,2,0,Math.PI*2); ctx.fill();
          ctx.restore();
        }
        break;
      }

      case 'lotus_pond': {
        gndShadow(36, 15, 4, 8);
        ctx.fillStyle='#1e4080'; ctx.beginPath(); ctx.ellipse(0,4,34,16,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#2b5fa0'; ctx.beginPath(); ctx.ellipse(0,2,34,16,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#3b7fd0'; ctx.beginPath(); ctx.ellipse(-4,0,22,11,0,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle='rgba(100,180,255,0.3)'; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.ellipse(0,2,18,9,-0.1,0,Math.PI*2); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(0,2,28,13,-0.1,0,Math.PI*2); ctx.stroke();
        ctx.fillStyle='rgba(180,230,255,0.25)'; ctx.beginPath(); ctx.ellipse(-6,0,10,5,-0.2,0,Math.PI*2); ctx.fill();
        [[-12,2],[12,0],[2,-4]].forEach(([lx,ly]) => {
          ctx.fillStyle='#2a8a22'; ctx.beginPath(); ctx.ellipse(lx,ly,8,5,0,0,Math.PI*2); ctx.fill();
          ctx.fillStyle='#38aa2a'; ctx.beginPath(); ctx.ellipse(lx-2,ly-1,5,3,-0.2,0,Math.PI*2); ctx.fill();
          ctx.fillStyle='#2b5fa0'; ctx.beginPath(); ctx.moveTo(lx,ly); ctx.lineTo(lx+4,ly-4); ctx.lineTo(lx+4,ly+4); ctx.closePath(); ctx.fill();
        });
        [[-12,2],[2,-4]].forEach(([lx,ly],li) => {
          const lw=Math.sin(t*(0.4+li*0.1)+li)*0.04;
          ctx.save(); ctx.translate(lx,ly-6); ctx.rotate(lw);
          ctx.fillStyle='#fda4af';
          for(let p=0;p<6;p++) { const pa=p/6*Math.PI*2; ctx.beginPath(); ctx.ellipse(Math.cos(pa)*7,Math.sin(pa)*4,4,3,pa,0,Math.PI*2); ctx.fill(); }
          ctx.fillStyle='#fce7f3';
          for(let p=0;p<4;p++) { const pa=p/4*Math.PI*2+0.4; ctx.beginPath(); ctx.ellipse(Math.cos(pa)*4,Math.sin(pa)*2.5,3,2,pa,0,Math.PI*2); ctx.fill(); }
          ctx.fillStyle='#fef08a'; ctx.beginPath(); ctx.arc(0,0,3,0,Math.PI*2); ctx.fill();
          ctx.restore();
        });
        ctx.strokeStyle='rgba(30,64,128,0.5)'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.ellipse(0,2,34,16,0,0,Math.PI*2); ctx.stroke();
        break;
      }

      case 'bonsai': {
        gndShadow(24, 10, 2, 4);
        ctx.fillStyle='#7a4e1e'; ctx.fillRect(-18,-8,36,8);
        ctx.fillStyle='#5a3414'; ctx.fillRect(-18,-8,6,8);
        ctx.fillStyle='#9a6830'; ctx.beginPath(); ctx.ellipse(0,-8,18,5,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#b88040'; ctx.beginPath(); ctx.ellipse(-4,-10,10,3,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#5a3414'; ctx.fillRect(-16,0,5,8); ctx.fillRect(11,0,5,8);
        ctx.fillStyle='#4a7a9a';
        ctx.beginPath(); ctx.moveTo(-10,-8); ctx.lineTo(10,-8); ctx.lineTo(8,-22); ctx.lineTo(-8,-22); ctx.closePath(); ctx.fill();
        ctx.fillStyle='#2a5a7a';
        ctx.beginPath(); ctx.moveTo(-10,-8); ctx.lineTo(-8,-22); ctx.lineTo(-4,-22); ctx.lineTo(-6,-8); ctx.closePath(); ctx.fill();
        ctx.fillStyle='#5a9ab8'; ctx.beginPath(); ctx.ellipse(0,-22,8,4,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#5a2808'; ctx.beginPath(); ctx.ellipse(0,-22,6,3,0,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle='#5a3010'; ctx.lineWidth=5; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(0,-22); ctx.quadraticCurveTo(-6,-34,2,-46); ctx.quadraticCurveTo(8,-54,-2,-60); ctx.stroke();
        ctx.strokeStyle='#7a4820'; ctx.lineWidth=3;
        ctx.beginPath(); ctx.moveTo(1,-22); ctx.quadraticCurveTo(-5,-34,3,-46); ctx.stroke();
        ctx.strokeStyle='#5a3010'; ctx.lineWidth=3; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(-2,-46); ctx.quadraticCurveTo(-14,-46,-18,-40); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(2,-54); ctx.quadraticCurveTo(12,-50,16,-44); ctx.stroke();
        const bc = ['#1a6a1a','#228b22','#2ebb2e','#38d038'];
        [[-2,-62,12],[14,-44,9],[-18,-40,9],[6,-50,8]].forEach(([cx,cy,cr],ci) => {
          ctx.fillStyle=bc[ci%4]; ctx.beginPath(); ctx.arc(cx,cy,cr,0,Math.PI*2); ctx.fill();
          ctx.fillStyle='rgba(100,200,80,0.3)'; ctx.beginPath(); ctx.arc(cx-2,cy-2,cr*0.5,0,Math.PI*2); ctx.fill();
        });
        break;
      }

      case 'wildflower_bed': {
        gndShadow(26, 11, 2, 5);
        ctx.fillStyle='#5a3a18'; ctx.beginPath(); ctx.ellipse(0,4,24,13,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#7a5028'; ctx.beginPath(); ctx.ellipse(0,2,24,13,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#6a4020'; ctx.beginPath(); ctx.ellipse(-4,1,14,8,-0.1,0,Math.PI*2); ctx.fill();
        const wfc=['#ef4444','#fbbf24','#60a5fa','#f472b6','#a78bfa','#34d399','#fb923c'];
        [[-16,-6],[-8,-8],[2,-10],[12,-8],[18,-6],[-12,-3],[6,-4],[18,-2],[-6,0],[14,-2],[-18,-1],[0,-2]].forEach(([wx,wy],i) => {
          const ws = Math.sin(t*(0.5+i*0.07)+i)*sway*0.7;
          ctx.save(); ctx.translate(wx,wy); ctx.rotate(ws);
          ctx.strokeStyle='#2a8a18'; ctx.lineWidth=1.5; ctx.lineCap='round';
          ctx.beginPath(); ctx.moveTo(0,4); ctx.lineTo(0,-12); ctx.stroke();
          ctx.fillStyle=wfc[i%wfc.length];
          for(let p=0;p<5;p++) { const pa=p/5*Math.PI*2; ctx.beginPath(); ctx.ellipse(Math.cos(pa)*4,Math.sin(pa)*4-12,3,2,pa,0,Math.PI*2); ctx.fill(); }
          ctx.fillStyle='rgba(255,255,200,0.9)'; ctx.beginPath(); ctx.arc(0,-12,2,0,Math.PI*2); ctx.fill();
          ctx.restore();
        });
        break;
      }

      case 'clover_patch': {
        gndShadow(22, 9, 2, 4);
        ctx.fillStyle='#1a7a18'; ctx.beginPath(); ctx.ellipse(0,2,20,10,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#2abb22'; ctx.beginPath(); ctx.ellipse(-2,0,16,8,0,0,Math.PI*2); ctx.fill();
        [[-14,-2],[-6,-5],[2,-8],[10,-5],[16,-2],[-10,0],[6,-1],[14,-1],[-4,2],[12,1]].forEach(([cx,cy],i) => {
          const cs = Math.sin(t*(0.45+i*0.08)+i)*sway*0.5;
          ctx.save(); ctx.translate(cx,cy); ctx.rotate(cs);
          ctx.strokeStyle='#228b22'; ctx.lineWidth=1.2; ctx.lineCap='round';
          ctx.beginPath(); ctx.moveTo(0,4); ctx.lineTo(0,-2); ctx.stroke();
          const lc = i%5===0 ? 4 : 3;
          for(let l=0;l<lc;l++) {
            const la=l/lc*Math.PI*2;
            ctx.fillStyle=i%3===0?'#38c028':'#2abb22';
            ctx.beginPath(); ctx.ellipse(Math.cos(la)*4,Math.sin(la)*4-2,4,3,la,0,Math.PI*2); ctx.fill();
          }
          if(lc===4) { ctx.fillStyle='rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.ellipse(0,-2,2,5,0,0,Math.PI*2); ctx.fill(); }
          ctx.restore();
        });
        break;
      }

      case 'pine_sapling': {
        gndShadow(12, 5, 2, 3);
        const psw = Math.sin(t*0.5+phase)*0.04;
        ctx.save(); ctx.rotate(psw);
        ctx.fillStyle='#7a4820'; ctx.fillRect(-3,0,6,8);
        ctx.fillStyle='#5a3010'; ctx.fillRect(-3,0,2,8);
        ctx.fillStyle='#0a5012';
        ctx.beginPath(); ctx.moveTo(0,-20); ctx.lineTo(-16,-4); ctx.lineTo(16,-4); ctx.closePath(); ctx.fill();
        ctx.fillStyle='#0f6518';
        ctx.beginPath(); ctx.moveTo(0,-32); ctx.lineTo(-12,-18); ctx.lineTo(12,-18); ctx.closePath(); ctx.fill();
        ctx.fillStyle='#1a7a22';
        ctx.beginPath(); ctx.moveTo(0,-44); ctx.lineTo(-8,-30); ctx.lineTo(8,-30); ctx.closePath(); ctx.fill();
        ctx.fillStyle='rgba(80,200,80,0.3)';
        ctx.beginPath(); ctx.moveTo(0,-20); ctx.lineTo(4,-6); ctx.lineTo(0,-4); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(0,-32); ctx.lineTo(4,-19); ctx.lineTo(0,-18); ctx.closePath(); ctx.fill();
        ctx.fillStyle='#a0d8ef'; ctx.beginPath(); ctx.arc(0,-44,2.5,0,Math.PI*2); ctx.fill();
        ctx.restore();
        break;
      }

      case 'garden_chair': {
        gndShadow(22, 9, 2, 4);
        ctx.fillStyle='#7a5a2a';
        ctx.fillRect(-16,0,5,14); ctx.fillRect(11,0,5,14);
        ctx.fillRect(-14,-8,5,8); ctx.fillRect(9,-8,5,8);
        ctx.fillStyle='#c08848'; ctx.fillRect(-16,-8,32,4);
        ctx.fillStyle='#9a6830'; ctx.fillRect(-16,-8,6,4);
        ctx.fillStyle='#daa050'; ctx.fillRect(-12,-8,32,2);
        ctx.fillStyle='#a06830'; ctx.fillRect(-14,-30,4,22); ctx.fillRect(10,-30,4,22);
        ctx.fillStyle='#c08848'; ctx.fillRect(-14,-30,28,4);
        ctx.fillStyle='#a06830'; ctx.fillRect(-14,-24,28,3); ctx.fillRect(-14,-18,28,3);
        ctx.fillStyle='#7a4e1e'; ctx.beginPath(); ctx.ellipse(0,-30,14,3,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#c08848'; ctx.beginPath(); ctx.ellipse(-4,-32,8,2,0,0,Math.PI*2); ctx.fill();
        break;
      }

      case 'garden_swing': {
        gndShadow(34, 13, 4, 6);
        [-20,20].forEach(px => {
          ctx.fillStyle='#7a5a2a'; ctx.fillRect(px-3,-72,6,72);
          ctx.fillStyle='#5a3a18'; ctx.fillRect(px-3,-72,2,72);
          ctx.fillStyle='#9a7a3a'; ctx.fillRect(px+1,-68,2,64);
          ctx.fillStyle='#6a4a20'; ctx.beginPath(); ctx.ellipse(px,-72,3,1.5,0,0,Math.PI*2); ctx.fill();
        });
        ctx.fillStyle='#a07040'; ctx.fillRect(-23,-74,46,5);
        ctx.fillStyle='#7a5020'; ctx.fillRect(-23,-74,8,5);
        ctx.fillStyle='#c09050'; ctx.fillRect(-20,-74,46,2);
        ctx.fillStyle='#8a6030'; ctx.beginPath(); ctx.ellipse(0,-74,23,4,0,0,Math.PI*2); ctx.fill();
        const swAngle = Math.sin(t*0.6+phase)*0.15;
        ctx.save(); ctx.translate(0,-52); ctx.rotate(swAngle);
        ctx.strokeStyle='#c8a040'; ctx.lineWidth=2; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(-12,-22); ctx.lineTo(-12,0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(12,-22); ctx.lineTo(12,0); ctx.stroke();
        ctx.fillStyle='#a07040'; ctx.fillRect(-14,0,28,6);
        ctx.fillStyle='#7a5020'; ctx.fillRect(-14,0,5,6);
        ctx.fillStyle='#c09050'; ctx.fillRect(-12,0,28,2);
        ctx.fillStyle='#b88040'; ctx.beginPath(); ctx.ellipse(0,0,14,3.5,0,0,Math.PI*2); ctx.fill();
        ctx.restore();
        break;
      }

      case 'bird_bath': {
        gndShadow(22, 9, 2, 4);
        ctx.fillStyle='#8a8078'; ctx.fillRect(-4,0,8,16);
        ctx.fillStyle='#6a6058'; ctx.fillRect(-4,0,3,16);
        ctx.fillStyle='#aaa098'; ctx.fillRect(1,-1,2,14);
        ctx.fillStyle='#9a9088'; ctx.fillRect(-10,-2,20,4);
        ctx.fillStyle='#7a7068'; ctx.fillRect(-10,-2,6,4);
        ctx.fillStyle='#b0a898'; ctx.beginPath(); ctx.ellipse(0,-2,10,3,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#8a8078'; ctx.beginPath(); ctx.ellipse(0,-18,22,11,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#6a6058'; ctx.beginPath(); ctx.ellipse(-4,-16,12,6,-0.2,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#5b93d0'; ctx.beginPath(); ctx.ellipse(0,-20,16,8,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#7ab0e0'; ctx.beginPath(); ctx.ellipse(-3,-22,8,4,-0.2,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.ellipse(-5,-22,5,2.5,-0.3,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#aaa098'; ctx.beginPath(); ctx.ellipse(0,-20,22,11,0,Math.PI,2*Math.PI); ctx.fill();
        ctx.fillStyle='#c0b8a8'; ctx.beginPath(); ctx.ellipse(-3,-21,10,5,-0.1,0,Math.PI*2); ctx.fill();
        const bd = Math.sin(t*0.8+phase)*0.08;
        ctx.save(); ctx.translate(6,-24); ctx.rotate(bd);
        ctx.fillStyle='#60a5fa'; ctx.beginPath(); ctx.ellipse(0,0,5,3,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#93c5fd'; ctx.beginPath(); ctx.ellipse(-1,-1,3,2,-0.3,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#fbbf24'; ctx.beginPath(); ctx.ellipse(4,0,2,1,0.4,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#1e3a5f'; ctx.beginPath(); ctx.arc(3,-1,1,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#3b82f6'; ctx.beginPath(); ctx.ellipse(0,1,4,1.5,0.3,0,Math.PI*2); ctx.fill();
        ctx.restore();
        break;
      }

      case 'scarecrow': {
        gndShadow(18, 7, 2, 4);
        const scw = Math.sin(t*0.4+phase)*0.06;
        ctx.save(); ctx.rotate(scw);
        ctx.fillStyle='#8a6030'; ctx.fillRect(-2.5,-68,5,68);
        ctx.fillStyle='#6a4020'; ctx.fillRect(-2.5,-68,2,68);
        ctx.fillStyle='#a07840'; ctx.fillRect(0.5,-64,1.5,60);
        ctx.fillStyle='#8a6030'; ctx.fillRect(-22,-46,44,4);
        ctx.fillStyle='#6a4020'; ctx.fillRect(-22,-46,7,4);
        ctx.fillStyle='#3a2810';
        ctx.beginPath(); ctx.ellipse(0,-70,14,5,0,0,Math.PI*2); ctx.fill();
        ctx.fillRect(-9,-88,18,18);
        ctx.fillStyle='#5a4020'; ctx.fillRect(-9,-88,6,18);
        ctx.fillStyle='#6a5030'; ctx.beginPath(); ctx.ellipse(-3,-70,8,3,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#f5e0a0'; ctx.beginPath(); ctx.arc(0,-66,10,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#e0c080'; ctx.beginPath(); ctx.arc(-2,-67,7,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#3a2810';
        ctx.beginPath(); ctx.arc(-3,-68,2,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(3,-68,2,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle='#3a2810'; ctx.lineWidth=1.5; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(-3,-62); ctx.lineTo(-1,-60); ctx.lineTo(1,-60); ctx.lineTo(3,-62); ctx.stroke();
        ctx.fillStyle='#e07030'; ctx.fillRect(-8,-52,8,20);
        ctx.fillStyle='#d06020'; ctx.fillRect(-8,-52,3,20);
        ctx.fillStyle='#f08040'; ctx.fillRect(-5,-51,8,18);
        ctx.fillStyle='#c05818'; ctx.fillRect(-7,-46,5,4); ctx.fillRect(1,-42,4,4);
        ctx.fillStyle='#3060a0'; ctx.fillRect(-7,-32,14,20);
        ctx.fillStyle='#204888'; ctx.fillRect(-7,-32,5,20);
        ctx.strokeStyle='#c8a030'; ctx.lineWidth=1.5; ctx.lineCap='round';
        [[-16,-44],[-20,-38],[16,-44],[20,-38]].forEach(([sx,sy]) => {
          ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(sx+(sx<0?-4:4),sy+8); ctx.stroke();
        });
        ctx.restore();
        break;
      }

      case 'stone_well': {
        gndShadow(26, 11, 4, 6);
        ctx.fillStyle='#6a6058'; ctx.beginPath(); ctx.ellipse(0,2,28,14,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#5a5048'; ctx.beginPath(); ctx.ellipse(0,0,28,14,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#8a8070'; ctx.fillRect(-22,-28,44,28);
        ctx.fillStyle='#6a6050'; ctx.fillRect(-22,-28,8,28);
        ctx.fillStyle='#aaa888'; ctx.fillRect(-16,-28,44,8);
        ctx.fillStyle='#1a1818'; ctx.beginPath(); ctx.ellipse(0,-28,18,9,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#0a100a'; ctx.beginPath(); ctx.ellipse(0,-30,12,6,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#9a9888'; ctx.beginPath(); ctx.ellipse(0,-28,22,11,0,Math.PI,2*Math.PI); ctx.fill();
        ctx.fillStyle='#b8b0a0'; ctx.beginPath(); ctx.ellipse(-4,-29,12,6,-0.1,0,Math.PI*2); ctx.fill();
        [-18,18].forEach(px => {
          ctx.fillStyle='#8a6030'; ctx.fillRect(px-3,-60,6,32);
          ctx.fillStyle='#6a4020'; ctx.fillRect(px-3,-60,2,32);
        });
        ctx.fillStyle='#a07040'; ctx.fillRect(-22,-62,44,5);
        ctx.fillStyle='#7a5020'; ctx.fillRect(-22,-62,8,5);
        ctx.fillStyle='#c09050'; ctx.beginPath(); ctx.ellipse(0,-62,22,5,0,0,Math.PI*2); ctx.fill();
        const wb = Math.sin(t*0.3+phase)*0.06;
        ctx.save(); ctx.translate(0,-36); ctx.rotate(wb);
        ctx.strokeStyle='#c8a030'; ctx.lineWidth=2; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(0,-24); ctx.lineTo(0,0); ctx.stroke();
        ctx.fillStyle='#a06030'; ctx.fillRect(-5,0,10,8);
        ctx.fillStyle='#7a4020'; ctx.fillRect(-5,0,3.5,8);
        ctx.fillStyle='#b87040'; ctx.beginPath(); ctx.ellipse(0,0,5,2.5,0,0,Math.PI*2); ctx.fill();
        ctx.restore();
        break;
      }

      case 'barrel': {
        gndShadow(18, 8, 2, 4);
        ctx.fillStyle='#5a3818';
        ctx.beginPath(); ctx.moveTo(-14,0); ctx.lineTo(-14,-28); ctx.lineTo(0,-34); ctx.lineTo(0,-6); ctx.closePath(); ctx.fill();
        ctx.fillStyle='#8a5a28';
        ctx.beginPath(); ctx.moveTo(0,-6); ctx.lineTo(0,-34); ctx.lineTo(14,-28); ctx.lineTo(14,0); ctx.closePath(); ctx.fill();
        ctx.fillStyle='#a87040'; ctx.beginPath(); ctx.ellipse(0,-34,14,7,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#c8904a'; ctx.beginPath(); ctx.ellipse(-4,-36,8,4,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#6a441e';
        ctx.beginPath(); ctx.moveTo(-17,-8); ctx.lineTo(-17,-20); ctx.lineTo(-14,-20); ctx.lineTo(-14,-8); ctx.closePath(); ctx.fill();
        ctx.fillStyle='#9a6830';
        ctx.beginPath(); ctx.moveTo(14,-8); ctx.lineTo(14,-20); ctx.lineTo(17,-20); ctx.lineTo(17,-8); ctx.closePath(); ctx.fill();
        ctx.strokeStyle='#4a3010'; ctx.lineWidth=2; ctx.lineCap='butt';
        ctx.beginPath(); ctx.moveTo(-14,-6); ctx.lineTo(0,-12); ctx.lineTo(14,-6); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-14,-22); ctx.lineTo(0,-28); ctx.lineTo(14,-22); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-14,-14); ctx.lineTo(0,-20); ctx.lineTo(14,-14); ctx.stroke();
        ctx.strokeStyle='rgba(180,140,60,0.4)'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(-11,-6); ctx.lineTo(2,-12); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-11,-22); ctx.lineTo(2,-28); ctx.stroke();
        break;
      }

      case 'crate_stack': {
        gndShadow(24, 10, 2, 4);
        const isoBox = (cx, cy, w, h) => {
          const d = w * 0.35;
          ctx.fillStyle='#7a5020';
          ctx.beginPath(); ctx.moveTo(cx-w,cy); ctx.lineTo(cx-w,cy-h); ctx.lineTo(cx,cy-h-d); ctx.lineTo(cx,cy-d); ctx.closePath(); ctx.fill();
          ctx.fillStyle='#a07038';
          ctx.beginPath(); ctx.moveTo(cx,cy-d); ctx.lineTo(cx,cy-h-d); ctx.lineTo(cx+w,cy-h); ctx.lineTo(cx+w,cy); ctx.closePath(); ctx.fill();
          ctx.fillStyle='#c08840';
          ctx.beginPath(); ctx.moveTo(cx-w,cy-h); ctx.lineTo(cx,cy-h-d); ctx.lineTo(cx+w,cy-h); ctx.lineTo(cx,cy-h+d); ctx.closePath(); ctx.fill();
          ctx.strokeStyle='rgba(0,0,0,0.22)'; ctx.lineWidth=1;
          ctx.beginPath(); ctx.moveTo(cx-w,cy-h*0.5); ctx.lineTo(cx,cy-h*0.5-d); ctx.lineTo(cx+w,cy-h*0.5); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(cx,cy-d); ctx.lineTo(cx,cy-h-d); ctx.stroke();
        };
        isoBox(0, 2, 16, 18);
        isoBox(-2, -16, 12, 14);
        isoBox(-4, -28, 9, 10);
        break;
      }

      case 'hammock': {
        gndShadow(38, 15, 4, 7);
        [-22,22].forEach(px => {
          ctx.fillStyle='#7a5a2a'; ctx.fillRect(px-4,-68,8,68);
          ctx.fillStyle='#5a3a18'; ctx.fillRect(px-4,-68,3,68);
          ctx.fillStyle='#9a7a3a'; ctx.fillRect(px+2,-64,2,62);
          ctx.fillStyle='#6a4a20'; ctx.beginPath(); ctx.ellipse(px,-68,4,2,0,0,Math.PI*2); ctx.fill();
        });
        const hSwing = Math.sin(t*0.4+phase)*2;
        ctx.save(); ctx.translate(0,hSwing);
        ctx.strokeStyle='#c8a030'; ctx.lineWidth=1.5; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(-22,-50); ctx.quadraticCurveTo(-16,-42,-14,-36); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(22,-50); ctx.quadraticCurveTo(16,-42,14,-36); ctx.stroke();
        const hmGrad = ctx.createLinearGradient(-14,-36,14,-36);
        hmGrad.addColorStop(0,'#c8884a'); hmGrad.addColorStop(0.5,'#e8a860'); hmGrad.addColorStop(1,'#c8884a');
        ctx.fillStyle=hmGrad;
        ctx.beginPath();
        ctx.moveTo(-14,-36); ctx.bezierCurveTo(-8,-20,8,-20,14,-36);
        ctx.lineTo(14,-30); ctx.bezierCurveTo(8,-14,-8,-14,-14,-30); ctx.closePath();
        ctx.fill();
        ctx.strokeStyle='rgba(0,0,0,0.15)'; ctx.lineWidth=1;
        for(let s=-10;s<=10;s+=5) { ctx.beginPath(); ctx.moveTo(s,-36+Math.abs(s)*0.4); ctx.lineTo(s,-30+Math.abs(s)*0.4); ctx.stroke(); }
        ctx.strokeStyle='#c8884a'; ctx.lineWidth=1.5; ctx.lineCap='round';
        for(let f=0;f<4;f++) {
          ctx.beginPath(); ctx.moveTo(-14-f,-28-f*0.5); ctx.lineTo(-16-f,-21-f*0.5); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(14+f,-28-f*0.5); ctx.lineTo(16+f,-21-f*0.5); ctx.stroke();
        }
        ctx.restore();
        break;
      }

      case 'fairy_ring': {
        gndShadow(30, 13, 2, 6);
        const fg = 0.6+Math.sin(t*0.9+phase)*0.4;
        const fGrad = ctx.createRadialGradient(0,-2,5,0,-2,28);
        fGrad.addColorStop(0,`rgba(180,255,180,${0.3*fg})`);
        fGrad.addColorStop(0.5,`rgba(120,220,80,${0.15*fg})`);
        fGrad.addColorStop(1,'rgba(0,200,0,0)');
        ctx.fillStyle=fGrad; ctx.beginPath(); ctx.ellipse(0,-2,28,14,0,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle=`rgba(100,255,100,${0.4*fg})`; ctx.lineWidth=2.5;
        ctx.beginPath(); ctx.ellipse(0,-2,20,10,0,0,Math.PI*2); ctx.stroke();
        for(let m=0;m<8;m++) {
          const ma=m/8*Math.PI*2, mx=Math.cos(ma)*19, my=Math.sin(ma)*9-4;
          const glow=0.7+Math.sin(t*2.2+m*0.8)*0.3;
          ctx.save(); ctx.translate(mx,my);
          ctx.fillStyle=`rgba(180,255,100,${0.35*glow})`; ctx.beginPath(); ctx.arc(0,-8,10,0,Math.PI*2); ctx.fill();
          ctx.fillStyle='#f0ead8'; ctx.fillRect(-2.5,-10,5,10);
          ctx.fillStyle=m%2===0?'#c02000':'#c8580a';
          ctx.beginPath(); ctx.ellipse(0,-10,7,4,0,0,Math.PI*2); ctx.fill();
          ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(-1,-11,1.8,0,Math.PI*2); ctx.fill();
          ctx.fillStyle=`rgba(200,255,150,${0.5*glow})`; ctx.beginPath(); ctx.ellipse(0,-12,5,3,0,0,Math.PI*2); ctx.fill();
          ctx.restore();
        }
        for(let sp=0;sp<6;sp++) {
          const sa=sp/6*Math.PI*2+t*0.5, sr=14+Math.sin(t*1.5+sp)*3;
          const sx=Math.cos(sa)*sr, sy=Math.sin(sa)*sr*0.5-10-Math.sin(t+sp)*5;
          const sa2=0.5+Math.sin(t*2.8+sp*1.3)*0.5;
          ctx.fillStyle=`rgba(200,255,150,${sa2*0.8})`; ctx.beginPath(); ctx.arc(sx,sy,1.5,0,Math.PI*2); ctx.fill();
        }
        break;
      }

      case 'crystal_cluster': {
        gndShadow(22, 9, 2, 4);
        ctx.fillStyle='#3a3040'; ctx.beginPath(); ctx.ellipse(0,4,20,10,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#504858'; ctx.beginPath(); ctx.ellipse(-3,2,12,7,-0.1,0,Math.PI*2); ctx.fill();
        [{x:-8,y:0,w:10,h:42,hue:270,off:0},{x:4,y:2,w:8,h:34,hue:290,off:1.2},
         {x:-16,y:4,w:6,h:26,hue:260,off:0.8},{x:12,y:1,w:7,h:30,hue:280,off:2.0},
         {x:0,y:6,w:5,h:22,hue:275,off:1.6}].forEach(({x:cx,y:cy,w,h,hue,off}) => {
          const glw=0.7+Math.sin(t*1.2+off)*0.3;
          ctx.fillStyle=`hsla(${hue},60%,25%,1)`;
          ctx.beginPath(); ctx.moveTo(cx-w*0.5,cy); ctx.lineTo(cx-w*0.5,cy-h*0.8); ctx.lineTo(cx,cy-h); ctx.lineTo(cx,cy); ctx.closePath(); ctx.fill();
          ctx.fillStyle=`hsla(${hue},70%,55%,1)`;
          ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx,cy-h); ctx.lineTo(cx+w*0.5,cy-h*0.8); ctx.lineTo(cx+w*0.5,cy); ctx.closePath(); ctx.fill();
          ctx.fillStyle=`hsla(${hue},80%,70%,${0.7*glw})`;
          ctx.beginPath(); ctx.moveTo(cx-w*0.3,cy-h*0.5); ctx.lineTo(cx,cy-h); ctx.lineTo(cx+w*0.2,cy-h*0.5); ctx.closePath(); ctx.fill();
          ctx.strokeStyle=`hsla(${hue},90%,90%,0.5)`; ctx.lineWidth=1;
          ctx.beginPath(); ctx.moveTo(cx+w*0.1,cy-h*0.2); ctx.lineTo(cx+w*0.1,cy-h*0.9); ctx.stroke();
        });
        for(let sp=0;sp<5;sp++) {
          const spx=-16+sp*8, spy=-20-sp*5, spa=0.4+Math.sin(t*3+sp)*0.6;
          ctx.fillStyle=`hsla(${260+sp*10},90%,85%,${spa})`; ctx.beginPath(); ctx.arc(spx,spy,1.5,0,Math.PI*2); ctx.fill();
        }
        break;
      }

      case 'dream_orb': {
        gndShadow(14, 5, 2, 4);
        ctx.fillStyle='#4a2a6a'; ctx.fillRect(-2,-52,4,52);
        ctx.fillStyle='#2a1840'; ctx.fillRect(-2,-52,1.5,52);
        ctx.fillStyle='#6a408a'; ctx.fillRect(1,-48,1.2,44);
        ctx.fillStyle='#6a408a'; ctx.fillRect(-6,-4,12,4);
        ctx.fillStyle='#4a2a6a'; ctx.fillRect(-6,-4,4,4);
        ctx.fillStyle='#8a60aa'; ctx.beginPath(); ctx.ellipse(0,-4,6,3,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#8a60aa'; ctx.beginPath(); ctx.ellipse(0,-52,4,2,0,0,Math.PI*2); ctx.fill();
        const orbY = -64+Math.sin(t*0.8+phase)*4;
        const og = 0.6+Math.sin(t*1.1+phase)*0.4;
        const oGrad = ctx.createRadialGradient(0,orbY,2,0,orbY,18);
        oGrad.addColorStop(0,`rgba(200,160,255,${0.5*og})`);
        oGrad.addColorStop(0.5,`rgba(139,92,246,${0.3*og})`);
        oGrad.addColorStop(1,'rgba(100,60,200,0)');
        ctx.fillStyle=oGrad; ctx.beginPath(); ctx.arc(0,orbY,18,0,Math.PI*2); ctx.fill();
        const orbGrad = ctx.createRadialGradient(-4,orbY-4,2,0,orbY,12);
        orbGrad.addColorStop(0,'#e9d5ff'); orbGrad.addColorStop(0.4,'#c084fc');
        orbGrad.addColorStop(0.8,'#7c3aed'); orbGrad.addColorStop(1,'#4c1d95');
        ctx.fillStyle=orbGrad; ctx.beginPath(); ctx.arc(0,orbY,12,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.ellipse(-3,orbY-3,5,3,-0.5,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.ellipse(2,orbY+2,3,2,0.5,0,Math.PI*2); ctx.fill();
        for(let sp=0;sp<4;sp++) {
          const sa=sp/4*Math.PI*2+t*1.5, spx=Math.cos(sa)*16, spy=orbY+Math.sin(sa)*8;
          ctx.fillStyle=`rgba(220,180,255,${0.5+Math.sin(t*2+sp)*0.5})`; ctx.beginPath(); ctx.arc(spx,spy,1.5,0,Math.PI*2); ctx.fill();
        }
        break;
      }

      case 'torch_stand': {
        gndShadow(10, 4, 2, 4);
        ctx.fillStyle='#4a3a1a'; ctx.fillRect(-6,-4,12,4);
        ctx.fillStyle='#2a2008'; ctx.fillRect(-6,-4,4,4);
        ctx.fillStyle='#6a5a2a'; ctx.beginPath(); ctx.ellipse(0,-4,6,3,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#5a4820'; ctx.fillRect(-2.5,-58,5,54);
        ctx.fillStyle='#3a2e10'; ctx.fillRect(-2.5,-58,2,54);
        ctx.fillStyle='#7a6438'; ctx.fillRect(1,-54,1.5,46);
        ctx.fillStyle='#7a6030'; ctx.fillRect(-7,-60,14,5);
        ctx.fillStyle='#5a4020'; ctx.fillRect(-7,-60,5,5);
        ctx.fillStyle='#9a8040'; ctx.beginPath(); ctx.ellipse(0,-60,7,3,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#8a6030'; ctx.fillRect(-4,-74,8,14);
        ctx.fillStyle='#6a4820'; ctx.fillRect(-4,-74,3,14);
        ctx.strokeStyle='#c8a040'; ctx.lineWidth=1.5; ctx.lineCap='butt';
        [-72,-70,-68,-66].forEach(ry => { ctx.beginPath(); ctx.moveTo(-4,ry); ctx.lineTo(4,ry); ctx.stroke(); });
        const tfl = 0.8+Math.sin(t*5.2+phase)*0.2;
        ctx.fillStyle=`rgba(255,140,20,${0.3*tfl})`; ctx.beginPath(); ctx.arc(0,-78,14,0,Math.PI*2); ctx.fill();
        const fsw = Math.sin(t*3.5+phase)*3;
        ctx.fillStyle='#f59e0b';
        ctx.beginPath(); ctx.moveTo(fsw-5,-60); ctx.bezierCurveTo(fsw-4,-70,fsw+4,-70,fsw+5,-60); ctx.bezierCurveTo(fsw+3,-80,fsw-3,-80,fsw,-90); ctx.closePath(); ctx.fill();
        ctx.fillStyle='#fde68a';
        ctx.beginPath(); ctx.moveTo(fsw-3,-62); ctx.bezierCurveTo(fsw-2,-70,fsw+2,-70,fsw+3,-62); ctx.bezierCurveTo(fsw+2,-78,fsw-2,-78,fsw,-86); ctx.closePath(); ctx.fill();
        ctx.fillStyle='white'; ctx.beginPath(); ctx.arc(fsw,-74,2,0,Math.PI*2); ctx.fill();
        break;
      }

      case 'wind_chime': {
        gndShadow(12, 5, 2, 4);
        ctx.fillStyle='#9a7a3a'; ctx.fillRect(-22,-66,44,7);
        ctx.fillStyle='#6a5020'; ctx.fillRect(-22,-66,8,7);
        ctx.fillStyle='#c09a50'; ctx.fillRect(-20,-66,44,2.5);
        ctx.fillStyle='#c09a50'; ctx.beginPath(); ctx.arc(-22,-63,4,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(22,-63,4,0,Math.PI*2); ctx.fill();
        const tubeX=[-14,-7,0,7,14], tubeH=[30,38,44,38,30];
        tubeX.forEach((tx,i) => {
          const ts = Math.sin(t*(0.8+i*0.12)+i*1.1)*0.04;
          ctx.save(); ctx.translate(tx,-62); ctx.rotate(ts);
          ctx.strokeStyle='#c8a040'; ctx.lineWidth=1; ctx.lineCap='round';
          ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,4); ctx.stroke();
          ctx.fillStyle='#b8983a'; ctx.fillRect(-2.5,4,5,tubeH[i]);
          ctx.fillStyle='#8a7020'; ctx.fillRect(-2.5,4,1.8,tubeH[i]);
          ctx.fillStyle='#d4b040'; ctx.fillRect(1,6,1.5,tubeH[i]-4);
          ctx.fillStyle='#c09030';
          ctx.beginPath(); ctx.ellipse(0,4+tubeH[i],2.5,1.2,0,0,Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.ellipse(0,4,2.5,1.2,0,0,Math.PI*2); ctx.fill();
          ctx.restore();
        });
        const clapX = Math.sin(t*1.2+phase)*4;
        ctx.strokeStyle='#c8a040'; ctx.lineWidth=1; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(clapX,-62); ctx.lineTo(clapX,-30); ctx.stroke();
        ctx.fillStyle='#c09030'; ctx.beginPath(); ctx.arc(clapX,-30,4,0,Math.PI*2); ctx.fill();
        break;
      }

      case 'star_post': {
        gndShadow(10, 4, 2, 4);
        ctx.fillStyle='#5a4820'; ctx.fillRect(-2.5,-72,5,72);
        ctx.fillStyle='#3a3010'; ctx.fillRect(-2.5,-72,2,72);
        ctx.fillStyle='#7a6a30'; ctx.fillRect(1,-68,1.5,64);
        ctx.fillStyle='#6a5828'; ctx.fillRect(-6,-4,12,4);
        ctx.fillStyle='#4a3818'; ctx.fillRect(-6,-4,4,4);
        ctx.fillStyle='#8a7840'; ctx.beginPath(); ctx.ellipse(0,-4,6,3,0,0,Math.PI*2); ctx.fill();
        const sg = 0.7+Math.sin(t*1.4+phase)*0.3;
        ctx.fillStyle=`rgba(255,220,80,${0.25*sg})`; ctx.beginPath(); ctx.arc(0,-78,20,0,Math.PI*2); ctx.fill();
        ctx.fillStyle=`rgba(255,240,160,${0.15*sg})`; ctx.beginPath(); ctx.arc(0,-78,28,0,Math.PI*2); ctx.fill();
        ctx.fillStyle=`hsla(48,100%,${60+sg*20}%,1)`;
        ctx.beginPath();
        for(let s=0;s<10;s++) {
          const sa=s/10*Math.PI*2-Math.PI*0.5, sr=s%2===0?18:8;
          const sx=Math.cos(sa)*sr, sy=-78+Math.sin(sa)*sr;
          s===0?ctx.moveTo(sx,sy):ctx.lineTo(sx,sy);
        }
        ctx.closePath(); ctx.fill();
        ctx.fillStyle=`hsla(48,100%,85%,0.8)`;
        ctx.beginPath();
        for(let s=0;s<10;s++) {
          const sa=s/10*Math.PI*2-Math.PI*0.5, sr=s%2===0?11:5;
          const sx=Math.cos(sa)*sr, sy=-78+Math.sin(sa)*sr;
          s===0?ctx.moveTo(sx,sy):ctx.lineTo(sx,sy);
        }
        ctx.closePath(); ctx.fill();
        ctx.fillStyle='white'; ctx.beginPath(); ctx.arc(-3,-82,3,0,Math.PI*2); ctx.fill();
        break;
      }

      case 'stone_arch': {
        gndShadow(36, 15, 4, 7);
        const drawArchPillar = (px) => {
          ctx.fillStyle='#4a4848'; ctx.fillRect(px-7,-80,14,80);
          ctx.fillStyle='#3a3838'; ctx.fillRect(px-7,-80,5,80);
          ctx.fillStyle='#6a6868'; ctx.fillRect(px+3,-76,3,72);
          ctx.fillStyle='#5a5858'; ctx.beginPath(); ctx.ellipse(px,-80,7,3.5,0,0,Math.PI*2); ctx.fill();
          ctx.fillStyle='#8a8888'; ctx.beginPath(); ctx.ellipse(px-2,-81,4,2,0,0,Math.PI*2); ctx.fill();
          ctx.fillStyle='#5a5858'; ctx.fillRect(px-10,-4,20,4);
          ctx.fillStyle='#3a3838'; ctx.fillRect(px-10,-4,6,4);
          ctx.fillStyle='#7a7878'; ctx.beginPath(); ctx.ellipse(px,-4,10,3.5,0,0,Math.PI*2); ctx.fill();
          ctx.strokeStyle='rgba(0,0,0,0.2)'; ctx.lineWidth=1;
          [-60,-44,-28,-12].forEach(sy => { ctx.beginPath(); ctx.moveTo(px-7,sy); ctx.lineTo(px+7,sy); ctx.stroke(); });
        };
        drawArchPillar(-18); drawArchPillar(18);
        ctx.strokeStyle='#5a5858'; ctx.lineWidth=12; ctx.lineCap='round';
        ctx.beginPath(); ctx.arc(0,-80,24,Math.PI,2*Math.PI); ctx.stroke();
        ctx.strokeStyle='#3a3838'; ctx.lineWidth=4;
        ctx.beginPath(); ctx.arc(-2,-82,20,Math.PI,2*Math.PI); ctx.stroke();
        ctx.strokeStyle='#8a8888'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.arc(0,-80,30,Math.PI,2*Math.PI); ctx.stroke();
        ctx.fillStyle='#7a7868'; ctx.fillRect(-6,-84,12,8);
        ctx.fillStyle='#9a9888'; ctx.beginPath(); ctx.ellipse(-2,-86,4,2,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#228b22'; ctx.globalAlpha=0.6;
        [[-20,-70],[-22,-54],[-20,-38],[20,-70],[22,-54],[20,-38],[-10,-90],[10,-90]].forEach(([vx,vy]) => {
          ctx.beginPath(); ctx.ellipse(vx,vy,5,3,-0.3,0,Math.PI*2); ctx.fill();
        });
        ctx.globalAlpha=1;
        break;
      }

      case 'garden_wall_low': {
        gndShadow(34, 13, 3, 5);
        const stoneC=['#6a6258','#7a7268','#8a8278','#5a5248'];
        [-24,-12,0,12].forEach((bx,i) => {
          ctx.fillStyle=stoneC[i%4]; ctx.fillRect(bx,-10,11,10);
          ctx.fillStyle=stoneC[(i+1)%4]; ctx.fillRect(bx,-10,4,10);
          ctx.strokeStyle='rgba(0,0,0,0.2)'; ctx.lineWidth=0.5; ctx.strokeRect(bx,-10,11,10);
        });
        [-18,-6,6,18].forEach((bx,i) => {
          ctx.fillStyle=stoneC[(i+2)%4]; ctx.fillRect(bx,-20,11,10);
          ctx.fillStyle=stoneC[(i+3)%4]; ctx.fillRect(bx,-20,4,10);
          ctx.strokeStyle='rgba(0,0,0,0.2)'; ctx.lineWidth=0.5; ctx.strokeRect(bx,-20,11,10);
        });
        ctx.fillStyle='#9a9280'; ctx.fillRect(-24,-22,48,3);
        ctx.fillStyle='#8a8270'; ctx.fillRect(-24,-22,16,3);
        ctx.fillStyle='#b0a898'; ctx.beginPath(); ctx.ellipse(0,-22,24,4,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#c8c0b0'; ctx.beginPath(); ctx.ellipse(-6,-23,12,2.5,-0.1,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='rgba(40,160,20,0.5)';
        [[-18,-22],[0,-22],[16,-22]].forEach(([mx,my]) => { ctx.beginPath(); ctx.ellipse(mx,my,5,2.5,0,0,Math.PI*2); ctx.fill(); });
        break;
      }

      case 'stone_pillar': {
        gndShadow(14, 6, 2, 4);
        ctx.fillStyle='#5a5248'; ctx.fillRect(-10,-8,20,8);
        ctx.fillStyle='#3a3228'; ctx.fillRect(-10,-8,7,8);
        ctx.fillStyle='#8a8278'; ctx.beginPath(); ctx.ellipse(0,-8,10,4,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#aaa298'; ctx.beginPath(); ctx.ellipse(-3,-9,6,2.5,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#6a6258'; ctx.fillRect(-6,-76,12,68);
        ctx.fillStyle='#4a4238'; ctx.fillRect(-6,-76,4,68);
        ctx.fillStyle='#8a8270'; ctx.fillRect(-2,-72,3,62);
        ctx.strokeStyle='rgba(0,0,0,0.15)'; ctx.lineWidth=1;
        [-3,0,3].forEach(fx => { ctx.beginPath(); ctx.moveTo(fx,-72); ctx.lineTo(fx,-12); ctx.stroke(); });
        ctx.fillStyle='#7a7268'; ctx.fillRect(-10,-76,20,5);
        ctx.fillStyle='#5a5248'; ctx.fillRect(-10,-76,7,5);
        ctx.fillStyle='#9a9288'; ctx.beginPath(); ctx.ellipse(0,-76,10,4,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#c0b8a8'; ctx.beginPath(); ctx.ellipse(-3,-78,6,2.5,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#8a8278';
        ctx.beginPath(); ctx.moveTo(-6,-80); ctx.lineTo(-2,-84); ctx.lineTo(4,-82); ctx.lineTo(6,-78); ctx.closePath(); ctx.fill();
        ctx.fillStyle='rgba(40,140,20,0.4)';
        ctx.beginPath(); ctx.ellipse(-4,-30,4,6,0.3,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(3,-52,3,5,-0.3,0,Math.PI*2); ctx.fill();
        break;
      }

      case 'sundial': {
        gndShadow(24, 10, 2, 4);
        ctx.fillStyle='#5a5248';
        ctx.beginPath(); ctx.moveTo(-14,0); ctx.lineTo(-14,-16); ctx.lineTo(0,-22); ctx.lineTo(0,-6); ctx.closePath(); ctx.fill();
        ctx.fillStyle='#7a7268';
        ctx.beginPath(); ctx.moveTo(0,-6); ctx.lineTo(0,-22); ctx.lineTo(14,-16); ctx.lineTo(14,0); ctx.closePath(); ctx.fill();
        ctx.fillStyle='#8a8278';
        ctx.beginPath(); ctx.moveTo(-14,-16); ctx.lineTo(0,-22); ctx.lineTo(14,-16); ctx.lineTo(0,-10); ctx.closePath(); ctx.fill();
        ctx.fillStyle='#9a9288'; ctx.beginPath(); ctx.ellipse(0,-22,16,8,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#b0a898'; ctx.beginPath(); ctx.ellipse(-3,-23,9,4.5,-0.1,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle='rgba(0,0,0,0.4)'; ctx.lineWidth=1;
        for(let hr=0;hr<12;hr++) {
          const ha=hr/12*Math.PI*2-Math.PI*0.5;
          ctx.beginPath(); ctx.moveTo(Math.cos(ha)*4,Math.sin(ha)*4*0.5-22); ctx.lineTo(Math.cos(ha)*14,Math.sin(ha)*14*0.5-22); ctx.stroke();
        }
        ctx.fillStyle='#6a5a30';
        ctx.beginPath(); ctx.moveTo(-2,-22); ctx.lineTo(2,-22); ctx.lineTo(0,-36); ctx.closePath(); ctx.fill();
        ctx.fillStyle='#9a8840';
        ctx.beginPath(); ctx.moveTo(-1,-22); ctx.lineTo(0,-36); ctx.lineTo(1,-23); ctx.closePath(); ctx.fill();
        ctx.fillStyle='rgba(200,160,48,0.7)'; ctx.beginPath(); ctx.arc(0,-22,4,0,Math.PI*2); ctx.fill();
        break;
      }

      case 'stepping_stones': {
        gndShadow(36, 14, 3, 5);
        [[-16,4,0.1],[0,-2,0],[14,2,-0.05]].forEach(([sx,sy,rot]) => {
          ctx.save(); ctx.translate(sx,sy); ctx.rotate(rot);
          ctx.fillStyle='#5a5248'; ctx.beginPath(); ctx.ellipse(0,4,14,8,0,0,Math.PI*2); ctx.fill();
          ctx.fillStyle='#7a7068'; ctx.beginPath(); ctx.ellipse(0,2,14,8,0,0,Math.PI*2); ctx.fill();
          ctx.fillStyle='#9a9088'; ctx.beginPath(); ctx.ellipse(0,2,14,8,0,Math.PI,2*Math.PI); ctx.fill();
          ctx.fillStyle='#b0a898'; ctx.beginPath(); ctx.ellipse(-3,1,8,4,-0.1,0,Math.PI*2); ctx.fill();
          ctx.fillStyle='rgba(60,160,40,0.5)'; ctx.beginPath(); ctx.ellipse(-4,2,5,3,0.2,0,Math.PI*2); ctx.fill();
          ctx.restore();
        });
        break;
      }

      case 'beehive': {
        gndShadow(18, 7, 2, 4);
        ctx.fillStyle='#7a5a28'; ctx.fillRect(-3,-32,6,32);
        ctx.fillStyle='#5a3a18'; ctx.fillRect(-3,-32,2,32);
        ctx.fillStyle='#9a7a38'; ctx.fillRect(1,-28,2,26);
        ctx.fillStyle='#8a6a30'; ctx.fillRect(-8,-34,16,4);
        ctx.fillStyle='#6a4a20'; ctx.fillRect(-8,-34,6,4);
        ctx.fillStyle='#aa8a40'; ctx.beginPath(); ctx.ellipse(0,-34,8,3.5,0,0,Math.PI*2); ctx.fill();
        [[8,18,22,'#d4a040'],[0,16,20,'#e8b848'],[-10,14,18,'#f0c458'],[-18,10,14,'#f4cc64']].forEach(([hy,rx,ry,col]) => {
          ctx.fillStyle=col; ctx.beginPath(); ctx.ellipse(0,hy,rx,ry,0,0,Math.PI*2); ctx.fill();
        });
        ctx.strokeStyle='rgba(0,0,0,0.18)'; ctx.lineWidth=1.5;
        [-4,-12,-20].forEach(hy => {
          const rx=Math.abs(hy)*0.7+6;
          ctx.beginPath(); ctx.ellipse(0,hy,rx,rx*0.4+2,0,0,Math.PI*2); ctx.stroke();
        });
        ctx.fillStyle='#1a0a00'; ctx.beginPath(); ctx.ellipse(0,0,4,2.5,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#3a2010'; ctx.beginPath(); ctx.arc(0,-1,2,0,Math.PI*2); ctx.fill();
        [[16,-28,0],[22,-20,1.2],[-16,-24,2.5]].forEach(([bx,by,bph]) => {
          ctx.save(); ctx.translate(bx+Math.sin(t*2+bph)*3,by+Math.cos(t*2.2+bph)*2);
          ctx.rotate(Math.sin(t*4+bph)*0.1);
          ctx.fillStyle='#f59e0b'; ctx.beginPath(); ctx.ellipse(0,0,4,3,0,0,Math.PI*2); ctx.fill();
          ctx.strokeStyle='#1a1008'; ctx.lineWidth=1;
          ctx.beginPath(); ctx.moveTo(-2,0); ctx.lineTo(2,0); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-1,-2); ctx.lineTo(1,-2); ctx.stroke();
          ctx.fillStyle='rgba(200,230,255,0.6)'; ctx.beginPath(); ctx.ellipse(0,-4,5,2,0,0,Math.PI*2); ctx.fill();
          ctx.restore();
        });
        break;
      }

      case 'windmill': {
        gndShadow(18, 7, 2, 4);
        ctx.fillStyle='#c8b888';
        ctx.beginPath(); ctx.moveTo(-12,0); ctx.lineTo(-8,-56); ctx.lineTo(8,-56); ctx.lineTo(12,0); ctx.closePath(); ctx.fill();
        ctx.fillStyle='#9a8860';
        ctx.beginPath(); ctx.moveTo(-12,0); ctx.lineTo(-8,-56); ctx.lineTo(-4,-56); ctx.lineTo(-8,0); ctx.closePath(); ctx.fill();
        ctx.fillStyle='#ddd098'; ctx.beginPath(); ctx.ellipse(0,-56,8,3,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#4a6888';
        ctx.beginPath(); ctx.ellipse(2,-20,4,5,0,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(2,-38,4,5,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#6a8aaa';
        ctx.beginPath(); ctx.ellipse(1,-22,2,3,0,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(1,-40,2,3,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#7a5020';
        ctx.beginPath(); ctx.moveTo(-4,0); ctx.lineTo(-4,-12); ctx.quadraticCurveTo(0,-16,4,-12); ctx.lineTo(4,0); ctx.closePath(); ctx.fill();
        const windRot = t * 1.2;
        ctx.save(); ctx.translate(0,-56); ctx.rotate(windRot);
        ctx.fillStyle='#7a6030'; ctx.beginPath(); ctx.arc(0,0,5,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#aa8a40'; ctx.beginPath(); ctx.arc(0,0,3,0,Math.PI*2); ctx.fill();
        for(let bl=0;bl<4;bl++) {
          ctx.save(); ctx.rotate(bl/4*Math.PI*2);
          ctx.fillStyle='#c8a050';
          ctx.beginPath(); ctx.moveTo(-3,0); ctx.lineTo(-5,28); ctx.lineTo(5,28); ctx.lineTo(3,0); ctx.closePath(); ctx.fill();
          ctx.fillStyle='#a08030';
          ctx.beginPath(); ctx.moveTo(-3,0); ctx.lineTo(-5,28); ctx.lineTo(-2,28); ctx.lineTo(0,0); ctx.closePath(); ctx.fill();
          ctx.fillStyle='#e0c060';
          ctx.beginPath(); ctx.moveTo(1,2); ctx.lineTo(0,26); ctx.lineTo(2,26); ctx.lineTo(2,2); ctx.closePath(); ctx.fill();
          ctx.restore();
        }
        ctx.restore();
        break;
      }

      case 'treasure_chest': {
        gndShadow(26, 11, 3, 5);
        ctx.fillStyle='#7a4e1e';
        ctx.beginPath(); ctx.moveTo(-20,0); ctx.lineTo(-20,-22); ctx.lineTo(0,-28); ctx.lineTo(0,-6); ctx.closePath(); ctx.fill();
        ctx.fillStyle='#a06830';
        ctx.beginPath(); ctx.moveTo(0,-6); ctx.lineTo(0,-28); ctx.lineTo(20,-22); ctx.lineTo(20,0); ctx.closePath(); ctx.fill();
        ctx.fillStyle='#c08840';
        ctx.beginPath(); ctx.moveTo(-20,-22); ctx.lineTo(0,-28); ctx.lineTo(20,-22); ctx.lineTo(0,-16); ctx.closePath(); ctx.fill();
        ctx.fillStyle='#8a5a22';
        ctx.beginPath(); ctx.moveTo(-20,-22); ctx.lineTo(-20,-34); ctx.lineTo(0,-40); ctx.lineTo(0,-28); ctx.closePath(); ctx.fill();
        ctx.fillStyle='#b07840';
        ctx.beginPath(); ctx.moveTo(0,-28); ctx.lineTo(0,-40); ctx.lineTo(20,-34); ctx.lineTo(20,-22); ctx.closePath(); ctx.fill();
        ctx.fillStyle='#d09a50';
        ctx.beginPath(); ctx.moveTo(-20,-34); ctx.lineTo(0,-40); ctx.lineTo(20,-34); ctx.lineTo(0,-28); ctx.closePath(); ctx.fill();
        ctx.strokeStyle='#c8a030'; ctx.lineWidth=2; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(-20,-11); ctx.lineTo(0,-17); ctx.lineTo(20,-11); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0,-6); ctx.lineTo(0,-28); ctx.stroke();
        ctx.fillStyle='#c8a030';
        [[-20,-22],[-20,0],[20,-22],[20,0],[0,-28],[0,-6]].forEach(([bx,by]) => {
          ctx.beginPath(); ctx.arc(bx,by,3,0,Math.PI*2); ctx.fill();
        });
        ctx.fillStyle='#c8a030'; ctx.fillRect(-4,-34,8,6);
        ctx.fillStyle='#a08020'; ctx.fillRect(-4,-34,3,6);
        ctx.fillStyle='#1a1008'; ctx.beginPath(); ctx.arc(0,-32,2,0,Math.PI*2); ctx.fill();
        const cg = 0.5+Math.sin(t*0.6+phase)*0.2;
        ctx.fillStyle=`rgba(255,200,80,${0.3*cg})`; ctx.beginPath(); ctx.ellipse(0,-28,15,5,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#fbbf24';
        [[-6,-28],[-2,-26],[4,-28]].forEach(([gx,gy]) => { ctx.beginPath(); ctx.ellipse(gx,gy,3,1.5,0,0,Math.PI*2); ctx.fill(); });
        break;
      }

      default: {
        const fs = Math.round(def.r * 150);
        ctx.font = `${fs}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(def.icon, 0, -fs * 0.5);
        break;
      }
    }

    ctx.restore();
  }

  // ── Crafted-prop world renderer ────────────────────────────────────
  // Each crafted prop gets a small handcrafted iso-style sprite drawn at
  // the placement spot, so it reads as a real built object on the field
  // (rather than the placeholder emoji icon). Switched on `def.propId`,
  // matching the original entry in GAME_DATA.craftProps.
  _drawCraftPropCosmetic(ctx, iso, def) {
    const t = Date.now() / 1000;
    const phase = iso.x * 0.008;
    ctx.save();
    ctx.translate(iso.x, iso.y);
    const gndShadow = (rx, ry, ox = 2, oy = 4) => {
      ctx.fillStyle = 'rgba(0,0,0,0.20)';
      ctx.beginPath(); ctx.ellipse(ox, oy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    };

    switch (def.propId) {

      case 'workbench': {
        gndShadow(20, 7);
        // Crate base + plank lines
        ctx.fillStyle = '#7c2d12';
        ctx.beginPath(); ctx.roundRect(-16, -16, 32, 16, 2); ctx.fill();
        ctx.strokeStyle = '#3f2611'; ctx.lineWidth = 1.4; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-16, -8); ctx.lineTo(16, -8); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-5, -16); ctx.lineTo(-5, 0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo( 5, -16); ctx.lineTo( 5, 0); ctx.stroke();
        // Bench top
        ctx.fillStyle = '#a16207';
        ctx.beginPath(); ctx.roundRect(-19, -20, 38, 5, 1.5); ctx.fill();
        ctx.strokeStyle = '#3f2611'; ctx.lineWidth = 1; ctx.stroke();
        // Hammer leaning
        ctx.save(); ctx.translate(-12, -22); ctx.rotate(-0.45 + Math.sin(t * 0.6 + phase) * 0.04);
        ctx.fillStyle = '#475569';
        ctx.beginPath(); ctx.roundRect(-2.5, -5, 5, 7, 1); ctx.fill();
        ctx.fillStyle = '#7c2d12';
        ctx.beginPath(); ctx.roundRect(-0.8, 2, 1.6, 11, 0.5); ctx.fill();
        ctx.restore();
        // Wood plank propped
        ctx.save(); ctx.translate(11, -20); ctx.rotate(-0.2);
        ctx.fillStyle = '#92400e';
        ctx.beginPath(); ctx.roundRect(-2, -14, 4, 18, 0.6); ctx.fill();
        ctx.restore();
        // Saw or wood shavings
        ctx.fillStyle = '#fde7c4';
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.ellipse(-10 + i * 6, 4, 2, 0.8, 0.3, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }

      case 'stone_well': {
        gndShadow(22, 8);
        // Stone ring base
        ctx.fillStyle = '#7c706b';
        ctx.beginPath(); ctx.ellipse(0, 0, 18, 9, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#5a504c';
        ctx.beginPath(); ctx.ellipse(0, 0, 18, 9, 0, Math.PI, Math.PI * 2); ctx.fill();
        // Stone wall ring (above)
        ctx.fillStyle = '#94908c';
        ctx.beginPath(); ctx.ellipse(0, -8, 17, 8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#5a504c'; ctx.lineWidth = 1.2;
        // Stone joint hint marks
        ctx.beginPath(); ctx.ellipse(0, -8, 17, 8, 0, 0, Math.PI); ctx.stroke();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI - Math.PI;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * 17, Math.sin(a) * 8 - 8);
          ctx.lineTo(Math.cos(a) * 17, Math.sin(a) * 8 - 2);
          ctx.stroke();
        }
        // Water surface
        ctx.fillStyle = '#7dd3fc';
        ctx.beginPath(); ctx.ellipse(0, -8, 13, 5.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.beginPath(); ctx.ellipse(-3, -10, 5, 1.5, -0.2, 0, Math.PI * 2); ctx.fill();
        // Wooden roof posts + slanted roof
        ctx.fillStyle = '#7c2d12';
        ctx.fillRect(-15, -28, 2.5, 22);
        ctx.fillRect( 12.5, -28, 2.5, 22);
        ctx.fillStyle = '#92400e';
        ctx.beginPath();
        ctx.moveTo(-19, -28); ctx.lineTo(0, -38); ctx.lineTo(19, -28); ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#5a3a1d'; ctx.lineWidth = 1; ctx.stroke();
        // Bucket on rope
        const bx = Math.sin(t * 0.6 + phase) * 1.8;
        ctx.strokeStyle = '#3f2611'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, -28); ctx.lineTo(bx, -16); ctx.stroke();
        ctx.fillStyle = '#a16207';
        ctx.beginPath(); ctx.roundRect(bx - 3, -16, 6, 5, 0.8); ctx.fill();
        ctx.strokeStyle = '#3f2611'; ctx.beginPath(); ctx.arc(bx, -16, 3, Math.PI, 0); ctx.stroke();
        break;
      }

      case 'herb_garden': {
        gndShadow(22, 7);
        // Wooden planter
        ctx.fillStyle = '#7c2d12';
        ctx.beginPath(); ctx.roundRect(-18, -8, 36, 14, 1.5); ctx.fill();
        ctx.strokeStyle = '#3f2611'; ctx.lineWidth = 1.2; ctx.stroke();
        ctx.fillStyle = '#a16207';
        ctx.beginPath(); ctx.roundRect(-18, -8, 36, 3, 1); ctx.fill();
        // Soil
        ctx.fillStyle = '#3b2410';
        ctx.beginPath(); ctx.ellipse(0, -6, 16, 3, 0, 0, Math.PI * 2); ctx.fill();
        // Herbs sprouting
        const herbs = [-12, -6, 0, 7, 13];
        herbs.forEach((hx, i) => {
          const sw = Math.sin(t * 0.8 + i + phase) * 0.05;
          ctx.save(); ctx.translate(hx, -6); ctx.rotate(sw);
          ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -10 - (i % 2) * 3); ctx.stroke();
          // Leaves
          ctx.fillStyle = '#86efac';
          ctx.beginPath(); ctx.ellipse(-3, -7, 2.5, 1.2, -0.4, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.ellipse( 3, -10, 2.5, 1.2, 0.4, 0, Math.PI * 2); ctx.fill();
          // Little flower on the centre herb
          if (i === 2) {
            ctx.fillStyle = '#fbbf24';
            ctx.beginPath(); ctx.arc(0, -14, 1.6, 0, Math.PI * 2); ctx.fill();
          }
          ctx.restore();
        });
        break;
      }

      case 'companion_den': {
        gndShadow(22, 8);
        // Walls (log cabin)
        ctx.fillStyle = '#92400e';
        ctx.beginPath(); ctx.roundRect(-18, -18, 36, 18, 2); ctx.fill();
        ctx.strokeStyle = '#3f2611'; ctx.lineWidth = 1.2; ctx.stroke();
        // Log rows
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(-18, -18 + i * 6); ctx.lineTo(18, -18 + i * 6);
          ctx.stroke();
        }
        // Door
        ctx.fillStyle = '#3b1f0c';
        ctx.beginPath(); ctx.roundRect(-5, -10, 10, 10, 1); ctx.fill();
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath(); ctx.arc(2.5, -5, 0.7, 0, Math.PI * 2); ctx.fill();
        // Pitched roof — terracotta
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.moveTo(-22, -18); ctx.lineTo(0, -32); ctx.lineTo(22, -18); ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#7f1d1d'; ctx.lineWidth = 1.2; ctx.stroke();
        // Roof shingle hint
        ctx.beginPath();
        ctx.moveTo(-15, -22); ctx.lineTo(15, -22);
        ctx.moveTo(-9, -26);  ctx.lineTo(9, -26);
        ctx.stroke();
        // Tiny chimney puff
        const sm = Math.sin(t * 0.7 + phase) * 1.2;
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath(); ctx.arc(11 + sm, -36, 2.6, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(13 + sm * 0.5, -42, 1.8, 0, Math.PI * 2); ctx.fill();
        break;
      }

      case 'mood_lantern': {
        gndShadow(10, 4);
        // Stone base
        ctx.fillStyle = '#5a504c';
        ctx.beginPath(); ctx.ellipse(0, 0, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
        // Wooden post
        ctx.fillStyle = '#7c2d12';
        ctx.fillRect(-1.5, -28, 3, 28);
        // Lantern body — soft glow halo
        const glow = 0.55 + Math.sin(t * 1.6 + phase) * 0.18;
        const grd = ctx.createRadialGradient(0, -32, 2, 0, -32, 22);
        grd.addColorStop(0, `rgba(254, 243, 199, ${glow})`);
        grd.addColorStop(1, 'rgba(254, 243, 199, 0)');
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.arc(0, -32, 22, 0, Math.PI * 2); ctx.fill();
        // Lantern frame
        ctx.fillStyle = '#3a3228';
        ctx.beginPath(); ctx.roundRect(-6, -38, 12, 12, 2); ctx.fill();
        // Glass window
        ctx.fillStyle = '#fde68a';
        ctx.beginPath(); ctx.roundRect(-4.5, -36.5, 9, 9, 1.5); ctx.fill();
        // Flame inside
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.moveTo(0, -28); ctx.bezierCurveTo(-2, -32, -2, -34, 0, -36);
        ctx.bezierCurveTo(2, -34, 2, -32, 0, -28); ctx.closePath();
        ctx.fill();
        // Lantern cap
        ctx.fillStyle = '#3a3228';
        ctx.beginPath();
        ctx.moveTo(-7, -38); ctx.lineTo(0, -42); ctx.lineTo(7, -38); ctx.closePath();
        ctx.fill();
        break;
      }

      case 'ward_stone': {
        gndShadow(16, 6);
        // Standing stone shadow at base
        ctx.fillStyle = '#3b2454';
        ctx.beginPath();
        ctx.moveTo(-10, 2); ctx.lineTo(-12, -28); ctx.lineTo(-2, -38);
        ctx.lineTo(10, -28); ctx.lineTo(8, 2); ctx.closePath(); ctx.fill();
        // Stone face
        ctx.fillStyle = '#7c6b9c';
        ctx.beginPath();
        ctx.moveTo(-10, 2); ctx.lineTo(-12, -28); ctx.lineTo(-2, -38);
        ctx.lineTo(8, -32); ctx.lineTo(6, 2); ctx.closePath(); ctx.fill();
        // Highlight edge
        ctx.fillStyle = '#a78bfa';
        ctx.beginPath();
        ctx.moveTo(-12, -28); ctx.lineTo(-2, -38); ctx.lineTo(0, -28); ctx.closePath();
        ctx.fill();
        // Glowing rune
        const rg = 0.55 + Math.sin(t * 1.2 + phase) * 0.35;
        ctx.fillStyle = `rgba(165, 243, 252, ${rg})`;
        ctx.font = 'bold 11px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✦', -2, -20);
        // Pulsing aura ring
        ctx.strokeStyle = `rgba(186, 230, 253, ${0.35 + Math.sin(t * 1.6) * 0.18})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(0, 4, 18, 5, 0, 0, Math.PI * 2); ctx.stroke();
        break;
      }

      case 'storage_chest': {
        gndShadow(18, 6);
        // Chest body
        ctx.fillStyle = '#7c2d12';
        ctx.beginPath(); ctx.roundRect(-14, -10, 28, 12, 1.5); ctx.fill();
        ctx.strokeStyle = '#3f2611'; ctx.lineWidth = 1.2; ctx.stroke();
        // Top edge of body
        ctx.fillStyle = '#92400e';
        ctx.beginPath(); ctx.roundRect(-14, -10, 28, 3, 1); ctx.fill();
        // Curved lid
        ctx.fillStyle = '#a16207';
        ctx.beginPath();
        ctx.moveTo(-14, -10); ctx.quadraticCurveTo(0, -22, 14, -10); ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#3f2611'; ctx.lineWidth = 1.2; ctx.stroke();
        // Iron straps
        ctx.fillStyle = '#475569';
        ctx.fillRect(-9, -10, 1.6, 12);
        ctx.fillRect( 7, -10, 1.6, 12);
        ctx.fillRect(-9, -16, 1.6, 6);
        ctx.fillRect( 7, -16, 1.6, 6);
        // Lock plate
        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath(); ctx.roundRect(-3, -8, 6, 5, 1); ctx.fill();
        ctx.fillStyle = '#374151';
        ctx.beginPath(); ctx.arc(0, -5.5, 0.7, 0, Math.PI * 2); ctx.fill();
        break;
      }

      case 'dream_chime': {
        gndShadow(12, 5);
        // Wooden post
        ctx.fillStyle = '#5b3a1d';
        ctx.fillRect(-1.5, -34, 3, 34);
        // Top crossbar
        ctx.fillStyle = '#7c2d12';
        ctx.beginPath(); ctx.roundRect(-12, -36, 24, 3, 1); ctx.fill();
        // Hanging chimes — sway out of phase
        const chimes = [-9, -3, 3, 9];
        chimes.forEach((cx, i) => {
          const sw = Math.sin(t * 1.8 + i * 0.7 + phase) * 0.10;
          ctx.save(); ctx.translate(cx, -33); ctx.rotate(sw);
          ctx.strokeStyle = '#3a3228'; ctx.lineWidth = 0.8;
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 4); ctx.stroke();
          // Tube — pastel teal/lavender alternating
          const cols = ['#a5f3fc', '#c4b5fd', '#fbcfe8', '#fde68a'];
          ctx.fillStyle = cols[i];
          ctx.beginPath(); ctx.roundRect(-1.4, 4, 2.8, 14 - i * 1.5, 1); ctx.fill();
          ctx.strokeStyle = 'rgba(120, 80, 130, 0.4)'; ctx.lineWidth = 0.4;
          ctx.beginPath(); ctx.roundRect(-1.4, 4, 2.8, 14 - i * 1.5, 1); ctx.stroke();
          ctx.restore();
        });
        // Tiny ♪ above
        const nf = ((t * 0.7 + phase) % 2) / 2;
        ctx.globalAlpha = Math.max(0, 1 - nf);
        ctx.font = 'bold 8px serif';
        ctx.fillStyle = '#a78bfa';
        ctx.textAlign = 'center';
        ctx.fillText('♪', 0, -42 - nf * 8);
        ctx.globalAlpha = 1;
        break;
      }

      case 'night_watcher': {
        gndShadow(14, 6);
        // Tripod
        ctx.strokeStyle = '#3a3228'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(-9, 4); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo( 9, 4); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo( 0, 4); ctx.stroke();
        // Telescope tube — points up at the sky
        ctx.save();
        ctx.translate(0, -16);
        ctx.rotate(-Math.PI / 3 + Math.sin(t * 0.4 + phase) * 0.05);
        ctx.fillStyle = '#475569';
        ctx.beginPath(); ctx.roundRect(-3, -16, 6, 22, 1.2); ctx.fill();
        ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1; ctx.stroke();
        // Eyepiece
        ctx.fillStyle = '#1e293b';
        ctx.beginPath(); ctx.roundRect(-3.5, 4, 7, 4, 0.8); ctx.fill();
        // Rim
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath(); ctx.ellipse(0, -16, 3.2, 1.2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        // Tiny star sparkle floating off the lens
        ctx.fillStyle = '#fef3c7';
        ctx.font = 'bold 8px serif';
        ctx.textAlign = 'center';
        ctx.fillText('✦', 14, -28 + Math.sin(t * 1.2) * 1.4);
        break;
      }

      case 'companion_pasture': {
        gndShadow(24, 9);
        // Grass patch
        ctx.fillStyle = '#86efac';
        ctx.beginPath(); ctx.ellipse(0, 0, 22, 9, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#22c55e';
        ctx.beginPath(); ctx.ellipse(0, 0, 22, 9, 0, Math.PI, Math.PI * 2); ctx.fill();
        // Wooden corner posts + low rope fence
        const posts = [[-18, -2], [-6, -4], [6, -4], [18, -2]];
        ctx.fillStyle = '#7c2d12';
        posts.forEach(([px, py]) => {
          ctx.fillRect(px - 1.2, py - 8, 2.4, 8);
        });
        ctx.strokeStyle = '#a16207'; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
        // Rope rails
        for (let i = 0; i < posts.length - 1; i++) {
          const [x1, y1] = posts[i], [x2, y2] = posts[i + 1];
          ctx.beginPath(); ctx.moveTo(x1, y1 - 6); ctx.lineTo(x2, y2 - 6); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x1, y1 - 2); ctx.lineTo(x2, y2 - 2); ctx.stroke();
        }
        // Grass tufts inside
        ctx.strokeStyle = '#15803d'; ctx.lineWidth = 1.2;
        for (let i = 0; i < 6; i++) {
          const gx = -16 + i * 6 + Math.sin(t + i) * 0.3;
          const gy = 1 + (i % 2) * 2;
          ctx.beginPath();
          ctx.moveTo(gx, gy); ctx.lineTo(gx - 1.5, gy - 4);
          ctx.moveTo(gx, gy); ctx.lineTo(gx + 1.5, gy - 4);
          ctx.moveTo(gx, gy); ctx.lineTo(gx, gy - 5);
          ctx.stroke();
        }
        // Tiny clover on the grass
        ctx.fillStyle = '#16a34a';
        ctx.beginPath(); ctx.arc(-10, 4, 1.4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(  8, 5, 1.4, 0, Math.PI * 2); ctx.fill();
        break;
      }

      case 'brew_cauldron': {
        gndShadow(18, 7);
        // Logs under cauldron
        ctx.fillStyle = '#5b3a1d';
        ctx.beginPath(); ctx.roundRect(-12, -2, 24, 4, 1.2); ctx.fill();
        ctx.fillStyle = '#a16207';
        ctx.beginPath(); ctx.ellipse(-10, 0, 3, 1.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse( 10, 0, 3, 1.5, 0, 0, Math.PI * 2); ctx.fill();
        // Fire under cauldron
        const ff = 1 + Math.sin(t * 8 + phase) * 0.10;
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.moveTo(-7, -2);
        ctx.bezierCurveTo(-9, -8 * ff, -3, -10 * ff, 0, -2);
        ctx.bezierCurveTo(3, -10 * ff, 9, -8 * ff, 7, -2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#fde68a';
        ctx.beginPath();
        ctx.moveTo(-3, -2);
        ctx.bezierCurveTo(-4, -6 * ff, 4, -6 * ff, 3, -2);
        ctx.closePath();
        ctx.fill();
        // Cauldron body
        ctx.fillStyle = '#1f2937';
        ctx.beginPath(); ctx.ellipse(0, -8, 16, 14, 0, 0, Math.PI); ctx.fill();
        ctx.fillStyle = '#0f172a';
        ctx.beginPath(); ctx.ellipse(0, -8, 16, 14, 0, Math.PI * 0.7, Math.PI); ctx.fill();
        // Cauldron rim
        ctx.fillStyle = '#374151';
        ctx.beginPath(); ctx.ellipse(0, -22, 16, 6, 0, 0, Math.PI * 2); ctx.fill();
        // Brew surface
        ctx.fillStyle = '#a78bfa';
        ctx.beginPath(); ctx.ellipse(0, -22, 13, 4.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath(); ctx.ellipse(-4, -23, 4, 1.4, -0.2, 0, Math.PI * 2); ctx.fill();
        // Bubbles
        const bp = (t * 1.6 + phase) % 2;
        ctx.fillStyle = '#c4b5fd';
        ctx.beginPath(); ctx.arc(-5 + Math.sin(t * 3) * 1, -22 - bp * 4, 1.4 - bp * 0.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(4 + Math.sin(t * 3 + 1) * 1, -22 - ((bp + 1) % 2) * 4, 1.2, 0, Math.PI * 2); ctx.fill();
        // Steam wisps
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        const sy = (t * 6) % 12;
        ctx.beginPath(); ctx.arc(0, -34 - sy, 2.4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(4, -38 - sy * 0.6, 1.6, 0, Math.PI * 2); ctx.fill();
        break;
      }

      default: {
        // Fallback — render the prop's emoji icon if we don't have a
        // dedicated drawing for some new craft prop yet.
        gndShadow(10, 4);
        ctx.font = '32px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(def.icon, 0, -2);
      }
    }
    ctx.restore();
  }

  // ── Happiness Palette ── per-character desaturation only.
  // The previous version applied a CSS filter to the whole canvas which
  // washed out the entire scene as the player's mood dropped. We now
  // expose the value via `window._happinessSaturation` so individual
  // entity render paths (the player especially) can desaturate THEIR
  // own colours without affecting the world / clouds / UI.
  _applyHappinessPalette(happy) {
    // Smooth 0..1 saturation curve: 1 at 80%+, fades to ~0.2 at 0% happy.
    const sat = happy >= 80 ? 1
              : happy >= 40 ? 0.7 + (happy - 40) / 40 * 0.3
              : happy >= 15 ? 0.4 + (happy - 15) / 25 * 0.3
              :               Math.max(0.15, 0.4 * (happy / 15));
    window._happinessSaturation = sat;
    // Clear any leftover canvas-wide filter from the old behaviour.
    if (this.canvas && this.canvas.style.filter && this.canvas.style.filter !== 'none') {
      this.canvas.style.filter = 'none';
    }
  }

  draw(ctx) {
    // Apply happiness palette on the canvas element level
    this._applyHappinessPalette(this.player.stats.happy);

    // 1. Draw World Tiles
    this.world.draw(ctx, this.camera.x, this.camera.y, getLevelLightRadius(this.player.stats.level), this.player.stats.happy);

    // 2. Draw campfire, cooking station, merchant camp, and junks (below entities)
    if (this.merchantCamp && !this.editMode?.stored?.merchantCamp)   this.merchantCamp.draw(ctx, this.world);
    if (this.campfire) this.campfire.draw(ctx, this.world);
    if (this.cookingStation && !this.editMode?.stored?.cookingStation) this.cookingStation.draw(ctx, this.world);
    for (const jk of this.junks) jk.draw(ctx, this.world);

    // 3. Sort entities + placed cosmetics by isometric depth
    // Build a fast {id -> def} map for cosmetic lookup (built once, cached on instance).
    if (!this._cosmeticDefMap || this._cosmeticDefMap._size !== (window.COSMETIC_DEFS || []).length) {
      this._cosmeticDefMap = new Map();
      for (const d of (window.COSMETIC_DEFS || [])) this._cosmeticDefMap.set(d.id, d);
      this._cosmeticDefMap._size = (window.COSMETIC_DEFS || []).length;
    }

    // Build a single drawables array (reuse the entities array; append cosmetic sprite refs).
    // Cache the iso depth on each sprite so the sort comparator is a cheap number compare,
    // not 2 toIso() calls per comparison (was ~3000+ object allocs/frame at high item counts).
    const drawables = this._drawables || (this._drawables = []);
    drawables.length = 0;
    const halfTile = this.world.tileSize / 2;
    for (const e of this.entities) {
      e._isoY = (e.visualX + e.visualY) * halfTile;
      drawables.push(e);
    }
    const placed = this.editMode?.placedCosmetics || [];
    for (const c of placed) {
      const def = this._cosmeticDefMap.get(c.id);
      if (!def) continue;
      // Stash a reusable sprite descriptor on the cosmetic entry itself
      if (!c._sprite) c._sprite = { visualX: c.x, visualY: c.y, _cosmeticDef: def, _isoY: 0 };
      else { c._sprite.visualX = c.x; c._sprite.visualY = c.y; c._sprite._cosmeticDef = def; }
      c._sprite._isoY = (c.x + c.y) * halfTile;
      drawables.push(c._sprite);
    }
    drawables.sort((a, b) => a._isoY - b._isoY);

    // Draw entities and cosmetics in depth order
    const _treeIds = new Set(['oak_tree','pine_tree','palm_tree','cherry_bloom','bamboo_grove']);
    for (const item of drawables) {
      if (item._cosmeticDef) {
        const def = item._cosmeticDef;
        const iso = this.world.toIso(item.visualX, item.visualY);
        ctx.save();
        ctx.globalAlpha = 1; // cosmetics never fade
        if (def.isCraftProp) {
          this._drawCraftPropCosmetic(ctx, iso, def);
        } else if (_treeIds.has(def.id)) {
          this._drawTreeCosmetic(ctx, iso, def);
        } else {
          this._drawDecorCosmetic(ctx, iso, def);
        }
        ctx.restore();
      } else {
        item.draw(ctx, this.world);
      }
    }

    // 4a. Campfire flame layer — drawn AFTER entities so the fire columns
    // tower over any character standing at or near the fire pit. The ground
    // ring + logs were already drawn under the entities in step 2.
    if (this.campfire) this.campfire.drawFlame(ctx, this.world);

    // 4b. Edit mode grid + overlay (below light mask so grid respects darkness)
    if (this.editMode?.active) this.editMode.drawOverlay(ctx);

    // 4c. Night tint — soft deep-blue/violet overlay that thickens at night
    // and fades smoothly during dusk + dawn. Fires for the WHOLE canvas in
    // screen space, not the lit-area circle, so the meadow + clouds + entities
    // all read as "nighttime" together. The campfire flame is drawn before
    // this, so its glow softly punches through.
    {
      const DAY_DUR = 235, NIGHT_DUR = 101;
      const NIGHT_MAX = 0.28;
      const DUSK_END  = 0.18;        // tint reached by the time day ends
      const NIGHT_FADE_IN  = 18;     // seconds to ramp dusk → full night
      const NIGHT_FADE_OUT = 20;     // seconds at end of night to fade to dawn
      const isNight = this.time.phase === 'Night';
      const elapsed = this.time.seconds || 0;
      // Target tint strength: 0 during day (except dusk), up to NIGHT_MAX at night.
      let strength = 0;
      if (isNight) {
        // Smoothly ramp from the dusk endpoint up to full night over the
        // first NIGHT_FADE_IN seconds — avoids the visible "snap" that
        // happened when night previously jumped straight to NIGHT_MAX.
        const fadeOutStart = NIGHT_DUR - NIGHT_FADE_OUT;
        if (elapsed < NIGHT_FADE_IN) {
          const k = elapsed / NIGHT_FADE_IN;
          // easeInOutCubic for a soft, gradual deepening
          const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
          strength = DUSK_END + (NIGHT_MAX - DUSK_END) * e;
        } else if (elapsed > fadeOutStart) {
          strength = NIGHT_MAX * Math.max(0, 1 - (elapsed - fadeOutStart) / NIGHT_FADE_OUT);
        } else {
          strength = NIGHT_MAX;
        }
      } else {
        // Last 35s of day → dusk ramp from 0 to DUSK_END.
        const duskStart = DAY_DUR - 35;
        if (elapsed > duskStart) {
          strength = DUSK_END * Math.min(1, (elapsed - duskStart) / 30);
        }
      }
      if (strength > 0.005) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);   // screen space
        // Cool indigo/violet for night — feels like moonlight, not gloom.
        ctx.fillStyle = `rgba(28, 30, 78, ${strength})`;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        // Add a faint warm halo around the campfire in night so the fire
        // feels like the source of light. Skipped in low-spec.
        if (isNight && !window._lowSpecMode) {
          const ci = this.world.toIso(0, 0);
          const sx = (ci.x - this.camera.x) * this.camera.zoom + this.canvas.width / 2;
          const sy = (ci.y - this.camera.y) * this.camera.zoom + this.canvas.height / 2;
          const haloR = 180 * this.camera.zoom;
          const grd = ctx.createRadialGradient(sx, sy, 30, sx, sy, haloR);
          grd.addColorStop(0,   'rgba(254, 215, 170, 0.18)');
          grd.addColorStop(0.5, 'rgba(254, 215, 170, 0.08)');
          grd.addColorStop(1,   'rgba(254, 215, 170, 0)');
          ctx.fillStyle = grd;
          ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
        ctx.restore();
      }
    }

    // 5. Draw Light Mask
    const centerIso = this.world.toIso(0, 0);
    this.world.drawLightMask(ctx, centerIso.x, centerIso.y, getLevelLightRadius(this.player.stats.level), this);

    // 6. Draw Attack VFX + bullets (above light mask so they glow through)
    for (const vfx of this.attackVFXList) vfx.draw(ctx, this.world);
    for (const b of this.bullets) b.draw(ctx, this.world);
    for (const vfx of this.specialVFX) vfx.draw(ctx, this.world);

    // 6a. Starlight Owl: pulsing "⚠" ring at each pending nightmare spawn
    if (this._nightmareWarnings.length) {
      const tw = Date.now() / 1000;
      for (const w of this._nightmareWarnings) {
        const iso = this.world.toIso(w.x, w.y);
        const pct = 1 - w.timer / w.maxTimer;          // 0 → 1 as spawn approaches
        const pulse = 0.5 + Math.sin(tw * 6) * 0.5;    // 0..1
        ctx.save();
        ctx.strokeStyle = '#ff3333';
        ctx.shadowColor = '#ff3333';
        ctx.shadowBlur  = 12 + pulse * 10;
        ctx.lineWidth   = 2 + pct * 2;
        ctx.globalAlpha = 0.55 + pulse * 0.35;
        ctx.beginPath();
        ctx.ellipse(iso.x, iso.y, 28 + pct * 14, 14 + pct * 7, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 0.85;
        ctx.font = 'bold 22px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚠️', iso.x, iso.y - 24);
        ctx.restore();
      }
    }

    // 6b. Shield bubble on player
    if (this.player._hasShield) {
      const iso = this.world.toIso(this.player.visualX, this.player.visualY);
      const t   = Date.now() / 1000;
      const pulse = 1 + Math.sin(t * 4) * 0.06;
      ctx.save();
      ctx.globalAlpha = 0.38 + Math.sin(t * 3) * 0.1;
      ctx.strokeStyle = '#93c5fd';
      ctx.shadowColor = '#3b82f6';
      ctx.shadowBlur  = 18;
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.ellipse(iso.x, iso.y - 30, 26 * pulse, 20 * pulse, 0, 0, Math.PI * 2);
      ctx.stroke();
      // Inner shimmer
      ctx.globalAlpha = 0.08 + Math.sin(t * 5) * 0.04;
      ctx.fillStyle   = '#bfdbfe';
      ctx.fill();
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      ctx.restore();
    }

    // 6c. Stun rings on stunned nightmares
    for (const nm of this.nightmares) {
      if (!nm.isDead && nm.stunTimer > 0) {
        const iso = this.world.toIso(nm.visualX || nm.x, nm.visualY || nm.y);
        const t   = Date.now() / 1000;
        ctx.save();
        ctx.translate(iso.x, iso.y - 48);
        const stars = ['⭐', '💫', '✨'];
        for (let i = 0; i < 3; i++) {
          const a = t * 3.2 + i * (Math.PI * 2 / 3);
          ctx.globalAlpha = 0.85;
          ctx.font = '11px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(stars[i], Math.cos(a) * 14, Math.sin(a) * 7);
        }
        ctx.globalAlpha = 1;
        ctx.restore();
      }
    }

    // 6c. Item-poof bursts — small pastel sparkles at the item's last
    // position when a magneted item meets the player and disappears.
    if (this._itemPoofs && this._itemPoofs.length) {
      for (const pf of this._itemPoofs) {
        const t = pf.t / pf.life;                // 0..1
        const iso = this.world.toIso(pf.wx, pf.wy);
        ctx.save();
        ctx.translate(iso.x, iso.y - 14);        // sit roughly where the item was
        // Soft expanding ring, fades out fast.
        const ringR = 6 + t * 14;
        const ringA = (1 - t) * 0.55;
        ctx.strokeStyle = `rgba(255, 244, 236, ${ringA})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 4, ringR, ringR * 0.45, 0, 0, Math.PI * 2);
        ctx.stroke();
        // Particles.
        for (const pa of pf.particles) {
          const a = (1 - t) * 0.95;
          ctx.fillStyle = pa.col;
          ctx.globalAlpha = a;
          ctx.beginPath();
          ctx.arc(pa.ox, pa.oy, pa.size * (1 - t * 0.4), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.restore();
      }
    }

    // 6c2. Celebration confetti bursts (task completion).
    if (this._celebrations && this._celebrations.length) {
      for (const cb of this._celebrations) {
        const t = cb.t / cb.life;
        const iso = this.world.toIso(cb.wx, cb.wy);
        ctx.save();
        ctx.translate(iso.x, iso.y - 18);
        // Expanding white ring underneath.
        const ringR = 10 + t * 38;
        const ringA = (1 - t) * 0.6;
        ctx.strokeStyle = `rgba(255, 244, 236, ${ringA})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(0, 6, ringR, ringR * 0.45, 0, 0, Math.PI * 2);
        ctx.stroke();
        // Particles.
        for (const pa of cb.particles) {
          const a = Math.max(0, 1 - t);
          ctx.globalAlpha = a;
          if (pa.kind === 'confetti') {
            ctx.save();
            ctx.translate(pa.ox, pa.oy);
            ctx.rotate(pa.rot);
            ctx.fillStyle = pa.col;
            ctx.fillRect(-pa.w / 2, -pa.h / 2, pa.w, pa.h);
            // Sticker outline.
            ctx.strokeStyle = 'rgba(120, 80, 130, 0.45)';
            ctx.lineWidth = 0.6;
            ctx.strokeRect(-pa.w / 2, -pa.h / 2, pa.w, pa.h);
            ctx.restore();
          } else {
            // Sparkle star — a small + plus a diagonal cross.
            ctx.fillStyle = pa.col;
            ctx.beginPath(); ctx.arc(pa.ox, pa.oy, pa.size, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = pa.col;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(pa.ox - pa.size * 1.6, pa.oy);
            ctx.lineTo(pa.ox + pa.size * 1.6, pa.oy);
            ctx.moveTo(pa.ox, pa.oy - pa.size * 1.6);
            ctx.lineTo(pa.ox, pa.oy + pa.size * 1.6);
            ctx.stroke();
          }
        }
        // Floating "🎉" emoji above the burst.
        ctx.globalAlpha = Math.max(0, 1 - t);
        ctx.font = `${20 + t * 8}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🎉', 0, -28 - t * 30);
        ctx.globalAlpha = 1;
        ctx.restore();
      }
    }

    // 6d. Pickup float notifications
    for (const pf of this._pickupFloats) {
      const t = pf.timer / pf.life;          // 0→1
      const iso = this.world.toIso(pf.wx, pf.wy);
      const yOff = t * 52;                   // float 52px upward
      const alpha = t < 0.3 ? t / 0.3 : 1 - (t - 0.3) / 0.7; // fade in then out
      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.font = 'bold 13px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // soft shadow
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = 6;
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(`${pf.icon} +1 ${pf.name}`, iso.x, iso.y - 62 - yOff);
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // 7b. Draw interaction prompts (cooking station + merchant)
    this._drawInteractionPrompts(ctx);

    // 7c. Level-up cinematic overlay (above everything in world space)
    if (this._levelUpAnim.active) this._drawLevelUpOverlay(ctx);

    // 7d. Butterfly particles
    this._drawButterflies(ctx);

    // 7e. Quote overlay (screen-space, drawn after world transform restore)
    if (this._quoteDisplay.timer > 0) this._drawQuoteOverlay(ctx);

    // 7f. Achievement / merchant notification (canvas, anchored below campfire)
    if (this._achNotif) this._drawAchNotif(ctx);
    // 7g. Boss night warning overlay
    if (this._bossNightNotif) this._drawBossNightBanner(ctx);

    // 7. Companion KO / HP indicators
    for (const c of this.companions) {
      if (c.isKO) {
        const iso = this.world.toIso(c.visualX, c.visualY);
        ctx.save();
        ctx.translate(iso.x, iso.y);
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = '#1e1e2e';
        ctx.beginPath(); ctx.ellipse(0, 0, 14, 7, 0, 0, Math.PI*2); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.font = '18px Arial'; ctx.textAlign = 'center';
        ctx.fillText('💤', 0, -20);
        // Revive countdown
        const secs = Math.ceil(c.reviveTimer);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 9px Arial';
        ctx.fillText(`${secs}s`, 0, -36);
        ctx.restore();
      } else if (c.hp < c.maxHp * 0.8) {
        // Show HP bar when damaged
        const iso = this.world.toIso(c.visualX, c.visualY);
        ctx.save();
        ctx.translate(iso.x, iso.y);
        const bw = 24, bh = 3;
        const pct = c.hp / c.maxHp;
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(-bw/2, -32, bw, bh);
        ctx.fillStyle = pct > 0.5 ? '#22c55e' : (pct > 0.25 ? '#f59e0b' : '#ef4444');
        ctx.fillRect(-bw/2, -32, bw*pct, bh);
        ctx.restore();
      }
    }
  }

  updateHUD() {
    const s = this.player.stats;
    // Stat values are now compact integers (no max-HP slash, no % glyph
    // for hunger/thirst/happy) so they fit in the 2×2 mini-grid.
    this.ui.hpVal.innerText = `${Math.floor(s.hp)}`;
    this.ui.hp.style.width = `${(s.hp/s.maxHp)*100}%`;
    this.ui.hungerVal.innerText = `${Math.floor(s.hunger)}`;
    this.ui.hunger.style.width = `${s.hunger}%`;
    this.ui.thirstVal.innerText = `${Math.floor(s.thirst)}`;
    this.ui.thirst.style.width = `${s.thirst}%`;
    this.ui.happyVal.innerText = `${Math.floor(s.happy)}`;
    this.ui.happy.style.width = `${s.happy}%`;
    const xpNeeded = s.level * 225;
    this.ui.level.innerText = `Lv.${s.level} · ${Math.floor(s.xp)}/${xpNeeded}xp`;
    document.getElementById('info-time').innerText = `${this.time.phase}`;
    const compEl = document.getElementById('info-comps');
    if (compEl) compEl.innerText = `🐾 ${this.companions.length}/${this.getMaxDeployedCompanions()}`;
    // ── Day/Night pill — emoji + day count + phase tag + progress bar.
    this._updateDayPill();
    // Gold in HUD
    const goldEl = document.getElementById('info-gold');
    if (goldEl) goldEl.innerText = `💰 ${this.gold}g`;
    // Achievement count
    const achEl = document.getElementById('info-ach');
    if (achEl) achEl.innerText = `🏆 ${this.ach.unlockedCount}/${ALL_ACHIEVEMENTS.length}`;
    // Merchant button — pulse when present, dim when absent
    const mBtn = document.getElementById('btn-merchant');
    if (mBtn) {
      if (this.merchantPresent) {
        mBtn.classList.add('merchant-active');
        mBtn.disabled = false;
        mBtn.style.opacity = '1';
      } else {
        mBtn.classList.remove('merchant-active');
        mBtn.disabled = true;
        mBtn.style.opacity = '0.35';
        // Subtle time-remaining hint (show arrival countdown during day)
        const remaining = Math.max(0, Math.ceil(this.MERCHANT_ARRIVE_TIME - this.time.seconds));
        const span = mBtn.querySelector('span');
        if (span && this.time.phase === 'Day' && !this.merchantPresent && remaining > 0) {
          span.textContent = `${Math.floor(remaining/60)}:${(remaining%60).toString().padStart(2,'0')}`;
        } else if (span) {
          span.textContent = 'Shop';
        }
      }
    }
  }

  // ── Day/Night HUD pill — pure DOM (no canvas, way cheaper than the
  // old wheel). Sets the pill's phase class for the gradient + border,
  // swaps the emoji, writes the day count + phase tag, and fills the
  // progress sliver beneath. Cached refs avoid per-frame DOM lookups.
  _updateDayPill() {
    if (!this._dpRefs) {
      this._dpRefs = {
        pill:    document.getElementById('hud-day-pill'),
        icon:    document.getElementById('hud-day-icon'),
        label:   document.getElementById('hud-day-label'),
        phase:   document.getElementById('hud-day-phase'),
        fill:    document.getElementById('hud-day-progress-fill'),
      };
    }
    const r = this._dpRefs;
    if (!r.pill) return;

    const DAY_DUR = 235, NIGHT_DUR = 101;
    const isDay = this.time.phase === 'Day';
    const elapsed = this.time.seconds;
    const dur = isDay ? DAY_DUR : NIGHT_DUR;
    const pct = Math.min(100, Math.max(0, (elapsed / dur) * 100));

    // Sub-phase tag for charm: Morning / Daytime / Dusk / Night / Late Night.
    let phaseClass = 'phase-day', icon = '☀️', tag = 'DAYTIME';
    if (isDay) {
      if      (elapsed < 30)            { icon = '🌅'; tag = 'MORNING'; phaseClass = 'phase-day'; }
      else if (elapsed > DAY_DUR - 35)  { icon = '🌇'; tag = 'DUSK';    phaseClass = 'phase-dusk'; }
      else                              { icon = '☀️'; tag = 'DAYTIME'; phaseClass = 'phase-day'; }
    } else {
      icon = '🌙';
      tag  = elapsed > NIGHT_DUR * 0.55 ? 'LATE NIGHT' : 'NIGHT';
      phaseClass = 'phase-night';
    }

    if (r.pill.dataset.phase !== phaseClass) {
      r.pill.classList.remove('phase-day', 'phase-night', 'phase-dusk');
      r.pill.classList.add(phaseClass);
      r.pill.dataset.phase = phaseClass;
    }
    if (r.icon.textContent !== icon)  r.icon.textContent  = icon;
    if (r.phase.textContent !== tag)  r.phase.textContent = tag;
    const dayText = `Day ${this.time.dayCount}`;
    if (r.label.textContent !== dayText) r.label.textContent = dayText;
    r.fill.style.width = pct + '%';
  }

  // Legacy canvas wheel — the new HUD uses _updateDayPill instead. Kept as
  // a no-op so any external code that referenced this name doesn't crash.
  _drawDayNightWheel() {
    return;
    // eslint-disable-next-line no-unreachable
    if (window._lowSpecMode) {
      this._dnwAcc = (this._dnwAcc || 0) + (this._lastDt || 0.016);
      if (this._dnwAcc < 0.25) return;
      this._dnwAcc = 0;
    }
    const canvas = document.getElementById('day-night-wheel');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const cx = W / 2, cy = H / 2;
    const outerR = W / 2 - 1;
    const innerR = outerR * 0.42;

    ctx.clearRect(0, 0, W, H);

    // Cycle constants
    const DAY_DUR = 235, NIGHT_DUR = 101, TOTAL = DAY_DUR + NIGHT_DUR;
    const elapsed = this.time.phase === 'Day' ? this.time.seconds : DAY_DUR + this.time.seconds;
    // Rotation: full spin per cycle, day sector starts pointing up (-π/2)
    const rotation = (elapsed / TOTAL) * Math.PI * 2 - Math.PI / 2;

    const dayFrac = DAY_DUR / TOTAL;    // ~0.699 → ~252°
    const dayArc  = dayFrac * Math.PI * 2;
    const nightArc = (1 - dayFrac) * Math.PI * 2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);

    // ── Day sector (pastel butter / peach) ────────────────────
    const dayGrad = ctx.createRadialGradient(0, 0, innerR * 0.3, 0, 0, outerR);
    dayGrad.addColorStop(0,    '#fff4c4');  // soft cream
    dayGrad.addColorStop(0.55, '#fde68a');  // pastel butter
    dayGrad.addColorStop(1,    '#fed7aa');  // pastel peach
    ctx.fillStyle = dayGrad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, outerR, 0, dayArc);
    ctx.closePath();
    ctx.fill();

    // ── Night sector (pastel lavender / sky) ──────────────────
    const nightGrad = ctx.createRadialGradient(0, 0, innerR * 0.3, 0, 0, outerR);
    nightGrad.addColorStop(0,   '#e9d5ff');  // soft lavender
    nightGrad.addColorStop(0.6, '#c4b5fd');  // dusty lilac
    nightGrad.addColorStop(1,   '#a5b4fc');  // pastel periwinkle
    ctx.fillStyle = nightGrad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, outerR, dayArc, Math.PI * 2);
    ctx.closePath();
    ctx.fill();

    // ── Star dots on night sector ─────────────────────────────
    const stars = [[outerR * 0.65, dayArc + nightArc * 0.2], [outerR * 0.5, dayArc + nightArc * 0.55], [outerR * 0.72, dayArc + nightArc * 0.75]];
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (const [sr, sa] of stars) {
      ctx.beginPath();
      ctx.arc(Math.cos(sa) * sr, Math.sin(sa) * sr, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Sun dot on day sector ──────────────────────────────────
    const sunA = dayArc * 0.5;
    const sunR = outerR * 0.62;
    ctx.fillStyle = 'rgba(255,235,170,0.85)';
    ctx.beginPath();
    ctx.arc(Math.cos(sunA) * sunR, Math.sin(sunA) * sunR, 2.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore(); // end rotation

    // ── Divider ring between sectors ─────────────────────────
    ctx.strokeStyle = 'rgba(120, 80, 130, 0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
    ctx.stroke();

    // ── Cream inner disc ──────────────────────────────────────
    ctx.fillStyle = '#fff4ec';
    ctx.beginPath();
    ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
    ctx.fill();

    // ── Phase glow inside ─────────────────────────────────────
    const isDay = this.time.phase === 'Day';
    const glowColor = isDay ? 'rgba(253, 230, 138, 0.65)' : 'rgba(196, 181, 253, 0.65)';
    const innerGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, innerR);
    innerGlow.addColorStop(0, glowColor);
    innerGlow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = innerGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
    ctx.fill();

    // ── Phase icon ────────────────────────────────────────────
    ctx.font = `${Math.round(innerR * 0.9)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isDay ? '☀️' : '🌙', cx, cy + 1);

    // ── Fixed 12-o'clock tick (current-time indicator) ────────
    ctx.strokeStyle = '#7c5491';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(244, 179, 218, 0.8)';
    ctx.shadowBlur = 5;
    ctx.beginPath();
    ctx.moveTo(cx, cy - outerR + 1);
    ctx.lineTo(cx, cy - outerR + 6);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // Starlight Owl: if the perk is active, queue a warning at the spawn spot
  // and defer the actual Nightmare construction until the warning expires.
  _queueNightmareSpawn(lightRadius) {
    const warn = this.perkBonuses?.nightmareWarning || 0;
    if (warn <= 0) { this.spawnNightmare(lightRadius); return; }
    const angle = Math.random() * Math.PI * 2;
    const x = Math.cos(angle) * (lightRadius + 1);
    const y = Math.sin(angle) * (lightRadius + 1);
    this._nightmareWarnings.push({ x, y, lightRadius, timer: warn, maxTimer: warn });
  }

  spawnNightmare(lightRadius, atX = null, atY = null) {
    // Suppressed during finale and after the "Stay" peaceful ending lock-in.
    if (this._finaleSuspendNightmares || this._endingPeaceful) return;
    const day = this.time.dayCount || 1;
    // Boss every 5 nights (only from day 5+)
    let nmData;
    if (day >= 5 && (day - 1) % 5 === 0 && !this._bossSpawnedThisNight) {
      nmData = GAME_DATA.nightmares.find(n => n.id === 'titan');
      this._bossSpawnedThisNight = true;
    } else {
      // Pool varies by day: only easy enemies early on
      const allPool = GAME_DATA.nightmares.filter(n => !n.isBoss);
      const easyPool = allPool.filter(n => n.hp <= 6);  // Shadow Pup, Weeping Wisp
      const medPool  = allPool.filter(n => n.hp <= 12);
      let pool;
      if (day <= 2)       pool = easyPool.length ? easyPool : allPool;
      else if (day <= 5)  pool = medPool.length  ? medPool  : allPool;
      else                pool = allPool;
      nmData = pool[Math.floor(Math.random() * pool.length)];
    }
    // Reduce HP on early days
    let hpMult = day <= 1 ? 0.5 : (day <= 3 ? 0.7 : 1.0);
    if (this.perkBonuses.nightmareHpReduction && this.perkBonuses.nightmareHpReduction < 1) {
      hpMult *= this.perkBonuses.nightmareHpReduction;
    }
    nmData = { ...nmData, hp: Math.max(1, Math.floor(nmData.hp * hpMult)) };
    const angle = Math.random() * Math.PI * 2;
    const sx = atX !== null ? atX : Math.cos(angle) * (lightRadius + 1);
    const sy = atY !== null ? atY : Math.sin(angle) * (lightRadius + 1);
    const nm = new Nightmare(sx, sy, nmData);
    nm.id = nmData.id;
    // Moon Ferret: skip the player on the first N nightmares per night (perkBonuses.nightmareIgnoreChance is the per-night budget count)
    const ignoreBudget = Math.floor(this.perkBonuses.nightmareIgnoreChance || 0);
    if (ignoreBudget > 0 && (this._moonFerretIgnoresUsed || 0) < ignoreBudget) {
      nm.ignoresPlayer = true;
      this._moonFerretIgnoresUsed = (this._moonFerretIgnoresUsed || 0) + 1;
    }
    this.nightmares.push(nm);
    this._playMeow();
  }

  _playMeow() {
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const now = ac.currentTime;
      // Meow: two oscillators — body tone + formant shimmer
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain); gain.connect(ac.destination);
      osc.type = 'sine';
      // pitch glide: start mid, rise to "ee", fall to "ow"
      osc.frequency.setValueAtTime(480, now);
      osc.frequency.linearRampToValueAtTime(720, now + 0.08);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.32);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.09, now + 0.06);
      gain.gain.linearRampToValueAtTime(0.06, now + 0.22);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      osc.start(now); osc.stop(now + 0.4);
      // Soft harmonic shimmer
      const osc2 = ac.createOscillator();
      const g2 = ac.createGain();
      osc2.connect(g2); g2.connect(ac.destination);
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(960, now);
      osc2.frequency.linearRampToValueAtTime(1440, now + 0.08);
      osc2.frequency.exponentialRampToValueAtTime(640, now + 0.32);
      g2.gain.setValueAtTime(0, now);
      g2.gain.linearRampToValueAtTime(0.025, now + 0.06);
      g2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc2.start(now); osc2.stop(now + 0.38);
    } catch(e) {}
  }

  _spawnMerchant(lightRadius) {
    const angle = Math.random() * Math.PI * 2;
    const d = Math.max(0.8, lightRadius * 0.4);
    this.merchant = new Merchant(Math.cos(angle) * d, Math.sin(angle) * d);
    this.merchant.showEmote('💰', 3.0);
  }

  _spawnMerchantAtCamp() {
    // Spawn merchant emerging from camp position
    this.merchant = new Merchant(this.merchantCamp.x + 0.2, this.merchantCamp.y + 0.2);
    this.merchant.showEmote('💰', 2.0);
    this.merchant.speed = 1.5; // normal roam speed
    this.player.showEmote('💬', 2.0);
    // Rotate which rare items the merchant carries this visit
    if (typeof _rotateRareStock === 'function') _rotateRareStock();
  }

  // ── Prop active abilities ────────────────────────────────
  _getPropAbilityCD(propId) {
    if (!this._propAbilityCD) this._propAbilityCD = {};
    return this._propAbilityCD[propId] || 0;
  }

  _tickPropAbilityCDs(dt) {
    if (!this._propAbilityCD) return;
    let anyTicked = false;
    for (const id in this._propAbilityCD) {
      if (this._propAbilityCD[id] > 0) {
        this._propAbilityCD[id] = Math.max(0, this._propAbilityCD[id] - dt);
        anyTicked = true;
      }
    }
    // If the Craft modal is open, refresh ~2x per second so cooldowns visibly count down
    if (anyTicked) {
      this._cdRefreshAcc = (this._cdRefreshAcc || 0) + dt;
      if (this._cdRefreshAcc >= 0.5) {
        this._cdRefreshAcc = 0;
        const modal = document.getElementById('modal-craft');
        if (modal && modal.style.display !== 'none' && typeof window.updateCraftUI === 'function') {
          window.updateCraftUI();
        }
      }
    }
    if (this._wardPulseTimer && this._wardPulseTimer > 0) {
      this._wardPulseTimer -= dt;
      // Push nightmares within 4 tiles away from the player.
      // Squared-radius gate avoids sqrt unless we actually need to normalize.
      const px = this.player.x, py = this.player.y;
      const rSq = 16; // 4 * 4
      for (const n of this.nightmares) {
        if (n.isDead) continue;
        const dx = n.x - px, dy = n.y - py;
        const dsq = dx*dx + dy*dy;
        if (dsq < rSq && dsq > 0.000001) {
          const d = Math.sqrt(dsq);
          n.targetX = px + (dx / d) * 6;
          n.targetY = py + (dy / d) * 6;
        }
      }
    }
  }

  useAbility(propId) {
    if (!this.builtProps[propId]) { this.player.showEmote('❌', 1.0); return false; }
    const prop = GAME_DATA.craftProps.find(p => p.id === propId);
    if (!prop || !prop.ability) return false;
    if (this._getPropAbilityCD(propId) > 0) {
      this.player.showEmote('⏳', 1.0);
      return false;
    }
    if (!this._propAbilityCD) this._propAbilityCD = {};
    this._propAbilityCD[propId] = prop.ability.cooldown;

    // Fire the effect + first-use feat
    switch (prop.ability.effect) {
      case 'quick_heat':
        this.player.stats.hunger = Math.min(100, this.player.stats.hunger + 30);
        this.player.showEmote('🔥', 1.5);
        this._showToast('Quick Heat', '+30 hunger', '🔥', 'ABILITY');
        this.ach.set('ab_quick_heat', 1);
        break;
      case 'bright_burst': {
        this.player.stats.happy = Math.min(100, this.player.stats.happy + this._modHappyGain(15, false));
        const px = this.player.x, py = this.player.y;
        this.companions.forEach(c => {
          if (Math.hypot(c.x - px, c.y - py) < 5) {
            if (typeof c.mood === 'number') c.mood = Math.min(100, c.mood + 10);
          }
        });
        this.player.showEmote('✨', 1.5);
        this._showToast('Bright Burst', '+15 happy · nearby Compys +10 mood', '✨', 'ABILITY');
        this.ach.set('ab_bright_burst', 1);
        break;
      }
      case 'ward_pulse':
        this._wardPulseTimer = 8;
        this.player.showEmote('🛡️', 1.5);
        this._showToast('Ward Pulse', 'Nightmares pushed back (8s)', '🛡️', 'ABILITY');
        this.ach.set('ab_ward_pulse', 1);
        break;
      case 'lullaby':
        this.companions.forEach(c => { if (typeof c.mood === 'number') c.mood = 100; });
        this.player.showEmote('🎵', 1.5);
        this._showToast('Lullaby', 'All Compys at 100% mood', '🎵', 'ABILITY');
        this.ach.set('ab_lullaby', 1);
        break;
    }
    this.saveGame();
    return true;
  }

  // Apply a rare-item effect bought from the merchant
  _applyRareEffect(item) {
    if (!item || !item.effect) return;
    switch (item.effect) {
      case 'tonic_vigor': {
        this.player.stats.maxHp += 20;
        this.player.stats.hp = Math.min(this.player.stats.maxHp, this.player.stats.hp + 20);
        this.player.showEmote('💪', 1.5);
        this._showToast('Tonic of Vigor', '+20 max HP this run', '💪', 'RARE');
        break;
      }
      case 'moonlight': {
        // 1-night nightmare repel aura — implemented as nightmare spawn pause
        this._moonlightUntilDayCount = (this.time.dayCount || 1) + 1; // active through next dawn
        this.player.showEmote('🏮', 1.5);
        this._showToast('Moonlight Lantern', 'Nightmares repelled tonight', '🏮', 'RARE');
        break;
      }
      case 'whistle': {
        // Teleport all deployed Compys to player's tile
        const px = this.player.x, py = this.player.y;
        this.companions.forEach(c => {
          c.targetX = px + (Math.random() - 0.5) * 0.6;
          c.targetY = py + (Math.random() - 0.5) * 0.6;
        });
        this.player.showEmote('📯', 1.5);
        this._showToast('Companion Whistle', 'Compys called to your side', '📯', 'RARE');
        break;
      }
      case 'happy_candle': {
        this._happinessCandleTimer = 600; // 10 minutes in seconds
        this.player.showEmote('🕯️', 1.5);
        this._showToast('Happiness Candle', 'Happiness frozen for 10 min', '🕯️', 'RARE');
        break;
      }
      case 'memory_shard': {
        this._legacyCarrySlots = (this._legacyCarrySlots || 0) + 1;
        this.player.showEmote('💠', 1.5);
        this._showToast('Memory Shard', '+1 Legacy Perk slot at next reincarnation', '💠', 'RARE');
        break;
      }
      case 'dream_seed': {
        // Spawn a rare T3 ingredient drop near the player
        const rares = ['Sea Crystal','Solar Berry','Ice Shard','Thunder Silk','Bamboo Shoot'];
        const pick = rares[Math.floor(Math.random() * rares.length)];
        const ang = Math.random() * Math.PI * 2;
        const r = 0.6;
        this.spawnItem(this.player.x + Math.cos(ang)*r, this.player.y + Math.sin(ang)*r, pick);
        this.player.showEmote('🌱', 1.5);
        this._showToast(`Dream Seed`, `Sprouted: ${pick}`, '🌱', 'RARE');
        break;
      }
    }
    this.saveGame();
  }

  _getRandomQuote() {
    if (this._usedQuoteIndices.size >= LIFE_QUOTES.length) this._usedQuoteIndices.clear();
    let idx;
    do { idx = Math.floor(Math.random() * LIFE_QUOTES.length); }
    while (this._usedQuoteIndices.has(idx));
    this._usedQuoteIndices.add(idx);
    return LIFE_QUOTES[idx];
  }

  _showLevelUpQuote() {
    const quote = this._getRandomQuote();
    this._quoteDisplay.text = quote;
    this._quoteDisplay.timer = this._quoteDisplay.maxTime;
    this._playDreamyMusic();
  }

  _playDreamyMusic() {
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      // Gentle chord progression: C maj → G maj → A min → F maj
      const chords = [
        [261.6, 329.6, 392],    // C maj
        [392, 493.9, 587.3],    // G maj
        [220, 261.6, 329.6],    // A min
        [174.6, 220, 261.6],    // F maj
      ];
      chords.forEach((chord, ci) => {
        const t = ci * 1.25;
        chord.forEach(freq => {
          const osc = ac.createOscillator();
          const g = ac.createGain();
          osc.connect(g); g.connect(ac.destination);
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, ac.currentTime + t);
          g.gain.setValueAtTime(0, ac.currentTime + t);
          g.gain.linearRampToValueAtTime(0.04, ac.currentTime + t + 0.3);
          g.gain.linearRampToValueAtTime(0.03, ac.currentTime + t + 1.0);
          g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + t + 1.3);
          osc.start(ac.currentTime + t);
          osc.stop(ac.currentTime + t + 1.35);
        });
      });
    } catch(e) {}
  }

  _drawQuoteOverlay(ctx) {
    const qd = this._quoteDisplay;
    const frac = qd.timer / qd.maxTime;
    const alpha = frac > 0.85 ? ((1 - frac) / 0.15) : (frac < 0.15 ? frac / 0.15 : 1);
    if (alpha <= 0) return;

    ctx.save();
    const cw = this.canvas.width, ch = this.canvas.height;
    ctx.resetTransform();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Positioned below the level-up notification (which ends around ch/2 + 108)
    const cx = cw / 2;
    const cy = ch / 2 + 140;

    // Light-mode swap — pale lavender + soft glow disappear on cream sky.
    const isLight = !document.body.classList.contains('dark-mode');
    const labelCol  = isLight ? '#6d28d9' : '#c4b5fd';
    const labelGlow = isLight ? '#ffffff' : '#8b5cf6';
    const quoteCol  = isLight ? '#3b1d52' : '#e8d8ff';
    const quoteGlow = isLight ? '#ffffff' : '#9b6cf0';

    // "Light has expanded" label — same style as level-up subtitle
    ctx.font = 'bold 15px Inter, sans-serif';
    ctx.fillStyle = labelCol;
    ctx.shadowColor = labelGlow;
    ctx.shadowBlur = 12;
    ctx.fillText('✨ Light has expanded', cx, cy);

    // Quote text — word-wrapped, glowing italic
    ctx.font = 'italic 26px Georgia, serif';
    ctx.fillStyle = quoteCol;
    ctx.shadowColor = quoteGlow;
    ctx.shadowBlur = 8;

    const maxW = cw * 0.80;
    const words = qd.text.split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
      else line = test;
    }
    if (line) lines.push(line);

    const lineH = 32;
    const textStartY = cy + 22;
    lines.forEach((l, i) => ctx.fillText(l, cx, textStartY + i * lineH));

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  _updateButterflies(dt, happy) {
    if (happy < 80) { this._butterflies = []; return; }
    const maxCount = Math.floor((happy - 80) / 5) + 1; // 1 at 80, up to 5 at 100
    this._butterflySpawnTimer -= dt;
    if (this._butterflySpawnTimer <= 0 && this._butterflies.length < maxCount) {
      const lr = getLevelLightRadius(this.player.stats.level);
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * lr * 0.8;
      const iso = this.world.toIso(Math.cos(angle) * r, Math.sin(angle) * r);
      this._butterflies.push({
        x: iso.x, y: iso.y,
        vx: (Math.random() - 0.5) * 20,
        vy: (Math.random() - 0.5) * 10,
        life: 4 + Math.random() * 4,
        maxLife: 8,
        flap: Math.random() * Math.PI * 2,
        icon: Math.random() < 0.5 ? '🦋' : '🐝',
      });
      this._butterflySpawnTimer = 1.5 + Math.random() * 2;
    }
    for (let i = this._butterflies.length - 1; i >= 0; i--) {
      const b = this._butterflies[i];
      b.life -= dt;
      b.flap += dt * 5;
      b.x += b.vx * dt + Math.sin(b.flap * 0.7) * 8 * dt;
      b.y += b.vy * dt + Math.cos(b.flap * 0.5) * 4 * dt;
      if (b.life <= 0) this._butterflies.splice(i, 1);
    }
  }

  _drawButterflies(ctx) {
    for (const b of this._butterflies) {
      const frac = b.life / b.maxLife;
      const alpha = frac < 0.2 ? frac / 0.2 : (frac > 0.8 ? (1 - frac) / 0.2 : 1);
      ctx.save();
      ctx.globalAlpha = alpha * 0.85;
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(b.icon, b.x, b.y);
      ctx.restore();
    }
  }

  _showMerchantToast() {
    // Reuse the achievement toast element for a merchant arrival notice
    const el = document.getElementById('ach-toast');
    if (!el) return;
    this._achNotif = { icon: '🧙', label: 'VISITOR', name: 'Merchant has arrived!', sub: 'Tap to shop', timer: 4.2, maxTimer: 4.2 };
  }

  // Generic notification toast (rare item purchase, ability fire, etc.)
  _showToast(name, sub, icon = '✨', label = 'EFFECT') {
    this._achNotif = { icon, label, name, sub, timer: 3.6, maxTimer: 3.6 };
  }

  _dismissToast() {
    this._achNotif = null;
  }

  // Returns the player's current walkable light radius, in tiles.
  getLightRadius() {
    return getLevelLightRadius(this.player?.stats?.level || 1);
  }

  // Emit an ember burst at the campfire (used on Tend commit + Crown Flame).
  _campfireEmberBurst(count = 22) {
    if (!this.campfire) return;
    for (let i = 0; i < count; i++) {
      this.campfire._spawnBurstParticle?.();
    }
    this.campfire.burstTime = this.campfire.burstDuration || 1.2;
  }

  // Tap-arrive handler for the campfire (menuId === 'campfire'). Three paths:
  //   1. Shard-10 name input armed → prompt for the player's name.
  //   2. Next Remembering's gate is met → Talk / Tend choice.
  //   3. Otherwise → daily-warmth bubble (existing flow).
  _onCampfireArrive() {
    if (!this.campfire) return;
    if (this.story?.campfire) this.story.campfire.tapCount = (this.story.campfire.tapCount || 0) + 1;

    // Shard 10 special: if the name input is armed, intercept the tap with the
    // glass-morphism prompt instead of the daily-warmth bubble.
    if (this.story?.flags?.nameInputArmed) {
      this._showCampfireNameInput();
      return;
    }

    // Tend flow: if there's a pending upgrade and its gate is met, offer the choice.
    const pending = nextPendingUpgrade(this.story?.campfire?.upgrades);
    if (pending && this._checkUpgradeGate(pending)) {
      this._showTendChoice(pending);
      return;
    }

    // Default: daily-warmth bubble.
    const line = this.campfire.pickLine(this);
    window.StoryAudio?.playCampfireTap?.(0.6);
    if (window.StoryPanel) {
      window.StoryPanel.show({
        kind: 'bubble',
        icon: '🔥',
        lines: [line.text],
        dismissDelay: 4500,
      });
    }
  }

  // Returns true if the upgrade's gate condition is currently satisfied.
  // Gate types: childFound, nightsSurvived, recipesCooked, decorPlaced,
  // playerLevel, priorAll, and (composite via { type: 'and', of: [...] }).
  _checkUpgradeGate(upgrade) {
    return this._evalGate(upgrade.gate);
  }
  _evalGate(g) {
    if (!g) return true;
    switch (g.type) {
      case 'childFound':     return !!this.story?.children?.found?.[g.childIdx];
      case 'nightsSurvived': return Math.max(0, (this.time?.dayCount || 1) - 1) >= (g.count || 0);
      case 'recipesCooked':  return (this.ach?.c?.cook_total || 0) >= (g.count || 0);
      case 'decorPlaced':    return (this.editMode?.placedCosmetics?.length || 0) >= (g.count || 0);
      case 'playerLevel':    return (this.player?.stats?.level || 0) >= (g.value || 0);
      case 'priorAll':       return (this.story?.campfire?.upgrades || []).slice(0, g.count || 0).every(Boolean);
      case 'and':            return (g.of || []).every(c => this._evalGate(c));
    }
    return false;
  }

  // Returns true if the player has enough of the cost type in their inventory.
  _hasUpgradeCost(upgrade) {
    const c = upgrade.cost || { type: 'none' };
    if (c.type === 'none') return true;
    const inv = this.player?.inventory || {};
    let total = 0;
    if (c.type === 'anyIngredient') {
      for (const k in inv) {
        const item = getItemData(k);
        if (item && item.tier && !isCookedFood(k)) total += inv[k] || 0;
      }
    } else if (c.type === 'anyCooked') {
      for (const k in inv) if (isCookedFood(k)) total += inv[k] || 0;
    }
    return total >= (c.count || 0);
  }

  // Subtract the upgrade cost from the player's inventory. Returns true on success.
  _spendUpgradeCost(upgrade) {
    const c = upgrade.cost || { type: 'none' };
    if (c.type === 'none') return true;
    if (!this._hasUpgradeCost(upgrade)) return false;
    const inv = this.player.inventory;
    let need = c.count || 0;
    const matches = (k) => {
      if (c.type === 'anyIngredient') {
        const item = getItemData(k);
        return item && item.tier && !isCookedFood(k);
      }
      if (c.type === 'anyCooked') return isCookedFood(k);
      return false;
    };
    // Spend lowest-tier items first so the player keeps rare resources.
    const keys = Object.keys(inv).filter(matches).sort((a, b) => {
      const ta = (getItemData(a) || {}).tier || 0;
      const tb = (getItemData(b) || {}).tier || 0;
      return ta - tb;
    });
    for (const k of keys) {
      if (need <= 0) break;
      const take = Math.min(inv[k], need);
      inv[k] -= take;
      need   -= take;
      if (inv[k] <= 0) delete inv[k];
    }
    if (window.updateInventoryUI) window.updateInventoryUI(inv);
    if (window.updateCookUI)      window.updateCookUI(inv);
    return need <= 0;
  }

  // Talk / Tend choice. "Talk" falls through to the daily-warmth bubble; "Tend"
  // attempts to commit the next Remembering.
  _showTendChoice(upgrade) {
    const cf = this.campfire;
    const haveCost = this._hasUpgradeCost(upgrade);
    const costLine = upgrade.requirementText || 'A small offering.';
    const buttons = [
      { label: 'Talk',          variant: 'secondary', value: 'talk' },
      { label: haveCost ? 'Tend' : 'Tend (need more)', variant: 'primary', value: 'tend' },
    ];
    window.StoryPanel?.show({
      kind: 'tend',
      icon: upgrade.icon || '🔥',
      title: `${upgrade.name} — Tend the Fire`,
      lines: [
        'A glow pulses on the stone ring. Something here wants attention.',
      ],
      requirement: costLine,
      buttons,
    }).then((choice) => {
      if (choice === 'tend') {
        if (!haveCost) {
          window.StoryPanel?.show({
            kind: 'bubble', icon: '🔥',
            lines: [`"Bring back what you have when you can. ${costLine}"`],
            dismissDelay: 4200,
          });
          return;
        }
        this._commitUpgrade(upgrade);
      } else {
        // Talk path — show daily warmth bubble like a normal tap.
        const line = cf?.pickLine?.(this);
        if (line) {
          window.StoryPanel?.show({
            kind: 'bubble', icon: '🔥', lines: [line.text], dismissDelay: 4500,
          });
        }
      }
    });
  }

  // Commit a campfire upgrade: spend cost, mark visual flag, play Remembering
  // panel, fire shard trigger. Idempotent — repeats harmlessly drop.
  _commitUpgrade(upgrade) {
    const idx = upgrade.idx;
    const upgrades = this.story?.campfire?.upgrades;
    if (!upgrades || upgrades[idx]) return;
    if (!this._spendUpgradeCost(upgrade)) return;

    upgrades[idx] = true;
    // Crown Flame additionally locks the fire's appearance permanently.
    if (idx === 5 && this.campfire) this.campfire.level = Math.max(this.campfire.level, this.player.stats.level);
    // Achievement: camp_01 … camp_06 (key uses GDD upgrade id without "CAMP_" prefix).
    const ckey = upgrade.id.toLowerCase();   // 'camp_01'
    this.ach?.set?.(ckey, 1);
    this.saveGame?.();

    // SFX: Crown Flame gets the big chord; everything else gets the warm swell.
    if (idx === 5) window.StoryAudio?.playCrownFlame?.(1.0);
    else           window.StoryAudio?.playCampfireUpgrade?.(0.9);

    // VFX: short ember burst centered on the campfire.
    this._campfireEmberBurst(idx === 5 ? 40 : 22);

    // Crown Flame: brief gold fullscreen flash via body class.
    if (idx === 5) {
      document.body.classList.add('crown-flash');
      setTimeout(() => document.body.classList.remove('crown-flash'), 1800);
    }

    // Remembering panel — Hearth memory tied to this upgrade.
    window.StoryPanel?.show({
      kind:  'remembering',
      icon:  upgrade.icon,
      kicker: `Remembering ${idx + 1} of 6`,
      title:  upgrade.rememberingTitle,
      lines:  upgrade.rememberingLines,
      typewriter: 22,
      lockUntil:  3000,
    }).then(() => {
      // Fire the associated Memory Shard (Shards 01–05 are wired to upgrades).
      this.shardSystem?.onCampfireUpgrade?.(upgrade.id);
    });
  }

  // Glass-morphism name prompt that fires once after Shard 10 is collected.
  // The player can type a name (max 30 chars) or leave blank — both paths handled.
  // The chosen name (or "" if skipped) lands in legacyStory.campfireName, used in
  // the Go-Home credits sequence.
  _showCampfireNameInput() {
    if (!window.StoryPanel) return;
    const flags = this.story?.flags;
    const initial = this.legacyStory?.campfireName || '';
    window.StoryPanel.show({
      kind: 'nameInput',
      icon: '🔥',
      title: 'I know your name.',
      lines: [
        'I’ve always known your name.',
        'Want me to say it?',
      ],
      placeholder: 'Your name.',
      initialValue: initial,
      onSubmit: (typed) => {
        const name = (typed || '').trim();
        if (this.legacyStory) {
          this.legacyStory.campfireName = name;
          this._commitLegacyStory?.();
        }
        if (flags) flags.nameInputArmed = false;
        if (this.campfire) this.campfire.pulseForName = false;
        window.StoryAudio?.playNameInputConfirm?.(0.9);
        // Achievement: The Name (set whether they typed something or chose to skip — both reach the moment).
        this.ach?.set?.('name_set', 1);
        this.saveGame?.();
        // The campfire's reply line follows immediately — gentle, intimate.
        const reply = name
          ? `"${name}. Yeah. That’s you. That’s always been you."`
          : '"Whenever you’re ready. I’ll be here."';
        setTimeout(() => {
          window.StoryPanel?.show({
            kind: 'bubble',
            icon: '🔥',
            lines: [reply],
            dismissDelay: 5000,
          });
        }, 350);
      },
    });
  }

  // Walk the player toward an interactive entity, then open a UI modal once close.
  // stopOffset: how far from the entity center the player should stop.
  // threshold : proximity at which the modal fires (defaults to stopOffset + 0.25).
  _queueModalWalk(entity, menuId, stopOffset = 1.0, threshold = null) {
    if (!entity) return;
    const thr = threshold ?? (stopOffset + 0.25);
    const angle = Math.atan2(this.player.y - entity.y, this.player.x - entity.x);
    this.player.targetX = entity.x + Math.cos(angle) * stopOffset;
    this.player.targetY = entity.y + Math.sin(angle) * stopOffset;
    this.player.targetEntity     = null;
    this.player.pickupItemTarget = null;
    this.player.petTarget        = null;
    this.player.isAuto = false;
    clearTimeout(this.player.autoTimer);
    this.player.autoTimer = setTimeout(() => { this.player.isAuto = true; }, 4000);
    this._pendingModal = { entity, menuId, stopOffset, threshold: thr };
  }

  spawnItem(x, y, name) {
    let dropX = x + (Math.random() - 0.5);
    let dropY = y + (Math.random() - 0.5);
    const lightR = getLevelLightRadius(this.player.stats.level);
    // Clamp to walkable area (light circle, not in structure zones)
    const clamped = this._clampToWalkable(dropX, dropY, lightR);
    this.items.push(new ItemDrop(clamped.x, clamped.y, name));
    // Hard cap to prevent runaway lag — evict oldest items beyond MAX_ITEMS.
    // Skip items the player just dropped (cooldown >0) so they keep their grace period.
    if (this.items.length > Game.MAX_ITEMS) {
      let removed = 0;
      const target = this.items.length - Game.MAX_ITEMS;
      for (let i = 0; i < this.items.length && removed < target; i++) {
        if ((this.items[i]._pickupCooldown || 0) <= 0) {
          // Clear references so anything pointing at it gives up cleanly
          if (this.player.pickupItemTarget === this.items[i]) this.player.pickupItemTarget = null;
          this.items.splice(i, 1);
          i--; removed++;
        }
      }
    }
  }

  // ── Sell item to merchant ─────────────────────────────────
  sellItem(itemName, qty = 1) {
    const inv = this.player.inventory;
    if (!inv[itemName] || inv[itemName] < qty) return false;
    const sellVal = SELL_VALUES[itemName] || 1;
    let total = sellVal * qty;
    // Pudding Bear: cooked food sells for +N% gold (compounded by copies via perkBonuses.goldBonus)
    if (isCookedFood(itemName) && this.perkBonuses.goldBonus && this.perkBonuses.goldBonus > 1) {
      total = Math.round(total * this.perkBonuses.goldBonus);
    }
    // Sweet Honey Rice food buff: extra gold mult while active
    const foodGoldMul = this._foodBuffActive?.foodGoldMul;
    if (foodGoldMul && foodGoldMul > 1) total = Math.round(total * foodGoldMul);
    inv[itemName] -= qty;
    if (inv[itemName] <= 0) delete inv[itemName];
    this._addGold(total);
    this.ach.inc('items_sold');
    this.ach.set('gold_in', this.totalGoldEarned);
    this.player.showEmote('💰', 1.5);
    this.saveGame();
    if (window.updateInventoryUI) window.updateInventoryUI(inv);
    if (window.updateMerchantUI) window.updateMerchantUI();
    return total;
  }

  gameOver() {
    // Void Kitten: revive once per run with a fixed HP value (perkBonuses.reviveOnDeath > 0).
    // Consumes the perk for the rest of this run.
    if (!this._voidKittenUsed && this.perkBonuses.reviveOnDeath > 0) {
      this._voidKittenUsed = true;
      const hp = Math.max(1, Math.floor(this.perkBonuses.reviveOnDeath));
      this.player.stats.hp = Math.min(this.getMaxHp(), hp);
      this.player.isDead = false;
      this.player.showEmote('🐱', 3.0);
      this._showToast('Void Kitten', 'Revived with ' + hp + ' HP', '🐱', 'REVIVED');
      return;
    }
    this._saveLegacy();
    localStorage.removeItem(Game._getSaveKey());
    const modal = document.getElementById('modal-death');
    if (modal) {
      const legacy   = JSON.parse(localStorage.getItem(Game._getLegacyKey()) || '{}');
      const days     = this.time.dayCount;
      const ach      = this.ach.unlockedCount;
      const gold     = this.gold;
      const bestDays = legacy.bestDays || days;
      const runCount = legacy.runCount || 1;
      // Story rename: "She Closed Her Eyes Again" + warm violet hue.
      const titleEl = document.getElementById('death-title');
      if (titleEl) {
        titleEl.textContent = 'She Closed Her Eyes Again.';
        titleEl.style.color = '#c4b5fd';
      }
      const preludeEl = document.getElementById('death-story-prelude');
      if (preludeEl) {
        preludeEl.style.display = '';
        preludeEl.innerHTML =
          'The dark came in. <strong>She let it.</strong><br>' +
          'That\'s allowed. Rest is not the same as giving up.<br>' +
          'The campfire waited. It was not afraid. It knew she would open her eyes.<br>' +
          '<em>She always opens her eyes.</em>';
      }
      document.getElementById('run-summary-stats').innerHTML = `
        <div class="run-stat-row"><span>📅 Days Survived</span><strong>${days}</strong></div>
        <div class="run-stat-row"><span>🏆 Best Run</span><strong>${bestDays} day${bestDays !== 1 ? 's' : ''}</strong></div>
        <div class="run-stat-row"><span>⭐ Feats Unlocked</span><strong>${ach} / ${ALL_ACHIEVEMENTS.length}</strong></div>
        <div class="run-stat-row"><span>💰 Gold Earned This Run</span><strong>${gold}g</strong></div>
        <div class="run-stat-row"><span>🔄 Run #</span><strong>${runCount}</strong></div>`;
      document.getElementById('run-legacy-perks').innerHTML = this._getLegacyPerksHTML(legacy);
      // Accumulation line — one line per run, indexed by linesShown (capped at 10+).
      const accEl = document.getElementById('death-accumulation-line');
      if (accEl) accEl.innerHTML = this._getAccumulationLineHTML(legacy);
      modal.style.display = 'flex';

      if (window._deathTimerId) clearInterval(window._deathTimerId);
      let _deathCountdown = 60;
      const _btnReincarnate = document.getElementById('btn-reincarnate');
      const _countdownEl    = document.getElementById('death-countdown');
      const _updateTimer = () => {
        if (_btnReincarnate) _btnReincarnate.textContent = `🌟 Open Your Eyes Again (${_deathCountdown}s)`;
        if (_countdownEl)    _countdownEl.textContent    = `Returning to main menu in ${_deathCountdown}s...`;
      };
      _updateTimer();
      window._deathTimerId = setInterval(() => {
        _deathCountdown--;
        _updateTimer();
        if (_deathCountdown <= 0) {
          clearInterval(window._deathTimerId);
          window._deathTimerId = null;
          modal.style.display = 'none';
          window._showStartMenu();
        }
      }, 1000);
    }
  }

  // GDD §"Reincarnation Accumulation Lines" — one new line per run, building a
  // paragraph by run 10. Indexed by legacy.story.reincarnation.linesShown.
  _getAccumulationLineHTML(legacy) {
    const lines = [
      'She was tired.',
      'She was always tired.',
      'She closed her eyes on a Tuesday.',
      'The campfire was already there.',
      'She didn\'t light it. The Hearth did. Long ago.',
      'The little sparks were lost in the dark.',
      'She went looking.',
      'She found them.',
      'She remembered their names.',
      'She remembered her own.',
    ];
    const idx = Math.max(0, Math.min(9, (legacy?.story?.reincarnation?.linesShown || 0) - 1));
    return lines[idx];
  }

  _saveLegacy() {
    const prev = JSON.parse(localStorage.getItem(Game._getLegacyKey()) || '{}');
    // Bump narrative run counter and advance the accumulation-line index (capped at 10+ per GDD).
    if (this.legacyStory) {
      this.legacyStory.reincarnation.count    = (this.legacyStory.reincarnation.count    || 0) + 1;
      this.legacyStory.reincarnation.linesShown = Math.min(this.legacyStory.reincarnation.linesShown + 1, 10);
    }
    const legacy = {
      // Gold is NOT banked across runs — each reincarnation starts at 0g
      // and only earns the bonuses listed in _applyLegacyPerks.
      gold:        0,
      ach:         this.ach.toJSON(),
      bestDays:    Math.max(prev.bestDays    || 0, this.time.dayCount),
      runCount:    (prev.runCount  || 0) + 1,
      totalComps:  Math.max(prev.totalComps  || 0, this.collectedCompanionIds.size),
      totalNights: (prev.totalNights || 0) + Math.max(0, this.time.dayCount - 1),
      // Memory Shard rare-item carryover (consumed on next _applyLegacyPerks call)
      bonusSlots:  (this._legacyCarrySlots || 0),
      // Narrative meta-progress (shards, name, finale state). Per-run story (children, campfire upgrades) is NOT promoted.
      story:       this.legacyStory,
    };
    localStorage.setItem(Game._getLegacyKey(), JSON.stringify(legacy));
  }

  _loadLegacy() {
    try {
      const raw = localStorage.getItem(Game._getLegacyKey());
      if (!raw) {
        // No legacy yet — keep defaulted legacyStory.
        return;
      }
      const legacy = JSON.parse(raw);
      // Gold is NOT carried over from prior runs (resetRunState already cleared
      // it to 0). _applyLegacyPerks below adds the per-perk start-bonus gold.
      if (legacy.ach) this.ach.fromJSON(legacy.ach);
      this._hydrateLegacyStory(legacy.story);
      this._applyLegacyPerks(legacy);
      // Memory Shard slots consumed — clear so they don't re-fire each load
      if (legacy.bonusSlots && legacy.bonusSlots > 0) {
        legacy.bonusSlots = 0;
        localStorage.setItem(Game._getLegacyKey(), JSON.stringify(legacy));
      }
      // Reset the carryover counter for this run
      this._legacyCarrySlots = 0;
    } catch (e) { /* ignore */ }
  }

  // ── Story state helpers (save schema v4) ─────────────────────────────
  _defaultRunStory() {
    return {
      children: {
        // Index 0 = Child 1 (eldest), index 5 = Child 6 (youngest).
        found:     [false, false, false, false, false, false],
        tasksDone: [0, 0, 0, 0, 0, 0],
        bond:      [false, false, false, false, false, false],
      },
      campfire: {
        upgrades:     [false, false, false, false, false, false], // CAMP_01 … CAMP_06
        tapCount:     0,
        pendingShard: null,
      },
      flags: {
        discoveryShownThisRun: [false, false, false, false, false, false],
        finaleQueued: false,
        nameInputArmed: false,
      },
    };
  }

  _defaultLegacyStory() {
    return {
      shards:           [false, false, false, false, false, false, false, false, false, false],
      shardCollectDate: [null,  null,  null,  null,  null,  null,  null,  null,  null,  null ],
      campfireName:     "",
      reincarnation:    { count: 0, linesShown: 0 },
      junkLifetime:     0,
      finaleTriggered:  false,
      ending:           "none",
    };
  }

  _serializeRunStory() {
    // Defensive deep-clone — story is a plain JSON-friendly tree.
    return JSON.parse(JSON.stringify(this.story || this._defaultRunStory()));
  }

  _hydrateRunStory(saved) {
    const def = this._defaultRunStory();
    if (!saved || typeof saved !== 'object') { this.story = def; return; }
    // Shallow merge each section so stale saves get new fields without losing existing ones.
    this.story = {
      children: {
        found:     Array.isArray(saved.children?.found)     && saved.children.found.length     === 6 ? saved.children.found.slice()     : def.children.found,
        tasksDone: Array.isArray(saved.children?.tasksDone) && saved.children.tasksDone.length === 6 ? saved.children.tasksDone.slice() : def.children.tasksDone,
        bond:      Array.isArray(saved.children?.bond)      && saved.children.bond.length      === 6 ? saved.children.bond.slice()      : def.children.bond,
      },
      campfire: {
        upgrades:     Array.isArray(saved.campfire?.upgrades) && saved.campfire.upgrades.length === 6 ? saved.campfire.upgrades.slice() : def.campfire.upgrades,
        tapCount:     Number.isFinite(saved.campfire?.tapCount) ? saved.campfire.tapCount : 0,
        pendingShard: saved.campfire?.pendingShard ?? null,
      },
      flags: {
        discoveryShownThisRun: Array.isArray(saved.flags?.discoveryShownThisRun) && saved.flags.discoveryShownThisRun.length === 6 ? saved.flags.discoveryShownThisRun.slice() : def.flags.discoveryShownThisRun,
        finaleQueued:          !!saved.flags?.finaleQueued,
        nameInputArmed:        !!saved.flags?.nameInputArmed,
      },
    };
  }

  _hydrateLegacyStory(saved) {
    const def = this._defaultLegacyStory();
    if (!saved || typeof saved !== 'object') { this.legacyStory = def; return; }
    this.legacyStory = {
      shards:           Array.isArray(saved.shards)           && saved.shards.length           === 10 ? saved.shards.slice()           : def.shards,
      shardCollectDate: Array.isArray(saved.shardCollectDate) && saved.shardCollectDate.length === 10 ? saved.shardCollectDate.slice() : def.shardCollectDate,
      campfireName:     typeof saved.campfireName === 'string' ? saved.campfireName : "",
      reincarnation:    {
        count:      Number.isFinite(saved.reincarnation?.count)      ? saved.reincarnation.count      : 0,
        linesShown: Number.isFinite(saved.reincarnation?.linesShown) ? saved.reincarnation.linesShown : 0,
      },
      junkLifetime:    Number.isFinite(saved.junkLifetime) ? saved.junkLifetime : 0,
      finaleTriggered: !!saved.finaleTriggered,
      ending:          (saved.ending === 'light' || saved.ending === 'home') ? saved.ending : 'none',
    };
  }

  // Persist legacyStory immediately (used by shard unlocks, name input, finale flags
  // — anywhere we want narrative meta-progress to survive a crash mid-run rather than
  // waiting for the next death).
  _commitLegacyStory() {
    try {
      const raw    = localStorage.getItem(Game._getLegacyKey());
      const legacy = raw ? JSON.parse(raw) : {};
      legacy.story = this.legacyStory;
      localStorage.setItem(Game._getLegacyKey(), JSON.stringify(legacy));
    } catch (e) { /* ignore */ }
  }

  _applyLegacyPerks(legacy) {
    const bestDays   = legacy.bestDays   || 0;
    const totalComps = legacy.totalComps || 0;
    const runCount   = legacy.runCount   || 0;
    this._activeLegacyPerks = [];
    // Perk 1 — Survive 5 days: +30g start bonus
    if (bestDays >= 5)   { this.gold += 30; this._activeLegacyPerks.push({ icon:'🌙', name:'Night Survivor', desc:'+30g start bonus' }); }
    // Perk 2 — Survive 10 days: start with 3× Cooked Bread
    if (bestDays >= 10)  { this.player.inventory['Cooked Bread'] = (this.player.inventory['Cooked Bread'] || 0) + 3; this._activeLegacyPerks.push({ icon:'🍖', name:'Well-Fed Memory', desc:'Started with 3× Cooked Bread' }); }
    // Perk 3 — Collect 5 companion types: companion drop speed +15% (stored separately, merged in recalculatePerks)
    if (totalComps >= 5) { this._legacyDropSpeed = 1.15; this._activeLegacyPerks.push({ icon:'🐾', name:'Companion Bond', desc:'Drop speed +15%' }); }
    // Perk 4 — Survive 20 days: +50g and nightmares 15% slower
    if (bestDays >= 20)  { this.gold += 50; this._legacyNmSlow = 1.15; this._activeLegacyPerks.push({ icon:'⭐', name:'Dream Veteran', desc:'+50g · Nightmares 15% slower' }); }
    // Perk 5 — 3+ runs: +10 max HP
    if (runCount >= 3)   { this.player.stats.maxHp += 10; this.player.stats.hp = Math.min(this.player.stats.hp + 10, this.player.stats.maxHp); this._activeLegacyPerks.push({ icon:'💪', name:'Seasoned Soul', desc:'+10 max HP' }); }
    // Bonus perk slots from prior-run Memory Shard purchases
    if (legacy.bonusSlots && legacy.bonusSlots > 0) {
      for (let i = 0; i < legacy.bonusSlots; i++) {
        // Each shard slot grants +5g + 1 random T1 ingredient as a small bonus
        this.gold += 5;
        const ings = ['Mushroom','Rice','Egg','Fresh Dew','Clover Leaf'];
        const pick = ings[Math.floor(Math.random()*ings.length)];
        this.player.inventory[pick] = (this.player.inventory[pick] || 0) + 1;
        this._activeLegacyPerks.push({ icon:'💠', name:'Memory Shard', desc:`+5g · +1 ${pick}` });
      }
    }
    // Show toast if any perks are active
    if (this._activeLegacyPerks.length > 0) {
      const count = this._activeLegacyPerks.length;
      setTimeout(() => {
        this._achNotif = { icon: '✨', label: 'LEGACY', name: `${count} Legacy Perk${count > 1 ? 's' : ''} Active!`, sub: 'Check ✨ Perks to view', timer: 4.5, maxTimer: 4.5 };
      }, 1200);
    }
  }

  _getLegacyPerksHTML(legacy) {
    const bestDays   = legacy.bestDays   || 0;
    const totalComps = legacy.totalComps || 0;
    const runCount   = legacy.runCount   || 0;
    // Each perk's mechanical effect is unchanged; only the display gets a story
    // subtitle (cosmetic-only rename per the Phase 5 GDD).
    const perks = [
      { req: bestDays >= 5,   icon:'🌙', name:'Night Survivor',  desc:'+30g start bonus',
        sub: 'She remembered how to begin again.' },
      { req: bestDays >= 10,  icon:'🍖', name:'Well-Fed Memory', desc:'Start with 3× Cooked Bread',
        sub: 'She remembered how to nourish.' },
      { req: totalComps >= 5, icon:'🐾', name:'Companion Bond',  desc:'Drop speed +15%',
        sub: 'The love she still had — it took shapes she could recognise.' },
      { req: bestDays >= 20,  icon:'⭐', name:'Dream Veteran',   desc:'+50g · Nightmares 15% slower',
        sub: 'Some things are too important to lose.' },
      { req: runCount >= 3,   icon:'💪', name:'Seasoned Soul',   desc:'+10 max HP per run',
        sub: 'Years of carrying made her stronger than she knew.' },
    ];
    const active = perks.filter(p => p.req);
    if (!active.length) return '<div class="run-legacy-empty">Survive longer to find what stays.</div>';
    return `<div class="run-legacy-title">✨ What She Carried Back</div>` +
      active.map(p => `
        <div class="run-legacy-perk">
          <span>${p.icon} <strong>${p.name}</strong>
            <span class="run-legacy-perk-sub">${p.sub}</span>
          </span>
          <span class="run-legacy-desc">${p.desc}</span>
        </div>`).join('');
  }

  // ── Nightmare special helpers ──────────────────────────
  _spawnPupFrom(rx, ry, angle) {
    const pupData = GAME_DATA.nightmares.find(n => n.id === 'pup');
    if (!pupData) return;
    const pup = new Nightmare(
      rx + Math.cos(angle) * 0.5,
      ry + Math.sin(angle) * 0.5,
      pupData
    );
    pup.id = 'pup';
    this.nightmares.push(pup);
  }

  _titanShockwave(tx, ty) {
    // Damages player and companions within 2.5 tiles
    const radius = 2.5;
    if (Math.hypot(this.player.x - tx, this.player.y - ty) < radius) {
      this.player.stats.hp   = Math.max(1, this.player.stats.hp - 8);
      this.player.stats.happy = Math.max(0, this.player.stats.happy - 10);
      this.player.showEmote('💥', 1.5);
    }
    for (const c of this.companions) {
      if (Math.hypot(c.x - tx, c.y - ty) < radius) {
        c.showEmote('💥', 1.5);
        // Companions recover, so just visual
      }
    }
  }

  _grantAchXP(xp) {
    // Curious trait: +5% XP from feats (achievements specifically)
    if (this.player?.personality === 'Curious') xp = Math.ceil(xp * 1.05);
    this.player.stats.xp += xp;
    this.checkLevelUp();
  }

  // ── Generic XP grant (gameplay actions) ───────────────────────
  _grantXP(xp) {
    this.player.stats.xp += xp;
    this.checkLevelUp();
  }

  // ── Passive prop perks (built props with time-based effects) ──
  // Stone Well → Fresh Dew every 3min, Herb Garden → Dream Herb every 10min,
  // Dream Chime → −5% happiness decay (folded via this._propDecayBonus),
  // Mood Lantern → additional −10% happiness decay,
  // Companion Pasture → +30s shave on companion drop (via dropSpeed boost),
  // Companion Den → −30s on KO respawn (via companion respawn helper).
  _tickPropPassives(dt) {
    if (!this.builtProps) return;
    if (this.builtProps.stone_well) {
      this._stoneWellTimer = (this._stoneWellTimer || 180) - dt;
      if (this._stoneWellTimer <= 0) {
        this._stoneWellTimer = 180; // 3 minutes
        this.player.inventory['Fresh Dew'] = (this.player.inventory['Fresh Dew'] || 0) + 1;
        this.player.showEmote('💧', 1.2);
      }
    }
    if (this.builtProps.herb_garden) {
      this._herbGardenTimer = (this._herbGardenTimer || 600) - dt;
      if (this._herbGardenTimer <= 0) {
        this._herbGardenTimer = 600; // 10 minutes
        this.player.inventory['Dream Herb'] = (this.player.inventory['Dream Herb'] || 0) + 1;
        this.player.showEmote('🌿', 1.2);
      }
    }
    // Compute the static decay bonus once (cheap; called once per tick anyway).
    let decayMul = 1;
    if (this.builtProps.mood_lantern) decayMul *= 0.9;  // −10%
    if (this.builtProps.dream_chime)  decayMul *= 0.95; // −5%
    this._propDecayBonus = decayMul;
    // Companion Pasture: bake a small dropSpeed boost back into perkBonuses if not already present
    if (this.builtProps.companion_pasture) {
      // 30s shave on a 150s base ≈ 1.25× speed
      this._propDropSpeedBonus = 1.25;
    } else {
      this._propDropSpeedBonus = 1;
    }
  }

  // ── Trait-modified happiness gain helper ──
  // isSocial: pet/cheer interactions count as social (Shy halves these).
  // All gains (social or passive) are halved by Stoic.
  _modHappyGain(amount, isSocial = false) {
    const trait = this.player?.personality;
    if (trait === 'Stoic') amount *= 0.5;
    if (trait === 'Shy' && isSocial) amount *= 0.5;
    return amount;
  }

  // ── Per-frame trait effects (Empathetic, Shy, Gluttonous auto-eat) ──
  _applyTraitEffects(dt) {
    if (!this.player || this.player.isDead) return;
    const trait = this.player.personality;
    if (!trait || trait === 'Curious' || trait === 'Brave' || trait === 'Stoic') return;

    this._traitTickAcc = (this._traitTickAcc || 0) + dt;
    if (this._traitTickAcc < 1) return; // tick once per second
    const ticks = Math.floor(this._traitTickAcc);
    this._traitTickAcc -= ticks;

    // Empathetic: any deployed Compy at >= 80% mood gives a +0.4/s happy tick
    if (trait === 'Empathetic') {
      const happyComp = this.companions.some(c => (c.mood ?? c.happy ?? 100) >= 80);
      if (happyComp) {
        this.player.stats.happy = Math.min(100, this.player.stats.happy + 0.4 * ticks);
      }
    }

    // Shy: if no Compy within 2 tiles, +0.5/s happy tick (recovers alone)
    if (trait === 'Shy') {
      const px = this.player.x, py = this.player.y;
      const isolated = !this.companions.some(c => Math.hypot(c.x - px, c.y - py) < 2);
      if (isolated) {
        this.player.stats.happy = Math.min(100, this.player.stats.happy + 0.5 * ticks);
      }
    }

    // Gluttonous: auto-eat at 70% hunger (pick lowest-quality cooked food)
    if (trait === 'Gluttonous' && this.player.stats.hunger < 70 && !this.player.isEating && !this.player.isPetting) {
      const inv = this.player.inventory;
      const foods = Object.keys(inv).filter(n => isCookedFood(n) && inv[n] > 0);
      if (foods.length) {
        foods.sort((a, b) => (getRecipeByFoodName(a)?.quality || 1) - (getRecipeByFoodName(b)?.quality || 1));
        this.startEatingFood(foods[0]);
      }
    }
  }

  _showAchToast(ach) {
    this._achNotif = { icon: ach.icon, label: 'ACHIEVEMENT UNLOCKED', name: ach.name, desc: ach.desc, sub: `+${ach.xp} XP`, timer: 4.6, maxTimer: 4.6 };
    this._playAchievementSFX();
  }

  _playAchievementSFX() {
    try {
      const ac = new AudioContext();
      // Pentatonic chime: A5 C#6 E6 A6 E7
      const notes = [880, 1108.73, 1318.51, 1760, 2637.02];
      notes.forEach((freq, i) => {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, ac.currentTime + i * 0.10);
        gain.gain.linearRampToValueAtTime(0.18 - i * 0.025, ac.currentTime + i * 0.10 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + i * 0.10 + 1.2);
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start(ac.currentTime + i * 0.10);
        osc.stop(ac.currentTime + i * 0.10 + 1.3);
      });
      // Sparkle layer: triangle overtone
      const osc2 = ac.createOscillator();
      const g2 = ac.createGain();
      osc2.type = 'triangle';
      osc2.frequency.value = 3520;
      g2.gain.setValueAtTime(0, ac.currentTime);
      g2.gain.linearRampToValueAtTime(0.06, ac.currentTime + 0.04);
      g2.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.7);
      osc2.connect(g2); g2.connect(ac.destination);
      osc2.start(ac.currentTime); osc2.stop(ac.currentTime + 0.75);
      setTimeout(() => ac.close(), 2500);
    } catch (_) {}
  }

  checkLevelUp() {
    const xpNeeded = this.player.stats.level * 225;
    if (this.player.stats.xp >= xpNeeded && this.player.stats.level < GAME_DATA.player.maxLevel) {
      this.player.stats.xp -= xpNeeded;
      this.player.stats.level++;
      this.player.showEmote('🌟', 3.5);
      this.player.stats.maxHp += 5;
      this.player.stats.hp = Math.min(this.player.stats.hp + 5, this.getMaxHp());
      // Campfire level-up burst
      if (this.campfire) this.campfire.triggerBurst(this.player.stats.level);
      // Trigger cinematic
      this._triggerLevelUpAnim(this.player.stats.level);
      // Light-expand achievement
      this.ach.inc('light_exp');
      // Story: spawn child silhouette(s) at darkness edge if their discovery level is reached.
      this.children?.checkLevelUp?.(this.player.stats.level);
      // T3.1 — "Did You See That?" levels-up while Child 3 is present.
      if (this.children?.list?.[2]?.phase === 'PRESENT') {
        const helpers = this.children._taskTickerHelpers;
        helpers?.set?.('T3.1', 'leveled', true);
      }
      // Memory Shards: Shard 08 (Lv 35) and Shard 10 fallback (Lv 50).
      this.shardSystem?.onLevelReveal(this.player.stats.level);
      this.checkLevelUp();
    }
  }

  _triggerLevelUpAnim(newLevel) {
    const la = this._levelUpAnim;
    la.active = true;
    la.timer = 0;
    la.newLevel = newLevel;
    la.ringRadius = 0;
    la.maxRingRadius = getLevelLightRadius(newLevel) * this.world.tileSize;
    la.startZoom = this.camera.zoom;
    la.startCamX = this.camera.x;
    la.startCamY = this.camera.y;
    this._playLevelUpSFX();
    // Close any open modals during cutscene
    document.querySelectorAll('.modal-overlay').forEach(m => { m.style.display = 'none'; _detachHudFit(m); });
  }

  // ── Dusk Bell ──────────────────────────────────────────────
  _playDuskBellSFX() {
    try {
      const ac = new AudioContext();
      [[523.25, 0], [659.25, 0.18], [523.25, 0.42]].forEach(([freq, delay]) => {
        const osc = ac.createOscillator(), g = ac.createGain();
        osc.type = 'sine'; osc.frequency.value = freq;
        g.gain.setValueAtTime(0, ac.currentTime + delay);
        g.gain.linearRampToValueAtTime(0.07, ac.currentTime + delay + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + delay + 1.4);
        osc.connect(g); g.connect(ac.destination);
        osc.start(ac.currentTime + delay); osc.stop(ac.currentTime + delay + 1.5);
      });
      setTimeout(() => ac.close(), 3500);
    } catch(_) {}
  }

  // ── Nightfall Chime ────────────────────────────────────────
  // A soft, mysterious arpeggio in A minor that plays when day → night.
  // Two stacked timbres (sine + triangle) with mild detuning give it a
  // glassy wind-chime quality; a long lowpass-filtered pad underneath
  // makes it feel like the world is exhaling into night.
  _playNightfallChime() {
    try {
      const ac = new AudioContext();
      const t0 = ac.currentTime;

      // Master bus through a gentle lowpass for that "muffled, distant" feel.
      const master = ac.createGain();
      master.gain.value = 1.0;
      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 3200; lp.Q.value = 0.6;
      master.connect(lp); lp.connect(ac.destination);

      // Arpeggio: A4 → E5 → C5 → G5 → E5 (Am7 voicing, descending mystery)
      const notes = [
        { f: 440.00, t: 0.00, dur: 2.4, vol: 0.06 },
        { f: 659.25, t: 0.28, dur: 2.2, vol: 0.05 },
        { f: 523.25, t: 0.58, dur: 2.0, vol: 0.05 },
        { f: 783.99, t: 0.92, dur: 1.9, vol: 0.045 },
        { f: 659.25, t: 1.30, dur: 1.8, vol: 0.04 },
      ];
      for (const n of notes) {
        // Two slightly-detuned voices per note → shimmer.
        for (const cents of [-4, +4]) {
          const osc = ac.createOscillator();
          const g   = ac.createGain();
          osc.type = cents < 0 ? 'sine' : 'triangle';
          osc.frequency.value = n.f;
          osc.detune.value = cents;
          g.gain.setValueAtTime(0, t0 + n.t);
          g.gain.linearRampToValueAtTime(n.vol, t0 + n.t + 0.04);
          g.gain.exponentialRampToValueAtTime(0.001, t0 + n.t + n.dur);
          osc.connect(g); g.connect(master);
          osc.start(t0 + n.t);
          osc.stop (t0 + n.t + n.dur + 0.05);
        }
      }

      // Low pad — A2 + E3 fifth, slow swell + fade. Adds the "dusk hush".
      for (const f of [110.00, 164.81]) {
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.type = 'sine';
        o.frequency.value = f;
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(0.025, t0 + 0.8);
        g.gain.linearRampToValueAtTime(0.020, t0 + 2.4);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 4.0);
        o.connect(g); g.connect(master);
        o.start(t0);
        o.stop (t0 + 4.1);
      }

      setTimeout(() => { try { ac.close(); } catch(_) {} }, 4500);
    } catch(_) {}
  }

  // ── Boss Night Warning ─────────────────────────────────────
  _playBossWarnSFX() {
    try {
      const ac = new AudioContext();
      [[55, 0], [82.4, 0.08], [110, 0.18], [55, 0.5]].forEach(([freq, delay]) => {
        const osc = ac.createOscillator(), g = ac.createGain();
        osc.type = 'sawtooth'; osc.frequency.value = freq;
        g.gain.setValueAtTime(0, ac.currentTime + delay);
        g.gain.linearRampToValueAtTime(0.10, ac.currentTime + delay + 0.3);
        g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + delay + 2.8);
        osc.connect(g); g.connect(ac.destination);
        osc.start(ac.currentTime + delay); osc.stop(ac.currentTime + delay + 3.0);
      });
      setTimeout(() => ac.close(), 5000);
    } catch(_) {}
  }

  // ── Item Pickup Pop ────────────────────────────────────────
  _playPickupSFX() {
    try {
      const ac = new AudioContext();
      const osc = ac.createOscillator(), g = ac.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(900, ac.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1400, ac.currentTime + 0.07);
      g.gain.setValueAtTime(0.045, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.14);
      osc.connect(g); g.connect(ac.destination);
      osc.start(); osc.stop(ac.currentTime + 0.15);
      setTimeout(() => ac.close(), 400);
    } catch(_) {}
  }

  // Soft "ploof" cue when a magneted item meets the player and disappears.
  // Triangle blip + filtered noise burst — short, cute, distinct from the
  // shimmer pickup chime above.
  _playItemPoofSFX() {
    try {
      const ac = new AudioContext();
      const t  = ac.currentTime;
      // Triangle blip (the "pop").
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(720, t);
      o.frequency.exponentialRampToValueAtTime(420, t + 0.10);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.06, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(g); g.connect(ac.destination);
      o.start(t); o.stop(t + 0.18);
      // Tiny noise puff for the "p-fff".
      const buf = ac.createBuffer(1, ac.sampleRate * 0.16, ac.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
      const src = ac.createBufferSource(); src.buffer = buf;
      const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2000; bp.Q.value = 1.2;
      const ng = ac.createGain();
      ng.gain.setValueAtTime(0.05, t);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      src.connect(bp); bp.connect(ng); ng.connect(ac.destination);
      src.start(t); src.stop(t + 0.16);
      setTimeout(() => ac.close(), 400);
    } catch(_) {}
  }

  // Spawn a celebrative confetti + sparkle burst at a world position. Used
  // when a Glimmer's task is confirmed. Larger, longer, and more colourful
  // than _spawnItemPoof — confetti rectangles tumbling outward + sparkle
  // stars + an "🎉" emoji float, with a soft white ring expanding underneath.
  _spawnCelebrationBurst(wx, wy) {
    if (!this._celebrations) this._celebrations = [];
    const COLS = ['#fbcfe8','#bae6fd','#fde68a','#bbf7d0','#e9d5ff','#fed7aa','#f9a8d4','#a5b4fc'];
    const particles = [];
    // Confetti rectangles — flutter outward + downward, with rotation.
    const N = 26;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + Math.random() * 0.4;
      const spd = 60 + Math.random() * 60;
      particles.push({
        kind: 'confetti',
        ox: 0, oy: 0,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd * 0.5 - 80, // strong upward bias so it rains back down
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 12,
        w: 3 + Math.random() * 3,
        h: 5 + Math.random() * 4,
        col: COLS[Math.floor(Math.random() * COLS.length)],
      });
    }
    // Sparkle stars.
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + Math.random() * 0.3;
      const spd = 40 + Math.random() * 30;
      particles.push({
        kind: 'star',
        ox: 0, oy: 0,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd * 0.6 - 30,
        size: 2 + Math.random() * 1.4,
        col: COLS[Math.floor(Math.random() * COLS.length)],
      });
    }
    this._celebrations.push({ wx, wy, t: 0, life: 1.4, particles });
  }

  // Spawn a small "ploof" burst (8 pastel sparkle particles + a soft ring)
  // at the given world position. Drawn each frame via _drawItemPoofs().
  _spawnItemPoof(wx, wy) {
    if (!this._itemPoofs) this._itemPoofs = [];
    const COLS = ['#fbcfe8','#bae6fd','#fde68a','#bbf7d0','#e9d5ff','#fed7aa'];
    const particles = [];
    const N = 8;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + Math.random() * 0.4;
      const spd = 22 + Math.random() * 18;
      particles.push({
        ox: 0, oy: 0,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd * 0.6 - 12,    // slight upward bias
        size: 1.6 + Math.random() * 1.4,
        col: COLS[Math.floor(Math.random() * COLS.length)],
      });
    }
    this._itemPoofs.push({ wx, wy, t: 0, life: 0.55, particles });
  }

  // ── Ambient Day (soft chirps) ──────────────────────────────
  _startAmbientDay() {
    this._stopAmbient();
    this._ambientPhase = 'day';
    this._scheduleAmbientDay();
  }
  _scheduleAmbientDay() {
    if (this._ambientPhase !== 'day') return;
    try {
      const ac = new AudioContext();
      const root = [880, 1046, 1318, 1568][Math.floor(Math.random() * 4)];
      [root, root * 1.5].forEach((freq, i) => {
        const osc = ac.createOscillator(), g = ac.createGain();
        osc.type = 'sine'; osc.frequency.value = freq;
        g.gain.setValueAtTime(0, ac.currentTime + i * 0.1);
        g.gain.linearRampToValueAtTime(0.022, ac.currentTime + i * 0.1 + 0.025);
        g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + i * 0.1 + 0.35);
        osc.connect(g); g.connect(ac.destination);
        osc.start(ac.currentTime + i * 0.1); osc.stop(ac.currentTime + i * 0.1 + 0.4);
      });
      setTimeout(() => ac.close(), 1200);
    } catch(_) {}
    this._ambientTimer = setTimeout(() => this._scheduleAmbientDay(), 3500 + Math.random() * 5500);
  }

  // ── Ambient Night (low wind drones) ───────────────────────
  _startAmbientNight() {
    this._stopAmbient();
    this._ambientPhase = 'night';
    this._scheduleAmbientNight();
  }
  _scheduleAmbientNight() {
    if (this._ambientPhase !== 'night') return;
    try {
      const ac = new AudioContext();
      const osc = ac.createOscillator(), g = ac.createGain();
      osc.type = 'sine'; osc.frequency.value = 50 + Math.random() * 30;
      g.gain.setValueAtTime(0, ac.currentTime);
      g.gain.linearRampToValueAtTime(0.038, ac.currentTime + 1.2);
      g.gain.linearRampToValueAtTime(0.038, ac.currentTime + 3.5);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 5.0);
      osc.connect(g); g.connect(ac.destination);
      osc.start(); osc.stop(ac.currentTime + 5.2);
      setTimeout(() => ac.close(), 6000);
    } catch(_) {}
    this._ambientTimer = setTimeout(() => this._scheduleAmbientNight(), 6000 + Math.random() * 9000);
  }

  _stopAmbient() {
    clearTimeout(this._ambientTimer);
    this._ambientTimer = null;
    this._ambientPhase = null;
  }

  _playLevelUpSFX() {
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      // Rising arpeggio + chord
      [[261.6, 0], [329.6, 0.1], [392, 0.2], [523.2, 0.32], [659.3, 0.44]].forEach(([freq, delay]) => {
        const osc = ac.createOscillator();
        const g = ac.createGain();
        osc.connect(g); g.connect(ac.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ac.currentTime + delay);
        g.gain.setValueAtTime(0, ac.currentTime + delay);
        g.gain.linearRampToValueAtTime(0.07, ac.currentTime + delay + 0.04);
        g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + delay + 0.9);
        osc.start(ac.currentTime + delay);
        osc.stop(ac.currentTime + delay + 0.95);
      });
      // Low boom
      const boom = ac.createOscillator();
      const boomG = ac.createGain();
      boom.connect(boomG); boomG.connect(ac.destination);
      boom.type = 'sine';
      boom.frequency.setValueAtTime(80, ac.currentTime);
      boom.frequency.exponentialRampToValueAtTime(40, ac.currentTime + 0.6);
      boomG.gain.setValueAtTime(0.12, ac.currentTime);
      boomG.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.8);
      boom.start(); boom.stop(ac.currentTime + 0.8);
    } catch(e) {}
  }

  // ── Walkable area helpers ──────────────────────────────────────────
  // Returns true if (x, y) is in a blocked structure zone
  _isBlocked(x, y) {
    // Campfire (origin)
    if (Math.hypot(x, y) < 0.9) return true;
    // Cooking station
    if (this.cookingStation && Math.hypot(x - this.cookingStation.x, y - this.cookingStation.y) < 0.9) return true;
    // Merchant camp
    if (this.merchantCamp && Math.hypot(x - this.merchantCamp.x, y - this.merchantCamp.y) < 1.1) return true;
    return false;
  }

  // Returns closest walkable point to (x, y) within lightRadius
  _clampToWalkable(x, y, lightRadius) {
    const safeR = Math.max(0, lightRadius - 1.2);
    // Clamp to light circle
    const d = Math.hypot(x, y);
    if (d > safeR) { x = (x/d)*safeR; y = (y/d)*safeR; }
    // Push out of blocked zones (simple radial push)
    const zones = [
      { cx: 0,   cy: 0,   r: 0.9 },
    ];
    if (this.cookingStation && !this.editMode?.stored?.cookingStation)
      zones.push({ cx: this.cookingStation.x, cy: this.cookingStation.y, r: 0.9 });
    if (this.merchantCamp && !this.editMode?.stored?.merchantCamp)
      zones.push({ cx: this.merchantCamp.x,   cy: this.merchantCamp.y,   r: 1.1 });
    for (const c of (this.editMode?.placedCosmetics || [])) {
      const def = (window.COSMETIC_DEFS || []).find(d => d.id === c.id);
      if (def) zones.push({ cx: c.x, cy: c.y, r: def.r });
    }
    for (const z of zones) {
      const zd = Math.hypot(x - z.cx, y - z.cy);
      if (zd < z.r) {
        const push = z.r - zd + 0.01;
        if (zd < 0.001) { x += z.r; } // degenerate case
        else { x += ((x - z.cx)/zd)*push; y += ((y - z.cy)/zd)*push; }
      }
    }
    return { x, y };
  }

  _spawnHitVFX(x, y, color) {
    this.attackVFXList.push(new AttackVFX(x, y, 'projectile', color || '#fff', 0));
  }

  spawnBullet(x, y, dx, dy, ownerType, color, icon, damage, ownerEntity = null) {
    const speed = ownerType === 'companion' ? 7 : 5.5;
    this.bullets.push(new Bullet(x, y, dx, dy, speed, damage, ownerType, color, icon, ownerEntity));
  }

  // ── Gold helpers ─────────────────────────────────────────
  _addGold(amount) {
    this.gold += amount;
    this.totalGoldEarned += amount;
    this.ach.set('gold_in', this.totalGoldEarned);
  }
  _spendGold(amount) {
    if (this.gold < amount) return false;
    this.gold -= amount;
    this.totalGoldSpent += amount;
    this.ach.set('gold_out', this.totalGoldSpent);
    return true;
  }
  
  getMaxHp() {
    const baseMax = this.player.stats.maxHp;
    const bonus = this.perkBonuses.maxHpBonus || 0;
    return baseMax + bonus;
  }
  
  recalculatePerks() {
    this.perkBonuses = calculateCompanionPerks(this.companions, this.companionInventory);
    // Re-apply legacy drop speed so recalculation doesn't wipe it
    if (this._legacyDropSpeed) this.perkBonuses.dropSpeed = (this.perkBonuses.dropSpeed || 1) * this._legacyDropSpeed;
    // Companion Pasture: shaves 30s off the 150s drop timer ≈ 1.25× drop speed
    if (this._propDropSpeedBonus && this._propDropSpeedBonus > 1) {
      this.perkBonuses.dropSpeed = (this.perkBonuses.dropSpeed || 1) * this._propDropSpeedBonus;
    }
    if (window.updatePerkHUD) window.updatePerkHUD();
  }

  // ── Attack VFX spawn ────────────────────────────────────────────
  spawnAttackVFX(x, y, type, color, angle) {
    this.attackVFXList.push(new AttackVFX(x, y, type, color, angle));
  }

  spawnChainLightningVFX(positions) {
    this.specialVFX.push(new ChainLightningVFX(positions));
  }

  spawnShieldVFX() {
    this.specialVFX.push(new ShieldCastVFX(this.player.x, this.player.y));
  }

  // ── Crafting ──────────────────────────────────────────────
  craftProp(propId) {
    const prop = GAME_DATA.craftProps.find(p => p.id === propId);
    if (!prop || this.builtProps[propId]) return false;
    const inv = this.player.inventory;
    for (const [item, qty] of Object.entries(prop.req)) {
      if ((inv[item] || 0) < qty) return false;
    }
    // Deduct (with companion crafting cost reduction + Bamboo Dumplings food buff)
    let costMult = this.perkBonuses.craftingCostReduction || 1;
    const foodCraftMul = this._foodBuffActive?.foodCraftSpeedMul;
    if (foodCraftMul && foodCraftMul > 1) costMult *= 1 / foodCraftMul; // 1.20× speed → 0.83× cost
    for (const [item, qty] of Object.entries(prop.req)) {
      const actual = Math.ceil(qty * costMult);
      inv[item] = (inv[item] || 0) - actual;
      if (inv[item] <= 0) delete inv[item];
    }
    // Bonus craft chance (lava toad)
    if (this.perkBonuses.craftingBonusChance && Math.random() < this.perkBonuses.craftingBonusChance) {
      // Refund one random material
      const mats = Object.keys(prop.req);
      const bonus = mats[Math.floor(Math.random() * mats.length)];
      inv[bonus] = (inv[bonus] || 0) + 1;
    }
    this.builtProps[propId] = true;
    this.ach.inc('props_built');
    this.ach.inc(`prop_${propId}`);
    this.player.showEmote('🔨', 2.0);
    // Drop a placeable token into the player's cosmetic inventory so they
    // can drag the new prop into the world via Edit Mode. Cooking Station
    // is excluded — it's a fixed structure already on the field.
    if (propId !== 'cooking_station') {
      const placeId = `cp_${propId}`;
      this.cosmeticInventory[placeId] = (this.cosmeticInventory[placeId] || 0) + 1;
      this._showToast(prop.name, 'Crafted! Place it from Edit Mode → Crafted Props.', prop.icon, 'CRAFT');
    }
    // Brew Cauldron: builds the prop AND unlocks 3★ recipes
    if (propId === 'brew_cauldron') {
      this.unlockedCookTiers.add(2);
      this.unlockedCookTiers.add(3);
      this._showToast('Brew Cauldron', '3★ recipes unlocked!', '⚗️', 'PROP');
    }
    this.recalculatePerks();
    this.saveGame();
    if (window.updateInventoryUI) window.updateInventoryUI(this.player.inventory);
    if (window.updateCraftUI)    window.updateCraftUI();
    return true;
  }

  // ── Merchant shop ─────────────────────────────────────────
  buyFromMerchant(item) {
    // item: { name, cost, type: 'item'|'pack' }
    if (!this._spendGold(item.cost)) { this.player.showEmote('❌', 1.0); return false; }
    this.tradeCount++;
    this.ach.set('trades', this.tradeCount);
    if (item.type === 'pack') {
      this.packCount++;
      this.ach.set('packs', this.packCount);
      this._openBoosterPack();
    } else if (item.type === 'item' || item.type === 'consumable') {
      const inv = this.player.inventory;
      inv[item.name] = (inv[item.name] || 0) + (item.qty || 1);
      if (item.rare) {
        this.rareBoughtCount++;
        this.ach.set('rare_bought', this.rareBoughtCount);
      }
      if (window.updateInventoryUI) window.updateInventoryUI(inv);
    }
    this.saveGame();
    return true;
  }

  _openBoosterPack() {
    // Always give 1 confirmed T1 Compy + 50% chance of a second T1 Compy + 3 random resources
    const t1comps = COMPANIONS.filter(c => c.tier === 1);
    const pullCount = 1 + (Math.random() < 0.5 ? 1 : 0); // 1 guaranteed + 50% chance of 2nd
    let dupeFound = false;
    for (let p = 0; p < pullCount; p++) {
      const pulled = t1comps[Math.floor(Math.random() * t1comps.length)];
      this.companionInventory[pulled.id] = (this.companionInventory[pulled.id] || 0) + 1;
      this.collectedCompanionIds.add(pulled.id);
      // Check for duplicates
      if (this.companionInventory[pulled.id] > 1) {
        dupeFound = true;
        if (!this._lastPackDupe) this._lastPackDupe = 0;
        this._lastPackDupe++;
        this.ach.max('pack_dupe_streak', this._lastPackDupe);
      } else { if (!dupeFound) this._lastPackDupe = 0; }
    }
    if (dupeFound) this.ach.inc('pack_dupe');
    // 3 random resource drops near player (T1 companion drops)
    const t1drops = t1comps.map(c => c.drop);
    for (let i = 0; i < 3; i++) {
      const drop = t1drops[Math.floor(Math.random() * t1drops.length)];
      this.spawnItem(this.player.x + (Math.random()-0.5)*2, this.player.y + (Math.random()-0.5)*2, drop);
    }
    this.player.showEmote('🎁', 2.0);
    this.ach.set('comp_unique', Object.keys(this.companionInventory).length);
    if (window.updateTierTableUI) window.updateTierTableUI();
  }
  
  // Convert 3 duplicates of a companion to 1 random next-tier companion
  convertCompanion(companionId) {
    const count = this.companionInventory[companionId] || 0;
    if (count < 3) return false;

    const currentComp = getCompanionById(companionId);
    if (!currentComp || currentComp.tier >= 6) return false;

    // Find companions of the next tier
    const nextTierComps = COMPANIONS.filter(c => c.tier === currentComp.tier + 1);
    if (nextTierComps.length === 0) return false;

    // 10g tier-up cost
    const cost = 10;
    if ((this.gold || 0) < cost) return false;
    this.gold -= cost;

    // Deduct 3 from inventory
    this.companionInventory[companionId] -= 3;
    if (this.companionInventory[companionId] <= 0) {
      delete this.companionInventory[companionId];
    }

    // Remove deployed companions if we used them
    let deployedCount = this.companions.filter(c => (c.type || c.id) === companionId).length;
    while (deployedCount > (this.companionInventory[companionId] || 0)) {
      const idx = this.companions.findIndex(c => (c.type || c.id) === companionId);
      if (idx >= 0) {
        this.companions.splice(idx, 1);
        deployedCount--;
      } else break;
    }
    
    // Grant random next-tier companion
    const newComp = nextTierComps[Math.floor(Math.random() * nextTierComps.length)];
    this.companionInventory[newComp.id] = (this.companionInventory[newComp.id] || 0) + 1;
    this.collectedCompanionIds.add(newComp.id);
    
    // Auto-deploy if we have room
    const maxComps = this.getMaxDeployedCompanions();
    if (this.companions.length < maxComps) {
      const deployed = new Companion(this.player.x + 1, this.player.y, {
        id: newComp.id,
        name: newComp.name,
        color: newComp.color,
        icon: newComp.icon,
        drop: newComp.drop,
        type: newComp.id,
        tier: newComp.tier,
        personality: newComp.personality,
        role: newComp.role,
      });
      this.companions.push(deployed);
      deployed.showEmote('✨', 3.0);
    }
    
    this.player.showEmote('🎉', 2.5);
    this.recalculatePerks();
    this.saveGame();
    
    return newComp;
  }
  
  // Deploy a companion from inventory
  deployCompanion(companionId) {
    const maxComps = this.getMaxDeployedCompanions();
    if (this.companions.length >= maxComps) return false;

    // Only 1 of each type can be active at a time
    if (this.companions.some(c => (c.type || c.id) === companionId)) return false;

    const count = this.companionInventory[companionId] || 0;
    if (count <= 0) return false;
    
    const compData = getCompanionById(companionId);
    if (!compData) return false;
    
    const newComp = new Companion(this.player.x + 1, this.player.y, {
      id: compData.id,
      name: compData.name,
      color: compData.color,
      icon: compData.icon,
      drop: compData.drop,
      type: compData.id,
      tier: compData.tier,
      personality: compData.personality,
      role: compData.role,
    });
    this.companions.push(newComp);
    newComp.showEmote('💖', 2.0);
    
    this.recalculatePerks();
    this.saveGame();
    return true;
  }
  
  // Undeploy a companion (return to inventory only)
  undeployCompanion(companionId) {
    const idx = this.companions.findIndex(c => (c.type || c.id) === companionId);
    if (idx < 0) return false;
    
    const comp = this.companions[idx];
    comp.showEmote('👋', 1.5);
    this.companions.splice(idx, 1);
    
    this.recalculatePerks();
    this.saveGame();
    return true;
  }

  playEatStartSfx() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.type = 'sine';
      o.frequency.setValueAtTime(520, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08);
      g.gain.setValueAtTime(0.06, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      o.start(ctx.currentTime);
      o.stop(ctx.currentTime + 0.12);
    } catch (e) { /* ignore */ }
  }

  playEatCrunchSfx() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const bufferSize = ctx.sampleRate * 0.06;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize) * 0.35;
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1200;
      const g = ctx.createGain();
      g.gain.value = 0.12;
      src.connect(filter);
      filter.connect(g);
      g.connect(ctx.destination);
      src.start();
    } catch (e) { /* ignore */ }
  }

  applyConsumedFood(recipe) {
    const perks = this.perkBonuses;
    const hungerFillMult = perks.hungerFromFood || 1;
    let happyFillMult = perks.happinessFromFood || 1;
    // Trait modifiers on cooked-meal happiness gain
    const trait = this.player?.personality;
    if (trait === 'Gluttonous') happyFillMult *= 1.5;   // +50% happy from meals
    if (trait === 'Stoic')      happyFillMult *= 0.5;   // halved happiness gains
    // Global 30% reduction on hunger fill from cooked food (balance pass).
    this.player.stats.hunger = Math.min(100, this.player.stats.hunger + (recipe.hunger || 0) * 0.7 * hungerFillMult);
    // Frost Penguin: thirst restored +N from any source (additive bonus when source > 0)
    const thirstAmount = recipe.thirst || 0;
    const thirstBonus = thirstAmount > 0 ? (perks.thirstRestoreBonus || 0) : 0;
    this.player.stats.thirst = Math.min(100, this.player.stats.thirst + thirstAmount + thirstBonus);
    this.player.stats.happy = Math.min(100, this.player.stats.happy + (recipe.happy || 0) * happyFillMult);
    if (recipe.hpRestore) {
      this.player.stats.hp = Math.min(this.getMaxHp(), this.player.stats.hp + recipe.hpRestore);
    }
    // ── Apply the recipe's timed perk (was previously dead — now wired) ──
    if (recipe.perk && recipe.perk.stat) this._applyFoodPerk(recipe);
  }

  // Active food buffs: { stat, value, expiresAt (ms), name, icon, recipeId }.
  // Mist Chameleon's foodPerkDuration multiplies duration on apply.
  _applyFoodPerk(recipe) {
    if (!this._foodBuffs) this._foodBuffs = [];
    const p = recipe.perk;
    const durMult = this.perkBonuses.foodPerkDuration || 1;
    let dur = p.duration;
    let expiresAt = 0;
    if (dur === -1)      expiresAt = -1;                              // permanent for this run
    else if (dur === 0)  expiresAt = 0;                               // instant one-shot, no tracking needed
    else                 expiresAt = Date.now() + dur * durMult;      // timed buff (ms)

    // One-shot effects fire immediately and don't enter the buff list
    if (p.stat === 'companionMoodBoost') {
      const boost = p.value || 0;
      this.companions.forEach(c => { if (typeof c.mood === 'number') c.mood = Math.min(100, c.mood + boost); });
      return;
    }
    if (p.stat === 'reviveCompanion') {
      // Revive a KO'd companion + permanent +5 attack (run)
      const ko = this.companions.find(c => c.isKO);
      if (ko) { ko.isKO = false; ko.hp = Math.ceil((ko.maxHp || 10) * 0.6); ko.showEmote('💖', 2.5); }
      this._foodBuffs.push({ stat: 'attackBonus', value: p.attackBonus || 5, expiresAt: -1, name: recipe.name, icon: '⚔️', recipeId: recipe.id });
      return;
    }
    if (p.stat === 'skipNight') {
      // Cosmetic: jump straight to next dawn
      if (this.time.phase === 'Night') { this.time.phase = 'Day'; this.time.seconds = 0; this.time.dayCount++; }
      return;
    }
    if (p.stat === 'happinessLock') {
      // Instantly +N happiness, then prevent decay for the duration via a tracked buff
      this.player.stats.happy = Math.min(100, this.player.stats.happy + (p.value || 0));
      this._foodBuffs.push({ stat: 'happinessLock', value: 1, expiresAt, name: recipe.name, icon: '🔒', recipeId: recipe.id });
      return;
    }

    // Replace any existing buff with the same recipeId (re-eating refreshes)
    const existing = this._foodBuffs.findIndex(b => b.recipeId === recipe.id);
    if (existing >= 0) this._foodBuffs.splice(existing, 1);
    this._foodBuffs.push({
      stat: p.stat, value: p.value, expiresAt,
      name: recipe.name, icon: '🍴', recipeId: recipe.id,
    });

    // Permanent run-buff applies immediately (max HP / max happiness)
    if (expiresAt === -1) {
      if (p.stat === 'maxHpBonus') {
        this.player.stats.maxHp += p.value;
        this.player.stats.hp     = Math.min(this.getMaxHp(), this.player.stats.hp + p.value);
      } else if (p.stat === 'maxHappinessBonus') {
        // No explicit max happy field; treat as a flat +happy gain
        this.player.stats.happy = Math.min(100, this.player.stats.happy + p.value);
      }
    }
  }

  // Sweep expired buffs each frame; collect their effects into a flat object.
  _tickFoodBuffs(dt) {
    if (!this._foodBuffs || !this._foodBuffs.length) { this._foodBuffActive = null; return; }
    const now = Date.now();
    let changed = false;
    for (let i = this._foodBuffs.length - 1; i >= 0; i--) {
      const b = this._foodBuffs[i];
      if (b.expiresAt > 0 && now >= b.expiresAt) {
        this._foodBuffs.splice(i, 1);
        changed = true;
      }
    }
    // Always recompute (cheap)
    const active = {};
    for (const b of this._foodBuffs) {
      if (b.stat === 'attackBonus')         active.attackBonus       = (active.attackBonus       || 0) + b.value;
      else if (b.stat === 'hpRegen')        active.foodHpRegen       = (active.foodHpRegen       || 0) + b.value;
      else if (b.stat === 'hungerDecay')    active.foodHungerDecayMul = (active.foodHungerDecayMul ?? 1) * b.value;
      else if (b.stat === 'happinessDecay') active.foodHappyDecayMul  = (active.foodHappyDecayMul  ?? 1) * b.value;
      else if (b.stat === 'goldBonus')      active.foodGoldMul        = (active.foodGoldMul        ?? 1) * b.value;
      else if (b.stat === 'craftingSpeed')  active.foodCraftSpeedMul  = (active.foodCraftSpeedMul  ?? 1) * b.value;
      else if (b.stat === 'allStatsBonus')  active.foodAllStatsMul    = (active.foodAllStatsMul    ?? 1) * b.value;
      else if (b.stat === 'happinessLock')  active.foodHappinessLock  = true;
      else if (b.stat === 'fearImmunity')   active.foodFearImmune     = true;
      else if (b.stat === 'thirstImmunity') active.foodThirstImmune   = true;
      else if (b.stat === 'nightmareRepel') active.foodRepelTiles     = Math.max(active.foodRepelTiles || 0, b.value);
      else if (b.stat === 'nightmaresFlee') active.foodNmFlee         = true;
      else if (b.stat === 'nightVision')    active.foodNightVisionMul = (active.foodNightVisionMul ?? 1) * b.value;
    }
    this._foodBuffActive = active;
    if (changed && window.updatePerkHUD) window.updatePerkHUD();
  }

  startEatingFood(itemName) {
    if (!this.player.inventory[itemName] || this.player.inventory[itemName] < 1) return false;
    if (!isCookedFood(itemName)) return false;
    const recipe = getRecipeByFoodName(itemName);
    if (!recipe) return false;
    if (this.player.isEating || this.player.isPetting) return false;

    const data = getItemData(itemName);
    this.player.isEating = true;
    this.player.eatingTime = 0;
    this.player.eatingDuration = 2;
    this.player.eatingFoodIcon = data.icon;
    this.player.isAuto = false;
    this.player.petTarget = null;
    this.player.targetEntity = null;
    this.player.pickupItemTarget = null;
    this.player.isPickingUp = false;
    this.player.pendingCollectedItem = null;
    this.eatSfxTimer = 0.35;

    this.player.onEatComplete = () => {
      this.applyConsumedFood(recipe);
      this.player.inventory[itemName]--;
      if (this.player.inventory[itemName] <= 0) delete this.player.inventory[itemName];
      this.player.showEmote('😋', 1.5);
      this.saveGame();
      // XP for eating (scales with recipe quality)
      const eatXp = (recipe.quality || 1) * 5; this._grantXP(eatXp);
      // ── Achievement tracking ─────────────────────────────
      this.ach.inc('meals_eaten');
      if (!this._mealsThisRun) this._mealsThisRun = new Set();
      this._mealsThisRun.add(itemName);
      this.ach.set('unique_meals_run', this._mealsThisRun.size);
      // Feast mode: 5 meals in 5 minutes
      if (!this._mealTimes) this._mealTimes = [];
      const now = Date.now();
      this._mealTimes.push(now);
      this._mealTimes = this._mealTimes.filter(t => now - t < 300000);
      if (this._mealTimes.length >= 5) this.ach.inc('feast_mode');
    };

    this.playEatStartSfx();
    return true;
  }

  dropFoodItem(itemName) {
    return this.dropItem(itemName);
  }

  dropItem(itemName) {
    const inv = this.player.inventory;
    if (!inv[itemName] || inv[itemName] < 1) return false;
    inv[itemName]--;
    if (inv[itemName] <= 0) delete inv[itemName];
    const before = this.items.length;
    this.spawnItem(this.player.x, this.player.y, itemName);
    if (this.items.length > before) {
      this.items[this.items.length - 1]._playerDropped = true;
    }
    this.player.showEmote('👋', 1.0);
    // Story tasks T5.2 / T4.4 — drop a 2★+ / 3★ cooked meal near Child 5 or Child 4.
    const recipe = getRecipeByFoodName?.(itemName);
    if (recipe && this.children?.list) {
      const helpers = this.children._taskTickerHelpers;
      const c5 = this.children.list[4];
      if (c5 && c5.phase === 'PRESENT' && Math.hypot(c5.x - this.player.x, c5.y - this.player.y) < 3) {
        if ((recipe.quality || 1) >= 2) helpers?.set?.('T5.2', 'done', true);
      }
      const c4 = this.children.list[3];
      if (c4 && c4.phase === 'PRESENT' && Math.hypot(c4.x - this.player.x, c4.y - this.player.y) < 3) {
        if ((recipe.quality || 1) >= 3) helpers?.set?.('T4.4', 'fed3star', true);
      }
    }
    this.saveGame();
    return true;
  }

  // ==================== SAVE / LOAD SYSTEM ====================
  
  saveGame() {
    if (this.player?.isDead) return false;
    const saveData = {
      version: 4,
      timestamp: Date.now(),
      player: {
        x: this.player.x,
        y: this.player.y,
        stats: { ...this.player.stats },
        inventory: { ...this.player.inventory },
        personality: this.player.personality || 'Curious'
      },
      companions: this.companions.map(c => ({
        type: c.type || c.id,
        x: c.x,
        y: c.y,
        dropTimer: c.dropTimer,
        petCooldown: c.petCooldown
      })),
      companionInventory: { ...this.companionInventory },
      collectedCompanionIds: Array.from(this.collectedCompanionIds),
      time: { ...this.time },
      ach: this.ach.toJSON(),
      gold: this.gold,
      totalGoldEarned: this.totalGoldEarned,
      totalGoldSpent:  this.totalGoldSpent,
      tradeCount:      this.tradeCount,
      packCount:       this.packCount,
      rareBoughtCount: this.rareBoughtCount,
      builtProps:      { ...this.builtProps },
      unlockedCookTiers: Array.from(this.unlockedCookTiers),
      cosmeticInventory: { ...this.cosmeticInventory },
      editMode: this.editMode?.toSaveData(),
      story:   this._serializeRunStory(),
      isFirstTime: false
    };
    
    try {
      localStorage.setItem(Game._getSaveKey(), JSON.stringify(saveData));
      
      // Show save indicator
      const indicator = document.getElementById('save-indicator');
      if (indicator) {
        indicator.classList.add('show');
        setTimeout(() => indicator.classList.remove('show'), 1500);
      }
      
      return true;
    } catch (e) {
      console.error('Failed to save:', e);
      return false;
    }
  }

  loadGame() {
    try {
      const raw = localStorage.getItem(Game._getSaveKey());
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data || ![1,2,3,4].includes(data.version)) return false;
      // Player
      this.player.x = data.player.x;
      this.player.y = data.player.y;
      this.player.visualX = data.player.x;
      this.player.visualY = data.player.y;
      this.player.targetX = data.player.x;
      this.player.targetY = data.player.y;
      Object.assign(this.player.stats, data.player.stats);
      // Safety net: dead save (hp≤0) — start fresh so _loadLegacy() runs once
      if (this.player.stats.hp <= 0) {
        localStorage.removeItem(Game._getSaveKey());
        return false;
      }
      this.player.inventory = { ...data.player.inventory };
      // Restore personality (saves predating v3.1 default to profile setting / Curious)
      const trait = data.player.personality || Game._getProfileTrait() || 'Curious';
      this.player.personality = trait;
      // Companions
      this.companions = [];
      this.collectedCompanionIds = new Set(data.collectedCompanionIds || []);
      this.companionInventory = data.companionInventory || {};
      for (const sc of data.companions) {
        const compId   = sc.type || sc.id;
        const compData = getCompanionById(compId);
        if (compData) {
          const comp = new Companion(sc.x, sc.y, { id: compData.id, name: compData.name,
            color: compData.color, icon: compData.icon, drop: compData.drop, type: compData.id,
            tier: compData.tier, personality: compData.personality, role: compData.role });
          comp.dropTimer   = sc.dropTimer   || 300;
          comp.petCooldown = sc.petCooldown || 0;
          this.companions.push(comp);
          if (!this.companionInventory[compData.id]) this.companionInventory[compData.id] = 1;
        }
      }
      // Time
      Object.assign(this.time, data.time);
      // New tracker (v3) or migrate from old
      if (data.ach) {
        this.ach.fromJSON(data.ach);
      }
      // Gold & economy
      this.gold            = data.gold            || 0;
      this.totalGoldEarned = data.totalGoldEarned || 0;
      this.totalGoldSpent  = data.totalGoldSpent  || 0;
      this.tradeCount      = data.tradeCount      || 0;
      this.packCount       = data.packCount       || 0;
      this.rareBoughtCount = data.rareBoughtCount || 0;
      // Crafting
      this.builtProps = data.builtProps || {};
      // Cooking tier unlocks
      this.unlockedCookTiers = new Set(data.unlockedCookTiers || [1]);
      // Cosmetic inventory
      this.cosmeticInventory = data.cosmeticInventory || {};
      // Edit mode (structure positions + stored state)
      if (this.editMode) this.editMode.fromSaveData(data.editMode || null);
      // Story state (v4+) — v3 and earlier saves get defaults via _hydrateRunStory.
      this._hydrateRunStory(data.story);
      // Hydrate narrative meta-progress from legacy too — _loadLegacy isn't called on
      // the Continue path (perks are already baked into the save), but shards/name/ending
      // live in legacy and must be restored independently.
      try {
        const legacyRaw = localStorage.getItem(Game._getLegacyKey());
        if (legacyRaw) this._hydrateLegacyStory(JSON.parse(legacyRaw).story);
      } catch (e) { /* ignore */ }
      // Restore previously-found children to PRESENT phase at home spots.
      this.children?.hydrateFromStory?.();
      // Re-arm the campfire's name-input pulse if Shard 10 was collected last session.
      if (this.story?.flags?.nameInputArmed && this.campfire) {
        this.campfire.pulseForName = true;
      }
      this.recalculatePerks();
      // Restore merchant if loading during daytime (merchantPresent is never saved)
      if (this.time.phase === 'Day' && !this.merchantPresent) {
        if (this.time.dayCount > 1 || this.time.seconds >= this.MERCHANT_ARRIVE_TIME) {
          this.merchantCamp.merchantInside = false;
          this._spawnMerchantAtCamp();
          this.merchantPresent = true;
        }
      }
      return true;
    } catch (e) {
      console.error('Failed to load:', e);
      return false;
    }
  }

  // ── Full run-state reset for "New Game" (without page reload) ──
  // Clears everything run-scoped so nothing bleeds over from the previous run.
  // Preserves: world, campfire/cookingStation instances, DOM bindings, merchantCamp instance,
  // and the Game object itself. Legacy data + profile are read back in afterwards by _loadLegacy().
  resetRunState() {
    // ── Player: fresh stats, inventory, position, animation flags ──
    const trait = Game._getProfileTrait();
    const startHp = GAME_DATA.player.startHp;
    const maxHp   = GAME_DATA.player.maxHp;
    this.player.x = 0; this.player.y = 0;
    this.player.visualX = 0; this.player.visualY = 0;
    this.player.targetX = 0; this.player.targetY = 0;
    this.player.stats = {
      hp: startHp, maxHp,
      hunger: 100, thirst: 100,
      happy:  GAME_DATA.player.startHappiness,
      level:  1, xp: 0,
    };
    this.player.inventory = {};
    this.player.personality = trait;
    this.player.isDead      = false;
    this.player.isAuto      = true;
    this.player.isEating    = false;
    this.player.isPickingUp = false;
    this.player.isPetting   = false;
    this.player.isCleaningJunk = false;
    this.player.petTarget    = null;
    this.player.targetEntity = null;
    this.player.pickupItemTarget = null;
    this.player.pendingCollectedItem = null;
    this.player.onEatComplete = null;
    this.player.onPetStart    = null;
    this.player.onPetComplete = null;
    this.player.autoTimer     = 0;
    this.player.wanderTimer   = 0;
    this.player.needEmoteTimer = 0;
    this.player.attackTimer   = 0;
    this.player.animTime      = 0;
    this.player.isWalking     = false;
    this.player.facingLeft    = false;
    this.player.emotion       = 'neutral';
    this.player.hitFlashTimer = 0;
    this.player._hasShield    = false;
    this.player._emote        = null;
    this.player.petAnimTime   = 0;
    this.player.eatingTime    = 0;
    this.player.eatingFoodIcon = '';
    this.player.pickupAnimTime = 0;
    this.player.pickupItemIcon = '';

    // ── Live entity lists ──
    this.companions    = [];
    this.nightmares    = [];
    this._nightmareWarnings = [];
    this.items         = [];
    this.junks         = [];
    this.attackVFXList = [];
    this.bullets       = [];
    this.specialVFX    = [];
    this._pickupFloats = [];
    this._itemPoofs    = [];
    this._celebrations = [];
    this._butterflies  = [];
    this._invDroppedRefs = new Set();

    // ── Collections owned at the run scope ──
    this.collectedCompanionIds = new Set();
    this.companionInventory = {};

    // No hard-coded starting Compy. _startNewGame() runs the intro picker
    // and calls _grantStartingCompy() with the chosen species after this
    // reset completes, so the player ends up with exactly one companion:
    // the one they chose at the campfire.

    // ── Economy ──
    this.gold = 0;
    this.totalGoldEarned = 0;
    this.totalGoldSpent  = 0;
    this.tradeCount      = 0;
    this.packCount       = 0;
    this.rareBoughtCount = 0;

    // ── Crafting / props / cosmetics ──
    this.builtProps        = {};
    this.craftProgress     = {};
    this.unlockedCookTiers = new Set([1]);
    this.cosmeticInventory = {};

    // ── Merchant: back in the camp, no active merchant ──
    this.merchant        = null;
    this.merchantTimer   = 0;
    this.merchantPresent = false;
    this._merchantScaredRun = false;
    if (this.merchantCamp) {
      this.merchantCamp.x = -2.4; this.merchantCamp.y = -2.4;
      this.merchantCamp.visualX = -2.4; this.merchantCamp.visualY = -2.4;
      this.merchantCamp.merchantInside = true;
    }
    // Reset cooking station position (Edit Mode may have moved it)
    if (this.cookingStation) {
      this.cookingStation.x = 2; this.cookingStation.y = 0.5;
      this.cookingStation.visualX = 2; this.cookingStation.visualY = 0.5;
    }
    // Edit Mode: collapse any in-progress placement and clear cosmetics/stored flags
    if (this.editMode) {
      this.editMode.active = false;
      this.editMode._placing = null;
      this.editMode._placingCos = -1;
      this.editMode._previewValid = false;
      this.editMode.stored = { cookingStation: false, merchantCamp: false };
      this.editMode.placedCosmetics = [];
    }

    // ── Time & day cycle ──
    this.time = { phase: 'Day', seconds: 0, dayCount: 1, multiplier: 1, nextSpawn: 0 };

    // ── Auto-save / misc timers ──
    this.autoSaveTimer   = 30;
    this.eatSfxTimer     = 0;
    this._day1tracked    = false;
    this._duskWarned     = false;
    this._fountainHappyTimer = 120;
    this._stoneWellTimer  = 180;
    this._herbGardenTimer = 600;
    this._happy80Acc      = 0;
    this._thirst80Acc     = 0;
    this._nightTracked    = 0;
    this._nightmaresFledThisNight = 0;
    this._untouchedThisNight = true;
    this._mealsThisRun = new Set();
    this._mealTimes = [];
    this._junkSpawnTimer = 20;
    this._junkCleanTarget = null;
    this._junkCleanProgress = 0;
    this._junkDayCount = 0;
    this._butterflySpawnTimer = 0;
    this._usedQuoteIndices = new Set();
    this._quoteDisplay = { text: '', timer: 0, maxTime: 8 };

    // ── Ephemeral perk / rare-item / ability flags (all consumed during run) ──
    this._foodBuffs       = [];
    this._foodBuffActive  = null;
    this._propAbilityCD   = {};
    this._wardPulseTimer  = 0;
    this._happinessCandleTimer = 0;
    this._moonlightUntilDayCount = 0;
    this._moonFerretIgnoresUsed = 0;
    this._legacyCarrySlots = 0;
    this._voidKittenUsed  = false;
    this._bossSpawnedThisNight = false;
    this._propDecayBonus  = 1;
    this._propDropSpeedBonus = 1;
    // Reset legacy perk carriers so _loadLegacy() can re-populate cleanly
    this._legacyDropSpeed  = 0;
    this._legacyNmSlow     = 1;
    this._activeLegacyPerks = [];

    // ── Notifications & UI state ──
    this._achNotif       = null;
    this._achToastQueue  = [];
    this._achToastTimer  = 0;
    this._bossNightNotif = null;
    this._pendingModal   = null;

    // ── Level-up cinematic ──
    this._levelUpAnim = {
      active: false, timer: 0, duration: 3.5, newLevel: 1,
      ringRadius: 0, maxRingRadius: 0,
      startZoom: this.camera?.zoom || 1.44,
      startCamX: 0, startCamY: 0,
    };

    // Pickup-search and trait throttles
    this._traitTickAcc      = 0;
    this._pickupSearchAcc   = 0;
    this._cdRefreshAcc      = 0;

    // ── Achievement tracker: fresh; legacy.ach (if present) is merged by _loadLegacy ──
    this.ach = new AchievementTracker();

    // ── Story per-run state: fresh; legacyStory is re-hydrated by _loadLegacy ──
    // Per-run blocks (children found/tasks/bond, campfire upgrades, run flags) reset
    // every reincarnation. Persistent narrative progress (shards, name, ending) lives
    // in this.legacyStory and is restored separately.
    this.story = this._defaultRunStory();

    // ── Children: rebuild manager so all phase/AI state is fresh.
    this.children = new ChildrenManager(this);
    // Re-register child camps with EditMode (camp instances were rebuilt).
    this.editMode?.registerChildCamps?.();
    // ── Finale director: rebuild so trigger/scene state resets cleanly.
    this.finale   = new FinaleDirector(this);
    // Per-run finale flags — peaceful mode does NOT carry into a new run.
    this._finaleSuspendNightmares = false;
    this._endingPeaceful = false;
    document.body.classList.remove('finale-active', 'ending-light', 'ending-home');
    document.getElementById('ending-crown')?.remove();

    // Perk bonuses: start empty; _loadLegacy + recalculatePerks rebuild them.
    this.perkBonuses = {};

    // Camera: re-frame on player
    if (this.camera) {
      const isMobile = window.innerWidth <= 480;
      this.camera.zoom = isMobile ? 1.08 : 1.44;
      this.camera.x = 0; this.camera.y = 0;
    }
  }

  deleteSave() {
    localStorage.removeItem(Game._getSaveKey());
    localStorage.removeItem('companionAndMe_firstTime');
  }

  // ── Profile / Account system ──────────────────────────────────────────
  static _initProfiles() {
    if (!localStorage.getItem('cmm_profiles')) {
      const id = 'p1';
      localStorage.setItem('cmm_profiles', JSON.stringify([{ id, name: 'Player 1', createdAt: Date.now() }]));
      localStorage.setItem('cmm_active_profile', id);
      // Migrate old saves into the default profile
      const oldSave = localStorage.getItem('companionAndMe_save');
      if (oldSave) { localStorage.setItem(`cmm_save_${id}`, oldSave); localStorage.removeItem('companionAndMe_save'); }
      const oldLeg  = localStorage.getItem('companionAndMe_legacy');
      if (oldLeg)  { localStorage.setItem(`cmm_legacy_${id}`, oldLeg);  localStorage.removeItem('companionAndMe_legacy'); }
    }
  }

  // Hard cap on dropped items to prevent runaway lag. Tuned to keep <16ms frame
  // budget on a mid-range mobile device with full sort + draw load.
  static MAX_ITEMS = 80;

  static _getActiveProfileId() {
    return localStorage.getItem('cmm_active_profile') || 'p1';
  }

  static _getSaveKey()   { return `cmm_save_${Game._getActiveProfileId()}`; }
  static _getLegacyKey() { return `cmm_legacy_${Game._getActiveProfileId()}`; }

  // Read the active profile's chosen personality trait (Curious if unset)
  static _getProfileTrait() {
    try {
      const profiles = JSON.parse(localStorage.getItem('cmm_profiles') || '[]');
      const id = Game._getActiveProfileId();
      const p = profiles.find(x => x.id === id);
      return (p && PLAYER_TRAITS[p.trait]) ? p.trait : DEFAULT_PLAYER_TRAIT;
    } catch { return DEFAULT_PLAYER_TRAIT; }
  }

  // Write the active profile's trait, fire its first-time feat, sync the live player.
  static _setProfileTrait(trait) {
    if (!PLAYER_TRAITS[trait]) return;
    try {
      const profiles = JSON.parse(localStorage.getItem('cmm_profiles') || '[]');
      const id = Game._getActiveProfileId();
      const p = profiles.find(x => x.id === id);
      if (p) {
        p.trait = trait;
        localStorage.setItem('cmm_profiles', JSON.stringify(profiles));
      }
      if (gameInstance?.player) {
        gameInstance.player.personality = trait;
        // Fire the first-pick feat for this trait (idempotent — counter set, not inc)
        const featCounter = PLAYER_TRAITS[trait].feat;
        if (featCounter && gameInstance.ach) gameInstance.ach.set(featCounter, 1);
        gameInstance.saveGame();
      }
    } catch {}
  }

  static _getProfiles() {
    try { return JSON.parse(localStorage.getItem('cmm_profiles') || '[]'); } catch { return []; }
  }

  static _getProfileSaveSummary(profileId) {
    try {
      const raw = localStorage.getItem(`cmm_save_${profileId}`);
      if (!raw) return null;
      const d = JSON.parse(raw);
      if (!d || (d.player?.stats?.hp ?? 1) <= 0) return null;
      return { day: d.time?.day || 1, level: d.player?.stats?.level || 1, gold: d.gold || 0 };
    } catch { return null; }
  }

  static hasSaveData() {
    return localStorage.getItem(Game._getSaveKey()) !== null;
  }

  static isFirstTime() {
    return localStorage.getItem('companionAndMe_firstTime') !== 'false';
  }

  static markNotFirstTime() {
    localStorage.setItem('companionAndMe_firstTime', 'false');
  }
}

let gameInstance = null; // Store for global access
// Expose to window so cross-module callers (entities.js helpers) can reach it
Object.defineProperty(window, 'gameInstance', {
  get() { return gameInstance; },
  configurable: true,
});

// Global scope expose for inline scripts if needed
window.openMenu = (menuId) => {
  console.log("Opening menu: " + menuId);
  // Dismiss any active toast immediately when a menu opens
  if (gameInstance) gameInstance._dismissToast();
  const modal = document.getElementById('modal-' + menuId);
  if (modal) {
    const wasOpen = modal.style.display === 'flex';
    _closeOtherSoloModals(modal.id);
    modal.style.display = 'flex';
    if (!wasOpen) window.StoryAudio?.playWindowOpen?.(0.7);
    if (_HUD_FIT_MODAL_IDS.has(modal.id)) _attachHudFit(modal);
    if (menuId === 'inv' && gameInstance) {
      window.updateInventoryUI(gameInstance.player.inventory);
    }
    if (menuId === 'cook' && gameInstance) {
      window.updateCookUI(gameInstance.player.inventory);
    }
    if (menuId === 'craft') window.tutorialMark?.('open_cook');
    if (menuId === 'cook')  window.tutorialMark?.('open_cook');
    if (menuId === 'ach')   window.tutorialMark?.('open_feats');
  }
};

window.closeMenu = (menuId) => {
  if (menuId === 'inv' && typeof hideInvDropdown === 'function') hideInvDropdown();
  const modal = document.getElementById('modal-' + menuId);
  if (modal) {
    const wasOpen = modal.style.display === 'flex';
    modal.style.display = 'none';
    if (wasOpen) window.StoryAudio?.playWindowClose?.(0.7);
    _detachHudFit(modal);
  }
};

let invDropdownCleanup = null;

function hideInvDropdown() {
  const ex = document.getElementById('inv-item-dropdown');
  if (ex) ex.remove();
  if (invDropdownCleanup) {
    document.removeEventListener('pointerdown', invDropdownCleanup, true);
    invDropdownCleanup = null;
  }
}

function showInvDropdown(anchorEl, itemName) {
  hideInvDropdown();
  const rect = anchorEl.getBoundingClientRect();
  const menu = document.createElement('div');
  menu.id = 'inv-item-dropdown';
  menu.className = 'inv-item-dropdown';
  menu.innerHTML = `
    <button type="button" class="inv-dd-btn inv-dd-eat">Eat</button>
    <button type="button" class="inv-dd-btn inv-dd-drop">Drop</button>
  `;
  const left = Math.min(rect.left, window.innerWidth - 140);
  const top = rect.bottom + 4;
  menu.style.left = `${Math.max(8, left)}px`;
  menu.style.top = `${Math.min(top, window.innerHeight - 100)}px`;
  document.body.appendChild(menu);

  menu.querySelector('.inv-dd-eat').onclick = (e) => {
    e.stopPropagation();
    hideInvDropdown();
    if (gameInstance) {
      window.closeMenu('inv');
      gameInstance.startEatingFood(itemName);
    }
  };
  menu.querySelector('.inv-dd-drop').onclick = (e) => {
    e.stopPropagation();
    hideInvDropdown();
    if (gameInstance) {
      gameInstance.dropFoodItem(itemName);
      window.updateInventoryUI(gameInstance.player.inventory);
    }
  };

  invDropdownCleanup = (e) => {
    if (menu.contains(e.target) || anchorEl.contains(e.target)) return;
    hideInvDropdown();
  };
  setTimeout(() => document.addEventListener('pointerdown', invDropdownCleanup, true), 0);
}


// ==================== INVENTORY UI (split panel) ====================

let _invSelected = null;

// ── Active Perks HUD ───────────────────────────────────────────────
window._togglePerksHUD = (e) => {
  e.stopPropagation();
  const panel = document.getElementById('hud-perks');
  if (!panel) return;
  panel.classList.toggle('perks-collapsed');
};

// ── Settings: dark mode + audio + reduce-motion toggles ──────────────
// Preferences are persisted in localStorage so they survive reloads.
const _SETTINGS_KEY = 'cmm_settings_v1';
function _loadSettings() {
  try { return JSON.parse(localStorage.getItem(_SETTINGS_KEY) || '{}'); }
  catch (_) { return {}; }
}
function _saveSettings(s) {
  try { localStorage.setItem(_SETTINGS_KEY, JSON.stringify(s)); } catch (_) {}
}
window._toggleDarkMode = (on) => {
  const s = _loadSettings();
  s.darkMode = !!on;
  _saveSettings(s);
  document.body.classList.toggle('dark-mode', !!on);
  window.StoryAudio?.playButtonPress?.(0.6);
};
window._toggleStoryAudio = (on) => {
  const s = _loadSettings();
  s.audioOn = !!on;
  _saveSettings(s);
  window._storyAudioMuted = !on;
  if (on) window.StoryAudio?.playButtonPress?.(0.6);
};
window._toggleReduceMotion = (on) => {
  const s = _loadSettings();
  s.reduceMotion = !!on;
  _saveSettings(s);
  document.body.classList.toggle('reduce-motion', !!on);
  window.StoryAudio?.playButtonPress?.(0.6);
};
// Low-spec mode — disables the most GPU-expensive effects (cloud field,
// backdrop blurs, glow shadows, sway/breathe loops) so the game stays
// smooth on entry-level mobile phones.
window._toggleLowSpec = (on) => {
  const s = _loadSettings();
  s.lowSpec = !!on;
  _saveSettings(s);
  window._lowSpecMode = !!on;
  document.body.classList.toggle('low-spec', !!on);
  window.StoryAudio?.playButtonPress?.(0.6);
};
// Apply persisted settings as soon as the page is ready (before the user
// even reaches the start menu).
(function _applySavedSettings() {
  const apply = () => {
    const s = _loadSettings();
    if (s.darkMode)     document.body.classList.add('dark-mode');
    if (s.reduceMotion) document.body.classList.add('reduce-motion');
    if (s.lowSpec)      { document.body.classList.add('low-spec'); window._lowSpecMode = true; }
    if (typeof s.audioOn === 'boolean') window._storyAudioMuted = !s.audioOn;
    // Sync the checkbox state once the modal exists in the DOM.
    const dm = document.getElementById('setting-dark-mode');
    const so = document.getElementById('setting-sound');
    const rm = document.getElementById('setting-reduce-motion');
    const ls = document.getElementById('setting-low-spec');
    if (dm) dm.checked = !!s.darkMode;
    if (so) so.checked = (typeof s.audioOn === 'boolean') ? s.audioOn : true;
    if (rm) rm.checked = !!s.reduceMotion;
    if (ls) ls.checked = !!s.lowSpec;
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply);
  } else {
    apply();
  }
})();

// ── Active Tasks HUD (left-side panel below the top HUD) ──────────────
// Lists the next active task per present Glimmer with progress + a one-tap
// shortcut to the task dialog. Toggle button minimises to just the badge.
window._tasksHUDCollapsed = false;
window._toggleTasksHUD = () => {
  window._tasksHUDCollapsed = !window._tasksHUDCollapsed;
  const el = document.getElementById('hud-tasks');
  if (el) el.classList.toggle('collapsed', window._tasksHUDCollapsed);
  window.updateActiveTasksHUD?.();
  window.StoryAudio?.playButtonPress?.(0.6);
};
window.updateActiveTasksHUD = () => {
  if (!gameInstance?.children) return;
  // Skip refresh while a celebration animation is mid-play; otherwise the
  // row element gets replaced and the tick / confetti / pulse all snap.
  if (_taskCelebrationActive) return;
  const root = document.getElementById('hud-tasks');
  const list = document.getElementById('hud-tasks-list');
  const countEl = document.getElementById('hud-tasks-toggle-count');
  if (!root || !list || !countEl) return;

  const story = gameInstance.story?.children;
  const rows = [];
  for (const c of gameInstance.children.list) {
    if (c.phase !== 'PRESENT') continue;
    const idx = c.childIdx;
    const slotsDone = story?.tasksDone?.[idx] || 0;
    if (slotsDone >= 4) continue;
    const task = activeTaskFor(idx, slotsDone);
    if (!task) continue;
    const ready = !!c.pendingTask;
    let progTxt = '';
    if (ready) progTxt = '✨ Ready — tap to confirm';
    else if (task.progress?.type === 'count' && task.counter) {
      const cur = Math.min(task.target, gameInstance.ach?.c?.[task.counter] || 0);
      progTxt = `${cur} / ${task.target}`;
    } else if (task.progress?.type === 'pct' && task.counter) {
      const pct = Math.min(100, Math.round(((gameInstance.ach?.c?.[task.counter] || 0) / task.target) * 100));
      progTxt = `${pct}%`;
    } else if (task.progress?.type === 'flag') {
      const done = task.counter ? (gameInstance.ach?.c?.[task.counter] || 0) >= task.target : false;
      progTxt = done ? 'Done!' : 'Pending';
    }
    // data-task-id + data-child-idx let the celebration drainer find this
    // row again after a re-render. The icon wrapper hosts the green-tick
    // overlay (.hud-task-tick) — but only AFTER the drainer has played
    // the celebration. Until then the tick is held back so the spring-pop
    // is what introduces it (in sync with the SFX + confetti + row pulse).
    // Once added to _tickedTaskIds, the tick re-emits with `.persisted`
    // on every render so it stays pinned until the player confirms.
    const tickHtml = (ready && _tickedTaskIds.has(task.id))
      ? `<div class="hud-task-tick persisted">✓</div>`
      : '';
    rows.push(`<div class="hud-task-row${ready ? ' ready' : ''}"
      data-task-id="${task.id}" data-child-idx="${idx}"
      onclick="window.openChildDialog(${idx})">
      <div class="hud-task-icon-wrap">
        <div class="hud-task-icon" style="color:${c.def.color}">${c.icon}</div>
        ${tickHtml}
      </div>
      <div class="hud-task-main">
        <div class="hud-task-name">${task.name}</div>
        <div class="hud-task-prog">${progTxt}</div>
      </div>
    </div>`);
  }
  list.innerHTML = rows.length
    ? rows.join('')
    : '<div class="hud-task-empty">No active tasks</div>';
  // Badge count when collapsed; suppressed when expanded (count is implicit).
  const readyCount = gameInstance.children.list.filter(c => c.pendingTask).length;
  if (window._tasksHUDCollapsed) {
    countEl.textContent = readyCount > 0 ? `· ${readyCount}✨` : (rows.length ? `· ${rows.length}` : '');
  } else {
    countEl.textContent = '';
  }
  // Hide the whole panel if no Glimmers are present yet.
  root.style.display = (rows.length === 0 && !window._tasksHUDCollapsed) ? 'none' : '';
};

// ════════════════════════════════════════════════════════════════════
// Task-completion celebration queue.
// When a task transitions to "ready" (children._markTaskPending), we push
// onto this queue. A polling drainer fires the snappy ✓-tick + confetti
// + SFX on the matching HUD row, but ONLY when no modal is open. Multiple
// completions stay queued and play in sequence (top-to-bottom of the HUD
// strip = the order they were marked pending). Saved across re-renders
// because each row carries data-task-id / data-child-idx.
// ════════════════════════════════════════════════════════════════════
const _taskCelebrationQueue = [];
let _taskCelebrationActive = false;
// Tracks task IDs whose green tick has already played its spring-pop. The
// HUD render reads this set: ticks for IDs in it skip the pop animation
// (they reappear instantly on every re-render) — so the tick stays pinned
// to the row from celebration time until the player confirms the task at
// the Glimmer (which clears pendingTask + bumps slotsDone, and we evict
// the entry below).
const _tickedTaskIds = new Set();

window._enqueueTaskCelebration = (childIdx, taskId) => {
  // Dedupe (the children ticker may fire twice on the same beat).
  if (_taskCelebrationQueue.some(e => e.taskId === taskId)) return;
  _taskCelebrationQueue.push({ childIdx, taskId });
};

// Called by children._completeTask after the player confirms — drops the
// task ID from the persistent-tick set so the row exiting `ready` state
// doesn't carry visual baggage if a future re-render somehow re-renders
// the same task (defensive: the row should normally disappear because
// slotsDone advances).
window._clearTaskTick = (taskId) => {
  _tickedTaskIds.delete(taskId);
};

// Returns true if any window/modal that should pause celebrations is open.
function _isAnyWindowOpen() {
  // Every modal in the codebase uses class="modal-overlay" with style.display
  // toggled to 'flex' / 'none'. This catches solo modals, death, tutorial,
  // confirm dialogs, the intro overlay, the start menu, and the StoryPanel.
  for (const m of document.querySelectorAll('.modal-overlay')) {
    if (m.style.display && m.style.display !== 'none') return true;
  }
  // Start menu uses its own root, not .modal-overlay.
  const startMenu = document.getElementById('start-menu');
  if (startMenu && startMenu.style.display && startMenu.style.display !== 'none') return true;
  // Intro sequence overlay (campfire greeting + Compy choice).
  const intro = document.getElementById('intro-overlay');
  if (intro && intro.style.display && intro.style.display !== 'none') return true;
  // Custom in-game confirm dialog (delete profile / reset everything).
  if (document.querySelector('.cmm-confirm-overlay')) return true;
  // Narrative panels (story reveal, shard, etc).
  if (window.StoryPanel?.isOpen?.()) return true;
  return false;
}

function _runOneCelebration(entry) {
  const list = document.getElementById('hud-tasks-list');
  if (!list) return Promise.resolve();
  const row = list.querySelector(`.hud-task-row[data-task-id="${entry.taskId}"]`);
  if (!row) return Promise.resolve(); // row gone (panel collapsed mid-queue?)

  const iconWrap = row.querySelector('.hud-task-icon-wrap');
  if (!iconWrap) return Promise.resolve();

  // The HUD render now writes the tick inline whenever the row is in the
  // `ready` state, so it persists across re-renders. Here we just make
  // sure the spring-pop animation plays on the first reveal — the render
  // emits the tick WITHOUT `.persisted` while the task ID is fresh, so
  // the keyframes fire naturally. We mark the ID as ticked AFTER the
  // pop so subsequent re-renders re-emit the tick with `.persisted`
  // (instant, no animation) and it sticks until the player confirms.
  let tick = iconWrap.querySelector('.hud-task-tick');
  if (!tick) {
    // Defensive: if the row was rendered before the queue caught up,
    // inject the tick now so the pop has something to animate.
    tick = document.createElement('div');
    tick.className = 'hud-task-tick';
    tick.textContent = '✓';
    iconWrap.appendChild(tick);
  }

  // Row pulse — punchy single-frame highlight.
  row.classList.add('celebrating');
  setTimeout(() => row.classList.remove('celebrating'), 900);

  // SFX — snappy success chord (rising major triad with a soft bell tail).
  _playTaskCompleteSFX();

  // VFX — burst of small DOM confetti right over the row. DOM-based (not
  // canvas) so it sits above the HUD without touching the world renderer.
  _spawnHudConfettiBurst(row);

  // Sequencing delay — the next celebration in the queue waits this long
  // so the player can register each one individually.
  return new Promise(resolve => {
    setTimeout(() => {
      // Mark the tick as "already animated" so future HUD re-renders
      // restore it instantly (without re-popping) until the player
      // confirms the task and the row leaves `ready` state.
      _tickedTaskIds.add(entry.taskId);
      resolve();
    }, 750);
  });
}

function _playTaskCompleteSFX() {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const t0 = ac.currentTime;
    // Rising triad: C5 → E5 → G5, tightly stacked → reads as a confident "✓".
    [
      { f: 523.25, t: 0.00, dur: 0.18, vol: 0.07 },
      { f: 659.25, t: 0.06, dur: 0.18, vol: 0.07 },
      { f: 783.99, t: 0.12, dur: 0.32, vol: 0.07 },
    ].forEach(n => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = 'triangle';
      o.frequency.value = n.f;
      g.gain.setValueAtTime(0, t0 + n.t);
      g.gain.linearRampToValueAtTime(n.vol, t0 + n.t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + n.t + n.dur);
      o.connect(g); g.connect(ac.destination);
      o.start(t0 + n.t); o.stop(t0 + n.t + n.dur + 0.02);
    });
    // Soft bell tail at the top — adds the "sparkle" feel.
    const bell = ac.createOscillator();
    const bellG = ac.createGain();
    bell.type = 'sine';
    bell.frequency.value = 1567.98; // G6
    bellG.gain.setValueAtTime(0, t0 + 0.18);
    bellG.gain.linearRampToValueAtTime(0.045, t0 + 0.20);
    bellG.gain.exponentialRampToValueAtTime(0.001, t0 + 0.85);
    bell.connect(bellG); bellG.connect(ac.destination);
    bell.start(t0 + 0.18); bell.stop(t0 + 0.90);
    setTimeout(() => { try { ac.close(); } catch (_) {} }, 1000);
  } catch (_) {}
}

function _spawnHudConfettiBurst(rowEl) {
  // Spawn 14 small coloured rectangles that arc out from the row's icon
  // area, fall under gravity, fade and drop after ~700ms. DOM-based so
  // they live above the canvas without competing with the world.
  const wrap = document.createElement('div');
  wrap.className = 'hud-task-confetti';
  rowEl.appendChild(wrap);
  const COLS = ['#fbbf24', '#34d399', '#a5f3fc', '#f9a8d4', '#c4b5fd', '#fde68a'];
  for (let i = 0; i < 14; i++) {
    const p = document.createElement('span');
    const angle = (-Math.PI * 0.55) + (Math.random() - 0.5) * Math.PI * 0.95;
    const speed = 70 + Math.random() * 70;
    const dx = Math.cos(angle) * speed;
    const dy = Math.sin(angle) * speed;
    p.style.setProperty('--dx', dx.toFixed(1) + 'px');
    p.style.setProperty('--dy', dy.toFixed(1) + 'px');
    p.style.setProperty('--rot', ((Math.random() - 0.5) * 540).toFixed(0) + 'deg');
    p.style.setProperty('--col', COLS[i % COLS.length]);
    p.style.animationDelay = (Math.random() * 0.04).toFixed(2) + 's';
    wrap.appendChild(p);
  }
  setTimeout(() => wrap.remove(), 1100);
}

// Drainer — polls every 200ms. Cheap (early-out when queue empty) and
// also handles the "wait for windows to close" rule without needing to
// hook every modal's open/close site.
setInterval(async () => {
  if (_taskCelebrationActive) return;
  if (_taskCelebrationQueue.length === 0) return;
  if (_isAnyWindowOpen()) return;
  _taskCelebrationActive = true;
  // Drain in stable order so multi-task completions play top-to-bottom.
  while (_taskCelebrationQueue.length > 0 && !_isAnyWindowOpen()) {
    const next = _taskCelebrationQueue.shift();
    await _runOneCelebration(next);
  }
  _taskCelebrationActive = false;
}, 200);

window.updatePerkHUD = () => {
  const panel = document.getElementById('hud-perks');
  const chips  = document.getElementById('perk-chips');
  if (!panel || !chips || !gameInstance) return;

  const comps = gameInstance.companions;
  if (!comps.length) { panel.style.display = 'none'; return; }

  panel.style.display = 'flex';
  chips.innerHTML = '';

  const _PERK_COLOR = { positive:'positive', negative:'negative', special:'special' };
  const _perkStyle = (stat) => {
    const neg = ['happinessDecay','hungerDecay','thirstDecay','craftingCostReduction','nightmareHpReduction','companionProduceSpeed'].includes(stat) ? 'positive' : null;
    const spc = ['nightmareIgnoreChance','nightmareTrapChance','lightPenaltyReduction','reviveOnDeath','nightmareWarning','craftingBonusChance','reflectDamage'].includes(stat) ? 'special' : null;
    return spc || neg || 'positive';
  };

  comps.forEach((comp, i) => {
    const compData = getCompanionById(comp.type);
    if (!compData?.perk) return;
    const chip = document.createElement('div');
    chip.className = 'perk-chip';
    chip.style.animationDelay = `${i * 0.06}s`;
    const cls = _perkStyle(compData.perk.stat);
    chip.innerHTML =
      `<span class="perk-chip-icon">${compData.icon}</span>` +
      `<div class="perk-chip-body">` +
        `<div class="perk-chip-name">${compData.name.split(' ')[0]}</div>` +
        `<div class="perk-chip-desc ${cls}">${compData.perk.desc}</div>` +
      `</div>`;
    chips.appendChild(chip);
  });
};

window.updateInventoryUI = (inventory) => {
  const inv = inventory || (gameInstance ? gameInstance.player.inventory : {});
  const listEl   = document.getElementById('inv-list');
  const detailEl = document.getElementById('inv-detail');
  if (!listEl || !detailEl) return;

  listEl.innerHTML = '';
  const names = Object.keys(inv);
  if (names.length === 0) {
    listEl.innerHTML = '<div class="split-detail-empty" style="padding:20px">Inventory is empty</div>';
    detailEl.innerHTML = '<div class="split-detail-empty">Collect items first!</div>';
    return;
  }

  // Group: food / materials
  const foods  = names.filter(n => isCookedFood(n));
  const mats   = names.filter(n => !isCookedFood(n));
  const sections = [['Cooked Food', foods], ['Materials', mats]];

  let firstEl = null;
  sections.forEach(([label, items]) => {
    if (!items.length) return;
    const hdr = document.createElement('div');
    hdr.className = 'split-section-label';
    hdr.textContent = label;
    listEl.appendChild(hdr);
    items.forEach(name => {
      const itemData = getItemData(name);
      const qty = inv[name];
      const el = document.createElement('div');
      el.className = 'split-row' + (_invSelected === name ? ' active' : '');
      el.innerHTML = `<span class="sr-icon">${itemData.icon}</span>
        <span class="sr-info"><span class="sr-name">${name}</span><span class="sr-sub">x${qty}</span></span>
        <span class="sr-badge" style="color:${itemData.color}">${isCookedFood(name) ? (SELL_VALUES[name]||1)+'g' : ''}</span>`;
      el.onclick = () => {
        _invSelected = name;
        listEl.querySelectorAll('.split-row').forEach(r => r.classList.remove('active'));
        el.classList.add('active');
        renderInvDetail(name, inv);
      };
      listEl.appendChild(el);
      if (!firstEl) firstEl = el;
    });
  });
  if (!_invSelected && firstEl) firstEl.click();
  else renderInvDetail(_invSelected, inv);
};

function renderInvDetail(name, inv) {
  const detailEl = document.getElementById('inv-detail');
  if (!detailEl || !name || !inv[name]) { detailEl.innerHTML = '<div class="split-detail-empty">Select an item</div>'; return; }
  const itemData = getItemData(name);
  const qty = inv[name];
  const cooked = isCookedFood(name);
  const isPotion = name === 'Health Potion';
  const sellVal = SELL_VALUES[name] || 1;
  const recipe = cooked ? getRecipeByFoodName(name) : null;
  let buffsHtml = '';
  if (recipe) {
    if (recipe.hunger) buffsHtml += `<span class="sd-pill" style="color:var(--c-amber);border-color:var(--c-amber)">+${recipe.hunger}% Hunger</span>`;
    if (recipe.thirst) buffsHtml += `<span class="sd-pill" style="color:var(--c-blue);border-color:var(--c-blue)">+${recipe.thirst}% Thirst</span>`;
    if (recipe.happy)  buffsHtml += `<span class="sd-pill" style="color:var(--c-pink);border-color:var(--c-pink)">+${recipe.happy}% Mood</span>`;
    if (recipe.hpRestore) buffsHtml += `<span class="sd-pill" style="color:var(--c-red);border-color:var(--c-red)">+${recipe.hpRestore} HP</span>`;
  }
  const lore = FOOD_LORE[name] || (itemData.desc || 'A rare material from the void.');
  detailEl.innerHTML = `
    <div class="sd-art">${itemData.icon}</div>
    <div class="sd-name">${name}</div>
    <div class="sd-sub">x${qty} in inventory</div>
    <div class="sd-lore">"${lore}"</div>
    ${buffsHtml ? `<div class="sd-pills">${buffsHtml}</div>` : ''}
    <div class="sd-cta" style="display:flex;gap:8px;flex-direction:column">
      ${cooked ? `<button onclick="window._invEat('${name}')" style="width:100%;padding:13px;border-radius:12px;border:1px solid rgba(20,184,166,0.4);background:rgba(20,184,166,0.12);color:var(--c-teal);font-family:var(--font-display);font-size:14px;font-weight:700;cursor:pointer">Eat (x${qty})</button>` : ''}
      ${isPotion ? `<button onclick="window._invUse('${name}')" style="width:100%;padding:13px;border-radius:12px;border:1px solid rgba(239,68,68,0.4);background:rgba(239,68,68,0.12);color:var(--c-red);font-family:var(--font-display);font-size:14px;font-weight:700;cursor:pointer">Use · Restore 20 HP</button>` : ''}
      ${!isPotion ? `<button onclick="window._invSell('${name}')" style="width:100%;padding:13px;border-radius:12px;border:1px solid rgba(245,158,11,0.35);background:rgba(245,158,11,0.1);color:var(--c-amber);font-family:var(--font-display);font-size:14px;font-weight:700;cursor:pointer">Sell for ${sellVal}g</button>` : ''}
      <button onclick="window._invDrop('${name}')" style="width:100%;padding:13px;border-radius:12px;border:1px solid rgba(148,163,184,0.3);background:rgba(148,163,184,0.08);color:#94a3b8;font-family:var(--font-display);font-size:14px;font-weight:700;cursor:pointer">Drop</button>
    </div>`;
}

window._invEat = (name) => {
  if (!gameInstance) return;
  if (gameInstance.startEatingFood(name)) closeMenu('inv');
};
window._invUse = (name) => {
  if (!gameInstance || name !== 'Health Potion') return;
  const inv = gameInstance.player.inventory;
  if (!inv[name] || inv[name] < 1) return;
  gameInstance.player.stats.hp = Math.min(gameInstance.getMaxHp(), gameInstance.player.stats.hp + 20);
  inv[name]--;
  if (inv[name] <= 0) delete inv[name];
  gameInstance.player.showEmote('❤️', 1.5);
  gameInstance.saveGame();
  window.updateInventoryUI(inv);
};
window._invSell = (name) => {
  if (!gameInstance) return;
  gameInstance.sellItem(name, 1);
  _invSelected = null;
  window.updateInventoryUI(gameInstance.player.inventory);
};
window._invDrop = (name) => {
  if (!gameInstance) return;
  if (gameInstance.dropItem(name)) {
    _invSelected = null;
    window.updateInventoryUI(gameInstance.player.inventory);
  }
};

window.cookRecipe = (recipeId) => {
  if (!gameInstance) return;
  const recipe = GAME_DATA.recipes.find(r => r.id === recipeId);
  if (!recipe) return;
  if (recipe.req && recipe.req.special) { gameInstance.player.showEmote('X', 1.0); return; }
  const inv = gameInstance.player.inventory;
  let canCook = true;
  for (let reqItem in recipe.req) {
    if (!inv[reqItem] || inv[reqItem] < recipe.req[reqItem]) canCook = false;
  }
  if (canCook) {
    for (let reqItem in recipe.req) {
      inv[reqItem] -= recipe.req[reqItem];
      if (inv[reqItem] <= 0) delete inv[reqItem];
    }
    const outName = recipe.name;
    inv[outName] = (inv[outName] || 0) + 1;
    gameInstance.player.showEmote('*', 2.0);
    gameInstance.saveGame();
    const ach = gameInstance.ach;
    ach.inc('cook_total');
    if (recipe.quality === 1) ach.inc('cook_1');
    if (recipe.quality === 2) ach.inc('cook_2');
    if (recipe.quality === 3) ach.inc('cook_3');
    if (!gameInstance._cookedRecipes) gameInstance._cookedRecipes = new Set();
    if (!gameInstance._cookedRecipes.has(recipeId)) {
      gameInstance._cookedRecipes.add(recipeId);
      ach.set('cook_unique', gameInstance._cookedRecipes.size);
    }
    gameInstance._lastRecipeCookedAt = Date.now();
    // Story task T2.4 — cook 3 recipes while Child 2 is within 4 tiles of cooking station.
    const c2 = gameInstance.children?.list?.[1];
    if (c2 && c2.phase === 'PRESENT' && gameInstance.cookingStation) {
      const d = Math.hypot(c2.x - gameInstance.cookingStation.x, c2.y - gameInstance.cookingStation.y);
      if (d < 4) gameInstance.children._taskTickerHelpers?.bump?.('T2.4', 'cookedNear', 1);
    }
    const specKey = RECIPE_COUNTER_MAP[outName];
    if (specKey) ach.inc(specKey);
    window.updateInventoryUI(inv);
    window.updateCookUI(inv);
  } else {
    gameInstance.player.showEmote('X', 1.0);
  }
};

// ==================== COOK UI (split panel) ====================

let _selectedRecipe = null;

const COOK_TIER_UNLOCK_COST = { 2: 15, 3: 35 };
const COOK_TIER_LABEL = ['', '1★ Basic', '2★ Good', '3★ Delicious'];

window.updateCookUI = (inventory) => {
  if (!gameInstance) return;
  const inv = inventory || gameInstance.player.inventory;
  const listEl = document.getElementById('cook-recipe-list');
  if (!listEl) return;
  listEl.innerHTML = '';

  const unlocked = gameInstance.unlockedCookTiers;

  [1, 2, 3].forEach(q => {
    const hdr = document.createElement('div');
    hdr.className = 'split-section-label';
    hdr.textContent = COOK_TIER_LABEL[q] + ' Recipes';
    listEl.appendChild(hdr);

    if (!unlocked.has(q)) {
      // Locked tier banner
      const cost = COOK_TIER_UNLOCK_COST[q];
      const canAfford = gameInstance.gold >= cost;
      const banner = document.createElement('div');
      banner.className = 'cook-tier-lock';
      banner.innerHTML = `<span>🔒 Locked — Unlock for <strong>${cost}🪙</strong></span>
        <button onclick="unlockCookTier(${q})" ${canAfford ? '' : 'disabled'}
          style="padding:6px 14px;border-radius:8px;border:1px solid rgba(245,158,11,${canAfford?'0.5':'0.2'});background:rgba(245,158,11,${canAfford?'0.15':'0.05'});color:${canAfford?'var(--c-amber)':'var(--text-secondary)'};font-size:12px;font-weight:700;cursor:${canAfford?'pointer':'not-allowed'}">
          ${canAfford ? 'Unlock' : 'Need more gold'}
        </button>`;
      listEl.appendChild(banner);
      return;
    }

    const recipes = GAME_DATA.recipes.filter(r => r.quality === q && !r.req?.special);
    recipes.forEach(recipe => {
      let canCook = true;
      for (const [item, need] of Object.entries(recipe.req || {})) {
        if ((inv[item] || 0) < need) { canCook = false; break; }
      }
      const iData = getItemData(recipe.name);
      const isSelected = _selectedRecipe?.id === recipe.id;
      const el = document.createElement('div');
      el.className = 'split-row' + (isSelected ? ' active' : '');
      el.style.opacity = canCook ? '1' : '0.5';
      el.innerHTML = `<span class="sr-icon">${iData.icon}</span>
        <span class="sr-info"><span class="sr-name">${recipe.name}</span></span>
        ${canCook ? '<span class="sr-badge" style="color:#34d399">Ready</span>' : ''}`;
      el.onclick = () => {
        _selectedRecipe = recipe;
        listEl.querySelectorAll('.split-row').forEach(r => r.classList.remove('active'));
        el.classList.add('active');
        window._cookRefreshDetail(inv);
      };
      listEl.appendChild(el);
    });
  });

  if (!_selectedRecipe) {
    const first = GAME_DATA.recipes.find(r => !r.req?.special && unlocked.has(r.quality));
    if (first) _selectedRecipe = first;
  }
  window._cookRefreshDetail(inv);
};

window.unlockCookTier = (tier) => {
  if (!gameInstance) return;
  const cost = COOK_TIER_UNLOCK_COST[tier];
  if (!cost || gameInstance.unlockedCookTiers.has(tier)) return;
  if (!gameInstance._spendGold(cost)) { gameInstance.player.showEmote('❌', 1.0); return; }
  gameInstance.unlockedCookTiers.add(tier);
  gameInstance.player.showEmote('🍳', 2.0);
  gameInstance.saveGame();
  window.updateCookUI(gameInstance.player.inventory);
};

function _setSliderFill(el, v, min, max) {
  if (!el || max <= min) return;
  const pct = ((v - min) / (max - min)) * 100;
  el.style.background = `linear-gradient(to right, var(--c-purple) ${pct}%, rgba(255,255,255,0.12) ${pct}%)`;
}

window._cookRefreshDetail = (inv) => {
  const detail = document.getElementById('cook-detail');
  if (!detail || !_selectedRecipe) {
    if (detail) detail.innerHTML = '<div class="split-detail-empty">Select a recipe</div>';
    return;
  }
  const r = _selectedRecipe;
  const iData = getItemData(r.name);
  const lore  = FOOD_LORE[r.name] || 'A mysterious dish from beyond the void.';
  const stars = '&#9733;'.repeat(r.quality || 1) + '&#9734;'.repeat(3 - (r.quality || 1));

  // Max batches = floor of min(has/need) across all required ingredients
  let maxBatch = 99;
  let ingHtml = '';
  for (const [item, need] of Object.entries(r.req || {})) {
    const has = inv[item] || 0;
    maxBatch = Math.min(maxBatch, need > 0 ? Math.floor(has / need) : 99);
    const iD = getItemData(item);
    ingHtml += `<div class="sd-req-row${has>=need?'':' missing'}">
      <span>${iD.icon} ${item}</span><span>${has}/${need}</span></div>`;
  }
  maxBatch = Math.max(0, maxBatch);
  const canCook = maxBatch > 0;

  // Reset cook qty on recipe change
  if (window._cookRecipeId !== r.id) { window._cookRecipeId = r.id; window._cookQty = 1; }
  window._cookQty = Math.max(1, Math.min(window._cookQty || 1, Math.max(1, maxBatch)));
  const cq = window._cookQty;

  const buffsHtml = [
    r.hunger    ? `<span class="sd-pill" style="color:var(--c-amber);border-color:var(--c-amber)">+${r.hunger}% Hunger</span>` : '',
    r.thirst    ? `<span class="sd-pill" style="color:var(--c-blue);border-color:var(--c-blue)">+${r.thirst}% Thirst</span>` : '',
    r.happy     ? `<span class="sd-pill" style="color:var(--c-pink);border-color:var(--c-pink)">+${r.happy}% Mood</span>` : '',
    r.hpRestore ? `<span class="sd-pill" style="color:var(--c-red);border-color:var(--c-red)">+${r.hpRestore} HP</span>` : '',
  ].filter(Boolean).join('');

  detail.innerHTML = `
    <div class="sd-art">${iData.icon}</div>
    <div class="sd-name">${r.name}</div>
    <div class="sd-sub">${stars}</div>
    <div class="sd-lore">"${lore}"</div>
    <div class="sd-pills">${buffsHtml}</div>
    <hr class="sd-divider">
    <div style="font-size:11px;color:var(--text-secondary);margin-bottom:4px;font-weight:700;text-transform:uppercase;letter-spacing:1px">Ingredients</div>
    <div class="sd-reqs">${ingHtml}</div>
    ${canCook && maxBatch > 1 ? `<div class="qty-slider-wrap">
      <div class="qty-slider-header">
        <span class="qty-slider-label">Quantity</span>
        <span class="qty-val" id="cook-qty-display">${cq}</span>
      </div>
      <input type="range" class="qty-slider" min="1" max="${maxBatch}" value="${cq}"
        oninput="window._sliderCookQty(this,${maxBatch})">
      <div class="qty-slider-range"><span>1</span><span>${maxBatch}</span></div>
    </div>` : ''}
    <div class="sd-cta">
      <button id="cook-action-btn" onclick="cookRecipeSelected()" ${canCook ? '' : 'disabled'}
        style="width:100%;padding:14px;border-radius:12px;border:1px solid rgba(139,92,246,${canCook?'0.4':'0.15'});background:rgba(139,92,246,${canCook?'0.2':'0.06'});color:${canCook?'var(--text-primary)':'var(--text-secondary)'};font-family:var(--font-display);font-size:15px;font-weight:700;cursor:${canCook?'pointer':'not-allowed'}">
        ${canCook ? `Cook ×${cq}` : 'Missing ingredients'}
      </button>
    </div>`;
  const cookSlider = document.querySelector('#cook-detail .qty-slider');
  if (cookSlider) _setSliderFill(cookSlider, cq, 1, maxBatch);
};

window._adjCookQty = (delta, max) => {
  window._cookQty = Math.max(1, Math.min((window._cookQty||1) + delta, max));
  window._cookRefreshDetail(gameInstance?.player?.inventory);
};
window._sliderCookQty = (el, max) => {
  const v = Math.max(1, Math.min(+el.value, max));
  window._cookQty = v;
  _setSliderFill(el, v, 1, max);
  const d = document.getElementById('cook-qty-display');
  if (d) d.textContent = v;
  const b = document.getElementById('cook-action-btn');
  if (b) b.textContent = 'Cook ×' + v;
};

window.cookRecipeSelected = () => {
  if (!_selectedRecipe || !gameInstance) return;
  const times = Math.max(1, window._cookQty || 1);
  for (let i = 0; i < times; i++) window.cookRecipe(_selectedRecipe.id);
  window._cookQty = 1;
};

// ==================== ACTIVE PERKS UI ====================

window.updateActivePerksUI = () => {
  if (!gameInstance) return;
  const listEl = document.getElementById('active-perks-list');
  if (!listEl) return;
  listEl.innerHTML = '';

  // Active food buffs (from eaten recipes)
  const foodBuffs = gameInstance._foodBuffs || [];
  if (foodBuffs.length > 0) {
    listEl.innerHTML += `<div class="split-section-label" style="color:#5eead4">🍴 Food Buffs</div>`;
    const now = Date.now();
    foodBuffs.forEach(b => {
      let timeLabel = 'Run';
      if (b.expiresAt > 0) {
        const remain = Math.max(0, Math.ceil((b.expiresAt - now) / 1000));
        const m = Math.floor(remain / 60), s = remain % 60;
        timeLabel = m > 0 ? `${m}m ${s}s` : `${s}s`;
      }
      listEl.innerHTML += `<div class="active-perk-card" style="border-color:rgba(94,234,212,0.3)">
        <div class="active-perk-icon" style="background:rgba(94,234,212,0.12);font-size:20px">${b.icon || '🍴'}</div>
        <div class="active-perk-info">
          <div class="active-perk-name">${b.name}</div>
          <div class="active-perk-effect">${b.stat}: ${b.value}</div>
        </div>
        <span class="tier-badge" style="background:rgba(94,234,212,0.12);color:#5eead4;border-color:rgba(94,234,212,0.3)">${timeLabel}</span>
      </div>`;
    });
  }

  // Legacy perks section
  const legacyPerks = gameInstance._activeLegacyPerks || [];
  if (legacyPerks.length > 0) {
    listEl.innerHTML += `<div class="split-section-label" style="color:#fcd34d">✨ Legacy Perks</div>`;
    legacyPerks.forEach(p => {
      listEl.innerHTML += `<div class="active-perk-card" style="border-color:rgba(252,211,77,0.3)">
        <div class="active-perk-icon" style="background:rgba(252,211,77,0.15);font-size:20px">${p.icon}</div>
        <div class="active-perk-info">
          <div class="active-perk-name">${p.name}</div>
          <div class="active-perk-effect">${p.desc}</div>
        </div>
        <span class="tier-badge" style="background:rgba(252,211,77,0.15);color:#fcd34d;border-color:rgba(252,211,77,0.4)">Legacy</span>
      </div>`;
    });
  }

  if (gameInstance.companions.length === 0) {
    listEl.innerHTML += '<div class="no-perks">No Compys deployed</div>';
    return;
  }

  listEl.innerHTML += `<div class="split-section-label">Companion Perks</div>`;
  gameInstance.companions.forEach(comp => {
    const compData = getCompanionById(comp.type || comp.id);
    if (!compData || !compData.perk) return;
    const tierInfo = TIER_COLORS[compData.tier];
    const perkEl = document.createElement('div');
    perkEl.className = 'active-perk-card';
    perkEl.style.borderColor = tierInfo.border;
    perkEl.innerHTML = `
      <div class="active-perk-icon" style="background:${compData.color}30;">${compData.icon}</div>
      <div class="active-perk-info">
        <div class="active-perk-name">${compData.name}</div>
        <div class="active-perk-effect">${compData.perk.desc}</div>
      </div>
      <span class="tier-badge" style="background:${tierInfo.bg};color:${tierInfo.text};border-color:${tierInfo.border};">T${compData.tier}</span>`;
    listEl.appendChild(perkEl);
  });
};

// ==================== COMPANION MENU (split panel) ====================

let _compSelected = null;

window.updateCompanionUI = () => {
  const listEl   = document.getElementById('comps-list');
  const detailEl = document.getElementById('comps-detail');
  if (!listEl || !detailEl || !gameInstance) return;
  listEl.innerHTML = '';

  const maxDeployed = gameInstance.getMaxDeployedCompanions();

  // Deployed section
  if (gameInstance.companions.length > 0) {
    const hdr = document.createElement('div');
    hdr.className = 'split-section-label';
    hdr.textContent = `Deployed Compys (${gameInstance.companions.length}/${maxDeployed})`;
    listEl.appendChild(hdr);
    gameInstance.companions.forEach((comp) => {
      const cd = getCompanionById(comp.type || comp.id);
      if (!cd) return;
      const ti = TIER_COLORS[cd.tier];
      const el = document.createElement('div');
      el.className = 'split-row' + (_compSelected === 'dep_' + cd.id ? ' active' : '');
      el.innerHTML = `<span class="sr-icon" style="color:${cd.color}">${cd.icon}</span>
        <span class="sr-info"><span class="sr-name">${cd.name}</span><span class="sr-sub" style="color:${ti.text}">${ti.name}</span></span>
        <span class="sr-badge" style="color:#34d399">OUT</span>`;
      el.onclick = () => {
        _compSelected = 'dep_' + cd.id;
        listEl.querySelectorAll('.split-row').forEach(r=>r.classList.remove('active'));
        el.classList.add('active');
        renderCompDetail(cd, comp, 'deployed', maxDeployed);
      };
      listEl.appendChild(el);
    });
  }

  // Reserve section
  const inventoryComps = [];
  for (const [compId, count] of Object.entries(gameInstance.companionInventory)) {
    const deployedCount = gameInstance.companions.filter(c => (c.type||c.id) === compId).length;
    const available = count - deployedCount;
    if (available > 0) {
      const cd = getCompanionById(compId);
      if (cd) inventoryComps.push({ cd, count, deployedCount, available });
    }
  }
  if (inventoryComps.length > 0) {
    const hdr = document.createElement('div');
    hdr.className = 'split-section-label';
    hdr.textContent = 'In Reserve';
    listEl.appendChild(hdr);
    inventoryComps.forEach(({ cd, count, available }) => {
      const ti = TIER_COLORS[cd.tier];
      const el = document.createElement('div');
      el.className = 'split-row' + (_compSelected === 'res_' + cd.id ? ' active' : '');
      el.innerHTML = `<span class="sr-icon" style="color:${cd.color}">${cd.icon}</span>
        <span class="sr-info"><span class="sr-name">${cd.name}</span><span class="sr-sub" style="color:${ti.text}">${ti.name}</span></span>
        <span class="sr-badge">x${count}</span>`;
      el.onclick = () => {
        _compSelected = 'res_' + cd.id;
        listEl.querySelectorAll('.split-row').forEach(r=>r.classList.remove('active'));
        el.classList.add('active');
        renderCompDetail(cd, null, 'reserve', maxDeployed, count);
      };
      listEl.appendChild(el);
    });
  }

  // Undiscovered
  const discovered = new Set(Object.keys(gameInstance.companionInventory));
  const undiscovered = COMPANIONS.filter(c => !discovered.has(c.id));
  if (undiscovered.length > 0) {
    const hdr = document.createElement('div');
    hdr.className = 'split-section-label';
    hdr.textContent = `Undiscovered (${undiscovered.length})`;
    listEl.appendChild(hdr);
    undiscovered.forEach(cd => {
      const ti = TIER_COLORS[cd.tier];
      const el = document.createElement('div');
      el.className = 'split-row';
      el.style.opacity = '0.4';
      el.innerHTML = `<span class="sr-icon">?</span>
        <span class="sr-info"><span class="sr-name">???</span><span class="sr-sub" style="color:${ti.text}">${ti.name}</span></span>`;
      listEl.appendChild(el);
    });
  }

  // Trigger detail for currently selected
  if (_compSelected) {
    const activeEl = listEl.querySelector('.split-row.active');
    if (activeEl) activeEl.click();
  }
};

function renderCompDetail(cd, comp, mode, maxDeployed, count) {
  const detailEl = document.getElementById('comps-detail');
  if (!detailEl) return;
  const ti = TIER_COLORS[cd.tier];
  const dropItemData = getItemData(cd.drop);
  const hpBar = comp ? `<div style="background:rgba(0,0,0,0.3);border-radius:4px;height:6px;margin:4px 0"><div style="background:${comp.hp/comp.maxHp > 0.5 ? '#22c55e' : '#ef4444'};width:${Math.max(0,(comp.hp||cd.tier*30)/((cd.tier||1)*40+20)*100).toFixed(0)}%;height:100%;border-radius:4px"></div></div>` : '';
  const dropTimer = comp ? Math.max(0, Math.floor(comp.dropTimer || 0)) : 0;
  const mins = Math.floor(dropTimer/60), secs = dropTimer%60;
  const hasCopies  = (count||0) >= 3 && cd.tier < 6;
  const hasGold    = (gameInstance.gold || 0) >= 10;
  const canConvert = hasCopies && hasGold;
  const convertLabel = !hasCopies ? 'Need 3× to Convert' : !hasGold ? 'Need 10g' : 'Convert 3× + 10g';
  const canDeploy  = gameInstance.companions.length < maxDeployed;

  const detailArtHTML0 = cd.art
    ? `<img src="${cd.art}" alt="${cd.name}" style="width:120px;height:120px;object-fit:contain;display:block;margin:0 auto">`
    : cd.icon;
  detailEl.innerHTML = `
    <div class="sd-art" style="color:${cd.color}">${detailArtHTML0}</div>
    <div class="sd-name">${cd.name}</div>
    <div class="sd-sub"><span style="background:${ti.bg};color:${ti.text};border:1px solid ${ti.border};padding:2px 10px;border-radius:8px;font-weight:700">${ti.name} — Tier ${cd.tier}</span></div>
    ${cd.perk ? `<div class="sd-lore">Perk: ${cd.perk.desc}</div>` : ''}
    <div class="sd-pills">
      <span class="sd-pill" style="color:${dropItemData.color||'#a78bfa'};border-color:${dropItemData.color||'#a78bfa'}">${dropItemData.icon} ${cd.drop}</span>
      <span class="sd-pill" style="color:var(--text-secondary);border-color:var(--border-subtle)">${cd.personality||'Playful'}</span>
    </div>
    ${mode === 'deployed' ? `
      <div style="font-size:11px;color:var(--text-secondary);text-align:center">Next drop: ${mins}:${secs.toString().padStart(2,'0')}</div>
      ${hpBar}
      <div class="sd-cta">
        <button onclick="undeployCompanion('${cd.id}')" style="width:100%;padding:13px;border-radius:12px;border:1px solid rgba(239,68,68,0.3);background:rgba(239,68,68,0.08);color:var(--c-red);font-family:var(--font-display);font-size:14px;font-weight:700;cursor:pointer">Recall</button>
      </div>` : `
      <div class="sd-cta" style="display:flex;flex-direction:column;gap:8px">
        <button onclick="deployCompanion('${cd.id}')" ${canDeploy?'':'disabled'} style="width:100%;padding:13px;border-radius:12px;border:1px solid rgba(52,211,153,0.4);background:rgba(52,211,153,0.12);color:#34d399;font-family:var(--font-display);font-size:14px;font-weight:700;cursor:${canDeploy?'pointer':'not-allowed'};opacity:${canDeploy?1:0.35}">Deploy</button>
        ${cd.tier < 6 ? `<button onclick="convertCompanion('${cd.id}')" ${canConvert?'':'disabled'} style="width:100%;padding:12px;border-radius:12px;border:1px solid rgba(245,158,11,0.35);background:rgba(245,158,11,0.1);color:var(--c-amber);font-family:var(--font-display);font-size:13px;font-weight:700;cursor:${canConvert?'pointer':'not-allowed'};opacity:${canConvert?1:0.35}">${convertLabel} → T${cd.tier+1}</button>` : ''}
      </div>`}`;
}

window.deployCompanion = (compId) => {
  if (!gameInstance) return;
  if (gameInstance.deployCompanion(compId)) {
    window.updateTierTableUI();
  }
};
window.undeployCompanion = (compId) => {
  if (!gameInstance) return;
  if (gameInstance.undeployCompanion(compId)) {
    window.updateTierTableUI();
  }
};
window.convertCompanion = (compId) => {
  if (!gameInstance) return;
  const result = gameInstance.convertCompanion(compId);
  if (result) {
    gameInstance.ach.inc('conv_total');
    window.updateTierTableUI();
  }
};

// ==================== MERCHANT UI (split panel) ====================

const MERCHANT_STOCK = [
  // T1 ingredients only
  { name:'Mushroom',        cost:2,  qty:3,  type:'item', rare:false, icon:'🍄'  },
  { name:'Rice',            cost:2,  qty:3,  type:'item', rare:false, icon:'🍚'  },
  { name:'Egg',             cost:2,  qty:3,  type:'item', rare:false, icon:'🥚'  },
  { name:'Fresh Dew',       cost:1,  qty:5,  type:'item', rare:false, icon:'💧'  },
  { name:'Clover Leaf',     cost:1,  qty:5,  type:'item', rare:false, icon:'🍀'  },
  { name:'Wildflower',      cost:2,  qty:3,  type:'item', rare:false, icon:'🌸'  },
  { name:'Seaweed Noodle',  cost:2,  qty:3,  type:'item', rare:false, icon:'🍜'  },
  { name:'Bamboo Shoot',    cost:3,  qty:2,  type:'item', rare:false, icon:'🎋'  },
  { name:'Spice Dust',      cost:3,  qty:2,  type:'item', rare:false, icon:'🌶️' },
  { name:'Honey Glob',      cost:4,  qty:2,  type:'item', rare:false, icon:'🍯'  },
  { name:'Dream Herb',      cost:5,  qty:2,  type:'item', rare:false, icon:'🌿'  },
  { name:'Fleece Cloud',    cost:4,  qty:2,  type:'item', rare:false, icon:'☁️'  },
  // Special
  { name:'Booster Pack',    cost:10, qty:1,  type:'pack',       rare:false, icon:'🎁' },
  { name:'Health Potion',   cost:15, qty:1,  type:'consumable', rare:false, icon:'🧪' },
];

// Rare items the merchant rotates each spawn (1–2 picked per visit). type:'rare'.
// Effects fired in window.merchantBuy() based on `effect` key.
const RARE_STOCK = [
  { name:'Dream Seed',        cost:25, qty:1, type:'rare', rare:true, icon:'🌱', effect:'dream_seed',
    desc:'Use on purchase: sprouts one random rare T3 ingredient (Sea Crystal, Solar Berry, Ice Shard, Thunder Silk or Bamboo Shoot) on the ground beside you — perfect for high-tier recipes.' },
  { name:'Memory Shard',      cost:30, qty:1, type:'rare', rare:true, icon:'💠', effect:'memory_shard',
    desc:'Use on purchase: permanently grants +1 Legacy Perk slot the next time you reincarnate, letting you carry one extra perk into your next life. Stacks if you buy more.' },
  { name:'Moonlight Lantern', cost:20, qty:1, type:'rare', rare:true, icon:'🏮', effect:'moonlight',
    desc:'Use on purchase: pauses all nightmare spawns through the upcoming night and until the next dawn. Great insurance for Boss Nights.' },
  { name:'Tonic of Vigor',    cost:15, qty:1, type:'rare', rare:true, icon:'🧪', effect:'tonic_vigor',
    desc:'Use on purchase: permanent +20 max HP for the rest of this run, and instantly heals you for 20 HP. Stacks with each tonic bought.' },
  { name:'Companion Whistle', cost:5,  qty:1, type:'rare', rare:true, icon:'📯', effect:'whistle',
    desc:'Use on purchase: instantly recalls every deployed Compy to your tile — handy when they wander too far at night or you need to regroup before a fight.' },
  { name:'Happiness Candle',  cost:12, qty:1, type:'rare', rare:true, icon:'🕯️', effect:'happy_candle',
    desc:'Use on purchase: freezes happiness decay for 10 real-time minutes (timer keeps ticking even at night). Buy another to extend the duration.' },
];

// Today's rare offerings (subset of RARE_STOCK rotated per merchant visit).
let _todaysRareStock = [];

function _rotateRareStock() {
  // Pick 1-2 distinct rares for the day
  const pool = [...RARE_STOCK];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const count = 1 + Math.floor(Math.random() * 2); // 1 or 2
  _todaysRareStock = pool.slice(0, count);
}

window._getMerchantStockToday = () => [...MERCHANT_STOCK, ..._todaysRareStock];

let _merchantTab = 'buy';
let _merchantSel = null;

window.updateMerchantUI = () => {
  if (!gameInstance) return;
  const gold = gameInstance.gold;
  const goldEl = document.getElementById('merchant-gold');
  if (goldEl) goldEl.textContent = '💰 ' + gold + 'g';

  // Tab bar
  const tabBar = document.getElementById('merchant-tabs');
  if (tabBar) {
    tabBar.innerHTML = '';
    ['buy','decor','sell'].forEach(t => {
      const btn = document.createElement('button');
      btn.className = 'merch-tab-btn' + (_merchantTab === t ? ' active' : '');
      btn.textContent = t === 'buy' ? 'Buy' : t === 'decor' ? 'Decor' : 'Sell';
      btn.onclick = () => { _merchantTab = t; _merchantSel = null; window.updateMerchantUI(); };
      tabBar.appendChild(btn);
    });
  }

  const listEl   = document.getElementById('merch-list');
  const detailEl = document.getElementById('merch-detail');
  if (!listEl || !detailEl) return;
  listEl.innerHTML = '';

  if (_merchantTab === 'buy') {
    const todayStock = window._getMerchantStockToday();
    // Group by category; Booster Pack-bearing 'pack' is deliberately first.
    const categories = [
      { label: '🎁 Packs',       types: ['pack'],       color: '#fcd34d' },
      { label: '✨ Rare',         types: ['rare'],       color: '#c4b5fd' },
      { label: '🧪 Consumables',  types: ['consumable'], color: '#86efac' },
      { label: '🍄 Ingredients',  types: ['item'],       color: '#fda4af' },
    ];
    categories.forEach(cat => {
      const picks = todayStock
        .map((item, idx) => ({ item, idx }))
        .filter(({ item }) => cat.types.includes(item.type));
      if (!picks.length) return;
      const hdr = document.createElement('div');
      hdr.className = 'split-section-label';
      hdr.style.color = cat.color;
      hdr.textContent = cat.label;
      listEl.appendChild(hdr);
      picks.forEach(({ item, idx }) => {
        const canAfford = gold >= item.cost;
        const el = document.createElement('div');
        el.className = 'split-row' + (_merchantSel === idx ? ' active' : '');
        if (!canAfford) el.style.opacity = '0.5';
        el.innerHTML = `<span class="sr-icon">${item.icon}</span>
          <span class="sr-info"><span class="sr-name">${item.name}${item.qty>1?' x'+item.qty:''}</span><span class="sr-sub">${item.rare?'Rare':item.type==='pack'?'Special':item.type==='consumable'?'Consumable':'Common'}</span></span>
          <span class="sr-badge" style="color:${canAfford?'var(--c-amber)':'var(--c-red)'}">💰${item.cost}g</span>`;
        el.onclick = () => {
          _merchantSel = idx;
          listEl.querySelectorAll('.split-row').forEach(r=>r.classList.remove('active'));
          el.classList.add('active');
          renderMerchDetail(item, idx, gold);
        };
        listEl.appendChild(el);
      });
    });
  } else if (_merchantTab === 'decor') {
    (window.COSMETIC_DEFS || []).forEach((def, idx) => {
      const canAfford = gold >= def.cost;
      const owned = gameInstance.cosmeticInventory[def.id] || 0;
      const placed = (gameInstance.editMode?.placedCosmetics || []).filter(c => c.id === def.id).length;
      const el = document.createElement('div');
      el.className = 'split-row' + (_merchantSel === 'd'+idx ? ' active' : '');
      if (!canAfford) el.style.opacity = '0.55';
      el.innerHTML = `<span class="sr-icon">${def.icon}</span>
        <span class="sr-info"><span class="sr-name">${def.name}</span><span class="sr-sub">Owned: ${owned+placed}</span></span>
        <span class="sr-badge" style="color:${canAfford?'var(--c-amber)':'var(--c-red)'}">💰${def.cost}g</span>`;
      el.onclick = () => {
        _merchantSel = 'd'+idx;
        listEl.querySelectorAll('.split-row').forEach(r=>r.classList.remove('active'));
        el.classList.add('active');
        renderDecorDetail(def, idx, gold);
      };
      listEl.appendChild(el);
    });
  } else {
    const inv = gameInstance.player.inventory;
    const sellable = Object.entries(inv).filter(([n]) => SELL_VALUES[n]);
    if (!sellable.length) {
      listEl.innerHTML = '<div class="split-detail-empty" style="padding:20px">Nothing to sell</div>';
      detailEl.innerHTML = '<div class="split-detail-empty">Collect items first</div>';
      return;
    }
    sellable.forEach(([name, qty], idx) => {
      const sv = SELL_VALUES[name] || 1;
      const iData = getItemData(name);
      const el = document.createElement('div');
      el.className = 'split-row' + (_merchantSel === 's'+idx ? ' active' : '');
      el.innerHTML = `<span class="sr-icon">${iData.icon}</span>
        <span class="sr-info"><span class="sr-name">${name}</span><span class="sr-sub">x${qty}</span></span>
        <span class="sr-badge" style="color:var(--c-amber)">💰${sv}g</span>`;
      el.onclick = () => {
        _merchantSel = 's'+idx;
        listEl.querySelectorAll('.split-row').forEach(r=>r.classList.remove('active'));
        el.classList.add('active');
        renderSellDetail(name, qty, sv);
      };
      listEl.appendChild(el);
    });
  }
  // Re-render the selected detail instead of blanking it
  if (_merchantSel !== null) {
    const gold2 = gameInstance.gold;
    if (_merchantTab === 'buy' && typeof _merchantSel === 'number') {
      renderMerchDetail(window._getMerchantStockToday()[_merchantSel], _merchantSel, gold2);
    } else if (_merchantTab === 'decor' && typeof _merchantSel === 'string' && _merchantSel.startsWith('d')) {
      const dIdx = parseInt(_merchantSel.slice(1));
      const def = (window.COSMETIC_DEFS || [])[dIdx];
      if (def) renderDecorDetail(def, dIdx, gold2);
    } else if (_merchantTab === 'sell' && typeof _merchantSel === 'string' && _merchantSel.startsWith('s')) {
      const sIdx = parseInt(_merchantSel.slice(1));
      const inv = gameInstance.player.inventory;
      const sellable = Object.entries(inv).filter(([n]) => SELL_VALUES[n]);
      if (sellable[sIdx]) {
        const [name, qty] = sellable[sIdx];
        renderSellDetail(name, qty, SELL_VALUES[name] || 1);
      } else {
        _merchantSel = null;
        detailEl.innerHTML = '<div class="split-detail-empty">← Select an item</div>';
      }
    } else {
      detailEl.innerHTML = '<div class="split-detail-empty">← Select an item</div>';
    }
  } else {
    detailEl.innerHTML = '<div class="split-detail-empty">← Select an item</div>';
  }
};

function renderMerchDetail(item, idx, gold) {
  const detailEl = document.getElementById('merch-detail');
  if (!detailEl) return;
  const iData = getItemData(item.name);
  const canBuyMultiple = item.type === 'item' && !item.rare;
  if (window._buyItemIdx !== idx) { window._buyItemIdx = idx; window._buyQty = 1; }
  const maxBuyable = Math.max(1, Math.floor(gold / item.cost));
  const q = canBuyMultiple ? Math.min(maxBuyable, Math.max(1, window._buyQty || 1)) : 1;
  window._buyQty = q;
  const totalCost = item.cost * q;
  const canAfford = gold >= item.cost;
  const qtyRow = canBuyMultiple && maxBuyable > 1 ? `
    <div class="qty-slider-wrap">
      <div class="qty-slider-header">
        <span class="qty-slider-label">Quantity</span>
        <span class="qty-val" id="buy-qty-display">${q}</span>
      </div>
      <input type="range" class="qty-slider" min="1" max="${maxBuyable}" value="${q}"
        oninput="window._sliderBuyQty(this,${idx},${gold})">
      <div class="qty-slider-range"><span>1</span><span>${maxBuyable}</span></div>
    </div>` : '';
  detailEl.innerHTML = `
    <div class="sd-art">${item.icon}</div>
    <div class="sd-name">${item.name}${item.qty>1?' ×'+item.qty:''}</div>
    <div class="sd-sub">${item.rare?'Rare material':item.type==='pack'?'1 T1 Compy + 50% bonus + 3 resources!':item.type==='consumable'?'Consumable · Restores 20 HP':'Common material'}</div>
    <div class="sd-lore">"${item.desc || iData.desc || 'A fine trade good.'}"</div>
    ${qtyRow}
    <div class="sd-cta">
      <button id="merch-buy-btn" onclick="window._doBuy(${idx})" ${canAfford?'':'disabled'}
        style="width:100%;padding:14px;border-radius:12px;border:1px solid rgba(245,158,11,0.4);background:rgba(245,158,11,0.12);color:var(--c-amber);font-family:var(--font-display);font-size:15px;font-weight:700;cursor:${canAfford?'pointer':'not-allowed'};opacity:${canAfford?1:0.35}">
        ${canAfford ? 'Buy' + (q>1?' ×'+q:'') + ' for ' + totalCost + 'g' : 'Need ' + item.cost + 'g'}
      </button>
    </div>`;
  if (canBuyMultiple && maxBuyable > 1) {
    const buySlider = detailEl.querySelector('.qty-slider');
    if (buySlider) _setSliderFill(buySlider, q, 1, maxBuyable);
  }
}
window._adjBuyQty = (delta, idx, gold) => {
  const item = window._getMerchantStockToday()[idx];
  const maxBuyable = Math.max(1, Math.floor(gold / item.cost));
  window._buyQty = Math.min(maxBuyable, Math.max(1, (window._buyQty || 1) + delta));
  renderMerchDetail(item, idx, gold);
};
window._sliderBuyQty = (el, idx, gold) => {
  const item = window._getMerchantStockToday()[idx];
  const maxBuyable = Math.max(1, Math.floor(gold / item.cost));
  const v = Math.min(maxBuyable, Math.max(1, +el.value));
  window._buyQty = v;
  _setSliderFill(el, v, 1, maxBuyable);
  const total = item.cost * v;
  const can = gold >= total;
  const d = document.getElementById('buy-qty-display');
  if (d) d.textContent = v;
  const b = document.getElementById('merch-buy-btn');
  if (b) {
    b.disabled = !can;
    b.style.opacity = can ? '1' : '0.35';
    b.style.cursor = can ? 'pointer' : 'not-allowed';
    b.textContent = can ? 'Buy' + (v > 1 ? ' ×' + v : '') + ' for ' + total + 'g' : 'Need ' + item.cost + 'g';
  }
};
window._doBuy = (idx) => { window.merchantBuy(idx, window._buyQty || 1); };

function renderDecorDetail(def, idx, gold) {
  const detailEl = document.getElementById('merch-detail');
  if (!detailEl) return;
  if (window._decorBuyIdx !== idx) { window._decorBuyIdx = idx; window._decorBuyQty = 1; }
  const maxBuyable = Math.max(1, Math.floor(gold / def.cost));
  const q = Math.min(maxBuyable, Math.max(1, window._decorBuyQty || 1));
  window._decorBuyQty = q;
  const totalCost = def.cost * q;
  const canAfford  = gold >= def.cost;
  const qtyRow = maxBuyable > 1 ? `
    <div class="qty-slider-wrap">
      <div class="qty-slider-header">
        <span class="qty-slider-label">Quantity</span>
        <span class="qty-val" id="decor-qty-display">${q}</span>
      </div>
      <input type="range" class="qty-slider" min="1" max="${maxBuyable}" value="${q}"
        oninput="window._sliderDecorQty(this,${idx},${gold})">
      <div class="qty-slider-range"><span>1</span><span>${maxBuyable}</span></div>
    </div>` : '';
  const btnLabel = canAfford
    ? (q > 1 ? `Buy ×${q} for ${totalCost}g` : `Buy for ${def.cost}g`)
    : `Need ${def.cost}g`;
  detailEl.innerHTML = `
    <div class="sd-art">${def.icon}</div>
    <div class="sd-name">${def.name}</div>
    <div class="sd-sub">Cosmetic Structure</div>
    <div class="sd-lore">"Adds life and warmth to your safe zone. Place it anywhere in Edit Mode."</div>
    <div class="sd-pills">
      <span class="sd-pill" style="color:var(--c-teal);border-color:var(--c-teal)">✨ Decorative</span>
      <span class="sd-pill" style="color:var(--c-purple);border-color:var(--c-purple)">🚫 Repels Junk</span>
    </div>
    ${qtyRow}
    <div class="sd-cta">
      <button id="decor-buy-btn" onclick="window._doDecorBuy(${idx})" ${canAfford?'':'disabled'}
        style="width:100%;padding:14px;border-radius:12px;border:1px solid rgba(245,158,11,${canAfford?'0.4':'0.15'});background:rgba(245,158,11,${canAfford?'0.12':'0.04'});color:${canAfford?'var(--c-amber)':'var(--text-secondary)'};font-family:var(--font-display);font-size:15px;font-weight:700;cursor:${canAfford?'pointer':'not-allowed'}">
        ${btnLabel}
      </button>
    </div>`;
  const sl = detailEl.querySelector('.qty-slider');
  if (sl) _setSliderFill(sl, q, 1, maxBuyable);
}
window._sliderDecorQty = (el, idx, gold) => {
  const def = (window.COSMETIC_DEFS || [])[idx];
  if (!def) return;
  const maxBuyable = Math.max(1, Math.floor(gold / def.cost));
  const v = Math.min(maxBuyable, Math.max(1, +el.value));
  window._decorBuyQty = v;
  _setSliderFill(el, v, 1, maxBuyable);
  const total = def.cost * v;
  const can   = gold >= total;
  const d = document.getElementById('decor-qty-display');
  if (d) d.textContent = v;
  const b = document.getElementById('decor-buy-btn');
  if (b) {
    b.disabled = !can;
    b.style.opacity = can ? '1' : '0.35';
    b.textContent   = can ? (v > 1 ? `Buy ×${v} for ${total}g` : `Buy for ${def.cost}g`) : `Need ${def.cost}g`;
  }
};
window._doDecorBuy = (idx) => { window.buyCosmetic(idx, window._decorBuyQty || 1); };

window.buyCosmetic = (idx, qty = 1) => {
  if (!gameInstance) return;
  const def = (window.COSMETIC_DEFS || [])[idx];
  if (!def) return;
  const totalCost = def.cost * qty;
  if (!gameInstance._spendGold(totalCost)) { gameInstance.player.showEmote('❌', 1.0); return; }
  gameInstance.cosmeticInventory[def.id] = (gameInstance.cosmeticInventory[def.id] || 0) + qty;
  gameInstance.tradeCount += qty;
  gameInstance.ach.set('trades', gameInstance.tradeCount);
  const _decorSpecial = {
    cactus:'d_cactus', wood_fence:'d_fence', paper_lantern:'d_light', candle_post:'d_light',
    torch_stand:'d_light', fountain:'d_fountain', tulip_patch:'d_tulip',
  };
  const _treeDecorIds = ['oak_tree','pine_tree','palm_tree','cherry_bloom','bamboo_grove'];
  for (let i = 0; i < qty; i++) {
    gameInstance.ach.inc('decor_bought');
    if (_decorSpecial[def.id]) gameInstance.ach.inc(_decorSpecial[def.id]);
  }
  const _uniqueOwned = Object.keys(gameInstance.cosmeticInventory).filter(k => (gameInstance.cosmeticInventory[k] || 0) > 0).length;
  gameInstance.ach.max('decor_unique', _uniqueOwned);
  if (_treeDecorIds.includes(def.id)) {
    const _treesOwned = _treeDecorIds.filter(id => (gameInstance.cosmeticInventory[id] || 0) > 0).length;
    gameInstance.ach.max('decor_tree_unique', _treesOwned);
  }
  gameInstance.player.showEmote('🛍️', 1.5);
  gameInstance.saveGame();
  window.updateMerchantUI();
};

function renderSellDetail(name, qty, sv) {
  const detailEl = document.getElementById('merch-detail');
  if (!detailEl) return;
  const iData = getItemData(name);
  window._sellQty = window._sellQty || 1;
  // Reset if switching items
  if (window._sellItemName !== name) { window._sellItemName = name; window._sellQty = 1; }
  const q = Math.max(1, Math.min(window._sellQty, qty));
  window._sellQty = q;
  detailEl.innerHTML = `
    <div class="sd-art">${iData.icon}</div>
    <div class="sd-name">${name}</div>
    <div class="sd-sub">You own x${qty}</div>
    <div class="sd-lore">"${iData.desc||'Worth something to the merchant.'}"</div>
    <div class="sd-pills"><span class="sd-pill" style="color:var(--c-amber);border-color:var(--c-amber)">${sv}g each</span></div>
    <div class="qty-slider-wrap">
      <div class="qty-slider-header">
        <span class="qty-slider-label">Quantity</span>
        <span class="qty-val" id="sell-qty-display">${q}</span>
      </div>
      <input type="range" class="qty-slider" min="1" max="${qty}" value="${q}"
        oninput="window._sliderSellQty(this,'${name}',${qty},${sv})">
      <div class="qty-slider-range"><span>1</span><span>${qty}</span></div>
    </div>
    <div class="sd-cta">
      <button id="merch-sell-btn" onclick="window._doSell('${name}')"
        style="width:100%;padding:14px;border-radius:12px;border:1px solid rgba(245,158,11,0.4);background:rgba(245,158,11,0.12);color:var(--c-amber);font-family:var(--font-display);font-size:15px;font-weight:700;cursor:pointer">
        Sell ${q} for ${sv*q}g
      </button>
    </div>`;
  const sellSlider = detailEl.querySelector('.qty-slider');
  if (sellSlider) _setSliderFill(sellSlider, q, 1, qty);
}
window._adjSellQty = (delta, name, max, sv) => {
  window._sellQty = Math.max(1, Math.min((window._sellQty||1) + delta, max));
  renderSellDetail(name, max, sv);
};
window._sliderSellQty = (el, name, max, sv) => {
  const v = Math.max(1, Math.min(+el.value, max));
  window._sellQty = v;
  _setSliderFill(el, v, 1, max);
  const d = document.getElementById('sell-qty-display');
  if (d) d.textContent = v;
  const b = document.getElementById('merch-sell-btn');
  if (b) b.textContent = 'Sell ' + v + ' for ' + (sv * v) + 'g';
};
window._doSell = (name) => { window.sellToMerchant(name, window._sellQty || 1); };

// ── Edit Mode ─────────────────────────────────────────────────
window.toggleEditMode = () => {
  if (!gameInstance) return;
  const em = gameInstance.editMode;
  if (em.active) em.exit();
  else           em.enter();
  document.getElementById('btn-edit')?.classList.toggle('edit-active', em.active);
};

window._editPlaceStruct = (key) => {
  if (!gameInstance) return;
  const em = gameInstance.editMode;
  if (!em.active) return;
  em._placing      = key;
  em._placingCos   = -1;
  em._selected     = null;
  em._selectedCos  = -1;
  em._previewX     = gameInstance.player.x;
  em._previewY     = gameInstance.player.y;
  em._previewValid = em._isValidPos(key, em._previewX, em._previewY);
  gameInstance.canvas.classList.add('edit-placing');
  const inv = document.getElementById('btn-inv');
  if (inv) inv.innerHTML = '✕<br><span>Cancel</span>';
  window.closeMenu('struct');
  window._showEditPlaceBar();
};
window._editPlaceCos = (defIdx) => {
  if (!gameInstance) return;
  const em = gameInstance.editMode;
  if (!em.active) return;
  em._placingCos  = defIdx;
  em._placing     = null;
  em._selected    = null;
  em._selectedCos = -1;
  em._previewX    = gameInstance.player.x;
  em._previewY    = gameInstance.player.y;
  em._previewValid = em._isValidCosPos(em._previewX, em._previewY);
  gameInstance.canvas.classList.add('edit-placing');
  const inv = document.getElementById('btn-inv');
  if (inv) inv.innerHTML = '✕<br><span>Cancel</span>';
  window.closeMenu('struct');
  window._showEditPlaceBar();
};

// ── Edit-mode placement toolbar — Confirm / Cancel ──────────────────
// Anchored at the bottom of the screen during placement so mobile
// players don't have to tap the exact tile they want. Touch-and-drag
// the canvas to position the preview, then tap ✓ Place (or just lift
// your finger). The Place button auto-disables when the preview is
// over an invalid spot.
window._showEditPlaceBar = () => {
  const bar = document.getElementById('edit-place-bar');
  if (bar) bar.style.display = 'flex';
};
window._hideEditPlaceBar = () => {
  const bar = document.getElementById('edit-place-bar');
  if (bar) bar.style.display = 'none';
};
window._editConfirmPlacement = () => {
  if (!gameInstance) return;
  const em = gameInstance.editMode;
  if (!em || (em._placing == null && em._placingCos < 0)) return;
  em.confirmPlacement?.();
  window.StoryAudio?.playButtonPress?.(0.6);
};
window._editCancelPlacement = () => {
  if (!gameInstance) return;
  const em = gameInstance.editMode;
  em?._cancelPlaceMode?.();
  window._hideEditPlaceBar();
  window.StoryAudio?.playButtonPress?.(0.5);
};
// Refresh the Place button's disabled state every 250ms while the bar
// is visible — driven by `editMode._previewValid` which the engine
// updates on every pointer move.
setInterval(() => {
  const bar = document.getElementById('edit-place-bar');
  if (!bar || bar.style.display === 'none') return;
  const em = gameInstance?.editMode;
  if (!em) return;
  const valid = !!em._previewValid && (em._placing != null || em._placingCos >= 0);
  const btn = document.getElementById('edit-place-confirm');
  const hint = document.getElementById('edit-place-hint');
  if (btn) {
    btn.disabled = !valid;
    btn.classList.toggle('invalid', !valid);
  }
  if (hint) {
    hint.textContent = valid
      ? 'Drag to position · lift or tap ✓ Place'
      : 'That spot won\'t fit — try another';
  }
}, 250);

window._closeStructIfBg = (e) => {
  if (e.target === document.getElementById('modal-struct')) window.closeMenu('struct');
};

window.setMerchantTab = (tab) => { _merchantTab = tab; _merchantSel = null; window.updateMerchantUI(); };
window.sellToMerchant = (name, qty) => {
  if (!gameInstance) return;
  const earned = gameInstance.sellItem(name, qty);
  if (earned !== false) { window.updateMerchantUI(); window.updateInventoryUI(gameInstance.player.inventory); }
};
window.merchantBuy = (idx, qty = 1) => {
  if (!gameInstance) return;
  const item = window._getMerchantStockToday()[idx];
  if (!item) return;
  // Rare items are one-shot consumables — fire effect once, mark sold out, refresh UI.
  if (item.type === 'rare') {
    if (gameInstance.gold < item.cost) { gameInstance.player.showEmote('❌', 1.0); return; }
    if (!gameInstance._spendGold(item.cost)) return;
    gameInstance.tradeCount++;
    gameInstance.rareBoughtCount = (gameInstance.rareBoughtCount || 0) + 1;
    gameInstance.ach.set('trades', gameInstance.tradeCount);
    gameInstance.ach.inc('rare_bought');
    gameInstance._applyRareEffect(item);
    // Remove from today's pool so it can't be bought again this visit
    _todaysRareStock = _todaysRareStock.filter(r => r.name !== item.name);
    _merchantSel = null;
    window._buyQty = 1;
    window.updateMerchantUI();
    return;
  }
  let bought = 0;
  for (let i = 0; i < qty; i++) {
    if (!gameInstance.buyFromMerchant(item)) break;
    bought++;
  }
  if (bought > 0) { window._buyQty = 1; window.updateMerchantUI(); }
};

// ==================== CRAFT UI ====================

window.updateCraftUI = () => {
  const grid = document.getElementById('craft-grid');
  if (!grid || !gameInstance) return;
  grid.innerHTML = '';
  const inv = gameInstance.player.inventory;
  GAME_DATA.craftProps.forEach(prop => {
    const built = !!gameInstance.builtProps[prop.id];
    let canBuild = !built;
    let reqHtml = '';
    for (const [item, qty] of Object.entries(prop.req)) {
      const has = inv[item] || 0;
      const ok  = has >= qty;
      if (!ok) canBuild = false;
      const iData = getItemData(item);
      reqHtml += `<span style="color:${ok?'var(--c-teal)':'var(--c-red)'};font-size:11px">${iData.icon} ${item}: ${has}/${qty}</span><br>`;
    }
    // Ability button (only on built props that have an ability)
    let abilityHtml = '';
    if (built && prop.ability) {
      const cd = gameInstance._getPropAbilityCD(prop.id);
      const ready = cd <= 0;
      const cdLabel = ready ? `${prop.ability.icon} ${prop.ability.name}` : `${prop.ability.icon} ${Math.ceil(cd)}s`;
      abilityHtml = `
        <div class="craft-ability">
          <div class="craft-ability-desc">${prop.ability.desc}</div>
          <button class="action-btn small craft-ability-btn" onclick="useProp('${prop.id}')" ${ready?'':'disabled'}
            style="background:${ready?'rgba(20,184,166,0.12)':'rgba(255,255,255,0.04)'};border-color:${ready?'rgba(20,184,166,0.4)':'var(--border-subtle)'};color:${ready?'#5eead4':'var(--text-secondary)'}">
            ${cdLabel}
          </button>
        </div>`;
    }

    // Placement status — show whether the crafted prop is in inventory
    // (still waiting to be placed) or already on the field. Cooking station
    // is exempt (it's a fixed structure, not place-able).
    let placementHtml = '';
    if (built && prop.id !== 'cooking_station') {
      const placeId = `cp_${prop.id}`;
      const inInv  = (gameInstance.cosmeticInventory?.[placeId] || 0) > 0;
      const onMap  = (gameInstance.editMode?.placedCosmetics || []).some(c => c.id === placeId);
      let label, color;
      if (inInv)      { label = '🎒 In inventory · place via Edit'; color = '#b45309'; }
      else if (onMap) { label = '✓ Placed on the island'; color = '#0f766e'; }
      else            { label = '— stowed'; color = 'var(--text-secondary)'; }
      placementHtml = `<div class="craft-placement" style="font-size:11px;color:${color};margin-top:6px">${label}</div>`;
    }

    const el = document.createElement('div');
    el.className = `craft-card glass${built?' craft-built':''}`;
    el.innerHTML = `
      <div class="craft-header">
        <span class="craft-icon">${prop.icon}</span>
        <div class="craft-info">
          <div class="craft-name">${prop.name}</div>
          <div class="craft-perk">${prop.perk}</div>
        </div>
      </div>
      <div class="craft-req">${reqHtml}</div>
      <button class="action-btn small craft-btn" onclick="doCraft('${prop.id}')" ${(!canBuild||built)?'disabled':''}>
        ${built ? 'Built' : 'Build'}
      </button>
      ${placementHtml}
      ${abilityHtml}`;
    grid.appendChild(el);
  });
};

window.doCraft = (propId) => { if (!gameInstance) return; gameInstance.craftProp(propId); };
window.useProp = (propId) => { if (!gameInstance) return; if (gameInstance.useAbility(propId)) window.updateCraftUI(); };

// ==================== ACHIEVEMENT UI (split panel) ====================

let _achFilter = 'All';
let _achSelected = null;

window.updateAchievementUI = (filterCat) => {
  if (filterCat !== undefined) _achFilter = filterCat;
  if (!gameInstance) return;

  const listEl  = document.getElementById('ach-list');
  const detailEl= document.getElementById('ach-detail');
  const search  = document.getElementById('ach-search');
  const countEl = document.getElementById('ach-count-label');
  if (!listEl) return;

  const query = (search?.value || '').toLowerCase();
  const ach   = gameInstance.ach;

  // Tab bar
  const tabBar = document.getElementById('ach-tabs');
  if (tabBar) {
    const cats = ['All', ...ACH_CATEGORIES];
    tabBar.innerHTML = cats.map(c =>
      `<button class="ach-tab${_achFilter===c?' active':''}" onclick="updateAchievementUI('${c}')">${c}</button>`
    ).join('');
  }

  const filtered = ALL_ACHIEVEMENTS.filter(a => {
    if (_achFilter !== 'All' && a.cat !== _achFilter) return false;
    if (query && !a.name.toLowerCase().includes(query) && !a.desc.toLowerCase().includes(query)) return false;
    return true;
  });

  const total = filtered.length;
  const done  = filtered.filter(a => ach.u[a.id]).length;
  if (countEl) countEl.textContent = `${done}/${total}`;

  listEl.innerHTML = '';
  const sorted = [...filtered.filter(a=>ach.u[a.id]), ...filtered.filter(a=>!ach.u[a.id])];
  sorted.forEach(a => {
    const isUnlocked = !!ach.u[a.id];
    const progress   = ach.c[a.ctr] || 0;
    const pct        = a.tgt ? Math.min(100, Math.floor(progress / a.tgt * 100)) : 0;
    const el = document.createElement('div');
    el.className = 'split-row' + (_achSelected === a.id ? ' active' : '') + (isUnlocked ? '' : '');
    if (!isUnlocked) el.style.opacity = '0.6';
    el.innerHTML = `<span class="sr-icon">${isUnlocked?a.icon:'?'}</span>
      <span class="sr-info">
        <span class="sr-name">${isUnlocked?a.name:'???'}</span>
        <span class="sr-sub">${isUnlocked?'+'+a.xp+' XP':a.tgt>1?pct+'%':'Locked'}</span>
      </span>
      ${isUnlocked?'<span class="sr-badge" style="color:var(--c-amber)">Done</span>':''}`;
    el.onclick = () => {
      _achSelected = a.id;
      listEl.querySelectorAll('.split-row').forEach(r=>r.classList.remove('active'));
      el.classList.add('active');
      renderAchDetail(a, isUnlocked, progress, pct);
    };
    listEl.appendChild(el);
  });
  if (detailEl && !_achSelected) detailEl.innerHTML = '<div class="split-detail-empty">Select a feat</div>';
};

function renderAchDetail(a, isUnlocked, progress, pct) {
  const detailEl = document.getElementById('ach-detail');
  if (!detailEl) return;
  detailEl.innerHTML = `
    <div class="sd-art">${isUnlocked ? a.icon : '?'}</div>
    <div class="sd-name">${isUnlocked ? a.name : '???'}</div>
    <div class="sd-sub">${a.cat} · +${a.xp} XP</div>
    ${isUnlocked ? `<div class="sd-lore">${a.desc}</div>` : `<div class="sd-lore" style="opacity:0.5">${a.desc}</div>`}
    ${!isUnlocked && a.tgt > 1 ? `
      <div style="background:rgba(0,0,0,0.3);border-radius:6px;height:8px;overflow:hidden;margin:4px 0">
        <div style="background:var(--c-purple);width:${pct}%;height:100%;border-radius:6px"></div>
      </div>
      <div style="font-size:11px;color:var(--text-secondary);text-align:center">${progress} / ${a.tgt}</div>` : ''}
    ${isUnlocked ? '<div class="sd-pills"><span class="sd-pill" style="color:#f59e0b;border-color:#f59e0b">Completed!</span></div>' : ''}`;
}

// ==================== TUTORIAL SYSTEM ====================

window.showTutorial = () => {
  const modal = document.getElementById('modal-tutorial');
  if (modal) modal.style.display = 'flex';
};

window.closeTutorial = () => {
  const modal = document.getElementById('modal-tutorial');
  if (modal) modal.style.display = 'none';
  Game.markNotFirstTime();
  // Begin the guided walkthrough on the active profile (if not already done)
  window.startTutorialWalkthrough?.();
};

// ── Guided Day-1 Walkthrough ─────────────────────────────
// 6 step bubbles fired in sequence. Each step listens for an
// implicit completion trigger (action done) OR can be tapped to dismiss.
// Progress is persisted per profile so it never re-fires after the
// player completes step 6 (or manually skips all).

const TUTORIAL_STEPS = [
  { id:'pet_compy',   icon:'🐾', target:'compy',  msg:"Tap a Compy to play with them — they'll drop ingredients faster." },
  { id:'collect',     icon:'🍄', target:'item',   msg:"Walk over an ingredient or tap it to collect." },
  { id:'open_cook',   icon:'🍳', target:'craft',  msg:"Build a Cooking Station, then tap it to cook." },
  { id:'watch_dusk',  icon:'🌙', target:'wheel',  msg:"Night is coming — stay close to the campfire." },
  { id:'survive_nm',  icon:'⚔️', target:'world',  msg:"Compys fight nightmares automatically. You can help by tapping them." },
  { id:'open_feats',  icon:'🏆', target:'feats',  msg:"Feats give you XP. Open them to see your goals." },
];

function _getTutorialKey() { return `cmm_tutorial_${Game._getActiveProfileId()}`; }
function _getTutorialState() {
  try { return JSON.parse(localStorage.getItem(_getTutorialKey()) || '{}'); } catch { return {}; }
}
function _setTutorialState(s) {
  try { localStorage.setItem(_getTutorialKey(), JSON.stringify(s)); } catch {}
}

let _tutorialActive = false;
let _tutorialStepIdx = -1;

window.startTutorialWalkthrough = () => {
  const state = _getTutorialState();
  if (state.done) return;
  _tutorialActive = true;
  _tutorialStepIdx = state.step || 0;
  _renderTutorialBubble();
};

window.tutorialMark = (stepId) => {
  if (!_tutorialActive) return;
  const cur = TUTORIAL_STEPS[_tutorialStepIdx];
  if (!cur || cur.id !== stepId) return;
  _advanceTutorial();
};

function _advanceTutorial() {
  _tutorialStepIdx++;
  const state = _getTutorialState();
  state.step = _tutorialStepIdx;
  if (_tutorialStepIdx >= TUTORIAL_STEPS.length) {
    state.done = true;
    _tutorialActive = false;
    _setTutorialState(state);
    _hideTutorialBubble();
    return;
  }
  _setTutorialState(state);
  _renderTutorialBubble();
}

window.skipTutorial = () => {
  const state = _getTutorialState();
  state.done = true;
  _setTutorialState(state);
  _tutorialActive = false;
  _hideTutorialBubble();
};

function _hideTutorialBubble() {
  const el = document.getElementById('tutorial-bubble');
  if (el) el.remove();
}

function _renderTutorialBubble() {
  _hideTutorialBubble();
  const step = TUTORIAL_STEPS[_tutorialStepIdx];
  if (!step) return;
  const wrap = document.createElement('div');
  wrap.id = 'tutorial-bubble';
  wrap.className = 'tutorial-bubble';
  wrap.innerHTML = `
    <div class="tut-icon">${step.icon}</div>
    <div class="tut-body">
      <div class="tut-step">Step ${_tutorialStepIdx + 1} of ${TUTORIAL_STEPS.length}</div>
      <div class="tut-msg">${step.msg}</div>
      <div class="tut-actions">
        <button class="tut-btn tut-btn-next" onclick="window.tutorialMark('${step.id}')">Got it</button>
        <button class="tut-btn tut-btn-skip" onclick="window.skipTutorial()">Skip tutorial</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
}

// Counters that accumulate across runs and must survive New Game / Reincarnate
// (lifetime stats: deaths, reincarnations, total levels gained, play time, perk carries).
const _CROSS_RUN_ACH_CTRS = new Set(['deaths','reincarnations','total_levels','play_hrs','perk_carry']);

// Strip per-run achievement progress from a legacy blob in-place, keeping only cross-run
// counters and the unlocked feats earned for them (so they don't re-fire on the next run).
function _purgeLegacyAchForNewRun(legacy) {
  if (!legacy?.ach) return;
  const oldC = legacy.ach.c || {};
  const oldU = legacy.ach.u || {};
  const newC = {};
  for (const k of _CROSS_RUN_ACH_CTRS) {
    if (oldC[k] != null) newC[k] = oldC[k];
  }
  const newU = {};
  for (const id in oldU) {
    const a = ALL_ACHIEVEMENTS.find(x => x.id === +id);
    if (a && _CROSS_RUN_ACH_CTRS.has(a.ctr)) newU[id] = true;
  }
  newC['ach_count'] = Object.keys(newU).length;
  legacy.ach = { c: newC, u: newU, pt: legacy.ach.pt || 0 };
}

window.reincarnate = () => {
  if (window._deathTimerId) { clearInterval(window._deathTimerId); window._deathTimerId = null; }
  localStorage.removeItem(Game._getSaveKey());
  try {
    const key = Game._getLegacyKey();
    const legacy = JSON.parse(localStorage.getItem(key) || '{}');
    _purgeLegacyAchForNewRun(legacy);
    localStorage.setItem(key, JSON.stringify(legacy));
  } catch(e) { /* ignore */ }
  location.reload();
};

// ==================== COMPY TIER TABLE UI ====================

// Tier display meta (matches TIER_COLORS in data.js)
const TIER_META = {
  1: { name: 'Common',    color: '#a8a3b8', border: 'rgba(255,255,255,0.12)',   rule: 'From Booster Pack' },
  2: { name: 'Uncommon',  color: '#86efac', border: 'rgba(34,197,94,0.3)',     rule: '3× T1 → 1 random T2' },
  3: { name: 'Rare',      color: '#93c5fd', border: 'rgba(59,130,246,0.3)',    rule: '3× T2 → 1 random T3' },
  4: { name: 'Epic',      color: '#c4b5fd', border: 'rgba(139,92,246,0.35)',   rule: '3× T3 → 1 random T4' },
  5: { name: 'Mythic',    color: '#fcd34d', border: 'rgba(245,158,11,0.35)',   rule: '3× T4 → 1 random T5' },
  6: { name: 'Legendary', color: '#fca5a1', border: 'rgba(249,112,102,0.35)', rule: '3× T5 → 1 random T6' },
};

// Create exchange toast element (singleton)
function _getTierToast() {
  let t = document.getElementById('tier-result-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'tier-result-toast';
    t.className = 'tier-result-toast';
    t.innerHTML = `
      <div class="tier-result-icon" id="trt-icon">✨</div>
      <div class="tier-result-label">Exchanged! You got a new Compy!</div>
      <div class="tier-result-name" id="trt-name">—</div>
      <div class="tier-result-tier" id="trt-tier">—</div>
    `;
    document.body.appendChild(t);
  }
  return t;
}

function _showTierToast(compData) {
  const ti = TIER_META[compData.tier];
  const toast = _getTierToast();
  toast.querySelector('#trt-icon').textContent = compData.icon;
  toast.querySelector('#trt-name').textContent = compData.name;
  const tierEl = toast.querySelector('#trt-tier');
  tierEl.textContent = `T${compData.tier} — ${ti.name}`;
  tierEl.style.background = `${ti.border}`;
  tierEl.style.color = ti.color;
  tierEl.style.border = `1px solid ${ti.border}`;
  toast.classList.add('show');
  clearTimeout(toast._to);
  toast._to = setTimeout(() => toast.classList.remove('show'), 2800);
}

let _tierActiveTab = 'roster';

window.switchTierTab = (name) => {
  _tierActiveTab = name;
  document.querySelectorAll('#tier-tabs .tier-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === name);
  });
  const rosterPane  = document.getElementById('tier-pane-roster');
  const compendPane = document.getElementById('tier-pane-compendium');
  const glimmersPane = document.getElementById('tier-pane-glimmers');
  if (rosterPane)   rosterPane.style.display   = name === 'roster'     ? '' : 'none';
  if (compendPane)  compendPane.style.display  = name === 'compendium' ? '' : 'none';
  if (glimmersPane) glimmersPane.style.display = name === 'glimmers'   ? '' : 'none';
  if (name === 'roster')     window.renderTierRoster();
  if (name === 'compendium') window.updateTierTableUI();
  if (name === 'glimmers')   window.renderGlimmersPane();
};

// ── Glimmers pane: 6 spark rows with bond hearts, status pill, and final-bond line.
window.renderGlimmersPane = () => {
  const body = document.getElementById('tier-glimmers-body');
  if (!body || !gameInstance) return;
  const story = gameInstance.story?.children;
  body.innerHTML = '';
  for (let i = 0; i < CHILDREN.length; i++) {
    const def    = CHILDREN[i];
    const found  = !!story?.found?.[i];
    const done   = story?.tasksDone?.[i] || 0;
    const bonded = !!story?.bond?.[i];
    const hearts = Array.from({ length: 4 }, (_, k) => k < done
      ? '<span class="bond-heart bond-heart-full">❤</span>'
      : '<span class="bond-heart bond-heart-empty">♡</span>'
    ).join('');
    const status = !found  ? '<span class="bond-status bond-status-locked">Lost in the dark</span>'
                : bonded   ? '<span class="bond-status bond-status-bonded">Bonded</span>'
                : done > 0 ? '<span class="bond-status bond-status-known">Knowing again</span>'
                           : '<span class="bond-status bond-status-found">Found</span>';
    const row = document.createElement('div');
    row.className = 'glimmer-row' + (found ? '' : ' glimmer-row-locked');
    row.style.borderLeftColor = def.color;
    const titleHTML = def.name
      ? `${def.name} <span class="glimmer-row-nick">— ${def.nickname}</span><span class="glimmer-row-rel">${def.label}</span>`
      : `${def.label} <span class="glimmer-row-nick">— ${def.nickname}</span>`;
    row.innerHTML = `
      <div class="glimmer-row-icon" style="color:${def.color}">${def.icon}</div>
      <div class="glimmer-row-main">
        <div class="glimmer-row-title">${titleHTML}</div>
        <div class="glimmer-row-bond">${hearts}<span class="bond-count">${done}/4</span> ${status}</div>
        ${bonded ? `<div class="glimmer-row-quote">${def.bondLine}</div>` : ''}
      </div>`;
    body.appendChild(row);
  }
};

// Tab 1: Roster — owned compys only, grouped by tier, inline Activate + Convert actions.
window.renderTierRoster = () => {
  if (!gameInstance) return;
  const body = document.getElementById('tier-roster-body');
  if (!body) return;
  body.innerHTML = '';

  const inv = gameInstance.companionInventory;
  const totalOwned = Object.values(inv).reduce((s, v) => s + v, 0);
  const deployed   = gameInstance.companions.length;
  const maxDeploy  = gameInstance.getMaxDeployedCompanions();
  const label = document.getElementById('tier-owned-label');
  if (label) label.innerHTML =
    `<span style="color:#34d399;margin-right:10px">● ${deployed}/${maxDeploy} active</span>` +
    `<span style="color:var(--c-amber)">${totalOwned} owned</span>`;

  if (totalOwned === 0) {
    body.innerHTML = `<div class="tier-roster-empty">No Compys yet — open a Booster Pack from the Merchant to get started.</div>`;
    return;
  }

  const COMPANIONS_MOD = window._gameCompanions || [];
  const PERK_RATE = [0, 0.01, 0.02, 0.03, 0.04, 0.05, 0.1];
  const gold = gameInstance.gold || 0;

  for (let tier = 1; tier <= 6; tier++) {
    const owned = COMPANIONS_MOD.filter(c => c.tier === tier && (inv[c.id] || 0) > 0);
    if (!owned.length) continue;
    const ti = TIER_META[tier];

    const section = document.createElement('div');
    section.className = 'tier-roster-section';
    section.innerHTML = `
      <div class="tier-section-header">
        <span class="tier-section-badge" style="color:${ti.color};border-color:${ti.border};background:${ti.border}22">T${tier}</span>
        <span class="tier-section-title" style="color:${ti.color}">${ti.name}</span>
      </div>`;

    for (const cd of owned) {
      const count        = inv[cd.id] || 0;
      const pctPerCopy   = PERK_RATE[cd.tier] || 0.01;
      const multiplier   = count * pctPerCopy;
      const isActive     = gameInstance.companions.some(c => (c.type || c.id) === cd.id);
      const canDeployNew = !isActive && gameInstance.companions.length < maxDeploy;
      const hasCopies    = count >= 3 && cd.tier < 6;
      const hasGold      = gold >= 10;
      const canConvert   = hasCopies && hasGold;
      const convertText  = !hasCopies ? `Need 3× (${count}/3)`
                         : !hasGold   ? 'Need 10g'
                         :              'Convert 3× + 10g';
      const role = cd.role || 'attacker';
      const rm   = ROLE_META[role] || ROLE_META.attacker;
      const iconHTML = cd.art
        ? `<img src="${cd.art}" alt="${cd.name}" style="width:44px;height:44px;object-fit:contain;display:block">`
        : `<span style="font-size:30px">${cd.icon}</span>`;

      const row = document.createElement('div');
      row.className = 'tier-roster-row' + (isActive ? ' active' : '');
      row.style.borderColor = isActive ? 'rgba(52,211,153,0.45)' : ti.border;
      row.innerHTML = `
        <div class="tr-icon" style="background:${ti.border}18;border-color:${ti.border}">
          ${iconHTML}
          ${isActive ? '<span class="tr-active-dot">●</span>' : ''}
        </div>
        <div class="tr-main">
          <div class="tr-top">
            <span class="tr-name" style="color:${ti.color}">${cd.name}</span>
            <span class="role-badge" style="background:${rm.color}22;color:${rm.color};border:1px solid ${rm.color}55">${rm.icon} ${rm.label}</span>
            ${isActive ? '<span class="tr-active-pill">● Active</span>' : ''}
          </div>
          ${cd.perk ? `<div class="tr-perk">${cd.perk.desc}</div>` : ''}
          <div class="tr-stats">
            <span class="tr-stat-copies" style="color:${ti.color}">×${count}</span>
            ${cd.perk ? `<span class="tr-stat-boost" style="color:${ti.color}">+${multiplier.toFixed(2)}%</span>` : ''}
          </div>
        </div>
        <div class="tr-actions">
          ${isActive
            ? `<button class="tr-btn tr-btn-recall" onclick="undeployCompanion('${cd.id}')">Recall</button>`
            : `<button class="tr-btn tr-btn-deploy" onclick="deployCompanion('${cd.id}')" ${canDeployNew ? '' : 'disabled'}>${canDeployNew ? 'Activate' : (gameInstance.companions.length >= maxDeploy ? 'Roster full' : 'Activate')}</button>`}
          ${cd.tier < 6
            ? `<button class="tr-btn tr-btn-convert" onclick="convertCompanion('${cd.id}')" ${canConvert ? '' : 'disabled'}>${convertText}${canConvert ? ` → T${cd.tier + 1}` : ''}</button>`
            : '<button class="tr-btn tr-btn-convert" disabled>Max Tier</button>'}
        </div>`;
      section.appendChild(row);
    }
    body.appendChild(section);
  }
};

window.updateTierTableUI = () => {
  if (!gameInstance) return;
  // Always refresh the Roster tab too, so activate/recall/convert actions
  // from either tab stay in sync.
  window.renderTierRoster();

  const grid = document.getElementById('tier-compendium-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const inv = gameInstance.companionInventory;
  const totalOwned = Object.values(inv).reduce((s, v) => s + v, 0);
  const deployed = gameInstance.companions.length;
  const maxDeploy = gameInstance.getMaxDeployedCompanions();
  const label = document.getElementById('tier-owned-label');
  if (label) label.innerHTML =
    `<span style="color:#34d399;margin-right:10px">● ${deployed}/${maxDeploy} active</span>` +
    `<span style="color:var(--c-amber)">${totalOwned} owned</span>`;

  const COMPANIONS_MOD = window._gameCompanions || [];
  const PERK_RATE = [0, 0.01, 0.02, 0.03, 0.04, 0.05, 0.1];
  const esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  // Render as flat grid ordered by tier (T1 first, descending inside tier matches data order)
  const ordered = [...COMPANIONS_MOD].sort((a, b) => a.tier - b.tier);

  for (const cd of ordered) {
    const ti = TIER_COLORS[cd.tier];
    const count = inv[cd.id] || 0;
    const isOwned = count > 0;
    const isActive = isOwned && gameInstance.companions.some(c => (c.type || c.id) === cd.id);
    const pctPerCopy = PERK_RATE[cd.tier] || 0.01;
    const perkBoostPct = count * pctPerCopy;
    const role = cd.role || 'attacker';
    const rm   = ROLE_META[role] || ROLE_META.attacker;
    const dropItem = getItemData(cd.drop);

    const card = document.createElement('div');
    card.className = `compy-card ${isOwned ? 'compy-card-owned' : 'compy-card-locked'}${isActive ? ' compy-card-active' : ''}`;
    card.style.setProperty('--card-tier-color',  ti.color);
    card.style.setProperty('--card-tier-border', ti.border);
    card.style.setProperty('--card-tier-bg',     ti.bg);
    card.style.setProperty('--card-role-color',  rm.color);

    if (!isOwned) {
      card.innerHTML = `
        <div class="cc-frame">
          <div class="cc-header">
            <span class="cc-name">???</span>
            <span class="cc-tier-badge">T${cd.tier}</span>
          </div>
          <div class="cc-art">
            <div class="cc-silhouette">?</div>
          </div>
          <div class="cc-type">— Undiscovered —</div>
          <div class="cc-rules">
            <div class="cc-rules-unknown">${cd.tier === 1
              ? 'Found in Booster Packs at the Merchant.'
              : `Obtained by converting 3× T${cd.tier - 1} Compys + 10g.`}</div>
          </div>
          <div class="cc-footer">
            <span class="cc-footer-tier" style="color:${ti.color}">${TIER_META[cd.tier]?.name || ''}</span>
          </div>
        </div>`;
    } else {
      const artHTML = cd.art
        ? `<img src="${cd.art}" alt="${esc(cd.name)}" class="cc-art-img">`
        : `<div class="cc-art-icon">${cd.icon}</div>`;

      // Extra facts — shown as small chips on healer / junk cleaner cards
      const traits = [];
      if (cd.role === 'healer' && cd.healAmount) traits.push(`<span class="cc-trait" style="color:#f472b6">🩹 Heals ${cd.healAmount} HP · ${cd.healCooldown || 7}s</span>`);
      if (cd.junkCleaner)                        traits.push(`<span class="cc-trait" style="color:#a7f3d0">🧹 Cleans junk</span>`);

      card.innerHTML = `
        <div class="cc-frame">
          ${isActive ? '<div class="cc-active-flag">● Active</div>' : ''}
          <div class="cc-header">
            <span class="cc-name" title="${esc(cd.name)}">${esc(cd.name)}</span>
            <span class="cc-tier-badge">T${cd.tier}</span>
          </div>
          <div class="cc-art">${artHTML}</div>
          <div class="cc-type">
            <span class="cc-role-icon" style="color:${rm.color}">${rm.icon}</span>
            <span>${rm.label}${cd.animal ? ` · ${cd.animal}` : ''}</span>
          </div>
          <div class="cc-rules">
            ${cd.perk ? `<div class="cc-perk"><strong>✨</strong> ${esc(cd.perk.desc)}</div>` : ''}
            ${traits.length ? `<div class="cc-traits">${traits.join('')}</div>` : ''}
            ${cd.desc ? `<div class="cc-flavor">"${esc(cd.desc)}"</div>` : ''}
          </div>
          <div class="cc-footer">
            <span class="cc-drop" title="Drop" style="color:${dropItem.color || '#a78bfa'}">${dropItem.icon} ${esc(cd.drop)}</span>
            <span class="cc-pt" title="Copies · Perk boost">×${count}${cd.perk ? ` · +${perkBoostPct.toFixed(2)}%` : ''}</span>
          </div>
        </div>`;
    }
    grid.appendChild(card);
  }
};

// Exchange 3 copies of same Compy → 1 random next-tier Compy
window.tierExchange = (companionId) => {
  if (!gameInstance) return;
  const COMPANIONS_MOD = window._gameCompanions || [];
  const currentComp = COMPANIONS_MOD.find(c => c.id === companionId);
  if (!currentComp) return;
  const count = gameInstance.companionInventory[companionId] || 0;
  if (count < 3 || currentComp.tier >= 6) return;

  // Deduct 3 copies
  gameInstance.companionInventory[companionId] -= 3;
  if (gameInstance.companionInventory[companionId] <= 0) {
    delete gameInstance.companionInventory[companionId];
  }

  // If player had 3 deployed copies, undeploy excess
  const deployedCount = gameInstance.companions.filter(c => (c.type || c.id) === companionId).length;
  const remaining = gameInstance.companionInventory[companionId] || 0;
  if (deployedCount > remaining) {
    const toRemove = deployedCount - remaining;
    for (let i = 0; i < toRemove; i++) {
      const idx = gameInstance.companions.findIndex(c => (c.type || c.id) === companionId);
      if (idx >= 0) gameInstance.companions.splice(idx, 1);
    }
    gameInstance.recalculatePerks();
  }

  // Pick random next-tier Compy
  const nextTierComps = COMPANIONS_MOD.filter(c => c.tier === currentComp.tier + 1);
  if (!nextTierComps.length) return;
  const newComp = nextTierComps[Math.floor(Math.random() * nextTierComps.length)];
  gameInstance.companionInventory[newComp.id] = (gameInstance.companionInventory[newComp.id] || 0) + 1;
  gameInstance.collectedCompanionIds.add(newComp.id);

  // Achievement counters
  gameInstance.ach.inc('conv_total');
  gameInstance.ach.set('comp_unique', Object.keys(gameInstance.companionInventory).length);
  // Tier-specific achievement
  const tierStatMap = { 2:'has_t2', 3:'has_t3', 4:'has_t4', 5:'has_t5', 6:'has_t6' };
  if (tierStatMap[newComp.tier]) gameInstance.ach.inc(tierStatMap[newComp.tier]);

  gameInstance.player.showEmote('🎉', 2.5);
  gameInstance.saveGame();

  // Show toast and refresh UI
  _showTierToast(newComp);
  window.updateTierTableUI();
};

// ==================== START MENU + GAME BOOT ====================

window.onload = () => {
  Game._initProfiles();
  // Preload companion sprite art BEFORE Game instantiates so artImg is attached
  // when the starting companion is constructed. Render paths check
  // `.complete && .naturalWidth > 0` so it's safe if the image hasn't decoded yet.
  for (const cd of COMPANIONS) {
    if (!cd.art || cd.artImg) continue;
    const img = new Image();
    img.src = cd.art;
    cd.artImg = img;
  }

  gameInstance = new Game();
  // Use the merged defs (role + lore from COMPANION_ROLES folded in) so UIs
  // reading _gameCompanions see each companion's actual role, not the default.
  window._gameCompanions = COMPANIONS.map(c => getCompanionById(c.id) || c);

  // Active-tasks HUD: refresh every 500ms once the game is up. Cheap loop
  // — just reads counters and rebuilds a small DOM list.
  setInterval(() => window.updateActiveTasksHUD?.(), 500);

  const origCloseMenu = window.closeMenu;
  window.closeMenu = (menuId) => {
    origCloseMenu(menuId);
  };

  const origOpenMenu = window.openMenu;
  window.openMenu = (menuId) => {
    if (menuId === 'cook' && gameInstance) {
      const p = gameInstance.player;
      const threatNearby = gameInstance.nightmares?.some(
        n => !n.isDead && Math.hypot(n.x - p.x, n.y - p.y) < 5
      );
      if (threatNearby) {
        gameInstance._achNotif = { icon: '🔥', label: 'CANNOT COOK', name: 'Nightmares are nearby!', sub: 'Defeat them before cooking', timer: 3.5, maxTimer: 3.5 };
        gameInstance._pendingModal = null;
        return;
      }
    }
    origOpenMenu(menuId);
    if (menuId === 'perks')    window.updateActivePerksUI();
    if (menuId === 'merchant') window.updateMerchantUI();
    if (menuId === 'craft')    window.updateCraftUI();
    if (menuId === 'ach')      window.updateAchievementUI();
    if (menuId === 'tiers')    { window.switchTierTab('roster'); window.updateTierTableUI(); }
    if (menuId === 'cook')     window.updateCookUI(gameInstance?.player?.inventory);
  };

  window._showStartMenu();
};

// ==================== PASSPORT UI ====================

let _passportPic = 0;
let _passportTrait = DEFAULT_PLAYER_TRAIT;

// Modals that should auto-fit between the top HUD and bottom button bar
const _HUD_FIT_MODAL_IDS = new Set([
  'modal-passport', 'modal-inv', 'modal-craft', 'modal-tiers',
  'modal-ach', 'modal-merchant', 'modal-cook'
]);

// "Solo" modals — only one of these may be visible at a time.
// Opening one auto-closes the rest. Excluded: modal-death (critical), modal-tutorial (intro flow).
const _SOLO_MODAL_IDS = new Set([
  'modal-passport', 'modal-inv', 'modal-craft', 'modal-tiers',
  'modal-ach', 'modal-merchant', 'modal-cook',
  'modal-perks', 'modal-struct', 'modal-settings'
]);

function _closeOtherSoloModals(exceptId) {
  for (const id of _SOLO_MODAL_IDS) {
    if (id === exceptId) continue;
    const m = document.getElementById(id);
    if (!m || m.style.display === 'none' || m.style.display === '') continue;
    m.style.display = 'none';
    _detachHudFit(m);
  }
}
const _activeHudFitModals = new Set();

function _updateHudFitInsets() {
  if (_activeHudFitModals.size === 0) return;
  const gap = 8;
  const hudTop = document.getElementById('hud-top');
  const hudBottom = document.getElementById('hud-bottom');
  const topPx = hudTop ? hudTop.getBoundingClientRect().bottom + gap : gap;
  const bottomRect = hudBottom ? hudBottom.getBoundingClientRect() : null;
  const bottomPx = bottomRect ? (window.innerHeight - bottomRect.top + gap) : gap;
  for (const m of _activeHudFitModals) {
    m.style.setProperty('--modal-top-inset', topPx + 'px');
    m.style.setProperty('--modal-bottom-inset', bottomPx + 'px');
  }
}

function _attachHudFit(modal) {
  if (!modal) return;
  const firstOpen = _activeHudFitModals.size === 0;
  _activeHudFitModals.add(modal);
  _updateHudFitInsets();
  if (firstOpen) window.addEventListener('resize', _updateHudFitInsets);
}

function _detachHudFit(modal) {
  if (!modal) return;
  _activeHudFitModals.delete(modal);
  if (_activeHudFitModals.size === 0) {
    window.removeEventListener('resize', _updateHudFitInsets);
  }
}

window.openPassport = () => {
  const modal = document.getElementById('modal-passport');
  if (!modal) return;
  const profileId = Game._getActiveProfileId();
  const profiles  = Game._getProfiles();
  const profile   = profiles.find(p => p.id === profileId);
  _passportPic = profile?.pic ?? 0;
  _passportTrait = (profile?.trait && PLAYER_TRAITS[profile.trait]) ? profile.trait : DEFAULT_PLAYER_TRAIT;
  const nameInput = document.getElementById('passport-name');
  if (nameInput) nameInput.value = profile?.name || 'Player';
  _renderPassportGrid(_passportPic);
  _renderPassportBig(_passportPic);
  _renderPassportTraitGrid(_passportTrait);
  // Reset to Profile tab + refresh Memories counter every time passport opens.
  window.switchPassportTab?.('profile');
  window.renderMemoriesGrid?.();
  _closeOtherSoloModals(modal.id);
  modal.style.display = 'flex';
  _attachHudFit(modal);
};

function _renderPassportTraitGrid(sel) {
  const chips = document.getElementById('passport-trait-chips');
  const header = document.getElementById('passport-trait-current');
  const desc   = document.getElementById('passport-trait-desc');
  if (!chips) return;

  const paintSelection = (traitName) => {
    const def = PLAYER_TRAITS[traitName];
    if (!def) return;
    if (header) header.innerHTML = `<span style="font-size:14px">${def.icon}</span>${traitName}`;
    if (desc)   desc.textContent = def.desc;
    chips.querySelectorAll('.passport-trait-chip').forEach((el, i) => {
      el.classList.toggle('ptc-selected', PLAYER_TRAIT_LIST[i] === traitName);
    });
  };

  chips.innerHTML = '';
  PLAYER_TRAIT_LIST.forEach(name => {
    const def = PLAYER_TRAITS[name];
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'passport-trait-chip' + (name === sel ? ' ptc-selected' : '');
    chip.title = `${name} — ${def.short}`;
    chip.innerHTML = `<span class="ptc-icon" style="color:${def.color}">${def.icon}</span>
                      <span class="ptc-name">${name}</span>`;
    chip.onclick = () => {
      _passportTrait = name;
      paintSelection(name);
      // Scroll the chip into view if it's off-screen in a narrow viewport
      chip.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    };
    chips.appendChild(chip);
  });

  paintSelection(sel || DEFAULT_PLAYER_TRAIT);
}

window.closePassport = () => {
  const modal = document.getElementById('modal-passport');
  if (modal) modal.style.display = 'none';
  _detachHudFit(modal);
};

// ── Child NPC dialog (Phase 2): tap a present child to open task panel ─
window.openChildDialog = (childIdx) => {
  if (!gameInstance?.children) return;
  const child = gameInstance.children.list[childIdx];
  if (!child || child.phase !== 'PRESENT') return;
  const def    = child.def;
  const story  = gameInstance.story?.children;
  const slotsDone = story?.tasksDone?.[childIdx] || 0;

  // Portrait painter — child renders just its head/face into the dialog canvas.
  const portrait = (ctx, size) => child.drawPortrait?.(ctx, size);

  // Bonded — show the final bond line on tap, no progress.
  if (slotsDone >= 4) {
    const head = def.name ? `${def.name} — ${def.nickname}` : `${def.label} — ${def.nickname}`;
    window.StoryPanel?.show({
      kind: 'dialog',
      icon: child.icon,
      portrait,
      title: head,
      lines: [def.bondLine],
      voiceSeed: childIdx,
    });
    return;
  }

  // Pending — task condition met, awaiting confirmation. Show a one-button
  // dialog with the Glimmer's completionLine and a big Complete ✓ button.
  // Pressing it dismisses this dialog and queues the story-reveal panel.
  if (child.pendingTask) {
    const pTask = child.pendingTask;
    window.StoryPanel?.show({
      kind: 'dialog',
      icon: child.icon,
      portrait,
      title: `${def.name || def.label} — Task ${pTask.slot}/4 ✓`,
      lines: [pTask.completionLine],
      requirement: pTask.name,
      voiceSeed: childIdx,
      confirmButton: {
        label: `Complete · +${pTask.slot * 25} XP`,
        onClick: () => gameInstance.children.confirmPendingTask(childIdx),
      },
    });
    return;
  }

  const task = activeTaskFor(childIdx, slotsDone);
  if (!task) return;

  // Build the progress payload (rendered as a bar at the bottom of the dialog).
  // All tasks now poll an achievement counter (task.counter / task.target);
  // composite tasks store their progress in _childTaskProgress.
  let progress = null;
  if (task.progress?.type === 'count') {
    const total = task.progress.total;
    const cur = task.counter ? Math.min(total, gameInstance.ach?.c?.[task.counter] || 0) : 0;
    progress = { pct: Math.min(100, (cur / total) * 100), label: `${cur} / ${total}` };
  } else if (task.progress?.type === 'pct') {
    const stored = gameInstance._childTaskProgress?.[task.id]
                ?? (task.counter ? Math.min(1, (gameInstance.ach?.c?.[task.counter] || 0) / task.target) : 0);
    progress = { pct: Math.round(stored * 100), label: `${Math.round(stored * 100)}%` };
  } else if (task.progress?.type === 'flag') {
    const done = task.counter ? (gameInstance.ach?.c?.[task.counter] || 0) >= task.target : false;
    progress = { pct: done ? 100 : 0, label: done ? 'Done!' : 'Pending' };
  }

  window.StoryPanel?.show({
    kind: 'dialog',
    icon: child.icon,
    portrait,
    title: `${def.name || def.label} — Task ${task.slot}/4`,
    lines: task.dialogue,
    requirement: task.requirement,
    progress,
    voiceSeed: childIdx,
  });
};

// ── Passport tabs (Phase 1.4): Profile / Memories ✦ ─────────────────────
window.switchPassportTab = (tab) => {
  const profileBtn  = document.querySelector('.passport-tab[data-tab="profile"]');
  const memoriesBtn = document.querySelector('.passport-tab[data-tab="memories"]');
  const profilePane  = document.getElementById('passport-pane-profile');
  const memoriesPane = document.getElementById('passport-pane-memories');
  if (!profilePane || !memoriesPane) return;
  const goMemories = (tab === 'memories');
  profilePane.style.display  = goMemories ? 'none'  : '';
  memoriesPane.style.display = goMemories ? ''      : 'none';
  if (profileBtn)  profileBtn.classList.toggle('active', !goMemories);
  if (memoriesBtn) memoriesBtn.classList.toggle('active', goMemories);
  if (goMemories) window.renderMemoriesGrid?.();
};

// Render the broken-mirror grid of 10 shards using real data from data/shards.js.
// Locked tiles are dim with no text; unlocked tiles glow gold and re-read full text on tap.
// At 10/10 the grid plays a brief assembly animation (handled by CSS keyframes).
window.renderMemoriesGrid = () => {
  const grid = document.getElementById('memories-grid');
  if (!grid || !gameInstance) return;
  const shards = gameInstance.legacyStory?.shards || [];
  let unlockedCount = 0;
  grid.innerHTML = '';
  for (let i = 0; i < SHARDS.length; i++) {
    const data     = SHARDS[i];
    const unlocked = !!shards[i];
    if (unlocked) unlockedCount++;
    const tile = document.createElement('div');
    tile.className = 'memory-shard ' + (unlocked ? 'unlocked' : 'locked');
    tile.dataset.shardIdx = String(i);
    tile.innerHTML = `
      <div class="memory-shard-icon">${unlocked ? data.icon : '◇'}</div>
      <div class="memory-shard-num">SHARD ${data.num}</div>
      <div class="memory-shard-title">${unlocked ? data.title : '— locked —'}</div>
    `;
    if (unlocked) {
      tile.addEventListener('click', () => {
        const s = getShardForReread(i);
        if (!s) return;
        window.StoryPanel?.show({
          kind:       'shard',
          icon:       s.icon,
          kicker:     `Shard ${s.num}`,
          title:      s.title,
          lines:      s.lines,
          typewriter: 18,    // re-read is a touch faster
          lockUntil:  1500,  // shorter lock since they've seen it before
        });
      });
    }
    grid.appendChild(tile);
  }
  const num = document.getElementById('memories-progress-num');
  const cnt = document.getElementById('passport-mem-count');
  if (num) num.textContent = String(unlockedCount);
  if (cnt) cnt.textContent = `${unlockedCount}/10`;

  // 10/10 assembly: golden glow ring + brief shimmer over the whole grid.
  if (unlockedCount === 10) {
    grid.classList.add('memories-grid-complete');
  } else {
    grid.classList.remove('memories-grid-complete');
  }
};

function _renderPassportGrid(sel) {
  const grid = document.getElementById('passport-avatar-grid');
  if (!grid) return;
  grid.innerHTML = '';
  AVATAR_DEFS.forEach((def, idx) => {
    const wrap = document.createElement('div');
    wrap.className = 'passport-thumb' + (idx === sel ? ' pp-selected' : '');
    wrap.title = def.name;
    wrap.onclick = () => {
      _passportPic = idx;
      grid.querySelectorAll('.passport-thumb').forEach((el, i) => {
        el.classList.toggle('pp-selected', i === idx);
      });
      _renderPassportBig(idx);
    };
    const cv = document.createElement('canvas');
    cv.width = cv.height = 56;
    drawPassportAvatar(cv.getContext('2d'), idx, 56);
    wrap.appendChild(cv);
    const lbl = document.createElement('div');
    lbl.className = 'passport-thumb-name';
    lbl.textContent = def.name;
    wrap.appendChild(lbl);
    grid.appendChild(wrap);
  });
}

function _renderPassportBig(idx) {
  const cv = document.getElementById('passport-avatar-big');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  drawPassportAvatar(ctx, idx, 120);
  const lbl = document.getElementById('passport-avatar-label');
  if (lbl) lbl.textContent = AVATAR_DEFS[idx]?.name || '';
}

window._savePassport = () => {
  const nameInput = document.getElementById('passport-name');
  const name = (nameInput?.value || '').trim().replace(/[<>]/g, '').slice(0, 16) || 'Player';
  nameInput.value = name;
  const profileId = Game._getActiveProfileId();
  const profiles  = Game._getProfiles();
  const profile   = profiles.find(p => p.id === profileId);
  if (profile) {
    profile.name = name;
    profile.pic  = _passportPic;
    profile.trait = _passportTrait;
    localStorage.setItem('cmm_profiles', JSON.stringify(profiles));
    _applyAvatarColors(_passportPic);
    // Sync trait to live player + fire its first-pick feat
    if (gameInstance?.player) {
      gameInstance.player.personality = _passportTrait;
      const featCounter = PLAYER_TRAITS[_passportTrait]?.feat;
      if (featCounter && gameInstance.ach) gameInstance.ach.set(featCounter, 1);
    }
  }
  const btn = document.getElementById('passport-save-btn');
  if (btn) {
    const orig = btn.textContent;
    btn.textContent = '✓ Saved!';
    btn.style.borderColor = 'rgba(52,211,153,0.6)';
    btn.style.background  = 'rgba(52,211,153,0.15)';
    btn.style.color       = '#34d399';
    setTimeout(() => {
      btn.textContent     = orig;
      btn.style.borderColor = '';
      btn.style.background  = '';
      btn.style.color       = '';
    }, 1400);
  }
};

window._passportExitMenu = () => {
  if (gameInstance) {
    gameInstance.saveGame();
    gameInstance._stopAmbient?.();
    gameInstance.stop?.();
  }
  window.closePassport();
  window._showStartMenu();
};

window._showStartMenu = () => {
  const menu      = document.getElementById('start-menu');
  menu.style.display = 'flex';
  // Hide profile panel when returning to main start screen
  document.getElementById('profile-panel').style.display = 'none';

  const profileId = Game._getActiveProfileId();
  const profiles  = Game._getProfiles();
  const profile   = profiles.find(p => p.id === profileId);
  const summary   = Game._getProfileSaveSummary(profileId);
  const summaryEl = document.getElementById('start-save-summary');
  const contBtn   = document.getElementById('btn-continue');

  if (summary) {
    summaryEl.innerHTML = `<strong>${profile?.name || 'Player'}</strong> &nbsp;·&nbsp; Day ${summary.day} &nbsp;·&nbsp; Lv.${summary.level} &nbsp;·&nbsp; 💰 ${summary.gold}g`;
    contBtn.style.display = 'block';
  } else {
    summaryEl.innerHTML = `<strong>${profile?.name || 'Player'}</strong> &nbsp;·&nbsp; No save data`;
    contBtn.style.display = 'none';
  }

  const reinBtn = document.getElementById('btn-reincarnate-start');
  if (reinBtn) {
    const legacy = JSON.parse(localStorage.getItem(Game._getLegacyKey()) || '{}');
    reinBtn.style.display = ((legacy.runCount > 0) && !summary) ? 'block' : 'none';
  }
};

window._startContinue = () => {
  document.getElementById('start-menu').style.display = 'none';
  const loaded = gameInstance.loadGame();
  if (!loaded) gameInstance._loadLegacy();
  const _ap = JSON.parse(localStorage.getItem('cmm_profiles') || '[]').find(p => p.id === Game._getActiveProfileId());
  _applyAvatarColors(_ap?.pic ?? 0);
  gameInstance.start();
  setTimeout(() => { window.updatePerkHUD?.(); gameInstance._startAmbientDay(); }, 400);
  // Resume guided tutorial if the player left mid-walkthrough
  setTimeout(() => window.startTutorialWalkthrough?.(), 800);
};

// ════════════════════════════════════════════════════════════════════
// INTRO SEQUENCE — runs BEFORE _startNewGameCore() on every New Game.
// On the very first run, asks the player two questions and walks them
// through profile setup. On every run, presents three random T1 Compies
// to choose from; the chosen one is granted right after the world loads.
// Returns Promise<{ pickedCompyId }>.
// ════════════════════════════════════════════════════════════════════
function _runIntroSequence() {
  return new Promise((resolve) => {
    const overlay = document.getElementById('intro-overlay');
    const fade    = document.getElementById('intro-fade');
    const fireCv  = document.getElementById('intro-fire');
    const bubble  = document.getElementById('intro-bubble');
    const bubText = document.getElementById('intro-bubble-text');
    const bubBtns = document.getElementById('intro-bubble-actions');
    const profilePanel = document.getElementById('intro-profile');
    const compyPanel   = document.getElementById('intro-compies');
    if (!overlay) { resolve({ pickedCompyId: null }); return; }

    overlay.style.display = 'flex';
    fade.classList.remove('show');
    profilePanel.style.display = 'none';
    profilePanel.classList.remove('show');
    compyPanel.style.display = 'none';
    compyPanel.classList.remove('show');
    bubble.classList.remove('show', 'done');
    bubText.textContent = '';
    bubBtns.innerHTML = '';

    // Animated campfire art — a cool, blue, lifelike flame. Built from many
    // softly-blurred flame layers (each with its own sway/flicker curve so
    // the silhouette breathes asymmetrically), glowing cyan embers under
    // the logs, and rising spark motes. Uses 'lighter' composite for the
    // flame layers so overlap reads as luminous rather than chalky.
    const fctx = fireCv.getContext('2d');
    let firePhase = 0;
    let fireRAF = 0;
    // Per-spark state — initialised once so motes have stable, varied paths.
    const sparks = Array.from({ length: 14 }, (_, i) => ({
      seed: i * 0.83,
      lifeOffset: Math.random(),
      side: Math.random() < 0.5 ? -1 : 1,
    }));
    function drawIntroFire() {
      firePhase += 0.05;
      const w = fireCv.width, h = fireCv.height;
      fctx.clearRect(0, 0, w, h);
      const cx = w / 2;
      const baseY = h * 0.80;

      // ── Logs ──────────────────────────────────────────────────────
      fctx.save();
      fctx.translate(cx, baseY);
      // Charred outer
      fctx.fillStyle = '#1a0e1f';
      fctx.beginPath(); fctx.ellipse(-24, 8, 32, 8, -0.3, 0, Math.PI * 2); fctx.fill();
      fctx.beginPath(); fctx.ellipse( 24, 8, 32, 8,  0.3, 0, Math.PI * 2); fctx.fill();
      // Wood
      fctx.fillStyle = '#3a2f5c';
      fctx.beginPath(); fctx.ellipse(-24, 6, 30, 7, -0.3, 0, Math.PI * 2); fctx.fill();
      fctx.beginPath(); fctx.ellipse( 24, 6, 30, 7,  0.3, 0, Math.PI * 2); fctx.fill();
      // Wood highlight
      fctx.fillStyle = '#5a4f8c';
      fctx.beginPath(); fctx.ellipse(-24, 4, 28, 5, -0.3, 0, Math.PI * 2); fctx.fill();
      fctx.beginPath(); fctx.ellipse( 24, 4, 28, 5,  0.3, 0, Math.PI * 2); fctx.fill();

      // ── Cyan ember bed under the logs ────────────────────────────
      const bedPulse = 0.85 + 0.15 * Math.sin(firePhase * 1.6);
      const bedGrd = fctx.createRadialGradient(0, 4, 2, 0, 4, 36 * bedPulse);
      bedGrd.addColorStop(0,    `rgba(180, 240, 255, ${0.85 * bedPulse})`);
      bedGrd.addColorStop(0.45, `rgba( 90, 180, 255, ${0.55 * bedPulse})`);
      bedGrd.addColorStop(1,    'rgba(40, 60, 200, 0)');
      fctx.fillStyle = bedGrd;
      fctx.beginPath(); fctx.ellipse(0, 4, 44 * bedPulse, 12 * bedPulse, 0, 0, Math.PI * 2); fctx.fill();
      fctx.restore();

      // ── Flame body — multiple layered tongues that breathe independently.
      // Each layer has its own width/height base, sway, flicker speed and
      // colour. We draw bottom→top of stack with 'lighter' blending so
      // overlapping regions become brighter, giving a glowing core feel.
      const layers = [
        // Wide outer aura — deep indigo halo, slow + soft
        { col1: 'rgba( 50,  90, 200, 0.00)', col2: 'rgba( 70, 130, 230, 0.42)', col3: 'rgba(120, 180, 255, 0.20)',
          w: 56, h: 130, off: -2, speed: 0.7, sway: 1.2, swayAmp: 4, phase: 0.0, flickerAmp: 6 },
        // Mid blue tongue
        { col1: 'rgba( 40, 130, 240, 0.00)', col2: 'rgba( 90, 170, 255, 0.65)', col3: 'rgba(170, 215, 255, 0.45)',
          w: 40, h: 112, off:  2, speed: 1.1, sway: 1.6, swayAmp: 3, phase: 1.3, flickerAmp: 8 },
        // Inner cyan tongue
        { col1: 'rgba( 90, 200, 255, 0.00)', col2: 'rgba(160, 230, 255, 0.85)', col3: 'rgba(220, 245, 255, 0.70)',
          w: 28, h:  92, off:  6, speed: 1.5, sway: 2.1, swayAmp: 2, phase: 2.5, flickerAmp: 9 },
        // Pale icy core
        { col1: 'rgba(200, 240, 255, 0.00)', col2: 'rgba(230, 250, 255, 0.95)', col3: 'rgba(255, 255, 255, 0.95)',
          w: 16, h:  64, off: 10, speed: 2.1, sway: 2.7, swayAmp: 1, phase: 4.1, flickerAmp: 7 },
      ];

      fctx.save();
      fctx.globalCompositeOperation = 'lighter';
      for (const l of layers) {
        // Two desynced sines feed flicker height so it never hits a clean cycle.
        const f1 = Math.sin(firePhase * l.speed + l.phase);
        const f2 = Math.sin(firePhase * l.speed * 1.7 + l.phase * 0.6);
        const flick = (f1 * 0.6 + f2 * 0.4) * 0.5 + 0.5; // 0..1
        const flameH = l.h + flick * l.flickerAmp;
        const flameW = l.w + flick * 3;
        const sway = Math.sin(firePhase * l.sway + l.phase) * l.swayAmp;
        const tipX = cx + sway;
        const baseTopY = baseY - l.off;
        const tipY = baseTopY - flameH;

        // Build a vertical gradient for this tongue.
        const grd = fctx.createLinearGradient(cx, baseTopY, cx, tipY);
        grd.addColorStop(0,    l.col1);
        grd.addColorStop(0.55, l.col2);
        grd.addColorStop(1,    l.col3);
        fctx.fillStyle = grd;

        // Asymmetric flame shape — left/right control points pulled by sway
        // so the silhouette wobbles like a real fire.
        const halfW = flameW / 2;
        const cpL_x = cx - halfW * 0.55 + sway * 0.4;
        const cpR_x = cx + halfW * 0.55 + sway * 0.4;
        const cpL_y = baseTopY - flameH * (0.42 + 0.05 * Math.sin(firePhase + l.phase));
        const cpR_y = baseTopY - flameH * (0.42 + 0.05 * Math.cos(firePhase + l.phase));

        fctx.beginPath();
        fctx.moveTo(cx - halfW, baseTopY);
        fctx.quadraticCurveTo(cpL_x, cpL_y, tipX, tipY);
        fctx.quadraticCurveTo(cpR_x, cpR_y, cx + halfW, baseTopY);
        fctx.closePath();
        fctx.fill();
      }
      fctx.restore();

      // ── Inner bright pip — small bright ball near the heart of the fire
      // that tracks the core's sway, sells the "alive" look.
      const corePulse = 0.85 + 0.15 * Math.sin(firePhase * 3.1);
      const coreSway  = Math.sin(firePhase * 2.7 + 4.1) * 1;
      const coreCx = cx + coreSway;
      const coreCy = baseY - 28 - 4 * Math.sin(firePhase * 2.3);
      const coreGrd = fctx.createRadialGradient(coreCx, coreCy, 0, coreCx, coreCy, 14 * corePulse);
      coreGrd.addColorStop(0,   `rgba(255,255,255,${0.95 * corePulse})`);
      coreGrd.addColorStop(0.5, `rgba(200,240,255,${0.55 * corePulse})`);
      coreGrd.addColorStop(1,   'rgba(120,200,255,0)');
      fctx.fillStyle = coreGrd;
      fctx.beginPath(); fctx.arc(coreCx, coreCy, 14 * corePulse, 0, Math.PI * 2); fctx.fill();

      // ── Rising sparks ────────────────────────────────────────────
      fctx.save();
      fctx.globalCompositeOperation = 'lighter';
      for (const s of sparks) {
        const cycle = ((firePhase * 0.18) + s.lifeOffset) % 1;       // 0..1 lifecycle
        const ey = baseY - 18 - cycle * 130;
        const driftX = Math.sin(firePhase * 0.9 + s.seed * 4) * 18 * cycle;
        const ex = cx + s.side * 6 + driftX;
        const fadeIn  = Math.min(1, cycle / 0.10);
        const fadeOut = Math.min(1, (1 - cycle) / 0.30);
        const a = Math.max(0, fadeIn * fadeOut);
        const r = 1.4 + Math.sin(firePhase * 4 + s.seed * 7) * 0.4;
        // Hot-white core fading to cyan glow
        fctx.fillStyle = `rgba(220, 245, 255, ${a * 0.95})`;
        fctx.beginPath(); fctx.arc(ex, ey, r, 0, Math.PI * 2); fctx.fill();
        fctx.fillStyle = `rgba(120, 190, 255, ${a * 0.45})`;
        fctx.beginPath(); fctx.arc(ex, ey, r * 2.4, 0, Math.PI * 2); fctx.fill();
      }
      fctx.restore();

      fireRAF = requestAnimationFrame(drawIntroFire);
    }
    drawIntroFire();

    // Helper: typewriter — types `text` into bubText, then waits for a tap
    // before resolving. First tap while typing fast-forwards to the full
    // line; second tap (after the line is complete) advances to the next
    // beat. The "tap to continue" hint shows once the line finishes.
    //
    // `onAdvanceGesture` (optional) runs SYNCHRONOUSLY inside the click
    // handler that resolves the promise. Use this for APIs that require a
    // live user gesture: showing the soft keyboard via `.focus()` on iOS
    // Safari and Android Chrome, unlocking AudioContext, fullscreen, etc.
    // The async `await` continuation runs after the gesture has ended, so
    // calling these APIs from there is silently ignored on mobile.
    const typeLine = (text, speed = 28, onAdvanceGesture = null) => new Promise((res) => {
      bubble.classList.remove('done');
      bubble.classList.add('show');
      bubText.textContent = '';
      bubBtns.innerHTML = '';
      let i = 0;
      let timer = null;
      let complete = false;

      const finishTyping = () => {
        if (timer) { clearTimeout(timer); timer = null; }
        bubText.textContent = text;
        complete = true;
        bubble.classList.add('done');
        // Show a subtle tap-to-continue cue.
        bubBtns.innerHTML =
          `<button class="intro-action-btn intro-tap-continue">Tap to continue ▸</button>`;
        const cont = bubBtns.querySelector('.intro-tap-continue');
        // Either the dedicated button or any tap on the overlay advances.
        cont.onclick = (e) => {
          e.stopPropagation();
          // Fire the gesture-context callback BEFORE resolving so the
          // browser still treats us as inside a user gesture.
          if (onAdvanceGesture) { try { onAdvanceGesture(); } catch (_) {} }
          cleanup(); res();
        };
      };

      const onAdvance = () => {
        if (!complete) { finishTyping(); return; }
        if (onAdvanceGesture) { try { onAdvanceGesture(); } catch (_) {} }
        cleanup(); res();
      };

      const cleanup = () => {
        overlay.removeEventListener('click', onAdvance);
        bubBtns.innerHTML = '';
      };

      // Tap anywhere on the overlay to advance (skip-to-end or continue).
      // Choice buttons / inputs stop propagation so they don't trigger this.
      overlay.addEventListener('click', onAdvance);

      const tick = () => {
        bubText.textContent = text.slice(0, ++i);
        if (i < text.length) timer = setTimeout(tick, speed);
        else finishTyping();
      };
      tick();
    });

    // Helper: render a row of choice buttons under the bubble; resolves with the chosen value.
    const askChoice = (choices) => new Promise((res) => {
      bubBtns.innerHTML = '';
      for (const c of choices) {
        const b = document.createElement('button');
        b.className = 'intro-action-btn';
        b.textContent = c.label;
        b.onclick = () => { bubBtns.innerHTML = ''; res(c.value); };
        bubBtns.appendChild(b);
      }
    });

    // Phase 1 — first-time questions (only if the player has never played).
    const isFirstRun = Game.isFirstTime();

    const runFirstTimeFlow = async () => {
      await typeLine('… *the fire stirs as you approach* …', 36);

      // Question 1 — wellbeing check. typeLine waits for a tap, then we
      // immediately swap the "tap to continue" button out for the choices.
      await typeLine('Are you okay? How are you feeling?');
      const mood = await askChoice([
        { label: '🌿 Calm',    value: 'calm' },
        { label: '🔍 Curious', value: 'curious' },
        { label: '🌙 Weary',   value: 'weary' },
      ]);
      const moodReply = {
        calm:    'Then we begin gently. There is no rush here.',
        curious: 'Good. The dark is full of small wonders.',
        weary:   'Sit a while. The warmth will hold what it can.',
      }[mood] || 'Then we shall see what the night brings.';
      await typeLine(moodReply);

      // Pre-fill name/avatar/trait from the existing profile if any. These
      // are shared across the three sequential steps below.
      const profileId = Game._getActiveProfileId();
      const profiles  = Game._getProfiles();
      const profile   = profiles.find(p => p.id === profileId) || {};
      let chosenName  = (profile.name && profile.name !== 'Player 1') ? profile.name : '';
      let chosenPic   = profile.pic ?? 0;
      let chosenTrait = (profile.trait && PLAYER_TRAITS[profile.trait]) ? profile.trait : DEFAULT_PLAYER_TRAIT;

      const titleEl    = document.getElementById('intro-profile-title');
      const nameInput  = document.getElementById('intro-name');
      const avatarGrid = document.getElementById('intro-avatar-grid');
      const traitGrid  = document.getElementById('intro-trait-grid');
      const traitDesc  = document.getElementById('intro-trait-desc');
      const stepEls = profilePanel.querySelectorAll('.intro-step');

      // Helpers — show the popup with a single visible step, hide the rest.
      const showStep = (which) => {
        stepEls.forEach(el => {
          el.style.display = (el.dataset.step === which) ? '' : 'none';
        });
      };
      const openPanel = () => {
        profilePanel.style.display = 'block';
        requestAnimationFrame(() => profilePanel.classList.add('show'));
      };
      const closePanel = async () => {
        profilePanel.classList.remove('show');
        await new Promise(r => setTimeout(r, 400));
        profilePanel.style.display = 'none';
      };
      const waitStepBtn = (which, validate) => new Promise((res) => {
        const btn = profilePanel.querySelector(`[data-step-action="${which}"]`);
        if (!btn) { res(); return; }
        btn.onclick = () => {
          if (validate && !validate()) return;
          res();
        };
      });

      // ── Step 1: Name ────────────────────────────────────────────────
      // Pre-stage the input so we can focus it INSIDE the same user-gesture
      // tap that resolves the typewriter. Mobile Safari / Android Chrome
      // refuse to open the soft keyboard from `.focus()` calls that don't
      // happen inside an active gesture handler — so we hand a synchronous
      // hook to typeLine() that fires on the advance tap.
      titleEl.textContent = 'Speak it, and I will remember.';
      nameInput.value = chosenName;
      nameInput.placeholder = 'What should I call you?';
      // The popup must be visible (display !== 'none') for focus() to take
      // effect; flip it on now, then make it visible. The fade-in still
      // plays once the user taps because the .show class is added later.
      showStep('name');
      profilePanel.style.display = 'block';
      await typeLine('Do you still remember your name?', 28, () => {
        // Synchronous, gesture-bound: this is the only reliable way to
        // pop the on-screen keyboard on mobile. `preventScroll` keeps
        // the page from jumping when the input is off-screen.
        try { nameInput.focus({ preventScroll: true }); } catch (_) { nameInput.focus(); }
      });
      // Run the panel reveal animation now that the gesture has fired.
      requestAnimationFrame(() => profilePanel.classList.add('show'));
      // Pressing Enter / Done on the soft keyboard fires the Continue
      // button so mobile users don't have to dismiss the keyboard first.
      const onNameKey = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          profilePanel.querySelector('[data-step-action="name"]')?.click();
        }
      };
      nameInput.addEventListener('keydown', onNameKey);
      await waitStepBtn('name', () => {
        const v = (nameInput.value || '').trim().replace(/[<>]/g, '').slice(0, 16);
        if (!v) { nameInput.focus(); return false; }
        chosenName = v;
        return true;
      });
      nameInput.removeEventListener('keydown', onNameKey);
      // Drop focus before fading out so the soft keyboard collapses too.
      nameInput.blur();
      await closePanel();

      // ── Step 2: Avatar ──────────────────────────────────────────────
      await typeLine(`${chosenName}. And how do I see you, when I look across the embers?`);
      titleEl.textContent = 'Pick the face the fire will see.';
      avatarGrid.innerHTML = '';
      AVATAR_DEFS.forEach((def, idx) => {
        const wrap = document.createElement('div');
        wrap.className = 'intro-avatar-thumb' + (idx === chosenPic ? ' selected' : '');
        wrap.title = def.name;
        const cv = document.createElement('canvas');
        cv.width = cv.height = 56;
        drawPassportAvatar(cv.getContext('2d'), idx, 56);
        wrap.appendChild(cv);
        wrap.onclick = () => {
          chosenPic = idx;
          avatarGrid.querySelectorAll('.intro-avatar-thumb').forEach((el, i) =>
            el.classList.toggle('selected', i === idx));
        };
        avatarGrid.appendChild(wrap);
      });
      showStep('face');
      openPanel();
      await waitStepBtn('face');
      await closePanel();

      // ── Step 3: Trait / behaviour ───────────────────────────────────
      await typeLine('And how do you carry yourself, through the long dark?');
      titleEl.textContent = 'Choose what feels true tonight.';
      const paintTrait = (name) => {
        chosenTrait = name;
        const def = PLAYER_TRAITS[name];
        traitDesc.textContent = def?.desc || '';
        traitGrid.querySelectorAll('.intro-trait-chip').forEach((el, i) =>
          el.classList.toggle('selected', PLAYER_TRAIT_LIST[i] === name));
      };
      traitGrid.innerHTML = '';
      PLAYER_TRAIT_LIST.forEach((name) => {
        const def = PLAYER_TRAITS[name];
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'intro-trait-chip' + (name === chosenTrait ? ' selected' : '');
        chip.innerHTML = `<span class="intro-trait-chip-icon" style="color:${def.color}">${def.icon}</span><span>${name}</span>`;
        chip.onclick = () => paintTrait(name);
        traitGrid.appendChild(chip);
      });
      paintTrait(chosenTrait);
      showStep('trait');
      openPanel();
      await waitStepBtn('trait');

      // Persist to the active profile via the same shape _savePassport uses.
      const profilesNow = Game._getProfiles();
      const p = profilesNow.find(pp => pp.id === Game._getActiveProfileId());
      if (p) {
        p.name  = chosenName;
        p.pic   = chosenPic;
        p.trait = chosenTrait;
        try { localStorage.setItem('cmm_profiles', JSON.stringify(profilesNow)); } catch {}
        _applyAvatarColors(chosenPic);
      }

      await closePanel();
      await typeLine(`${chosenName}. I will remember it through the dark.`);
    };

    // Phase 2 — Compy choice (every new game).
    const runCompyChoice = async () => {
      await typeLine('Three small spirits drew near while you slept. One of them is yours.');

      // Pick 3 random distinct T1 Compies.
      const t1Pool = COMPANIONS.filter(c => c.tier === 1);
      const shuffled = [...t1Pool];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      const picks = shuffled.slice(0, 3);

      const grid = document.getElementById('intro-compy-cards');
      grid.innerHTML = '';
      const ti = TIER_COLORS[1] || { color: '#a78bfa', border: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' };

      picks.forEach((cd) => {
        const rm = ROLE_META[cd.role || 'attacker'] || ROLE_META.attacker;
        const dropItem = getItemData(cd.drop) || { icon: '✨', color: '#fcd34d' };
        const card = document.createElement('div');
        card.className = 'compy-card compy-card-owned';
        card.style.setProperty('--card-tier-color', ti.color);
        card.style.setProperty('--card-tier-border', ti.border);
        card.style.setProperty('--card-tier-bg', ti.bg);
        card.style.setProperty('--card-role-color', rm.color);
        const artHTML = cd.art
          ? `<img src="${cd.art}" alt="${cd.name}" class="cc-art-img">`
          : `<div class="cc-art-icon">${cd.icon}</div>`;
        card.innerHTML = `
          <div class="cc-frame">
            <div class="cc-header">
              <span class="cc-name">${cd.name}</span>
              <span class="cc-tier-badge">T${cd.tier}</span>
            </div>
            <div class="cc-art">${artHTML}</div>
            <div class="cc-type">
              <span class="cc-role-icon" style="color:${rm.color}">${rm.icon}</span>
              <span>${rm.label}${cd.animal ? ` · ${cd.animal}` : ''}</span>
            </div>
            <div class="cc-rules">
              ${cd.perk ? `<div class="cc-perk"><strong>✨</strong> ${cd.perk.desc}</div>` : ''}
              ${cd.desc ? `<div class="cc-flavor">"${cd.desc}"</div>` : ''}
            </div>
            <div class="cc-footer">
              <span class="cc-drop" style="color:${dropItem.color}">${dropItem.icon} ${cd.drop}</span>
              <span class="cc-pt">Starting Companion</span>
            </div>
          </div>`;
        grid.appendChild(card);
      });

      compyPanel.style.display = 'flex';
      requestAnimationFrame(() => compyPanel.classList.add('show'));

      const pickedCd = await new Promise((res) => {
        const onPick = (cd, cardEl) => {
          grid.querySelectorAll('.compy-card').forEach(el => {
            if (el !== cardEl) el.classList.add('faded');
          });
          cardEl.classList.add('picked');
          setTimeout(() => res(cd), 700);
        };
        grid.querySelectorAll('.compy-card').forEach((el, i) => {
          el.onclick = () => onPick(picks[i], el);
        });
      });

      // Fire's welcome line — random.
      const welcomes = [
        `${pickedCd.name} will keep you warm tonight. Walk gently with them.`,
        `${pickedCd.name} chose you, you know. Don't be alarmed by their quiet ways.`,
        `Ah — ${pickedCd.name}. A good first thread to hold. Don't let go.`,
        `The dark is a little thinner now. ${pickedCd.name} sees you.`,
        `${pickedCd.name} will follow at your heel. Feed them. They remember kindness.`,
        `A small bright thing for a long dark road. ${pickedCd.name} is yours.`,
      ];
      const welcomeLine = welcomes[Math.floor(Math.random() * welcomes.length)];

      // Hide cards, return focus to bubble for the welcome.
      compyPanel.classList.remove('show');
      setTimeout(() => { compyPanel.style.display = 'none'; }, 400);
      // Brief settle while the cards fade out before the welcome line lands.
      await new Promise(r => setTimeout(r, 450));
      await typeLine(welcomeLine);

      return pickedCd.id;
    };

    // Drive the whole sequence.
    (async () => {
      try {
        if (isFirstRun) await runFirstTimeFlow();
        const pickedCompyId = await runCompyChoice();

        // Fade to black, tear down the overlay, resolve.
        fade.classList.add('show');
        await new Promise(r => setTimeout(r, 950));
        cancelAnimationFrame(fireRAF);
        overlay.style.display = 'none';
        resolve({ pickedCompyId });
      } catch (e) {
        cancelAnimationFrame(fireRAF);
        overlay.style.display = 'none';
        resolve({ pickedCompyId: null });
      }
    })();
  });
}

// Helper: grant the chosen starting Compy and auto-deploy it. Mirrors the
// path used by Booster Packs (see _addRandomCompanion / deployCompanion).
function _grantStartingCompy(compyId) {
  if (!gameInstance || !compyId) return;
  const cd = getCompanionById(compyId);
  if (!cd) return;
  gameInstance.companionInventory[cd.id] = (gameInstance.companionInventory[cd.id] || 0) + 1;
  gameInstance.collectedCompanionIds.add(cd.id);
  // Try to auto-deploy. If deployment fails (full slots, etc.) it stays in inventory.
  if (typeof gameInstance.deployCompanion === 'function') {
    gameInstance.deployCompanion(cd.id);
  }
  gameInstance.recalculatePerks?.();
  gameInstance.saveGame?.();
}

window._startNewGame = async () => {
  // Run the intro sequence (fire greeting + first-time profile + Compy pick)
  // BEFORE wiping/loading the world. The intro overlay is independent so the
  // user-facing experience is "menu → intro → fade → world".
  document.getElementById('start-menu').style.display = 'none';
  let pickedCompyId = null;
  try {
    const result = await _runIntroSequence();
    pickedCompyId = result?.pickedCompyId || null;
  } catch (_) { /* fall through to default path */ }

  _startNewGameCore();

  // Grant the chosen Compy after the world is up. _startNewGameCore() runs
  // synchronously and leaves the live gameInstance ready to mutate.
  if (pickedCompyId) _grantStartingCompy(pickedCompyId);
};

function _startNewGameCore() {
  // Wipe the save slot and any per-profile tutorial progress so the guided walkthrough
  // re-fires for the fresh run.
  localStorage.removeItem(Game._getSaveKey());
  try { localStorage.removeItem(`cmm_tutorial_${Game._getActiveProfileId()}`); } catch {}
  // Reset per-run feats while preserving cross-run lifetime counters
  // (deaths, reincarnations, total_levels, play_hrs, perk_carry).
  try {
    const key = Game._getLegacyKey();
    const legacy = JSON.parse(localStorage.getItem(key) || '{}');
    _purgeLegacyAchForNewRun(legacy);
    localStorage.setItem(key, JSON.stringify(legacy));
  } catch(e) {}
  document.getElementById('start-menu').style.display = 'none';

  // ── Clean slate ── Reset every piece of run-scoped state on the live Game instance.
  // This must run BEFORE _loadLegacy() so legacy perks apply to a fresh base.
  gameInstance.resetRunState();

  // Apply carried-over legacy perks + achievements (from cmm_legacy_<profile>)
  gameInstance._loadLegacy();
  gameInstance.recalculatePerks();

  // Story: Child 6 (Youngest) is present from Day 1.
  gameInstance.children?.spawnDayOne?.();

  // Fire the first-pick personality feat if this is the player's first run with that trait
  const trait = Game._getProfileTrait();
  const featCounter = PLAYER_TRAITS[trait]?.feat;
  if (featCounter) gameInstance.ach.set(featCounter, 1);

  // Sync avatar colors for the active profile
  const _ap2 = JSON.parse(localStorage.getItem('cmm_profiles') || '[]').find(p => p.id === Game._getActiveProfileId());
  _applyAvatarColors(_ap2?.pic ?? 0);

  // Clear any persistent DOM overlays left over from a prior run
  const tutBubble = document.getElementById('tutorial-bubble');
  if (tutBubble) tutBubble.remove();
  const saveInd = document.getElementById('save-indicator');
  if (saveInd) saveInd.classList.remove('show');
  ['inv','cook','craft','tiers','ach','perks','struct','merchant','death','passport'].forEach(id => {
    const m = document.getElementById(`modal-${id}`);
    if (m) m.style.display = 'none';
  });

  // Refresh every UI panel against the fresh state
  window.updatePerkHUD?.();
  if (window.updateInventoryUI)   window.updateInventoryUI(gameInstance.player.inventory);
  if (window.updateCompanionUI)   window.updateCompanionUI();
  if (window.updateTierTableUI)   window.updateTierTableUI();
  if (window.updateCraftUI)       window.updateCraftUI();
  if (window.updateMerchantUI)    window.updateMerchantUI();
  if (window.updateActivePerksUI) window.updateActivePerksUI();
  if (window.updateAchievementUI) window.updateAchievementUI();

  if (Game.isFirstTime()) setTimeout(() => window.showTutorial(), 500);
  gameInstance.start();
  setTimeout(() => { window.updatePerkHUD?.(); gameInstance._startAmbientDay(); }, 400);
}

window._startReincarnate = () => {
  // _startNewGame already wipes legacy.ach, so reincarnate is just an alias.
  window._startNewGame();
};

window._startAccounts = () => {
  document.getElementById('profile-panel').style.display = 'flex';
  window._renderProfileSlots();
};

window._profileBack = () => {
  document.getElementById('profile-panel').style.display = 'none';
  window._showStartMenu();
};

window._renderProfileSlots = () => {
  const profiles  = Game._getProfiles();
  const activeId  = Game._getActiveProfileId();
  const container = document.getElementById('profile-slots');
  container.innerHTML = '';

  profiles.forEach(p => {
    const summary  = Game._getProfileSaveSummary(p.id);
    const isActive = p.id === activeId;
    const el = document.createElement('div');
    el.className = 'profile-slot' + (isActive ? ' active' : '');
    el.style.display = 'flex'; el.style.alignItems = 'center'; el.style.gap = '10px';
    // Avatar thumbnail
    const cv = document.createElement('canvas');
    cv.width = cv.height = 44;
    cv.style.cssText = 'border-radius:50%;flex-shrink:0;border:2px solid rgba(255,255,255,0.12)';
    drawPassportAvatar(cv.getContext('2d'), p.pic ?? 0, 44);
    el.appendChild(cv);
    const info = document.createElement('div');
    info.style.flex = '1'; info.style.minWidth = '0';
    info.innerHTML = `<div class="profile-slot-name">${p.name}${isActive ? ' ✓' : ''}</div>
      <div class="${summary ? 'profile-slot-info' : 'profile-slot-empty'}">${summary ? `Day ${summary.day} · Lv.${summary.level} · 💰${summary.gold}g` : 'No save'}</div>`;
    el.appendChild(info);
    const activate = () => {
      localStorage.setItem('cmm_active_profile', p.id);
      window._renderProfileSlots();
      window._showStartMenu();
    };
    cv.onclick = activate;
    info.onclick = activate;
    cv.style.cursor = 'pointer';
    info.style.cursor = 'pointer';
    // ── Per-profile delete button. Blocked when only one profile remains
    // (the system always needs at least one). Confirms once before nuking
    // the save / legacy / tutorial keys for that profile id.
    const delBtn = document.createElement('button');
    delBtn.className = 'profile-slot-del';
    delBtn.title = profiles.length > 1 ? `Delete ${p.name}` : 'Cannot delete the only profile';
    delBtn.textContent = '🗑';
    delBtn.disabled = profiles.length <= 1;
    delBtn.onclick = async (ev) => {
      ev.stopPropagation();
      if (profiles.length <= 1) return;
      const body = summary
        ? `This erases their save (Day ${summary.day}, Lv.${summary.level}) and ALL legacy / perk progress.\n\nThis cannot be undone.`
        : `No active save, but legacy / perk progress for this profile will be erased.\n\nThis cannot be undone.`;
      const ok = await _showConfirmDialog({
        icon: '🗑',
        title: `Delete profile "${p.name}"?`,
        body,
        confirmLabel: 'Delete',
        danger: true,
      });
      if (ok) window._deleteProfile(p.id);
    };
    el.appendChild(delBtn);
    container.appendChild(el);
  });

  if (profiles.length < 4) {
    const addBtn = document.createElement('button');
    addBtn.className = 'profile-add-btn';
    addBtn.textContent = '+ New Profile';
    addBtn.onclick = () => {
      const name = prompt('Profile name:', `Player ${profiles.length + 1}`);
      if (!name || !name.trim()) return;
      const id = 'p' + Date.now();
      profiles.push({ id, name: name.trim().slice(0, 16), createdAt: Date.now() });
      localStorage.setItem('cmm_profiles', JSON.stringify(profiles));
      localStorage.setItem('cmm_active_profile', id);
      window._renderProfileSlots();
    };
    container.appendChild(addBtn);
  }

  // ── Reset-everything button. Wipes every profile and global flag, then
  // re-runs profile init so the panel comes back to a single fresh "Player 1".
  // Double-confirms because this is the most destructive action in the game.
  const resetBtn = document.createElement('button');
  resetBtn.className = 'profile-reset-btn';
  resetBtn.textContent = '⚠ Reset Everything';
  resetBtn.title = 'Wipe ALL profiles, saves, and progress — start completely fresh';
  resetBtn.onclick = async () => {
    const first = await _showConfirmDialog({
      icon: '⚠',
      title: 'Reset Everything?',
      body: 'This erases every profile, every save, every legacy perk, and every achievement on this device. The game returns to a brand-new state.\n\nThis cannot be undone.',
      confirmLabel: 'Reset Everything',
      danger: true,
    });
    if (!first) return;
    const second = await _showConfirmDialog({
      icon: '🔥',
      title: 'Last chance.',
      body: 'Really wipe everything and start completely fresh?',
      confirmLabel: 'Yes, wipe it all',
      danger: true,
    });
    if (!second) return;
    window._resetEverything();
  };
  container.appendChild(resetBtn);
};

// ─────────────────────────────────────────────────────────────────────
// In-game confirm dialog. Replaces native window.confirm() for actions
// that need to feel intentional (delete profile, reset everything).
// Mobile-friendly: full-width buttons, large tap targets, sits above the
// start menu (z-index 400). Cancel always resolves false; backdrop tap
// also cancels. Returns Promise<boolean>.
// ─────────────────────────────────────────────────────────────────────
function _showConfirmDialog({ icon = '❓', title = 'Are you sure?', body = '',
                              confirmLabel = 'Confirm', cancelLabel = 'Cancel',
                              danger = false } = {}) {
  return new Promise((resolve) => {
    // Build overlay + card.
    const overlay = document.createElement('div');
    overlay.className = 'cmm-confirm-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    const card = document.createElement('div');
    card.className = 'cmm-confirm-card' + (danger ? ' cmm-confirm-danger' : '');
    card.innerHTML = `
      <div class="cmm-confirm-icon">${icon}</div>
      <div class="cmm-confirm-title"></div>
      <div class="cmm-confirm-body"></div>
      <div class="cmm-confirm-actions">
        <button class="cmm-confirm-btn cmm-confirm-cancel"></button>
        <button class="cmm-confirm-btn cmm-confirm-ok"></button>
      </div>`;
    // Use textContent so user-supplied strings can't inject markup.
    card.querySelector('.cmm-confirm-title').textContent = title;
    card.querySelector('.cmm-confirm-body').textContent  = body;
    card.querySelector('.cmm-confirm-cancel').textContent = cancelLabel;
    card.querySelector('.cmm-confirm-ok').textContent     = confirmLabel;

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    // Animate in next frame so the CSS transition triggers.
    requestAnimationFrame(() => overlay.classList.add('show'));

    const close = (result) => {
      overlay.classList.remove('show');
      document.removeEventListener('keydown', onKey);
      // Wait for fade-out before removing so it doesn't pop.
      setTimeout(() => { overlay.remove(); resolve(result); }, 180);
    };

    // Backdrop tap = cancel; clicks inside the card stop propagation.
    overlay.addEventListener('click', () => close(false));
    card.addEventListener('click', (e) => e.stopPropagation());

    // Keyboard: Esc cancels, Enter confirms.
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(false); }
      else if (e.key === 'Enter') { e.preventDefault(); close(true); }
    };
    document.addEventListener('keydown', onKey);

    card.querySelector('.cmm-confirm-cancel').onclick = () => close(false);
    card.querySelector('.cmm-confirm-ok').onclick     = () => close(true);

    // Auto-focus the cancel button on desktop (safer default for destructive).
    setTimeout(() => card.querySelector('.cmm-confirm-cancel')?.focus(), 50);
  });
}

// Delete a single profile and all of its keyed storage. If the deleted
// profile was the active one, fall back to the first remaining profile.
window._deleteProfile = (profileId) => {
  let profiles = Game._getProfiles().filter(p => p.id !== profileId);
  if (profiles.length === 0) return; // safety: can't be left with zero
  try {
    localStorage.removeItem(`cmm_save_${profileId}`);
    localStorage.removeItem(`cmm_legacy_${profileId}`);
    localStorage.removeItem(`cmm_tutorial_${profileId}`);
  } catch {}
  localStorage.setItem('cmm_profiles', JSON.stringify(profiles));
  if (Game._getActiveProfileId() === profileId) {
    localStorage.setItem('cmm_active_profile', profiles[0].id);
  }
  window._renderProfileSlots();
  window._showStartMenu();
};

// Wipe every cmm_* key plus the legacy first-time flag, then reload so
// _initProfiles() re-creates the default Player 1. Reload is the simplest
// way to re-baseline the live gameInstance + UI without manual teardown.
window._resetEverything = () => {
  try {
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('cmm_') || k === 'companionAndMe_firstTime' ||
                k === 'companionAndMe_save' || k === 'companionAndMe_legacy')) {
        toRemove.push(k);
      }
    }
    toRemove.forEach(k => localStorage.removeItem(k));
  } catch {}
  // Hard reload — simplest path to a fully clean live state.
  location.reload();
};
