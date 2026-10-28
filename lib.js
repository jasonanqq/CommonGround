export const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
export const SHORT_DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat'];
export const START_DAY = 8 * 60;
export const END_DAY = 18 * 60;
export const TIME_STEP = 10;

export function formatTime(min) {
  const hr = Math.floor(min / 60);
  const ampm = hr >= 12 ? 'PM' : 'AM';
  return `${hr % 12 || 12}:${String(min % 60).padStart(2,'0')} ${ampm}`;
}
export function shortTime(min) {
  return `${String(Math.floor(min / 60)).padStart(2,'0')}:${String(min % 60).padStart(2,'0')}`;
}
export function duration(min) {
  const h = Math.floor(min/60), m=min%60;
  return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`;
}
export function parseHHMM(value) {
  const match = String(value).match(/^(\d{1,2}):(\d{2})$/);
  return match ? Number(match[1])*60 + Number(match[2]) : NaN;
}
export function newId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
const courseRE = /\b((?:[A-Z]{2,5}(?:-[A-Z]{2,6})?\d{2,4}|[A-Z]{2,5}-[A-Z]{2,6}))\s+((?:LAB|LEC|TUT|PEM)\d{2})\b/g;
const weekRE = /\bWEEK\s+(\d+)\s*-\s*(\d+)\b/g;
const daysLabels = ['MON','TUE','WED','THU','FRI','SAT'];

function hourMarker(token) {
  const m = token.match(/^(\d{1,2}):00([AP]M)$/i);
  if (!m) return null;
  const hr=(+m[1]%12) + (m[2].toUpperCase()==='PM'?12:0);
  return hr >= 8 && hr <= 17 ? hr * 60 : null;
}

export function parseNypPages(pages, filename='Uploaded timetable.pdf') {
  if (!pages?.length) throw new Error('The PDF has no pages.');
  const cells = new Map();
  let name='', course='', lastHour=START_DAY;
  let seenHeaders=0, foundMarkers=0;
  for (let pageIndex=0;pageIndex<pages.length;pageIndex++) {
    const raw=pages[pageIndex];
    const tokens=[];
    for (const item of raw) {
      const str=String(item.str||'');
      for (const match of str.matchAll(/\S+/g)) {
        const x=item.x + (match.index / Math.max(1,str.length))*(item.width||0);
        tokens.push({str:match[0],x,y:item.y,page:pageIndex});
      }
    }
    const timeHeader=tokens.find(t=>t.str.toUpperCase()==='TIME' && t.x<110 && t.y<100);
    const headerY=timeHeader?.y ?? 50;
    const headers=daysLabels.map(d=>tokens.find(t=>t.str.toUpperCase()===d && Math.abs(t.y-headerY)<12 && t.x>70));
    if (headers.some(h=>!h)) continue;
    seenHeaders++;
    if (pageIndex===0) {
      const headerLine=tokens.filter(t=>t.y<headerY-4 && t.y>headerY-40).sort((a,b)=>a.x-b.x).map(t=>t.str).join(' ');
      name=headerLine.match(/\bName\s+(.+?)\s+Course\s+Code\b/i)?.[1]||'';
      course=headerLine.match(/\bCourse\s+Code\s+([^\s]+)/i)?.[1]||'';
    }
    const starts=headers.map(h=>h.x);
    const timeMarkers=tokens.filter(t=>t.x < starts[0]-3).map(t=>({minute:hourMarker(t.str),y:t.y}))
      .filter(t=>t.minute!==null).sort((a,b)=>a.y-b.y);
    foundMarkers+=timeMarkers.length;
    for (const t of tokens) {
      if (t.y<=headerY+7 || t.str==='') continue;
      const day=starts.reduce((last,x,i)=>(t.x >= x-3?i:last),-1);
      if (day<0) continue;
      const marker=timeMarkers.filter(m=>m.y<=t.y+2).at(-1);
      const hour=marker?marker.minute:lastHour;
      if (hour<START_DAY || hour>=END_DAY) continue;
      const key=`${day}:${hour}`;
      if (!cells.has(key)) cells.set(key,[]);
      cells.get(key).push(t);
    }
    if (timeMarkers.length) lastHour=timeMarkers.at(-1).minute;
  }
  if (!seenHeaders || !foundMarkers) throw new Error('This does not look like a text-based NYP timetable. Upload the original NYP PDF instead of a screenshot, or add lessons manually.');
  const events=[];
  for (const [key,tokens] of cells) {
    const [day,start]=key.split(':').map(Number);
    const lineBuckets=new Map();
    for (const t of tokens) {
      const lineKey=`${t.page}:${Math.round(t.y/5)*5}`;
      if(!lineBuckets.has(lineKey)) lineBuckets.set(lineKey,[]);
      lineBuckets.get(lineKey).push(t);
    }
    const lines=[...lineBuckets.entries()].sort((a,b)=>{
      const [ap,ay]=a[0].split(':').map(Number),[bp,by]=b[0].split(':').map(Number);
      return ap-bp || ay-by;
    }).map(([,tokens])=>tokens.sort((a,b)=>a.x-b.x).map(t=>t.str).join(' '));
    let weekStart=1,weekEnd=17;
    const found=[];
    for (const [lineIndex,line] of lines.entries()) {
      weekRE.lastIndex=0;
      for (const m of line.matchAll(weekRE)) {weekStart=+m[1];weekEnd=+m[2];}
      courseRE.lastIndex=0;
      for (const m of line.matchAll(courseRE)) {
        const following=(lines[lineIndex+1]||'').trim();
        const moduleName=/^[A-Z]{2,10}$/.test(following) && !['DCL','SIT','SAS'].includes(following) ? following : '';
        found.push({code:`${m[1]} ${m[2]}`,weekStart,weekEnd,moduleName});
      }
    }
    if (!found.length) continue;
    const allText=lines.join(' ').toUpperCase();
    const online=allText.includes('ELEARNING') || allText.includes('LEARN FROM HOME');
    const locationMatch=allText.match(/\b(?:L\.\d{3}\s+[A-Z]{2,8}|P\.\d{3}\s+[A-Z]{2,8}|LT[A-Z]-\d+\s+[A-Z]{2,8}|ELEARNING\s+[A-Z]{2,8}|LEARN\s+FROM\s+HOME|SAMPLE\s+ROOM)\b/);
    const location=locationMatch?.[0]||'';
    const unique=[];
    for (const f of found) {
      if(!unique.some(u=>u.code===f.code && u.weekStart===f.weekStart && u.weekEnd===f.weekEnd)) unique.push(f);
    }
    for (const f of unique) {
      if (unique.some(u=>u!==f && u.code===f.code && u.weekStart<=f.weekStart && u.weekEnd>=f.weekEnd)) continue;
      events.push({...f,day,start,end:start+60,online,location});
    }
  }
  if (!events.length) throw new Error('I found the timetable grid, but could not recognize any lesson codes. You can add lessons manually, or check that you uploaded an NYP timetable.');
  const sorted=events.sort((a,b)=>a.day-b.day || a.start-b.start || a.code.localeCompare(b.code));
  const merged=[];
  for (const ev of sorted) {
    const previous=merged.find(e=>e.day===ev.day && e.end===ev.start && e.code===ev.code && e.weekStart===ev.weekStart && e.weekEnd===ev.weekEnd && e.online===ev.online && ((e.location||'')===(ev.location||'') || !e.location || !ev.location));
    if (previous) {previous.end=ev.end;previous.location ||= ev.location;previous.moduleName ||= ev.moduleName;}
    else merged.push({...ev,id:newId()});
  }
  return {
    id:newId(),
    name:(name.trim().split(/\s+/)[0] || filename.replace(/\.pdf$/i,'').split(' ')[0]).toLowerCase().replace(/^./,c=>c.toUpperCase()),
    fullName:name.trim(),course,
    source:filename,
    events:merged.sort((a,b)=>a.day-b.day || a.start-b.start)
  };
}

export function personalWeekEvents(schedule,week) {
  const selected=Number(week);
  if (!schedule || !Array.isArray(schedule.events) || !Number.isFinite(selected)) return [];
  return schedule.events.filter(e=>Number(e.weekStart)<=selected && Number(e.weekEnd)>=selected)
    .sort((a,b)=>a.day-b.day||a.start-b.start||String(a.code).localeCompare(String(b.code)));
}
export function activeEvents(schedule,week,onlineBusy=true) {
  return schedule.events.filter(e=>e.weekStart<=week && e.weekEnd>=week && (onlineBusy || !e.online));
}
export function busyAt(events,start,end) {
  return events.some(ev=>ev.start<end && ev.end>start);
}
export function commonWindows(schedules,options={}) {
  if (!schedules.length) return [];
  const {week=8,onlineBusy=true,start=START_DAY,end=END_DAY,min=60,mode='between'}=options;
  const active=schedules.flatMap(s=>activeEvents(s,week,onlineBusy));
  const windows=[];
  for (let day=0;day<6;day++) {
    const lessons=active.filter(e=>e.day===day);
    if(mode==='between'&&!lessons.length) continue;
    const lower=mode==='between'?Math.max(start,Math.min(...lessons.map(e=>e.start))):start;
    const upper=mode==='between'?Math.min(end,Math.max(...lessons.map(e=>e.end))):end;
    let current=null;
    for (let t=lower;t<upper;t+=TIME_STEP) {
      const free=!busyAt(lessons,t,Math.min(t+TIME_STEP,upper));
      if(free && current===null)current=t;
      if(!free && current!==null) {
        if(t-current>=min) windows.push({day,start:current,end:t,duration:t-current});
        current=null;
      }
    }
    if(current!==null && upper-current>=min) windows.push({day,start:current,end:upper,duration:upper-current});
  }
  return windows;
}
export function occupiedRuns(schedules,{week=8,onlineBusy=true,start=START_DAY,end=END_DAY}={}) {
  const all=schedules.flatMap(s=>activeEvents(s,week,onlineBusy));
  const out=[];
  for(let day=0;day<6;day++) {
    const events=all.filter(e=>e.day===day);
    let current=null;
    for(let t=start;t<end;t+=TIME_STEP) {
      const busy=busyAt(events,t,t+TIME_STEP);
      if(busy&&current===null)current=t;
      if(!busy&&current!==null){out.push({day,start:current,end:t});current=null;}
    }
    if(current!==null)out.push({day,start:current,end});
  }
  return out;
}
export function overlapsCSV(windows,week) {
  const rows=[['Teaching week','Day','Start','End','Duration (minutes)']];
  for(const w of windows)rows.push([week,DAYS[w.day],shortTime(w.start),shortTime(w.end),w.duration]);
  return rows.map(r=>r.map(x=>`"${String(x).replaceAll('"','""')}"`).join(',')).join('\r\n');
}
