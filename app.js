import {DAYS,SHORT_DAYS,START_DAY,END_DAY,formatTime,shortTime,duration,parseHHMM,newId,parseNypPages,commonWindows,occupiedRuns,overlapsCSV,personalWeekEvents} from './lib.js';
import {examples} from './examples.js';
import {createCloudClient,must,loadGroups,loadOwnTimetables,loadGroupTimetables,loadMembers,addTimetable,updateTimetable,setGroupTimetable,createGroup,joinGroup,rotateInvite} from './cloud.js';

const $=id=>document.getElementById(id);
const SETTINGS_KEY='commonground_settings_v1';
const GUEST_KEY='commonground_guest_session_v3';
function readGuest(){try{const value=JSON.parse(sessionStorage.getItem(GUEST_KEY)||'[]');return Array.isArray(value)?value.filter(s=>typeof s?.name==='string'&&Array.isArray(s.events)):[];}catch{return [];}}
let guestSchedules=readGuest();
function persistGuest(){try{sessionStorage.setItem(GUEST_KEY,JSON.stringify(guestSchedules));}catch{}}
function setGuestSchedules(next){guestSchedules=next;persistGuest();if(!user){schedules=guestSchedules;render();}}
function openSignIn(){setAuthMode('signin');$('authScreen').hidden=false;$('authScreen').setAttribute('aria-hidden','false');}
function closeSignIn(){if(recoveryActive)return;$('authScreen').hidden=true;$('authScreen').setAttribute('aria-hidden','true');}

const colors=[['#e9e7ff','#695de0'],['#fdf0df','#bd8734'],['#e2f6f6','#2996a0'],['#fde5f0','#c96895'],['#e7edf9','#5279bb'],['#eaf7e1','#679c43'],['#e8f0fa','#4874b1']];
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let db=null,user=null,profile=null,groups=[],activeGroupId=null,library=[],schedules=[],members=[];
let settings={week:8,min:60,mode:'between',onlineBusy:true,sort:'day'};
try{settings={...settings,...JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}')};}catch{}
let personalSelectedId=null,personalMode='grid';
let editingId=null,editable=[],selectedKey=null,toastTimer=null,uploadBusy=false,authMode='signin',sessionVersion=0,pendingJoinCode=null,recoveryActive=false;
const getGroup=()=>groups.find(g=>g.id===activeGroupId);
const amOwner=()=>getGroup()?.owner_id===user?.id;
const getOpts=()=>({week:+settings.week,min:+settings.min,mode:settings.mode,onlineBusy:settings.onlineBusy,start:START_DAY,end:END_DAY});
const allWindows=()=>commonWindows(schedules,getOpts());
const windowKey=w=>`${w.day}-${w.start}-${w.end}`;
const persistSettings=()=>{try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));}catch{}};
function notify(message){const node=$('toast');node.textContent=message;node.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.classList.remove('show'),4800);}
function notice(message,ok=false){const n=$('uploadNotice');n.hidden=false;n.className='notice'+(ok?' ok':'');n.textContent=message;}
function clearNotice(){$('uploadNotice').hidden=true;}
function displayError(error){notify(error?.message||String(error||'Something went wrong.'));console.error(error);}
async function safeAction(fn){try{await fn();}catch(e){displayError(e);}}
function memberName(id){return members.find(m=>m.user_id===id)?.profiles?.username|| (id===user?.id?profile?.username:'Group member') ||'Group member';}
function inviteURL(code){return `${location.origin}${location.pathname}?join=${encodeURIComponent(code)}`;}
async function copyText(value){try{await navigator.clipboard.writeText(value);notify('Copied to clipboard.');}catch{notify('Clipboard unavailable. Select and copy the text manually.');}}

async function reloadGroup(){
  if (!db||!user||!activeGroupId){schedules=[];members=[];render();return;}
  [schedules,members]=await Promise.all([loadGroupTimetables(db,activeGroupId),loadMembers(db,activeGroupId)]);
  render();
}
async function reloadWorkspace(preferredId=null){
  if (!db||!user)return;
  [groups,library]=await Promise.all([loadGroups(db,user.id),loadOwnTimetables(db,user.id)]);
  const stored=localStorage.getItem(`commonground_active_group_${user.id}`);
  activeGroupId=[preferredId,activeGroupId,stored,groups[0]?.id].find(id=>id&&groups.some(g=>g.id===id))||null;
  if(activeGroupId)localStorage.setItem(`commonground_active_group_${user.id}`,activeGroupId);
  await reloadGroup();
}
async function handleSession(session){
  const run=++sessionVersion;
  if (recoveryActive && session?.user) return;
  if (!session?.user){
    user=null;profile=null;groups=[];library=[];schedules=guestSchedules;members=[];activeGroupId=null;
    closeSignIn();$('logoutButton').hidden=true;$('loginButton').hidden=false;
    $('accountLabel').textContent='Guest';$('userAvatar').textContent='GU';render();return;
  }
  const newUser=session.user;
  user=newUser;
  try{
    const profileRow=must(await db.from('profiles').select('username').eq('id',newUser.id).single());
    if(run!==sessionVersion)return;
    profile=profileRow;
    $('accountLabel').textContent=profile?.username||newUser.email||'Signed in';
    $('userAvatar').textContent=(profile?.username||'CG').slice(0,2).toUpperCase();
    $('logoutButton').hidden=false;$('loginButton').hidden=true;
    await reloadWorkspace();
    if(run!==sessionVersion)return;
    $('authScreen').hidden=true;$('authScreen').setAttribute('aria-hidden','true');
    if(pendingJoinCode){const code=pendingJoinCode;pendingJoinCode=null;await safeAction(async()=>{const id=await joinGroup(db,code);await reloadWorkspace(id);notify('Joined the group!')});history.replaceState(null,'',location.pathname+location.hash);}
  }catch(e){if(run===sessionVersion){$('authScreen').hidden=false;authMessage(e?.message||'Could not load account.');}}
}
function authMessage(text){$('authMessage').textContent=text||'';}
function setAuthMode(mode){
  authMode=mode;
  const signup=mode==='signup',reset=mode==='recovery';
  $('tabSignIn').classList.toggle('chosen',!signup);
  $('tabSignUp').classList.toggle('chosen',signup);
  $('usernameField').hidden=!signup;
  $('authUsername').required=signup;
  $('authPassword').autocomplete=signup?'new-password':reset?'new-password':'current-password';
  $('authEmail').disabled=reset;
  $('authTitle').textContent=signup?'Create your account.':reset?'Choose a new password.':'Welcome back.';
  $('authIntro').textContent=signup?'Save your timetable and share it with your groups.':reset?'Set a new password to keep your account secure.':'Sign in to save your comparisons and organize timetable groups.';
  $('authSubmit').textContent=signup?'Create account →':reset?'Save new password →':'Sign in →';
  $('resetPasswordButton').hidden=reset;
  authMessage('');
}
async function handleAuthSubmit(e){
  e.preventDefault();if(!db){authMessage('Set up Supabase in config.js first.');return;}
  $('authSubmit').disabled=true;
  try{
    const email=$('authEmail').value.trim(),password=$('authPassword').value;
    if(authMode==='recovery'){
      if(password.length<6)throw new Error('Password must be at least 6 characters.');
      must(await db.auth.updateUser({password}));recoveryActive=false;setAuthMode('signin');authMessage('Password updated. You can now sign in.');
    }else if(authMode==='signup'){
      const username=$('authUsername').value.trim();
      if(!/^[A-Za-z0-9_]{3,24}$/.test(username))throw new Error('Username must have 3–24 letters, numbers, or underscores.');
      const {data,error}=await db.auth.signUp({email,password,options:{data:{username},emailRedirectTo:`${location.origin}${location.pathname}${pendingJoinCode?'?join='+encodeURIComponent(pendingJoinCode):''}`}});
      if(error)throw error;
      if(data?.session){await handleSession(data.session)}
      else {setAuthMode('signin');authMessage('Account requested! Check your email to confirm your account, then sign in.');}
    }else{
      must(await db.auth.signInWithPassword({email,password}));
    }
  }catch(err){authMessage(err?.message||'Authentication failed.');}
  finally{$('authSubmit').disabled=false;}
}

function renderGroups(){
  const guest=!user;
  $('guestPanel').hidden=!guest;
  $('guestGroupHeading').hidden=!guest;
  $('signedGroupHeading').hidden=guest;
  $('groupPanel').hidden=guest;
  $('saveGuestPanel').hidden=guest||!guestSchedules.length;
  $('saveGuestDescription').textContent=guestSchedules.length+` unsaved guest timetable${guestSchedules.length===1?'':'s'}. Choose a group and save them to your account.`;
  $('saveGuestButton').textContent=activeGroupId?'Save to selected group →':'Create group & save →';
  $('guestCount').textContent=`${guestSchedules.length} timetable${guestSchedules.length===1?'':'s'} in this guest session`;
  $('scheduleDescription').textContent=guest?'Compare temporary timetables on this device. No account or database required.':'Only the selected group’s timetables are compared. Extracted lesson data is saved in your account.';
  const select=$('groupSelect');
  select.innerHTML=groups.length?groups.map(g=>`<option value="${g.id}" ${g.id===activeGroupId?'selected':''}>${escapeHTML(g.name)}</option>`).join(''):'<option value="">No groups yet</option>';
  select.disabled=!groups.length;
  $('groupMeta').textContent=getGroup()?`${members.length} member${members.length===1?'':'s'} · ${schedules.length} included timetable${schedules.length===1?'':'s'} · ${amOwner()?'You are the owner':'Shared group'}`:'Create your first group, then upload a timetable or join a friend’s group.';
  for(const id of ['inviteButton','membersButton','groupSettingsButton'])$(id).disabled=!activeGroupId;
  $('groupSettingsButton').hidden=!amOwner();
  $('libraryPanel').hidden=guest||!activeGroupId;
  $('migrateButton').hidden=!activeGroupId||!readLegacy().length;
  const included=new Set(schedules.map(s=>s.id));
  $('libraryList').innerHTML=library.length?library.map(s=>`<label class="library-item"><input type="checkbox" data-link="${escapeHTML(s.id)}" ${included.has(s.id)?'checked':''} aria-label="Include ${escapeHTML(s.name)} in this group"/><span class="library-item-body"><strong title="${escapeHTML(s.fullName||s.name)}">${escapeHTML(s.name)}</strong><small>${s.events.length} lesson blocks · ${escapeHTML(s.source||'Manual timetable')}</small></span><button type="button" class="library-edit" data-edit-library="${escapeHTML(s.id)}" title="Review timetable">Edit</button><button type="button" class="delete-library" data-delete-library="${escapeHTML(s.id)}" title="Delete permanently from your account" aria-label="Permanently delete ${escapeHTML(s.name)}">×</button></label>`).join(''):'<div class="library-empty">Your library is empty. Upload a PDF or create a timetable to get started.</div>';
  $('libraryList').querySelectorAll('[data-link]').forEach(input=>input.addEventListener('change',async()=>{
    const wasIncluded=!input.checked;
    input.disabled=true;
    try{await setGroupTimetable(db,activeGroupId,input.dataset.link,user.id,!wasIncluded);await reloadGroup();notify(!wasIncluded?'Timetable included in this group.':'Timetable removed from this group.');}
    catch(e){input.checked=wasIncluded;displayError(e)}finally{input.disabled=false;}
  }));
  $('libraryList').querySelectorAll('[data-edit-library]').forEach(button=>button.addEventListener('click',()=>openEditor(button.dataset.editLibrary)));
  $('libraryList').querySelectorAll('[data-delete-library]').forEach(button=>button.addEventListener('click',()=>safeAction(async()=>{
    const s=library.find(x=>x.id===button.dataset.deleteLibrary);
    if(!s||!confirm(`Permanently delete ${s.name}'s timetable from your account and all groups?`))return;
    must(await db.from('timetables').delete().eq('id',s.id).eq('owner_id',user.id));
    await reloadWorkspace();notify('Timetable permanently deleted.');
  })));
}
function renderRoster(){
  const cards=schedules.map((p,index)=>{
    const [bg,fg]=colors[index%colors.length];
    const initials=p.name.trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase();
    const canRemove=!user||amOwner()||p.ownerId===user?.id;
    const canEdit=!user||p.ownerId===user?.id;
    return `<div class="person-card">${canRemove?`<button title="Remove ${escapeHTML(p.name)} from this group" aria-label="Remove ${escapeHTML(p.name)} from this group" class="remove-person" data-remove="${escapeHTML(p.id)}" type="button">×</button>`:''}<div class="person-top"><div class="person-avatar" style="background:${bg};color:${fg}">${escapeHTML(initials)}</div><div style="min-width:0"><div class="person-name" title="${escapeHTML(p.fullName||p.name)}">${escapeHTML(p.name)}</div><div class="person-sub">${p.events.length} lesson blocks</div><div class="person-owner">${user?'by '+escapeHTML(memberName(p.ownerId)):'Guest · not saved'}</div></div></div><div class="person-card-footer"><div class="person-status" style="${p.events.length?'':'color:#c88a3e'}">${p.events.length?'Ready to compare':'Add lessons first'}</div><span class="person-links"><button class="view-person" data-view="${escapeHTML(p.id)}" type="button">View classes</button>${canEdit?`<button class="edit-person" data-edit="${escapeHTML(p.id)}" type="button">Review ↗</button>`:''}</span></div></div>`;
  }).join('');
  const uploader=`<button id="dropCard" class="drop-card" type="button" ${user&&!activeGroupId?'disabled':''}><span class="plus-icon">+</span><strong>Add timetable PDF</strong><small>Click to browse or drop your file here</small></button>`;
  let extras='';
  if(!schedules.length)extras=`<div class="empty-hint" style="grid-column:1/-1">${!user?'Upload one or more NYP timetable PDFs to compare for free. ':activeGroupId?'No timetables selected for this group. '+(library.length?'Use the library checkboxes above, or ':''):'Create or join a group first. '}${!user||activeGroupId?'<button class="text-button" id="tryDemoInline" type="button" style="color:#6b5de4;padding:0">Load the 3 example timetables ↗</button>':''}</div>`;
  $('rosterGrid').innerHTML=cards+uploader+extras;
  $('dropCard').addEventListener('click',()=>$('pdfInput').click());
  $('tryDemoInline')?.addEventListener('click',()=>safeAction(loadDemo));
  document.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>openEditor(b.dataset.edit)));
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{personalSelectedId=b.dataset.view;renderPersonal();$('my-timetable').scrollIntoView({behavior:'smooth',block:'start'});}));
  document.querySelectorAll('[data-remove]').forEach(b=>b.addEventListener('click',()=>safeAction(async()=>{
    const p=schedules.find(s=>s.id===b.dataset.remove);
    if(!p||!confirm(!user?`Remove ${p.name}'s timetable from this guest comparison?`:`Remove ${p.name}'s timetable from this group? It stays in its owner's library.`))return;
    if(!user){setGuestSchedules(guestSchedules.filter(s=>s.id!==p.id));notify('Removed from guest comparison.');return;}
    await setGroupTimetable(db,activeGroupId,p.id,user.id,false);
    await reloadGroup();notify('Timetable removed from this group.');
  })));
  const drop=$('dropCard');
  drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('dragover')});
  drop.addEventListener('dragleave',()=>drop.classList.remove('dragover'));
  drop.addEventListener('drop',async e=>{e.preventDefault();drop.classList.remove('dragover');await importFiles(e.dataTransfer.files)});
  $('navCount').textContent=schedules.length;
  $('clearButton').hidden=!schedules.length||(!!user&&!amOwner());
  $('heroUpload').disabled=!!user&&!activeGroupId;
  $('manualButton').disabled=!!user&&!activeGroupId;
  $('demoButton').disabled=!!user&&!activeGroupId;
}
function renderStats(windows){
  const total=windows.reduce((s,w)=>s+w.duration,0);
  const longest=windows.length?Math.max(...windows.map(w=>w.duration)):0;
  const countDays=new Set(windows.map(w=>w.day)).size;
  const items=[
    {label:'Shared openings',value:windows.length,desc:`Across ${countDays} day${countDays===1?'':'s'} this week`,icon:'◷'},
    {label:'Total time together',value:duration(total),desc:'Within the selected filters',icon:'✦'},
    {label:'Longest break',value:longest?duration(longest):'—',desc:longest?'Plenty of time to catch up':'Try a shorter minimum',icon:'↗'}
  ];
  $('summaryStats').innerHTML=items.map(i=>`<div class="stat-card"><div class="stat-label">${i.label}<span class="stat-symbol">${i.icon}</span></div><div class="stat-value">${i.value}</div><div class="stat-description">${i.desc}</div></div>`).join('');
}
function renderBoard(windows){
  const busy=occupiedRuns(schedules,getOpts());
  const span=END_DAY-START_DAY;
  const Y=m=>100*(m-START_DAY)/span;
  $('boardCaption').textContent=`${getGroup()?.name||(user?'No group':'Guest comparison')} · Teaching week ${settings.week} · ${schedules.length} ${schedules.length===1?'person':'people'} compared`;
  const corners='<div class="corner-heading"></div>';
  const headers=SHORT_DAYS.map(d=>`<div class="day-heading">${d.toUpperCase()}</div>`).join('');
  const rail=`<div class="time-rail">${Array.from({length:11},(_,i)=>`<span class="time-tick" style="top:${i*10}%">${String(i+8).padStart(2,'0')}:00</span>`).join('')}</div>`;
  const cols=DAYS.map((_,day)=>{
    const busyHTML=busy.filter(b=>b.day===day).map(b=>`<div class="busy-block" style="top:${Y(b.start)}%;height:${Y(b.end)-Y(b.start)}%" title="Someone has a class (${formatTime(b.start)}–${formatTime(b.end)})"></div>`).join('');
    const freeHTML=windows.filter(w=>w.day===day).map(w=>{
      const k=windowKey(w),h=Y(w.end)-Y(w.start),text=h>=7?`<small>${shortTime(w.start)}–${shortTime(w.end)}</small>`:'';
      return `<button type="button" class="free-block ${selectedKey===k?'selected':''}" data-select="${k}" style="top:${Y(w.start)}%;height:${h}%" title="${DAYS[day]} ${formatTime(w.start)} to ${formatTime(w.end)}, ${duration(w.duration)}"><span>${duration(w.duration)} free</span>${text}</button>`;
    }).join('');
    return `<div class="day-column">${busyHTML}${freeHTML}</div>`;
  }).join('');
  $('weekBoard').innerHTML=corners+headers+rail+cols;
}
function renderMatches(windows){
  const list=[...windows].sort(settings.sort==='longest'?(a,b)=>b.duration-a.duration||a.day-b.day||a.start-b.start:(a,b)=>a.day-b.day||a.start-b.start);
  $('windowCount').textContent=windows.length;
  $('matchesGrid').innerHTML=(!schedules.length)
    ?'<div class="no-results"><span class="empty-emoji">🗓️</span><strong>Waiting for your timetables</strong>Upload PDF timetables to start comparing, or try the three examples.</div>'
    :(!list.length?'<div class="no-results"><span class="empty-emoji">☕</span><strong>No matching breaks with these filters</strong>Try lowering the minimum duration, choosing “All day”, or switching off e-learning as busy.</div>'
    :list.map(w=>`<button type="button" class="match-card ${selectedKey===windowKey(w)?'selected':''}" data-select="${windowKey(w)}"><span class="match-icon">${w.duration>=120?'✦':'☕'}</span><span class="match-content"><span class="match-day">${DAYS[w.day]}</span><div class="match-time">${formatTime(w.start)} – ${formatTime(w.end)}</div></span><span class="match-duration">${duration(w.duration)}</span></button>`).join(''));
  for(const button of document.querySelectorAll('[data-select]'))button.addEventListener('click',()=>{
    selectedKey=button.dataset.select;renderBoard(allWindows());renderMatches(allWindows());
  });
}
function personalOptions(){
  const options=user?[...library]:[...guestSchedules];
  if(user){
    const found=new Set(options.map(s=>s.id));
    for(const schedule of schedules)if(!found.has(schedule.id)){options.push(schedule);found.add(schedule.id);}
  }
  return options;
}
function personalLabel(schedule){
  return `${schedule.fullName||schedule.name}${user && schedule.ownerId && schedule.ownerId!==user.id?' · Shared':''}`;
}
function renderPersonal(){
  const options=personalOptions();
  const select=$('personalSelect');
  if(!options.some(s=>s.id===personalSelectedId))personalSelectedId=options.find(s=>!user||s.ownerId===user.id)?.id||options[0]?.id||null;
  select.innerHTML=options.length?options.map(s=>`<option value="${escapeHTML(s.id)}" ${s.id===personalSelectedId?'selected':''}>${escapeHTML(personalLabel(s))}</option>`).join(''):'<option value="">No timetables yet</option>';
  select.disabled=!options.length;
  $('personalWeekSelect').value=String(settings.week);
  const schedule=options.find(s=>s.id===personalSelectedId);
  $('personalEmpty').hidden=!!schedule;
  $('personalDisplay').hidden=!schedule;
  const canEdit=!!schedule && (!user||schedule.ownerId===user.id);
  $('personalEditButton').hidden=!canEdit;
  $('personalMeta').textContent=schedule?`${schedule.fullName||schedule.name}${schedule.course?' · '+schedule.course:''} · ${schedule.source||'Manual timetable'}`:'Choose a timetable to view your classes';
  document.querySelectorAll('[data-personal-mode]').forEach(b=>{b.classList.toggle('chosen',b.dataset.personalMode===personalMode);b.setAttribute('aria-pressed',String(b.dataset.personalMode===personalMode));});
  $('personalCalendarWrap').hidden=personalMode!=='grid';
  $('personalList').hidden=personalMode!=='list';
  if(!schedule)return;
  const lessons=personalWeekEvents(schedule,+settings.week);
  const days=new Set(lessons.map(e=>e.day)).size;
  const modules=new Set(lessons.map(e=>String(e.code||'').split(' ')[0])).size;
  $('personalStats').innerHTML=`<div><strong>${lessons.length}</strong><span>Class blocks</span></div><div><strong>${days}</strong><span>Days with classes</span></div><div><strong>${modules}</strong><span>Modules</span></div><div class="personal-week-label">Week ${settings.week} <span>· Mon–Sat, 8 AM–6 PM</span></div>`;
  const total=END_DAY-START_DAY,position=minute=>((minute-START_DAY)/total*100);
  const rail=`<div class="personal-time-rail">${Array.from({length:11},(_,i)=>`<span style="top:${i*10}%">${String(i+8).padStart(2,'0')}:00</span>`).join('')}</div>`;
  const headings='<div class="personal-corner"></div>'+SHORT_DAYS.map(d=>`<div class="personal-day-heading">${d}</div>`).join('');
  const cols=DAYS.map((_,day)=>{
    const groups=lessons.filter(e=>e.day===day).sort((a,b)=>a.start-b.start||a.end-b.end);
    const blocks=groups.map((e,i)=>{
      const intersecting=groups.filter(other=>other.start<e.end&&other.end>e.start);
      const col=intersecting.findIndex(other=>other===e);
      const laneCount=intersecting.length;
      const room=(e.location||'').trim();
      const module=(e.moduleName||'').trim();
      const from=Math.max(START_DAY,e.start),to=Math.min(END_DAY,e.end);
      if(to<=from)return '';
      const details=[e.code,module,room,e.online?'Online':'On campus',`Week ${e.weekStart}–${e.weekEnd}`,`${formatTime(e.start)}–${formatTime(e.end)}`].filter(Boolean).join(' · ');
      return `<div class="personal-class ${e.online?'is-online':''}" style="top:${position(from)}%;height:${position(to)-position(from)}%;left:calc(${col} * (100% / ${laneCount}) + 3px);width:calc(100% / ${laneCount} - 6px)" title="${escapeHTML(details)}" tabindex="0"><strong>${escapeHTML(e.code||'Class')}</strong>${module?`<span>${escapeHTML(module)}</span>`:''}<small>${escapeHTML(formatTime(e.start))}–${escapeHTML(formatTime(e.end))}</small><em>${escapeHTML(room|| (e.online?'Online':'Room not provided'))}</em></div>`;
    }).join('');
    return `<div class="personal-day-column">${blocks}</div>`;
  }).join('');
  $('personalCalendar').innerHTML=headings+rail+cols;
  $('personalList').innerHTML=lessons.length?DAYS.map((day,i)=>{
    const entries=lessons.filter(e=>e.day===i);
    if(!entries.length)return '';
    return `<div class="personal-list-day"><div class="personal-list-heading"><strong>${escapeHTML(day)}</strong><span>${entries.length} class${entries.length===1?'':'es'}</span></div>${entries.map(e=>`<div class="personal-list-event"><div class="personal-list-time">${escapeHTML(formatTime(e.start))}<span>${escapeHTML(formatTime(e.end))}</span></div><div class="personal-list-detail"><strong>${escapeHTML(e.code||'Class')}</strong>${e.moduleName?`<span>${escapeHTML(e.moduleName)}</span>`:''}<small>${escapeHTML(e.location|| (e.online?'Online':'Room not provided'))} · Weeks ${e.weekStart}–${e.weekEnd}</small></div><span class="personal-chip ${e.online?'online':''}">${e.online?'Online':'In-person'}</span></div>`).join('')}</div>`;
  }).join(''):'<div class="personal-no-classes">No classes for this teaching week. Choose another week to view the schedule.</div>';
}

function render(){renderGroups();renderRoster();renderPersonal();const windows=allWindows();if(selectedKey&&!windows.some(w=>windowKey(w)===selectedKey))selectedKey=null;renderStats(windows);renderBoard(windows);renderMatches(windows);$('copyButton').disabled=!windows.length;$('csvButton').disabled=!windows.length;}

function readLegacy(){
  try {const rows=JSON.parse(localStorage.getItem('commonground_schedules_v1')||'[]');return Array.isArray(rows)?rows.filter(s=>s?.name&&Array.isArray(s.events)):[];}catch{return [];}
}
async function importLegacy(){
  if(!activeGroupId)return;
  const legacy=readLegacy();if(!legacy.length)return;
  if(!confirm(`Import ${legacy.length} older timetable(s) from this browser into your account and current group?`))return;
  let added=0;
  for(const s of legacy){
    if(library.some(t=>t.name===s.name&&t.source===s.source&&t.events.length===s.events.length))continue;
    await addTimetable(db,s,user.id,activeGroupId);added++;
  }
  localStorage.removeItem('commonground_schedules_v1');
  await reloadWorkspace();notify(`Imported ${added} previous timetable(s).`);
}
async function loadDemo(){
  if(user&&!activeGroupId){notify('Join or create a group first.');return;}
  if(!confirm(user?'Add Avery, Blake and Casey as example timetables to this group?':'Load the three sample timetables in guest mode?'))return;
  let count=0;
  for(const s of examples){
    const item=structuredClone(s);item.events=item.events.map(e=>({...e,id:newId()}));
    if(user)await addTimetable(db,item,user.id,activeGroupId);else {item.id=newId();guestSchedules.push(item)}
    count++;
  }
  if(user)await reloadWorkspace();else setGuestSchedules(guestSchedules);
  notice(`${count} example timetables loaded${user?' and saved to your account':' in this guest session'}.`,true);notify('Example schedules ready.');
}
async function createManual(){
  if(user&&!activeGroupId){notify('Create a group first.');return;}
  if(!user){const s={id:newId(),name:'New person',source:'Manual timetable',events:[]};setGuestSchedules([...guestSchedules,s]);openEditor(s.id);return;}
  const s=await addTimetable(db,{name:'New person',source:'Manual timetable',events:[]},user.id,activeGroupId);
  await reloadWorkspace();openEditor(s.id);
}
async function ensurePDFJS(){
  if(window.pdfjsLib)return window.pdfjsLib;
  for(const url of ['https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js','https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js']){
    try{
      await new Promise((resolve,reject)=>{
        const s=document.createElement('script');s.src=url;s.onload=resolve;s.onerror=()=>{s.remove();reject(new Error('PDF library could not load'))};document.head.appendChild(s);
      });
      if(window.pdfjsLib){window.pdfjsLib.GlobalWorkerOptions.workerSrc=url.replace('pdf.min.js','pdf.worker.min.js');return window.pdfjsLib;}
    }catch{}
  }
  throw new Error('The PDF reader library could not load. Check your connection, then try again.');
}
async function extractPDF(file,pdfjsLib){
  const bytes=new Uint8Array(await file.arrayBuffer());
  const doc=await pdfjsLib.getDocument({data:bytes,useSystemFonts:true}).promise;
  const pages=[];
  try{
    for(let n=1;n<=doc.numPages;n++){
      const page=await doc.getPage(n),viewport=page.getViewport({scale:1});
      const content=await page.getTextContent({disableCombineTextItems:true});
      pages.push(content.items.filter(item=>typeof item.str==='string').map(item=>({str:item.str,x:item.transform[4],y:viewport.height-item.transform[5],width:item.width||0})));
    }
  }finally{doc.destroy()}
  return parseNypPages(pages,file.name);
}
async function importFiles(files){
  const collection=Array.from(files||[]);
  if(!collection.length||uploadBusy)return;
  if(user&&!activeGroupId){notify('Create or join a group first.');return;}
  const valid=collection.filter(f=>f.name.toLowerCase().endsWith('.pdf')||f.type==='application/pdf');
  if(!valid.length){notice('Please select PDF timetables. Other file types are not supported yet.');return;}
  uploadBusy=true;notice(`Reading ${valid.length} PDF ${valid.length===1?'timetable':'timetables'}…`);
  let added=0;const errors=[];
  try{
    const reader=await ensurePDFJS();
    for(const file of valid){
      try{
        if(file.size>15*1024*1024)throw new Error('PDF exceeds 15 MB');
        const parsed=await extractPDF(file,reader);
        const existing=user?library:guestSchedules;
        if(existing.some(s=>s.source===file.name && s.events.length===parsed.events.length))throw new Error('A similar file is already in your comparison');
        if(user)await addTimetable(db,parsed,user.id,activeGroupId);
        else guestSchedules.push({...parsed,id:newId()});
        added++;
      }catch(e){errors.push(`${file.name}: ${e.message||'Unable to read PDF'}`);}
    }
    if(user)await reloadWorkspace();else setGuestSchedules(guestSchedules);
    if(errors.length)notice(`${added} imported. ${errors.join(' · ')}`);
    else notice(`${added} timetable(s) imported ${user?'and saved to your account':'for guest comparison (not saved online)'}. Review their extracted classes.`,true);
    if(added)notify(`${added} timetable(s) ready for comparison.`);
  }catch(e){notice(e.message||'Could not load the PDF parser. Please try again.');}
  finally{uploadBusy=false;$('pdfInput').value='';}
}
function openEditor(id){
  const person=(user?library:guestSchedules).find(s=>s.id===id);
  if(!person)return;
  editingId=id;editable=structuredClone(person.events||[]);
  $('editHeading').textContent=`Review ${person.name}'s timetable`;
  $('editName').value=person.name;
  renderEditorRows();$('editorDialog').showModal();
}
function renderEditorRows(){
  $('lessonCount').textContent=`${editable.length} lesson block${editable.length===1?'':'s'}`;
  const dayOptions=(val)=>DAYS.map((d,i)=>`<option value="${i}" ${val===i?'selected':''}>${SHORT_DAYS[i]}</option>`).join('');
  $('editorRows').innerHTML=editable.map((e,i)=>`<tr data-i="${i}"><td><select data-f="day">${dayOptions(+e.day)}</select></td><td><input class="time-input" type="time" value="${shortTime(e.start)}" data-f="start" step="600"></td><td><input class="time-input" type="time" value="${shortTime(e.end)}" data-f="end" step="600"></td><td><input class="code-input" maxlength="80" value="${escapeHTML(e.code)}" data-f="code" required></td><td><input class="location-input" maxlength="100" value="${escapeHTML(e.location||'')}" data-f="location" placeholder="e.g. L.535 SIT"></td><td><input class="week-input" type="number" min="1" max="52" value="${e.weekStart}" data-f="weekStart"></td><td><input class="week-input" type="number" min="1" max="52" value="${e.weekEnd}" data-f="weekEnd"></td><td><input class="online-box" type="checkbox" data-f="online" ${e.online?'checked':''}></td><td><button class="trash" type="button" data-delete="${i}" title="Delete lesson">×</button></td></tr>`).join('');
  document.querySelectorAll('[data-delete]').forEach(btn=>btn.addEventListener('click',()=>{editable.splice(+btn.dataset.delete,1);renderEditorRows()}));
}
async function saveEditor(){
  const name=$('editName').value.trim();if(!name){notify('Enter a name for this person.');$('editName').focus();return;}
  const updated=[];
  for(const tr of $('editorRows').querySelectorAll('tr')){
    const e={id:editable[+tr.dataset.i]?.id||newId()};
    for(const el of tr.querySelectorAll('[data-f]')){
      const field=el.dataset.f;
      e[field]=field==='online'?el.checked:['day','weekStart','weekEnd'].includes(field)?+el.value:['start','end'].includes(field)?parseHHMM(el.value):el.value.trim();
    }
    if(!Number.isFinite(e.start)||!Number.isFinite(e.end)||e.start>=e.end||e.start<START_DAY||e.end>END_DAY){notify(`Invalid time range for ${e.code||'a lesson'}. Use 8:00 AM–6:00 PM.`);return;}
    if(e.weekStart<1||e.weekEnd>52||e.weekStart>e.weekEnd||!e.weekStart||!e.weekEnd){notify('Invalid teaching week range.');return;}
    if(!e.code){notify('Give each lesson a class name or module code.');return;}
    updated.push(e);
  }
  const s=(user?library:guestSchedules).find(s=>s.id===editingId);if(!s)return;
  $('saveEditor').disabled=true;
  try{
    const updatedSchedule={...s,name,events:updated.sort((a,b)=>a.day-b.day||a.start-b.start)};
    if(user){await updateTimetable(db,updatedSchedule,user.id);$('editorDialog').close();await reloadWorkspace();notify(`${name}'s timetable saved.`);}
    else {setGuestSchedules(guestSchedules.map(g=>g.id===s.id?updatedSchedule:g));$('editorDialog').close();notify(`${name}'s guest timetable updated (not saved online).`);}
  }catch(e){displayError(e)}finally{$('saveEditor').disabled=false;}
}

async function saveGuestToAccount(){
  if(!user||!db){openSignIn();return;}
  if(!guestSchedules.length){notify('There are no unsaved guest timetables.');return;}
  let target=activeGroupId;
  if(!target){
    if(!confirm('Create a private group called My comparisons and save your guest timetables there?'))return;
    target=await createGroup(db,'My comparisons');
    await reloadWorkspace(target);
  }
  const items=[...guestSchedules];let saved=0;
  for(const guest of items){
    if(library.some(t=>t.name===guest.name&&t.source===guest.source&&JSON.stringify(t.events)===JSON.stringify(guest.events))){
      continue;
    }
    try{
      await addTimetable(db,{...guest},user.id,target);
      guestSchedules=guestSchedules.filter(s=>s.id!==guest.id);
      persistGuest();saved++;
    }catch(e){displayError(e);break;}
  }
  await reloadWorkspace(target);
  notify(saved?`${saved} guest timetable${saved===1?'':'s'} saved to your account and selected group.`:'Nothing new saved. Review any duplicate timetables.');
}

function modal(title,body){$('groupDialogTitle').textContent=title;$('groupDialogBody').innerHTML=body;$('groupDialog').showModal();}
function fieldValue(id){return $(id)?.value.trim()||'';}
function showNewGroup(){
  modal('Create a group',`<p class="simple-description">Give your circle a name. You can invite friends and select timetables after creating it.</p><label class="simple-field">Group name<input id="newGroupName" maxlength="80" placeholder="e.g. Lunch squad" /></label><div class="simple-actions"><button class="primary-button" id="confirmCreateGroup" type="button">Create group →</button></div>`);
  $('confirmCreateGroup').addEventListener('click',()=>safeAction(async()=>{
    const name=fieldValue('newGroupName');if(!name){notify('Please enter a group name.');return;}
    $('confirmCreateGroup').disabled=true;
    try{const id=await createGroup(db,name);$('groupDialog').close();await reloadWorkspace(id);notify('Group created. Invite your friends!');}finally{$('confirmCreateGroup').disabled=false;}
  }));
  $('newGroupName').focus();
}
function showJoinGroup(){
  modal('Join a group',`<p class="simple-description">Paste an invitation code or link from a friend.</p><label class="simple-field">Invite code or link<input id="joinGroupCode" autocomplete="off" spellcheck="false" placeholder="Paste code or invitation URL" /></label><div class="simple-actions"><button class="primary-button" id="confirmJoinGroup" type="button">Join group →</button></div>`);
  $('confirmJoinGroup').addEventListener('click',()=>safeAction(async()=>{
    let code=fieldValue('joinGroupCode');
    try{if(code.includes('?join='))code=new URL(code).searchParams.get('join')||'';}catch{}
    if(!/^[0-9a-f]{32}$/i.test(code)){notify('Enter a valid 32-character invite code or invite link.');return;}
    $('confirmJoinGroup').disabled=true;
    try{const id=await joinGroup(db,code);$('groupDialog').close();await reloadWorkspace(id);notify('Joined the group. Choose a timetable to share!');}finally{$('confirmJoinGroup').disabled=false;}
  }));
  $('joinGroupCode').focus();
}
function showInvite(){
  const g=getGroup();if(!g)return;
  modal('Invite friends',`<p class="simple-description">Anyone with this invitation can join <strong>${escapeHTML(g.name)}</strong>. Share the link privately.</p><label class="simple-field">Invitation link<span class="invite-code" id="inviteLinkText">${escapeHTML(inviteURL(g.join_code))}</span></label><div class="simple-actions"><button id="copyInviteButton" class="primary-button" type="button">Copy invite link</button><button id="copyInviteCodeButton" class="soft-button" type="button">Copy code</button>${amOwner()?'<button id="resetInviteButton" class="soft-button" type="button">Reset invite link</button>':''}</div>`);
  $('copyInviteButton').addEventListener('click',()=>copyText(inviteURL(g.join_code)));
  $('copyInviteCodeButton').addEventListener('click',()=>copyText(g.join_code));
  $('resetInviteButton')?.addEventListener('click',()=>safeAction(async()=>{
    if(!confirm('Reset the invite code? Previously shared links will stop working.'))return;
    await rotateInvite(db,g.id);
    await reloadWorkspace(g.id);$('groupDialog').close();showInvite();notify('Invite link reset.');
  }));
}
function showMembers(){
  if(!getGroup())return;
  const rows=members.map(m=>`<div class="member-row"><div><strong>${escapeHTML(m.profiles?.username||'Member')}</strong><small>${m.role==='owner'?'Group owner':'Member'}</small></div>${amOwner()&&m.user_id!==user.id?`<button data-kick="${escapeHTML(m.user_id)}" type="button">Remove</button>`:''}</div>`).join('');
  modal('Group members',`<p class="simple-description">${escapeHTML(getGroup().name)} · ${members.length} member(s)</p>${rows}<div class="simple-actions">${!amOwner()?'<button id="leaveGroupButton" class="danger-button" type="button">Leave group</button>':''}</div>`);
  $('groupDialogBody').querySelectorAll('[data-kick]').forEach(b=>b.addEventListener('click',()=>safeAction(async()=>{
    const m=members.find(m=>m.user_id===b.dataset.kick);
    if(!m||!confirm(`Remove ${m.profiles?.username||'this member'} from the group?`))return;
    must(await db.from('group_members').delete().eq('group_id',activeGroupId).eq('user_id',m.user_id));
    await reloadGroup();$('groupDialog').close();showMembers();notify('Member removed.');
  })));
  $('leaveGroupButton')?.addEventListener('click',()=>safeAction(async()=>{
    if(!confirm(`Leave ${getGroup()?.name}?`))return;
    must(await db.from('group_members').delete().eq('group_id',activeGroupId).eq('user_id',user.id));
    activeGroupId=null;$('groupDialog').close();await reloadWorkspace();notify('You have left the group.');
  }));
}
function showGroupSettings(){
  const g=getGroup();if(!g||!amOwner())return;
  modal('Manage group',`<p class="simple-description">Rename your group or permanently delete it. Deleting a group does not delete the timetables in members' personal libraries.</p><label class="simple-field">Group name<input id="renameGroupName" value="${escapeHTML(g.name)}" maxlength="80" /></label><div class="simple-actions"><button id="saveGroupNameButton" type="button" class="primary-button">Save name</button><button id="deleteGroupButton" type="button" class="danger-button">Delete group</button></div>`);
  $('saveGroupNameButton').addEventListener('click',()=>safeAction(async()=>{
    const name=fieldValue('renameGroupName');if(!name){notify('Enter a group name.');return;}
    must(await db.from('groups').update({name}).eq('id',g.id));
    $('groupDialog').close();await reloadWorkspace(g.id);notify('Group renamed.');
  }));
  $('deleteGroupButton').addEventListener('click',()=>safeAction(async()=>{
    if(!confirm(`Permanently delete ${g.name} and remove all group memberships? Members' timetables remain in their accounts.`))return;
    must(await db.from('groups').delete().eq('id',g.id));
    activeGroupId=null;$('groupDialog').close();await reloadWorkspace();notify('Group deleted.');
  }));
}

function init(){
  for(let w=1;w<=17;w++)$('weekSelect').add(new Option(`Week ${w}`,String(w)));
  $('weekSelect').value=String(settings.week);
  for(let w=1;w<=17;w++)$('personalWeekSelect').add(new Option(`Week ${w}`,String(w)));
  $('personalWeekSelect').value=String(settings.week);
  $('minSelect').value=String(settings.min);$('modeSelect').value=settings.mode;
  $('onlineToggle').checked=Boolean(settings.onlineBusy);$('sortSelect').value=settings.sort;
  for(const [id,key,fn] of [['weekSelect','week',x=>+x],['minSelect','min',x=>+x],['modeSelect','mode',String],['sortSelect','sort',String]]){
    $(id).addEventListener('change',e=>{settings[key]=fn(e.target.value);persistSettings();render()});
  }
  $('onlineToggle').addEventListener('change',e=>{settings.onlineBusy=e.target.checked;persistSettings();render()});
  $('personalSelect').addEventListener('change',e=>{personalSelectedId=e.target.value;renderPersonal();});
  $('personalWeekSelect').addEventListener('change',e=>{settings.week=+e.target.value;$('weekSelect').value=String(settings.week);persistSettings();render();});
  document.querySelectorAll('[data-personal-mode]').forEach(b=>b.addEventListener('click',()=>{personalMode=b.dataset.personalMode;renderPersonal();}));
  $('personalEditButton').addEventListener('click',()=>{if(personalSelectedId)openEditor(personalSelectedId);});
  $('personalUploadButton').addEventListener('click',()=>$('pdfInput').click());
  $('pdfInput').addEventListener('change',e=>importFiles(e.target.files));
  $('heroUpload').addEventListener('click',()=>$('pdfInput').click());
  $('demoButton').addEventListener('click',()=>safeAction(loadDemo));
  $('migrateButton').addEventListener('click',()=>safeAction(importLegacy));
  $('manualButton').addEventListener('click',()=>safeAction(createManual));
  $('loginButton').addEventListener('click',openSignIn);
  $('guestSignInButton').addEventListener('click',openSignIn);
  $('closeAuthButton').addEventListener('click',closeSignIn);
  $('continueAsGuest').addEventListener('click',closeSignIn);
  $('saveGuestButton').addEventListener('click',()=>safeAction(saveGuestToAccount));
  $('clearButton').addEventListener('click',()=>safeAction(async()=>{
    if(!user){if(!confirm('Clear every timetable in this guest comparison? This cannot be undone.'))return;setGuestSchedules([]);clearNotice();notify('Guest comparison cleared.');return;}
    if(!amOwner()||!confirm('Remove every timetable from this group? All personal libraries will be kept.'))return;
    for(const s of schedules)await setGroupTimetable(db,activeGroupId,s.id,user.id,false);
    await reloadGroup();clearNotice();notify('Group timetable selection cleared.');
  }));
  $('copyButton').addEventListener('click',()=>copyText(`${getGroup()?.name||(user?'Group':'Guest comparison')} · Common breaks · Teaching week ${settings.week}\n`+allWindows().map(w=>`${DAYS[w.day]}: ${formatTime(w.start)} – ${formatTime(w.end)} (${duration(w.duration)})`).join('\n')));
  $('csvButton').addEventListener('click',()=>{
    const blob=new Blob([overlapsCSV(allWindows(),settings.week)],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`common-breaks-week-${settings.week}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('CSV exported.');
  });
  $('closeEditor').addEventListener('click',()=>$('editorDialog').close());
  $('cancelEditor').addEventListener('click',()=>$('editorDialog').close());
  $('editorDialog').addEventListener('click',e=>{if(e.target===$('editorDialog'))$('editorDialog').close()});
  $('saveEditor').addEventListener('click',saveEditor);
  $('addLesson').addEventListener('click',()=>{editable.push({id:newId(),day:0,start:9*60,end:10*60,code:'New lesson',weekStart:1,weekEnd:17,online:false,location:''});renderEditorRows();$('editorRows').lastElementChild?.scrollIntoView({block:'nearest',behavior:'smooth'})});
  document.querySelectorAll('.nav-link').forEach(a=>a.addEventListener('click',()=>{document.querySelectorAll('.nav-link').forEach(b=>b.classList.remove('active'));a.classList.add('active')}));
  $('groupSelect').addEventListener('change',()=>safeAction(async()=>{activeGroupId=$('groupSelect').value;localStorage.setItem(`commonground_active_group_${user.id}`,activeGroupId);await reloadGroup();}));
  $('createGroupButton').addEventListener('click',showNewGroup);
  $('joinGroupButton').addEventListener('click',showJoinGroup);
  $('inviteButton').addEventListener('click',showInvite);
  $('membersButton').addEventListener('click',showMembers);
  $('groupSettingsButton').addEventListener('click',showGroupSettings);
  $('closeGroupDialog').addEventListener('click',()=>$('groupDialog').close());
  $('groupDialog').addEventListener('click',e=>{if(e.target===$('groupDialog'))$('groupDialog').close()});
  $('logoutButton').addEventListener('click',()=>safeAction(async()=>{must(await db.auth.signOut());await handleSession(null);notify('Signed out.');}));
  $('tabSignIn').addEventListener('click',()=>setAuthMode('signin'));
  $('tabSignUp').addEventListener('click',()=>setAuthMode('signup'));
  $('authForm').addEventListener('submit',handleAuthSubmit);
  $('resetPasswordButton').addEventListener('click',()=>safeAction(async()=>{
    const email=$('authEmail').value.trim();if(!email){authMessage('Enter your email address first.');return;}
    must(await db.auth.resetPasswordForEmail(email,{redirectTo:`${location.origin}${location.pathname}`}));
    authMessage('If the email is registered, you will receive a password reset link.');
  }));
  setAuthMode('signin');schedules=guestSchedules;render();
  pendingJoinCode=new URLSearchParams(location.search).get('join');
  if(pendingJoinCode)openSignIn();
  createCloudClient(window.COMMONGROUND_CONFIG).then(client=>{
    db=client;
    db.auth.onAuthStateChange((event,session)=>{
      if(event==='PASSWORD_RECOVERY'){
        recoveryActive=true;setAuthMode('recovery');$('authScreen').hidden=false;return;
      }
      if(['INITIAL_SESSION','SIGNED_IN','SIGNED_OUT','TOKEN_REFRESHED','USER_UPDATED'].includes(event))setTimeout(()=>handleSession(session),0);
    });
  }).catch(e=>{
    $('configurationHelp').hidden=false;authMessage(e?.message||'Could not connect to the database. Guest comparison is still available.');
    $('authSubmit').disabled=true;
  });
}
init();
