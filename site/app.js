const games = [
  {name:'ComFront',slug:'comfront',kind:'HTML5',tag:'ACTION / SURVIVAL',desc:'Compliance Frontier',info:'Top-down survival action with solo and online multiplayer options. First launch includes character setup and orientation training.',glyph:'C',colors:['#153e57','#102136'],shots:2},
  {name:'Compy',slug:'compy',kind:'HTML5',tag:'COMPANION',desc:'Companion & Me',info:'A companion adventure with story choices, crafting, tasks, and a character you can care for.',glyph:'&',colors:['#654265','#2b294e'],shots:2},
  {name:'MyMyth',slug:'mymyth',kind:'HTML5',tag:'FANTASY',desc:'Creatures, care, and adventure',info:'Explore a fantasy world, meet and care for Myths, and take on battles. Guest play is available; an account can save online progress.',glyph:'M',colors:['#6a452b','#32213c'],shots:2},
  {name:'Plotbound',slug:'plotbound',kind:'HTML5',tag:'DECK BUILDING',desc:'Farming roguelike',info:'A farming game with cards, stages, quests, and a growing farmstead.',glyph:'P',colors:['#466536','#1b3b33'],shots:3},
  {name:'Sigilbound',slug:'sigilbound',kind:'HTML5',tag:'CARD COMBAT',desc:'Roguelike card battles',info:'Build a deck and fight through turn-based roguelike encounters.',glyph:'S',colors:['#6b3039','#2a1d38'],shots:3},
  {name:'Type Zomba',slug:'type-zomba',kind:'HTML5',tag:'ARCADE',desc:'Type to survive',info:'Fast arcade survival: type words to stop approaching zombies and build your score.',glyph:'Z',colors:['#385478','#202840'],shots:2},
  {name:'Skeet Shooting',slug:'skeet-shooting',kind:'HTML5',tag:'ARCADE / ITCH.IO',desc:'Skeet shooter · play on itch.io',info:'Fast-paced skeet shooting, optimized for mobile. Tap to aim and shoot; on PC, use left and right arrow keys.',url:'https://rafiktodak.itch.io/skeet-shooting',access:'itch.io password: 123todak',glyph:'S',colors:['#496b84','#1c3c59'],shots:2},
  {name:'Ketum Farmer',slug:'ketum-farmer',kind:'Web game for PC',tag:'WEB GAME FOR PC',desc:'Desktop browser game',info:'A farming and operations game for desktop browsers. Plant and harvest crops, manage workers, and research upgrades. This is a publisher preview build.',glyph:'K',colors:['#527632','#243a24'],shots:2},
  {name:'Hyperbloomers',slug:'hyperbloomers',kind:'PC',tag:'WINDOWS · v0.2',desc:'473 MB ZIP package',info:'Play as Sun and Cloud in a cooperative farming adventure. Work together to grow crops and explore.',release:'hyperbloomers-v0.2',file:'Hyperbloomers-v0.2-Windows.zip',shots:3},
  {name:'333',slug:'333',kind:'PC',tag:'WINDOWS · HD 27',desc:'734 MB ZIP package',info:'First-person horror exploration with relic collecting. Screenshots come from the project prototype; Windows HD 27 build may differ.',release:'333-hd27',file:'333-HD27-Windows.zip',shots:2},
  {name:'TGC',slug:'tgc',kind:'PC',tag:'WINDOWS · Build 42',desc:'285 MB ZIP package',info:'A 3D farm adventure: explore, solve puzzles, collect resources, and care for animals.',release:'tgc-42',file:'TGC-42-Windows.zip',shots:3},
];
const config={owner:'nisofeve',repo:'LUBUK'};
function destination(game){return game.url || (game.kind==='PC'?`https://github.com/${config.owner}/${config.repo}/releases/download/${game.release}/${game.file}`:`./games/${game.slug}/`)}
const gameGrid=document.querySelector('#game-grid');
const downloadGrid=document.querySelector('#download-grid');
function makeCard(game,index){
  const button=document.createElement('button');button.type='button';button.className=game.kind==='HTML5'?'game-card':'download-card';button.setAttribute('aria-label',`View ${game.name} game information`);button.addEventListener('click',()=>openGame(game));
  if(game.kind==='HTML5'){
    button.dataset.glyph=game.glyph;button.style.setProperty('--card-a',game.colors[0]);button.style.setProperty('--card-b',game.colors[1]);
    button.innerHTML=`<div class="card-top"><span class="card-kicker">${String(index+1).padStart(2,'0')} / ${game.tag}</span><span class="card-arrow" aria-hidden="true">↗</span></div><div class="card-bottom"><h3>${game.name}</h3><p>${game.desc}</p></div>`;
  }else button.innerHTML=`<span class="card-kicker">${game.tag}</span><h3>${game.name}</h3><p>${game.desc}</p><span class="download-card-more">View game info ↗</span>`;
  return button;
}
games.forEach((game,index)=>(game.kind==='HTML5'?gameGrid:downloadGrid).append(makeCard(game,index)));
document.querySelector('#release-note').textContent='Windows ZIPs are hosted in GitHub Releases. Ketum Farmer opens in a desktop browser.';
const dialog=document.querySelector('#game-dialog');
const mainImage=document.querySelector('#dialog-image');
const thumbs=document.querySelector('#screenshot-thumbs');
let activeGame=null,activeShot=0;
function showShot(index){
  if(!activeGame)return;
  activeShot=(index+activeGame.shots)%activeGame.shots;
  mainImage.src=`./screenshots/${activeGame.slug}/${activeShot+1}.png`;
  mainImage.alt=`${activeGame.name} screenshot ${activeShot+1} of ${activeGame.shots}`;
  document.querySelector('#screenshot-count').textContent=`${activeShot+1} / ${activeGame.shots}`;
  [...thumbs.children].forEach((button,i)=>{button.setAttribute('aria-current',String(i===activeShot));button.tabIndex=i===activeShot?0:-1});
}
function reportLine(label,value){const row=document.createElement('p');const strong=document.createElement('strong');strong.textContent=`${label}: `;row.append(strong,document.createTextNode(value));return row}
async function loadGameReport(game){
  const box=document.querySelector('#dialog-report');box.textContent='Loading latest report…';
  try{
    const response=await fetch(`./report.json?t=${Date.now()}`,{cache:'no-store'});if(!response.ok)throw Error(`HTTP ${response.status}`);
    const report=await response.json();if(activeGame!==game)return;
    const item=report.inventory?.find(x=>x.name===game.name);box.replaceChildren();
    box.append(reportLine('Published',new Date(report.generatedAt).toLocaleDateString()));
    if(item){box.append(reportLine('Build',item.kind+(item.hosting?` · ${item.hosting}`:'')));if(item.fileCount)box.append(reportLine('Files',String(item.fileCount)));if(item.bytes)box.append(reportLine('Size',`${(item.bytes/1024/1024).toFixed(1)} MB`));}
    const change=[...(report.collectionChanges||[]).filter(x=>x.name===game.name),...(report.changes||[]).filter(x=>x.path?.startsWith(`games/${game.slug}/`)||x.path?.startsWith(`screenshots/${game.slug}/`))];
    const notes=(report.notes||[]).filter(x=>x.game===game.name);
    box.append(reportLine('Recent updates',change.length?`${change.length} listed in published report`:'No new files since last report'));
    for(const note of notes.slice(-2))box.append(reportLine(note.date,note.text));
  }catch(error){if(activeGame===game)box.textContent='Report unavailable. See full update report for details.'}
}
function openGame(game){
  activeGame=game;document.querySelector('#dialog-kind').textContent=game.tag;document.querySelector('#dialog-title').textContent=game.name;document.querySelector('#dialog-description').textContent=game.desc;document.querySelector('#dialog-info').textContent=game.info;
  const access=document.querySelector('#dialog-access');access.textContent=game.access||'';access.hidden=!game.access;
  const action=document.querySelector('#dialog-action');action.href=destination(game);action.textContent=game.kind==='PC'?'Download Windows game ↗':game.url?'Play on itch.io ↗':'Play game ↗';
  thumbs.replaceChildren();for(let i=0;i<game.shots;i++){const button=document.createElement('button');button.type='button';button.setAttribute('aria-label',`Show screenshot ${i+1}`);const img=document.createElement('img');img.src=`./screenshots/${game.slug}/${i+1}.png`;img.alt='';img.loading='lazy';button.append(img);button.addEventListener('click',()=>showShot(i));thumbs.append(button)}
  showShot(0);loadGameReport(game);dialog.showModal();
}
document.querySelector('#dialog-close').addEventListener('click',()=>dialog.close());
document.querySelector('#screenshot-prev').addEventListener('click',()=>showShot(activeShot-1));
document.querySelector('#screenshot-next').addEventListener('click',()=>showShot(activeShot+1));
dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()});
dialog.addEventListener('close',()=>{activeGame=null;mainImage.removeAttribute('src')});
