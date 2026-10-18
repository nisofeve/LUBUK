import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','site','games');
for(const [slug,folders] of [['comfront',['/assets/','/sprites/']],['plotbound',['/assets/']]]){
  const dir=path.join(root,slug);
  function visit(folder){
    for(const item of fs.readdirSync(folder,{withFileTypes:true})){
      const file=path.join(folder,item.name);
      if(item.isDirectory())visit(file);
      else if(/\.(html|js|css)$/.test(item.name)){
        let data=fs.readFileSync(file,'utf8');
        for(const prefix of folders){
          // Vite output and game asset URLs are root-relative in original builds.
          data=data.replaceAll(`"${prefix}`,`".${prefix}`).replaceAll(`'${prefix}`,`'.${prefix}`).replaceAll(`(${prefix}`,`(.${prefix}`);
        }
        fs.writeFileSync(file,data);
      }
    }
  }
  visit(dir);
  console.log(`${slug}: asset paths made relative`);
}
