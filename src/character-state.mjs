import {DODGE} from "./survival.mjs";
import {WEAPONS} from "./combat.mjs";

const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const timed=(name,phase)=>({name,phase:clamp(phase,0,1)});
const cycle=(name,rate=1)=>({name,rate});

export function playerPose(state,speed,turn,fall,dialogue){
 if(state.health<=0)return timed("fall",fall);
 if(state.dodgeTime>0)return timed("dodge",1-state.dodgeTime/DODGE.duration);
 if(state.pistolAnim>0)return timed("fire",1-state.pistolAnim/.28);
 if(state.meleeAnim>0)return timed("melee",1-state.meleeAnim/WEAPONS.crowbar.cooldown);
 if(state.hitTime>.19)return timed("hit",(.45-state.hitTime)/.26);
 if(state.visualInteract>0)return timed("interact",1-state.visualInteract/.55);
 if(dialogue)return cycle("talk",.81);
 if(speed>5.4)return cycle("run",clamp(speed/5.3,.95,1.55));
 if(speed>.15)return cycle("walk",clamp(speed/2.6,.30,1.75));
 if(Math.abs(turn)>.62)return timed(turn>0?"turnLeft":"turnRight",.21);
 return cycle(state.hasGun?"aim":"idle");
}

export function infectedPose(enemy){
 if(enemy.dead)return timed(enemy.type==="brute"?"fallBack":"fall",(1.7-enemy.death)/1.24);
 if(enemy.hitFlash>0)return timed(enemy.stagger>.10?"stagger":"hit",.17+(.18-enemy.hitFlash)/.18*.44);
 if(enemy.attackIntent){
  const charge=1-enemy.windup/enemy.attackIntent.windup;
  return timed(enemy.type==="spitter"?"hit":"attack",.46*charge);
 }
 if(enemy.visualStrike>0)return timed(enemy.type==="spitter"?"hit":"attack",.46+.54*(1-enemy.visualStrike/.32));
 if(enemy.visualSpeed<.10)return cycle("idle",enemy.type==="spitter"?.72:.59);
 if(enemy.type==="runner")return cycle("run",clamp(enemy.visualSpeed/3.2,.72,1.34));
 if(enemy.type==="brute")return cycle("walk",clamp(enemy.visualSpeed/3,.50,.95));
 return cycle("shamble",clamp(enemy.visualSpeed/2.4,.45,1.20));
}
