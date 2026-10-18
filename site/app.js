const games = [
  {name:'ComFront',slug:'comfront',tag:'ACTION / SURVIVAL',desc:'Compliance Frontier',glyph:'C',colors:['#153e57','#102136']},
  {name:'Compy',slug:'compy',tag:'COMPANION',desc:'Companion & Me',glyph:'&',colors:['#654265','#2b294e']},
  {name:'MyMyth',slug:'mymyth',tag:'FANTASY',desc:'Creatures, care, and adventure',glyph:'M',colors:['#6a452b','#32213c']},
  {name:'Plotbound',slug:'plotbound',tag:'DECK BUILDING',desc:'Farming roguelike',glyph:'P',colors:['#466536','#1b3b33']},
  {name:'Sigilbound',slug:'sigilbound',tag:'CARD COMBAT',desc:'Roguelike card battles',glyph:'S',colors:['#6b3039','#2a1d38']},
  {name:'Type Zomba',slug:'type-zomba',tag:'ARCADE',desc:'Type to survive',glyph:'Z',colors:['#385478','#202840']},
  {name:'Ketum Farmer',slug:'ketum-farmer',tag:'FARMING',desc:'Browser game',glyph:'K',colors:['#5c5a2a','#303e28']},
];
const pc = [
  {name:'Hyperbloomers',version:'v0.2',tag:'hyperbloomers-v0.2',file:'Hyperbloomers-v0.2-Windows.zip',size:'473 MB'},
  {name:'333',version:'HD 27',tag:'333-hd27',file:'333-HD27-Windows.zip',size:'734 MB'},
  {name:'TGC',version:'Build 42',tag:'tgc-42',file:'TGC-42-Windows.zip',size:'285 MB'},
];
const gameGrid = document.querySelector('#game-grid');
for (const [i,game] of games.entries()) {
  const a=document.createElement('a'); a.className='game-card'; a.href=`./games/${game.slug}/`; a.target='_blank'; a.rel='noopener'; a.dataset.glyph=game.glyph; a.style.setProperty('--card-a',game.colors[0]); a.style.setProperty('--card-b',game.colors[1]);
  a.innerHTML=`<div class="card-top"><span class="card-kicker">${String(i+1).padStart(2,'0')} / ${game.tag}</span><span class="card-arrow" aria-hidden="true">↗</span></div><div class="card-bottom"><h3>${game.name}</h3><p>${game.desc}</p></div>`;
  gameGrid.append(a);
}
const config={owner:'nisofeve',repo:'LUBUK'};
if(!config.owner && location.hostname.endsWith('.github.io')) {config.owner=location.hostname.split('.')[0];config.repo=location.pathname.split('/').filter(Boolean)[0]||`${config.owner}.github.io`;}
const downloadGrid=document.querySelector('#download-grid');
for (const item of pc) {
  const card=document.createElement('article');card.className='download-card';
  const url=config.owner&&config.repo?`https://github.com/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/releases/download/${encodeURIComponent(item.tag)}/${encodeURIComponent(item.file)}`:'';
  card.innerHTML=`<span class="card-kicker">WINDOWS · ${item.version}</span><h3>${item.name}</h3><p>${item.size} ZIP package</p><a ${url?`href="${url}"`:'aria-disabled="true"'}>Download build ↗</a>`;
  downloadGrid.append(card);
}
document.querySelector('#release-note').textContent=config.owner?'Windows builds available through GitHub Releases.':'Download links activate on GitHub Pages after matching release assets are uploaded.';
