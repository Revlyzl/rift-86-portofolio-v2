/* Rift 86 · the Middle Ages, c. AD 1350
   A farm in a storm. Something watches from the ridge, and a sheep is gone every night it shows.
   Fetched by rift-travel.js the first time this crack is chosen; builds with the kit it exposes (window.__RTK).
   Everything that decides what happens lives in RULES below: fixed, simple, never scripted. The world only shows it. */
(function(root){
'use strict';

/* ================= RULES =================
   The hidden truth, as three rules that never change:
   1. The dog has a hunger the player never sees. It rises every dusk. When it is high and the dog is unwatched and
      can reach the sheep, it kills.
   2. The thing on the ridge shows only on nights the dog means to hunt (decided at dusk, before any choice).
   3. It watches the dog, not you. (Presentation; see the wolf.)
   Pure functions on a plain state object, so a run can be simulated thousands of times with no screen. */
const RULES=(()=>{
  const NIGHTS=5, WOLF_H=2, GREEDY_H=4, OIL=3;
  const T={rise:1,stormRise:1,eat:1.5,heavy:.25}; // tuning (medsim): hunger per dusk, extra on heavy-rain dusks (storms stir it), drop per sheep eaten, chance of heavy rain
  const DOG_SPOTS=['pen','porch','house','barn'];   // barn = chained inside it
  const SHEEP_SPOTS=['pen','barn'];
  function rng(seed){ let s=seed>>>0||1; return ()=>{ s=(s+0x6D2B79F5)>>>0; let t=s; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61); return ((t^t>>>14)>>>0)/4294967296; }; }

  function newRun(seed){ const r=rng(seed);
    return {seed,r,night:0,sheep:5+Math.floor(r()*3),sheep0:0,h:Math.floor(r()*2),oil:OIL,
      dog:'porch',flock:'pen',watch:'none',bait:false,baitOwned:true,
      wolfNight:false,rain:'light',dogDead:false,barnScene:false,killAfterBarn:false,dead:false,over:false,log:[]}; }

  // where the dog can get to the sheep, and whether it sleeps right beside them
  function reach(M){
    if(M.dog==='barn') return M.flock==='barn'?{can:true,beside:true}:{can:false,beside:false}; // chained: only what shares the barn
    if(M.dog==='pen') return {can:true,beside:M.flock==='pen'};
    return {can:true,beside:false};                    // porch, or slipping out of the house
  }
  // the player can only keep eyes on the dog from the house: in the house or on the porch
  const watched=M=>M.watch==='dog'&&M.oil>0&&(M.dog==='house'||M.dog==='porch');
  const baitReach=M=>M.dog!=='barn';                   // the bait lies by the pen

  function dusk(M){ M.night++; if(!M.sheep0) M.sheep0=M.sheep; M.rain=M.r()<T.heavy?'heavy':'light'; M.h+=T.rise+(M.rain==='heavy'?T.stormRise:0);
    M.wolfNight=!M.dogDead&&M.h>=WOLF_H;                // intent, fixed before the player chooses anything
    return {night:M.night,wolfNight:M.wolfNight,rain:M.rain,refusesFood:!M.dogDead&&M.h>=WOLF_H}; }

  function choose(M,c){ if(c.dog&&DOG_SPOTS.includes(c.dog)) M.dog=c.dog; if(c.flock&&SHEEP_SPOTS.includes(c.flock)) M.flock=c.flock;
    if(c.watch) M.watch=c.watch; if(c.bait!=null) M.bait=!!c.bait&&M.baitOwned; }

  function night(M){ const ev={night:M.night,wolfNight:M.wolfNight,kills:0,where:null,blocked:false,by:null,dogDied:false,barnScene:false,playerDead:false};
    if(M.watch!=='none'&&M.oil>0) M.oil--;
    if(M.wolfNight&&!M.dogDead){ const rc=reach(M), w=watched(M);
      if(M.bait&&baitReach(M)&&!w){ M.dogDead=true; M.bait=false; M.baitOwned=false; ev.dogDied=true; }  // raw meat first: the bait, not the sheep
      else if(w||!rc.can){ ev.blocked=true; ev.by=w?'watched':'chained';                                   // the hunger carries over
        if(!rc.can&&M.dog==='barn'&&!M.barnScene){ M.barnScene=true; ev.barnScene=true; } }
      else { const k=Math.min(M.sheep,rc.beside||M.h>=GREEDY_H?2:1); M.sheep-=k; M.h=Math.max(0,M.h-T.eat*k); ev.kills=k; ev.where=M.flock;
        if(M.barnScene) M.killAfterBarn=true;
        if(M.sheep<=0){ M.dead=true; ev.playerDead=true; } } }
    if(M.dead||M.night>=NIGHTS) M.over=true;
    M.log.push(ev); return ev; }

  function ending(M){ if(M.dead) return 'death'; if(M.dogDead) return 'dark'; if(M.barnScene&&!M.killAfterBarn) return 'true'; return 'survive'; }

  return {T,NIGHTS,WOLF_H,GREEDY_H,OIL,DOG_SPOTS,SHEEP_SPOTS,rng,newRun,reach,watched,dusk,choose,night,ending};
})();

if(typeof module!=='undefined'&&module.exports){ module.exports=RULES; return; } // node: rules only, for the simulator
const K=root.__RTK; if(!K) return;
K.medRules=RULES;
})(typeof window!=='undefined'?window:globalThis);
