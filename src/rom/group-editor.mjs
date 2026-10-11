import {teamCount,teamExists,activeTeamIds,hasEmptyTeams} from './team-count.mjs';
import {groupSelectorPatches,groupColumns,readGroups,hasCustomGroups,GROUP_EDITOR_RULES} from './groups.mjs';
import {graphicPatches,selectionGroupGraphics,flagPatches,flagMatrix} from './graphics.mjs';
import {previewGroupText,groupTexts} from './group-text.mjs';

export function editableGroups(rom){if(hasEmptyTeams(rom))return [];const names=groupTexts(rom);return readGroups(rom).map((g,i)=>({...g,name:names[i]}));}
// Keep cartridge IDs stable: scenarios and All-Star rosters reference them.
// Removal changes every selector group while retaining the squad's data.
export function removeTeamPatches(original,current,team){
 if(!Number.isInteger(team)||team<0||team>=teamCount(current))throw new Error('Equipo inválido.');
 const groups=editableGroups(current);
 if(!groups.some(g=>g.teams.includes(team)))throw new Error('El equipo ya está fuera de los grupos seleccionables.');
 return editGroupsPatches(original,current,groups.map(g=>({...g,teams:g.teams.filter(id=>id!==team)})));
}
export function editGroupsPatches(original,current,groups,columns=groupColumns(current)){
 groups=groups.map(g=>({name:g.name.trim().toUpperCase(),teams:g.teams.slice()}));
 if(groups.some(g=>g.teams.some(t=>!teamExists(current,t))))throw new Error('Un grupo referencia un equipo eliminado.');
 if(!hasCustomGroups(original))for(const [,offset,size] of GROUP_EDITOR_RULES.slice(0,3))if(original.slice(offset,offset+size).some(b=>b!==255))throw new Error('El espacio reservado para los grupos está ocupado.');
 const before=editableGroups(current),headers=selectionGroupGraphics(current);
 const matrices=groups.map((g,i)=>{const old=before[i]?.name===g.name?i:before.findIndex(b=>b.name===g.name);return old>=0?headers[old].matrix:previewGroupText(original,{id:`selection-group:${i}`},g.name).matrix;});
 const patches=new Map(),candidate=current.slice(),put=p=>{patches.set(p.id,p);candidate.set(p.bytes,p.offset);};
 groupSelectorPatches(original,groups,{columns,teamLimit:teamCount(current)}).forEach(put);
 const flagTeam=activeTeamIds(candidate)[0];
 flagPatches(original,candidate,flagTeam,flagMatrix(candidate,flagTeam),false,true).forEach(put);
 // Rebuild the atlas in the new group order, preserving drawings for titles
 // that keep their names. Renaming a group rasterizes its new text.
 for(let i=0;i<groups.length;i++)graphicPatches(original,candidate,selectionGroupGraphics(candidate)[i],matrices[i]).forEach(put);
 return [...patches.values()];
}
