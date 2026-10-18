// ============================================================
// ACHIEVEMENTS MODULE — 333 Achievements + Tracker
// ============================================================

const A = [];
let _id = 0;
function b(cat, icon, entries) {
  for (const e of entries) {
    _id++;
    A.push({ id: _id, name: e[0], desc: e[1], cat, icon, xp: e[2], ctr: e[3] || null, tgt: e[4] || 0 });
  }
}

// 1. Survival - Days (12)
b('Survival','☀️',[
  ['First Dawn','Survive 1 day',100,'days',1],['Two Day Stand','Survive 2 days',100,'days',2],
  ['Three Day Stand','Survive 3 days',150,'days',3],['Five Day Fighter','Survive 5 days',200,'days',5],
  ['Week Warrior','Survive 7 days',250,'days',7],['Decade Dream','Survive 10 days',300,'days',10],
  ['Fortnight Plus','Survive 15 days',350,'days',15],['Veteran Dreamer','Survive 20 days',400,'days',20],
  ['Monthly Survivor','Survive 30 days',500,'days',30],['Half Century','Survive 50 days',700,'days',50],
  ['Diamond Survivor','Survive 75 days',900,'days',75],['Centurion','Survive 100 days',1200,'days',100],
]);
// 2. Survival - Nights (8)
b('Survival','🌙',[
  ['First Night','Survive 1 night',100,'nights',1],['Three Nights','Survive 3 nights',150,'nights',3],
  ['Five Nights','Survive 5 nights',200,'nights',5],['Ten Nights','Survive 10 nights',300,'nights',10],
  ['Twenty Nights','Survive 20 nights',400,'nights',20],['Thirty Nights','Survive 30 nights',500,'nights',30],
  ['Fifty Nights','Survive 50 nights',700,'nights',50],['Hundred Nights','Survive 100 nights',1000,'nights',100],
]);
// 3. Survival - Special (5)
b('Survival','💀',[
  ['Close Call','Survive with exactly 1 HP',400,'close_call',1],
  ['Death Defier','Recover from below 5 HP 10 times',500,'recover_low_hp',10],
  ['Never Hungry','Maintain hunger above 50% for an entire day',300,'never_hungry',1],
  ['Never Thirsty','Maintain thirst above 50% for an entire day',300,'never_thirsty',1],
  ['Perfect Day','Complete a full day without taking any damage',600,'perfect_day',1],
]);
// 4. Player Level (12)
b('Player Level','⬆️',[
  ['First Steps','Reach Level 2',100,'level',2],['Awakening','Reach Level 5',150,'level',5],
  ['Growing Light','Reach Level 10',200,'level',10],['Radiant Path','Reach Level 15',300,'level',15],
  ['Luminous Soul','Reach Level 20',400,'level',20],['Beacon of Hope','Reach Level 25',500,'level',25],
  ['Shining Star','Reach Level 30',600,'level',30],['Blazing Aura','Reach Level 35',700,'level',35],
  ['Solar Radiance','Reach Level 40',800,'level',40],['Celestial Glow','Reach Level 45',900,'level',45],
  ['Maximum Brilliance','Reach Level 50',1500,'level',50],
  ['Level Enthusiast','Gain 100 total levels across all runs',800,'total_levels',100],
]);
// 5. Exploration (12)
b('Exploration','🔦',[
  ['First Light','Expand light for the first time',100,'light_exp',1],
  ['Widening Glow','Expand light 3 times',150,'light_exp',3],
  ['Illuminator','Expand light 5 times',200,'light_exp',5],
  ['Light Bringer','Expand light 7 times',250,'light_exp',7],
  ['Bright Zone','Expand light 10 times',300,'light_exp',10],
  ['Half Lit','Expand light 15 times',350,'light_exp',15],
  ['Radiant Land','Expand light 20 times',400,'light_exp',20],
  ['Full Radiance','Reveal the entire map (Lv 50)',1000,'light_exp',49],
  ['Resource Finder','Reveal first resource asset',200,'reveals',1],
  ['Treasure Hunter','Reveal 3 resource assets',300,'reveals',3],
  ['Land Prospector','Reveal 5 resource assets',400,'reveals',5],
  ['Complete Map','Reveal all 10 resource assets',800,'reveals',10],
]);
// 6. Companion - Collection (12)
b('Companions','🐾',[
  ['First Friend','Obtain your first companion',100,'comp_unique',1],
  ['Duo Dream','Have 2 companions',100,'comp_unique',2],
  ['Trio Team','Have 3 companions',150,'comp_unique',3],
  ['Pack Leader','Have 5 companions',250,'comp_unique',5],
  ['Growing Family','Have 8 companions',350,'comp_unique',8],
  ['Full Squad','Have 10 companions deployed',500,'comp_deployed',10],
  ['Diverse Crew','Own 10 unique companions',400,'comp_unique',10],
  ['Halfway There','Own 13 unique companions',500,'comp_unique',13],
  ['Collector','Own 18 unique companions',600,'comp_unique',18],
  ['Almost Complete','Own 22 unique companions',800,'comp_unique',22],
  ['Menagerie','Own all 25 companions',1500,'comp_unique',25],
  ['Starter Trio','Own all 5 T1 companions',300,'has_all_t1',1],
]);
// 7. Companion - Tier (6)
b('Companions','⭐',[
  ['Common Start','Obtain a T1 companion',100,'has_t1',1],
  ['Uncommon Find','Obtain a T2 companion',200,'has_t2',1],
  ['Rare Discovery','Obtain a T3 companion',300,'has_t3',1],
  ['Epic Encounter','Obtain a T4 companion',500,'has_t4',1],
  ['Mythic Bond','Obtain a T5 companion',800,'has_t5',1],
  ['Legendary Soul','Obtain a T6 companion',1200,'has_t6',1],
]);
// 8. Companion - Bonding (10)
b('Bonding','❤️',[
  ['First Pet','Interact with a companion',100,'comp_interact',1],
  ['Friendly Touch','Interact 10 times',150,'comp_interact',10],
  ['Best Friends','Interact 50 times',250,'comp_interact',50],
  ['Companion Lover','Interact 100 times',350,'comp_interact',100],
  ['Soul Bond','Interact 250 times',500,'comp_interact',250],
  ['Eternal Bond','Interact 500 times',700,'comp_interact',500],
  ['Companion Healer','Cheer up a sad companion 10 times',200,'comp_cheer',10],
  ['Mood Therapist','Cheer up 50 times',400,'comp_cheer',50],
  ['Quick Producer','Tap-produce early 10 times',200,'comp_tap_prod',10],
  ['Factory Manager','Tap-produce early 100 times',500,'comp_tap_prod',100],
]);
// 9. Companion - Mood (8)
b('Bonding','😊',[
  ['Happy Pal','Get a companion to 100% mood',200,'comp_max_mood',1],
  ['Mood Master','All companions at 80%+ mood',400,'all_comp_happy',1],
  ['Joyful Crew','Maintain all at 80%+ for 3 min',350,'all_happy_3m',1],
  ['Euphoric Family','Maintain all at 80%+ for 10 min',500,'all_happy_10m',1],
  ['Blissful Land','Maintain all at 80%+ for 30 min',700,'all_happy_30m',1],
  ['Sad Day','Have all companions below 30% mood',100,'all_comp_sad',1],
  ['Mood Swing','Go from 10% to 90% happiness in one day',300,'mood_swing',1],
  ['Unshakeable','Never let any companion drop below 50% mood for 3 days',600,'unshakeable',1],
]);
// 10. Companion - Production (8)
b('Production','📦',[
  ['First Drop','Collect first companion drop',100,'drops',1],
  ['Collector','Collect 10 drops',100,'drops',10],
  ['Gatherer','Collect 50 drops',200,'drops',50],
  ['Hoarder','Collect 100 drops',300,'drops',100],
  ['Stockpiler','Collect 250 drops',400,'drops',250],
  ['Warehouse','Collect 500 drops',500,'drops',500],
  ['Infinite Stash','Collect 1000 drops',700,'drops',1000],
  ['Drop Lord','Collect 2500 drops',1000,'drops',2500],
]);
// 11. Companion - Conversion (8)
b('Conversion','🔄',[
  ['First Convert','Perform first tier conversion',300,'conv_total',1],
  ['Double Convert','Perform 2 conversions',300,'conv_total',2],
  ['Conversion Pro','Perform 5 conversions',400,'conv_total',5],
  ['Tier Master','Perform 10 conversions',500,'conv_total',10],
  ['First Stack','Stack your first duplicate',200,'first_stack',1],
  ['Triple Stack','Reach 3 stacks on any companion',300,'max_stack',3],
  ['Max Stack','Reach 6 stacks (max) on any companion',600,'max_stack',6],
  ['Stacking Pro','Max stack 3 different companions',800,'max_stack_3',1],
]);
// 12. Cooking - Total (10)
b('Cooking','🍳',[
  ['First Meal','Cook your first recipe',100,'cook_total',1],
  ['Home Cook','Cook 5 recipes',100,'cook_total',5],
  ['Amateur Chef','Cook 10 recipes',150,'cook_total',10],
  ['Line Cook','Cook 25 recipes',200,'cook_total',25],
  ['Sous Chef','Cook 50 recipes',300,'cook_total',50],
  ['Head Chef','Cook 100 recipes',400,'cook_total',100],
  ['Master Chef','Cook 250 recipes',500,'cook_total',250],
  ['Grand Chef','Cook 500 recipes',700,'cook_total',500],
  ['Culinary Legend','Cook 750 recipes',900,'cook_total',750],
  ['Cooking God','Cook 1000 recipes',1200,'cook_total',1000],
]);
// 13. Cooking - Quality (12)
b('Cooking','⭐',[
  ['Basic Batch','Cook 1 one-star recipe',100,'cook_1',1],
  ['Basic Baker','Cook 10 one-star recipes',150,'cook_1',10],
  ['Basic Expert','Cook 50 one-star recipes',250,'cook_1',50],
  ['Basic Master','Cook 100 one-star recipes',400,'cook_1',100],
  ['Good Start','Cook 1 two-star recipe',150,'cook_2',1],
  ['Good Baker','Cook 10 two-star recipes',200,'cook_2',10],
  ['Good Expert','Cook 50 two-star recipes',350,'cook_2',50],
  ['Good Master','Cook 100 two-star recipes',500,'cook_2',100],
  ['Gourmet Start','Cook 1 three-star recipe',200,'cook_3',1],
  ['Gourmet Baker','Cook 10 three-star recipes',300,'cook_3',10],
  ['Gourmet Expert','Cook 50 three-star recipes',500,'cook_3',50],
  ['Gourmet Master','Cook 100 three-star recipes',700,'cook_3',100],
]);
// 14. Cooking - Discovery (8)
b('Cooking','📖',[
  ['First Recipe','Discover 1 recipe',100,'cook_unique',1],
  ['Curious Cook','Discover 5 recipes',150,'cook_unique',5],
  ['Recipe Hunter','Discover 10 recipes',200,'cook_unique',10],
  ['Cookbook Builder','Discover 15 recipes',300,'cook_unique',15],
  ['Half Menu','Discover 17 recipes',300,'cook_unique',17],
  ["Chef's Knowledge",'Discover 20 recipes',400,'cook_unique',20],
  ['Nearly Complete','Discover 25 recipes',500,'cook_unique',25],
  ['Full Cookbook','Discover all 30 recipes',1000,'cook_unique',30],
]);
// 15. Cooking - Special (5)
b('Cooking','🏆',[
  ['Omakase Creator','Cook the Dreamland Omakase',800,'cooked_dreamland_omakase',1],
  ['Feast Host','Cook the Grand Feast Platter',600,'cooked_grand_feast_platter',1],
  ['Void Chef','Cook Void Truffle Soup',500,'cooked_void_truffle_soup',1],
  ['Rainbow Baker','Cook Prism Honey Cake',500,'cooked_prism_honey_cake',1],
  ['Elixir Brewer','Cook Moon Herb Elixir',400,'cooked_moon_herb_elixir',1],
]);
// 16. Crafting (15)
b('Crafting','🔨',[
  ['First Build','Craft your first prop',100,'props_built',1],
  ['Builder','Craft 3 props',150,'props_built',3],
  ['Constructor','Craft 5 props',200,'props_built',5],
  ['Architect','Craft 8 props',300,'props_built',8],
  ['Master Builder','Craft all 12 props',800,'props_built',12],
  ['Kitchen Ready','Build the Cooking Station',200,'prop_cooking_station',1],
  ['Workshop Ready','Build the Workbench',200,'prop_workbench',1],
  ['Water Supply','Build the Stone Well',250,'prop_stone_well',1],
  ['Garden Keeper','Build the Herb Garden',250,'prop_herb_garden',1],
  ['Safe Haven','Build the Companion Den',300,'prop_companion_den',1],
  ['Mood Setter','Build the Mood Lantern',300,'prop_mood_lantern',1],
  ['Guardian','Build the Ward Stone',350,'prop_ward_stone',1],
  ['Pack Rat','Build the Storage Chest',200,'prop_storage_chest',1],
  ['Musician','Build the Dream Chime',350,'prop_dream_chime',1],
  ['Alchemist','Build the Brew Cauldron',400,'prop_brew_cauldron',1],
]);
// 17. Combat - Total (10)
b('Combat','⚔️',[
  ['First Kill','Defeat 1 nightmare',100,'nm_killed',1],
  ['Nightmare Hunter','Defeat 5 nightmares',150,'nm_killed',5],
  ['Slayer','Defeat 10 nightmares',200,'nm_killed',10],
  ['Vanquisher','Defeat 25 nightmares',300,'nm_killed',25],
  ['Decimator','Defeat 50 nightmares',400,'nm_killed',50],
  ['Destroyer','Defeat 100 nightmares',500,'nm_killed',100],
  ['Annihilator','Defeat 250 nightmares',600,'nm_killed',250],
  ['Exterminator','Defeat 500 nightmares',800,'nm_killed',500],
  ["Nightmare's Bane",'Defeat 750 nightmares',1000,'nm_killed',750],
  ['Dream Protector','Defeat 1000 nightmares',1500,'nm_killed',1000],
]);
// 18. Combat - By Type (25)
b('Combat','🐺',[
  ['Pup Puncher','Kill 1 Shadow Pup',100,'nm_pup',1],['Pup Hunter','Kill 10 Shadow Pups',150,'nm_pup',10],
  ['Pup Slayer','Kill 50 Shadow Pups',250,'nm_pup',50],['Pup Exterminator','Kill 100 Shadow Pups',400,'nm_pup',100],
  ['Pup Annihilator','Kill 250 Shadow Pups',600,'nm_pup',250],
  ['Moth Swatter','Kill 1 Dread Moth',100,'nm_moth',1],['Moth Hunter','Kill 10 Dread Moths',150,'nm_moth',10],
  ['Moth Slayer','Kill 50 Dread Moths',300,'nm_moth',50],['Moth Exterminator','Kill 100 Dread Moths',450,'nm_moth',100],
  ['Moth Annihilator','Kill 250 Dread Moths',650,'nm_moth',250],
  ['Bear Poker','Kill 1 Hollow Bear',200,'nm_bear',1],['Bear Fighter','Kill 10 Hollow Bears',300,'nm_bear',10],
  ['Bear Slayer','Kill 50 Hollow Bears',500,'nm_bear',50],['Bear Dominator','Kill 100 Hollow Bears',700,'nm_bear',100],
  ['Bear Annihilator','Kill 250 Hollow Bears',900,'nm_bear',250],
  ['Wisp Catcher','Kill 1 Weeping Wisp',150,'nm_wisp',1],['Wisp Hunter','Kill 10 Weeping Wisps',250,'nm_wisp',10],
  ['Wisp Slayer','Kill 50 Weeping Wisps',400,'nm_wisp',50],['Wisp Exterminator','Kill 100 Weeping Wisps',600,'nm_wisp',100],
  ['Wisp Annihilator','Kill 250 Weeping Wisps',800,'nm_wisp',250],
  ['Root Ripper','Kill 1 Nightmare Root',200,'nm_root',1],['Root Hunter','Kill 5 Nightmare Roots',300,'nm_root',5],
  ['Root Slayer','Kill 10 Nightmare Roots',400,'nm_root',10],['Root Destroyer','Kill 25 Nightmare Roots',600,'nm_root',25],
  ['Root Annihilator','Kill 50 Nightmare Roots',800,'nm_root',50],
]);
// 19. Combat - Boss (6)
b('Combat','👑',[
  ['Titan Slayer','Defeat your first Void Titan',500,'nm_titan',1],
  ['Titan Hunter','Defeat 3 Void Titans',600,'nm_titan',3],
  ['Titan Vanquisher','Defeat 5 Void Titans',700,'nm_titan',5],
  ['Titan Decimator','Defeat 10 Void Titans',900,'nm_titan',10],
  ['Titan Destroyer','Defeat 15 Void Titans',1100,'nm_titan',15],
  ['Titan God','Defeat 25 Void Titans',1500,'nm_titan',25],
]);
// 20. Combat - Special (5)
b('Combat','💫',[
  ['Brave Heart','Kill a nightmare at below 10% HP',500,'brave_heart',1],
  ['Untouched','Survive a night without taking damage',400,'untouched_night',1],
  ['Pacifist Night','Survive a night without killing anything',300,'pacifist_night',1],
  ['Companion Defender','Save a companion from nightmare attack',200,'comp_defender',1],
  ['Flawless Boss','Kill Void Titan without companion casualties',800,'flawless_boss',1],
]);
// 21. Economy - Gold Earned (8)
b('Economy','💰',[
  ['First Coin','Earn 1 gold',100,'gold_in',1],['Pocket Change','Earn 10 gold',100,'gold_in',10],
  ['Savings','Earn 50 gold',200,'gold_in',50],['Wealthy','Earn 100 gold',300,'gold_in',100],
  ['Rich Dreamer','Earn 250 gold',400,'gold_in',250],['Gold Hoarder','Earn 500 gold',500,'gold_in',500],
  ['Treasure Lord','Earn 1000 gold',700,'gold_in',1000],['Dream Tycoon','Earn 2500 gold',1000,'gold_in',2500],
]);
// 22. Economy - Gold Spent (8)
b('Economy','🛒',[
  ['First Purchase','Spend 1 gold',100,'gold_out',1],['Shopper','Spend 10 gold',100,'gold_out',10],
  ['Big Spender','Spend 50 gold',200,'gold_out',50],['Investor','Spend 100 gold',300,'gold_out',100],
  ['Patron','Spend 250 gold',400,'gold_out',250],['Philanthropist','Spend 500 gold',500,'gold_out',500],
  ['Gold Sinker','Spend 1000 gold',700,'gold_out',1000],['Money Burner','Spend 2500 gold',1000,'gold_out',2500],
]);
// 23. Economy - Merchant (8)
b('Economy','🧙',[
  ['First Trade','Trade with merchant once',100,'trades',1],
  ['Regular Customer','Trade 5 times',150,'trades',5],
  ['Loyal Patron','Trade 10 times',200,'trades',10],
  ["Merchant's Friend",'Trade 25 times',350,'trades',25],
  ['Master Trader','Trade 50 times',500,'trades',50],
  ['Trading Legend','Trade 100 times',700,'trades',100],
  ['Rare Buyer','Buy a merchant rare item',300,'rare_bought',1],
  ['Rare Collector','Buy all 6 merchant rare items',800,'rare_bought',6],
]);
// 24. Economy - Booster (8)
b('Economy','🎁',[
  ['First Pack','Open 1 booster pack',100,'packs',1],['Pack Opener','Open 5 packs',150,'packs',5],
  ['Pack Enthusiast','Open 10 packs',200,'packs',10],['Pack Addict','Open 25 packs',300,'packs',25],
  ['Pack Veteran','Open 50 packs',400,'packs',50],['Pack Master','Open 100 packs',600,'packs',100],
  ['Lucky Pull','Get a duplicate from a pack',100,'pack_dupe',1],
  ['Mega Lucky','Get 3 duplicates in a row',300,'pack_dupe_streak',3],
]);
// 25. Resources - Collection (10)
b('Resources','🧺',[
  ['First Harvest','Collect any resource',100,'resources',1],
  ['Gatherer','Collect 10 resources',100,'resources',10],
  ['Forager','Collect 50 resources',200,'resources',50],
  ['Resource Hunter','Collect 100 resources',300,'resources',100],
  ['Stockpiler','Collect 250 resources',400,'resources',250],
  ['Material Master','Collect 500 resources',500,'resources',500],
  ['Resource King','Collect 1000 resources',700,'resources',1000],
  ['Infinite Resources','Collect 2500 resources',900,'resources',2500],
  ['Land Harvest','Collect from a revealed resource asset',200,'land_harvest',1],
  ['Full Harvest','Collect from all 10 revealed assets',600,'land_harvest_unique',10],
]);
// 26. Resources - By Type (15)
b('Resources','🌿',[
  ['Mushroom Picker','Collect 25 Mushrooms',150,'r_mushroom',25],
  ['Rice Farmer','Collect 25 Rice',150,'r_rice',25],
  ['Egg Collector','Collect 25 Eggs',150,'r_egg',25],
  ['Dew Catcher','Collect 25 Fresh Dew',150,'r_dew',25],
  ['Clover Hunter','Collect 25 Clover Leaves',150,'r_clover',25],
  ['Spice Trader','Collect 25 Spice Dust',200,'r_spice',25],
  ['Flower Picker','Collect 25 Wildflowers',200,'r_wildflower',25],
  ['Noodle Maker','Collect 25 Seaweed Noodles',200,'r_seaweed',25],
  ['Honey Hunter','Collect 25 Honey Globs',200,'r_honey',25],
  ['Herb Gatherer','Collect 25 Dream Herbs',200,'r_dream_herb',25],
  ['Crystal Miner','Collect 10 Sea Crystals',300,'r_sea_crystal',10],
  ['Silk Weaver','Collect 10 Thunder Silk',300,'r_thunder_silk',10],
  ['Berry Picker','Collect 10 Solar Berries',300,'r_solar_berry',10],
  ['Dust Collector','Collect 10 Lunar Dust',350,'r_lunar_dust',10],
  ['Shard Seeker','Collect 5 Rainbow Shards',400,'r_rainbow_shard',5],
]);
// 27. Happiness (10)
b('Happiness','😄',[
  ['Feeling Better','Reach 30% happiness',100,'max_happy',30],
  ['Half Happy','Reach 50% happiness',150,'max_happy',50],
  ['Pretty Good','Reach 70% happiness',200,'max_happy',70],
  ['Very Happy','Reach 80% happiness',300,'max_happy',80],
  ['Overjoyed','Reach 90% happiness',400,'max_happy',90],
  ['Pure Bliss','Reach 100% happiness',600,'max_happy',100],
  ['Happy Hour','Maintain 80%+ happiness for 3 min',300,'happy_80_time',180],
  ['Happy Day','Maintain 80%+ for 10 min',500,'happy_80_time',600],
  ['Eternal Joy','Maintain 80%+ for 30 min',700,'happy_80_time',1800],
  ['Sad Story','Drop below 5% happiness',100,'sad_5',1],
]);
// 28. Hunger & Thirst (10)
b('Survival','🍖',[
  ['Well Fed','Maintain hunger above 80% for 5 min',200,'hunger_80_time',300],
  ['Never Starving','Never reach 0% hunger in a run (10+ min)',400,'never_starved',1],
  ['Hydrated','Maintain thirst above 80% for 5 min',200,'thirst_80_time',300],
  ['Never Dehydrated','Never reach 0% thirst in a run (10+ min)',400,'never_dehydrated',1],
  ['Hunger Fighter','Recover from 0% hunger 5 times',200,'hunger_recover',5],
  ['Thirst Fighter','Recover from 0% thirst 5 times',200,'thirst_recover',5],
  ['Iron Stomach','Eat 10 different recipes in one run',300,'unique_meals_run',10],
  ['Taste Tester','Eat 20 different recipes in one run',500,'unique_meals_run',20],
  ['Feast Mode','Eat 5 meals in 5 minutes',200,'feast_mode',1],
  ['Starvation Survivor','Survive 2 minutes at 0% hunger',300,'starve_survive_time',120],
]);
// 29. Food Eaten (8)
b('Cooking','🍽️',[
  ['First Bite','Eat your first cooked meal',100,'meals_eaten',1],
  ['Glutton','Eat 10 meals',150,'meals_eaten',10],
  ['Food Lover','Eat 25 meals',200,'meals_eaten',25],
  ['Gourmand','Eat 50 meals',300,'meals_eaten',50],
  ['Food Connoisseur','Eat 100 meals',400,'meals_eaten',100],
  ['Feast Master','Eat 250 meals',600,'meals_eaten',250],
  ['Bottomless Stomach','Eat 500 meals',800,'meals_eaten',500],
  ['Eating Legend','Eat 1000 meals',1200,'meals_eaten',1000],
]);
// 30. Social (8)
b('Social','💬',[
  ['First Wave','Perform first social interaction',100,'social',1],
  ['Socialite','Perform 10 social interactions',150,'social',10],
  ['Social Butterfly','Perform 25 interactions',200,'social',25],
  ['Life of the Party','Perform 50 interactions',300,'social',50],
  ['Community Builder','Perform 100 interactions',400,'social',100],
  ['Social Legend','Perform 250 interactions',600,'social',250],
  ['Cheer Squad','Cheer up companions 25 times',300,'comp_cheer',25],
  ['Empathy Master','Cheer up companions 100 times',500,'comp_cheer',100],
]);
// 31. Reincarnation (8)
b('Reincarnation','♻️',[
  ['First Death','Die for the first time',100,'deaths',1],
  ['Second Life','Reincarnate once',150,'reincarnations',1],
  ['Third Chance','Reincarnate 3 times',200,'reincarnations',3],
  ['Cycle Veteran','Reincarnate 5 times',300,'reincarnations',5],
  ['Cycle Master','Reincarnate 10 times',500,'reincarnations',10],
  ['Cycle Legend','Reincarnate 15 times',700,'reincarnations',15],
  ['Eternal Dreamer','Reincarnate 20 times',1000,'reincarnations',20],
  ['Perk Carry','Carry over a perk via reincarnation',200,'perk_carry',1],
]);
// 32. Tap Actions (8)
b('Actions','👆',[
  ['First Tap','Tap on any entity',100,'taps',1],['Tapper','Tap 10 times',100,'taps',10],
  ['Tap Happy','Tap 50 times',150,'taps',50],['Tap Enthusiast','Tap 100 times',200,'taps',100],
  ['Tap Addict','Tap 250 times',300,'taps',250],['Tap Master','Tap 500 times',400,'taps',500],
  ['Tap Legend','Tap 1000 times',600,'taps',1000],
  ['Speed Tapper','Tap 10 times in 5 seconds',200,'speed_tapper',1],
]);
// 33. Time Played (6)
b('Time','⏱️',[
  ['One Hour In','Play for 1 hour total',200,'play_hrs',1],
  ['Five Hours','Play for 5 hours',300,'play_hrs',5],
  ['Ten Hours','Play for 10 hours',400,'play_hrs',10],
  ['Day Player','Play for 24 hours total',600,'play_hrs',24],
  ['Dedicated','Play for 50 hours',800,'play_hrs',50],
  ['Lifetime Dreamer','Play for 100 hours',1200,'play_hrs',100],
]);
// 34. Mastery (8)
b('Mastery','🏅',[
  ['Starter','Earn 10 achievements',200,'ach_count',10],
  ['Achiever','Earn 25 achievements',300,'ach_count',25],
  ['Dedicated Achiever','Earn 50 achievements',400,'ach_count',50],
  ['Achievement Hunter','Earn 100 achievements',500,'ach_count',100],
  ['Completionist','Earn 150 achievements',600,'ach_count',150],
  ['Grand Completionist','Earn 200 achievements',800,'ach_count',200],
  ['Near Perfect','Earn 300 achievements',1000,'ach_count',300],
  ['True Master','Earn all 387 achievements',2000,'ach_count',387],
]);
// 35. Hidden/Special (13)
b('Hidden','🔮',[
  ['Dark Secret','Find the Void Kitten',500,'found_void_kitten',1],
  ['Wolf Pack','Find the Phantom Wolf',500,'found_phantom_wolf',1],
  ['Night Owl','Encounter Starlight Owl for the first time',300,'found_starlight_owl',1],
  ['Butterfly Effect','Own Aurora Butterfly while at 100% happiness',600,'butterfly_effect',1],
  ["Spider's Web",'Have Silk Spider trap 10 nightmares',400,'spider_trap',10],
  ["Hedgehog's Revenge",'Reflect-kill a nightmare via Bramble Hedgehog',400,'hedgehog_revenge',1],
  ['Full Moon','Have Moon Ferret and Starlight Owl deployed together',300,'full_moon',1],
  ['Dream Team','Deploy 10 companions simultaneously',500,'comp_deployed',10],
  ['Golden Age','Reach 100% happiness, Lv50, 10 companions, all props',2000,'golden_age',1],
  ['Void Walker','Enter a night at below 10% happiness and survive',400,'void_walker',1],
  ['Speed Runner','Reach Day 10 in under 30 minutes real time',500,'speed_runner',1],
  ['No Light No Problem','Kill a nightmare while at Level 1',300,'no_light_kill',1],
  ['The Collector','Own one of every item type in inventory',1000,'all_items',1],
]);

export const ALL_ACHIEVEMENTS = A;

// ============================================================
// ACHIEVEMENT TRACKER
// ============================================================
export class AchievementTracker {
  constructor() {
    this.c = {};       // counters
    this.u = {};       // unlocked: achId -> true
    this._pending = []; // newly unlocked since last flush
    this._playTime = 0; // total play time in seconds
  }

  /** Increment a counter and auto-check achievements */
  inc(stat, amt = 1) {
    this.c[stat] = (this.c[stat] || 0) + amt;
    this._check();
  }

  /** Set a counter to a specific value (e.g. level) */
  set(stat, val) {
    this.c[stat] = val;
    this._check();
  }

  /** Set counter to max of current and new value */
  max(stat, val) {
    this.c[stat] = Math.max(this.c[stat] || 0, val);
    this._check();
  }

  /** Track play time — call with dt each frame */
  tick(dt) {
    this._playTime += dt;
    this.c['play_hrs'] = Math.floor(this._playTime / 3600);
  }

  /** Flush newly-unlocked achievements (returns array, clears pending) */
  flush() {
    const result = [...this._pending];
    this._pending = [];
    return result;
  }

  /** Internal: check all unearned counter-based achievements */
  _check() {
    let found = false;
    for (const a of A) {
      if (this.u[a.id]) continue;
      if (!a.ctr) continue;
      if ((this.c[a.ctr] || 0) >= a.tgt) {
        this.u[a.id] = true;
        this._pending.push(a);
        found = true;
      }
    }
    if (found) {
      this.c['ach_count'] = Object.keys(this.u).length;
      this._check(); // recursive for mastery chain
    }
  }

  get unlockedCount() { return Object.keys(this.u).length; }

  get totalXP() {
    let s = 0;
    for (const id in this.u) {
      const a = A.find(x => x.id === +id);
      if (a) s += a.xp;
    }
    return s;
  }

  /** Serialize for save */
  toJSON() {
    return { c: { ...this.c }, u: { ...this.u }, pt: this._playTime };
  }

  /** Deserialize from save */
  fromJSON(data) {
    if (!data) return;
    this.c = { ...data.c };
    this.u = { ...data.u };
    this._playTime = data.pt || 0;
  }
}

// Resource name -> counter key mapping
export const RESOURCE_COUNTER_MAP = {
  'Mushroom': 'r_mushroom', 'Rice': 'r_rice', 'Egg': 'r_egg',
  'Fresh Dew': 'r_dew', 'Clover Leaf': 'r_clover', 'Spice Dust': 'r_spice',
  'Wildflower': 'r_wildflower', 'Seaweed Noodle': 'r_seaweed',
  'Honey Glob': 'r_honey', 'Dream Herb': 'r_dream_herb',
  'Sea Crystal': 'r_sea_crystal', 'Thunder Silk': 'r_thunder_silk',
  'Solar Berry': 'r_solar_berry', 'Ice Shard': 'r_ice_shard',
  'Thorn Berry': 'r_thorn_berry', 'Lunar Dust': 'r_lunar_dust',
  'Fleece Cloud': 'r_fleece', 'Magma Stone': 'r_magma',
  'Stardust Feather': 'r_stardust', 'Rainbow Shard': 'r_rainbow_shard',
  'Prism Pollen': 'r_prism', 'Dark Matter Fluff': 'r_dark_matter',
  'Spirit Ember': 'r_spirit', 'Dream Thread': 'r_thread',
  'Bamboo Shoot': 'r_bamboo',
};

// Nightmare ID -> counter key mapping
export const NIGHTMARE_COUNTER_MAP = {
  'pup': 'nm_pup', 'moth': 'nm_moth', 'bear': 'nm_bear',
  'wisp': 'nm_wisp', 'root': 'nm_root', 'titan': 'nm_titan',
};

// Recipe name -> counter key mapping (for special recipe achievements)
export const RECIPE_COUNTER_MAP = {
  'Dreamland Omakase': 'cooked_dreamland_omakase',
  'Grand Feast Platter': 'cooked_grand_feast_platter',
  'Void Truffle Soup': 'cooked_void_truffle_soup',
  'Prism Honey Cake': 'cooked_prism_honey_cake',
  'Moon Herb Elixir': 'cooked_moon_herb_elixir',
};

// Companion ID -> found counter (for hidden achievements)
export const COMPANION_FOUND_MAP = {
  'void_kitten': 'found_void_kitten',
  'phantom_wolf': 'found_phantom_wolf',
  'starlight_owl': 'found_starlight_owl',
};

// 31. Junk Cleaning (11)
b('Tidying','🧹',[
  ['First Clean','Clean your first piece of junk',150,'junk_cleaned',1],
  ['Tidy Up','Clean 10 pieces of junk',200,'junk_cleaned',10],
  ['Spring Cleaner','Clean 50 pieces of junk',350,'junk_cleaned',50],
  ['Junk Hunter','Clean 100 pieces of junk',500,'junk_cleaned',100],
  ['Memory Keeper','Clean 200 pieces of junk',800,'junk_cleaned',200],
  ['Heavy Lifter','Clean a Level 3 junk',300,'junk3_cleaned',1],
  ['Darkness Banished','Clean 5 Level 3 junks',600,'junk3_cleaned',5],
  ['Daily Chores','Clean 5 junks in one day',250,'junk_day',5],
  ['Helper Squad','Have a Compy auto-clean a junk',200,'junk_compy_clean',1],
  ['Lucky Find','Discover an item inside junk',200,'junk_item_found',1],
  ['Peaceful Ground','Wipe out 3 junks at once',400,'junk_simultaneous',3],
]);

// 37. Decor - Buying (5)
b('Decor','🌸',[
  ['First Decor','Buy your first decor item',100,'decor_bought',1],
  ['Interior Designer','Buy 5 decor items',150,'decor_bought',5],
  ['Landscape Artist','Buy 10 decor items',200,'decor_bought',10],
  ['Decorator','Buy 25 decor items',350,'decor_bought',25],
  ['Master Decorator','Buy 50 decor items',600,'decor_bought',50],
]);
// 38. Decor - Placing (5)
b('Decor','🏡',[
  ['Home Starter','Place your first decor item',100,'decor_placed',1],
  ['Setting the Scene','Place 5 decor items',150,'decor_placed',5],
  ['Home Maker','Place 10 decor items',250,'decor_placed',10],
  ['World Builder','Place 20 decor items',400,'decor_placed',20],
  ['Dream World','Place 50 decor items',700,'decor_placed',50],
]);
// 39. Decor - Collection (5)
b('Decor','🗺️',[
  ['Variety Pack','Own 5 unique decor types',200,'decor_unique',5],
  ['Eclectic Taste','Own 10 unique decor types',350,'decor_unique',10],
  ['Collector','Own 20 unique decor types',500,'decor_unique',20],
  ['Curator','Own 35 unique decor types',750,'decor_unique',35],
  ['Full Collection','Own all 50 decor types',1500,'decor_unique',50],
]);
// 40. Decor - Trees (3)
b('Decor','🌳',[
  ['Sapling','Buy your first tree',100,'decor_tree_unique',1],
  ['Tree Planter','Own 3 different tree types',250,'decor_tree_unique',3],
  ['Forest Grove','Own all 5 tree types',500,'decor_tree_unique',5],
]);
// 41. Decor - Specific Items (10)
b('Decor','✨',[
  ['Desert Wanderer','Buy a Cactus',100,'d_cactus',1],
  ['Garden Path','Buy a Wooden Fence',100,'d_fence',1],
  ['Candlelight','Buy a light source (lantern or candle)',150,'d_light',1],
  ['Fountain of Life','Buy a Stone Fountain',200,'d_fountain',1],
  ['Sacred Ground','Place a Moon Shrine',300,'d_moon_shrine',1],
  ['Bloom Season','Buy a Tulip Patch',100,'d_tulip',1],
  ['Sweet Harvest','Place a Beehive',150,'d_beehive',1],
  ['Stargazer','Place a Star Post',150,'d_starpost',1],
  ['Enchanted Grove','Place a Fairy Circle',200,'d_fairy_ring',1],
  ['Hidden Treasure','Place a Treasure Chest',200,'d_treasure',1],
]);
// 42. Decor - Garden Scale (5)
b('Decor','🌿',[
  ['Budding Gardener','Have 3 decor items placed at once',200,'decor_active',3],
  ['Full Garden','Have 10 decor items placed at once',400,'decor_active',10],
  ['Paradise','Have 20 decor items placed at once',700,'decor_active',20],
  ['Grand Estate','Have 35 decor items placed at once',1200,'decor_active',35],
  ['Dream Sanctuary','Have all 50 decor types placed at once',3000,'decor_all_types',1],
]);
// 43. Personality (6) — fired the first time a profile selects each trait
b('Personality','🧬',[
  ['Born Curious',     'Choose Curious as your trait',     150,'born_curious',     1],
  ['Quiet Soul',       'Choose Shy as your trait',         150,'quiet_soul',       1],
  ['Bold Spirit',      'Choose Brave as your trait',       150,'bold_spirit',      1],
  ['Hearty Appetite',  'Choose Gluttonous as your trait',  150,'hearty_appetite',  1],
  ['Open Heart',       'Choose Empathetic as your trait',  150,'open_heart',       1],
  ['Steady Mind',      'Choose Stoic as your trait',       150,'steady_mind',      1],
]);
// 44. Prop Abilities (4) — first-time fire of each active ability
b('Crafting','✨',[
  ['Quick Cook',   'Use the Cooking Station Quick Heat ability',   200,'ab_quick_heat',   1],
  ['Burst of Joy', 'Use the Mood Lantern Bright Burst ability',    200,'ab_bright_burst', 1],
  ['Ward Wielder', 'Use the Ward Stone Ward Pulse ability',        250,'ab_ward_pulse',   1],
  ['Sleep Tight',  'Use the Dream Chime Lullaby ability',          250,'ab_lullaby',      1],
]);

// =============================================================
// SHE WHO KEEPS THE LIGHT — narrative-layer feats (58)
// =============================================================

// 45. Reunion (6) — find each Glimmer for the first time.
b('Reunion','✦',[
  ['Hearthmote Found',     'Reach the smallest spark, Tobi',          50, 'child6_found',1],
  ['Brightspark Found',    'Reach the loudest spark, Pip',            60, 'child5_found',1],
  ['Tender Found',         'Reach the warm-glow spark, Mira',         75, 'child4_found',1],
  ['Dreamwick Found',      'Reach the slow-flame spark, Wren',        95, 'child3_found',1],
  ['Forgespark Found',     'Reach the stubborn spark, Bram, in the deep dark', 130,'child2_found',1],
  ['Tuneflame Found',      'Reach the oldest spark, Ren, at the furthest edge', 200,'child1_found',1],
]);

// 46. Bonding (6) — fill each Glimmer's bond meter to 4/4.
b('Bonding','💛',[
  ['Hearthmote\'s Drawing','Bond with Tobi (4/4 tasks)',              100,'child6_bond',1],
  ['Brightspark\'s Nod',   'Bond with Pip (4/4 tasks)',               120,'child5_bond',1],
  ['Tender\'s Quiet Day',  'Bond with Mira (4/4 tasks)',              150,'child4_bond',1],
  ['Dreamwick\'s Drawing', 'Bond with Wren (4/4 tasks)',              180,'child3_bond',1],
  ['Forgespark\'s Build',  'Bond with Bram (4/4 tasks)',              220,'child2_bond',1],
  ['Tuneflame\'s Melody',  'Bond with Ren (4/4 tasks)',               300,'child1_bond',1],
]);

// 47. Tasks (24) — every individual gameplay task.
b('Tasks','📋',[
  // Hearthmote — Tobi
  ['Light a Meal',                  'Complete Tobi\'s task 1', 30, 'task_t6_1',1],
  ['Make a Pretty Spot',            'Complete Tobi\'s task 2', 50, 'task_t6_2',1],
  ['Bring Friends Close',           'Complete Tobi\'s task 3', 80, 'task_t6_3',1],
  ['Build the Hearth-Pot',          'Complete Tobi\'s task 4', 120,'task_t6_4',1],
  // Brightspark — Pip
  ['Feed the Loud One',             'Complete Pip\'s task 1',  35, 'task_t5_1',1],
  ['Punch Back the Dark',           'Complete Pip\'s task 2',  55, 'task_t5_2',1],
  ['Burn Brighter',                 'Complete Pip\'s task 3',  85, 'task_t5_3',1],
  ['Only the Good Stuff',           'Complete Pip\'s task 4',  125,'task_t5_4',1],
  // Tender — Mira
  ['Make It Comfortable',           'Complete Mira\'s task 1', 40, 'task_t4_1',1],
  ['A Whole Little Family',         'Complete Mira\'s task 2', 60, 'task_t4_2',1],
  ['Cook Something Different',      'Complete Mira\'s task 3', 90, 'task_t4_3',1],
  ['Just — Be Warm',                'Complete Mira\'s task 4', 130,'task_t4_4',1],
  // Dreamwick — Wren
  ['Make It Beautiful',             'Complete Wren\'s task 1', 45, 'task_t3_1',1],
  ['Find What\'s Hidden',           'Complete Wren\'s task 2', 65, 'task_t3_2',1],
  ['Keep the Pot Going',            'Complete Wren\'s task 3', 95, 'task_t3_3',1],
  ['A Real Collection',             'Complete Wren\'s task 4', 135,'task_t3_4',1],
  // Forgespark — Bram
  ['Get Building',                  'Complete Bram\'s task 1', 50, 'task_t2_1',1],
  ['Set the Ward',                  'Complete Bram\'s task 2', 70, 'task_t2_2',1],
  ['Hold the Line',                 'Complete Bram\'s task 3', 100,'task_t2_3',1],
  ['Build It All',                  'Complete Bram\'s task 4', 140,'task_t2_4',1],
  // Tuneflame — Ren
  ['A Choir of Friends',            'Complete Ren\'s task 1',  55, 'task_t1_1',1],
  ['Hang the Chimes',               'Complete Ren\'s task 2',  75, 'task_t1_2',1],
  ['Cook the Best Thing',           'Complete Ren\'s task 3',  105,'task_t1_3',1],
  ['A Whole Bright Hearth',         'Complete Ren\'s task 4',  150,'task_t1_4',1],
]);

// 48. Remembering (6) — campfire upgrades.
b('Remembering','🔥',[
  ['Warm Stones',     'Tend the fire — Remembering 1', 80, 'camp_01',1],
  ['Wind Shield',     'Tend the fire — Remembering 2', 110,'camp_02',1],
  ['Carved Log',      'Tend the fire — Remembering 3', 140,'camp_03',1],
  ['Flower Ring',     'Tend the fire — Remembering 4', 170,'camp_04',1],
  ['Deep Roots',      'Tend the fire — Remembering 5', 210,'camp_05',1],
  ['The Crown Flame', 'Tend the fire — Final Remembering', 250,'camp_06',1],
]);

// 49. Memories (10) — collect each shard plus the all-shard capstone.
b('Memories','✦',[
  ['Lines She Used to Draw', 'Collect Memory Shard 01', 60, 'shard_01',1],
  ['The Work She Set Aside', 'Collect Memory Shard 02', 80, 'shard_02',1],
  ['Before the First',       'Collect Memory Shard 03', 100,'shard_03',1],
  ['Invisible',              'Collect Memory Shard 04', 120,'shard_04',1],
  ['The Tuesday',            'Collect Memory Shard 05', 150,'shard_05',1],
  ['What She Carried',       'Collect Memory Shard 06', 180,'shard_06',1],
  ['The Mirror',             'Collect Memory Shard 07', 200,'shard_07',1],
  ['What She Was at 19',     'Collect Memory Shard 08', 240,'shard_08',1],
  ['Six Reasons',             'Collect Memory Shard 09', 300,'shard_09',1],
  ['Mirror Whole',           'Collect every Memory Shard', 500,'shards_all',1],
]);

// 50. Her Craft (3) — narrative callback to the calligrapher beneath the Keeper.
b('Her Craft','🖋️',[
  ['The Lines She Drew',  'Memory Shard 01 unlocked',       150,'shard_01',1],
  ['The Student',         'Memory Shard 08 unlocked',       250,'shard_08',1],
  ['Her Hands Remember',  'Memory Shard 09 unlocked',       400,'shard_09',1],
]);

// 51. The Name (1) — Shard 10's intimate moment.
b('The Name','🌟',[
  ['Her Name',            'Hear the Hearth say her name',   500,'name_set',1],
]);

// 52. Endings (2) — both choices are valid.
b('Endings','🎭',[
  ['She Kept the Light',  'Stay a while longer.',          1000,'ending_light',1],
  ['She Remembered',      'Go home.',                       1000,'ending_home', 1],
]);

// Achievement categories for UI filtering
export const ACH_CATEGORIES = [...new Set(A.map(a => a.cat))];
