import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const site=path.join(root,'site');
const reports=path.join(root,'reports');
const snapshotPath=path.join(reports,'snapshot.json');
const notesPath=path.join(reports,'notes.json');
const games=[['ComFront','comfront'],['Compy','compy'],['MyMyth','mymyth'],['Plotbound','plotbound'],['Sigilbound','sigilbound'],['Type Zomba','type-zomba'],['Ketum Farmer','ketum-farmer']];
const pc=[['Hyperbloomers','Hyperbloomers-v0.2-Windows.zip'],['333','333-HD27-Windows.zip'],['TGC','TGC-42-Windows.zip']];
const files={};
const inventory=[];
function walk(dir,prefix){
  let count=0,bytes=0;
  if(!fs.existsSync(dir))return {count,bytes};
  for(const item of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
    const abs=path.join(dir,item.name),rel=`${prefix}/${item.name}`;
    if(item.isDirectory()){const result=walk(abs,rel);count+=result.count;bytes+=result.bytes;}
    else if(item.isFile()){const stat=fs.statSync(abs),hash=crypto.createHash('sha256');const fd=fs.openSync(abs,'r');const buf=Buffer.alloc(1024*1024);try{let n;while((n=fs.readSync(fd,buf,0,buf.length,null))>0)hash.update(buf.subarray(0,n));}finally{fs.closeSync(fd);}files[rel]={bytes:stat.size,sha256:hash.digest('hex')};count++;bytes+=stat.size;}
  }
  return {count,bytes};
}
let webBytes=0;
for(const [name,slug] of games){const result=walk(path.join(site,'games',slug),`games/${slug}`);webBytes+=result.bytes;inventory.push({name,kind:'HTML5',fileCount:result.count,bytes:result.bytes});}
walk(path.join(root,'pc-releases'), 'pc-releases');
for(const [name,file] of pc){const item=files[`pc-releases/${file}`];inventory.push({name,kind:'PC',fileCount:item?1:0,bytes:item?.bytes||0,file});}
const previous=fs.existsSync(snapshotPath)?JSON.parse(fs.readFileSync(snapshotPath,'utf8')):{};
const changes=[];
for(const [file,info] of Object.entries(files)){const old=previous[file];if(!old)changes.push({status:'Added',path:file,bytes:info.bytes});else if(old.sha256!==info.sha256)changes.push({status:'Updated',path:file,bytes:info.bytes});}
for(const file of Object.keys(previous))if(!files[file])changes.push({status:'Removed',path:file,bytes:0});
changes.sort((a,b)=>a.path.localeCompare(b.path));
const notes=fs.existsSync(notesPath)?JSON.parse(fs.readFileSync(notesPath,'utf8')):[];
const now=new Date().toISOString();
const report={generatedAt:now,releaseLabel:'October 2026 collection',webBytes,inventory,changes,notes};
fs.mkdirSync(reports,{recursive:true});
fs.writeFileSync(path.join(site,'report.json'),JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(snapshotPath,JSON.stringify(files,null,2)+'\n');
const logPath=path.join(reports,'history.json');const history=fs.existsSync(logPath)?JSON.parse(fs.readFileSync(logPath,'utf8')):[];
history.unshift({generatedAt:now,added:changes.filter(x=>x.status==='Added').length,updated:changes.filter(x=>x.status==='Updated').length,removed:changes.filter(x=>x.status==='Removed').length,notes:notes.length});
fs.writeFileSync(logPath,JSON.stringify(history.slice(0,100),null,2)+'\n');
console.log(`Report updated: ${inventory.length} games/builds, ${changes.length} file changes, ${(webBytes/1024/1024).toFixed(1)} MB web content.`);
