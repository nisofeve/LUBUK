const config={owner:'nisofeve',repo:'LUBUK'};
function destination(game){return game.url || (game.kind==='PC'?`https://github.com/${config.owner}/${config.repo}/releases/download/${game.release}/${game.file}`:`./games/${game.slug}/`)}
const gameGrid=document.querySelector('#game-grid');
const downloadGrid=document.querySelector('#download-grid');
const mobileGrid=document.querySelector('#mobile-grid');
function makeCard(game,index){
  const button=document.createElement('button');button.type='button';button.className=game.kind==='HTML5'?'game-card':'download-card';button.setAttribute('aria-label',`View ${game.name} game information`);button.addEventListener('click',()=>openGame(game));
  if(game.colors){button.style.setProperty('--card-a',game.colors[0]);button.style.setProperty('--card-b',game.colors[1])}
  button.innerHTML=`<img class="card-hero" src="./screenshots/${game.slug}/1.png" alt="" loading="lazy" decoding="async"><div class="card-top"><span class="card-kicker">${String(index+1).padStart(2,'0')} / ${game.tag}</span><span class="card-arrow" aria-hidden="true">↗</span></div><div class="card-bottom"><h3>${game.name}</h3><p>${game.desc}</p></div>`;
  return button;
}
games.forEach((game,index)=>(game.kind==='HTML5'?gameGrid:game.kind==='Android'?mobileGrid:downloadGrid).append(makeCard(game,index)));
document.querySelector('#release-note').textContent='Windows ZIPs are hosted in GitHub Releases. Desktop web games open in a browser.';
const dialog=document.querySelector('#game-dialog');
const mainImage=document.querySelector('#dialog-image');
const thumbs=document.querySelector('#screenshot-thumbs');
let activeGame=null,activeShot=0;
function showShot(index){
  if(!activeGame)return;
  activeShot=(index+activeGame.shots)%activeGame.shots;
  mainImage.src=`./screenshots/${activeGame.slug}/${activeShot+1}.png`;
  const galleryLabels={tgc:['Title artwork','Gameplay','Main menu'],'333':['Title artwork','Gameplay','Character scene'],'police-n-thief':['Title screen','Gameplay','Costumes']};
  const label=galleryLabels[activeGame.slug]?.[activeShot]||(activeShot===0?'Title screen':`Gameplay ${activeShot}`);
  mainImage.alt=`${activeGame.name} ${label.toLowerCase()}`;
  document.querySelector('#screenshot-count').textContent=`${label} · ${activeShot+1} / ${activeGame.shots}`;
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
  activeGame=game;document.querySelector('#dialog-kind').textContent=game.tag;document.querySelector('#dialog-title').textContent=game.name;document.querySelector('#dialog-description').textContent=game.desc;document.querySelector('#dialog-stage').textContent=`Production stage: ${game.stage||'Not specified'}`;document.querySelector('#dialog-info').textContent=game.info;
  const index=games.indexOf(game),previous=games[(index-1+games.length)%games.length],next=games[(index+1)%games.length];
  document.querySelector('#game-prev').setAttribute('aria-label',`Previous game: ${previous.name}`);document.querySelector('#game-prev-name').textContent=previous.name;
  document.querySelector('#game-next').setAttribute('aria-label',`Next game: ${next.name}`);document.querySelector('#game-next-name').textContent=next.name;
  document.querySelector('#game-position').textContent=`${index+1} / ${games.length}`;
  const access=document.querySelector('#dialog-access');access.textContent=game.access||'';access.hidden=!game.access;
  const action=document.querySelector('#dialog-action');action.href=destination(game);action.textContent=game.kind==='PC'?'Download Windows game ↗':game.kind==='Android'?'Get on Google Play ↗':game.url?.includes('itch.io')?'Play on itch.io ↗':game.url?'Play online ↗':'Play game ↗';
  thumbs.replaceChildren();for(let i=0;i<game.shots;i++){const button=document.createElement('button');button.type='button';button.setAttribute('aria-label',`Show screenshot ${i+1}`);const img=document.createElement('img');img.src=`./screenshots/${game.slug}/${i+1}.png`;img.alt='';img.loading='lazy';button.append(img);button.addEventListener('click',()=>showShot(i));thumbs.append(button)}
  showShot(0);loadGameReport(game);if(!dialog.open)dialog.showModal();dialog.querySelector('.dialog-content').scrollTop=0;
}
function changeGame(offset){if(!activeGame)return;openGame(games[(games.indexOf(activeGame)+offset+games.length)%games.length])}
document.querySelector('#game-prev').addEventListener('click',()=>changeGame(-1));
document.querySelector('#game-next').addEventListener('click',()=>changeGame(1));
document.querySelector('#dialog-close').addEventListener('click',()=>dialog.close());
document.querySelector('#screenshot-prev').addEventListener('click',()=>showShot(activeShot-1));
document.querySelector('#screenshot-next').addEventListener('click',()=>showShot(activeShot+1));
dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()});
dialog.addEventListener('close',()=>{activeGame=null;mainImage.removeAttribute('src')});
const requestedGame=new URLSearchParams(location.search).get('game');
if(requestedGame){const game=games.find(item=>item.slug===requestedGame);if(game)openGame(game)}
