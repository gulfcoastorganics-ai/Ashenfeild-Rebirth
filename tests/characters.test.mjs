import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {infectedPose,playerPose} from '../src/character-state.mjs';
import {DODGE} from '../src/survival.mjs';
import {WEAPONS} from '../src/combat.mjs';

const resting={health:100,hasGun:false};
test('player animation priority follows gameplay timers without modifying them',()=>{
 const state=Object.freeze({...resting,dodgeTime:DODGE.duration*.5,meleeAnim:.2,pistolAnim:.23});
 assert.deepEqual(playerPose(state,6,.4,0,false),{name:'dodge',phase:.5});
 assert.equal(playerPose({...state,dodgeTime:0},0,0,0,false).name,'fire');
 const melee=playerPose({...resting,meleeAnim:WEAPONS.crowbar.cooldown/2},0,0,0,false);
 assert.deepEqual(melee,{name:'melee',phase:.5});
 assert.equal(playerPose(resting,4.25,0,0,false).name,'walk');
 assert.equal(playerPose(resting,7.15,0,0,false).name,'run');
 assert.equal(playerPose(resting,0,-.9,0,false).name,'turnRight');
 assert.equal(playerPose({...resting,health:0},0,0,1,false).phase,1);
});

test('infected keyframes bridge the same strike boundary and finish collapse before disposal',()=>{
 const active={type:'walker',dead:false,visualSpeed:1.9,visualStrike:0};
 assert.equal(infectedPose(active).name,'shamble');
 assert.equal(infectedPose({...active,type:'runner'}).name,'run');
 assert.equal(infectedPose({...active,type:'brute'}).name,'walk');
 assert.equal(infectedPose({...active,type:'spitter',attackIntent:{windup:.6},windup:.5}).name,'hit');
 const contact=infectedPose({...active,attackIntent:{windup:.3},windup:0});
 const followThrough=infectedPose({...active,visualStrike:.32});
 assert.deepEqual(contact,followThrough);
 assert.equal(infectedPose({...active,type:'brute',dead:true,death:.26}).name,'fallBack');
 assert.equal(infectedPose({...active,dead:true,death:.26}).phase,1);
});

test('checked-in GLBs contain compact, self-contained weighted skins and supported clips',async()=>{
 const budgets={survivor:720000,mara:420000,vale:420000,guard:340000,infected:250000};
 const expected=['idle','walk','shamble','run','turnLeft','turnRight','melee','aim','fire','dodge','hit','fall','fallBack','interact','talk','stagger','attack'];
 for(const [role,budget] of Object.entries(budgets)){
  const bytes=await readFile(new URL(`../assets/characters/${role}.glb`,import.meta.url));
  assert(bytes.length<=budget,`${role} exceeds the reviewed download budget`);
  assert.equal(bytes.subarray(0,4).toString(),'glTF');
  assert.equal(bytes.readUInt32LE(4),2);
  assert.equal(bytes.readUInt32LE(8),bytes.length);
  const model=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
  assert.equal(model.skins.length,1);
  const skin=model.skins[0];
  assert.equal(skin.joints.length,26);
  assert.equal(model.accessors[skin.inverseBindMatrices].count,26);
  assert(skin.joints.some(i=>model.nodes[i].name==='WeaponR'));
  assert(model.images.every(image=>Number.isInteger(image.bufferView)&&!image.uri));
  assert.deepEqual(model.extensionsRequired??[],['KHR_mesh_quantization']);
  for(const mesh of model.meshes)for(const primitive of mesh.primitives){
   const {JOINTS_0:joints,WEIGHTS_0:weights,POSITION:position}=primitive.attributes;
   assert.equal(model.accessors[joints].count,model.accessors[position].count);
   assert.equal(model.accessors[weights].count,model.accessors[position].count);
  }
  assert.deepEqual((model.animations??[]).map(clip=>clip.name),role==='survivor'?expected:[]);
 }
});
