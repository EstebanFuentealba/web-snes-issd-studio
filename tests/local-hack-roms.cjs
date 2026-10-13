const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
// User-owned fixtures stay outside Git; callers state which are available.
module.exports=()=>{
 const downloads=path.join(os.homedir(),'Downloads');
 return ["Futebol Brasileiro '96 (Hack).sfc","Superstar Soccer 2 - Ronaldinho 97 (U) [p1][!].fig",'Futbol Peruano 97 (Peru) (Es) (Pirate) [b].sfc','Futbol_Chileno_96_ESP.smc',"ISSD-Hacks/ISSD-Futbol Colombiano '96.smc",'ISSD-Hacks/ISSD-Futbol Ecuatoriano 97 (Español).smc','ISSD-Hacks/ISSD-World Cup 2018-Rusia (Ver.Chile).smc'].map(name=>{
  const dir=path.join(downloads,path.dirname(name)),basename=path.basename(name).normalize('NFC');
  if(!fs.existsSync(dir))return null;
  const actual=fs.readdirSync(dir).find(n=>n.normalize('NFC')===basename);
  return actual?{name:actual,file:path.join(dir,actual)}:null;
 }).filter(Boolean);
};
