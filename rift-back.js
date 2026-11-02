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
// the way out: a lift set into one wall, far from where you wake. Its edge is pinned: no shift ever touches it.
const LIFT={e:-1,cell:-1,x:0,z:0,nx:0,nz:0};
function placeLift(r){ for(let k=0;k<400;k++){ const i=(r()*N)|0, j=(r()*N)|0; if(Math.abs(i-SPAWN.i)+Math.abs(j-SPAWN.j)<9) continue;
    const side=(r()*4)|0, e=side===0?vE(i,j):side===1?vE(i+1,j):side===2?hE(i,j):hE(i,j+1), g=eg(e);
    E[e]=1; LIFT.e=e; LIFT.cell=j*N+i; LIFT.x=g.along?g.x+CELL/2:g.x; LIFT.z=g.along?g.z:g.z+CELL/2;
    LIFT.nx=side===0?1:side===1?-1:0; LIFT.nz=side===2?1:side===3?-1:0; return; } }
// shortest walk from cell a to cell b, as the edges crossed (doorways and gaps)
function routeEdges(a,b){ const par=new Int32Array(N*N).fill(-1), pe=new Int32Array(N*N), q=[a]; par[a]=a; let h=0;
  while(h<q.length){ const k=q[h++]; if(k===b) break; const i=k%N, j=(k/N)|0;
    for(const [ok,d,e] of [[i<N-1,k+1,vE(i+1,j)],[i>0,k-1,vE(i,j)],[j<N-1,k+N,hE(i,j+1)],[j>0,k-N,hE(i,j)]]) if(ok&&E[e]!==1&&par[d]<0){ par[d]=k; pe[d]=e; q.push(d); } }
  const out=[]; if(par[b]<0) return out; for(let k=b;k!==a;k=par[k]) out.push(pe[k]); return out.reverse(); }

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
  const hemi=new THREE.HemisphereLight(0xfff0b0,0x4a3820,1.15); sc.add(hemi);
  // damp shoe prints: a forefoot and a heel, in the darkest carpet brown
  const printT=tex(8,16,(g,w,h)=>{ g.clearRect(0,0,w,h); const c='#1a160a'; px(g,c,2,0,4,1); px(g,c,1,1,6,6); px(g,c,2,7,4,2); px(g,c,2,10,4,5); px(g,c,3,15,2,1); });
  const prints=new THREE.Group(), pg=new THREE.PlaneGeometry(.2,.44), PR=[];
  for(let i=0;i<48;i++){ const m=new THREE.Mesh(pg,new THREE.MeshBasicMaterial({map:printT,transparent:true,opacity:0,depthWrite:false})); m.visible=false; prints.add(m); PR.push({m,age:99}); }
  sc.add(prints);
  // the one tube that fails: a dark cover laid over whichever panel is nearest you, and a light that drops with it
  const cover=new THREE.Mesh(new THREE.PlaneGeometry(.62,1.22),new THREE.MeshBasicMaterial({color:0x4f451f})); cover.rotation.x=Math.PI/2; cover.visible=false; sc.add(cover);
  const tubeL=new THREE.PointLight(0xfff0c0,.9,7,2); sc.add(tubeL);
  // the lift: built facing +z, turned to face into its cell when placed
  const lift=new THREE.Group(), metal=new THREE.MeshPhongMaterial({color:0x8a8470,shininess:20,specular:0x222222}), dark=new THREE.MeshBasicMaterial({color:0x1a160a}), f0=WT/2;
  const lp=(w,h,d,x,y,z,m)=>{ const o=new THREE.Mesh(bx,m); o.scale.set(w,h,d); o.position.set(x,y,z); lift.add(o); };
  lp(1.6,2.45,.05,0,1.225,f0+.025,dark); lp(.7,2.2,.04,-.36,1.1,f0+.07,metal); lp(.7,2.2,.04,.36,1.1,f0+.07,metal); lp(.02,2.2,.05,0,1.1,f0+.07,dark);
  lp(1.75,.12,.08,0,2.5,f0+.04,metal); lp(.1,.16,.03,.98,1.25,f0+.02,metal); lp(.05,.05,.02,.98,1.28,f0+.04,new THREE.MeshBasicMaterial({color:0xfff3d0}));
  sc.add(lift);
  // what catches you: your height, your shape, no face. Only ever seen for half a second.
  const fig=new THREE.Group(), fm=new THREE.MeshBasicMaterial({color:0x0d0b05});
  for(const [w,h,d,x,y,z,rz] of [[.14,.86,.16,-.1,.43,0,0],[.14,.86,.16,.1,.43,0,0],[.42,.62,.24,0,1.17,0,0],[.11,.7,.13,-.29,1.1,.02,.06],[.11,.7,.13,.29,1.1,.02,-.06],[.22,.27,.24,.02,1.63,.03,.18]]){
    const o=new THREE.Mesh(bx,fm); o.scale.set(w,h,d); o.position.set(x,y,z); o.rotation.z=rz; fig.add(o); }
  fig.rotation.x=.06; fig.visible=false; sc.add(fig);
  // the flashlight you carried out of 1986: on the camera, dark until the tubes die
  const flash=new THREE.SpotLight(0xffe6c0,0,16,.42,.55,1); flash.position.set(.15,-.15,0); const ftg=new THREE.Object3D(); ftg.position.set(0,-.1,-1); cam.add(flash,ftg); flash.target=ftg;
  W={sc,cover,tubeL,walls,trims,lift,fig,hemi,panelM:M.panel,prints,PR,pi:0,flash}; }

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
  placeLift(r); const c0=sj*N+si;
  for(;;){ const {n,seen}=reach(c0); if(n===N*N) break; const cand=[];
    for(let i=1;i<N;i++) for(let j=0;j<N;j++){ const e=vE(i,j); if(E[e]===1&&e!==LIFT.e&&seen[j*N+i-1]!==seen[j*N+i]) cand.push(e); }
    for(let j=1;j<N;j++) for(let i=0;i<N;i++){ const e=hE(i,j); if(E[e]===1&&e!==LIFT.e&&seen[(j-1)*N+i]!==seen[j*N+i]) cand.push(e); }
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
function canTouch(e,g,blind){ if(g.outer||e===LIFT.e) return false;
  const mx=g.along?g.x+CELL/2:g.x, mz=g.along?g.z:g.z+CELL/2, d=Math.hypot(mx-TP.x,mz-TP.z);
  return d>=6&&(blind||!(d<28&&visible(e,g))); }                                        // past ~28 m the fog has it anyway
function setEdge(e,nu,pc){ const old=E[e]; if(old===nu) return false; E[e]=nu;
  if(nu===1&&reach(pc).n<N*N){ E[e]=old; return false; }                     // would wall somebody in: refused
  if(nu===2) DOOR[e]=.8+L.r()*(CELL-DW-1.6); writeEdge(e); return true; }
function shift(blind){ const r=L.r, pc=cellOf(TP.x,TP.z), want=blind?6+((r()*5)|0):3+((r()*4)|0); let done=0, dens=density();
  cam.updateMatrixWorld();
  // the maze resists you: first, one edge on your shortest way to the lift closes, if it can do it unseen
  if(LIFT.e>=0) for(const e of routeEdges(pc,LIFT.cell)){ if(!canTouch(e,eg(e),blind)) continue; const old=E[e]; if(setEdge(e,1,pc)){ dens+=(old?0:1)/INNER; done++; break; } }
  for(let t=0;t<60&&done<want;t++){ const e=(r()*NE)|0; if(!canTouch(e,eg(e),blind)) continue;
    const old=E[e]; let nu;
    if(old===0) nu=r()<DOOR_P?2:1; else if(dens>WALL_P||r()<.5) nu=0; else nu=old===1?2:1;
    if(!setEdge(e,nu,pc)) continue; dens+=((nu?1:0)-(old?1:0))/INNER; done++; }
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
  step(d){ const a=K.A(); if(!a) return; const t=a.ac.currentTime, v=.8+Math.random()*.3; a.tone(t,'sine',70,40,.12*v,.006,.1,d); a.noise(t,.14,'lowpass',320,.7,.14*v,.1,d); }, // carpet, a little wet
  breaker(){ const a=K.A(); if(!a) return; const t=a.ac.currentTime; a.tone(t,'sine',90,30,.35,.004,.35); a.noise(t,.25,'lowpass',260,.8,.3,.2); a.tone(t,'square',2400,1700,.04,.001,.03); },
  descend(){ const a=K.A(); if(!a) return; const t=a.ac.currentTime; a.tone(t,'sine',90,30,.3,.01,.5); a.tone(t+.2,'sawtooth',64,46,.07,.6,2.6); a.noise(t+.2,3,'lowpass',240,.7,.16,2.6);
    a.tone(t+3.3,'triangle',659,659,.16,.004,1,K.pout(0,1)); a.tone(t+3.68,'triangle',523,523,.16,.004,1.3,K.pout(0,1)); },   // the ding again, a step lower
  ding(pan,v){ const a=K.A(); if(!a||v<.01) return; const d=K.pout(pan,v), t=a.ac.currentTime;
    a.tone(t,'triangle',1318,1318,.22,.004,1.1,d); a.tone(t,'sine',2636,2636,.03,.004,.5,d); a.tone(t+.38,'triangle',1046,1046,.22,.004,1.4,d); }
};

/* ================= LIFECYCLE ================= */
const TP={x:0,z:0,bob:0,acc:0}, FL={next:0,left:0,lit:true,shift:false};

/* ================= THE ECHO =================
   Rules, fixed:
   1. It stands where you stood T seconds ago, walking your exact path. Walls don't stop it: it came in the way you did.
   2. Every time the tube goes dark, T drops a few seconds. The past gets closer.
   3. Its footsteps are yours, replayed from where it is. When you stop, you still hear walking: that is it, catching up.
   4. If it reaches the spot where you are, it has you.
   So circling back is how it finds you, and standing still lets it walk right up. */
const ECHO_T0=60, ECHO_MIN=3, ECHO_DROP=[6,10], SAMPLE=.1, CATCH=.9;
const EC={T:ECHO_T0,et:0,xs:[],zs:[],x:0,z:0,acc:0,on:false,dingT:0,yaw0:0,yawTo:0,fx:0,fz:0,blacked:false};
function echoReset(){ EC.T=ECHO_T0; EC.et=0; EC.xs.length=0; EC.zs.length=0; EC.on=false; EC.acc=0; EC.dingT=K.rr(5,9); }
function echoFrame(dt){ EC.et+=dt; while(EC.xs.length*SAMPLE<=EC.et){ EC.xs.push(TP.x); EC.zs.push(TP.z); }
  const te=EC.et-EC.T; if(te<0||EC.xs.length<2) return;
  const f=te/SAMPLE, i=Math.min(EC.xs.length-2,f|0), k=Math.min(1,f-i), x=lerp(EC.xs[i],EC.xs[i+1],k), z=lerp(EC.zs[i],EC.zs[i+1],k);
  if(!EC.on){ EC.on=true; EC.x=x; EC.z=z; }
  const mv=Math.hypot(x-EC.x,z-EC.z), ux=mv>1e-4?(x-EC.x)/mv:0, uz=mv>1e-4?(z-EC.z)/mv:0; EC.x=x; EC.z=z;
  if(mv<1.5){ EC.acc+=mv; if(EC.acc>(mv/dt>2.6?1:.8)){ EC.acc=0;                // the jump when T drops makes no sound
    const d=Math.hypot(x-TP.x,z-TP.z); sndB.step(K.pout(K.panOf(x,z),K.vol(d,1.6)*lerp(.35,1.25,1-EC.T/ECHO_T0))); if(ux||uz) print(x,z,ux,uz); } }
  if(Math.hypot(x-TP.x,z-TP.z)<CATCH) caught(); }
// where it steps, the carpet goes dark and wet: left, right, pointing the way it walks. Darkens in, dries out in ~45 s.
const PRINT_LIFE=45;
function print(x,z,ux,uz){ const p=W.PR[W.pi=(W.pi+1)%W.PR.length]; EC.side=-(EC.side||1);
  p.m.position.set(x-uz*.13*EC.side,.012,z+ux*.13*EC.side); p.m.rotation.set(-Math.PI/2,0,Math.atan2(-ux,-uz)); p.age=0; p.m.visible=true; }
function printsFrame(dt){ for(const p of W.PR){ if(p.age>=PRINT_LIFE){ if(p.m.visible){ p.m.visible=false; p.m.material.opacity=0; } continue; }
  p.age+=dt; p.m.material.opacity=.8*Math.min(1,p.age/.5)*(1-sstep(PRINT_LIFE-12,PRINT_LIFE,p.age)); } }
function clearPrints(){ for(const p of W.PR){ p.age=99; p.m.visible=false; p.m.material.opacity=0; } }

/* ================= LIGHTS OUT =================
   Rule: once it's within 40 s of you, a flicker can become a blackout instead (35%), 3-5 s. Every tube and the hum die.
   In the dark nobody sees anything, so that shift may move any edge past 6 m, and more of them. T drops as usual.
   The lift's call button keeps its glow. */
const BO={on:false,t:0,hinted:false}, FLASH={on:false};
function setLights(on){ W.hemi.intensity=on?1.15:.02; W.panelM.color.setHex(on?0xfff8dc:0x0d0b05); W.tubeL.intensity=on?.9:0; if(!on) W.cover.visible=false;
  const c=on?0x2a2410:0x030201; W.sc.fog.color.setHex(c); W.sc.background.setHex(c);
  if(on&&FLASH.on){ FLASH.on=false; R.sfx.ui(); }                            // the tubes are back: click, off
  W.flash.intensity=FLASH.on?2.4:0; W.prints.visible=on||FLASH.on; flashBtn.hidden=on||!R.touch(); }
// F, or the button on touch. Only in a blackout: the blind shift has already happened by the time you can switch it on,
// so it never lights an edge the rule moved unseen.
function toggleFlash(){ if(!BO.on||S.mode!=='back') return; FLASH.on=!FLASH.on; R.sfx.ui(); W.flash.intensity=FLASH.on?2.4:0; W.prints.visible=FLASH.on; }
const flashBtn=K.el('button','bFlash','pbtn'); flashBtn.type='button'; flashBtn.textContent='Flashlight'; flashBtn.hidden=true; flashBtn.addEventListener('click',toggleFlash);
{ const st=document.createElement('style'); st.textContent='#bFlash{position:fixed;z-index:6;right:calc(16px + env(safe-area-inset-right));bottom:calc(96px + env(safe-area-inset-bottom));padding:12px 16px}#bFlash[hidden]{display:none}'; document.head.appendChild(st); }
function blackout(){ BO.on=true; BO.t=K.rr(3,5); FL.next=K.rr(20,45); FL.left=0; FL.lit=true; FL.shift=false;
  sndB.breaker(); setLights(false); humLevel(0,.03); shift(true);
  if(!BO.hinted&&!R.touch()){ BO.hinted=true; setTimeout(()=>{ if(BO.on) msg('F · flashlight',2.4); },700); } EC.T=Math.max(ECHO_MIN,EC.T-K.rr(ECHO_DROP[0],ECHO_DROP[1])); }
function blackFrame(dt){ BO.t-=dt; if(BO.t>0) return; BO.on=false;
  sndB.tick(); setTimeout(()=>{ if(!BO.on&&S.mode==='back'){ sndB.tick(); } },220);
  setTimeout(()=>{ if(BO.on||S.mode!=='back') return; sndB.on(); setLights(true); humLevel(.9,.25); },450); }
function caught(){ if(S.mode!=='back') return; S.mode='backDead'; S.t=0; EC.blacked=false;
  const dx=EC.x-TP.x, dz=EC.z-TP.z, l=Math.hypot(dx,dz)||1; EC.fx=TP.x+dx/l*1.3; EC.fz=TP.z+dz/l*1.3;
  EC.yaw0=P.yaw; EC.yawTo=Math.atan2(-dx,-dz); }
function deadFrame(){ const k=reduce?1:sstep(0,.25,S.t); P.yaw=K.angLerp(EC.yaw0,EC.yawTo,k); P.pitch=lerp(P.pitch,0,k);
  W.fig.position.set(EC.fx,0,EC.fz); W.fig.rotation.y=Math.atan2(TP.x-EC.fx,TP.z-EC.fz); W.fig.visible=!EC.blacked;
  if(S.t>(reduce?.05:.6)&&!EC.blacked){ EC.blacked=true; W.fig.visible=false; S.fade=1; fadeTo(1,0,'#000'); humLevel(0,.02);
    title('','CAUGHT UP','You caught up with yourself.',true); }
  if(S.t>4.2){ untitle(); arrive(true); } }
// the doors close on you and the lift goes down, further than any building has floors (rift-conv.js)
function escape(){ if(S.mode!=='back') return; S.mode='backOut'; S.backEscaped=true; sndB.ding(0,1);
  after(.5,()=>{ fadeTo(1,.5,'#000'); humLevel(0,.3); }); after(1.1,()=>{ humStop(); sndB.descend(); }); after(4.8,()=>K.go('conv')); }
function enter(){ if(!W) build(); layout((Math.random()*2147483647)|0); // never the same place twice
  W.sc.add(cam); setPal(PAL_BACK); K.fallAudioStop();
  TP.x=cx(SPAWN.i)+.4; TP.z=cx(SPAWN.j)+.9; TP.acc=0; TP.bob=0; P.yaw=Math.PI*.25; P.pitch=-.05;
  FL.next=K.rr(18,35); FL.left=0; FL.lit=true; FL.shift=false; W.cover.visible=false;
  cam.children.forEach(o=>{ if(o.isLight&&o!==W.flash) o.intensity=0; });
  echoReset(); clearPrints(); BO.on=false; BO.hinted=false; FLASH.on=false; setLights(true); S.backEscaped=false; W.fig.visible=false; W.lift.position.set(LIFT.x,0,LIFT.z); W.lift.rotation.y=Math.atan2(LIFT.nx,LIFT.nz);
  document.body.classList.add('twalk'); $('#yearVal').textContent='----'; $('#year').classList.remove('past'); $('#shiftBtn').textContent='Leave backroom'; }
// black and silent; a ballast ticks, ticks again, catches; the hum comes up with the light; you get up off the floor
function arrive(retry){ enter(); S.mode='backEnter'; S.t=0; S.fade=1; fadeTo(1,0,'#000'); S.rise=reduce?1:0;
  after(1.4,sndB.tick); after(1.85,sndB.tick);
  after(2.3,()=>{ sndB.on(); humStart(); humLevel(.9,reduce?.3:.8); fadeTo(0,reduce?.6:2.2); S.mode='back'; S.t=0; });
  if(!retry){ after(4.2,()=>title('Temporal recovery · Rift 86','—','No date. No place.')); after(8,untitle); } }
function walk(dt,inp){ const m=inp.m; if(m<=.05) return; const sp=(inp.run?3.4:1.9)*Math.min(1,m)/Math.max(1,m), yaw=P.yaw;
  const vx=(-Math.sin(yaw)*inp.f+Math.cos(yaw)*inp.s)*sp*dt, vz=(-Math.cos(yaw)*inp.f-Math.sin(yaw)*inp.s)*sp*dt;
  if(!blocked(TP.x+vx,TP.z)) TP.x+=vx; if(!blocked(TP.x,TP.z+vz)) TP.z+=vz;
  TP.bob+=dt*(inp.run?10:7.5); TP.acc+=Math.hypot(vx,vz); if(TP.acc>(inp.run?1:.8)){ TP.acc=0; sndB.step(); } }
function flicker(dt){ FL.next-=dt;
  if(FL.next<=0&&FL.left<=0&&EC.T<=40&&Math.random()<.35){ blackout(); return; }
  if(FL.next<=0&&FL.left<=0){ FL.left=K.rr(.6,1.6); const p=nearestPanel(TP.x,TP.z); W.cover.position.set(p.x,HGT-.02,p.z); W.tubeL.position.set(p.x,HGT-.4,p.z); FL.shift=true; }
  if(FL.left>0){ FL.left-=dt; const lit=FL.left<=0||Math.random()<.45; if(lit!==FL.lit){ FL.lit=lit; if(!lit) sndB.tick(); }
    if(FL.shift&&(!FL.lit||FL.left<=0)){ FL.shift=false; shift(); EC.T=Math.max(ECHO_MIN,EC.T-K.rr(ECHO_DROP[0],ECHO_DROP[1])); } // the rooms move, the past closes in
    if(FL.left<=0){ FL.next=K.rr(20,45); FL.lit=true; } }
  W.cover.visible=!FL.lit; W.tubeL.intensity=FL.lit?.9:0;
  if(hum) hum.buzz.gain.setTargetAtTime(FL.lit?1:.05,K.A().ac.currentTime,.01); } // light and buzz drop out together
function frame(dt,inp){
  if(S.mode==='back'){ walk(dt,inp); if(BO.on) blackFrame(dt); else flicker(dt); if(S.rise<1) S.rise=Math.min(1,S.rise+dt); echoFrame(dt);
    EC.dingT-=dt; if(EC.dingT<=0){ EC.dingT=K.rr(22,32); sndB.ding(K.panOf(LIFT.x,LIFT.z),K.vol(Math.hypot(LIFT.x-TP.x,LIFT.z-TP.z),2.6)); }
    if(Math.hypot(TP.x-(LIFT.x+LIFT.nx*.6),TP.z-(LIFT.z+LIFT.nz*.6))<.75) escape(); }
  else if(S.mode==='backDead') deadFrame();
  printsFrame(dt);
  const bob=reduce?0:Math.sin(TP.bob)*.03, lift=lerp(-.9,0,sstep(0,1,S.rise));   // starts low: you've just got up off the carpet
  cam.position.set(TP.x,1.6+bob+lift,TP.z); cam.rotation.set(P.pitch,P.yaw,0); cam.updateMatrixWorld();
  K.render(W.sc); }
function key(k){ if(S.mode!=='back') return; if(k==='f'){ toggleFlash(); return; } if(k==='t') msg('Time will not shift here'); else if(k>='1'&&k<='5') msg('Your records stayed in 1986'); }
function click(){ if(S.mode==='back'&&!R.touch()&&!R.locked()) R.lock(); }
function exit(){ humStop(); BO.on=false; FLASH.on=false; if(W){ setLights(true); flashBtn.hidden=true; W.cover.visible=false; W.fig.visible=false; clearPrints(); } S.rise=1; }

K.register('back',{arrive,frame,key,click,exit});
K.backDebug={L,E,FL,TP,EC,LIFT,BO,FLASH,blackout,toggleFlash,get PR(){ return W.PR; },shift,reach,cellOf,visible,eg,routeEdges,caught,escape,get RECTS(){ return RECTS; },N,NE};
})(window);
