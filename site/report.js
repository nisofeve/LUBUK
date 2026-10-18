const status=document.querySelector('#report-status');
const esc=(value)=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mb=(bytes)=>`${(bytes/1024/1024).toFixed(1)} MB`;
async function updateReport(){
  const button=document.querySelector('#update-report');button.disabled=true;status.textContent='Checking latest published report…';
  try{
    const response=await fetch(`./report.json?t=${Date.now()}`,{cache:'no-store'});if(!response.ok)throw Error(`HTTP ${response.status}`);
    const report=await response.json();
    status.textContent=`Published report · ${new Date(report.generatedAt).toLocaleString()} · ${mb(report.webBytes||0)} hosted web content`;
    const inventory=report.inventory||[];
    const stats=[[String(inventory.filter(x=>x.kind==='HTML5').length),'HTML5 games'],[String(inventory.filter(x=>x.kind==='Web game for PC').length),'PC web game'],[String(inventory.filter(x=>x.kind==='PC').length),'PC builds'],[String((report.changes?.length||0)+(report.collectionChanges?.length||0)),'Changes']];
    document.querySelector('#report-stats').innerHTML=stats.map(([value,label])=>`<div class="stat"><strong>${esc(value)}</strong><span>${esc(label)}</span></div>`).join('');
    document.querySelector('#report-inventory').innerHTML=inventory.map(x=>{const safeUrl=x.url&&(x.url.startsWith('./')||x.url.startsWith('https://'))?x.url:'';const label=safeUrl?`<a href="${esc(safeUrl)}" target="_blank" rel="noopener">${esc(x.name)} ↗</a>`:esc(x.name);const details=x.hosting?`${x.kind} · ${x.hosting}`:`${x.kind} · ${x.fileCount} files · ${mb(x.bytes)}`;return `<div class="inventory-row"><span>${label}</span><span>${esc(details)}</span></div>`;}).join('')||'<p class="empty">No builds in report.</p>';
    const groups=new Map();for(const change of report.changes||[]){const parts=change.path.split('/');const group=parts[0]==='games'?parts[1]:'PC releases';if(!groups.has(group))groups.set(group,[]);groups.get(group).push(change);}
    const catalog=(report.collectionChanges||[]).map(x=>`<div class="change-row"><span>${esc(x.status)} · ${esc(x.name)}</span><span>${esc(x.detail)}</span></div>`).join('');
    document.querySelector('#report-changes').innerHTML=catalog+[...groups].map(([name,items])=>`<details><summary>${esc(name)} · ${items.length} file changes</summary><ul class="file-list">${items.map(x=>`<li>${esc(x.status)} · ${esc(x.path)}</li>`).join('')}</ul></details>`).join('')||'<p class="empty">No changes since previous report.</p>';
    document.querySelector('#report-notes').innerHTML=(report.notes||[]).map(x=>`<div class="note-row"><strong>${esc(x.game)} · ${esc(x.date)}</strong>${esc(x.text)}</div>`).join('')||'<p class="empty">No gameplay notes added yet. Edit <code>reports/notes.json</code> when compiling next update.</p>';
  }catch(error){status.textContent=`Report unavailable: ${error.message}. Run local update script, then publish site.`;}
  finally{button.disabled=false;}
}
document.querySelector('#update-report').addEventListener('click',updateReport);updateReport();
