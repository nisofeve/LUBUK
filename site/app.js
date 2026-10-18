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
document.querySelector('#release-note').textContent=config.owner?'Download links activate once matching GitHub Releases assets are uploaded.':'Download links activate on GitHub Pages after matching release assets are uploaded.';
const status=document.querySelector('#report-status');
const esc=(value)=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mb=(bytes)=>`${(bytes/1024/1024).toFixed(1)} MB`;
async function updateReport(){
  const button=document.querySelector('#update-report');button.disabled=true;status.textContent='Checking latest published report…';
  try{
    const response=await fetch(`./report.json?t=${Date.now()}`,{cache:'no-store'});if(!response.ok)throw Error(`HTTP ${response.status}`);
    const report=await response.json();
    status.textContent=`Published report · ${new Date(report.generatedAt).toLocaleString()} · ${report.releaseLabel||'Current collection'}`;
    const stats=[['07','Browser games'],['03','PC builds'],[mb(report.webBytes||0),'Web collection'],[String(report.changes?.length||0),'File changes']];
    document.querySelector('#report-stats').innerHTML=stats.map(([value,label])=>`<div class="stat"><strong>${esc(value)}</strong><span>${esc(label)}</span></div>`).join('');
    document.querySelector('#report-inventory').innerHTML=(report.inventory||[]).map(x=>`<div class="inventory-row"><span>${esc(x.name)}</span><span>${esc(x.fileCount)} files · ${esc(mb(x.bytes))}</span></div>`).join('')||'<p class="empty">No builds in report.</p>';
    const groups=new Map();for(const change of report.changes||[]){const parts=change.path.split('/');const group=parts[0]==='games'?parts[1]:'PC releases';if(!groups.has(group))groups.set(group,[]);groups.get(group).push(change);}
    document.querySelector('#report-changes').innerHTML=[...groups].map(([name,items])=>`<details><summary>${esc(name)} · ${items.length} changes</summary><ul class="file-list">${items.map(x=>`<li>${esc(x.status)} · ${esc(x.path)}</li>`).join('')}</ul></details>`).join('')||'<p class="empty">No file changes since previous report. First snapshot establishes baseline.</p>';
    document.querySelector('#report-notes').innerHTML=(report.notes||[]).map(x=>`<div class="note-row"><strong>${esc(x.game)} · ${esc(x.date)}</strong>${esc(x.text)}</div>`).join('')||'<p class="empty">No gameplay notes added yet. Edit <code>reports/notes.json</code> when compiling next update.</p>';
  }catch(error){status.textContent=`Report unavailable: ${error.message}. Run local update script, then publish site.`;}
  finally{button.disabled=false;}
}
document.querySelector('#update-report').addEventListener('click',updateReport);updateReport();
