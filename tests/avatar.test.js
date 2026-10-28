import test from 'node:test';
import assert from 'node:assert/strict';
import {avatarPreset,profileLabel,avatarExtension,validateAvatarFile,PRESET_AVATARS} from '../avatars.js';
test('avatars accept only predefined presets',()=>{
  assert.equal(avatarPreset('cat'),'cat');
  assert.equal(avatarPreset('initials'),'initials');
  assert.equal(avatarPreset('../../danger'),'initials');
  assert.equal(PRESET_AVATARS.length,7);
});
test('profile label prefers optional display name',()=>{
  assert.equal(profileLabel({username:'avery',display_name:'Avery S'}),'Avery S');
  assert.equal(profileLabel({username:'avery',display_name:''}),'avery');
  assert.equal(profileLabel(null),'Member');
});
test('image uploads validate format and size',()=>{
  assert.equal(avatarExtension('image/jpeg'),'jpg');
  assert.equal(avatarExtension('image/svg+xml'),null);
  assert.equal(validateAvatarFile({size:100,type:'image/png'}),true);
  assert.throws(()=>validateAvatarFile({size:3*1024*1024,type:'image/png'}),/2 MB/);
  assert.throws(()=>validateAvatarFile({size:100,type:'image/svg+xml'}),/JPG/);
});
