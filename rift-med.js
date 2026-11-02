/* Rift 86 · the Middle Ages, c. AD 1350
   A cabin in a forest, foggy by day, wet by night. Something watches from deep in the trees; on the nights it comes to
   the tree line, a sheep is gone by morning.
   Fetched by rift-travel.js the first time this crack is chosen; builds with the kit it exposes (window.__RTK).
   Everything that decides what happens lives in RULES below: fixed, simple, never scripted. The world only shows it. */
(function(root){
'use strict';

/* ================= RULES =================
   The hidden truth, as three rules that never change:
   1. The dog has a hunger the player never sees. It rises every dusk. When it is high and the dog is unwatched and
      can reach the sheep, it kills.
   2. The thing in the trees comes to the tree line only on nights the dog means to hunt (decided at dusk, before any
      choice). Every other time it keeps deep in the forest, out of reach.
   3. On those nights it watches the dog, not you. (Presentation; see the watcher.)
   Pure functions on a plain state object, so a run can be simulated thousands of times with no screen. */
const RULES=(()=>{
  const NIGHTS=5, WOLF_H=2, GREEDY_H=4, OIL=3;
  const T={rise:1,stormRise:1,eat:1.5,heavy:.25}; // tuning (medsim): hunger per dusk, extra on heavy-rain dusks (storms stir it), drop per sheep eaten, chance of heavy rain
  const DOG_SPOTS=['shed','doorstep','hearth','tied'];   // hearth = loose indoors; tied = roped to the post by the fire
  const SHEEP_SPOTS=['shed','house'];                  // house = brought indoors, into the byre end
  function rng(seed){ let s=seed>>>0||1; return ()=>{ s=(s+0x6D2B79F5)>>>0; let t=s; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61); return ((t^t>>>14)>>>0)/4294967296; }; }

  function newRun(seed){ const r=rng(seed);
    return {seed,r,night:0,sheep:5+Math.floor(r()*3),sheep0:0,h:Math.floor(r()*2),oil:OIL,
      dog:'doorstep',flock:'shed',watch:'none',bait:false,baitOwned:true,
      wolfNight:false,rain:'light',dogDead:false,hearthScene:false,killAfterHearth:false,dead:false,over:false,log:[]}; }

  // where the dog can get to the sheep, and whether it sleeps right beside them
  function reach(M){
    if(M.dog==='tied') return M.flock==='house'?{can:true,beside:true}:{can:false,beside:false}; // tied: only what shares the room
    if(M.dog==='shed') return {can:true,beside:M.flock==='shed'};
    return {can:true,beside:false};                    // the doorstep, or slipping out of the house
  }
  // the player can only keep eyes on the dog from the house: by the fire or on the doorstep
  const watched=M=>M.watch==='dog'&&M.oil>0&&(M.dog==='hearth'||M.dog==='doorstep');
  const baitReach=M=>M.dog!=='tied';                   // the bait lies by the shed gate

  function dusk(M){ M.night++; if(!M.sheep0) M.sheep0=M.sheep; M.rain=M.r()<T.heavy?'heavy':'light'; M.h+=T.rise+(M.rain==='heavy'?T.stormRise:0);
    M.wolfNight=!M.dogDead&&M.h>=WOLF_H;                // intent, fixed before the player chooses anything
    return {night:M.night,wolfNight:M.wolfNight,rain:M.rain,refusesFood:!M.dogDead&&M.h>=WOLF_H}; }

  function choose(M,c){ if(c.dog&&DOG_SPOTS.includes(c.dog)) M.dog=c.dog; if(c.flock&&SHEEP_SPOTS.includes(c.flock)) M.flock=c.flock;
    if(c.watch) M.watch=c.watch; if(c.bait!=null) M.bait=!!c.bait&&M.baitOwned; }

  function night(M){ const ev={night:M.night,wolfNight:M.wolfNight,kills:0,where:null,blocked:false,by:null,dogDied:false,hearthScene:false,playerDead:false};
    if(M.watch!=='none'&&M.oil>0) M.oil--;
    if(M.wolfNight&&!M.dogDead){ const rc=reach(M), w=watched(M);
      if(M.bait&&baitReach(M)&&!w){ M.dogDead=true; M.bait=false; M.baitOwned=false; ev.dogDied=true; }  // raw meat first: the bait, not the sheep
      else if(w||!rc.can){ ev.blocked=true; ev.by=w?'watched':'chained';                                   // the hunger carries over
        if(!rc.can&&M.dog==='tied'&&!M.hearthScene){ M.hearthScene=true; ev.hearthScene=true; } }
      else { const k=Math.min(M.sheep,rc.beside||M.h>=GREEDY_H?2:1); M.sheep-=k; M.h=Math.max(0,M.h-T.eat*k); ev.kills=k; ev.where=M.flock;
        if(M.hearthScene) M.killAfterHearth=true;
        if(M.sheep<=0){ M.dead=true; ev.playerDead=true; } } }
    if(M.dead||M.night>=NIGHTS) M.over=true;
    M.log.push(ev); return ev; }

  function ending(M){ if(M.dead) return 'death'; if(M.dogDead) return 'dark'; if(M.hearthScene&&!M.killAfterHearth) return 'true'; return 'survive'; }

  return {T,NIGHTS,WOLF_H,GREEDY_H,OIL,DOG_SPOTS,SHEEP_SPOTS,rng,newRun,reach,watched,dusk,choose,night,ending};
})();

if(typeof module!=='undefined'&&module.exports){ module.exports=RULES; return; } // node: rules only, for the simulator
const K=root.__RTK; if(!K) return;
K.medRules=RULES;
const {R,S,P,reduce,cam,tex,px,disc,sky,rnd,rr,clamp,lerp,sstep,V,put,flush,snd,after,title,untitle,objective,msg,fadeTo,setPal,toPal}=K;
const $=s=>document.querySelector(s);

/* ================= THE CABIN =================
   A timber-framed cabin alone in a clearing, with a lean-to shed for the sheep built onto its east wall, and forest
   all round. You start inside by the fire. On your left, the west wall: the one window and the door. The only way
   anywhere is the track west into the trees, to where the rift is. 1 unit ~ 1 m; -z is north.
   The cabin is hollow and its walls are real: what is inside is seen from outside (and the other way) only through
   the window or the open door (see canSee). */
const CABIN={x:0,z:0,w:9,d:6,h:2.6}, CX0=CABIN.x-CABIN.w/2, CX1=CABIN.x+CABIN.w/2, CZ0=CABIN.z-CABIN.d/2, CZ1=CABIN.z+CABIN.d/2;
const HEARTH={x:-.5,z:CZ0+.5}, SPAWN={x:-.5,z:-.55};
const WINDOW={x:CX0,z0:-1.8,z1:-.8,y0:1,y1:1.8}, DOOR={x:CX0,z:1.3,z0:.75,z1:1.85,h:2};
const SHED={x0:CX1,x1:9.4,z0:-3.4,z1:3.4,gx0:6.4,gx1:8};   // open-sided, fenced; the gate gap is on the south side
const BYRE=2.2;                                             // a hurdle across the east end of the room: where the sheep go if brought in
const TIEPOST={x:1.3,z:CZ0+.75};
const BOWL={x:.95,z:-1.2}, BAIT={x:5.6,z:4.9}, LAMP={x:.9,z:1.6}, BED={x:-2.5,z:2.45}, DOGBED={x:8.9,z:4.35};
const PATH=[[-4.9,1.3],[-7.2,1.05],[-10,.2],[-13,-.9],[-16.4,-1.9]], RIFTP={x:-17,z:-2.1};
const TREELINE=15, BOUND=13;   // the forest starts here; you can walk to just short of it
// gaps in the tree line where the watcher can stand; the first two can be seen from the window
const GAPS=[{x:-14.6,z:-4.3},{x:-13.6,z:-6.6},{x:1,z:-15.2},{x:10.5,z:-11},{x:15.3,z:1.5},{x:9.5,z:12},{x:-2,z:15.2},{x:-11,z:10.5}];
// deep in the forest, well past where you can walk: where the watcher stands on any other day or night. A lane is left
// through the trees to each one, so that from the clearing it can be seen between the trunks. The first can be seen from the window.
const DEEP=[{x:-26,z:-5.5}].concat(Array.from({length:13},(_,i)=>{ const a=i*.4833+.35*((i*7)%3), r=22+((i*5)%9); return {x:Math.cos(a)*r,z:Math.sin(a)*r}; }).filter(p=>Math.hypot(p.x-RIFTP.x,p.z-RIFTP.z)>6));
const TREES=[];   // trunks and crowns near enough to hide the watcher: {x,z,r}
function segDist(px,pz,ax,az,bx,bz){ const dx=bx-ax, dz=bz-az, t=clamp(((px-ax)*dx+(pz-az)*dz)/(dx*dx+dz*dz||1),0,1); return Math.hypot(px-ax-dx*t,pz-az-dz*t); }
const inLane=(x,z)=>DEEP.some(p=>{ const r=Math.hypot(p.x,p.z), ux=p.x/r, uz=p.z/r; return segDist(x,z,ux*11,uz*11,p.x+ux*1.5,p.z+uz*1.5)<1.6; });
function treesBetween(ax,az,bx,bz){ for(const t of TREES){ if(segDist(t.x,t.z,ax,az,bx,bz)<t.r&&Math.hypot(t.x-bx,t.z-bz)>1) return true; } return false; }
// storm night: cold blue-greys, dark grass and earth, one warm amber (the fire, the lantern), red for what should not be there
const PAL_STORM=toPal(['#05070a','#0b1016','#121a22','#1b2630','#26343f','#34465a','#4f6577','#7f98ad','#b9c8d3','#e3ecf1',
  '#0e1410','#18221a','#26331f','#4a4230','#1c1712','#2e251c','#6b4a2a','#f0a43c','#fff3d0','#c4221a']);

const inCabin=(x,z)=>x>CX0&&x<CX1&&z>CZ0&&z<CZ1;
const inShed=(x,z)=>x>SHED.x0&&x<SHED.x1&&z>SHED.z0&&z<SHED.z1;
const sheltered=(x,z)=>(x>CX0-.6&&x<CX1+.6&&z>CZ0-.6&&z<CZ1+.6)||(x>CX1&&x<10&&z>-3.9&&z<3.9);   // under a roof: no rain
function pathDist(x,z){ let b=99; for(let i=0;i<PATH.length-1;i++){ const [ax,az]=PATH[i], [bx,bz]=PATH[i+1], dx=bx-ax, dz=bz-az;
    const t=clamp(((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz),0,1), d=Math.hypot(x-ax-dx*t,z-az-dz*t); if(d<b) b=d; } return b; }
function ghM(x,z){ const r=Math.hypot(x,z);
  let h=(.16*Math.sin(x*.13+.7)+.12*Math.cos(z*.11)+.07*Math.sin((x-z)*.29))*sstep(10.5,15,r);   // the clearing is flat; the forest floor is not
  if(r>15) h+=Math.min((r-15)*(r-15)*.006,10); return h; }
// solid boxes the player and the animals cannot walk through: {x0,x1,z0,z1}; `off` ones (the door) can be switched
const RECTS=[], CIRCS=[];
function rect(x0,x1,z0,z1){ const b={x0,x1,z0,z1,off:false}; RECTS.push(b); return b; }
function blockedM(x,z,r){ r=r||.3; if(Math.hypot(x,z)>BOUND&&!(pathDist(x,z)<1.2&&x>RIFTP.x-.3)) return true;
  for(const b of RECTS) if(!b.off&&x>b.x0-r&&x<b.x1+r&&z>b.z0-r&&z<b.z1+r) return true;
  for(const c of CIRCS){ const dx=x-c.x, dz=z-c.z, q=c.r+r; if(dx*dx+dz*dz<q*q) return true; } return false; }
// the door: open is what you last did with it; a is where it actually is (the watcher can throw it open)
const DS={open:false,a:0,rect:null,leaf:null,passable:false};
// can you see this point from where you stand? on screen, and not behind a wall: same side of the walls, or through the window or the open door
function canSee(x,y,z,m){ if(!K.onScreen(x,y,z,m)) return false;
  const a=inCabin(TP.x,TP.z); if(a===inCabin(x,z)) return true;
  const cy=cam.position.y, dx=x-TP.x; if(Math.abs(dx)<1e-4) return false;
  const t=(CX0-TP.x)/dx; if(t<=0||t>=1) return false;   // the only openings are in the west wall
  const zc=TP.z+(z-TP.z)*t, yc=cy+(y-cy)*t;
  if(zc>WINDOW.z0&&zc<WINDOW.z1&&yc>WINDOW.y0&&yc<WINDOW.y1) return true;
  return DS.a>.5&&zc>DOOR.z0&&zc<DOOR.z1&&yc<DOOR.h; }

let W=null; // the built world
function buildMed(){ K.reseed(1350714);
  const sc=new THREE.Scene(); sc.background=new THREE.Color(0x1b2630); sc.fog=new THREE.FogExp2(0x1b2630,.03);
  const T={
    grass:tex(32,32,(g,w,h)=>{ px(g,'#18221a',0,0,w,h); for(let i=0;i<300;i++) px(g,['#26331f','#0e1410','#18221a','#3a4630'][i%4],rnd()*w,rnd()*h,1,1+(rnd()*2|0)); },40),
    track:tex(32,32,(g,w,h)=>{ px(g,'#2e251c',0,0,w,h); for(let i=0;i<220;i++) px(g,['#4a3c2c','#1c1712','#34465a','#26331f'][i%4],rnd()*w,rnd()*h,1+(rnd()*2|0),1);
      for(let y=0;y<h;y++){ px(g,'#1c1712',9+Math.sin(y*.4)|0,y,2,1); px(g,'#1c1712',21+Math.cos(y*.3)|0,y,2,1); } },1,8),   // two ruts worn by a handcart
    stone:tex(32,32,(g,w,h)=>{ px(g,'#34465a',0,0,w,h); for(let i=0;i<14;i++){ const x=rnd()*w, y=rnd()*h, r=rr(3,6); disc(g,['#4f6577','#26343f','#34465a'][i%3],x,y,r); }   // fieldstones, not dressed
      for(let i=0;i<60;i++) px(g,rnd()<.5?'#1b2630':'#26331f',rnd()*w,rnd()*h,1+(rnd()*2|0),1); },2,1),
    plank:tex(32,32,(g,w,h)=>{ px(g,'#2e251c',0,0,w,h); for(let x=0;x<w;x+=4+(rnd()*3|0)){ px(g,'#1c1712',x,0,1,h); } for(let i=0;i<70;i++) px(g,rnd()<.5?'#4a3c2c':'#1c1712',rnd()*w,rnd()*h,1,2+(rnd()*3|0)); },2,1),
    daub:tex(32,32,(g,w,h)=>{ px(g,'#4a4230',0,0,w,h); for(let i=0;i<170;i++) px(g,['#6b4a2a','#34465a','#4a3c2c','#2e251c'][i%4],rnd()*w,rnd()*h,1+(rnd()*2|0),1);
      for(let i=0;i<5;i++){ let x=rnd()*w, y=rnd()*h; for(let k=0;k<8;k++){ px(g,'#1c1712',x,y); x+=rr(-1,1.5); y+=1; } } },2,1),   // clay over the wattle, cracked
    thatch:tex(32,32,(g,w,h)=>{ px(g,'#4a4230',0,0,w,h); for(let i=0;i<260;i++) px(g,['#6b4a2a','#2e251c','#4a3c2c','#1c1712'][i%4],rnd()*w,rnd()*h,1,2+(rnd()*4|0));
      for(let y=0;y<h;y+=8) px(g,'#2e251c',0,y,w,1); },3,2),   // straw laid in courses, gone grey-brown with rain
    earth:tex(32,32,(g,w,h)=>{ px(g,'#2e251c',0,0,w,h); for(let i=0;i<200;i++) px(g,['#1c1712','#4a3c2c','#26343f','#6b4a2a'][i%4],rnd()*w,rnd()*h,1+(rnd()*2|0),1); },3,2),
    straw:tex(32,32,(g,w,h)=>{ g.clearRect(0,0,w,h); for(let i=0;i<70;i++){ const x=rnd()*w, y=rnd()*h, a=rnd()*3.14, L=rr(3,7);
      g.strokeStyle=['#6b4a2a','#4a4230','#f0a43c'][i%3]; g.globalAlpha=i%3===2?.6:1; g.beginPath(); g.moveTo(x,y); g.lineTo(x+Math.cos(a)*L,y+Math.sin(a)*L); g.stroke(); } g.globalAlpha=1; }),
    hay:tex(32,32,(g,w,h)=>{ px(g,'#4a4230',0,0,w,h); for(let i=0;i<200;i++) px(g,['#6b4a2a','#2e251c','#f0a43c','#4a3c2c'][i%4],rnd()*w,rnd()*h,1,1+(rnd()*3|0)); }),
    flame:tex(16,32,(g,w,h)=>{ g.clearRect(0,0,w,h); const gr=g.createLinearGradient(0,h,0,0); gr.addColorStop(0,'#fff3d0'); gr.addColorStop(.35,'#f0a43c'); gr.addColorStop(.75,'#c4221a'); gr.addColorStop(1,'rgba(196,34,26,0)');
      g.fillStyle=gr; g.beginPath(); g.moveTo(1,h); g.quadraticCurveTo(0,h*.45,w/2,0); g.quadraticCurveTo(w,h*.45,w-1,h); g.fill(); }),
    tuft:tex(32,32,(g,w,h)=>{ g.clearRect(0,0,w,h); for(let k=0;k<11;k++){ const bx=3+k*2.6+rnd()*2, lean=rr(-5,5), H=rr(16,31);
      for(let y=0;y<H;y++){ const t=y/H; px(g,t>.75&&k%3===0?'#4a3c2c':(k%2?'#26331f':'#3a4630'),bx+lean*t*t,h-1-y); } } }),
    sky:tex(4,64,(g,w,h)=>{ sky(g,w,h,['#0b1016','#121a22','#1b2630','#26343f']); }),
    cloud:tex(64,32,(g,w,h)=>{ g.clearRect(0,0,w,h); for(let i=0;i<46;i++){ const x=rnd()*w, y=rr(4,h-4), r=rr(3,8); g.globalAlpha=rr(.15,.4); disc(g,rnd()<.5?'#26343f':'#34465a',x,y,r); } g.globalAlpha=1; },3,1)
  };
  const M={
    grass:new THREE.MeshPhongMaterial({map:T.grass,shininess:2,specular:0x050505}),
    track:new THREE.MeshPhongMaterial({map:T.track,shininess:8,specular:0x101418}),
    stone:new THREE.MeshPhongMaterial({map:T.stone,flatShading:true,shininess:3}),
    plank:new THREE.MeshPhongMaterial({map:T.plank,flatShading:true,shininess:2}),
    daub:new THREE.MeshPhongMaterial({map:T.daub,flatShading:true,shininess:2}),
    thatch:new THREE.MeshPhongMaterial({map:T.thatch,flatShading:true,shininess:0}),
    earth:new THREE.MeshPhongMaterial({map:T.earth,shininess:1}),
    straw:new THREE.MeshPhongMaterial({map:T.straw,alphaTest:.5,shininess:0}),
    hay:new THREE.MeshPhongMaterial({map:T.hay,flatShading:true,shininess:0}),
    wood:new THREE.MeshPhongMaterial({color:0x2e251c,flatShading:true,shininess:2}),
    oak:new THREE.MeshPhongMaterial({color:0x1c1712,flatShading:true,shininess:2}),     // the frame: older and darker than the boards
    iron:new THREE.MeshPhongMaterial({color:0x0b1016,flatShading:true,shininess:30,specular:0x34465a}),
    wool:new THREE.MeshPhongMaterial({color:0x7f98ad,flatShading:true,shininess:1}),
    cloth:new THREE.MeshPhongMaterial({color:0x26343f,flatShading:true,shininess:1}),
    herb:new THREE.MeshPhongMaterial({color:0x26331f,flatShading:true,shininess:0}),
    mud:new THREE.MeshPhongMaterial({color:0x1c1712,shininess:40,specular:0x34465a}),
    leaf:new THREE.MeshPhongMaterial({color:0x18221a,flatShading:true,shininess:0}),
    pine:new THREE.MeshPhongMaterial({color:0x0e1410,flatShading:true,shininess:0}),
    dark:new THREE.MeshPhongMaterial({color:0x0b1016,flatShading:true,shininess:0}),
    soot:new THREE.MeshBasicMaterial({color:0x05070a}),
    tuft:new THREE.MeshPhongMaterial({map:T.tuft,alphaTest:.5,side:THREE.DoubleSide,shininess:0}),
  };
  const box=new THREE.BoxGeometry(1,1,1), cyl=new THREE.CylinderGeometry(1,1,1,6,1), ico=new THREE.IcosahedronGeometry(1,0), cone=new THREE.ConeGeometry(1,1,6), plane=new THREE.PlaneGeometry(1,1);
  const B=(m,x0,x1,y0,y1,z0,z1)=>put(box,m,(x0+x1)/2,(y0+y1)/2,(z0+z1)/2,0,0,0,x1-x0,y1-y0,z1-z0);   // a box by its bounds
  // a timber from a to b; sx is its depth across the wall it sits in, sy its width
  const beam=(m,ax,ay,az,bx,by,bz,sx,sy)=>{ const dx=bx-ax, dy=by-ay, dz=bz-az, L=Math.hypot(dx,dy,dz);
    put(box,m,(ax+bx)/2,(ay+by)/2,(az+bz)/2,Math.atan2(-dy,Math.hypot(dx,dz)),Math.atan2(dx,dz),0,sx,sy||sx,L); };
  const logs=(x,y,z,ry,L,r)=>put(cyl,M.wood,x,y,z,0,ry,Math.PI/2,r,L,r);

  // ground: one wide sheet, the clearing flat, the forest floor rising away into the fog
  const gg=new THREE.PlaneGeometry(200,200,100,100); gg.rotateX(-Math.PI/2); const gp=gg.attributes.position;
  for(let i=0;i<gp.count;i++) gp.setY(i,ghM(gp.getX(i),gp.getZ(i))); gg.computeVertexNormals(); sc.add(new THREE.Mesh(gg,M.grass));
  // the track: a ribbon from the doorstep west into the trees, to the rift
  { const pts=[], uv=[], idx=[]; let n=0, run=0, px_=PATH[0][0], pz_=PATH[0][1];
    for(let i=0;i<PATH.length-1;i++){ const [ax,az]=PATH[i], [bx,bz]=PATH[i+1], L=Math.hypot(bx-ax,bz-az), st=Math.ceil(L/.5);
      for(let k=(i?1:0);k<=st;k++){ const t=k/st, x=lerp(ax,bx,t), z=lerp(az,bz,t), nx=-(bz-az)/L, nz=(bx-ax)/L, w=.55+.1*Math.sin(x*1.7);
        run+=Math.hypot(x-px_,z-pz_); px_=x; pz_=z;
        for(const s of [-1,1]){ const qx=x+nx*s*w, qz=z+nz*s*w; pts.push(qx,ghM(qx,qz)+.03,qz); uv.push(s<0?0:1,run/4); } if(n) idx.push(n*2-2,n*2-1,n*2,n*2-1,n*2+1,n*2); n++; } }
    const lg=new THREE.BufferGeometry(); lg.setAttribute('position',new THREE.Float32BufferAttribute(pts,3)); lg.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2)); lg.setIndex(idx); lg.computeVertexNormals();
    T.track.repeat.set(1,1); sc.add(new THREE.Mesh(lg,M.track)); }

  // ---- the cabin ----
  const H=CABIN.h, WT=.25, FT=.32, t=.15;
  // a footing of fieldstones under every wall, a low worn step at the door
  B(M.stone,CX0-.2,CX1+.2,-.1,.32,CZ0-.2,CZ0+.2); B(M.stone,CX0-.2,CX1+.2,-.1,.32,CZ1-.2,CZ1+.2); B(M.stone,CX1-.2,CX1+.2,-.1,.32,CZ0,CZ1);
  B(M.stone,CX0-.2,CX0+.2,-.1,.32,CZ0,DOOR.z0); B(M.stone,CX0-.2,CX0+.2,-.1,.32,DOOR.z1,CZ1); B(M.stone,CX0-.75,CX0+.2,-.1,.08,DOOR.z0-.05,DOOR.z1+.05);
  // wattle and daub between the timbers; the west wall is cut for the window and the door
  const wallZ=(z,x0,x1,y0,y1)=>B(M.daub,x0,x1,y0,y1,z-WT/2,z+WT/2), wallX=(x,z0,z1,y0,y1)=>B(M.daub,x-WT/2,x+WT/2,y0,y1,z0,z1);
  wallZ(CZ0,CX0,CX1,.32,H); wallZ(CZ1,CX0,CX1,.32,H); wallX(CX1,CZ0,CZ1,.32,H);
  wallX(CX0,CZ0,WINDOW.z0,.32,H); wallX(CX0,WINDOW.z0,WINDOW.z1,.32,WINDOW.y0); wallX(CX0,WINDOW.z0,WINDOW.z1,WINDOW.y1,H);
  wallX(CX0,WINDOW.z1,DOOR.z0,.32,H); wallX(CX0,DOOR.z0,DOOR.z1,DOOR.h,H); wallX(CX0,DOOR.z1,CZ1,.32,H);
  rect(CX0-t,CX1+t,CZ0-t,CZ0+t); rect(CX0-t,CX1+t,CZ1-t,CZ1+t); rect(CX1-t,CX1+t,CZ0,CZ1); rect(CX0-t,CX0+t,CZ0,DOOR.z0); rect(CX0-t,CX0+t,DOOR.z1,CZ1);
  DS.rect=rect(CX0-t,CX0+t,DOOR.z0,DOOR.z1); DS.leaf=rect(CX0-1.15,CX0-.05,1.7,1.95); DS.leaf.off=true;
  // the oak frame, proud of the daub inside and out: posts, sill, wall plate, a few braces
  for(const z of [CZ0,CZ1]){ for(const x of [CX0+.1,-2.6,1.6,CX1-.1]) B(M.oak,x-.11,x+.11,.32,H,z-FT/2,z+FT/2);
    B(M.oak,CX0,CX1,.32,.46,z-FT/2,z+FT/2); B(M.oak,CX0,CX1,H-.16,H,z-FT/2,z+FT/2);
    beam(M.oak,CX0+.2,.5,z,-2.75,H-.2,z,FT,.12); beam(M.oak,CX1-.2,.5,z,1.75,H-.2,z,FT,.12); }
  for(const z of [CZ0+.1,-1,1,CZ1-.1]) B(M.oak,CX1-FT/2,CX1+FT/2,.32,H,z-.11,z+.11);
  B(M.oak,CX1-FT/2,CX1+FT/2,.32,.46,CZ0,CZ1); B(M.oak,CX1-FT/2,CX1+FT/2,H-.16,H,CZ0,CZ1);
  beam(M.oak,CX1,.5,CZ0+.2,CX1,H-.2,-1.15,FT,.12); beam(M.oak,CX1,.5,CZ1-.2,CX1,H-.2,1.15,FT,.12);
  for(const z of [CZ0+.1,WINDOW.z0-.1,WINDOW.z1+.1,DOOR.z0-.1,DOOR.z1+.1,CZ1-.1]) B(M.oak,CX0-FT/2,CX0+FT/2,.32,H,z-.1,z+.1);
  B(M.oak,CX0-FT/2,CX0+FT/2,.32,.46,CZ0,DOOR.z0); B(M.oak,CX0-FT/2,CX0+FT/2,.32,.46,DOOR.z1,CZ1); B(M.oak,CX0-FT/2,CX0+FT/2,H-.16,H,CZ0,CZ1);
  beam(M.oak,CX0,.5,CZ0+.2,CX0,WINDOW.y1+.3,WINDOW.z0-.2,FT,.12); beam(M.oak,CX0,.5,CZ1-.2,CX0,DOOR.h+.4,DOOR.z1+.2,FT,.12);
  // the window: no glass, a split-oak frame with one mullion, the shutters folded back against the wall outside
  B(M.oak,CX0-.24,CX0+.2,WINDOW.y0-.09,WINDOW.y0+.03,WINDOW.z0-.12,WINDOW.z1+.12); B(M.oak,CX0-.2,CX0+.2,WINDOW.y1-.02,WINDOW.y1+.1,WINDOW.z0-.12,WINDOW.z1+.12);
  B(M.oak,CX0-.05,CX0+.05,WINDOW.y0,WINDOW.y1,(WINDOW.z0+WINDOW.z1)/2-.04,(WINDOW.z0+WINDOW.z1)/2+.04);
  B(M.plank,CX0-.26,CX0-.2,WINDOW.y0,WINDOW.y1,WINDOW.z0-.62,WINDOW.z0-.12); B(M.plank,CX0-.26,CX0-.2,WINDOW.y0,WINDOW.y1,WINDOW.z1+.12,WINDOW.z1+.62);
  for(const y of [WINDOW.y0+.15,WINDOW.y1-.15]){ B(M.iron,CX0-.29,CX0-.25,y-.03,y+.03,WINDOW.z0-.55,WINDOW.z0-.1); B(M.iron,CX0-.29,CX0-.25,y-.03,y+.03,WINDOW.z1+.1,WINDOW.z1+.55); }
  B(M.oak,CX0-.18,CX0+.18,DOOR.h-.04,DOOR.h+.12,DOOR.z0-.12,DOOR.z1+.12);   // the door lintel
  // floor of beaten earth; a sheepskin before the fire
  B(M.earth,CX0+.12,CX1-.12,-.05,.03,CZ0+.12,CZ1-.12);
  put(box,M.wool,-1.2,.045,-1.5,0,.25,0,1.15,.03,.85);
  // the roof: steep thatch over a ridge running north-south, gables at both ends, rafters and tie-beams bare inside
  const R=3.8, k=R/(CABIN.w/2), OV=.55, ex=CABIN.w/2+OV, eY=H-OV*k, aY=H+R, ang=Math.atan2(R,CABIN.w/2), sl=Math.hypot(ex,ex*k), sa=Math.sin(ang), ca=Math.cos(ang);
  for(const s of [-1,1]){ const xc=s*ex/2, yc=(aY+eY)/2;
    put(box,M.thatch,xc+s*sa*.2,yc+ca*.2,CABIN.z,0,0,-s*ang,sl+.3,.4,CABIN.d+1.2);
    for(let z=CZ0-.5;z<=CZ1+.5;z+=.36) put(box,M.thatch,s*(ex+rr(-.05,.12)),eY+rr(-.05,.12),z+rr(-.05,.05),0,rr(-.1,.1),-s*ang+rr(-.25,.25),.5,.26,.4);   // ragged eaves
    for(let z=CZ0+.2;z<=CZ1-.1;z+=.95) put(box,M.oak,xc-s*sa*.08,yc-ca*.08,z,0,0,-s*ang,sl,.13,.13); }
  B(M.oak,-.09,.09,aY-.3,aY-.12,CZ0-.6,CZ1+.6);                                     // ridge pole
  for(const z of [-1.5,1.5]) B(M.oak,CX0,CX1,H-.2,H,z-.1,z+.1);                     // tie-beams
  for(const z of [CZ0,CZ1]){ const gs=new THREE.BufferGeometry(); gs.setAttribute('position',new THREE.Float32BufferAttribute([CX0,0,0, CX1,0,0, 0,R,0],3)); gs.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,2,0,1,1.6],2)); gs.computeVertexNormals();
    const gm=new THREE.Mesh(gs,new THREE.MeshPhongMaterial({map:T.daub,flatShading:true,side:THREE.DoubleSide})); gm.position.set(CABIN.x,H,z); sc.add(gm); }
  // the fireplace on the north wall: fieldstone cheeks, an oak lintel, a stone hood, the stack out through the thatch
  B(M.soot,-1.3,.3,.08,1.15,CZ0+.12,CZ0+.16);
  B(M.stone,-1.68,-1.25,0,1.18,CZ0+.12,CZ0+.78); B(M.stone,.25,.68,0,1.18,CZ0+.12,CZ0+.78);
  B(M.oak,-1.72,.72,1.15,1.36,CZ0+.12,CZ0+.84); B(M.stone,-1.6,.6,1.36,H,CZ0+.12,CZ0+.62);
  B(M.stone,-1.75,.75,.03,.1,CZ0+.12,CZ0+1.08); rect(-1.75,.75,CZ0,CZ0+.9);
  B(M.stone,-1.15,.15,-.1,aY+.9,CZ0-.78,CZ0-.12); B(M.dark,-1,0,aY+.9,aY+.96,CZ0-.65,CZ0-.25);
  logs(-.5,.16,CZ0+.48,.45,.75,.07); logs(-.5,.16,CZ0+.48,-.45,.75,.07); logs(-1.0,.08,CZ0+1.0,1.57,.5,.06);
  put(cyl,M.iron,.08,.25,CZ0+.55,0,0,0,.17,.24,.17); for(const s of [-1,1]) beam(M.iron,.08+s*.14,0,CZ0+.55,.08+s*.14,.14,CZ0+.55,.03,.03);   // the pot on its trivet
  // a pile of split wood by the hearth, a long-handled hoe against the wall
  for(let i=0;i<7;i++) logs(-2.2+(i%3)*.05,.09+Math.floor(i/3)*.14,CZ0+.25+(i%3)*.16,1.57,.6,.07); CIRCS.push({x:-2.2,z:CZ0+.4,r:.35});
  beam(M.wood,-3.2,0,CZ0+.25,-3.05,1.65,CZ0+.18,.04,.04); B(M.iron,-3.2,-2.95,1.55,1.75,CZ0+.15,CZ0+.21);
  // the tie-post: one of the posts holding up the loft, an iron ring in it
  put(cyl,M.oak,TIEPOST.x,H/2,TIEPOST.z,0,0,0,.11,H,.11); put(new THREE.TorusGeometry(.07,.015,4,8),M.iron,TIEPOST.x-.1,.5,TIEPOST.z+.06,0,1.2,0); CIRCS.push({x:TIEPOST.x,z:TIEPOST.z,r:.16});
  // a straw pallet on the south wall, a table and stools, barrels in the corner by the window
  B(M.wood,-3.45,-1.6,.03,.28,CZ1-.95,CZ1-.15); B(M.hay,-3.4,-1.65,.28,.42,CZ1-.9,CZ1-.2); B(M.cloth,-2.95,-1.65,.42,.47,CZ1-.92,CZ1-.18); B(M.wool,-3.35,-3.0,.42,.5,CZ1-.8,CZ1-.3);
  rect(-3.45,-1.6,CZ1-.95,CZ1);
  B(M.plank,-.3,1.1,.72,.8,1.0,1.8); for(const [x,z] of [[-.2,1.1],[1,1.1],[-.2,1.7],[1,1.7]]) B(M.wood,x-.05,x+.05,.03,.72,z-.05,z+.05); rect(-.3,1.1,1.0,1.8);
  for(const [x,z] of [[.4,.65],[-.6,1.4]]){ put(cyl,M.wood,x,.25,z,0,0,0,.17,.44,.17); CIRCS.push({x,z,r:.17}); }
  put(cyl,M.wood,.2,.88,1.4,0,0,0,.07,.16,.07); put(cyl,M.wood,.7,.83,1.25,0,0,0,.14,.06,.14);   // a jug, a bowl
  for(const [x,z] of [[CX0+.45,CZ0+.45],[CX0+.95,CZ0+.4]]){ put(cyl,M.wood,x,.42,z,0,0,0,.3,.8,.3); for(const y of [.15,.7]) put(cyl,M.iron,x,y,z,0,0,0,.31,.04,.31); CIRCS.push({x,z,r:.3}); }
  put(cyl,M.hay,CX0+.5,.2,CZ0+1.0,0,0,0,.22,.36,.22);                                // a basket of wool
  // herbs drying from the tie-beam; a basket hung off the other
  for(let i=0;i<5;i++) put(cone,M.herb,-2.6+i*.22,H-.42,-1.5+rr(-.04,.04),Math.PI,rnd()*3,0,.07,.36,.07);
  put(cyl,M.hay,-1.4,H-.5,1.5,0,0,0,.22,.25,.22); beam(M.dark,-1.4,H-.36,1.5,-1.4,H-.2,1.5,.01,.01);
  // the byre end: a wattle hurdle across the room, a gap at the south end; above it a hay loft on joists, a ladder up
  for(let z=CZ0+.2;z<1.9;z+=.75) put(cyl,M.wood,BYRE,.5,z,0,0,0,.05,1,.05);
  for(const y of [.25,.5,.75,.95]) B(M.wood,BYRE-.04,BYRE+.04,y-.05,y+.05,CZ0+.15,1.9); rect(BYRE-.08,BYRE+.08,CZ0,1.9);
  B(M.plank,BYRE,CX1-.12,2.0,2.08,CZ0+.12,-.2); for(const z of [-2.4,-1.3,-.3]) B(M.oak,BYRE,CX1-.12,1.9,2.0,z-.06,z+.06);
  B(M.hay,2.7,4.3,2.08,2.45,CZ0+.2,-.7); put(box,M.hay,3.3,2.5,-1.6,0,.3,0,1.1,.3,.8);
  { const lx=2.9, b0=.45, b1=-.2; for(const s of [-1,1]) beam(M.wood,lx+s*.2,0,b0,lx+s*.2,2.35,b1,.05,.05);
    for(let i=1;i<7;i++){ const u=i/7; B(M.wood,lx-.2,lx+.2,u*2.35-.02,u*2.35+.02,lerp(b0,b1,u)-.02,lerp(b0,b1,u)+.02); } }
  B(M.straw,BYRE+.1,CX1-.15,.03,.04,CZ0+.15,CZ1-.15);
  // ---- outside the cabin: the doorstep, a chopping block, split wood stacked under the south eave ----
  put(cyl,M.wood,-6.3,.25,2.7,0,0,0,.28,.5,.28); beam(M.wood,-6.25,.45,2.7,-6.6,.95,2.85,.04,.04); B(M.iron,-6.36,-6.22,.42,.56,2.62,2.82); CIRCS.push({x:-6.3,z:2.7,r:.3});
  for(let r=0;r<3;r++) for(let i=0;i<10;i++) logs(-4+i*.32+(r%2)*.16,.1+r*.17,CZ1+.45,0,.55,.09); rect(-4.15,-.75,CZ1+.15,CZ1+.75);

  // ---- the shed: the roof carried on east off the cabin in a long low lean-to, on rough oak posts; rail fence on three sides ----
  const lr0={x:CX1-.2,y:3.0}, lr1={x:SHED.x1+.55,y:1.98}, lk=(lr0.y-lr1.y)/(lr1.x-lr0.x), roofY=x=>lr0.y-(x-lr0.x)*lk, la=Math.atan(lk);
  put(box,M.thatch,(lr0.x+lr1.x)/2+Math.sin(la)*.17,(lr0.y+lr1.y)/2+Math.cos(la)*.17,0,0,0,-la,Math.hypot(lr1.x-lr0.x,lr0.y-lr1.y),.34,SHED.z1-SHED.z0+1.1);
  for(let z=SHED.z0-.5;z<=SHED.z1+.5;z+=.36) put(box,M.thatch,lr1.x+rr(-.05,.1),lr1.y+rr(-.05,.1),z,0,rr(-.1,.1),-la+rr(-.2,.2),.45,.24,.4);
  for(let z=SHED.z0+.1;z<=SHED.z1;z+=1.1) beam(M.oak,CX1,roofY(CX1)-.12,z,SHED.x1+.3,roofY(SHED.x1+.3)-.12,z,.12,.12);   // rafters
  const sp=(x,z)=>{ const h=roofY(x)-.1; put(cyl,M.oak,x,h/2,z,rr(-.03,.03),0,rr(-.03,.03),.13+rr(0,.03),h,.13+rr(0,.03)); B(M.stone,x-.2,x+.2,-.05,.1,z-.2,z+.2); CIRCS.push({x,z,r:.16}); };
  for(const z of [SHED.z0,-1.15,1.15,SHED.z1]) sp(SHED.x1,z); for(const z of [SHED.z0,SHED.z1]) sp(6.9,z);
  B(M.oak,SHED.x1-.12,SHED.x1+.12,roofY(SHED.x1)-.28,roofY(SHED.x1)-.06,SHED.z0-.2,SHED.z1+.2);   // wall plate along the open side
  for(const z of [SHED.z0,SHED.z1]) beam(M.oak,CX1,roofY(CX1)-.2,z,SHED.x1+.1,roofY(SHED.x1+.1)-.2,z,.16,.16);
  for(const z of [SHED.z0,-1.15,1.15,SHED.z1]){ const top=roofY(SHED.x1)-.2; if(z>SHED.z0) beam(M.oak,SHED.x1,top-.65,z,SHED.x1,top,z-.6,.1,.1); if(z<SHED.z1) beam(M.oak,SHED.x1,top-.65,z,SHED.x1,top,z+.6,.1,.1); }
  for(const z of [SHED.z0,SHED.z1]){ const top=roofY(6.9)-.25; beam(M.oak,6.9,top-.7,z,7.6,top-.1,z,.1,.1); beam(M.oak,6.9,top-.7,z,6.2,top+.05,z,.1,.1); }
  // the fence: three split rails between the posts, small stakes in between; the gate gap faces south onto the clearing
  const rails=(ax,az,bx,bz)=>{ for(const y of [.35,.7,1.05]) beam(M.wood,ax,y,az,bx,y,bz,.07,.11);
    const L=Math.hypot(bx-ax,bz-az), n=Math.max(1,Math.round(L/1.6)); for(let i=1;i<n;i++){ const u=i/n; put(cyl,M.wood,lerp(ax,bx,u),.6,lerp(az,bz,u),0,0,0,.06,1.2,.06); } };
  rails(SHED.x1,SHED.z0,SHED.x1,SHED.z1); rails(CX1+.15,SHED.z0,SHED.x1,SHED.z0); rails(CX1+.15,SHED.z1,SHED.gx0,SHED.z1); rails(SHED.gx1,SHED.z1,SHED.x1,SHED.z1);
  put(cyl,M.oak,SHED.gx0,.65,SHED.z1,0,0,0,.09,1.3,.09); put(cyl,M.oak,SHED.gx1,.65,SHED.z1,0,0,0,.09,1.3,.09);
  rect(SHED.x1-t,SHED.x1+t,SHED.z0,SHED.z1); rect(CX1,SHED.x1,SHED.z0-t,SHED.z0+t); rect(CX1,SHED.gx0,SHED.z1-t,SHED.z1+t); rect(SHED.gx1,SHED.x1,SHED.z1-t,SHED.z1+t);
  // the gate, hung on the east gatepost and standing open: rails, a brace, hinges of rope and iron, a crude latch
  { const gx=SHED.gx1+.06, z0=SHED.z1+.08, z1=SHED.z1+1.55; for(const y of [.3,.65,1.0]) B(M.wood,gx-.04,gx+.04,y-.05,y+.05,z0,z1);
    for(const z of [z0+.04,z1-.04]) B(M.wood,gx-.05,gx+.05,.2,1.1,z-.05,z+.05); beam(M.wood,gx,.3,z0+.1,gx,1.0,z1-.1,.06,.08);
    for(const y of [.3,1.0]) B(M.iron,gx-.07,gx+.07,y-.04,y+.04,z0-.06,z0+.2); B(M.iron,gx-.08,gx+.08,.6,.7,z1-.12,z1); rect(gx-.1,gx+.1,z0,z1); }
  // inside: earth and mud, scattered straw, a trough on the north fence, a tub of water, a hay bin, tools against the cabin wall
  B(M.earth,CX1+.1,SHED.x1-.05,-.05,.025,SHED.z0+.05,SHED.z1-.05);
  for(let i=0;i<6;i++) put(box,M.mud,rr(5.2,8.8),.03,rr(-2.6,2.8),0,rnd()*3,0,rr(.5,1.2),.012,rr(.4,.9));
  for(let i=0;i<14;i++) put(plane,M.straw,rr(4.8,9.1),.036+i*.0005,rr(-3.1,3.1),-Math.PI/2,0,rnd()*3,rr(.8,1.5),rr(.8,1.5),1);
  for(let i=0;i<5;i++) put(plane,M.straw,rr(-6,-4.8),.03+ghM(-5.4,1.3)+i*.0005,rr(-.5,3),-Math.PI/2,0,rnd()*3,rr(.6,1),rr(.6,1),1);   // tracked out onto the doorstep
  B(M.wood,5.2,7.4,0,.45,SHED.z0+.2,SHED.z0+.65); B(M.dark,5.3,7.3,.4,.46,SHED.z0+.28,SHED.z0+.57); B(M.hay,5.4,7.1,.42,.5,SHED.z0+.3,SHED.z0+.55); rect(5.2,7.4,SHED.z0,SHED.z0+.7);
  put(cyl,M.wood,5.05,.25,SHED.z1-.55,0,0,0,.34,.5,.34); put(cyl,M.mud,5.05,.47,SHED.z1-.55,0,0,0,.3,.02,.3); put(cyl,M.iron,5.05,.4,SHED.z1-.55,0,0,0,.35,.04,.35); CIRCS.push({x:5.05,z:SHED.z1-.55,r:.36});
  B(M.plank,8.2,8.25,0,.7,SHED.z0+.1,SHED.z0+1.4); B(M.plank,8.2,SHED.x1-.1,0,.7,SHED.z0+1.35,SHED.z0+1.4); B(M.hay,8.25,SHED.x1-.12,0,.85,SHED.z0+.12,SHED.z0+1.35); put(box,M.hay,8.8,.95,SHED.z0+.7,0,.4,0,.7,.3,.6);
  rect(8.2,SHED.x1,SHED.z0,SHED.z0+1.4);
  for(const [x,z] of [[6.2,1.8],[7.9,-.8]]) put(box,M.hay,x,.22,z,0,rnd()*3,0,.9,.44,.55);                       // hay bundles, bound with rope
  beam(M.wood,CX1+.25,0,1.6,CX1+.2,1.75,1.85,.04,.04); for(const s of [-1,0,1]) beam(M.iron,CX1+.2,1.75,1.85+s*.07,CX1+.18,2.05,1.9+s*.09,.015,.015);   // hayfork
  beam(M.wood,CX1+.25,0,2.3,CX1+.2,1.5,2.4,.04,.04); B(M.iron,CX1+.15,CX1+.25,0,.25,2.15,2.45);                     // spade
  put(cyl,M.hay,5.0,.18,-1.9,0,0,0,.25,.36,.25);                                                                    // a basket
  { const lx=SHED.x1+.45; for(const s of [-1,1]) beam(M.wood,lx+.5,0,-.2+s*.22,lx,2.1,-.2+s*.22,.05,.05); for(let i=1;i<7;i++){ const u=i/7; B(M.wood,lerp(lx+.5,lx,u)-.02,lerp(lx+.5,lx,u)+.02,u*2.1-.02,u*2.1+.02,-.44,.04); } }   // a ladder against the shed
  put(cyl,M.wood,SHED.x1+.6,.42,2.6,0,0,0,.3,.8,.3); CIRCS.push({x:SHED.x1+.6,z:2.6,r:.3});                        // a barrel by the corner post
  put(box,M.cloth,DOGBED.x,.04,DOGBED.z,0,.3,0,.9,.06,.7); put(box,M.hay,DOGBED.x+.05,.08,DOGBED.z-.05,0,.5,0,.6,.04,.45);   // an old sack and some straw: where the dog sleeps out

  // ---- the forest: close dark trunks right round the clearing, pines and old broadleaf, gone to silhouettes in the fog ----
  let nt=0; for(let i=0;i<2600&&nt<760;i++){ const a=rnd()*6.283, d=TREELINE-1.2+Math.pow(rnd(),1.6)*62, x=Math.cos(a)*d, z=Math.sin(a)*d;
    if(pathDist(x,z)<2.3||Math.hypot(x-RIFTP.x,z-RIFTP.z)<2.2) continue; if(GAPS.some(g=>Math.hypot(x-g.x,z-g.z)<2.1)||inLane(x,z)) continue;
    const y=ghM(x,z), far=d>30, s=rr(.8,1.25); nt++;
    if(rnd()<.6){ const Hh=rr(8,14)*s; put(cyl,far?M.dark:M.wood,x,y+Hh*.25,z,0,0,0,.2*s,Hh*.5,.2*s);
      for(let k=0;k<3;k++){ const r=lerp(2.1,.9,k/2)*s, h=Hh*.36; put(cone,far?M.dark:M.pine,x,y+Hh*(.3+k*.2)+h/2,z,0,rnd()*3,0,r,h,r); } }
    else { const Hh=rr(6,10)*s; put(cyl,far?M.dark:M.wood,x,y+Hh*.3,z,rr(-.05,.05),0,rr(-.05,.05),.3*s,Hh*.6,.3*s);
      for(let k=0;k<5;k++) put(ico,far?M.dark:M.leaf,x+rr(-2,2)*s,y+Hh*rr(.65,1),z+rr(-2,2)*s,rnd()*3,rnd()*3,0,rr(1.3,2.2)*s); }
    if(d<20) CIRCS.push({x,z,r:.35*s}); if(d<40) TREES.push({x,z,r:1.1*s}); }
  for(let i=0;i<110;i++){ const a=rnd()*6.283, d=rr(12.8,17), x=Math.cos(a)*d, z=Math.sin(a)*d;   // undergrowth along the edge
    if(pathDist(x,z)<1.6||GAPS.some(g=>Math.hypot(x-g.x,z-g.z)<1.4)||inLane(x,z)) continue; const r=rr(.4,.9); put(ico,M.leaf,x,ghM(x,z)+r*.5,z,rnd()*3,rnd()*3,0,r,r*rr(.6,1),r); }
  flush(sc);
  // long grass (instanced) about the clearing, worn away on the track, by the door, and under roofs
  const fg=new THREE.BufferGeometry(); { const parts=[0,1,2].map(k=>{ const p=new THREE.PlaneGeometry(1.2,.9,1,1); p.translate(0,.45,0); p.rotateY(k*Math.PI/3); return p.toNonIndexed(); });
    const n=parts.reduce((s,p)=>s+p.attributes.position.count,0), pos=new Float32Array(n*3), nor=new Float32Array(n*3), uv=new Float32Array(n*2); let o=0;
    for(const p of parts){ pos.set(p.attributes.position.array,o*3); nor.set(p.attributes.normal.array,o*3); uv.set(p.attributes.uv.array,o*2); o+=p.attributes.position.count; }
    fg.setAttribute('position',new THREE.BufferAttribute(pos,3)); fg.setAttribute('normal',new THREE.BufferAttribute(nor,3)); fg.setAttribute('uv',new THREE.BufferAttribute(uv,2)); }
  const GN=1100, grass=new THREE.InstancedMesh(fg,M.tuft,GN); let gi=0; const m4=new THREE.Matrix4(), q=new THREE.Quaternion(), e=new THREE.Euler(), p3=V(0,0,0), s3=V(1,1,1);
  for(let i=0;i<GN*4&&gi<GN;i++){ const a=rnd()*6.283, d=Math.sqrt(rnd())*24, x=Math.cos(a)*d, z=Math.sin(a)*d;
    if(sheltered(x,z)||pathDist(x,z)<.8||Math.hypot(x-CX0+1,z-DOOR.z)<1.8) continue; if(d<BOUND&&blockedM(x,z,.2)) continue;
    const s=rr(.6,1.4)*(d>12?1.25:1); e.set(0,rnd()*6.283,0); q.setFromEuler(e); m4.compose(p3.set(x,ghM(x,z)-.05,z),q,s3.set(s,s*rr(.8,1.3),s)); grass.setMatrixAt(gi++,m4); }
  grass.count=gi; grass.instanceMatrix.needsUpdate=true; sc.add(grass);
  // the door: oak boards on battens, iron straps; it opens outward, hinged on its south side
  const doorPivot=new THREE.Group(); doorPivot.position.set(CX0,.08,DOOR.z1); sc.add(doorPivot);
  { const dw=DOOR.z1-DOOR.z0-.04, dh=DOOR.h-.12, dm=new THREE.Mesh(new THREE.BoxGeometry(.07,dh,dw),new THREE.MeshPhongMaterial({map:T.plank,color:0xb0a090,flatShading:true,shininess:2}));
    dm.position.set(0,dh/2,-dw/2-.02); doorPivot.add(dm);
    for(const y of [.25,dh/2,dh-.25]){ const b=new THREE.Mesh(new THREE.BoxGeometry(.05,.12,dw*.92),M.oak); b.position.set(.06,y,-dw/2-.02); doorPivot.add(b); }
    for(const y of [.35,dh-.35]){ const s=new THREE.Mesh(new THREE.BoxGeometry(.02,.06,dw*.75),M.iron); s.position.set(-.045,y,-dw*.375); doorPivot.add(s); }
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.06,.012,4,8),M.iron); ring.position.set(-.06,1.0,-dw+.12); ring.rotation.y=Math.PI/2; doorPivot.add(ring); }
  // the fire: flames that are only ever a flicker of three crossed cards, sparks going up the flue, one warm light
  const fireG=new THREE.Group(); fireG.position.set(HEARTH.x,.14,HEARTH.z); sc.add(fireG);
  const flM=new THREE.MeshBasicMaterial({map:T.flame,transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,fog:false});
  const flames=[0,1,2].map(k=>{ const g=new THREE.PlaneGeometry(.5,.75); g.translate(0,.36,0); const m=new THREE.Mesh(g,flM); m.rotation.y=k*Math.PI/3; fireG.add(m); return m; });
  const coal=new THREE.Mesh(new THREE.IcosahedronGeometry(.2,0),new THREE.MeshBasicMaterial({color:0xc4221a})); coal.scale.set(1.3,.3,.9); fireG.add(coal);
  const EMB=16, ep=new Float32Array(EMB*3), ev=[]; for(let i=0;i<EMB;i++){ ep[i*3+1]=rr(0,1.1); ev.push(rr(.5,1.1)); }
  const eg=new THREE.BufferGeometry(); eg.setAttribute('position',new THREE.BufferAttribute(ep,3));
  const embers=new THREE.Points(eg,new THREE.PointsMaterial({color:0xf0a43c,size:2,sizeAttenuation:false,transparent:true,depthWrite:false,fog:false})); fireG.add(embers);
  const fireL=new THREE.PointLight(0xffa040,2.2,10,2); fireL.position.set(HEARTH.x,.8,HEARTH.z+.6); sc.add(fireL);
  // the rope from the tie-post, shown when the dog is tied for the night
  const rope=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,1,4),new THREE.MeshPhongMaterial({color:0x4a3c2c,flatShading:true})); rope.visible=false; sc.add(rope);
  // sky: low overcast, a slow drifting cloud deck
  const skyM=new THREE.Mesh(new THREE.SphereGeometry(240,24,12),new THREE.MeshBasicMaterial({map:T.sky,side:THREE.BackSide,fog:false})); sc.add(skyM);
  const clouds=new THREE.Mesh(new THREE.CylinderGeometry(200,200,70,24,1,true),new THREE.MeshBasicMaterial({map:T.cloud,transparent:true,side:THREE.BackSide,depthWrite:false,fog:false})); clouds.position.y=30; sc.add(clouds);
  // light: overcast night. A dim sky fill, a faint cold key from the cloud glow, the fire.
  const hemi=new THREE.HemisphereLight(0x4f6577,0x0b1016,.55); sc.add(hemi);
  const key=new THREE.DirectionalLight(0x7f98ad,.35); key.position.set(-30,50,20); sc.add(key);
  // the rift you came through, at the end of the track, in among the trees; you can just see it from the window
  const rift=K.crack({h:2.6,w:.9,seed:11,edge:0x7da597}); rift.g.position.set(RIFTP.x,ghM(RIFTP.x,RIFTP.z)+1.4,RIFTP.z); rift.g.rotation.y=Math.PI/2+.25; sc.add(rift.g);
  const riftL=new THREE.PointLight(0x7da597,.5,8,2); riftL.position.set(RIFTP.x+.6,ghM(RIFTP.x,RIFTP.z)+1.6,RIFTP.z+.15); sc.add(riftL);
  // the lightning's own light, moved to wherever each strike is
  const boltL=new THREE.DirectionalLight(0xd8e4f0,0); sc.add(boltL);
  W={sc,hemi,key,bolt:boltL,fire:{g:fireG,flames,embers,ev,light:fireL,crackle:0},rope,rift,riftL,doorPivot,clouds,skyM,fogC:new THREE.Color(0x1b2630),fogF:new THREE.Color(0x7f98ad)};
  buildRain(sc);
}

/* ================= THE WEATHER =================
   Rain is not constant: it comes over in showers and goes again. By day there is thick fog and now and then a drizzle;
   by night the showers come oftener (much oftener on a heavy night), and lightning with them. On a dry night the
   lightning is far off, a flicker over the trees now and then. A strike is a double (or triple) pulse with an
   afterglow; with reduced motion it is one soft, dimmer swell and the tells it reveals are held longer (see HOLD).
   Anything that should only be seen by lightning subscribes with onFlash(fn). */
const ST={mode:'day',heavy:false,wet:0,wetTo:0,wx:20,hemi:1,flash:0,since:99,pulses:[],next:5,az:0,big:false,hooks:[],fogD:.085,fogTo:.085};
const RAIN_N=1800, RAIN_R=15, RAIN_H=13, HOLD=reduce?.45:0;
const onFlash=fn=>ST.hooks.push(fn);
// mode: 'day' (fog, the odd drizzle) or 'night' (showers and lightning); heavy = tonight is a heavy one
function setWeather(mode,heavy){ ST.mode=mode; ST.heavy=!!heavy; ST.wetTo=0; ST.wx=mode==='day'?rr(25,60):rr(4,14); ST.next=mode==='day'?999:rr(5,12); }
function weatherFrame(dt){ ST.wx-=dt;
  if(ST.wx<=0){ const on=ST.wetTo>0;
    if(ST.mode==='day'){ ST.wetTo=on?0:.3; ST.wx=on?rr(60,130):rr(15,35); }
    else if(ST.heavy){ ST.wetTo=on?0:rr(.8,1); ST.wx=on?rr(15,35):rr(40,80); }
    else { ST.wetTo=on?0:rr(.4,.6); ST.wx=on?rr(30,60):rr(15,35); } }
  ST.wet=lerp(ST.wet,ST.wetTo,1-Math.exp(-dt*.25)); ST.fogD=lerp(ST.fogD,ST.fogTo,1-Math.exp(-dt*.5)); }
function applyRain(){ rainAudio((.06+ST.wet*.7)*(ST.indoors?.45:1)); }   // the wind is always there; under the thatch the rain is a muffled drumming
let rain=null;
function buildRain(sc){ const pos=new Float32Array(RAIN_N*6), drops=[];
  for(let i=0;i<RAIN_N;i++) drops.push({x:rr(-RAIN_R,RAIN_R),y:rr(0,RAIN_H),z:rr(-RAIN_R,RAIN_R),v:rr(13,18)});
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(pos,3));
  const m=new THREE.LineBasicMaterial({color:0x7f98ad,transparent:true,opacity:.34,depthWrite:false});
  const l=new THREE.LineSegments(g,m); l.frustumCulled=false; sc.add(l); rain={l,g,m,pos,drops}; }
function rainFrame(dt){ const n=Math.round(RAIN_N*ST.wet), wx=-.22-.25*ST.wet, wz=.08, len=.45+.35*ST.wet, p=rain.pos;
  rain.l.visible=n>0; if(!n) return;
  rain.l.position.set(cam.position.x,cam.position.y-RAIN_H*.55,cam.position.z); rain.g.setDrawRange(0,n*2);
  for(let i=0;i<n;i++){ const d=rain.drops[i]; d.y-=d.v*dt; d.x+=wx*d.v*dt*.25; d.z+=wz*d.v*dt*.25;
    if(d.y<0){ d.y+=RAIN_H; d.x=rr(-RAIN_R,RAIN_R); d.z=rr(-RAIN_R,RAIN_R); }
    if(d.x<-RAIN_R) d.x+=RAIN_R*2; if(d.z>RAIN_R) d.z-=RAIN_R*2;
    const o=i*6, hide=sheltered(rain.l.position.x+d.x,rain.l.position.z+d.z)?-99:0;   // none falls under a roof
    p[o]=d.x; p[o+1]=d.y+hide; p[o+2]=d.z; p[o+3]=d.x-wx*len; p[o+4]=d.y+len+hide; p[o+5]=d.z-wz*len; }
  rain.g.attributes.position.needsUpdate=true; rain.m.opacity=.3+ST.flash*.5; }

let bolt=null;
function boltGeo(){ const pts=[]; let x=0,y=70,z=0; while(y>0){ const nx=x+rr(-4,4), ny=y-rr(4,9), nz=z+rr(-2,2); pts.push(x,y,z,nx,Math.max(0,ny),nz);
    if(rnd()<.25){ const bx=nx+rr(-8,8), by=ny-rr(5,12); pts.push(nx,ny,nz,bx,Math.max(0,by),nz+rr(-3,3)); } x=nx; y=ny; z=nz; }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pts,3)); return g; }
function strike(force){ const storm=ST.wet>.25, big=force||(storm&&rnd()<(.35+.3*ST.wet)); ST.big=big; ST.since=0; ST.az=rnd()*6.283;
  const pk=(big?1:storm?.6:.35)*(reduce?.4:1);   // a dry night's lightning is far off and faint
  ST.pulses=reduce?[{at:0,peak:pk,dur:.9,soft:true}]:
    [{at:0,peak:pk,dur:.09},{at:rr(.11,.18),peak:pk*rr(.6,.9),dur:.08}].concat(big&&rnd()<.6?[{at:rr(.3,.45),peak:pk*rr(.4,.7),dur:.12}]:[]);
  const dist=big?rr(.2,1.2):storm?rr(1.2,3):rr(3,6);   // km, roughly: close strikes are the big ones
  if(big){ if(bolt){ W.sc.remove(bolt); bolt.geometry.dispose(); }
    bolt=new THREE.LineSegments(boltGeo(),new THREE.LineBasicMaterial({color:0xe3ecf1,fog:false,transparent:true}));
    const r=rr(90,130); bolt.position.set(Math.cos(ST.az)*r,ghM(Math.cos(ST.az)*r,Math.sin(ST.az)*r),Math.sin(ST.az)*r); W.sc.add(bolt); }
  W.bolt.position.set(Math.cos(ST.az)*60,80,Math.sin(ST.az)*60);
  const pan=K.panOf(Math.cos(ST.az)*100,Math.sin(ST.az)*100);
  after(dist*.9+rr(.1,.4),()=>thunder(dist,pan));
  for(const fn of ST.hooks) fn(big); }
function flashAt(t){ let f=0; for(const p of ST.pulses){ const u=(t-p.at)/p.dur; if(u<0) continue;
    const v=p.soft?(u<.3?u/.3:Math.max(0,1-(u-.3)/.7)):(u<1?1-u*.35:Math.max(0,.65-(u-1)*1.6)); if(v*p.peak>f) f=v*p.peak; }
  return f; }
function stormFrame(dt){ ST.since+=dt; ST.next-=dt; weatherFrame(dt);
  if(ST.next<=0){ if(ST.mode==='night'){ strike(); ST.next=ST.wet>.25?lerp(17,6,ST.wet)*rr(.6,1.4):rr(22,45); } else ST.next=999; }   // no lightning in the day's fog
  const f=flashAt(ST.since); ST.flash=f;
  W.hemi.intensity=ST.hemi+f*2.6; W.bolt.intensity=f*2.2; W.key.intensity=(ST.mode==='day'?.55:.35)*(1-f*.5);
  W.skyM.material.color.setScalar(1+f*3); W.clouds.material.opacity=1-f*.4; W.sc.fog.density=ST.fogD;
  W.sc.fog.color.copy(W.fogC).lerp(W.fogF,clamp(f,0,1)); W.sc.background.copy(W.sc.fog.color);
  if(bolt) bolt.visible=ST.big&&f>.25;
  if(S.frame%15===0) applyRain();
  rainFrame(dt); }

// audio: steady rain (hiss and a lower patter), gusting wind, thunder placed where the strike was
let rainA=null;
function rainAudio(level){ const a=K.A(); if(!a) return; const {ac,master,nb}=a;
  if(!rainA){ const out=ac.createGain(); out.gain.value=0; out.connect(master); const src=[];
    const loop=(type,f,q,lv,rate)=>{ const s=ac.createBufferSource(); s.buffer=nb; s.loop=true; s.playbackRate.value=rate||1; const bf=ac.createBiquadFilter(); bf.type=type; bf.frequency.value=f; bf.Q.value=q;
      const g=ac.createGain(); g.gain.value=lv; s.connect(bf).connect(g).connect(out); s.start(); src.push(s); return g; };
    loop('highpass',2400,.5,.22); loop('bandpass',900,.6,.2,.8); loop('lowpass',300,.7,.18,.6);
    const wind=loop('bandpass',420,1.4,.05,.5), wl=ac.createOscillator(), wlg=ac.createGain(); wl.frequency.value=.07; wlg.gain.value=.05; wl.connect(wlg).connect(wind.gain); wl.start(); src.push(wl);
    rainA={out,src}; }
  rainA.out.gain.setTargetAtTime(level,ac.currentTime,level?1.4:.3); }
function rainAudioStop(){ if(!rainA) return; const r=rainA; rainA=null; const a=K.A(); r.out.gain.setTargetAtTime(0,a.ac.currentTime,.4);
  setTimeout(()=>{ try{ r.src.forEach(s=>s.stop()); r.out.disconnect(); }catch(e){} },2500); }
function thunder(dist,pan){ const a=K.A(); if(!a||!S.active||S.era!=='med') return; const t=a.ac.currentTime, near=clamp(1-dist/3,0,1), d=K.pout(pan*.7,.55+near*.5);
  if(near>.55) a.noise(t,.3,'highpass',1500,.7,.55*near,.25,d);                     // the crack of a close one
  a.noise(t,4+dist,'lowpass',140+near*120,.8,.85,3.5+dist,d); a.noise(t+.25,3,'lowpass',80,.7,.6,3+dist*.5,d);
  a.tone(t,'sine',46,28,.3+near*.25,.08,3,d); }

/* ================= THE PLAYER ================= */
const TP={x:0,z:0,bob:0,acc:0};
function walk(dt,inp){ const m=inp.m; if(m<=.05) return; const sp=(inp.run?3.4:1.9)*Math.min(1,m)/Math.max(1,m), yaw=P.yaw;
  const vx=(-Math.sin(yaw)*inp.f+Math.cos(yaw)*inp.s)*sp*dt, vz=(-Math.cos(yaw)*inp.f-Math.sin(yaw)*inp.s)*sp*dt;
  const free=blockedM(TP.x,TP.z);   // caught inside something (a door swung shut on you): walk out of it
  if(free||!blockedM(TP.x+vx,TP.z)) TP.x+=vx; if(free||!blockedM(TP.x,TP.z+vz)) TP.z+=vz;
  TP.bob+=dt*(inp.run?10:7.5); TP.acc+=Math.hypot(vx,vz); if(TP.acc>(inp.run?1:.8)){ TP.acc=0; snd.step(); } }

/* ================= THE ANIMALS =================
   The dog: an ordinary farm dog, lit like everything else. The sheep: a small flock that keeps to wherever it is put
   and shies from the dog (always; the first tell anyone can see). The thing in the trees: tall, antlered, no surface at all,
   a flat black cut-out with two red eyes, untouched by fog or light. Mostly it watches you; on a hunting night, the dog. */
const {tbox,part,grp,hang}=K;
const SPOTS={   // where each animal goes for the night; `in` = indoors (seen only through the walls' openings), `lie` = it lies down there
  dog:{shed:{x:DOGBED.x,z:DOGBED.z,lie:true},doorstep:{x:CX0-.85,z:DOOR.z-.15,lie:true},hearth:{x:-1.2,z:-1.5,in:true,lie:true},tied:{x:1.0,z:-1.7,in:true,lie:true}},
  flock:{shed:{x:7.2,z:.2,w:3.2,d:4.8},house:{x:3.35,z:.1,w:1.6,d:4.6,in:true}}
};
const sndM={
  bark(pan,v){ const a=K.A(); if(!a) return; const d=K.pout(pan,v), t=a.ac.currentTime; for(const o of [0,.2]){ a.tone(t+o,'sawtooth',560,250,.22,.004,.11,d); a.noise(t+o,.1,'bandpass',950,1.4,.28,.09,d); } },
  growl(pan,v){ const a=K.A(); if(!a) return; const d=K.pout(pan,v), t=a.ac.currentTime; a.tone(t,'sawtooth',118,96,.1,.25,1.1,d); a.tone(t,'square',59,50,.05,.25,1.1,d); a.noise(t,1.3,'lowpass',380,.9,.18,1,d); },
  bleat(pan,v){ const a=K.A(); if(!a) return; const d=K.pout(pan,v), t=a.ac.currentTime, f=rr(300,380);
    for(let i=0;i<7;i++) a.tone(t+i*.055,'sawtooth',f-i*3,f-i*3-6,.05,.008,.07,d); a.noise(t,.4,'bandpass',1300,2,.05,.35,d); },
  whine(pan,v){ const a=K.A(); if(!a) return; const d=K.pout(pan,v), t=a.ac.currentTime; a.tone(t,'triangle',820,1050,.06,.08,.5,d); a.tone(t+.55,'triangle',900,700,.05,.06,.45,d); },
  creak(pan,v){ const a=K.A(); if(!a) return; const d=K.pout(pan,v), t=a.ac.currentTime; a.tone(t,'sawtooth',150,105,.07,.05,.55,d); a.noise(t,.5,'bandpass',600,3,.06,.45,d); a.noise(t+.5,.12,'lowpass',200,.8,.25,.1,d); },
  crackle(pan,v){ const a=K.A(); if(!a) return; const d=K.pout(pan,v), t=a.ac.currentTime; a.noise(t,.03,'highpass',2600+rnd()*2000,.7,.2*rnd()+.05,.02,d); }
};
// the watcher's eyes: two coals, the only colour on it (the dog's, when they show, are the red almonds from the Cretaceous)
const redEye=tex(16,16,(g,w,h)=>{ const gr=g.createRadialGradient(8,8,0,8,8,8); gr.addColorStop(0,'#fff3d0'); gr.addColorStop(.2,'#f0a43c'); gr.addColorStop(.45,'#c4221a'); gr.addColorStop(1,'rgba(196,34,26,0)'); g.fillStyle=gr; g.fillRect(0,0,w,h); });
redEye.minFilter=THREE.LinearFilter;

function makeDog(){ const fur=new THREE.MeshPhongMaterial({color:0x2e251c,flatShading:true,shininess:4}), pale=new THREE.MeshPhongMaterial({color:0x6b4a2a,flatShading:true,shininess:4}),
    nose=new THREE.MeshPhongMaterial({color:0x05070a,flatShading:true});
  const root=new THREE.Group(), body=grp(root,0,.5,0);
  part(tbox(.3,.32,.86,.88,1),fur,body,0,0,0); part(tbox(.24,.24,.3,1,.9),pale,body,0,-.07,.3);
  const neck=grp(body,0,.1,.38,-.65); part(tbox(.18,.2,.32,1,.85,.15),fur,neck,0,0,0);
  const head=grp(neck,0,0,.3,.65); part(new THREE.BoxGeometry(.22,.2,.24),fur,head,0,0,0); part(tbox(.13,.11,.24,1,.7,.12),pale,head,0,-.04,.12);
  part(new THREE.BoxGeometry(.05,.04,.04),nose,head,0,-.01,.25);
  const jaw=grp(head,0,-.08,.05); part(tbox(.1,.04,.2,1,.7,.1),pale,jaw,0,-.01,0);
  const ears=[-1,1].map(s=>part(new THREE.ConeGeometry(.05,.13,4),fur,head,s*.075,.15,-.04,-.2,0,s*.25));
  const eyes=grp(head,0,.04,.12), eyeMat=new THREE.SpriteMaterial({map:K.eyeTex,transparent:true,depthWrite:false,fog:false});
  const eyeS=[-1,1].map(s=>{ const e=new THREE.Sprite(eyeMat); e.position.x=s*.07; e.scale.set(.09,.045,1); e.renderOrder=2; e.visible=false; eyes.add(e); return e; });
  const tail=grp(body,0,.08,-.42,2.3); part(hang(.07,.38,.07),fur,tail,0,0,0);
  const legs=[[-1,1],[1,1],[-1,-1],[1,-1]].map(([sx,sz],j)=>{ const g=grp(body,sx*.1,-.08,sz*.32); part(hang(.08,.42,.09),j<2?pale:fur,g,0,0,0); part(new THREE.BoxGeometry(.09,.05,.12),pale,g,0,-.42,.03); return {g,o:(j===0||j===3)?0:Math.PI}; });
  root.traverse(o=>{ if(o.isMesh) o.renderOrder=1; });
  return {fur,pale,root,body,neck,head,jaw,ears,eyes,eyeS,tail,legs,x:0,z:0,h:0,tx:0,tz:0,spd:0,ph:0,sit:0,lieK:0,lie:false,st:'roam',spot:null,route:[],goal:null,wait:0,whine:0,stuck:0,inside:false,lookAt:null,growlT:3,wag:0}; }

// the watcher: a forest thing, tall as a young tree, antlered like a stag, all one black, with eyes like coals.
// No surface at all: a flat black cut-out untouched by fog or light, so even in the day's fog it is a shape between the trunks.
function makeWolf(){ const blk=new THREE.MeshBasicMaterial({color:0x07090b,fog:false,transparent:true});
  const eyeMat=new THREE.SpriteMaterial({map:redEye,transparent:true,depthWrite:false,fog:false,sizeAttenuation:false});
  const root=new THREE.Group(), hips=grp(root,0,1.7,0);
  const legs=[-1,1].map(s=>{ const th=grp(hips,s*.15,0,0,.1,0,s*.04); part(hang(.13,.92,.15),blk,th,0,0,0);   // long legs, the knees bent back
    const sh=grp(th,0,-.9,0,-.25); part(hang(.08,.86,.1),blk,sh,0,0,0); part(new THREE.BoxGeometry(.12,.05,.36),blk,sh,0,-.86,.1); return {th,sh}; });
  const torso=grp(hips,0,0,0,.32);                                                                                // stooped
  part(new THREE.BoxGeometry(.32,1.3,.22).translate(0,.65,0),blk,torso,0,0,0); part(new THREE.BoxGeometry(.56,.5,.3),blk,torso,0,1.08,0);
  for(let k=0;k<9;k++) part(hang(.035,rr(.35,.85),.03),blk,torso,rr(-.27,.27),1.3,rr(-.1,.14));                    // moss hanging off the shoulders
  const neck=grp(torso,0,1.32,.06,-.25); part(new THREE.BoxGeometry(.11,.32,.11).translate(0,.16,0),blk,neck,0,0,0);
  const head=grp(neck,0,.3,0,.2); part(new THREE.BoxGeometry(.24,.24,.26),blk,head,0,.05,0);
  part(new THREE.ConeGeometry(.12,.42,5),blk,head,0,-.24,.06,Math.PI);                                               // a long face, narrowing to a beard of moss
  for(let k=0;k<5;k++) part(hang(.03,rr(.3,.6),.03),blk,head,rr(-.08,.08),-.3,rr(.02,.1));
  const branch=(par,x,y,z,L,rx,rz,d)=>{ const g=grp(par,x,y,z,rx,0,rz); part(new THREE.CylinderGeometry(.01+.008*d,.016+.01*d,L,4).translate(0,L/2,0),blk,g,0,0,0);
    if(d>0) for(let k=0;k<3;k++) branch(g,0,L*(.35+k*.25),0,L*rr(.45,.65),rr(-.5,.5),(k%2?1:-1)*rr(.35,.85),d-1); };
  for(const s of [-1,1]) branch(head,s*.09,.15,-.03,.8,-.2,s*.5,2);                                                   // antlers, branching like a dead tree
  const arms=[-1,1].map(s=>{ const sh=grp(torso,s*.29,1.2,0,-.34,0,s*.07); part(hang(.08,1.0,.09),blk,sh,0,0,0);     // arms that hang past its knees
    const fa=grp(sh,0,-.98,0,.12); part(hang(.06,.95,.07),blk,fa,0,0,0);
    for(let k=0;k<4;k++) part(new THREE.ConeGeometry(.016,.42,3),blk,fa,(k-1.5)*.03,-1.14,0,Math.PI+rr(-.15,.15),0,rr(-.25,.25));
    return sh; });
  const eyes=[-1,1].map(s=>{ const e=new THREE.Sprite(eyeMat); e.position.set(s*.065,.08,.14); e.scale.set(.017,.012,1); e.renderOrder=3; head.add(e); return e; });
  root.visible=false;
  return {root,head,neck,torso,arms,legs,eyes,mat:blk,eyeMat,x:0,z:0,st:'off',back:0}; }

function makeSheep(i){ const wool=new THREE.MeshPhongMaterial({color:0x9aa8b2,flatShading:true,shininess:2}), face=new THREE.MeshPhongMaterial({color:0x0b1016,flatShading:true});
  const root=new THREE.Group(), body=grp(root,0,.55,0);
  part(new THREE.IcosahedronGeometry(1,1),wool,body,0,0,0).scale.set(.38,.34,.52);
  const head=grp(body,0,.08,.5); part(tbox(.16,.18,.26,1,.8,.1),face,head,0,0,0); for(const s of [-1,1]) part(new THREE.BoxGeometry(.12,.04,.05),face,head,s*.11,.05,-.02);
  const legs=[[-1,1],[1,1],[-1,-1],[1,-1]].map(([sx,sz],j)=>{ const g=grp(body,sx*.17,-.2,sz*.28); part(hang(.06,.38,.06),face,g,0,0,0); return {g,o:(j===0||j===3)?0:Math.PI}; });
  return {i,root,body,head,legs,x:0,z:0,h:rnd()*6,tx:0,tz:0,spd:0,ph:rnd()*6,graze:rnd()*4,alive:true,bleatT:rr(4,20)}; }

let dog=null, wolf=null; const FLOCK=[];
const NT={wolf:false,dog:'doorstep',flock:'shed'};   // what tonight looks like (set by the night loop; step 6)
function buildAnimals(){ dog=makeDog(); W.sc.add(dog.root); wolf=makeWolf(); W.sc.add(wolf.root);
  for(let i=0;i<7;i++){ const s=makeSheep(i); W.sc.add(s.root); FLOCK.push(s); } }

// steering: head for (tx,tz), slide along anything solid
function steer(a,dt,spd,r){ const dx=a.tx-a.x, dz=a.tz-a.z, d=Math.hypot(dx,dz); if(d<.15){ a.spd=lerp(a.spd,0,1-Math.exp(-dt*8)); return d; }
  if(blockedM(a.x,a.z,r)){ a.x+=dx/d*Math.min(d,spd*dt); a.z+=dz/d*Math.min(d,spd*dt); return d; }   // caught in something: walk out of it
  a.spd=lerp(a.spd,Math.min(spd,d*1.6),1-Math.exp(-dt*4)); const want=Math.atan2(dx,dz); a.h=K.angLerp(a.h,want,1-Math.exp(-dt*7));
  const vx=Math.sin(a.h)*a.spd*dt, vz=Math.cos(a.h)*a.spd*dt;
  if(!blockedM(a.x+vx,a.z+vz,r)){ a.x+=vx; a.z+=vz; }
  else if(!blockedM(a.x+vx,a.z,r)) a.x+=vx; else if(!blockedM(a.x,a.z+vz,r)) a.z+=vz;
  else { a.h+=1.2; }                                                     // stuck on a corner: turn and try again
  return d; }

function placeFlock(n,where){ const S_=SPOTS.flock[where]; NT.flock=where; let k=0;
  for(const s of FLOCK){ s.alive=k<n; s.root.visible=s.alive; k++; if(!s.alive) continue;
    s.x=S_.x+rr(-S_.w/2,S_.w/2); s.z=S_.z+rr(-S_.d/2,S_.d/2); s.tx=s.x; s.tz=s.z; } }
// for the night: straight to its place, and it stays there
function moveFlock(where){ const S_=SPOTS.flock[where]; NT.flock=where;
  for(const s of FLOCK){ if(!s.alive) continue; s.x=S_.x+rr(-S_.w/2,S_.w/2); s.z=S_.z+rr(-S_.d/2,S_.d/2); s.tx=s.x; s.tz=s.z; s.root.visible=true; } }
function sendDog(where){ const sp=SPOTS.dog[where]; NT.dog=where; dog.spot=sp; dog.st='stay'; dog.route=[]; dog.goal=null; dog.assigned=null; dog.lie=!!sp.lie;
  dog.x=sp.x; dog.z=sp.z; dog.h=where==='tied'||where==='hearth'?rr(-.6,.6):rr(0,6.28); dog.root.visible=true; }

/* by day it goes where it likes: to you, to the rug by the fire, along the shed fence, out about the clearing.
   It can only go in or out while the door stands open; shut out (or in), it sits at the door and whines. */
const DOOR_IN={x:CX0+.75,z:DOOR.z}, DOOR_OUT={x:CX0-.85,z:DOOR.z};
const HULL={x0:CX0-1.45,x1:SHED.x1+.6,z0:CZ0-.75,z1:CZ1+.95};   // the cabin and shed together (and the door swung open), as seen from outside
const CORNERS=[{x:HULL.x0-.4,z:HULL.z0-.4},{x:HULL.x1+.4,z:HULL.z0-.4},{x:HULL.x1+.4,z:HULL.z1+.4},{x:HULL.x0-.4,z:HULL.z1+.4}];
const ROAM=[{w:25,p:'you'},{w:25,p:'rug'},{w:20,p:'fence'},{w:20,p:'clearing'},{w:10,p:'bowl'}];
function roamGoal(){ let r=rnd()*100, g=ROAM[0]; for(const o of ROAM){ r-=o.w; if(r<=0){ g=o; break; } }
  if(g.p==='you'){ const a0=rnd()*6.283; for(let k=0;k<8;k++){ const x=TP.x+Math.cos(a0+k*.8)*1.4, z=TP.z+Math.sin(a0+k*.8)*1.4; if(!blockedM(x,z,.35)) return {x,z,near:true}; } return null; }
  if(g.p==='rug') return {x:-1.2+rr(-.25,.25),z:-1.5+rr(-.15,.15),lie:true};
  if(g.p==='bowl') return {x:BOWL.x+.1,z:BOWL.z+.4};
  if(g.p==='fence'){ const f=[[5.3,4.1],[6.9,4.1],[10.2,-2],[10.2,1.4],[6,-3.95],[8.6,-3.95]][rnd()*6|0]; return {x:f[0],z:f[1]}; }
  for(let k=0;k<12;k++){ const a=rnd()*6.283, d=rr(6,12.2), x=Math.cos(a)*d, z=Math.sin(a)*d; if(!blockedM(x,z,.45)&&!inShed(x,z)) return {x,z,lie:rnd()<.2}; } return null; }
const inHull=(x,z)=>x>HULL.x0&&x<HULL.x1&&z>HULL.z0&&z<HULL.z1&&!(x<CX0-.2&&z>DOOR.z0-.3&&z<DOOR.z1-.3);   // less the step before the door
function segHits(a,b){ for(let i=1;i<12;i++){ const u=i/12; if(inHull(lerp(a.x,b.x,u),lerp(a.z,b.z,u))) return true; } return false; }
function aroundHouse(a,g){   // outdoors, the way round the buildings rather than into their walls
  if(!segHits(a,g)) return [g]; let best=null, bl=1e9;
  for(const c of CORNERS){ if(segHits(a,c)||segHits(c,g)) continue; const l=Math.hypot(c.x-a.x,c.z-a.z)+Math.hypot(g.x-c.x,g.z-c.z); if(l<bl){ bl=l; best=[c,g]; } }
  for(let i=0;i<4&&!best;i++) for(const j of [(i+1)%4,(i+3)%4]){ const c=CORNERS[i], e=CORNERS[j]; if(segHits(a,c)||segHits(e,g)) continue;
    const l=Math.hypot(c.x-a.x,c.z-a.z)+Math.hypot(e.x-c.x,e.z-c.z)+Math.hypot(g.x-e.x,g.z-e.z); if(l<bl){ bl=l; best=[c,e,g]; } }
  return best||[g]; }
function dogRouteTo(g){ const d=dog, a=inCabin(d.x,d.z), b=inCabin(g.x,g.z);
  if(a===b) return a?[{x:g.x,z:g.z}]:aroundHouse(d,{x:g.x,z:g.z});
  if(!DS.passable) return null;
  const s=a?DOOR_IN:DOOR_OUT, e=a?DOOR_OUT:DOOR_IN; return (a?[s]:aroundHouse(d,s)).concat([{x:e.x,z:e.z,door:true}],b?[{x:g.x,z:g.z}]:aroundHouse(e,{x:g.x,z:g.z})); }
function dogRoam(lie){ const d=dog; d.st='roam'; d.assigned=null; d.spot=null; d.route=[]; d.goal=null; d.lie=!!lie; d.wait=lie?rr(6,12):rr(1,3); d.whine=0; d.stuck=0; d.root.visible=true; }
function roamFrame(dt){ const d=dog;
  if(d.route.length){ const w=d.route[0];
    if(w.door&&!DS.passable){ d.route=[]; d.wait=rr(1,2); if(d.assigned){ msg('The door is shut on the dog'); unsetDog(); } return; }   // the door shut in its face
    d.tx=w.x; d.tz=w.z; const far=d.goal&&d.goal.near&&Math.hypot(TP.x-d.x,TP.z-d.z)>6;
    const left=steer(d,dt,far?3.6:1.8,.3);
    if(d.best==null||left<d.best-.25){ d.best=left; d.stuck=0; } else d.stuck+=dt;   // no nearer for a while: give up on it
    if(d.stuck>3){ d.route=[]; d.wait=rr(1,2); d.stuck=0; if(d.assigned){ const sp=SPOTS.dog[d.assigned]; d.x=sp.x; d.z=sp.z; dogArrived(); } return; }
    if(left<.35){ d.route.shift(); d.best=null;
      if(!d.route.length){ if(d.assigned){ dogArrived(); return; } if(d.goal&&d.goal.whine){ d.whine=rr(3,5); d.wait=d.whine; d.h=Math.atan2(DOOR.x-d.x,DOOR.z-d.z); }
        else { d.lie=!!(d.goal&&d.goal.lie); d.wait=d.lie?rr(9,18):rr(3,8); } } }
    return; }
  d.spd=lerp(d.spd,0,1-Math.exp(-dt*6));
  if(d.whine>0){ const w0=d.whine; d.whine-=dt; if(Math.floor(w0/1.6)!==Math.floor(d.whine/1.6)){ const dd=Math.hypot(d.x-TP.x,d.z-TP.z); if(dd<20) sndM.whine(K.panOf(d.x,d.z),K.vol(dd,.6)); } }
  d.wait-=dt; if(d.wait>0||d.assigned) return;   // put somewhere for the night: it stays
  const g=roamGoal(); if(!g){ d.wait=rr(1,3); return; } d.goal=g; d.lie=false; d.best=null; d.stuck=0;
  const a=inCabin(d.x,d.z), b=inCabin(g.x,g.z);
  if(a===b) d.route=a?[g]:aroundHouse(d,g);
  else if(DS.passable){ const s=a?DOOR_IN:DOOR_OUT, e=a?DOOR_OUT:DOOR_IN; d.route=(a?[s]:aroundHouse(d,s)).concat([{x:e.x,z:e.z,door:true}],b?[g]:aroundHouse(e,g)); }
  else { const s=a?DOOR_IN:DOOR_OUT; d.route=a?[s]:aroundHouse(d,s); d.goal={whine:true}; } }

function dogFrame(dt){ const d=dog; d.inside=inCabin(d.x,d.z);
  if(d.st==='roam') roamFrame(dt);
  else if(d.st==='stay'){ d.spd=lerp(d.spd,0,1-Math.exp(-dt*6)); }
  // it reacts to the watcher: turns to it and growls, low, but never goes toward it (indoors it cannot see it)
  d.lookAt=null;
  if(NT.wolf&&wolf.st==='watch'&&wolf.root.visible&&!d.inside){ d.lookAt=wolf; if(d.st==='stay'){ d.h=K.angLerp(d.h,Math.atan2(wolf.x-d.x,wolf.z-d.z),1-Math.exp(-dt*2)); }
    d.growlT-=dt; if(d.growlT<=0){ d.growlT=rr(4,8); const dd=Math.hypot(d.x-TP.x,d.z-TP.z); sndM.growl(K.panOf(d.x,d.z),K.vol(dd,.9)); if(rnd()<.25) setTimeout(()=>sndM.bark(K.panOf(d.x,d.z),K.vol(dd,1)),900); } }
  // pose: trot, sit when settled, lie down where it means to stay a while, tail, head toward what it is looking at
  const settled=(d.st==='stay'||(d.st==='roam'&&!d.route.length))&&d.spd<.2;
  const m=clamp(d.spd/3,0,1); d.ph+=dt*(4+d.spd*3.2); d.sit=lerp(d.sit,settled&&!d.lookAt?1:0,1-Math.exp(-dt*3));
  d.lieK=lerp(d.lieK,d.lie&&settled&&!d.lookAt?1:0,1-Math.exp(-dt*1.5));
  d.root.position.set(d.x,ghM(d.x,d.z)+(d.inside?.03:0),d.z); d.root.rotation.y=d.h;
  for(const L of d.legs) L.g.rotation.x=Math.sin(d.ph+L.o)*.7*m;
  const up=1-d.lieK; d.body.rotation.x=-d.sit*.45*up; d.body.position.y=.5-d.sit*.12*up-d.lieK*.3;
  d.legs[2].g.rotation.x+=d.sit*1.2*up+d.lieK*1.45; d.legs[3].g.rotation.x+=d.sit*1.2*up+d.lieK*1.45; d.legs[0].g.rotation.x-=d.lieK*1.45; d.legs[1].g.rotation.x-=d.lieK*1.45;
  d.neck.rotation.x=-.65+d.lieK*.55;
  d.wag+=dt*(d.lookAt?2:d.lieK>.5?2.5:9); d.tail.rotation.z=Math.sin(d.wag)*(d.lookAt?.08:.4); d.tail.rotation.x=d.lookAt?2.7:2.3;
  let hy=0; if(d.lookAt){ hy=clamp(K.angLerp(0,Math.atan2(d.lookAt.x-d.x,d.lookAt.z-d.z)-d.h,1),-1,1); }
  else if(Math.hypot(TP.x-d.x,TP.z-d.z)<4&&d.inside===inCabin(TP.x,TP.z)){ hy=clamp(K.angLerp(0,Math.atan2(TP.x-d.x,TP.z-d.z)-d.h,1),-1,1)*.6; }   // it keeps half an eye on you
  d.head.rotation.y=lerp(d.head.rotation.y,hy,1-Math.exp(-dt*5)); d.jaw.rotation.x=d.lookAt?.12+Math.sin(S.T*30)*.03:0; }

function flockFrame(dt){ const where=SPOTS.flock[NT.flock];
  for(const s of FLOCK){ if(!s.alive) continue;
    // shy from the dog: any sheep it comes near edges away to the far side of where they are kept
    const dd=dog.root.visible?Math.hypot(dog.x-s.x,dog.z-s.z):99;
    if(dd<3.6){ const ax=(s.x-dog.x)/(dd||1), az=(s.z-dog.z)/(dd||1); s.tx=clamp(s.x+ax*2,where.x-where.w/2,where.x+where.w/2); s.tz=clamp(s.z+az*2,where.z-where.d/2,where.z+where.d/2); }
    else { s.graze-=dt; if(s.graze<=0){ s.graze=rr(3,9); s.tx=where.x+rr(-where.w/2,where.w/2); s.tz=where.z+rr(-where.d/2,where.d/2); } }
    const run=dd<3.6; steer(s,dt,run?1.6:.5,.25);
    s.bleatT-=dt; if(s.bleatT<=0){ s.bleatT=rr(8,25)*(run?.3:1); const d=Math.hypot(s.x-TP.x,s.z-TP.z); if(d<30) sndM.bleat(K.panOf(s.x,s.z),K.vol(d,.7)); }
    s.ph+=dt*(3+s.spd*6); const m=clamp(s.spd/1.2,0,1);
    s.root.position.set(s.x,ghM(s.x,s.z),s.z); s.root.rotation.y=s.h; for(const L of s.legs) L.g.rotation.x=Math.sin(s.ph+L.o)*.5*m;
    s.head.rotation.x=lerp(s.head.rotation.x,m<.1?.7:0,1-Math.exp(-dt*2)); } }

/* the watcher is always out there, day and night, somewhere you cannot walk to: deep among the trees, a lane between
   the trunks just wide enough to see it down. It never comes nearer. Look away and it is somewhere else. Go toward it
   and it is not there; a while later it is back. On a night the dog means to hunt (rule 2) it keeps to the dog's side
   of the forest, and on that night (and the day before it) it watches the dog, not you (rule 3). Otherwise, you. */
const WS={vis:false,check:0,unseen:0,moved:false,stare:0,rolled:false,lastRush:-999,dRef:null};   // dRef: how far it was when you started toward it   // moved: it has gone somewhere else since you last saw it; stare: how long you have been looking
/* it is never quite still. It breathes (slowly, too slowly), and every few seconds something moves wrong: the head
   snaps to one side and holds there, or tilts over slowly like a listening owl, an arm jerks, the fingers work, a
   shudder runs through it, the eyes go out for a moment. The longer you look at it, the oftener. */
const WI={next:3,k:null,t:0,dur:0,s:1,fast:0};
const WI_DUR={snap:[.4,1.2],tilt:[2.5,4],arm:[.5,1.2],blink:[.12,.16],shudder:[.3,.6],fingers:[.8,1.5],drop:[1.5,2.5]};
function wolfIdle(dt){ const w=wolf, T=S.T;
  WI.next-=dt*(WS.stare>5?2.2:1);
  if(!WI.k&&WI.next<=0){ const r=rnd();
    WI.k=r<.24?'snap':r<.42?'tilt':r<.56?'arm':r<.7?'blink':r<.8?'shudder':r<.92?'fingers':'drop';
    WI.t=0; WI.s=rnd()<.5?-1:1; WI.dur=rr(...WI_DUR[WI.k]); if(WI.k==='snap'||WI.k==='arm') WI.fast=.3;
    const d=Math.hypot(TP.x-w.x,TP.z-w.z);   // near enough, you hear it: wood giving under weight
    if((WI.k==='snap'||WI.k==='arm')&&d<32) sndM.creak(K.panOf(w.x,w.z),K.vol(d,.5)); }
  let hz=0,hx=0,tx=0,jit=0; const ax=[0,0];
  if(WI.k){ WI.t+=dt; const u=clamp(WI.t/WI.dur,0,1);
    if(WI.k==='snap'){ hz=WI.s*.5; hx=-.18; }                                      // hard over, and held
    else if(WI.k==='tilt') hz=WI.s*.75*Math.sin(Math.PI*u);                         // slowly over, slowly back
    else if(WI.k==='arm') ax[WI.s>0?1:0]=-.4;
    else if(WI.k==='fingers') ax[WI.s>0?1:0]=Math.sin(WI.t*26)>.3?-.1:0;
    else if(WI.k==='shudder') jit=reduce?.01:.05;
    else if(WI.k==='drop'){ hx=.35*Math.sin(Math.PI*u); tx=.12*Math.sin(Math.PI*u); }   // the head hangs, then comes back up to look
    const lit=WI.k!=='blink'; for(const e of w.eyes) e.visible=lit;
    if(WI.t>=WI.dur){ if(WI.k==='snap'||WI.k==='arm') WI.fast=.25; WI.k=null; WI.next=rr(2,7); for(const e of w.eyes) e.visible=true; } }
  WI.fast-=dt; const k=1-Math.exp(-dt*(WI.fast>0?20:3));
  w.head.rotation.z=lerp(w.head.rotation.z,hz,k); w.head.rotation.x=lerp(w.head.rotation.x,.2+hx,k);
  for(let i=0;i<2;i++) w.arms[i].rotation.x=lerp(w.arms[i].rotation.x,-.34+ax[i],k);
  w.torso.rotation.x=.32+tx+Math.sin(T*.55)*.03+(jit?rr(-jit,jit):0);              // one breath every eleven seconds or so
  w.torso.rotation.z=jit?rr(-jit,jit):Math.sin(T*.31)*.015; }
function wolfStill(){ WI.k=null; WI.next=rr(2,5); WS.stare=0; wolf.head.rotation.set(.2,0,0); wolf.torso.rotation.set(.32,0,0); wolf.arms.forEach(a=>a.rotation.x=-.34); wolf.eyes.forEach(e=>e.visible=true);
  wolf.legs.forEach(l=>{ l.th.rotation.x=.1; l.sh.rotation.x=-.25; }); }
const angD=(a,b)=>Math.abs(K.angLerp(0,b-a,1));
const huntMode=()=>NT.wolf&&L.phase==='night';
function seesIt(p){ return canSee(p.x,ghM(p.x,p.z)+3.1,p.z,.97)&&!treesBetween(TP.x,TP.z,p.x,p.z); }
function wolfPlace(){ let cand;
  if(huntMode()){ const a=inCabin(dog.x,dog.z)?Math.atan2(-1.3,-1):Math.atan2(dog.z,dog.x);   // the dog's side of the forest (the window's, if it is indoors)
    cand=DEEP.slice().sort((p,q)=>angD(Math.atan2(p.z,p.x),a)-angD(Math.atan2(q.z,q.x),a)).slice(0,4); }
  else cand=DEEP.slice();   // never nearer than this: deep in the trees, always out of reach
  const ok=p=>Math.hypot(TP.x-p.x,TP.z-p.z)>8&&Math.hypot(wolf.x-p.x,wolf.z-p.z)>3;
  let pool=cand.filter(p=>ok(p)&&!seesIt(p)); if(!pool.length) pool=cand.filter(ok); if(!pool.length) pool=cand;   // somewhere you are not looking, if it can
  const g=pool[Math.floor(rnd()*pool.length)];
  wolf.x=g.x+rr(-.3,.3); wolf.z=g.z+rr(-.3,.3); wolf.root.position.set(wolf.x,ghM(wolf.x,wolf.z),wolf.z);
  wolf.root.rotation.y=Math.atan2(-wolf.x,-wolf.z); wolf.root.visible=true; wolf.root.scale.setScalar(1); WS.unseen=0; WS.vis=false; WS.check=0; WS.moved=true; WS.rolled=false; WS.dRef=null; }
// its own fog: darker than the trees around it at that distance (so it reads), but never a hole cut in the picture
const WOLF_DARK=new THREE.Color(0x07090b);
function wolfTint(){ const d=Math.hypot(cam.position.x-wolf.x,cam.position.z-wolf.z), fd=W.sc.fog.density*d, f=1-Math.exp(-fd*fd);
  wolf.mat.color.copy(WOLF_DARK).lerp(W.sc.fog.color,clamp(.1+f*.27,0,.37)); }
function wolfOpacity(body,eyes){ wolf.mat.opacity=body; wolf.eyeMat.opacity=eyes; }
// hunt: tonight it comes to the tree line (or goes back deep). It moves where you are not looking.
function wolfShow(hunt){ NT.wolf=hunt; if(wolf.st==='watch'||wolf.st==='off'){ wolf.st='watch'; wolfOpacity(1,1); wolfPlace(); } }
function wolfOff(){ wolf.st='off'; wolf.root.visible=false; }
/* the bluff. Now and then (not often: a roll per approach, and a long while between) when you walk out to look at it,
   it does not melt away. It turns to you, and it comes: straight at you through the trees, running, all legs. And it
   is going as it comes, thinner with every stride, and a few strides from you there is nothing there.
   It never reaches you. It is not the thing that kills. */
const RUSH={chance:.5,gap:150,near:3.5};
function wolfRush(){ const w=wolf; w.st='rush'; w.rt=0; w.ph=0; w.spd=0; w.r0=Math.hypot(w.x,w.z); w.d0=Math.hypot(TP.x-w.x,TP.z-w.z); WS.lastRush=S.T;
  WI.k=null; for(const e of w.eyes) e.visible=true; w.head.rotation.set(.2,0,0);
  sndM.snapBranch(K.panOf(w.x,w.z),K.vol(w.d0,1)); }
function rushFrame(dt){ const w=wolf; w.rt+=dt;
  const face=Math.atan2(TP.x-w.x,TP.z-w.z); w.root.rotation.y=K.angLerp(w.root.rotation.y,face,1-Math.exp(-dt*(w.rt<.5?14:6))); w.neck.rotation.y=lerp(w.neck.rotation.y,0,1-Math.exp(-dt*14));
  if(w.rt<.55){ w.torso.rotation.x=lerp(w.torso.rotation.x,.12,1-Math.exp(-dt*12)); return; }   // it straightens. A beat. Then it comes
  w.spd=Math.min(7.5,w.spd+dt*14); const st=w.spd*dt, d=Math.hypot(TP.x-w.x,TP.z-w.z);
  if(d>.5){ w.x+=(TP.x-w.x)/d*st; w.z+=(TP.z-w.z)/d*st; }
  w.root.position.set(w.x,ghM(w.x,w.z)+Math.abs(Math.sin(w.ph))*.12,w.z);
  const p0=w.ph; w.ph+=dt*w.spd*1.5;
  for(let i=0;i<2;i++){ const sn=Math.sin(w.ph+i*Math.PI); w.legs[i].th.rotation.x=.1-sn*.8; w.legs[i].sh.rotation.x=-.25-Math.max(0,sn)*.9;
    w.arms[i].rotation.x=-.34+sn*.7; }
  w.torso.rotation.x=lerp(w.torso.rotation.x,.6,1-Math.exp(-dt*8)); w.head.rotation.x=-.25+Math.sin(w.ph*2)*.06; w.head.rotation.z=Math.sin(w.ph*.7)*.15;
  if(Math.floor(p0/Math.PI)!==Math.floor(w.ph/Math.PI)) sndM.stride(K.panOf(w.x,w.z),K.vol(d,1.1));
  // thinning as it comes, out of the trees and across the clearing: gone a few strides from you. The eyes last.
  const u=clamp((d-RUSH.near)/Math.max(.1,w.d0-RUSH.near),0,1);
  wolfOpacity(clamp(u*1.6,0,1)**.9,clamp(u*2.5,0,1));
  if(u<=0){ w.st='gone'; w.root.visible=false; w.back=rr(40,70); wolfOpacity(1,1); wolfStill(); } }
function wolfFrame(dt){ const w=wolf; if(w.root.visible) wolfTint(); if(w.st==='off'||w.st==='hearth') return;
  if(w.st==='gone'){ w.back-=dt; if(w.back<=0){ w.st='watch'; wolfOpacity(1,1); wolfPlace(); } return; }
  if(w.st==='rush'){ rushFrame(dt); return; }
  // the head: the dog on a hunting night (and the day before one), otherwise you
  const hunt=!dog.dead&&(NT.wolf||(L.phase==='day'&&L.d&&L.d.wolfNight)), tgt=hunt?dog:TP;
  const hy=Math.atan2(tgt.x-w.x,tgt.z-w.z)-w.root.rotation.y; w.neck.rotation.y=lerp(w.neck.rotation.y,clamp(K.angLerp(0,hy,1),-1.1,1.1),1-Math.exp(-dt*2));
  if((WS.check+=dt)>=.15){ WS.check=0; WS.vis=seesIt(w); }
  WS.stare=WS.vis?WS.stare+dt:0; wolfIdle(dt);
  if(w.st==='watch'){
    if(WS.vis){ WS.unseen=0; WS.moved=false; } else if(!WS.moved&&(WS.unseen+=dt)>1.2) wolfPlace();   // you looked away: it is somewhere else
    const reach=Math.max(0,Math.hypot(w.x,w.z)-BOUND), dp=Math.hypot(TP.x-w.x,TP.z-w.z);   // as near as you could ever get to it
    // you go to look: walking toward it with your eyes on it, from anywhere outside (or already near the trees).
    // Once in a while, it comes to meet you, however far it has to come.
    if(!WS.vis||inCabin(TP.x,TP.z)) WS.dRef=null; else if(WS.dRef==null||dp>WS.dRef) WS.dRef=dp;
    const going=WS.dRef!=null&&(WS.dRef-dp>2.5||dp<reach+5);
    if(going&&!WS.rolled){ WS.rolled=true;
      if(rnd()<RUSH.chance&&S.T-WS.lastRush>RUSH.gap){ wolfRush(); return; } }
    if(dp<reach+4){ w.st='fading'; w.fade=1; } }          // you went to look: it melts back into the trees
  else if(w.st==='fading'){ w.fade-=dt*.7; wolfOpacity(clamp(w.fade*1.6,0,1),clamp(w.fade*2-1,0,1));
    if(w.fade<=0){ w.st='gone'; w.root.visible=false; w.back=rr(25,50); wolfOpacity(1,1); } } }

/* ================= DAY · NIGHT =================
   The loop around the rules. Day: thick fog. What the night left. Feed the dog if you like, and set up for the dark
   with your hands, not a menu: put the dog where it will sleep, bring the sheep in or leave them out, light the lamp,
   lay bait. Sit by the fire and the dark comes. Night: the rules have already decided (RULES.night) and the world
   plays it out: the watcher at the tree line if it is a hunting night, the dog slipping away, a sheep lost in the dark.
   Five nights, never counted aloud. */
const NIGHT_LEN=75;
const L={M:null,phase:null,t:0,d:null,ev:null,ch:{dog:'doorstep',flock:'shed',watch:'none',bait:false},dogSet:false,hunt:null,fed:null,ending:null};
const objEl=()=>$('#tObj');
const DOG_AT={shed:SPOTS.dog.shed,doorstep:SPOTS.dog.doorstep,hearth:SPOTS.dog.hearth,tied:SPOTS.dog.tied};

/* things you can do, each at a place in the world. The one you are nearest and most looking at is offered:
   E on a keyboard, the button on touch. */
const dayOk=()=>L.phase==='day'&&!L.M.over, dogOk=()=>dayOk()&&!dog.dead&&!dog.away;
const oilTxt=()=>` (oil for ${L.M.oil} night${L.M.oil===1?'':'s'})`;
const placeDog=(k,say)=>({at:{x:DOG_AT[k].x,y:.1,z:DOG_AT[k].z},r:1.5,when:dogOk,
  label:()=>L.dogSet&&L.ch.dog===k?'Let the dog sleep where it likes':say, act:()=>{ if(L.dogSet&&L.ch.dog===k) unsetDog(); else setDog(k); }});
const ACTS=[
  {at:{x:BOWL.x,y:.1,z:BOWL.z},r:1.8,when:()=>dayOk()&&!dog.dead&&!L.fed,label:()=>'Feed the dog',act:()=>feed()},
  {at:{x:DOOR.x,y:1.1,z:DOOR.z},r:1.9,any:true,my:.75,when:()=>!HS.on,label:()=>(DS.open?'Close':'Open')+' the door',act:()=>toggleDoor()},
  {at:{x:HEARTH.x,y:.55,z:HEARTH.z},r:2,when:dayOk,label:()=>'Sit by the fire until dark',act:()=>startNight()},
  placeDog('hearth','Settle the dog by the fire for the night'),
  placeDog('doorstep','Leave the dog on the doorstep for the night'),
  placeDog('shed','Bed the dog down by the shed for the night'),
  {at:{x:TIEPOST.x,y:.6,z:TIEPOST.z},r:1.6,when:dogOk,label:()=>L.dogSet&&L.ch.dog==='tied'?'Untie the dog':'Tie the dog to the post for the night',
    act:()=>{ if(L.dogSet&&L.ch.dog==='tied') unsetDog(); else setDog('tied'); }},
  {at:{x:7.2,y:.7,z:SHED.z1+.15},r:1.7,when:()=>dayOk()&&L.ch.flock==='shed'&&L.M.sheep>0,label:()=>'Bring the sheep into the house',act:()=>moveSheep('house')},
  {at:{x:BYRE+.5,y:.6,z:2.4},r:1.7,when:()=>dayOk()&&L.ch.flock==='house',label:()=>'Put the sheep back out in the shed',act:()=>moveSheep('shed')},
  {at:{x:LAMP.x,y:.9,z:LAMP.z},r:1.6,when:dayOk,label:()=>L.ch.watch==='dog'?'Put out the lamp':L.M.oil>0?'Light the lamp: sit up with the dog tonight'+oilTxt():'The lamp is dry',
    act:()=>setWatch('dog')},
  {at:{x:CX0+.2,y:1.4,z:(WINDOW.z0+WINDOW.z1)/2},r:1.6,my:.15,when:dayOk,label:()=>L.ch.watch==='forest'?'Sleep tonight instead':L.M.oil>0?'Sit up at the window tonight, watching the trees'+oilTxt():'No oil to sit up by',
    act:()=>setWatch('forest')},
  {at:{x:BAIT.x,y:.35,z:BAIT.z},r:1.6,when:()=>dayOk()&&L.M.baitOwned,label:()=>L.ch.bait?'Take up the wolfsbane':'Lay wolfsbane bait here',act:()=>toggleBait()},
  {at:{x:BED.x,y:.45,z:BED.z},r:1.8,when:()=>L.phase==='night',label:()=>'Go to bed',act:()=>endNight()},
];
const _pv=V(0,0,0);
function pickAct(){ const inside=inCabin(TP.x,TP.z); let best=null, bs=1e9;
  for(const a of ACTS){ if(!a.when()) continue; const d=Math.hypot(TP.x-a.at.x,TP.z-a.at.z); if(d>a.r) continue;
    if(!a.any&&inCabin(a.at.x,a.at.z)!==inside) continue;
    _pv.set(a.at.x,a.at.y,a.at.z).project(cam); if(_pv.z>1||Math.abs(_pv.x)>.9||Math.abs(_pv.y)>.95) continue;   // only what is in front of you
    const sc=Math.hypot(_pv.x,_pv.y)+d*.25; if(sc<bs){ bs=sc; best=a; } }
  return best; }
const act=K.el('button','mAct','pbtn'); act.type='button'; act.hidden=true;
let curAct=null;
act.addEventListener('click',()=>doAct());
function doAct(){ if(S.mode!=='med') return; if(curAct&&curAct.when()) curAct.act(); else if(L.phase==='night') endNight(); }
function drawAct(){ curAct=S.mode==='med'?pickAct():null; let t='';
  if(curAct) t=curAct.label()+(R.touch()?'':' (E)');
  else if(S.mode==='med'&&L.phase==='night') t='Go to bed'+(R.touch()?'':' (Enter)');
  if(act.textContent!==t) act.textContent=t; act.hidden=!t; }
// the door: it will not shut on you or on the dog
function toggleDoor(){ if(HS.on) return;
  if(DS.open){ const inWay=(x,z)=>x>CX0-1.2&&x<CX0+.45&&z>DOOR.z0-.25&&z<DOOR.z1+.35;
    if(TP.x>CX0-.45&&TP.x<CX0+.45&&TP.z>DOOR.z0-.1&&TP.z<DOOR.z1+.1){ msg('Step out of the doorway'); return; }
    if(!dog.dead&&!dog.away&&dog.root.visible&&inWay(dog.x,dog.z)){ msg('The dog is in the way'); return; } }
  DS.open=!DS.open; sndM.creak(K.panOf(DOOR.x,DOOR.z),K.vol(Math.hypot(TP.x-DOOR.x,TP.z-DOOR.z),.8)); }
function doorFrame(dt){ const want=HS.stage===1||DS.open?1.45:0, rate=HS.stage===1?14:HS.stage===2?1.2:3.5;
  DS.a=lerp(DS.a,want,1-Math.exp(-dt*rate)); W.doorPivot.rotation.y=DS.a;
  DS.rect.off=DS.a>.5; DS.leaf.off=DS.a<1; DS.passable=DS.a>1.2; }

// the dog: you take it to a place and it settles there for the night
function setDog(k){ const sp=DOG_AT[k], r=dogRouteTo(sp); if(!r){ msg('The door is shut'); return; }
  L.ch.dog=k; L.dogSet=true; dog.st='roam'; dog.assigned=k; dog.route=r; dog.goal={lie:true}; dog.lie=false; dog.wait=0; dog.best=null; dog.stuck=0; W.rope.visible=false;
  sndM.whistle(); dayObjective(); }
function unsetDog(){ L.ch.dog='doorstep'; L.dogSet=false; W.rope.visible=false; dog.assigned=null; dogRoam(); R.sfx.ui(); dayObjective(); }
function dogArrived(){ const k=dog.assigned; if(!k) return; const sp=DOG_AT[k]; dog.x=lerp(dog.x,sp.x,.5); dog.z=lerp(dog.z,sp.z,.5); dog.lie=true;
  if(k==='tied'){ W.rope.visible=true; msg('Tied'); } }
// the sheep: driven in through the door to the byre, or back out to the shed
function moveSheep(where){ if(!DS.open&&where==='house'){ msg('Open the door first'); return; }
  veil(()=>{ moveFlock(where); L.ch.flock=where; for(let i=0;i<3;i++) setTimeout(()=>sndM.bleat(K.panOf(DOOR.x,DOOR.z),.7),i*400); dayObjective(); },.3); }
function setWatch(k){ if(L.ch.watch===k){ L.ch.watch='none'; R.sfx.ui(); dayObjective(); return; }
  if(L.M.oil<=0){ msg('No lamp oil left'); return; } L.ch.watch=k; R.sfx.ui(); dayObjective(); }
function toggleBait(){ L.ch.bait=!L.ch.bait&&L.M.baitOwned; baitM.visible=L.ch.bait; R.sfx.ui();
  if(L.ch.bait) msg('Wolfsbane. It will kill any animal that eats it. Keep your dog away.',5); dayObjective(); }

// carcasses: a dead sheep stays where it fell (on its side, a stain under it) until night, in the shed or in the byre
const stainM=new THREE.MeshBasicMaterial({color:0x2a0805,transparent:true,opacity:.85,depthWrite:false});
function killSheep(n){ const alive=FLOCK.filter(s=>s.alive);
  alive.sort((a,b)=>Math.hypot(b.x-TP.x,b.z-TP.z)-Math.hypot(a.x-TP.x,a.z-TP.z));   // the ones furthest from you
  for(const s of alive.slice(0,n)){ s.alive=false; s.carcass=true;
    s.root.visible=true; layCarcass(s);
    const d=Math.hypot(s.x-TP.x,s.z-TP.z); if(d<45){ sndM.bleat(K.panOf(s.x,s.z),K.vol(d,1.1)); setTimeout(()=>sndM.growl(K.panOf(s.x,s.z),K.vol(d,.7)),350); } } }
function layCarcass(s){ s.root.position.set(s.x,ghM(s.x,s.z)+.07,s.z); s.root.rotation.set(0,s.h,Math.PI/2); s.body.position.y=.3;
  if(!s.stain){ s.stain=new THREE.Mesh(new THREE.CircleGeometry(.7,10),stainM); s.stain.rotation.x=-Math.PI/2; W.sc.add(s.stain); }
  s.stain.position.set(s.x,ghM(s.x,s.z)+.045,s.z); s.stain.visible=s.root.visible; }
function clearCarcasses(){ for(const s of FLOCK){ s.carcass=false; s.body.position.y=.55; s.root.rotation.set(0,s.h,0); if(s.stain) s.stain.visible=false; if(!s.alive) s.root.visible=false; } }
function showCarcasses(){ for(const s of FLOCK) if(s.carcass){ s.root.visible=true; layCarcass(s); } }

let bowl=null, bowlFood=null, baitM=null, lantern=null, lampL=null, lampF=null;
function buildProps(){ const wood=new THREE.MeshPhongMaterial({color:0x2e251c,flatShading:true}), food=new THREE.MeshPhongMaterial({color:0x6b4a2a,flatShading:true}), iron=new THREE.MeshPhongMaterial({color:0x0b1016,flatShading:true,shininess:30});
  bowl=new THREE.Mesh(new THREE.CylinderGeometry(.2,.15,.1,8),wood); bowl.position.set(BOWL.x,ghM(BOWL.x,BOWL.z)+.05,BOWL.z); W.sc.add(bowl);
  bowlFood=new THREE.Mesh(new THREE.CylinderGeometry(.16,.16,.04,8),food); bowlFood.position.set(BOWL.x,bowl.position.y+.05,BOWL.z); W.sc.add(bowlFood);
  // the bait: a hazel stake by the shed gate to tie it to, and the meat itself when it is laid
  const stake=new THREE.Mesh(new THREE.CylinderGeometry(.03,.04,.6,5),wood); stake.position.set(BAIT.x+.18,ghM(BAIT.x,BAIT.z)+.3,BAIT.z); W.sc.add(stake);
  baitM=new THREE.Mesh(new THREE.DodecahedronGeometry(.18,0),new THREE.MeshPhongMaterial({color:0x6e1a12,flatShading:true})); baitM.position.set(BAIT.x,ghM(BAIT.x,BAIT.z)+.12,BAIT.z); baitM.scale.set(1.4,.6,1); W.sc.add(baitM);
  // the lamp on the table: horn panes in an iron frame; lit when you mean to sit up tonight
  const lamp=new THREE.Group(); lamp.position.set(LAMP.x,.8,LAMP.z); W.sc.add(lamp);
  const lb=new THREE.Mesh(new THREE.CylinderGeometry(.09,.1,.24,6),new THREE.MeshPhongMaterial({color:0x4a4230,flatShading:true,transparent:true,opacity:.75})); lb.position.y=.12; lamp.add(lb);
  for(const y of [0,.25]){ const r=new THREE.Mesh(new THREE.CylinderGeometry(.11,.11,.03,6),iron); r.position.y=y; lamp.add(r); }
  const hk=new THREE.Mesh(new THREE.TorusGeometry(.05,.01,4,8),iron); hk.position.y=.32; lamp.add(hk);
  lampF=new THREE.Mesh(new THREE.SphereGeometry(.035,6,4),new THREE.MeshBasicMaterial({color:0xf0a43c})); lampF.position.y=.12; lamp.add(lampF);
  lampL=new THREE.PointLight(0xffa040,0,5,2); lampL.position.y=.2; lamp.add(lampL);
  lantern=new THREE.PointLight(0xffa040,0,10,2); lantern.position.set(.25,-.35,-.3); cam.add(lantern);
  // a small amber diamond over each thing you can use, while you can use it. In fog like a shard of the rift; far ones fade.
  const mkM=new THREE.MeshBasicMaterial({color:0xf0a43c}), mkC=new THREE.MeshBasicMaterial({color:0xfff3d0});
  const mkG=new THREE.PointsMaterial({color:0xf0a43c,size:4,sizeAttenuation:false,transparent:true,opacity:.55,depthWrite:false,blending:THREE.AdditiveBlending});
  const og=new THREE.OctahedronGeometry(.075,0), cg=new THREE.OctahedronGeometry(.033,0), pg=new THREE.BufferGeometry(); pg.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0],3));
  for(const a of ACTS){ const g=new THREE.Group(), y=a.at.y+(a.my||.45); g.position.set(a.at.x,y,a.at.z);
    const o=new THREE.Mesh(og,mkM); o.scale.y=2; g.add(o); const c=new THREE.Mesh(cg,mkC); c.scale.y=2; g.add(c); g.add(new THREE.Points(pg,mkG));
    g.visible=false; W.sc.add(g); a.mk={g,o,y}; } }
function markFrame(dt){ for(const a of ACTS){ const m=a.mk; if(!m) continue; const on=S.mode==='med'&&!HS.on&&a.when(); m.g.visible=on; if(!on) continue;
    m.o.rotation.y+=dt*1.5; m.g.position.y=m.y+Math.sin(S.T*2+a.at.x)*.04; const k=a===curAct?1.45:1; m.g.scale.setScalar(lerp(m.g.scale.x,k,1-Math.exp(-dt*10))); } }

// light and weather by phase: the day is fog, thick and pale; the night is dark, with showers and lightning
function phaseLight(ph){ const heavy=L.d&&L.d.rain==='heavy';
  if(ph==='day'){ ST.hemi=1.05; W.fogC.setHex(0x7f98ad); W.fogF.setHex(0xb9c8d3); ST.fogTo=ST.fogD=.085; W.skyM.visible=W.clouds.visible=false; setWeather('day'); }
  else { ST.hemi=.38; W.fogC.setHex(0x121a22); W.fogF.setHex(0x7f98ad); ST.fogTo=ST.fogD=.03; W.skyM.visible=W.clouds.visible=true; setWeather('night',heavy); }
  lantern.intensity=ph==='night'&&L.ch.watch!=='none'?1.2:0; }

function veil(fn,hold){ fadeTo(1,.8,'#000'); after(.85,()=>{ fn(); after(hold||.3,()=>fadeTo(0,reduce?.6:1.4)); }); }

function newRun(){ const q=new URLSearchParams(location.search).get('seed'); L.M=RULES.newRun(q?+q:(Date.now()%1e9)); L.ending=null;
  L.ch={dog:'doorstep',flock:'shed',watch:'none',bait:false}; L.dogSet=false; clearCarcasses(); placeFlock(L.M.sheep,'shed');
  dog.dead=false; dog.away=false; dog.assigned=null; dog.root.rotation.set(0,0,0); dog.body.position.y=.5; dog.legs[0].g.scale.y=dog.legs[1].g.scale.y=1; hearthReset();
  DS.open=false; DS.a=0; dog.x=-1.25; dog.z=-1.55; dog.h=.5; dog.sit=1; dog.lieK=1; dogRoam(true); W.rope.visible=false; baitM.visible=false; NT.wolf=false; wolfOff(); }

// a new day: what the night left, then whatever comes next. The first day has no night behind it.
function startDay(first){ const M=L.M; L.phase='day'; L.t=0; hearthReset(); W.rope.visible=false; NT.wolf=false;
  if(!first){ showCarcasses(); dawnTells(); }
  if(!dog.dead){ dog.away=false; dog.assigned=null; dogRoam(dog.lie); }
  L.ch.dog='doorstep'; L.dogSet=false; L.ch.watch='none';
  if(L.ch.flock!=='shed'){ moveFlock('shed'); L.ch.flock='shed'; }                       // let out in the morning
  if(M.over){ L.ending=RULES.ending(M); riftOpen=true; }
  else { L.d=RULES.dusk(M); L.fed=null; bowlFood.visible=true; L.ch.bait=L.ch.bait&&M.baitOwned; }
  phaseLight('day'); baitM.visible=L.ch.bait; wolfShow(false); dayObjective();
  if(first&&!L.guided){ L.guided=true; after(.6,()=>{ if(S.mode==='med') guide(true); }); } }
function dayObjective(){ const M=L.M; if(L.phase!=='day') return;
  if(M.over){ objective('Morning',`${M.sheep} sheep. The fog is thinning.<br>The rift has opened, at the end of the track through the trees.`); return; }
  const dogT=dog.dead?'':L.dogSet?{shed:'The dog will sleep by the shed.',doorstep:'The dog will sleep on the doorstep.',hearth:'The dog will sleep by the fire.',tied:'The dog is tied to the hearth post.'}[L.ch.dog]:'The dog sleeps on the doorstep, as it always does.';
  const fl=L.ch.flock==='house'?'The sheep are in the house.':'The sheep are in the shed.';
  const w=L.ch.watch==='dog'?' You will sit up with the lamp, by the dog.':L.ch.watch==='forest'?' You will sit up at the window.':'';
  const b=L.ch.bait?' Wolfsbane is laid by the shed.':'';
  objective('Day',`${M.sheep} sheep. Thick fog in the trees.<br>${dogT} ${fl}${w}${b}`); }
function feed(){ if(!dayOk()||dog.dead||L.fed) return;
  L.fed=L.d.refusesFood?'refused':'ate'; R.sfx.ui();
  if(L.fed==='ate'){ msg('It eats'); bowlFood.visible=false; } else msg('It sniffs the bowl and turns away'); }

function startNight(){ if(!dayOk()) return; act.hidden=true; objEl().classList.remove('on'); L.phase='night-in';
  veil(()=>{ const M=L.M; clearCarcasses(); clearTells(); RULES.choose(M,L.ch); L.ev=RULES.night(M); L.phase='night'; L.t=0;
    moveFlock(L.ch.flock); if(!dog.dead){ dog.assigned=null; sendDog(L.ch.dog); W.rope.visible=L.ch.dog==='tied'; }
    baitM.visible=L.ch.bait; phaseLight('night'); wolfShow(false);
    if(M.wolfNight||dog.dead) after(rr(4,12),()=>{ if(L.phase==='night'&&!HS.on) wolfShow(true); });   // after the dog is gone it still comes: it was never the killer
    if(L.ev.hearthScene) hearthArm();
    const ev=L.ev; L.hunt=(ev.kills||ev.dogDied)?{at:rr(22,40),st:'wait',t:0}:null; pickTells(); },.6); }

// the hunt: the dog slips away once you are not looking (or soon after anyway), then the flock pays
function huntFrame(dt){ const h=L.hunt; if(!h) return; h.t+=dt; const ev=L.ev;
  if(h.st==='wait'&&L.t>=h.at){ const seen=dog.root.visible&&Math.hypot(dog.x-TP.x,dog.z-TP.z)<25&&canSee(dog.x,ghM(dog.x,dog.z)+.5,dog.z,.9);
    if(!seen||L.t>h.at+12){ h.st='away'; h.t=0; dog.root.visible=false; dog.away=true; } }
  else if(h.st==='away'&&h.t>3){ h.st='done'; h.t=0;
    if(ev.dogDied) dogDies(); else { killSheep(ev.kills); if(ev.playerDead) after(3.5,death); } }
  else if(h.st==='done'&&!ev.dogDied&&!ev.playerDead&&h.t>9&&dog.away){ dog.away=false; dog.root.visible=true; } }
function dogDies(){ baitM.visible=false; dog.legs[0].g.scale.y=dog.legs[1].g.scale.y=1.5;   // forelegs too long, if you look
  dog.dead=true; dog.away=false; dog.st='dead'; dog.x=BAIT.x+.6; dog.z=BAIT.z; dog.inside=false; W.rope.visible=false;
  dog.root.position.set(dog.x,ghM(dog.x,dog.z)+.12,dog.z); dog.root.rotation.set(0,dog.h,Math.PI/2); dog.body.rotation.x=0; dog.body.position.y=.3; dog.root.visible=true; }
function resolveNow(){ const h=L.hunt; if(!h||h.st==='done') return; const ev=L.ev;   // you went to bed: it happens in the dark
  h.st='done'; h.t=99; dog.away=false;
  if(ev.dogDied) dogDies(); else killSheep(ev.kills); }

function endNight(){ if(L.phase!=='night') return; L.phase='night-out';
  if(L.ev.playerDead){ resolveNow(); death(); return; }
  veil(()=>{ resolveNow(); startDay(false); },1.2); }

let riftOpen=false;
function death(){ if(S.mode!=='med') return; S.mode='medDead'; L.phase='dead'; L.ending='death'; act.hidden=true; guideEl.hidden=true; guideBtn.hidden=true; objEl().classList.remove('on');
  S.fade=1; fadeTo(1,0,'#000'); rainAudio(.15);
  const pan=dog.dead?0:K.panOf(dog.x,dog.z);
  after(.8,()=>sndM.growl(pan,1)); after(2.4,()=>sndM.growl(pan*.6,1)); after(3.6,()=>sndM.howl(K.panOf(wolf.x||30,wolf.z||-30),.4));
  after(7,()=>K.leave()); }
sndM.howl=(pan,v)=>{ const a=K.A(); if(!a) return; const d=K.pout(pan,v), t=a.ac.currentTime; const lp=a.ac.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=1400; lp.connect(d);
  const o=a.ac.createOscillator(), g=a.ac.createGain(); o.type='triangle'; o.frequency.setValueAtTime(330,t); o.frequency.linearRampToValueAtTime(520,t+.8); o.frequency.linearRampToValueAtTime(500,t+2.2); o.frequency.linearRampToValueAtTime(380,t+3.2);
  g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(.18,t+.5); g.gain.setValueAtTime(.18,t+2.4); g.gain.linearRampToValueAtTime(0,t+3.3); o.connect(g).connect(lp); o.start(t); o.stop(t+3.4); };
sndM.snapBranch=(pan,v)=>{ const a=K.A(); if(!a) return; const d=K.pout(pan,v), t=a.ac.currentTime;
  a.noise(t,.18,'highpass',1800,.8,.6,.12,d); a.noise(t+.05,.5,'lowpass',420,.9,.4,.4,d); a.tone(t,'square',90,60,.08,.005,.2,d); };
sndM.stride=(pan,v)=>{ const a=K.A(); if(!a) return; const d=K.pout(pan,v), t=a.ac.currentTime;
  a.noise(t,.14,'lowpass',160,.9,.7,.12,d); a.noise(t,.22,'bandpass',1100+rnd()*900,1.2,.22,.18,d); };
sndM.whistle=()=>{ const a=K.A(); if(!a) return; const d=K.pout(0,.5), t=a.ac.currentTime; a.tone(t,'sine',1500,2100,.06,.02,.18,d); a.tone(t+.22,'sine',2100,1600,.06,.02,.25,d); };

/* the guide: shown on the first morning, and again with H (or the Guide button). The goal and the ways to play, nothing
   about what is happening out there: that is for the player to work out. While it is open the night does not run on. */
const guideEl=K.el('div','mGuide'); guideEl.hidden=true;
const guideBtn=K.el('button','mGuideBtn','pbtn'); guideBtn.type='button'; guideBtn.hidden=true;
guideBtn.addEventListener('click',()=>guide(true));
function guideHTML(){ const t=R.touch();
  return `<h3>The cabin</h3>
<p><b>Goal</b>Keep your flock alive until the rift opens. One morning it will open at the end of the track west through the trees. Walk into it to leave.</p>
<p>Something takes sheep in the night. Nobody will tell you what. Watch, and work it out.</p>
<p><b>By day</b>${t?'Walk with the stick, drag to look.':'Walk with WASD, look with the mouse (click to capture it).'} The <span class="amb">amber diamonds</span> show what you can use: stand by one, look at it and press ${t?'the button':'E'}.</p>
<p>Before dark, set up for the night:</p>
<ul><li><b class="i">The dog</b>where it sleeps: the rug by the fire, the doorstep, the sack by the shed, or tied to the post. Feed it if you like.</li>
<li><b class="i">The sheep</b>left in the shed, or brought into the house (open the door first).</li>
<li><b class="i">The lamp</b>sit up with the dog, or at the window. There is not much oil.</li>
<li><b class="i">Wolfsbane</b>bait by the shed. It kills any animal that eats it.</li></ul>
<p>Then sit by the fire, and night falls.</p>
<p><b>By night</b>What you set up plays out. Look around, if you like. Lightning shows things. Go to bed to sleep through the rest${t?'':' (or press Enter)'}. The morning shows what the night left.</p>
<p><b>How it ends</b>The choices you make decide it. There is more than one ending.</p>
<button type="button" class="pbtn" id="mGuideOk">Begin${t?'':' (E)'}</button>`; }
function guide(on){ if(on){ guideEl.innerHTML=guideHTML(); guideEl.hidden=false; act.hidden=true; curAct=null; $('#mGuideOk').onclick=()=>guide(false); if(R.locked&&R.locked()&&document.exitPointerLock) document.exitPointerLock(); }
  else { guideEl.hidden=true; R.sfx.ui(); } }
const guideOpen=()=>!guideEl.hidden;
function loopFrame(dt){ if(guideOpen()) return; L.t+=dt;
  if(S.frame%6===0) drawAct(); markFrame(dt);
  { const t='Guide'+(R.touch()?'':' (H)'); if(guideBtn.textContent!==t) guideBtn.textContent=t; guideBtn.hidden=false; }
  const lit=L.phase==='day'&&L.ch.watch!=='none'; lampL.intensity=lit?.9+Math.sin(S.T*11)*.08:0; lampF.visible=lit;
  if(L.phase==='night'){ huntFrame(dt); if(L.t>NIGHT_LEN) endNight(); }
  if(riftOpen){ W.rift.g.scale.x=lerp(W.rift.g.scale.x,1,dt*2); W.rift.g.scale.y=lerp(W.rift.g.scale.y,1,dt*2); if(Math.hypot(TP.x-RIFTP.x,TP.z-RIFTP.z)<1.6) endScene(); } }

/* ================= TELLS =================
   Small wrong things, each one deniable. Only ever shown on a wolf night (they never lie), one or two a night, drawn
   at random from the pool so no two runs show the same ones. Most need lightning to be seen. At least one a night
   works in any weather; the paw prints only survive light rain. Always on, outside the pool: the sheep shy from the
   dog, the watcher's head follows the dog, the bowl it will not touch. */
const TELLS={
  silhouette:{flash:true,  ok:()=>dogOut()},                         // for one flash it sits up like a person, too tall
  redEyes:   {flash:true,  ok:()=>dogOut()},                         // its eyes catch the light red
  gone:      {flash:true,  ok:()=>dogOut()&&!L.hunt},                // not in its place in one flash, back in the next
  lateBark:  {flash:false, ok:()=>dogOut()},                         // it barks at the ridge; the last bark comes after its mouth has shut
  wetFur:    {dawn:true,   ok:()=>SPOTS.dog[L.ch.dog].in&&L.ev.kills>0},   // it slept indoors, and it is soaked
  prints:    {dawn:true,rain:true, ok:()=>L.ev.kills>0&&L.d.rain==='light'}  // its tracks, from where it slept to what is left
};
const T7={list:[],flashQ:[],gone:false,barkT:-1,drips:null,prints:[]};
const dogOut=()=>!SPOTS.dog[L.ch.dog].in&&!dog.dead;
function pickTells(){ T7.list=[]; T7.flashQ=[]; T7.barkT=-1;
  if(!L.M.wolfNight||dog.dead) return;
  const force=new URLSearchParams(location.search).get('tells');
  const r=RULES.rng(L.M.seed*31+L.M.night*7);
  let pool=Object.keys(TELLS).filter(k=>TELLS[k].ok());
  if(force) pool=force.split(',').filter(k=>TELLS[k]&&TELLS[k].ok());
  const n=force?pool.length:1+(r()<.5?1:0), pick=[];
  while(pick.length<n&&pool.length){ const i=Math.floor(r()*pool.length); pick.push(pool.splice(i,1)[0]); }
  if(!force&&pick.length&&pick.every(k=>TELLS[k].rain)){ const any=Object.keys(TELLS).filter(k=>!TELLS[k].rain&&TELLS[k].ok()&&!pick.includes(k)); if(any.length) pick.push(any[Math.floor(r()*any.length)]); }
  T7.list=pick;
  for(const k of pick){ if(TELLS[k].flash) T7.flashQ.push({k,after:rr(6,L.hunt?Math.max(8,L.hunt.at-4):50)}); if(k==='lateBark') T7.barkT=rr(10,40); } }

// flash tells fire on the first strike after their time, and only if you could actually see the dog
onFlash(()=>{ if(L.phase!=='night') return;
  if(T7.gone){ T7.gone=false; if(!dog.away&&!dog.dead) dog.root.visible=true; return; }
  const seeDog=dog.root.visible&&!dog.away&&Math.hypot(dog.x-TP.x,dog.z-TP.z)<30&&canSee(dog.x,ghM(dog.x,dog.z)+.5,dog.z,.95);
  for(const q of T7.flashQ){ if(q.done||L.t<q.after) continue; if(!seeDog) continue;
    q.done=true;
    if(q.k==='silhouette') dog.wrongT=.09+HOLD;
    else if(q.k==='redEyes') dog.redT=.3+HOLD;
    else if(q.k==='gone'){ dog.root.visible=false; T7.gone=true; }
    break; } });

function tellFrame(dt){ const d=dog;
  if(d.wrongT>0){ d.wrongT-=dt;                                      // sat up on its haunches like a man, forelegs hanging, head bowed
    d.body.rotation.x=-1.35; d.body.position.y=.95; d.neck.rotation.x=.2; d.head.rotation.x=.9;
    d.legs[0].g.rotation.x=.25; d.legs[1].g.rotation.x=.25; d.legs[0].g.scale.y=d.legs[1].g.scale.y=1.7; d.legs[2].g.rotation.x=1.3; d.legs[3].g.rotation.x=1.3; }
  else if(d.legs[0].g.scale.y!==1){ d.legs[0].g.scale.y=d.legs[1].g.scale.y=1; d.neck.rotation.x=-.65; d.head.rotation.x=.65; }
  const red=d.redT>0; if(red) d.redT-=dt; for(const e of d.eyeS) e.visible=red;
  if(T7.barkT>0&&L.phase==='night'){ T7.barkT-=dt;
    if(T7.barkT<=0){ if(wolf.root.visible&&d.root.visible&&!d.away&&Math.hypot(d.x-TP.x,d.z-TP.z)<28){ const pan=K.panOf(d.x,d.z), v=K.vol(Math.hypot(d.x-TP.x,d.z-TP.z),1.1);
        d.jawT=.5; sndM.bark(pan,v); setTimeout(()=>sndM.bark(pan,v),620);                      // two barks, the jaw open for the first only
        setTimeout(()=>sndM.bark(pan,v*.9),1250); } else T7.barkT=4; } }
  if(d.jawT>0){ d.jawT-=dt; d.jaw.rotation.x=.45; }
  if(T7.drips){ const g=T7.drips, p=g.geometry.attributes.position; g.position.set(d.x,ghM(d.x,d.z),d.z); g.visible=d.root.visible;
    for(let i=0;i<p.count;i++){ let y=p.getY(i)-dt*1.6; if(y<0) y=rr(.3,.6); p.setY(i,y); } p.needsUpdate=true; } }

// dawn tells
function dawnTells(){ for(const k of T7.list){
  if(k==='wetFur'){ dog.fur.color.setHex(0x1c1712); dog.fur.specular=new THREE.Color(0x7f98ad); dog.fur.shininess=60; dog.pale.specular=dog.fur.specular; dog.pale.shininess=60;
    const pts=[]; for(let i=0;i<14;i++) pts.push(rr(-.15,.15),rr(.05,.6),rr(-.4,.4));
    const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));
    T7.drips=new THREE.Points(g,new THREE.PointsMaterial({color:0x7f98ad,size:2,sizeAttenuation:false,transparent:true,opacity:.8})); W.sc.add(T7.drips); }
  if(k==='prints'){ const c=FLOCK.find(s=>s.carcass); if(!c) continue; const from=SPOTS.dog[L.ch.dog], fx=from.x, fz=from.z;
    const L_=Math.hypot(c.x-fx,c.z-fz), a=Math.atan2(c.x-fx,c.z-fz), n=Math.floor(L_/.42);
    for(let i=1;i<n;i++){ const t=i/n, sd=(i%2?1:-1)*.09, x=fx+(c.x-fx)*t+Math.cos(a)*sd, z=fz+(c.z-fz)*t-Math.sin(a)*sd;
      if(blockedM(x,z,.05)) continue; const ind=sheltered(x,z), trk=pathDist(x,z)<.6, dk=ind||trk;
      const m=new THREE.Mesh(printGeo,dk?printM:printG); m.rotation.set(-Math.PI/2,0,-a); m.position.set(x,ind?.06:ghM(x,z)+(trk?.08:.04),z); W.sc.add(m); T7.prints.push(m); } } } }
// pressed into the mud: dark on the earth floors and the track, standing water (pale) in the grass
const printM=new THREE.MeshBasicMaterial({color:0x0b1016,transparent:true,opacity:.85,depthWrite:false}), printG=new THREE.MeshBasicMaterial({color:0x4f6577,transparent:true,opacity:.8,depthWrite:false,fog:true}),
  printGeo=(()=>{ const g=new THREE.CircleGeometry(.09,6); g.scale(1,1.35,1); return g; })();
function clearTells(){ T7.list=[]; T7.flashQ=[]; T7.gone=false; T7.barkT=-1;
  dog.fur.color.setHex(0x2e251c); dog.fur.specular=new THREE.Color(0x111111); dog.fur.shininess=4; dog.pale.specular=dog.fur.specular; dog.pale.shininess=4;
  if(T7.drips){ W.sc.remove(T7.drips); T7.drips=null; } for(const m of T7.prints) W.sc.remove(m); T7.prints=[]; }

/* ================= THE HEARTH, AND THE ENDINGS =================
   The hearth: the first night the dog is tied by the fire, away from the flock, on a hunting night, the watcher comes
   out of the trees for the only time. A flash: the door is thrown open, it stands in the doorway, and the dog by the
   fire sits up wrong. It looks at the dog, then at you. Next flash it is gone and the door swings back. Nothing is explained.
   The endings play out at the rift once the last dawn comes, or in the dark if the flock runs out. */
const HS={pending:false,on:false,stage:0,t:0,at:0};
function hearthArm(){ HS.pending=true; HS.on=false; HS.stage=0; HS.at=rr(18,32); }
function hearthFrame(dt){ if(!HS.on) return; HS.t+=dt;
  // it looks in at the dog, then turns its head to you
  const tgt=HS.t<2.6?{x:dog.x,z:dog.z}:{x:TP.x,z:TP.z}; const hy=Math.atan2(tgt.x-wolf.x,tgt.z-wolf.z)-wolf.root.rotation.y;
  wolf.neck.rotation.y=lerp(wolf.neck.rotation.y,clamp(K.angLerp(0,hy,1),-1.3,1.3),1-Math.exp(-dt*(HS.t<2.6?8:2.5)));
  dog.wrongT=Math.max(dog.wrongT||0,.2); }
onFlash(()=>{ if(L.phase!=='night') return;
  if(HS.pending&&L.t>=HS.at){ const sees=Math.hypot(TP.x-DOOR.x,TP.z-DOOR.z)<30&&K.onScreen(DOOR.x,1.1,DOOR.z,.95);
    if(!sees&&L.t<HS.at+30) return;
    HS.pending=false; HS.on=true; HS.stage=1; HS.t=0;
    wolf.root.visible=true; wolf.st='hearth'; wolfStill(); wolfOpacity(1,1); wolf.root.scale.setScalar(.6); wolf.x=CX0-1.3; wolf.z=DOOR.z-.1; wolf.root.position.set(wolf.x,ghM(wolf.x,wolf.z),wolf.z); wolf.root.rotation.y=Math.PI/2;   // in the doorway, stooped to fit it, facing in
    wolf.neck.rotation.y=0; dog.h=Math.atan2(DOOR.x-dog.x,DOOR.z-dog.z); dog.lie=false; dog.root.visible=true; dog.st='stay'; return; }
  if(HS.on&&HS.stage===1&&HS.t>4.2){ HS.stage=2; HS.on=false; wolf.root.visible=false; wolf.root.scale.setScalar(1); wolf.st='gone'; wolf.back=rr(20,40); wolf.neck.rotation.y=0; NT.wolf=false; dog.wrongT=0; } });
function hearthReset(){ HS.pending=false; HS.on=false; HS.stage=0; if(wolf) wolf.neck.rotation.y=0; }

// the tie rope, from the iron ring to the dog's neck
const _ra=V(0,0,0), _rb=V(0,0,0), _up=V(0,1,0);
function ropeFrame(){ const r=W.rope; if(!r.visible) return;
  _ra.set(TIEPOST.x-.1,.5,TIEPOST.z+.06); _rb.set(dog.x+Math.sin(dog.h)*.36,dog.body.position.y+.12,dog.z+Math.cos(dog.h)*.36);
  r.position.copy(_ra).add(_rb).multiplyScalar(.5); const L_=_ra.distanceTo(_rb); r.scale.set(1,L_,1); r.quaternion.setFromUnitVectors(_up,_rb.sub(_ra).normalize()); }
// the fire: it never burns the same way twice; it crackles if you are near
function fireFrame(dt){ const F=W.fire, t=S.T;
  F.light.intensity=2.1+Math.sin(t*7.3)*.18+Math.sin(t*13.1)*.12+Math.sin(t*23.7)*.07;
  F.flames.forEach((m,i)=>{ m.scale.y=.85+.22*Math.sin(t*(8.5+i*2.3)+i*2)+.08*Math.sin(t*31+i); m.scale.x=.9+.1*Math.sin(t*6.1+i*1.7); });
  const p=F.embers.geometry.attributes.position; for(let i=0;i<p.count;i++){ let y=p.getY(i)+dt*F.ev[i]; if(y>1.25){ y=0; p.setX(i,rr(-.15,.15)); p.setZ(i,rr(-.1,.1)); } p.setX(i,p.getX(i)+Math.sin(t*3+i)*dt*.05); p.setY(i,y); } p.needsUpdate=true;
  F.crackle-=dt; if(F.crackle<=0){ F.crackle=rr(.08,.7); const dd=Math.hypot(TP.x-HEARTH.x,TP.z-HEARTH.z); if(dd<9&&S.mode!=='medDead') sndM.crackle(K.panOf(HEARTH.x,HEARTH.z),K.vol(dd,.35)*(inCabin(TP.x,TP.z)?1:.4)); } }

// the survive ending: it followed you to the rift. One last flash, and its shadow on the track is not a dog's.
const manTex=tex(32,128,(g,w,h)=>{ g.clearRect(0,0,w,h); g.fillStyle='#000'; disc(g,'#000',16,10,6);
  g.fillRect(11,16,10,46); g.fillRect(6,18,4,52); g.fillRect(22,18,4,52);          // long arms
  g.fillRect(11,60,4,62); g.fillRect(17,60,4,62); });
let shadowM=null;
const END={on:false,t:0,yaw0:0,yawTo:0,flashed:false};
function endScene(){ if(END.on) return; const e=L.ending;
  if(e==='survive'&&!dog.dead){ END.on=true; END.t=0; END.flashed=false; S.mode='medEnd'; objEl().classList.remove('on'); act.hidden=true;
    const bx=-10-TP.x, bz=.2-TP.z, bl=Math.hypot(bx,bz)||1;   // a few steps behind you, back along the track
    dog.st='stay'; dog.route=[]; dog.lie=false; dog.x=TP.x+bx/bl*3.2; dog.z=TP.z+bz/bl*3.2; dog.h=Math.atan2(TP.x-dog.x,TP.z-dog.z); dog.root.visible=true; ST.next=999;
    END.yaw0=P.yaw; END.yawTo=Math.atan2(-(dog.x-TP.x),-(dog.z-TP.z)); return; }
  if(e==='true'||e==='dark') sndM.howl(K.panOf(wolf.x||0,wolf.z||-38),.45);
  K.leave(); }
function endFrame(dt){ END.t+=dt; const k=sstep(0,1.4,END.t); P.yaw=K.angLerp(END.yaw0,END.yawTo,k); P.pitch=lerp(P.pitch,-.42,k);   // you look down at it
  if(END.t>2.2&&!END.flashed){ END.flashed=true; strike(true); ST.pulses=[{at:0,peak:reduce?.4:.95,dur:1.1+HOLD,soft:true}];   // one long, slow flash: long enough to see it
    if(!shadowM){ shadowM=new THREE.Mesh(new THREE.PlaneGeometry(1.3,4.2),new THREE.MeshBasicMaterial({map:manTex,transparent:true,opacity:.85,depthWrite:false})); W.sc.add(shadowM); }
    const b=Math.atan2(dog.x-TP.x,dog.z-TP.z)+Math.PI/2, sx=dog.x+Math.sin(b)*2.2, sz=dog.z+Math.cos(b)*2.2;   // thrown sideways across the track by the strike
    shadowM.position.set(sx,ghM(sx,sz)+.13,sz); /* above the track ribbon */ shadowM.rotation.set(-Math.PI/2,0,b+Math.PI); shadowM.visible=true; }
  if(shadowM&&END.flashed) shadowM.visible=ST.flash>.12;
  if(END.t>3.6&&END.t-dt<=3.6){ fadeTo(1,.9,'#000'); }
  if(END.t>4.8){ END.on=false; if(shadowM) shadowM.visible=false; K.leave(); } }

/* ================= ERA LIFECYCLE ================= */
function enterMed(){ if(!W){ buildMed(); buildAnimals(); buildProps(); }
  W.sc.add(cam); setPal(PAL_STORM); K.fallAudioStop(); ST.next=rr(3,6); ST.since=99;
  riftOpen=false; W.rift.g.scale.set(.25,.85,1); newRun();
  TP.x=SPAWN.x; TP.z=SPAWN.z; TP.acc=0; P.yaw=0; P.pitch=-.12; ST.indoors=undefined;   // by the fire, facing it; the window and the door are on your left
  document.body.classList.add('twalk','tmed'); $('#yearVal').textContent='AD 1350'; $('#year').classList.add('past'); $('#shiftBtn').textContent='Leave rift'; }
function arrive(){ enterMed(); S.mode='medEnter'; S.t=0; S.fade=1; fadeTo(1,0,'#000'); snd.thud(); R.sfx.shift();
  title('Temporal recovery · Rift 86','c. AD 1350','Middle Ages · a cabin in the forest, in the north of England, in the fog');
  after(3,()=>{ untitle(); fadeTo(0,reduce?.6:2.4); S.mode='med'; S.t=0; startDay(true); }); }
function frame(dt,inp){
  S.frame=(S.frame||0)+1;
  if(S.mode==='med') walk(dt,inp);
  const bob=reduce?0:Math.sin(TP.bob)*.03;
  cam.position.set(TP.x,ghM(TP.x,TP.z)+1.6+bob,TP.z); cam.rotation.set(P.pitch,P.yaw,0); cam.updateMatrixWorld();
  W.clouds.rotation.y+=dt*.004; stormFrame(dt);
  if(!dog.dead&&!dog.away){ dogFrame(dt); tellFrame(dt); } flockFrame(dt); wolfFrame(dt); hearthFrame(dt); doorFrame(dt); fireFrame(dt); ropeFrame();
  { const ind=inCabin(TP.x,TP.z); if(ind!==ST.indoors){ ST.indoors=ind; applyRain(); } } if(S.mode==='med') loopFrame(dt); else if(S.mode==='medEnd') endFrame(dt);
  W.rift.em.opacity=(riftOpen?.85:.3)+Math.random()*.1; K.shimmer(W.rift,S.T,riftOpen?1.2:.4); W.riftL.intensity=(riftOpen?1.5:.45)+Math.sin(S.T*9)*.12;
  K.render(W.sc); }
function key(k){ if(S.mode!=='med') return;
  if(guideOpen()){ if(k==='e'||k==='enter'||k==='h'||k==='escape') guide(false); return; }
  if(k==='h'){ guide(true); return; }
  if(k==='enter'){ if(L.phase==='night') endNight(); return; }   // by day, the dark comes when you sit down by the fire
  if(k==='e'){ drawAct(); doAct(); return; }
  if(k==='t') msg('Time will not shift here'); else if(k>='1'&&k<='5') msg('Your records stayed in 1986'); }
function click(){ if(S.mode==='med'&&!guideOpen()&&!R.touch()&&!R.locked()) R.lock(); }
function exit(){ document.body.classList.remove('tmed'); hearthReset(); END.on=false; if(shadowM) shadowM.visible=false; rainAudioStop(); ST.flash=0; act.hidden=true; guideEl.hidden=true; guideBtn.hidden=true; L.phase=null; if(lantern) lantern.intensity=0; }
const sty=document.createElement('style'); sty.textContent=`body.tmed #tJump{display:none!important}
#mAct{position:fixed;z-index:12;left:50%;bottom:calc(84px + env(safe-area-inset-bottom));transform:translateX(-50%)}
#mAct[hidden]{display:none}
body.touch #mAct{bottom:calc(14px + env(safe-area-inset-bottom))}   /* bottom centre: clear of the stick (left) */
#mGuide{position:fixed;z-index:14;left:50%;top:50%;transform:translate(-50%,-50%);width:min(94vw,640px);max-height:88vh;overflow:auto;background:rgba(10,12,15,.95);border:3px solid #434b50;padding:12px 18px 14px;font-family:var(--vt);font-size:17px;line-height:1.15;color:var(--ink);pointer-events:auto}
#mGuide[hidden]{display:none}
#mGuide h3{margin:0 0 10px;font-family:var(--px);font-size:13px;font-weight:400;letter-spacing:.1em;text-transform:uppercase;color:var(--amber)}
#mGuide p{margin:0 0 6px}
#mGuide b{display:block;font-family:var(--px);font-size:10px;font-weight:400;letter-spacing:.08em;text-transform:uppercase;color:var(--amber);margin-bottom:2px}
#mGuide ul{margin:0 0 6px;padding-left:18px}#mGuide li{margin-bottom:2px}
#mGuide b.i{display:inline;margin-right:6px}
#mGuide .amb{color:var(--amber)}
#mGuide .pbtn{display:block;margin:8px auto 0}
#mGuideBtn{position:fixed;z-index:12;left:calc(16px + env(safe-area-inset-left));top:calc(64px + env(safe-area-inset-top))}
#mGuideBtn[hidden]{display:none}
body.touch #mGuide{font-size:16px;padding:12px 14px}`;
document.head.appendChild(sty);

K.register('med',{arrive,frame,key,click,exit});
K.medDebug={get TP(){ return TP; },get W(){ return W; },ST,strike,setWeather,onFlash,HOLD,get dog(){ return dog; },get wolf(){ return wolf; },HS,END,hearthArm,endScene,T7,TELLS,pickTells,dawnTells,clearTells,FLOCK,NT,sendDog,dogRoam,placeFlock,wolfShow,L,startNight,endNight,startDay,feed,ACTS,pickAct,doAct,setDog,moveSheep,setWatch,toggleBait,toggleDoor,DEEP,WS,wolfPlace,wolfRush,RUSH,guide,ghM,blockedM,canSee,inCabin,inShed,CABIN,SHED,DOOR,WINDOW,DS,GAPS,TREELINE,RIFTP};
})(typeof window!=='undefined'?window:globalThis);
