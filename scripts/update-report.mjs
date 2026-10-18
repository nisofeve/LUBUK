import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const site=path.join(root,'site');
const reports=path.join(root,'reports');
const snapshotPath=path.join(reports,'snapshot.json');
const notesPath=path.join(reports,'notes.json');
const games=[['ComFront','comfront'],['Compy','compy'],['MyMyth','mymyth'],['Plotbound','plotbound'],['Sigilbound','sigilbound'],['Type Zomba','type-zomba']];
const pc=[['Hyperbloomers','Hyperbloomers-v0.2-Windows.zip','hyperbloomers-v0.2'],["Don't Forget to Pee",'333-HD27-Windows.zip','333-hd27'],['ToGather:Crops','TGC-42-Windows.zip','tgc-42'],['Police N Thief','Police-N-Thief-v1.10-Windows.zip','police-n-thief-v1.10']];
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
for(const [name,slug] of games){const result=walk(path.join(site,'games',slug),`games/${slug}`);webBytes+=result.bytes;inventory.push({name,kind:'HTML5',fileCount:result.count,bytes:result.bytes,url:`./games/${slug}/`});}
inventory.push({name:'Skeet Shooting',kind:'HTML5',hosting:'itch.io',fileCount:0,bytes:0,url:'https://rafiktodak.itch.io/skeet-shooting'});
const ketum=walk(path.join(site,'games','ketum-farmer'),'games/ketum-farmer');webBytes+=ketum.bytes;
inventory.push({name:'Ketum Farmer',kind:'Web game for PC',fileCount:ketum.count,bytes:ketum.bytes,url:'./games/ketum-farmer/'});
const screenshots=walk(path.join(site,'screenshots'),'screenshots');webBytes+=screenshots.bytes;
for(const name of ['index.html','summary.html','report.html','games-data.js','app.js','summary.js','report.js','styles.css']){
  const file=path.join(site,name);if(!fs.existsSync(file))continue;
  const bytes=fs.readFileSync(file);files[name]={bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};webBytes+=bytes.length;
}
walk(path.join(root,'pc-releases'), 'pc-releases');
for(const [name,file,tag] of pc){const item=files[`pc-releases/${file}`];inventory.push({name,kind:'PC',fileCount:item?1:0,bytes:item?.bytes||0,file,url:`https://github.com/nisofeve/LUBUK/releases/download/${tag}/${file}`});}
const previous=fs.existsSync(snapshotPath)?JSON.parse(fs.readFileSync(snapshotPath,'utf8')):{};
const priorReportPath=path.join(site,'report.json');
const priorInventory=fs.existsSync(priorReportPath)?JSON.parse(fs.readFileSync(priorReportPath,'utf8')).inventory||[]:[];
const priorByName=new Map(priorInventory.map(item=>[item.name,item]));
const currentByName=new Map(inventory.map(item=>[item.name,item]));
const collectionChanges=[];
const renamedFrom=new Set();
for(const item of inventory){
  const old=priorByName.get(item.name);
  if(!old){
    const renamed=priorInventory.find(previous=>previous.kind==='PC'&&item.kind==='PC'&&previous.file===item.file);
    if(renamed){collectionChanges.push({status:'Renamed',name:item.name,detail:`${renamed.name} → ${item.name}`});renamedFrom.add(renamed.name);}
    else collectionChanges.push({status:'Added',name:item.name,detail:item.kind});
  }else if(old.kind!==item.kind)collectionChanges.push({status:'Moved',name:item.name,detail:`${old.kind} → ${item.kind}`});
}
for(const item of priorInventory)if(!currentByName.has(item.name)&&!renamedFrom.has(item.name))collectionChanges.push({status:'Removed',name:item.name,detail:item.kind});
const changes=[];
for(const [file,info] of Object.entries(files)){const old=previous[file];if(!old)changes.push({status:'Added',path:file,bytes:info.bytes});else if(old.sha256!==info.sha256)changes.push({status:'Updated',path:file,bytes:info.bytes});}
for(const file of Object.keys(previous))if(!files[file])changes.push({status:'Removed',path:file,bytes:0});
changes.sort((a,b)=>a.path.localeCompare(b.path));
const notes=fs.existsSync(notesPath)?JSON.parse(fs.readFileSync(notesPath,'utf8')):[];
const now=new Date().toISOString();
const report={generatedAt:now,releaseLabel:'October 2026 collection',webBytes,inventory,collectionChanges,changes,notes};
fs.mkdirSync(reports,{recursive:true});
fs.writeFileSync(path.join(site,'report.json'),JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(snapshotPath,JSON.stringify(files,null,2)+'\n');
const logPath=path.join(reports,'history.json');const history=fs.existsSync(logPath)?JSON.parse(fs.readFileSync(logPath,'utf8')):[];
history.unshift({generatedAt:now,added:changes.filter(x=>x.status==='Added').length,updated:changes.filter(x=>x.status==='Updated').length,removed:changes.filter(x=>x.status==='Removed').length,collectionChanges:collectionChanges.length,notes:notes.length});
fs.writeFileSync(logPath,JSON.stringify(history.slice(0,100),null,2)+'\n');
console.log(`Report updated: ${inventory.length} games/builds, ${changes.length} file changes, ${(webBytes/1024/1024).toFixed(1)} MB web content.`);
