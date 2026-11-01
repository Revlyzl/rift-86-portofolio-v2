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
const BOUND=31, RIDGE=38;   // the watcher stands just past where you can walk
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
  for(const s of [-1,1]) for(let z=29;z>13.5;z-=.9){   // stops short of the pen so its gate opens onto the lane
    const x=laneX(z)+s*rr(2.4,2.9), y=ghM(x,z), r=rr(.7,1.1);
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
  // the lightning's own light, moved to wherever each strike is
  const boltL=new THREE.DirectionalLight(0xd8e4f0,0); sc.add(boltL);
  W={sc,hemi,key,bolt:boltL,win,winL,rift,riftL,doorPivot,clouds,skyM,fogC:new THREE.Color(0x1b2630),fogF:new THREE.Color(0x7f98ad)};
  buildRain(sc);
}

/* ================= THE STORM =================
   Rain that follows the camera, wind, and lightning: the only real light. A strike is a double (or triple) pulse with
   an afterglow; with reduced motion it is one soft, dimmer swell and the tells it reveals are held longer (see HOLD).
   Anything that should only be seen by lightning subscribes with onFlash(fn). */
const ST={level:.6,hemi:.55,flash:0,since:99,pulses:[],next:5,az:0,big:false,hooks:[]};
const RAIN_N=1800, RAIN_R=15, RAIN_H=13, HOLD=reduce?.45:0;
const onFlash=fn=>ST.hooks.push(fn);
function setStorm(level){ ST.level=clamp(level,0,1); rainAudio(.25+ST.level*.55); }
let rain=null;
function buildRain(sc){ const pos=new Float32Array(RAIN_N*6), drops=[];
  for(let i=0;i<RAIN_N;i++) drops.push({x:rr(-RAIN_R,RAIN_R),y:rr(0,RAIN_H),z:rr(-RAIN_R,RAIN_R),v:rr(13,18)});
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(pos,3));
  const m=new THREE.LineBasicMaterial({color:0x7f98ad,transparent:true,opacity:.34,depthWrite:false});
  const l=new THREE.LineSegments(g,m); l.frustumCulled=false; sc.add(l); rain={l,g,m,pos,drops}; }
function rainFrame(dt){ const n=Math.round(RAIN_N*(.3+.7*ST.level)), wx=-.22-.25*ST.level, wz=.08, len=.45+.35*ST.level, p=rain.pos;
  rain.l.position.set(cam.position.x,cam.position.y-RAIN_H*.55,cam.position.z); rain.g.setDrawRange(0,n*2);
  for(let i=0;i<n;i++){ const d=rain.drops[i]; d.y-=d.v*dt; d.x+=wx*d.v*dt*.25; d.z+=wz*d.v*dt*.25;
    if(d.y<0){ d.y+=RAIN_H; d.x=rr(-RAIN_R,RAIN_R); d.z=rr(-RAIN_R,RAIN_R); }
    if(d.x<-RAIN_R) d.x+=RAIN_R*2; if(d.z>RAIN_R) d.z-=RAIN_R*2;
    const o=i*6; p[o]=d.x; p[o+1]=d.y; p[o+2]=d.z; p[o+3]=d.x-wx*len; p[o+4]=d.y+len; p[o+5]=d.z-wz*len; }
  rain.g.attributes.position.needsUpdate=true; rain.m.opacity=.3+ST.flash*.5; }

let bolt=null;
function boltGeo(){ const pts=[]; let x=0,y=70,z=0; while(y>0){ const nx=x+rr(-4,4), ny=y-rr(4,9), nz=z+rr(-2,2); pts.push(x,y,z,nx,Math.max(0,ny),nz);
    if(rnd()<.25){ const bx=nx+rr(-8,8), by=ny-rr(5,12); pts.push(nx,ny,nz,bx,Math.max(0,by),nz+rr(-3,3)); } x=nx; y=ny; z=nz; }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pts,3)); return g; }
function strike(force){ const big=force||rnd()<(.35+.3*ST.level); ST.big=big; ST.since=0; ST.az=rnd()*6.283;
  const pk=(big?1:.6)*(reduce?.4:1);
  ST.pulses=reduce?[{at:0,peak:pk,dur:.9,soft:true}]:
    [{at:0,peak:pk,dur:.09},{at:rr(.11,.18),peak:pk*rr(.6,.9),dur:.08}].concat(big&&rnd()<.6?[{at:rr(.3,.45),peak:pk*rr(.4,.7),dur:.12}]:[]);
  const dist=big?rr(.2,1.2):rr(1.2,3);   // km, roughly: close strikes are the big ones
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
function stormFrame(dt){ ST.since+=dt; ST.next-=dt;
  if(ST.next<=0){ strike(); ST.next=lerp(17,5,ST.level)*rr(.6,1.4); }
  const f=flashAt(ST.since); ST.flash=f;
  W.hemi.intensity=ST.hemi+f*2.6; W.bolt.intensity=f*2.2; W.key.intensity=.35*(1-f*.5);
  W.skyM.material.color.setScalar(1+f*3); W.clouds.material.opacity=1-f*.4;
  W.sc.fog.color.copy(W.fogC).lerp(W.fogF,clamp(f,0,1)); W.sc.background.copy(W.sc.fog.color);
  if(bolt) bolt.visible=ST.big&&f>.25;
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
  if(!blockedM(TP.x+vx,TP.z)) TP.x+=vx; if(!blockedM(TP.x,TP.z+vz)) TP.z+=vz;
  TP.bob+=dt*(inp.run?10:7.5); TP.acc+=Math.hypot(vx,vz); if(TP.acc>(inp.run?1:.8)){ TP.acc=0; snd.step(); } }

/* ================= THE ANIMALS =================
   The dog: an ordinary farm dog, lit like everything else. The sheep: a small flock that keeps to wherever it is put
   and shies from the dog (always; the first tell anyone can see). The thing on the ridge: no surface at all, a flat
   black cut-out with two pale eyes, untouched by fog or light. It watches the dog, never the player (rule 3). */
const {tbox,part,grp,hang}=K;
const SPOTS={   // where each animal goes for the night; `in` = inside a building (hidden), `door` = where it walks to first
  dog:{pen:{x:PEN_GATE.x-1.3,z:PEN_GATE.z+.6},porch:{x:PORCH.x+.3,z:PORCH.z+.4},house:{x:HOUSE.x,z:HOUSE.z,in:true,door:{x:DOOR.x+.6,z:DOOR.z}},barn:{x:BARN.x,z:BARN.z+2,in:true,door:{x:BARN_DOOR.x-.7,z:BARN_DOOR.z}}},
  flock:{pen:{x:PEN.x,z:PEN.z,w:PEN.w-1.2,d:PEN.d-1.2},barn:{x:BARN.x,z:BARN.z-1.5,w:BARN.w-2,d:3,in:true}}
};
const sndM={
  bark(pan,v){ const a=K.A(); if(!a) return; const d=K.pout(pan,v), t=a.ac.currentTime; for(const o of [0,.2]){ a.tone(t+o,'sawtooth',560,250,.22,.004,.11,d); a.noise(t+o,.1,'bandpass',950,1.4,.28,.09,d); } },
  growl(pan,v){ const a=K.A(); if(!a) return; const d=K.pout(pan,v), t=a.ac.currentTime; a.tone(t,'sawtooth',118,96,.1,.25,1.1,d); a.tone(t,'square',59,50,.05,.25,1.1,d); a.noise(t,1.3,'lowpass',380,.9,.18,1,d); },
  bleat(pan,v){ const a=K.A(); if(!a) return; const d=K.pout(pan,v), t=a.ac.currentTime, f=rr(300,380);
    for(let i=0;i<7;i++) a.tone(t+i*.055,'sawtooth',f-i*3,f-i*3-6,.05,.008,.07,d); a.noise(t,.4,'bandpass',1300,2,.05,.35,d); }
};
// pale, steady eyes for the watcher (the dog's, when they show, are the red almonds from the Cretaceous)
const paleEye=tex(16,16,(g,w,h)=>{ const gr=g.createRadialGradient(8,8,0,8,8,8); gr.addColorStop(0,'#fff3d0'); gr.addColorStop(.35,'#e3ecf1'); gr.addColorStop(.6,'rgba(185,200,211,.35)'); gr.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle=gr; g.fillRect(0,0,w,h); });
paleEye.minFilter=THREE.LinearFilter;

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
  return {fur,pale,root,body,neck,head,jaw,ears,eyes,eyeS,tail,legs,x:0,z:0,h:0,tx:0,tz:0,spd:0,ph:0,sit:0,st:'follow',spot:null,inside:false,lookAt:null,growlT:3,wag:0}; }

function makeWolf(){ const blk=new THREE.MeshBasicMaterial({color:0x000000,fog:false});
  const root=new THREE.Group(), body=grp(root,0,1.02,0);
  part(tbox(.34,.4,1.0,.75,1),blk,body,0,0,0); part(tbox(.38,.34,.3,1,.9),blk,body,0,-.04,.36);   // deep chest, ruff at the shoulders
  const neck=grp(body,0,.12,.42,-1.05); part(tbox(.17,.2,.5,1,.8,.25),blk,neck,0,0,0);
  const head=grp(neck,0,0,.5,1.05); part(new THREE.BoxGeometry(.24,.22,.24),blk,head,0,0,0); part(tbox(.11,.09,.34,1,.55,.17),blk,head,0,-.04,.14);
  for(const s of [-1,1]) part(new THREE.ConeGeometry(.06,.36,4),blk,head,s*.085,.26,-.05,-.08,0,s*.16);   // too tall
  const eyes=[-1,1].map(s=>{ const e=new THREE.Sprite(new THREE.SpriteMaterial({map:paleEye,transparent:true,depthWrite:false,fog:false,sizeAttenuation:false}));
    e.position.set(s*.065,.075,.16); e.scale.set(.016,.016,1); e.renderOrder=3; head.add(e); return e; });
  const tail=grp(body,0,.05,-.48,2.85); part(hang(.08,.72,.08),blk,tail,0,0,0);
  for(const [sx,sz] of [[-1,1],[1,1],[-1,-1],[1,-1]]){ const g=grp(body,sx*.12,-.08,sz*.38,0,0,-sx*.04); part(hang(.065,.98,.065),blk,g,0,0,0); }   // long, thin, set wide
  root.scale.setScalar(1.45); root.visible=false;
  return {root,head,neck,eyes,x:0,z:0,st:'off',lookT:0,gone:false,back:0}; }

function makeSheep(i){ const wool=new THREE.MeshPhongMaterial({color:0x9aa8b2,flatShading:true,shininess:2}), face=new THREE.MeshPhongMaterial({color:0x0b1016,flatShading:true});
  const root=new THREE.Group(), body=grp(root,0,.55,0);
  part(new THREE.IcosahedronGeometry(1,1),wool,body,0,0,0).scale.set(.38,.34,.52);
  const head=grp(body,0,.08,.5); part(tbox(.16,.18,.26,1,.8,.1),face,head,0,0,0); for(const s of [-1,1]) part(new THREE.BoxGeometry(.12,.04,.05),face,head,s*.11,.05,-.02);
  const legs=[[-1,1],[1,1],[-1,-1],[1,-1]].map(([sx,sz],j)=>{ const g=grp(body,sx*.17,-.2,sz*.28); part(hang(.06,.38,.06),face,g,0,0,0); return {g,o:(j===0||j===3)?0:Math.PI}; });
  return {i,root,body,head,legs,x:0,z:0,h:rnd()*6,tx:0,tz:0,spd:0,ph:rnd()*6,graze:rnd()*4,alive:true,bleatT:rr(4,20)}; }

let dog=null, wolf=null; const FLOCK=[];
const NT={wolf:false,dog:'porch',flock:'pen'};   // what tonight looks like (set by the night loop; step 6)
function buildAnimals(){ dog=makeDog(); W.sc.add(dog.root); wolf=makeWolf(); W.sc.add(wolf.root);
  for(let i=0;i<7;i++){ const s=makeSheep(i); W.sc.add(s.root); FLOCK.push(s); } }

// steering: head for (tx,tz), slide along anything solid
function steer(a,dt,spd,r){ const dx=a.tx-a.x, dz=a.tz-a.z, d=Math.hypot(dx,dz); if(d<.15){ a.spd=lerp(a.spd,0,1-Math.exp(-dt*8)); return d; }
  a.spd=lerp(a.spd,Math.min(spd,d*1.6),1-Math.exp(-dt*4)); const want=Math.atan2(dx,dz); a.h=K.angLerp(a.h,want,1-Math.exp(-dt*7));
  const vx=Math.sin(a.h)*a.spd*dt, vz=Math.cos(a.h)*a.spd*dt;
  if(!blockedM(a.x+vx,a.z+vz,r)){ a.x+=vx; a.z+=vz; }
  else if(!blockedM(a.x+vx,a.z,r)) a.x+=vx; else if(!blockedM(a.x,a.z+vz,r)) a.z+=vz;
  else { a.h+=1.2; }                                                     // stuck on a corner: turn and try again
  return d; }

function placeFlock(n,where){ const S_=SPOTS.flock[where]; NT.flock=where; let k=0;
  for(const s of FLOCK){ s.alive=k<n; s.root.visible=s.alive&&!S_.in; k++; if(!s.alive) continue;
    s.x=S_.x+rr(-S_.w/2,S_.w/2); s.z=S_.z+rr(-S_.d/2,S_.d/2); s.tx=s.x; s.tz=s.z; } }
function sendDog(where){ const sp=SPOTS.dog[where]; NT.dog=where; dog.spot=sp; dog.st='goto'; dog.inside=false; dog.root.visible=true; }
function dogFollow(){ dog.st='follow'; dog.spot=null; dog.inside=false; dog.root.visible=true; }

function dogFrame(dt){ const d=dog;
  if(d.st==='follow'){ const bx=TP.x+Math.sin(P.yaw)*2.2, bz=TP.z+Math.cos(P.yaw)*2.2; if(Math.hypot(bx-d.x,bz-d.z)>1.6){ d.tx=bx; d.tz=bz; }
    steer(d,dt,Math.hypot(TP.x-d.x,TP.z-d.z)>5?4.2:2.1,.3); }
  else if(d.st==='goto'){ const sp=d.spot, tgt=sp.in?sp.door:sp; d.tx=tgt.x; d.tz=tgt.z;
    if(steer(d,dt,3.2,.3)<.35){ if(sp.in){ d.inside=true; d.root.visible=false; d.x=sp.x; d.z=sp.z; } d.st='stay'; } }
  else if(d.st==='stay'&&!d.inside){ d.spd=lerp(d.spd,0,1-Math.exp(-dt*6)); }
  // it reacts to the watcher: turns to it and growls, low, but never goes toward it
  d.lookAt=null;
  if(wolf.root.visible&&!d.inside){ d.lookAt=wolf; if(d.st==='stay'){ d.h=K.angLerp(d.h,Math.atan2(wolf.x-d.x,wolf.z-d.z),1-Math.exp(-dt*2)); }
    d.growlT-=dt; if(d.growlT<=0){ d.growlT=rr(4,8); const dd=Math.hypot(d.x-TP.x,d.z-TP.z); sndM.growl(K.panOf(d.x,d.z),K.vol(dd,.9)); if(rnd()<.25) setTimeout(()=>sndM.bark(K.panOf(d.x,d.z),K.vol(dd,1)),900); } }
  // pose: trot, sit when settled, tail, head toward what it is looking at
  const m=clamp(d.spd/3,0,1); d.ph+=dt*(4+d.spd*3.2); d.sit=lerp(d.sit,d.st==='stay'&&d.spd<.2&&!d.lookAt?1:0,1-Math.exp(-dt*3));
  d.root.position.set(d.x,ghM(d.x,d.z),d.z); d.root.rotation.y=d.h;
  for(const L of d.legs) L.g.rotation.x=Math.sin(d.ph+L.o)*.7*m;
  d.body.rotation.x=-d.sit*.45; d.body.position.y=.5-d.sit*.12; d.legs[2].g.rotation.x+=d.sit*1.2; d.legs[3].g.rotation.x+=d.sit*1.2;
  d.wag+=dt*(d.lookAt?2:9); d.tail.rotation.z=Math.sin(d.wag)*(d.lookAt?.08:.4); d.tail.rotation.x=d.lookAt?2.7:2.3;
  let hy=0; if(d.lookAt){ hy=clamp(K.angLerp(0,Math.atan2(d.lookAt.x-d.x,d.lookAt.z-d.z)-d.h,1),-1,1); }
  else if(d.st==='follow'){ hy=clamp(K.angLerp(0,Math.atan2(TP.x-d.x,TP.z-d.z)-d.h,1),-1,1)*.6; }
  d.head.rotation.y=lerp(d.head.rotation.y,hy,1-Math.exp(-dt*5)); d.jaw.rotation.x=d.lookAt?.12+Math.sin(S.T*30)*.03:0; }

function flockFrame(dt){ const where=SPOTS.flock[NT.flock];
  for(const s of FLOCK){ if(!s.alive) continue; if(where.in){ s.root.visible=false; continue; }
    // shy from the dog: any sheep it comes near edges away to the far side of the pen
    const dd=dog.root.visible?Math.hypot(dog.x-s.x,dog.z-s.z):99;
    if(dd<3.6){ const ax=(s.x-dog.x)/(dd||1), az=(s.z-dog.z)/(dd||1); s.tx=clamp(s.x+ax*2,where.x-where.w/2,where.x+where.w/2); s.tz=clamp(s.z+az*2,where.z-where.d/2,where.z+where.d/2); }
    else { s.graze-=dt; if(s.graze<=0){ s.graze=rr(3,9); s.tx=where.x+rr(-where.w/2,where.w/2); s.tz=where.z+rr(-where.d/2,where.d/2); } }
    const run=dd<3.6; steer(s,dt,run?1.6:.5,.25);
    s.bleatT-=dt; if(s.bleatT<=0){ s.bleatT=rr(8,25)*(run?.3:1); const d=Math.hypot(s.x-TP.x,s.z-TP.z); if(d<30) sndM.bleat(K.panOf(s.x,s.z),K.vol(d,.7)); }
    s.ph+=dt*(3+s.spd*6); const m=clamp(s.spd/1.2,0,1);
    s.root.position.set(s.x,ghM(s.x,s.z),s.z); s.root.rotation.y=s.h; for(const L of s.legs) L.g.rotation.x=Math.sin(s.ph+L.o)*.5*m;
    s.head.rotation.x=lerp(s.head.rotation.x,m<.1?.7:0,1-Math.exp(-dt*2)); } }

// the watcher: stands far out on the ridge on the side facing the dog, turns its head to follow the dog wherever it goes,
// and is gone at the next flash once you come near or stare at it too long; later it may stand somewhere else
function wolfPlace(){ const a=Math.atan2(dog.z,dog.x)+rr(-.3,.3), r=rr(RIDGE-2,RIDGE+3);
  wolf.x=Math.cos(a)*r; wolf.z=Math.sin(a)*r; wolf.root.position.set(wolf.x,ghM(wolf.x,wolf.z),wolf.z);
  wolf.root.rotation.y=Math.atan2(-wolf.x,-wolf.z); wolf.root.visible=true; wolf.st='watch'; wolf.lookT=0; }
function wolfShow(on){ NT.wolf=on; if(on){ wolfPlace(); wolf.back=0; } else { wolf.root.visible=false; wolf.st='off'; } }
onFlash(()=>{ if(wolf&&wolf.st==='leaving'){ wolf.root.visible=false; wolf.st='gone'; wolf.back=rr(25,45); } });
function wolfFrame(dt){ if(!NT.wolf) return;
  if(wolf.st==='gone'){ wolf.back-=dt; if(wolf.back<=0) wolfPlace(); return; }
  if(wolf.st!=='watch'&&wolf.st!=='leaving') return;
  // rule 3: the head follows the dog (or the building the dog is shut in)
  const hy=Math.atan2(dog.x-wolf.x,dog.z-wolf.z)-wolf.root.rotation.y; wolf.head.parent.rotation.y=clamp(K.angLerp(0,hy,1),-1.1,1.1);
  const near=Math.hypot(TP.x-wolf.x,TP.z-wolf.z)<18;
  const stared=K.onScreen(wolf.x,ghM(wolf.x,wolf.z)+1.4,wolf.z,.35); wolf.lookT=stared?wolf.lookT+dt:Math.max(0,wolf.lookT-dt*.5);
  if(wolf.st==='watch'&&(near||wolf.lookT>3)) wolf.st='leaving'; }

/* ================= DUSK · NIGHT · DAWN =================
   The loop around the rules. Dusk: walk the farm, feed the dog if you like, choose where everything sleeps.
   Night: the rules have already decided (RULES.night) and the world plays it out: the watcher if it is a wolf night,
   the dog slipping away if it hunts, a sheep lost in the dark. Dawn: what is left. Five nights, never counted aloud. */
const BAIT={x:PEN.x-PEN.w/2-1.1,z:PEN.z-PEN.d/2-1.2}, BOWL={x:PORCH.x+.55,z:PORCH.z-.75};
const NIGHT_LEN=75;
const L={M:null,phase:null,t:0,d:null,ev:null,ch:{dog:'porch',flock:'pen',watch:'none',bait:false},hunt:null,fed:null,ending:null};
const LABEL={dog:{pen:'Sleeps by the pen',porch:'Sleeps on the porch',house:'Sleeps in the house',barn:'Chained in the barn'},
  flock:{pen:'In the pen',barn:'Shut in the barn'},
  watch:{none:'Sleep',dog:'Keep watch on the dog',ridge:'Keep watch on the ridge'},
  bait:{false:'None set',true:'Wolfsbane, by the pen'}};
const ROWS=[['dog','The dog'],['flock','The sheep'],['watch','Tonight'],['bait','Bait']];
const OPTS={dog:RULES.DOG_SPOTS,flock:RULES.SHEEP_SPOTS,watch:['none','dog','ridge'],bait:[false,true]};
const objEl=()=>$('#tObj');

// the dusk panel: four rows, each cycles on click or its number key; Enter lets night fall
const panel=K.el('div','mPanel','tui'); panel.hidden=true;
const pRows=ROWS.map(([k,name],i)=>{ const b=document.createElement('button'); b.type='button'; b.className='pbtn mrow';
  b.addEventListener('click',()=>cycle(k)); panel.appendChild(b); return {k,name,i,b}; });
const pWarn=document.createElement('div'); pWarn.className='mwarn'; panel.appendChild(pWarn);
// one context button for what you can do right now (feed, go to bed, wait for dusk): keys on desktop, this on touch
const act=K.el('button','mAct','pbtn'); act.type='button'; act.hidden=true;
act.addEventListener('click',()=>{ const d=act.dataset.do; if(d==='feed') feed(); else if(d==='bed') endNight(); else if(d==='dusk') toDusk(); });
function drawAct(){ let d='',t='';
  if(S.mode==='med'){ if(L.phase==='dusk'&&!dog.dead&&!L.fed&&Math.hypot(TP.x-BOWL.x,TP.z-BOWL.z)<2.4){ d='feed'; t='Feed the dog'+(R.touch()?'':' (E)'); }
    else if(L.phase==='night'){ d='bed'; t='Go to bed'+(R.touch()?'':' (Enter)'); }
    else if(L.phase==='dawn'&&!L.M.over){ d='dusk'; t='Wait for dusk'+(R.touch()?'':' (Enter)'); } }
  if(act.dataset.do!==d){ act.dataset.do=d; act.textContent=t; } act.hidden=!d; }
function toDusk(){ if(L.phase!=='dawn'||L.M.over) return; L.phase='dusk-in'; veil(startDusk,.4); }
const pGo=document.createElement('button'); pGo.type='button'; pGo.className='pbtn hot mgo'; pGo.addEventListener('click',()=>startNight()); panel.appendChild(pGo);
function drawPanel(){ const M=L.M;
  for(const r of pRows){ let v=LABEL[r.k][String(L.ch[r.k])]; if(r.k==='watch'&&L.ch.watch!=='none') v+=` · oil for ${M.oil} night${M.oil===1?'':'s'}`;
    r.b.innerHTML=`<small>${R.touch()?'':(r.i+1)+' · '}${r.name}</small>${v}`; }
  pWarn.textContent=L.ch.bait?'Wolfsbane bait. It will kill any animal that eats it. Keep your dog away.':'';
  pGo.textContent=R.touch()?'Let night fall':'Let night fall (Enter)'; }
function cycle(k){ if(L.phase!=='dusk') return; const o=OPTS[k]; let n=(o.indexOf(L.ch[k])+1)%o.length;
  if(k==='watch'&&L.M.oil<=0){ n=0; msg('No lamp oil left'); }
  if(k==='bait'&&!L.M.baitOwned) n=0;
  L.ch[k]=o[n]; R.sfx.ui(); drawPanel(); }

// carcasses: a dead sheep stays where it fell (on its side, a stain under it); a kill in the barn is dragged out to the door
const stainM=new THREE.MeshBasicMaterial({color:0x2a0805,transparent:true,opacity:.85,depthWrite:false});
function killSheep(n){ const where=SPOTS.flock[L.M.flock], alive=FLOCK.filter(s=>s.alive);
  alive.sort((a,b)=>Math.hypot(b.x-TP.x,b.z-TP.z)-Math.hypot(a.x-TP.x,a.z-TP.z));   // the ones furthest from you
  for(const s of alive.slice(0,n)){ s.alive=false; s.carcass=true;
    if(where.in){ s.x=BARN_DOOR.x-1.2+rr(-.4,.4); s.z=BARN_DOOR.z+rr(-1.4,1.4); }
    s.root.visible=!where.in; layCarcass(s);
    const d=Math.hypot(s.x-TP.x,s.z-TP.z); if(d<45){ sndM.bleat(K.panOf(s.x,s.z),K.vol(d,1.1)); setTimeout(()=>sndM.growl(K.panOf(s.x,s.z),K.vol(d,.7)),350); } } }
function layCarcass(s){ s.root.position.set(s.x,ghM(s.x,s.z)+.05,s.z); s.root.rotation.set(0,s.h,Math.PI/2); s.body.position.y=.3;
  if(!s.stain){ s.stain=new THREE.Mesh(new THREE.CircleGeometry(.7,10),stainM); s.stain.rotation.x=-Math.PI/2; W.sc.add(s.stain); }
  s.stain.position.set(s.x,ghM(s.x,s.z)+.06,s.z); s.stain.visible=s.root.visible; }
function clearCarcasses(){ for(const s of FLOCK){ s.carcass=false; s.body.position.y=.55; s.root.rotation.set(0,s.h,0); if(s.stain) s.stain.visible=false; } }
function showCarcasses(){ for(const s of FLOCK) if(s.carcass){ s.root.visible=true; layCarcass(s); } }

let bowl=null, bowlFood=null, baitM=null, lantern=null;
function buildProps(){ const wood=new THREE.MeshPhongMaterial({color:0x2e251c,flatShading:true}), food=new THREE.MeshPhongMaterial({color:0x6b4a2a,flatShading:true});
  bowl=new THREE.Mesh(new THREE.CylinderGeometry(.2,.15,.1,8),wood); bowl.position.set(BOWL.x,ghM(BOWL.x,BOWL.z)+.05,BOWL.z); W.sc.add(bowl);
  bowlFood=new THREE.Mesh(new THREE.CylinderGeometry(.16,.16,.04,8),food); bowlFood.position.set(BOWL.x,bowl.position.y+.05,BOWL.z); W.sc.add(bowlFood);
  baitM=new THREE.Mesh(new THREE.DodecahedronGeometry(.18,0),new THREE.MeshPhongMaterial({color:0x6e1a12,flatShading:true})); baitM.position.set(BAIT.x,ghM(BAIT.x,BAIT.z)+.12,BAIT.z); baitM.scale.set(1.4,.6,1); W.sc.add(baitM);
  lantern=new THREE.PointLight(0xffa040,0,10,2); lantern.position.set(.25,-.35,-.3); cam.add(lantern); }

// light and weather by phase
function phaseLight(ph){ const heavy=L.d&&L.d.rain==='heavy';
  if(ph==='dawn'){ ST.hemi=1.0; W.fogC.setHex(0x34465a); setStorm(.15); }
  else { ST.hemi=ph==='night'?.38:.6; W.fogC.setHex(ph==='night'?0x121a22:0x1b2630); setStorm(heavy?1:.45); }
  lantern.intensity=ph==='night'&&L.ch.watch!=='none'?1.2:0; }

function veil(fn,hold){ fadeTo(1,.8,'#000'); after(.85,()=>{ fn(); after(hold||.3,()=>fadeTo(0,reduce?.6:1.4)); }); }

function newRun(){ const q=new URLSearchParams(location.search).get('seed'); L.M=RULES.newRun(q?+q:(Date.now()%1e9)); L.ending=null;
  L.ch={dog:'porch',flock:'pen',watch:'none',bait:false}; clearCarcasses(); placeFlock(L.M.sheep,'pen');
  dog.dead=false; dog.away=false; dog.root.rotation.set(0,0,0); dog.legs[0].g.scale.y=dog.legs[1].g.scale.y=1; barnReset(); dog.x=SPAWN.x+1; dog.z=SPAWN.z-2.5; dog.h=Math.PI; dogFollow(); wolfShow(false); baitM.visible=false; }

function startDusk(){ const M=L.M; clearCarcasses(); clearTells();
  L.d=RULES.dusk(M); L.phase='dusk'; L.t=0; L.fed=null; bowlFood.visible=true; L.ch.bait=L.ch.bait&&M.baitOwned; if(M.oil<=0) L.ch.watch='none';
  placeFlock(M.sheep,'pen'); if(!dog.dead) dogFollow();
  wolfShow(false); phaseLight('dusk'); baitM.visible=false; panel.hidden=false; drawPanel(); duskObjective(); }
function duskObjective(){ const n=L.M.sheep, near=Math.hypot(TP.x-BOWL.x,TP.z-BOWL.z)<2.4&&!dog.dead&&!L.fed;
  objective('Dusk',`${n} sheep. The storm is coming in${L.d.rain==='heavy'?' hard':''}.`); }
function feed(){ if(L.phase!=='dusk'||dog.dead||L.fed) return; if(Math.hypot(TP.x-BOWL.x,TP.z-BOWL.z)>2.4) return;
  L.fed=L.d.refusesFood?'refused':'ate'; R.sfx.ui();
  if(L.fed==='ate'){ msg('It eats'); bowlFood.visible=false; } else msg('It sniffs the bowl and turns away'); duskObjective(); }

function startNight(){ if(L.phase!=='dusk') return; panel.hidden=true; objEl().classList.remove('on'); L.phase='night-in';
  veil(()=>{ const M=L.M; RULES.choose(M,L.ch); L.ev=RULES.night(M); L.phase='night'; L.t=0;
    placeFlock(M.sheep,L.ch.flock); sendDog(L.ch.dog); const sp=SPOTS.dog[L.ch.dog]; dog.x=sp.x; dog.z=sp.z; dog.st='stay';
    if(sp.in){ dog.inside=true; dog.root.visible=false; }
    baitM.visible=L.ch.bait; phaseLight('night');
    if(M.wolfNight||dog.dead) after(rr(4,12),()=>{ if(L.phase==='night'&&!BS.on) wolfShow(true); });   // after the dog is gone it still comes: it was never the killer
    if(L.ev.barnScene) barnArm();
    const ev=L.ev; L.hunt=(ev.kills||ev.dogDied)?{at:rr(22,40),st:'wait',t:0}:null; pickTells();
    if(TP.z>14){ TP.x=PORCH.x+2; TP.z=PORCH.z+1.5; P.yaw=-Math.PI/2; } },.6); }

// the hunt: the dog slips away once you are not looking (or soon after anyway), then the flock pays
function huntFrame(dt){ const h=L.hunt; if(!h) return; h.t+=dt; const ev=L.ev;
  if(h.st==='wait'&&L.t>=h.at){ const seen=!dog.inside&&dog.root.visible&&Math.hypot(dog.x-TP.x,dog.z-TP.z)<25&&K.onScreen(dog.x,ghM(dog.x,dog.z)+.5,dog.z,.9);
    if(!seen||L.t>h.at+12){ h.st='away'; h.t=0; dog.root.visible=false; dog.away=true; } }
  else if(h.st==='away'&&h.t>3){ h.st='done'; h.t=0;
    if(ev.dogDied) dogDies(); else { killSheep(ev.kills); if(ev.playerDead) after(3.5,death); } }
  else if(h.st==='done'&&!ev.dogDied&&!ev.playerDead&&h.t>9&&dog.away){ dog.away=false; if(!dog.inside) dog.root.visible=true; } }
function dogDies(){ baitM.visible=false; dog.legs[0].g.scale.y=dog.legs[1].g.scale.y=1.5;   // forelegs too long, if you look
  dog.dead=true; dog.away=false; dog.st='dead'; dog.x=BAIT.x+.6; dog.z=BAIT.z; dog.inside=false;
  dog.root.position.set(dog.x,ghM(dog.x,dog.z)+.12,dog.z); dog.root.rotation.set(0,dog.h,Math.PI/2); dog.body.rotation.x=0; dog.body.position.y=.3; dog.root.visible=true; }
function resolveNow(){ const h=L.hunt; if(!h||h.st==='done') return; const ev=L.ev;   // you went to bed: it happens in the dark
  h.st='done'; h.t=99; dog.away=false;
  if(ev.dogDied) dogDies(); else killSheep(ev.kills); }

function endNight(){ if(L.phase!=='night') return; L.phase='night-out';
  if(L.ev.playerDead){ resolveNow(); death(); return; }
  veil(()=>{ resolveNow(); startDawn(); },1.2); }

function startDawn(){ const M=L.M; L.phase='dawn'; L.t=0; wolfShow(false); barnReset(); phaseLight('dawn'); showCarcasses(); T7.gone=false;
  if(!dog.dead){ dog.away=false; const sp=SPOTS.dog[L.ch.dog]; if(sp.in){ dog.x=sp.door.x; dog.z=sp.door.z; } dogFollow(); }
  bowlFood.visible=L.fed!=='ate'; dawnTells();
  if(M.over){ L.ending=RULES.ending(M); riftOpen=true; if(L.ending==='true') after(2,()=>{ if(L.phase==='dawn') wolfShow(true); }); objective('Dawn',`${M.sheep} sheep. The storm has blown itself out.<br>The rift has opened behind you, at the end of the lane.`); }
  else objective('Dawn',`${M.sheep} sheep.`); }

let riftOpen=false;
function death(){ if(S.mode!=='med') return; S.mode='medDead'; L.phase='dead'; L.ending='death'; panel.hidden=true; act.hidden=true; objEl().classList.remove('on');
  S.fade=1; fadeTo(1,0,'#000'); rainAudio(.15);
  const pan=dog.dead?0:K.panOf(dog.x,dog.z);
  after(.8,()=>sndM.growl(pan,1)); after(2.4,()=>sndM.growl(pan*.6,1)); after(3.6,()=>sndM.howl(K.panOf(wolf.x||30,wolf.z||-30),.4));
  after(7,()=>K.leave()); }
sndM.howl=(pan,v)=>{ const a=K.A(); if(!a) return; const d=K.pout(pan,v), t=a.ac.currentTime; const lp=a.ac.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=1400; lp.connect(d);
  const o=a.ac.createOscillator(), g=a.ac.createGain(); o.type='triangle'; o.frequency.setValueAtTime(330,t); o.frequency.linearRampToValueAtTime(520,t+.8); o.frequency.linearRampToValueAtTime(500,t+2.2); o.frequency.linearRampToValueAtTime(380,t+3.2);
  g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(.18,t+.5); g.gain.setValueAtTime(.18,t+2.4); g.gain.linearRampToValueAtTime(0,t+3.3); o.connect(g).connect(lp); o.start(t); o.stop(t+3.4); };

function loopFrame(dt){ L.t+=dt;
  if(S.frame%10===0) drawAct();
  if(L.phase==='night'){ huntFrame(dt); if(L.t>NIGHT_LEN) endNight(); }
  if(riftOpen){ W.rift.g.scale.x=lerp(W.rift.g.scale.x,1,dt*2); W.rift.g.scale.y=lerp(W.rift.g.scale.y,1,dt*2); if(Math.hypot(TP.x-RIFTP.x,TP.z-RIFTP.z)<1.6) endScene(); } }

/* ================= TELLS =================
   Small wrong things, each one deniable. Only ever shown on a wolf night (they never lie), one or two a night, drawn
   at random from the pool so no two runs show the same ones. Most need lightning to be seen. At least one a night
   works in any weather; the paw prints only survive light rain. Always on, outside the pool: the sheep shy from the
   dog, the watcher's head follows the dog, the bowl it will not touch. */
const TELLS={
  silhouette:{flash:true,  ok:()=>dogOut()},                         // for one flash it sits up like a person, too tall
  redEyes:   {flash:true,  ok:()=>dogOut()},                         // its eyes catch the light red; the watcher's never do
  gone:      {flash:true,  ok:()=>dogOut()&&!L.hunt},                // not in its place in one flash, back in the next
  lateBark:  {flash:false, ok:()=>dogOut()},                         // it barks at the ridge; the last bark comes after its mouth has shut
  closer:    {flash:true,  ok:()=>dogOut()&&L.M.night>=4},           // late on: the watcher, near, standing between you and the dog
  wetFur:    {dawn:true,   ok:()=>SPOTS.dog[L.ch.dog].in&&L.ev.kills>0},   // it slept indoors, and it is soaked
  prints:    {dawn:true,rain:true, ok:()=>L.ev.kills>0&&L.d.rain==='light'}  // its tracks, from where it slept to what is left
};
const T7={list:[],flashQ:[],gone:false,closer:null,barkT:-1,drips:null,prints:[]};
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
  if(T7.gone){ T7.gone=false; if(!dog.away&&!dog.inside&&!dog.dead) dog.root.visible=true; return; }
  const seeDog=dog.root.visible&&!dog.away&&Math.hypot(dog.x-TP.x,dog.z-TP.z)<30&&K.onScreen(dog.x,ghM(dog.x,dog.z)+.5,dog.z,.95);
  for(const q of T7.flashQ){ if(q.done||L.t<q.after) continue; if(!seeDog&&q.k!=='closer') continue;
    q.done=true;
    if(q.k==='silhouette') dog.wrongT=.09+HOLD;
    else if(q.k==='redEyes') dog.redT=.3+HOLD;
    else if(q.k==='gone'){ dog.root.visible=false; T7.gone=true; }
    else if(q.k==='closer'&&wolf.root.visible){ const k=.55; T7.closer={x:wolf.x,z:wolf.z,t:.25+HOLD};
      wolf.root.position.set(dog.x+(TP.x-dog.x)*k,ghM(dog.x+(TP.x-dog.x)*k,dog.z+(TP.z-dog.z)*k),dog.z+(TP.z-dog.z)*k);
      wolf.root.rotation.y=Math.atan2(dog.x-wolf.root.position.x,dog.z-wolf.root.position.z); }   // its back to you: it is looking at the dog
    break; } });

function tellFrame(dt){ const d=dog;
  if(d.wrongT>0){ d.wrongT-=dt;                                      // sat up on its haunches like a man, forelegs hanging, head bowed
    d.body.rotation.x=-1.35; d.body.position.y=.95; d.neck.rotation.x=.2; d.head.rotation.x=.9;
    d.legs[0].g.rotation.x=.25; d.legs[1].g.rotation.x=.25; d.legs[0].g.scale.y=d.legs[1].g.scale.y=1.7; d.legs[2].g.rotation.x=1.3; d.legs[3].g.rotation.x=1.3; }
  else if(d.legs[0].g.scale.y!==1){ d.legs[0].g.scale.y=d.legs[1].g.scale.y=1; d.neck.rotation.x=-.65; d.head.rotation.x=.65; }
  const red=d.redT>0; if(red) d.redT-=dt; for(const e of d.eyeS) e.visible=red;
  if(T7.closer){ T7.closer.t-=dt; if(T7.closer.t<=0&&ST.flash<.05){ wolf.x=T7.closer.x; wolf.z=T7.closer.z; wolf.root.position.set(wolf.x,ghM(wolf.x,wolf.z),wolf.z); wolf.root.rotation.y=Math.atan2(-wolf.x,-wolf.z); T7.closer=null; } }
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
  if(k==='prints'){ const c=FLOCK.find(s=>s.carcass); if(!c) continue; const from=SPOTS.dog[L.ch.dog], fx=from.in?from.door.x:from.x, fz=from.in?from.door.z:from.z;
    const L_=Math.hypot(c.x-fx,c.z-fz), a=Math.atan2(c.x-fx,c.z-fz), n=Math.floor(L_/.42);
    for(let i=1;i<n;i++){ const t=i/n, sd=(i%2?1:-1)*.09, x=fx+(c.x-fx)*t+Math.cos(a)*sd, z=fz+(c.z-fz)*t-Math.sin(a)*sd;
      if(blockedM(x,z,.05)) continue; const m=new THREE.Mesh(printGeo,Math.abs(x-laneX(z))<1.4?printM:printG); m.rotation.set(-Math.PI/2,0,-a); m.position.set(x,ghM(x,z)+(Math.abs(x-laneX(z))<1.4?.12:.04),z); W.sc.add(m); T7.prints.push(m); } } } }
// pressed into the mud: dark on the pale lane, standing water (pale) in the grass
const printM=new THREE.MeshBasicMaterial({color:0x0b1016,transparent:true,opacity:.85,depthWrite:false}), printG=new THREE.MeshBasicMaterial({color:0x4f6577,transparent:true,opacity:.8,depthWrite:false,fog:true}),
  printGeo=(()=>{ const g=new THREE.CircleGeometry(.09,6); g.scale(1,1.35,1); return g; })();
function clearTells(){ T7.list=[]; T7.flashQ=[]; T7.gone=false; T7.barkT=-1; T7.closer=null;
  dog.fur.color.setHex(0x2e251c); dog.fur.specular=new THREE.Color(0x111111); dog.fur.shininess=4; dog.pale.specular=dog.fur.specular; dog.pale.shininess=4;
  if(T7.drips){ W.sc.remove(T7.drips); T7.drips=null; } for(const m of T7.prints) W.sc.remove(m); T7.prints=[]; }

/* ================= THE BARN, AND THE ENDINGS =================
   The barn: the first night the dog is chained away from the flock on a wolf night, the watcher comes down off the
   ridge for the only time. A flash: the barn door stands open, it is at the door, and the dog sits in the doorway
   wrong. It looks at the dog, then at you. Next flash it is gone and the door swings shut. Nothing is explained.
   The endings play out at the rift once the last dawn comes, or in the dark if the flock runs out. */
const BS={pending:false,on:false,stage:0,t:0,at:0,door:0};
function barnArm(){ BS.pending=true; BS.on=false; BS.stage=0; BS.at=rr(18,32); }
function barnFrame(dt){ BS.door=lerp(BS.door,BS.stage===1?-1.45:0,1-Math.exp(-dt*(BS.stage===1?14:1.2))); W.doorPivot.rotation.y=BS.door;
  if(!BS.on) return; BS.t+=dt;
  // it looks into the barn at the dog, then turns its head to you
  const tgt=BS.t<2.6?{x:dog.x,z:dog.z}:{x:TP.x,z:TP.z}; const hy=Math.atan2(tgt.x-wolf.x,tgt.z-wolf.z)-wolf.root.rotation.y;
  wolf.neck.rotation.y=lerp(wolf.neck.rotation.y,clamp(K.angLerp(0,hy,1),-1.3,1.3),1-Math.exp(-dt*(BS.t<2.6?8:2.5)));
  dog.wrongT=Math.max(dog.wrongT||0,.2); }
onFlash(()=>{ if(L.phase!=='night') return;
  if(BS.pending&&L.t>=BS.at){ const sees=Math.hypot(TP.x-BARN_DOOR.x,TP.z-BARN_DOOR.z)<36&&K.onScreen(BARN_DOOR.x,ghM(BARN.x,BARN.z)+1.5,BARN_DOOR.z,.95);
    if(!sees&&L.t<BS.at+30) return;
    BS.pending=false; BS.on=true; BS.stage=1; BS.t=0;
    wolf.root.visible=true; wolf.st='barn'; wolf.x=BARN_DOOR.x-2.3; wolf.z=BARN_DOOR.z+.4; wolf.root.position.set(wolf.x,ghM(wolf.x,wolf.z),wolf.z); wolf.root.rotation.y=Math.PI/2;
    dog.x=BARN_DOOR.x-.35; dog.z=BARN_DOOR.z-.2; dog.h=-Math.PI/2; dog.root.visible=true; dog.st='stay'; return; }
  if(BS.on&&BS.stage===1&&BS.t>4.2){ BS.stage=2; BS.on=false; wolf.root.visible=false; wolf.st='off'; NT.wolf=false; dog.root.visible=false; dog.wrongT=0; } });
function barnReset(){ BS.pending=false; BS.on=false; BS.stage=0; BS.door=0; if(W) W.doorPivot.rotation.y=0; }

// the survive ending: it followed you to the rift. One last flash, and its shadow on the lane is not a dog's.
const manTex=tex(32,128,(g,w,h)=>{ g.clearRect(0,0,w,h); g.fillStyle='#000'; disc(g,'#000',16,10,6);
  g.fillRect(11,16,10,46); g.fillRect(6,18,4,52); g.fillRect(22,18,4,52);          // long arms
  g.fillRect(11,60,4,62); g.fillRect(17,60,4,62); });
let shadowM=null;
const END={on:false,t:0,yaw0:0,yawTo:0,flashed:false};
function endScene(){ if(END.on) return; const e=L.ending;
  if(e==='survive'&&!dog.dead){ END.on=true; END.t=0; END.flashed=false; S.mode='medEnd'; objEl().classList.remove('on'); act.hidden=true;
    dog.st='stay'; dog.x=TP.x+.6; dog.z=TP.z-3.2; dog.h=Math.PI; dog.root.visible=true; ST.next=999;
    END.yaw0=P.yaw; END.yawTo=Math.atan2(-(dog.x-TP.x),-(dog.z-TP.z)); return; }
  if(e==='true'||e==='dark') sndM.howl(K.panOf(wolf.x||0,wolf.z||-38),.45);
  K.leave(); }
function endFrame(dt){ END.t+=dt; const k=sstep(0,1.4,END.t); P.yaw=K.angLerp(END.yaw0,END.yawTo,k); P.pitch=lerp(P.pitch,-.42,k);   // you look down at it
  if(END.t>2.2&&!END.flashed){ END.flashed=true; strike(true); ST.pulses=[{at:0,peak:reduce?.4:.95,dur:1.1+HOLD,soft:true}];   // one long, slow flash: long enough to see it
    if(!shadowM){ shadowM=new THREE.Mesh(new THREE.PlaneGeometry(1.3,4.2),new THREE.MeshBasicMaterial({map:manTex,transparent:true,opacity:.85,depthWrite:false})); W.sc.add(shadowM); }
    const b=Math.atan2(dog.x-TP.x,dog.z-TP.z)+Math.PI/2, sx=dog.x+Math.sin(b)*2.2, sz=dog.z+Math.cos(b)*2.2;   // thrown sideways across the lane by the strike
    shadowM.position.set(sx,ghM(sx,sz)+.13,sz); /* above the lane ribbon, which rides a little high mid-lane */ shadowM.rotation.set(-Math.PI/2,0,b+Math.PI); shadowM.visible=true; }
  if(shadowM&&END.flashed) shadowM.visible=ST.flash>.12;
  if(END.t>3.6&&END.t-dt<=3.6){ fadeTo(1,.9,'#000'); }
  if(END.t>4.8){ END.on=false; if(shadowM) shadowM.visible=false; K.leave(); } }

/* ================= ERA LIFECYCLE ================= */
function enterMed(){ if(!W){ buildMed(); buildAnimals(); buildProps(); }
  W.sc.add(cam); setPal(PAL_STORM); K.fallAudioStop(); ST.next=rr(3,6); ST.since=99;
  riftOpen=false; W.rift.g.scale.set(.25,.85,1); newRun();
  TP.x=SPAWN.x; TP.z=SPAWN.z; TP.acc=0; P.yaw=0; P.pitch=.05;
  document.body.classList.add('twalk','tmed'); $('#yearVal').textContent='AD 1350'; $('#year').classList.add('past'); $('#shiftBtn').textContent='Leave rift'; }
function arrive(){ enterMed(); S.mode='medEnter'; S.t=0; S.fade=1; fadeTo(1,0,'#000'); snd.thud(); R.sfx.shift();
  title('Temporal recovery · Rift 86','c. AD 1350','Middle Ages · a sheep farm in the north of England, the night a storm comes in');
  after(3,()=>{ untitle(); fadeTo(0,reduce?.6:2.4); S.mode='med'; S.t=0; startDusk(); }); }
function frame(dt,inp){
  S.frame=(S.frame||0)+1;
  if(S.mode==='med') walk(dt,inp);
  const bob=reduce?0:Math.sin(TP.bob)*.03;
  cam.position.set(TP.x,ghM(TP.x,TP.z)+1.6+bob,TP.z); cam.rotation.set(P.pitch,P.yaw,0); cam.updateMatrixWorld();
  W.clouds.rotation.y+=dt*.004; stormFrame(dt);
  if(!dog.dead&&!dog.away){ dogFrame(dt); tellFrame(dt); } flockFrame(dt); wolfFrame(dt); barnFrame(dt); if(S.mode==='med') loopFrame(dt); else if(S.mode==='medEnd') endFrame(dt);
  W.rift.em.opacity=(riftOpen?.85:.3)+Math.random()*.1; K.shimmer(W.rift,S.T,riftOpen?1.2:.4); W.riftL.intensity=(riftOpen?1.5:.45)+Math.sin(S.T*9)*.12;
  W.winL.intensity=1.05+Math.sin(S.T*7.3)*.05+Math.sin(S.T*13.1)*.04;   // firelight behind the glass
  K.render(W.sc); }
function key(k){ if(S.mode!=='med') return;
  if(L.phase==='dusk'&&k>='1'&&k<='4'){ cycle(ROWS[+k-1][0]); return; }
  if(k==='enter'){ if(L.phase==='dusk') startNight(); else if(L.phase==='night') endNight(); else if(L.phase==='dawn') toDusk(); return; }
  if(k==='e'){ feed(); return; }
  if(k==='t') msg('Time will not shift here'); else if(k>='1'&&k<='5') msg('Your records stayed in 1986'); }
function click(){ if(S.mode==='med'&&!R.touch()&&!R.locked()) R.lock(); }
function exit(){ document.body.classList.remove('tmed'); barnReset(); END.on=false; if(shadowM) shadowM.visible=false; rainAudioStop(); ST.flash=0; panel.hidden=true; act.hidden=true; L.phase=null; if(lantern) lantern.intensity=0; }
const sty=document.createElement('style'); sty.textContent=`body.tmed #tJump{display:none!important}
#mPanel{left:calc(16px + env(safe-area-inset-left));bottom:calc(64px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:6px;align-items:stretch;width:min(46vw,320px);pointer-events:auto}
#mPanel[hidden]{display:none}
#mPanel .mrow{text-align:left;font-family:var(--vt);font-size:19px;letter-spacing:0;text-transform:none;padding:4px 10px;background:rgba(10,12,15,.88)}
#mPanel .mrow small{display:block;font-family:var(--px);font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:var(--amber)}
#mPanel .mwarn{font-size:16px;color:var(--rust);text-align:center}
#mPanel .mwarn:empty{display:none}
#mAct{position:fixed;z-index:12;left:50%;bottom:calc(84px + env(safe-area-inset-bottom));transform:translateX(-50%)}
#mAct[hidden]{display:none}
body.touch #mAct{bottom:calc(14px + env(safe-area-inset-bottom))}   /* bottom centre: clear of the stick (left) and the panel (right) */
body.touch #mPanel{left:auto;right:calc(12px + env(safe-area-inset-right));transform:none;bottom:calc(64px + env(safe-area-inset-bottom));width:min(40vw,280px);gap:3px}
body.touch #mPanel .mrow{font-size:15px;padding:1px 8px}
body.touch #mPanel .mrow small{font-size:8px}
body.touch #mPanel .mwarn{font-size:13px}
body.touch #mPanel .mgo{padding:6px;margin-top:0}`;
document.head.appendChild(sty);

K.register('med',{arrive,frame,key,click,exit});
K.medDebug={get TP(){ return TP; },get W(){ return W; },ST,strike,setStorm,onFlash,HOLD,get dog(){ return dog; },get wolf(){ return wolf; },BS,END,barnArm,endScene,T7,TELLS,pickTells,dawnTells,clearTells,FLOCK,NT,sendDog,dogFollow,placeFlock,wolfShow,L,startNight,endNight,startDusk,toDusk,feed,cycle,ghM,blockedM,HOUSE,BARN,PEN,PORCH,DOOR,BARN_DOOR,PEN_GATE,RIDGE};
})(typeof window!=='undefined'?window:globalThis);
