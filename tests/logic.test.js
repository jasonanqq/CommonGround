import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseNypPages,commonWindows,personalWeekEvents} from '../lib.js';
import {examples} from '../examples.js';

const fixture=JSON.parse(readFileSync(new URL('./raw-pdf-text.json',import.meta.url)));
const parsed=Object.entries(fixture).map(([name,pages])=>parseNypPages(pages,`${name}.pdf`));
const byName=name=>parsed.find(person=>person.name===name);
const lessonDetails=schedule=>schedule.events.map(({day,start,end,code,weekStart,weekEnd,online})=>({day,start,end,code,weekStart,weekEnd,online}))
  .sort((a,b)=>a.day-b.day||a.start-b.start||a.code.localeCompare(b.code));

test('fictional NYP pages are decoded correctly',()=>{
  assert.deepEqual(parsed.map(s=>s.name),['Avery','Blake','Casey']);
  for (const schedule of parsed){
    assert.equal(schedule.events.length,13);
    assert.ok(schedule.fullName.startsWith(schedule.name));
    assert.deepEqual(lessonDetails(schedule),lessonDetails(examples.find(e=>e.name===schedule.name)));
  }
});

test('week 8 shared breaks match the fictional schedules',()=>{
  const windows=commonWindows(parsed,{week:8,min:60,mode:'between',onlineBusy:true});
  assert.deepEqual(windows.map(w=>[w.day,w.start,w.end]),[[1,780,840],[4,900,960]]);
});

test('teaching weeks and lessons across a page break are retained',()=>{
  const avery=byName('Avery');
  assert.ok(avery.events.some(e=>e.code==='CS1104 LAB01'&&e.day===2&&e.start===780&&e.end===900));
  assert.ok(avery.events.some(e=>e.code==='CM1299 TUT01'&&e.weekStart===6&&e.weekEnd===7));
  const blake=byName('Blake');
  assert.ok(blake.events.some(e=>e.code==='CS1206 LAB03'&&e.start===900&&e.end===1020));
  const special=avery.events.find(e=>e.code==='CM1299 TUT01');
  assert.ok(special.weekStart<=6 && special.weekEnd>=6);
  assert.ok(!(special.weekStart<=8 && special.weekEnd>=8));
});

test('online sessions can be excluded from busy time',()=>{
  const full=commonWindows(parsed,{week:8,min:60,mode:'all',onlineBusy:true});
  const flexible=commonWindows(parsed,{week:8,min:60,mode:'all',onlineBusy:false});
  assert.ok(flexible.reduce((total,w)=>total+w.duration,0)>full.reduce((total,w)=>total+w.duration,0));
});


test('personal viewer shows only lessons in the selected teaching week',()=>{
  const s=byName('Avery');
  const week6=personalWeekEvents(s,6);
  const week8=personalWeekEvents(s,8);
  assert.ok(week6.some(e=>e.code==='CM1299 TUT01'));
  assert.ok(!week8.some(e=>e.code==='CM1299 TUT01'));
  assert.ok(week8.every(e=>e.weekStart<=8 && e.weekEnd>=8));
  assert.ok(week8.every((e,i)=>!i||e.day>week8[i-1].day||(e.day===week8[i-1].day&&e.start>=week8[i-1].start)));
});

test('extracted timetable retains class location for the viewer',()=>{
  const avery=byName('Avery');
  assert.ok(avery.events.some(e=>e.online&&e.location==='ELEARNING SIT'));
  assert.ok(avery.events.some(e=>e.location==='SAMPLE ROOM'));
});
