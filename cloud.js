export async function createCloudClient(config) {
  const url = String(config?.supabaseUrl || '').trim();
  const key = String(config?.supabaseAnonKey || '').trim();
  if (!/^https:\/\/[\w.-]+\.supabase\.co\/?$/.test(url) || !key) {
    throw new Error('Supabase is not configured. Add your Project URL and publishable key to config.js.');
  }
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.49.10');
  return createClient(url, key, {
    auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true }
  });
}
export const must = ({data,error}) => { if (error) throw error; return data; };

export async function loadGroups(db, userId) {
  const memberships=must(await db.from('group_members')
    .select('group_id, role, groups(id,name,owner_id,join_code)')
    .eq('user_id',userId).order('created_at',{ascending:true}));
  return (memberships||[]).filter(r=>r.groups).map(r=>({...r.groups,role:r.role}));
}
export async function loadOwnTimetables(db,userId) {
  return (must(await db.from('timetables').select('*').eq('owner_id',userId).order('created_at',{ascending:false}))||[]).map(fromRecord);
}
export async function loadGroupTimetables(db, groupId) {
  const rows=must(await db.from('group_timetables').select('timetable_id,timetables(*)').eq('group_id',groupId).order('created_at',{ascending:true}));
  return (rows||[]).filter(row=>row.timetables).map(row=>fromRecord(row.timetables));
}
export async function loadMembers(db,groupId) {
  const rows=must(await db.from('group_members').select('user_id,role,profiles(username,display_name,avatar_preset,avatar_path)').eq('group_id',groupId).order('created_at',{ascending:true}));
  return rows||[];
}
export function fromRecord(r) {return {id:r.id,name:r.name,fullName:r.full_name||'',course:r.course||'',source:r.source||'',events:r.events||[],ownerId:r.owner_id};}
export function toRecord(s,userId) {return {owner_id:userId,name:s.name,full_name:s.fullName||'',course:s.course||'',source:s.source||'',events:s.events||[]};}
export async function addTimetable(db,s,userId,groupId) {
  const saved=must(await db.from('timetables').insert(toRecord(s,userId)).select('*').single());
  try { must(await db.from('group_timetables').insert({group_id:groupId,timetable_id:saved.id,added_by:userId})); }
  catch(error){
    await db.from('timetables').delete().eq('id',saved.id);
    throw error;
  }
  return fromRecord(saved);
}
export async function updateTimetable(db,s,userId) {
  return fromRecord(must(await db.from('timetables').update(toRecord(s,userId)).eq('id',s.id).eq('owner_id',userId).select('*').single()));
}
export async function setGroupTimetable(db,groupId,timetableId,userId,included) {
  if (included) must(await db.from('group_timetables').insert({group_id:groupId,timetable_id:timetableId,added_by:userId}));
  else must(await db.from('group_timetables').delete().eq('group_id',groupId).eq('timetable_id',timetableId));
}
export async function createGroup(db,name) { return must(await db.rpc('create_group',{p_name:name})); }
export async function joinGroup(db,code) { return must(await db.rpc('join_group',{p_code:code})); }
export async function rotateInvite(db,id) { return must(await db.rpc('rotate_group_invite',{p_group_id:id})); }
