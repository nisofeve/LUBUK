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
