const countBox=document.querySelector('#summary-counts');
const counts=[['All games',games.length],['HTML5',games.filter(game=>game.kind==='HTML5').length],['Desktop web',games.filter(game=>game.kind==='Web game for PC').length],['Windows',games.filter(game=>game.kind==='PC').length]];
for(const [label,count] of counts){const item=document.createElement('div');item.className='summary-count';const number=document.createElement('strong');number.textContent=count;const name=document.createElement('span');name.textContent=label;item.append(number,name);countBox.append(item)}

const rows=document.querySelector('#summary-rows');
for(const game of games){
  const row=document.createElement('tr');
  const gameCell=document.createElement('th');gameCell.scope='row';
  const gameLine=document.createElement('div');gameLine.className='summary-game';
  const image=document.createElement('img');image.src=`./screenshots/${game.slug}/1.png`;image.alt='';image.loading='lazy';image.decoding='async';
  const text=document.createElement('span');const name=document.createElement('strong');name.textContent=game.name;const tag=document.createElement('small');tag.textContent=game.tag;text.append(name,tag);gameLine.append(image,text);gameCell.append(gameLine);
  const platform=document.createElement('td');platform.textContent=game.kind==='HTML5'?'Browser · HTML5':game.kind==='PC'?'Windows download':'Desktop browser';
  const stage=document.createElement('td');stage.className='summary-stage';stage.textContent=game.stage||'Not specified';
  const summary=document.createElement('td');summary.className='summary-description';summary.textContent=game.info;
  const detail=document.createElement('td');const link=document.createElement('a');link.href=`./?game=${encodeURIComponent(game.slug)}`;link.textContent='View info ↗';link.setAttribute('aria-label',`View ${game.name} information`);detail.append(link);
  row.append(gameCell,platform,stage,summary,detail);rows.append(row);
}
