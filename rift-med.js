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
const {R,S,P,reduce,cam,tex,px,disc,sky,rnd,rr,clamp,lerp,sstep,V,put,flush,snd,after,title,untitle,objective,msg,fadeTo,setPal,toPal}=K;
const $=s=>document.querySelector(s);

/* ================= THE FARM =================
   A lane runs north between hedgerows to a farmyard: stone house (west), barn (east), wattle pen (south-east).
   Beyond, fields roll up to a ridge that rings the valley, only ever seen through fog. 1 unit ~ 1 m; -z is north. */
const SPAWN={x:0,z:24}, RIFTP={x:0,z:26.4};
const HOUSE={x:-7,z:-1,w:6,d:8,h:3}, BARN={x:9,z:-4,w:7,d:9,h:4}, PEN={x:7,z:9,w:7,d:6};
const DOOR={x:HOUSE.x+HOUSE.w/2,z:1}, PORCH={x:-3.1,z:1}, WINDOW={x:HOUSE.x+HOUSE.w/2,z:-2.4};
const BARN_DOOR={x:BARN.x-BARN.w/2,z:BARN.z,w:3,h:3}, PEN_GATE={x:PEN.x-PEN.w/2,z:PEN.z,w:1.8};
const BOUND=31, RIDGE=48;
const laneX=z=>1.2*Math.sin(z*.12);
// storm night: cold blue-greys, dark grass and earth, one warm amber (the window, the lantern), red for what should not be there
const PAL_STORM=toPal(['#05070a','#0b1016','#121a22','#1b2630','#26343f','#34465a','#4f6577','#7f98ad','#b9c8d3','#e3ecf1',
  '#0e1410','#18221a','#26331f','#4a4230','#1c1712','#2e251c','#6b4a2a','#f0a43c','#fff3d0','#c4221a']);

function ghM(x,z){ const r=Math.hypot(x,z); let h=.18*Math.sin(x*.13+.7)+.14*Math.cos(z*.11)+.08*Math.sin((x-z)*.29);
  if(r>26) h+=(r-26)*(r-26)*.012;                                   // the valley rises to the ridge
  h+=.9*Math.sin(Math.atan2(z,x)*3+1)*sstep(30,60,r)+.6*Math.sin(Math.atan2(z,x)*7)*sstep(36,60,r);
  const dl=Math.abs(x-laneX(z)); if(z>-6&&dl<1.6) h-=(1-dl/1.6)*.08;   // the lane, worn a little into the ground
  return h; }
// solid boxes the player (and later the animals) cannot walk through: {x0,x1,z0,z1}
const RECTS=[], CIRCS=[];
function rect(cx,cz,w,d,gapAxis){ RECTS.push({x0:cx-w/2,x1:cx+w/2,z0:cz-d/2,z1:cz+d/2}); }
function blockedM(x,z,r){ r=r||.3; if(Math.hypot(x,z)>BOUND) return true;
  for(const b of RECTS) if(x>b.x0-r&&x<b.x1+r&&z>b.z0-r&&z<b.z1+r) return true;
  for(const c of CIRCS){ const dx=x-c.x, dz=z-c.z, q=c.r+r; if(dx*dx+dz*dz<q*q) return true; } return false; }

let W=null; // the built world
function buildMed(){ K.reseed(1350714);
  const sc=new THREE.Scene(); sc.background=new THREE.Color(0x1b2630); sc.fog=new THREE.FogExp2(0x1b2630,.019);
  const T={
    grass:tex(32,32,(g,w,h)=>{ px(g,'#18221a',0,0,w,h); for(let i=0;i<300;i++) px(g,['#26331f','#0e1410','#18221a','#3a4630'][i%4],rnd()*w,rnd()*h,1,1+(rnd()*2|0)); },40),
    lane:tex(32,32,(g,w,h)=>{ px(g,'#4f6577',0,0,w,h); for(let i=0;i<220;i++) px(g,['#7f98ad','#34465a','#4a3c2c','#26343f'][i%4],rnd()*w,rnd()*h,1+(rnd()*2|0),1);
      for(let y=0;y<h;y++){ px(g,'#34465a',9+Math.sin(y*.4)|0,y,2,1); px(g,'#34465a',21+Math.cos(y*.3)|0,y,2,1); } },1,8),   // two cart ruts
    stone:tex(32,32,(g,w,h)=>{ px(g,'#34465a',0,0,w,h); for(let y=0;y<h;y+=4){ const o=(y/4)%2*4; px(g,'#1b2630',0,y,w,1); for(let x=o;x<w;x+=8) px(g,'#1b2630',x,y,1,4); }
      for(let i=0;i<90;i++) px(g,rnd()<.5?'#4f6577':'#26343f',rnd()*w,rnd()*h,1+(rnd()*2|0),1); for(let i=0;i<8;i++) px(g,'#26331f',rnd()*w,rnd()*h,2,1); },2,1),
    slate:tex(32,32,(g,w,h)=>{ px(g,'#1b2630',0,0,w,h); for(let y=0;y<h;y+=3){ const o=(y/3)%2*3; px(g,'#0b1016',0,y,w,1); for(let x=o;x<w;x+=6) px(g,'#0b1016',x,y,1,3); }
      for(let i=0;i<40;i++) px(g,'#26343f',rnd()*w,rnd()*h,2,1); },3,2),
    plank:tex(32,32,(g,w,h)=>{ px(g,'#2e251c',0,0,w,h); for(let x=0;x<w;x+=4){ px(g,'#1c1712',x,0,1,h); } for(let i=0;i<70;i++) px(g,rnd()<.5?'#4a3c2c':'#1c1712',rnd()*w,rnd()*h,1,2+(rnd()*3|0)); },2,1),
    tuft:tex(32,32,(g,w,h)=>{ g.clearRect(0,0,w,h); for(let k=0;k<11;k++){ const bx=3+k*2.6+rnd()*2, lean=rr(-5,5), H=rr(16,31);
      for(let y=0;y<H;y++){ const t=y/H; px(g,t>.75&&k%3===0?'#4a3c2c':(k%2?'#26331f':'#3a4630'),bx+lean*t*t,h-1-y); } } }),
    sky:tex(4,64,(g,w,h)=>{ sky(g,w,h,['#0b1016','#121a22','#1b2630','#26343f']); }),
    cloud:tex(64,32,(g,w,h)=>{ g.clearRect(0,0,w,h); for(let i=0;i<46;i++){ const x=rnd()*w, y=rr(4,h-4), r=rr(3,8); g.globalAlpha=rr(.15,.4); disc(g,rnd()<.5?'#26343f':'#34465a',x,y,r); } g.globalAlpha=1; },3,1)
  };
  const M={
    grass:new THREE.MeshPhongMaterial({map:T.grass,shininess:2,specular:0x050505}),
    lane:new THREE.MeshPhongMaterial({map:T.lane,shininess:6,specular:0x101418}),
    stone:new THREE.MeshPhongMaterial({map:T.stone,flatShading:true,shininess:3}),
    slate:new THREE.MeshPhongMaterial({map:T.slate,flatShading:true,shininess:10,specular:0x141c24}),
    plank:new THREE.MeshPhongMaterial({map:T.plank,flatShading:true,shininess:2}),
    wood:new THREE.MeshPhongMaterial({color:0x2e251c,flatShading:true,shininess:2}),
    hedge:new THREE.MeshPhongMaterial({color:0x18221a,flatShading:true,shininess:0}),
    dark:new THREE.MeshPhongMaterial({color:0x0b1016,flatShading:true,shininess:0}),
    tuft:new THREE.MeshPhongMaterial({map:T.tuft,alphaTest:.5,side:THREE.DoubleSide,shininess:0}),
  };
  const box=new THREE.BoxGeometry(1,1,1), cyl=new THREE.CylinderGeometry(1,1,1,6,1), ico=new THREE.IcosahedronGeometry(1,0), cone=new THREE.ConeGeometry(1,1,6);
  // ground: one wide sheet, the valley and the ridge in a single surface
  const gg=new THREE.PlaneGeometry(200,200,100,100); gg.rotateX(-Math.PI/2); const gp=gg.attributes.position;
  for(let i=0;i<gp.count;i++) gp.setY(i,ghM(gp.getX(i),gp.getZ(i))); gg.computeVertexNormals(); sc.add(new THREE.Mesh(gg,M.grass));
  // the lane: a ribbon laid on the ground from the rift up to the yard
  { const pts=[], uv=[], idx=[]; let n=0; for(let z=30;z>=-7;z-=.5){ const x=laneX(z), w=z<-3?lerp(1.3,2.4,(-3-z)/4):1.3;
      for(const s of [-1,1]){ const px_=x+s*w; pts.push(px_,ghM(px_,z)+.03,z); uv.push(s<0?0:1,(30-z)/4); } if(n) idx.push(n*2-2,n*2-1,n*2,n*2-1,n*2+1,n*2); n++; }
    const lg=new THREE.BufferGeometry(); lg.setAttribute('position',new THREE.Float32BufferAttribute(pts,3)); lg.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2)); lg.setIndex(idx); lg.computeVertexNormals();
    T.lane.repeat.set(1,1); sc.add(new THREE.Mesh(lg,M.lane)); }
  // hedgerows along the lane, broken where the yard opens; a few gnarled hedge trees
  for(const s of [-1,1]) for(let z=29;z>8;z-=.9){ const x=laneX(z)+s*rr(2.4,2.9), y=ghM(x,z), r=rr(.7,1.1);
    put(ico,M.hedge,x,y+r*.7,z,rnd()*3,rnd()*3,0,r,r*rr(.9,1.4),r); CIRCS.push({x,z,r:r*.8}); if(rnd()<.07){ const H=rr(4,6.5); put(cyl,M.wood,x,y+H/2,z,rr(-.1,.1),0,rr(-.1,.1),.22,H,.22);
      for(let k=0;k<5;k++) put(ico,M.hedge,x+rr(-1.4,1.4),y+H+rr(-.8,.6),z+rr(-1.4,1.4),rnd()*3,rnd()*3,0,rr(1,1.6)); } }
  // dry-stone field walls running off into the fog
  for(let i=0;i<14;i++){ const a=rnd()*6.283, d0=rr(12,30), L=rr(14,40), ax=Math.cos(a), az=Math.sin(a);
    for(let t=0;t<L;t+=1.2){ const x=ax*(d0+t)+(-az)*rr(-.1,.1), z=az*(d0+t), y=ghM(x,z); if(Math.abs(x)<4&&z>6) continue; if(Math.hypot(x-HOUSE.x,z-HOUSE.z)<8||Math.hypot(x-BARN.x,z-BARN.z)<9||Math.hypot(x-PEN.x,z-PEN.z)<7) continue;
      put(box,M.stone,x,y+.35,z,0,-a,0,1.25,.7,.5); } }
  // the house: rubble stone, slate roof, a chimney, the door to the lane and the one lit window
  { const H=HOUSE, y=ghM(H.x,H.z); put(box,M.stone,H.x,y+H.h/2-.2,H.z,0,0,0,H.w,H.h+.4,H.d);
    const rise=2.1, half=H.w/2+.35, sl=Math.hypot(half,rise), ang=Math.atan2(rise,half);
    for(const s of [-1,1]) put(box,M.slate,H.x+s*half/2,y+H.h+rise/2-.05,H.z,0,0,-s*ang,sl,.18,H.d+.6);
    for(const s of [-1,1]){ const gs=new THREE.BufferGeometry(); gs.setAttribute('position',new THREE.Float32BufferAttribute([-H.w/2,0,0, H.w/2,0,0, 0,rise,0],3)); gs.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,.5,1],2)); gs.computeVertexNormals();
      const gm=new THREE.Mesh(gs,new THREE.MeshPhongMaterial({map:T.stone,flatShading:true,side:THREE.DoubleSide})); gm.position.set(H.x,y+H.h-.2,H.z+s*H.d/2); sc.add(gm); }
    put(box,M.stone,H.x-1,y+H.h+2.2,H.z-H.d/2+1.2,0,0,0,.9,2.6,.9); put(box,M.dark,H.x-1,y+H.h+3.52,H.z-H.d/2+1.2,0,0,0,.6,.08,.6);
    put(box,M.wood,DOOR.x+.03,y+1,DOOR.z,0,0,0,.08,2,1.1); put(box,M.wood,PORCH.x+.2,y+.08,PORCH.z,0,0,0,1.6,.16,2.2);
    rect(H.x,H.z,H.w,H.d); }
  const win=new THREE.Mesh(new THREE.PlaneGeometry(.9,.75),new THREE.MeshBasicMaterial({color:0xf0a43c,fog:false})); win.position.set(WINDOW.x+.02,ghM(HOUSE.x,HOUSE.z)+1.7,WINDOW.z); win.rotation.y=Math.PI/2; sc.add(win);
  put(box,M.dark,WINDOW.x+.05,win.position.y,WINDOW.z,0,0,0,.04,.75,.07); put(box,M.dark,WINDOW.x+.05,win.position.y,WINDOW.z,0,0,0,.04,.07,.9);
  const winL=new THREE.PointLight(0xffa040,1.3,9,2); winL.position.set(WINDOW.x+1.2,win.position.y,WINDOW.z); sc.add(winL);
  // the barn: planks on a stone footing, a big door to the yard that swings (the door is its own mesh)
  { const B=BARN, y=ghM(B.x,B.z); put(box,M.stone,B.x,y+.3,B.z,0,0,0,B.w+.2,.8,B.d+.2); put(box,M.plank,B.x,y+B.h/2+.4,B.z,0,0,0,B.w,B.h,B.d);
    const rise=2.6, half=B.w/2+.4, sl=Math.hypot(half,rise), ang=Math.atan2(rise,half);
    for(const s of [-1,1]) put(box,M.slate,B.x+s*half/2,y+B.h+.4+rise/2-.05,B.z,0,0,-s*ang,sl,.2,B.d+.6);
    for(const s of [-1,1]){ const gs=new THREE.BufferGeometry(); gs.setAttribute('position',new THREE.Float32BufferAttribute([-B.w/2,0,0, B.w/2,0,0, 0,rise,0],3)); gs.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,.5,1],2)); gs.computeVertexNormals();
      const gm=new THREE.Mesh(gs,new THREE.MeshPhongMaterial({map:T.plank,flatShading:true,side:THREE.DoubleSide})); gm.position.set(B.x,y+B.h+.4,B.z+s*B.d/2); sc.add(gm); }
    put(box,M.dark,BARN_DOOR.x-.02,y+.4+BARN_DOOR.h/2,BARN_DOOR.z,0,0,0,.04,BARN_DOOR.h,BARN_DOOR.w);   // the dark behind the door
    rect(B.x,B.z,B.w,B.d); }
  const doorPivot=new THREE.Group(); doorPivot.position.set(BARN_DOOR.x-.08,ghM(BARN.x,BARN.z)+.4,BARN_DOOR.z-BARN_DOOR.w/2); sc.add(doorPivot);
  const doorM=new THREE.Mesh(new THREE.BoxGeometry(.1,BARN_DOOR.h,BARN_DOOR.w),new THREE.MeshPhongMaterial({map:T.plank,color:0xb0a090,flatShading:true,shininess:2})); doorM.position.set(0,BARN_DOOR.h/2,BARN_DOOR.w/2); doorPivot.add(doorM);
  const brace=new THREE.Mesh(new THREE.BoxGeometry(.06,.18,Math.hypot(BARN_DOOR.w,BARN_DOOR.h)*.92),M.wood); brace.position.set(-.06,BARN_DOOR.h/2,BARN_DOOR.w/2); brace.rotation.x=Math.atan2(BARN_DOOR.h,BARN_DOOR.w); doorPivot.add(brace);
  // the pen: posts and woven hurdles, a gate gap facing the lane
  { const P_=PEN, x0=P_.x-P_.w/2, x1=P_.x+P_.w/2, z0=P_.z-P_.d/2, z1=P_.z+P_.d/2;
    const side=(ax,az,bx,bz,gap)=>{ const L=Math.hypot(bx-ax,bz-az), n=Math.round(L/1.2), a=Math.atan2(bz-az,bx-ax);
      for(let i=0;i<=n;i++){ const t=i/n, x=lerp(ax,bx,t), z=lerp(az,bz,t); if(gap&&Math.abs(z-PEN_GATE.z)<PEN_GATE.w/2) continue; put(cyl,M.wood,x,ghM(x,z)+.55,z,0,0,0,.07,1.1,.07); }
      for(let i=0;i<n;i++){ const t=(i+.5)/n, x=lerp(ax,bx,t), z=lerp(az,bz,t); if(gap&&Math.abs(z-PEN_GATE.z)<PEN_GATE.w/2+.3) continue;
        for(const hy of [.3,.55,.8]) put(box,M.wood,x,ghM(x,z)+hy,z,0,-a,0,L/n,.12,.06); } };
    side(x0,z0,x1,z0); side(x1,z0,x1,z1); side(x1,z1,x0,z1); side(x0,z1,x0,z0,true);
    const t=.15; RECTS.push({x0:x0-t,x1:x1+t,z0:z0-t,z1:z0+t},{x0:x0-t,x1:x1+t,z0:z1-t,z1:z1+t},{x0:x1-t,x1:x1+t,z0:z0,z1:z1},
      {x0:x0-t,x1:x0+t,z0:z0,z1:PEN_GATE.z-PEN_GATE.w/2},{x0:x0-t,x1:x0+t,z0:PEN_GATE.z+PEN_GATE.w/2,z1:z1}); }
  // a few old oaks about the yard, and distant trees on the slopes (silhouettes in the fog)
  for(const [x,z,H] of [[-13,9,7],[-12,-12,8],[16,6,6.5],[-17,-4,7.5]]){ const y=ghM(x,z); put(cyl,M.wood,x,y+H*.35,z,0,0,0,.38,H*.7,.38); CIRCS.push({x,z,r:.5});
    for(let k=0;k<9;k++) put(ico,M.hedge,x+rr(-2.4,2.4),y+H*rr(.7,1.05),z+rr(-2.4,2.4),rnd()*3,rnd()*3,0,rr(1.4,2.3)); }
  for(let i=0;i<60;i++){ const a=rnd()*6.283, d=rr(44,72), x=Math.cos(a)*d, z=Math.sin(a)*d; if(z>20&&Math.abs(x)<10) continue; const y=ghM(x,z), H=rr(5,10);
    put(cyl,M.dark,x,y+H*.3,z,0,0,0,.3,H*.6,.3); for(let k=0;k<3;k++) put(ico,M.dark,x+rr(-1.6,1.6),y+H*rr(.6,.95),z+rr(-1.6,1.6),rnd()*3,rnd()*3,0,rr(1.4,2.4)); }
  flush(sc);
  // long grass (instanced), thick in the verges and the fields, never on the lane or in the buildings
  const fg=new THREE.BufferGeometry(); { const parts=[0,1,2].map(k=>{ const p=new THREE.PlaneGeometry(1.2,.9,1,1); p.translate(0,.45,0); p.rotateY(k*Math.PI/3); return p.toNonIndexed(); });
    const n=parts.reduce((s,p)=>s+p.attributes.position.count,0), pos=new Float32Array(n*3), nor=new Float32Array(n*3), uv=new Float32Array(n*2); let o=0;
    for(const p of parts){ pos.set(p.attributes.position.array,o*3); nor.set(p.attributes.normal.array,o*3); uv.set(p.attributes.uv.array,o*2); o+=p.attributes.position.count; }
    fg.setAttribute('position',new THREE.BufferAttribute(pos,3)); fg.setAttribute('normal',new THREE.BufferAttribute(nor,3)); fg.setAttribute('uv',new THREE.BufferAttribute(uv,2)); }
  const GN=1400, grass=new THREE.InstancedMesh(fg,M.tuft,GN); let gi=0; const m4=new THREE.Matrix4(), q=new THREE.Quaternion(), e=new THREE.Euler(), p3=V(0,0,0), s3=V(1,1,1);
  for(let i=0;i<GN*3&&gi<GN;i++){ const a=rnd()*6.283, d=Math.sqrt(rnd())*44, x=Math.cos(a)*d, z=Math.sin(a)*d;
    if(Math.abs(x-laneX(z))<1.6&&z>-7) continue; if(blockedM(x,z,.2)&&d<BOUND) continue; if(Math.hypot(x,z+1)<7&&rnd()<.7) continue;   // the yard is trodden
    const s=rr(.6,1.5)*(Math.abs(x-laneX(z))<3.5?1.3:1); e.set(0,rnd()*6.283,0); q.setFromEuler(e); m4.compose(p3.set(x,ghM(x,z)-.05,z),q,s3.set(s,s*rr(.8,1.3),s)); grass.setMatrixAt(gi++,m4); }
  grass.count=gi; grass.instanceMatrix.needsUpdate=true; sc.add(grass);
  // sky: low overcast, a slow drifting cloud deck
  const skyM=new THREE.Mesh(new THREE.SphereGeometry(240,24,12),new THREE.MeshBasicMaterial({map:T.sky,side:THREE.BackSide,fog:false})); sc.add(skyM);
  const clouds=new THREE.Mesh(new THREE.CylinderGeometry(200,200,70,24,1,true),new THREE.MeshBasicMaterial({map:T.cloud,transparent:true,side:THREE.BackSide,depthWrite:false,fog:false})); clouds.position.y=30; sc.add(clouds);
  // light: overcast night. A dim sky fill, a faint cold key from the cloud glow, the window.
  const hemi=new THREE.HemisphereLight(0x4f6577,0x0b1016,.55); sc.add(hemi);
  const key=new THREE.DirectionalLight(0x7f98ad,.35); key.position.set(-30,50,20); sc.add(key);
  // the rift you came through, behind you at the end of the lane
  const rift=K.crack({h:2.6,w:.9,seed:11,edge:0x7da597}); rift.g.position.set(RIFTP.x,ghM(RIFTP.x,RIFTP.z)+1.4,RIFTP.z); sc.add(rift.g);
  const riftL=new THREE.PointLight(0x7da597,.5,8,2); riftL.position.set(RIFTP.x,ghM(RIFTP.x,RIFTP.z)+1.6,RIFTP.z-.6); sc.add(riftL);
  W={sc,hemi,key,win,winL,rift,riftL,doorPivot,clouds,skyM};
}

/* ================= THE PLAYER ================= */
const TP={x:0,z:0,bob:0,acc:0};
function walk(dt,inp){ const m=inp.m; if(m<=.05) return; const sp=(inp.run?3.4:1.9)*Math.min(1,m)/Math.max(1,m), yaw=P.yaw;
  const vx=(-Math.sin(yaw)*inp.f+Math.cos(yaw)*inp.s)*sp*dt, vz=(-Math.cos(yaw)*inp.f-Math.sin(yaw)*inp.s)*sp*dt;
  if(!blockedM(TP.x+vx,TP.z)) TP.x+=vx; if(!blockedM(TP.x,TP.z+vz)) TP.z+=vz;
  TP.bob+=dt*(inp.run?10:7.5); TP.acc+=Math.hypot(vx,vz); if(TP.acc>(inp.run?1:.8)){ TP.acc=0; snd.step(); } }

/* ================= ERA LIFECYCLE ================= */
function enterMed(){ if(!W) buildMed();
  W.sc.add(cam); setPal(PAL_STORM); K.fallAudioStop();
  TP.x=SPAWN.x; TP.z=SPAWN.z; TP.acc=0; P.yaw=0; P.pitch=.05;
  document.body.classList.add('twalk','tmed'); $('#yearVal').textContent='AD 1350'; $('#year').classList.add('past'); $('#shiftBtn').textContent='Leave rift'; }
function arrive(){ enterMed(); S.mode='medEnter'; S.t=0; S.fade=1; fadeTo(1,0,'#000'); snd.thud(); R.sfx.shift();
  title('Temporal recovery · Rift 86','c. AD 1350','Middle Ages · a sheep farm in the north of England, the night a storm comes in');
  after(3,()=>{ untitle(); fadeTo(0,reduce?.6:2.4); S.mode='med'; S.t=0; });
  after(4.6,()=>{ if(S.mode==='med') objective('A farm','Someone lives here. The lamp is lit.'+(!R.touch()&&!R.locked()?'<br>Click to look around':'')); }); }
function frame(dt,inp){
  if(S.mode==='med') walk(dt,inp);
  const bob=reduce?0:Math.sin(TP.bob)*.03;
  cam.position.set(TP.x,ghM(TP.x,TP.z)+1.6+bob,TP.z); cam.rotation.set(P.pitch,P.yaw,0); cam.updateMatrixWorld();
  W.clouds.rotation.y+=dt*.004;
  W.rift.em.opacity=.3+Math.random()*.1; K.shimmer(W.rift,S.T,.4); W.riftL.intensity=.45+Math.sin(S.T*9)*.12;
  W.winL.intensity=1.05+Math.sin(S.T*7.3)*.05+Math.sin(S.T*13.1)*.04;   // firelight behind the glass
  K.render(W.sc); }
function key(k){ if(S.mode!=='med') return; if(k==='t') msg('Time will not shift here'); else if(k>='1'&&k<='5') msg('Your records stayed in 1986'); }
function click(){ if(S.mode==='med'&&!R.touch()&&!R.locked()) R.lock(); }
function exit(){ document.body.classList.remove('tmed'); }
const sty=document.createElement('style'); sty.textContent='body.tmed #tJump{display:none!important}'; document.head.appendChild(sty);

K.register('med',{arrive,frame,key,click,exit});
K.medDebug={get TP(){ return TP; },get W(){ return W; },ghM,blockedM,HOUSE,BARN,PEN,PORCH,DOOR,BARN_DOOR,PEN_GATE,RIDGE};
})(typeof window!=='undefined'?window:globalThis);
