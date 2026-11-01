/* Rift 86 · the Backrooms
   Not a when. You don't fall into it through a crack; you slip into it through the shut lift in the corridor while the
   Marker is there (index.html noclip → rift-travel.js noclip). Fetched the first time that happens; builds with the
   kit rift-travel.js exposes (window.__RTK).
   For now: the arrival, the hum, and rooms that go on further than they should and rearrange themselves behind you.
   What lives here comes later. */
(function(root){
'use strict';
const K=root.__RTK; if(!K) return;
const {R,S,P,reduce,cam,tex,px,clamp,lerp,sstep,put,flush,after,title,untitle,msg,fadeTo,setPal,toPal}=K;
const $=s=>document.querySelector(s);

/* ================= THE PLACE =================
   A grid of 4 m cells. Every cell edge is open, a wall, or a wall with a doorway, held in E[]. Walls are instances, so any
   edge can change at any moment. A new layout each visit, and while you're inside it shifts: only on the tube flicker,
   only edges you can't see, and never so that a room gets cut off from the rest. 1 unit ~ 1 m. */
const CELL=4, N=20, HGT=2.7, WT=.2, X0=-N*CELL/2, DW=1.2;
const SPAWN={i:N/2|0,j:N/2|0};
// mono-yellow: damp wallpaper, mustard shadow, brown carpet, near-white tubes; one red kept back for later
const PAL_BACK=toPal(['#0d0b05','#1a160a','#2a2410','#3b3317','#4f451f','#655827','#7c6c30','#93813a','#a99546','#bfa955',
  '#d2bc66','#e2cd7a','#eedd93','#f6ebb5','#fff8dc','#2b1f12','#4a3820','#6b5530','#8a7a52','#c4221a']);
function rng(seed){ let s=seed>>>0||1; return ()=>{ s=(s+0x6D2B79F5)>>>0; let t=s; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61); return ((t^t>>>14)>>>0)/4294967296; }; }
const cx=i=>X0+i*CELL+CELL/2;

/* ---- the edge table ----
   vertical edges (a wall running along z at x=X0+i*CELL, beside cell row j): index vE(i,j), i 0..N
   horizontal edges (running along x at z=X0+j*CELL, beside cell column i):  index hE(i,j), j 0..N */
const NV=(N+1)*N, NE=NV*2, INNER=NE-4*N, WALL_P=.42, DOOR_P=.35;
const vE=(i,j)=>i*N+j, hE=(i,j)=>NV+j*N+i;
const E=new Uint8Array(NE), DOOR=new Float32Array(NE);            // 0 open, 1 wall, 2 wall with a doorway; doorway offset
function eg(e){ if(e<NV){ const i=(e/N)|0, j=e%N; return {along:false,x:X0+i*CELL,z:X0+j*CELL,outer:i===0||i===N}; }
  const k=e-NV, j=(k/N)|0, i=k%N; return {along:true,x:X0+i*CELL,z:X0+j*CELL,outer:j===0||j===N}; }
const cellOf=(x,z)=>{ const i=clamp(Math.floor((x-X0)/CELL),0,N-1), j=clamp(Math.floor((z-X0)/CELL),0,N-1); return j*N+i; };
// how many cells you can walk to from cell c (doorways and open edges pass, walls don't)
function reach(c){ const seen=new Uint8Array(N*N), q=[c]; seen[c]=1; let n=1;
  const go=(d,e)=>{ if(E[e]!==1&&!seen[d]){ seen[d]=1; n++; q.push(d); } };
  while(q.length){ const k=q.pop(), i=k%N, j=(k/N)|0;
    if(i<N-1) go(k+1,vE(i+1,j)); if(i>0) go(k-1,vE(i,j)); if(j<N-1) go(k+N,hE(i,j+1)); if(j>0) go(k-N,hE(i,j)); }
  return {n,seen}; }
const L={r:Math.random,seed:0,shifts:0};

let W=null; let RECTS=[]; const PILLARS=[], PANELS=[];
function build(){ const r=rng(1986404), sc=new THREE.Scene(); sc.background=new THREE.Color(0x2a2410); sc.fog=new THREE.FogExp2(0x2a2410,.075);
  const T={
    paper:tex(16,32,(g,w,h)=>{ px(g,'#c9b458',0,0,w,h); for(let x=0;x<w;x+=4){ for(let y=0;y<h;y+=4){ px(g,'#b8a24a',x+((y/4)%2?2:0),y,2,1); px(g,'#b8a24a',x+1,y+2,1,1); } }
      for(let i=0;i<10;i++) px(g,'#93813a',r()*w,h-3-r()*6,1+(r()*3|0),2+(r()*3|0)); },2,1),   // chevron rows, water stains at the skirting
    carpet:tex(16,16,(g,w,h)=>{ px(g,'#8a7a52',0,0,w,h); for(let i=0;i<90;i++) px(g,['#6b5530','#93813a','#7c6c30'][i%3],r()*w,r()*h); for(let i=0;i<3;i++) px(g,'#655827',r()*w,r()*h,3,2); },N*2),
    tile:tex(32,32,(g,w,h)=>{ px(g,'#d2bc66',0,0,w,h); px(g,'#a99546',0,0,w,1); px(g,'#a99546',0,0,1,h); for(let i=0;i<30;i++) px(g,'#bfa955',1+r()*30,1+r()*30); },N*CELL/1.2) // 1.2 m drop-ceiling tiles
  };
  const M={
    wall:new THREE.MeshPhongMaterial({map:T.paper,shininess:0,specular:0x000000}),
    carpet:new THREE.MeshPhongMaterial({map:T.carpet,shininess:0,specular:0x000000}),
    tile:new THREE.MeshPhongMaterial({map:T.tile,shininess:0,specular:0x000000,side:THREE.BackSide}),
    panel:new THREE.MeshBasicMaterial({color:0xfff8dc}),
    trim:new THREE.MeshPhongMaterial({color:0x7c6c30,shininess:0})
  };
  const span=N*CELL;
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(span,span,N,N),M.carpet); floor.rotation.x=-Math.PI/2; sc.add(floor);
  const ceil=new THREE.Mesh(new THREE.PlaneGeometry(span,span,N,N),M.tile); ceil.rotation.x=-Math.PI/2; ceil.position.y=HGT; sc.add(ceil);
  const bx=new THREE.BoxGeometry(1,1,1), pl=new THREE.PlaneGeometry(1,1);
  // the odd square pillar standing at a corner for no reason (these never move)
  for(let i=1;i<N;i++) for(let j=1;j<N;j++){ if(r()>.12) continue; const x=X0+i*CELL, z=X0+j*CELL; if(Math.abs(i-SPAWN.i-.5)<1.5&&Math.abs(j-SPAWN.j-.5)<1.5) continue;
    put(bx,M.wall,x,HGT/2,z,0,0,0,.6,HGT,.6); PILLARS.push({x0:x-.3,x1:x+.3,z0:z-.3,z1:z+.3,e:-1}); }
  // tube panels: most cells, one in the middle of the ceiling
  for(let i=0;i<N;i++) for(let j=0;j<N;j++){ if(r()<.25&&!(i===SPAWN.i&&j===SPAWN.j)) continue; const x=cx(i), z=cx(j);
    put(pl,M.panel,x,HGT-.01,z,Math.PI/2,0,0,.6,1.2,1); PANELS.push({x,z}); }
  flush(sc);
  // every edge owns 3 wall slots (two lengths and a lintel) and 2 skirting slots; unused ones are scaled to nothing
  const walls=new THREE.InstancedMesh(bx,M.wall,NE*3), trims=new THREE.InstancedMesh(bx,M.trim,NE*2);
  // one unit box at the origin: its bounds say nothing about where the instances are, so never cull
  for(const m of [walls,trims]){ m.frustumCulled=false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); sc.add(m); }
  sc.add(new THREE.HemisphereLight(0xfff0b0,0x4a3820,1.15));
  // the one tube that fails: a dark cover laid over whichever panel is nearest you, and a light that drops with it
  const cover=new THREE.Mesh(new THREE.PlaneGeometry(.62,1.22),new THREE.MeshBasicMaterial({color:0x4f451f})); cover.rotation.x=Math.PI/2; cover.visible=false; sc.add(cover);
  const tubeL=new THREE.PointLight(0xfff0c0,.9,7,2); sc.add(tubeL);
  W={sc,cover,tubeL,walls,trims}; }

const _m=new THREE.Matrix4(), ZERO=new THREE.Matrix4().makeScale(0,0,0);
function slab(mesh,slot,g,a,b,y,h,t){ const l=b-a, m=(a+b)/2;
  if(g.along) _m.makeScale(l,h,t).setPosition(g.x+m,y,g.z); else _m.makeScale(t,h,l).setPosition(g.x,y,g.z+m); mesh.setMatrixAt(slot,_m); }
function writeEdge(e){ const g=eg(e), s=E[e], wm=W.walls, tm=W.trims, d=DOOR[e];
  for(let k=0;k<3;k++) wm.setMatrixAt(3*e+k,ZERO); for(let k=0;k<2;k++) tm.setMatrixAt(2*e+k,ZERO);
  if(s===1){ slab(wm,3*e,g,0,CELL,HGT/2,HGT,WT); slab(tm,2*e,g,0,CELL,.05,.1,WT+.04); }
  else if(s===2){ slab(wm,3*e,g,0,d,HGT/2,HGT,WT); slab(wm,3*e+1,g,d+DW,CELL,HGT/2,HGT,WT); slab(wm,3*e+2,g,d,d+DW,HGT-.25,.5,WT);
    slab(tm,2*e,g,0,d,.05,.1,WT+.04); slab(tm,2*e+1,g,d+DW,CELL,.05,.1,WT+.04); }
  wm.instanceMatrix.needsUpdate=true; tm.instanceMatrix.needsUpdate=true; }
function edgeRects(e,out){ const g=eg(e), s=E[e], d=DOOR[e];
  const seg=(a,b)=>out.push(g.along?{x0:g.x+a,x1:g.x+b,z0:g.z-WT/2,z1:g.z+WT/2,e}:{x0:g.x-WT/2,x1:g.x+WT/2,z0:g.z+a,z1:g.z+b,e});
  if(s===1) seg(0,CELL); else if(s===2){ seg(0,d); seg(d+DW,CELL); } }
function rebuildRects(){ const out=PILLARS.slice(); for(let e=0;e<NE;e++) if(E[e]) edgeRects(e,out); RECTS=out; }

// a fresh layout for this visit: random edges, the spawn cell left open, then doorways knocked through until every cell connects
function layout(seed){ L.seed=seed; L.shifts=0; const r=L.r=rng(seed);
  for(let e=0;e<NE;e++){ DOOR[e]=.8+r()*(CELL-DW-1.6); E[e]=eg(e).outer?1:r()<WALL_P?(r()<DOOR_P?2:1):0; }
  const si=SPAWN.i, sj=SPAWN.j; E[vE(si,sj)]=E[vE(si+1,sj)]=E[hE(si,sj)]=E[hE(si,sj+1)]=0;
  const c0=sj*N+si;
  for(;;){ const {n,seen}=reach(c0); if(n===N*N) break; const cand=[];
    for(let i=1;i<N;i++) for(let j=0;j<N;j++){ const e=vE(i,j); if(E[e]===1&&seen[j*N+i-1]!==seen[j*N+i]) cand.push(e); }
    for(let j=1;j<N;j++) for(let i=0;i<N;i++){ const e=hE(i,j); if(E[e]===1&&seen[(j-1)*N+i]!==seen[j*N+i]) cand.push(e); }
    E[cand[(r()*cand.length)|0]]=r()<.5?2:0; }
  for(let e=0;e<NE;e++) writeEdge(e); rebuildRects(); }

/* ---- the shift ----
   Rule: when the tube near you goes dark, a handful of edges change. An edge may change only if it is more than 6 m
   away and no part of it can be seen (off screen, or hidden behind other walls), and a new wall is refused if it
   would cut any room off. Changes that pass are instant: nobody is looking. */
function blockedSeg(ax,az,bx,bz,e){ const dx=bx-ax, dz=bz-az;
  for(const c of RECTS){ if(c.e===e) continue; let t0=0, t1=.98;
    if(Math.abs(dx)<1e-9){ if(ax<c.x0||ax>c.x1) continue; } else { let a=(c.x0-ax)/dx, b=(c.x1-ax)/dx; if(a>b){ const t=a; a=b; b=t; } t0=Math.max(t0,a); t1=Math.min(t1,b); if(t0>t1) continue; }
    if(Math.abs(dz)<1e-9){ if(az<c.z0||az>c.z1) continue; } else { let a=(c.z0-az)/dz, b=(c.z1-az)/dz; if(a>b){ const t=a; a=b; b=t; } t0=Math.max(t0,a); t1=Math.min(t1,b); if(t0>t1) continue; }
    return true; }
  return false; }
const SAMP=[.3,1.15,2,2.85,3.7];
function visible(e,g){ for(const u of SAMP){ const x=g.along?g.x+u:g.x, z=g.along?g.z:g.z+u;
    if(!K.onScreen(x,.3,z,1.35)&&!K.onScreen(x,HGT/2,z,1.35)&&!K.onScreen(x,HGT-.3,z,1.35)) continue;
    if(!blockedSeg(TP.x,TP.z,x,z,e)) return true; }
  return false; }
function density(){ let w=0; for(let e=0;e<NE;e++) if(E[e]&&!eg(e).outer) w++; return w/INNER; }
function shift(){ const r=L.r, pc=cellOf(TP.x,TP.z), want=3+((r()*4)|0); let done=0, dens=density();
  cam.updateMatrixWorld();
  for(let t=0;t<60&&done<want;t++){ const e=(r()*NE)|0, g=eg(e); if(g.outer) continue;
    const mx=g.along?g.x+CELL/2:g.x, mz=g.along?g.z:g.z+CELL/2, d=Math.hypot(mx-TP.x,mz-TP.z);
    if(d<6) continue; if(d<28&&visible(e,g)) continue;                        // past ~28 m the fog has it anyway
    const old=E[e]; let nu;
    if(old===0) nu=r()<DOOR_P?2:1; else if(dens>WALL_P||r()<.5) nu=0; else nu=old===1?2:1;
    E[e]=nu; if(nu===1&&reach(pc).n<N*N){ E[e]=old; continue; }              // would wall somebody in: refused
    if(nu===2) DOOR[e]=.8+r()*(CELL-DW-1.6);
    writeEdge(e); dens+=((nu?1:0)-(old?1:0))/INNER; done++; }
  if(done){ rebuildRects(); L.shifts++; } return done; }
function blocked(x,z){ const rr=.28; for(const c of RECTS) if(x>c.x0-rr&&x<c.x1+rr&&z>c.z0-rr&&z<c.z1+rr) return true; return false; }
function nearestPanel(x,z){ let b=PANELS[0], bd=1e9; for(const p of PANELS){ const d=(p.x-x)**2+(p.z-z)**2; if(d<bd){ bd=d; b=p; } } return b; }

/* ================= SOUND: the hum ================= */
let hum=null;
function humStart(){ const a=K.A(); if(!a||hum) return; const {ac,master,nb}=a;
  const out=ac.createGain(); out.gain.value=0; out.connect(master); const buzz=ac.createGain(); buzz.gain.value=1; buzz.connect(out); const srcs=[];
  const osc=(type,f,v,dest,lp)=>{ const o=ac.createOscillator(), g=ac.createGain(); o.type=type; o.frequency.value=f; g.gain.value=v;
    if(lp){ const fl=ac.createBiquadFilter(); fl.type='lowpass'; fl.frequency.value=lp; o.connect(fl).connect(g); } else o.connect(g); g.connect(dest); o.start(); srcs.push(o); };
  osc('sine',60,.1,out); osc('sawtooth',120,.035,buzz,700); osc('sawtooth',120.6,.02,buzz,700); osc('square',180,.006,buzz,1200);
  const n=ac.createBufferSource(); n.buffer=nb; n.loop=true; const bp=ac.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=4200; bp.Q.value=4;
  const ng=ac.createGain(); ng.gain.value=.012; n.connect(bp).connect(ng).connect(buzz); n.start(); srcs.push(n);
  hum={out,buzz,srcs}; }
function humLevel(v,tc){ if(hum) hum.out.gain.setTargetAtTime(v,K.A().ac.currentTime,tc); }
function humStop(){ if(!hum) return; const h=hum; hum=null; const a=K.A(); h.out.gain.setTargetAtTime(0,a.ac.currentTime,.1);
  setTimeout(()=>{ try{ h.srcs.forEach(s=>s.stop()); h.out.disconnect(); }catch(e){} },1500); }
const sndB={
  tick(){ const a=K.A(); if(!a) return; const t=a.ac.currentTime; a.tone(t,'square',2400,1700,.05,.001,.025); a.noise(t,.04,'highpass',3000,.7,.12,.03); },
  on(){ const a=K.A(); if(!a) return; const t=a.ac.currentTime; for(let i=0;i<4;i++){ a.tone(t+i*.05,'square',2200,1600,.04,.001,.02); } a.noise(t+.2,.3,'bandpass',900,2,.08,.25); },
  step(){ const a=K.A(); if(!a) return; const t=a.ac.currentTime, v=.8+Math.random()*.3; a.tone(t,'sine',70,40,.12*v,.006,.1); a.noise(t,.14,'lowpass',320,.7,.14*v,.1); } // carpet, a little wet
};

/* ================= LIFECYCLE ================= */
const TP={x:0,z:0,bob:0,acc:0}, FL={next:0,left:0,lit:true,shift:false};
function enter(){ if(!W) build(); layout((Math.random()*2147483647)|0); // never the same place twice
  W.sc.add(cam); setPal(PAL_BACK); K.fallAudioStop();
  TP.x=cx(SPAWN.i)+.4; TP.z=cx(SPAWN.j)+.9; TP.acc=0; TP.bob=0; P.yaw=Math.PI*.25; P.pitch=-.05;
  FL.next=K.rr(18,35); FL.left=0; FL.lit=true; FL.shift=false; W.cover.visible=false;
  document.body.classList.add('twalk'); $('#yearVal').textContent='----'; $('#year').classList.remove('past'); $('#shiftBtn').textContent='Leave backroom'; }
// black and silent; a ballast ticks, ticks again, catches; the hum comes up with the light; you get up off the floor
function arrive(){ enter(); S.mode='backEnter'; S.t=0; S.fade=1; fadeTo(1,0,'#000'); S.rise=reduce?1:0;
  after(1.4,sndB.tick); after(1.85,sndB.tick);
  after(2.3,()=>{ sndB.on(); humStart(); humLevel(.9,reduce?.3:.8); fadeTo(0,reduce?.6:2.2); S.mode='back'; S.t=0; });
  after(4.2,()=>title('Temporal recovery · Rift 86','—','No date. No place.'));
  after(8,untitle); }
function walk(dt,inp){ const m=inp.m; if(m<=.05) return; const sp=(inp.run?3.4:1.9)*Math.min(1,m)/Math.max(1,m), yaw=P.yaw;
  const vx=(-Math.sin(yaw)*inp.f+Math.cos(yaw)*inp.s)*sp*dt, vz=(-Math.cos(yaw)*inp.f-Math.sin(yaw)*inp.s)*sp*dt;
  if(!blocked(TP.x+vx,TP.z)) TP.x+=vx; if(!blocked(TP.x,TP.z+vz)) TP.z+=vz;
  TP.bob+=dt*(inp.run?10:7.5); TP.acc+=Math.hypot(vx,vz); if(TP.acc>(inp.run?1:.8)){ TP.acc=0; sndB.step(); } }
function flicker(dt){ FL.next-=dt;
  if(FL.next<=0&&FL.left<=0){ FL.left=K.rr(.6,1.6); const p=nearestPanel(TP.x,TP.z); W.cover.position.set(p.x,HGT-.02,p.z); W.tubeL.position.set(p.x,HGT-.4,p.z); FL.shift=true; }
  if(FL.left>0){ FL.left-=dt; const lit=FL.left<=0||Math.random()<.45; if(lit!==FL.lit){ FL.lit=lit; if(!lit) sndB.tick(); }
    if(FL.shift&&(!FL.lit||FL.left<=0)){ FL.shift=false; shift(); } // the rooms move while the light is out
    if(FL.left<=0){ FL.next=K.rr(20,45); FL.lit=true; } }
  W.cover.visible=!FL.lit; W.tubeL.intensity=FL.lit?.9:0;
  if(hum) hum.buzz.gain.setTargetAtTime(FL.lit?1:.05,K.A().ac.currentTime,.01); } // light and buzz drop out together
function frame(dt,inp){
  if(S.mode==='back'){ walk(dt,inp); flicker(dt); if(S.rise<1) S.rise=Math.min(1,S.rise+dt); }
  const bob=reduce?0:Math.sin(TP.bob)*.03, lift=lerp(-.9,0,sstep(0,1,S.rise));   // starts low: you've just got up off the carpet
  cam.position.set(TP.x,1.6+bob+lift,TP.z); cam.rotation.set(P.pitch,P.yaw,0); cam.updateMatrixWorld();
  K.render(W.sc); }
function key(k){ if(S.mode!=='back') return; if(k==='t') msg('Time will not shift here'); else if(k>='1'&&k<='5') msg('Your records stayed in 1986'); }
function click(){ if(S.mode==='back'&&!R.touch()&&!R.locked()) R.lock(); }
function exit(){ humStop(); if(W) W.cover.visible=false; S.rise=1; }

K.register('back',{arrive,frame,key,click,exit});
K.backDebug={L,E,FL,TP,shift,reach,cellOf,visible,eg,get RECTS(){ return RECTS; },N,NE};
})(window);
