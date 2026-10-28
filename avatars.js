export const PRESET_AVATARS=[
  {id:'initials',label:'Initials'},
  {id:'cat',label:'Cat'},
  {id:'fox',label:'Fox'},
  {id:'frog',label:'Frog'},
  {id:'astronaut',label:'Space'},
  {id:'flower',label:'Flower'},
  {id:'stars',label:'Stars'}
];
const presetIds=new Set(PRESET_AVATARS.map(item=>item.id));
export function avatarPreset(value){return presetIds.has(value)?value:'initials';}
export function profileLabel(row,fallback='Member'){return String(row?.display_name||'').trim()||String(row?.username||'').trim()||fallback;}
export function avatarExtension(type){return {'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[type]||null;}
export function validateAvatarFile(file){
  if(!file||!avatarExtension(file.type))throw new Error('Choose a JPG, PNG or WebP photo.');
  if(file.size>2*1024*1024)throw new Error('Profile pictures must be 2 MB or smaller.');
  if(file.size<=0)throw new Error('Choose a non-empty photo.');
  return true;
}
