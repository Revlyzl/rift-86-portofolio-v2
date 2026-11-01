/* Rift 86 · the Backrooms
   Not a when. You don't fall into it through a crack; you slip into it through the shut lift in the corridor while the
   Marker is there (index.html noclip → rift-travel.js noclip). Fetched the first time that happens; builds with the
   kit rift-travel.js exposes (window.__RTK).
   For now: the arrival, the hum, and rooms that go on further than they should. What lives here comes later. */
(function(root){
'use strict';
const K=root.__RTK; if(!K) return;
const {R,S,P,reduce,cam,tex,px,clamp,lerp,sstep,put,flush,after,title,untitle,msg,fadeTo,setPal,toPal}=K;
const $=s=>document.querySelector(s);

/* ================= THE PLACE =================
   A grid of 4 m cells, walls on some edges, doorways cut in some walls, a tube panel in most ceilings.
   Its own seed, so the layout is the same every time you come back. 1 unit ~ 1 m. */
const CELL=4, N=20, HGT=2.7, WT=.2, X0=-N*CELL/2;
const SPAWN={i:N/2|0,j:N/2|0};
// mono-yellow: damp wallpaper, mustard shadow, brown carpet, near-white tubes; one red kept back for later
const PAL_BACK=toPal(['#0d0b05','#1a160a','#2a2410','#3b3317','#4f451f','#655827','#7c6c30','#93813a','#a99546','#bfa955',
  '#d2bc66','#e2cd7a','#eedd93','#f6ebb5','#fff8dc','#2b1f12','#4a3820','#6b5530','#8a7a52','#c4221a']);
function rng(seed){ let s=seed>>>0||1; return ()=>{ s=(s+0x6D2B79F5)>>>0; let t=s; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61); return ((t^t>>>14)>>>0)/4294967296; }; }
const cx=i=>X0+i*CELL+CELL/2;

let W=null; const RECTS=[], PANELS=[];
function wallRect(x0,x1,z0,z1){ RECTS.push({x0,x1,z0,z1}); }
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
  // a wall along one cell edge, sometimes with a doorway cut in it
  function edge(x0,z0,x1,z1,door){ const along=x1!==x0, len=along?x1-x0:z1-z0;
    const seg=(a,b)=>{ if(b-a<.05) return; const m=(a+b)/2, l=b-a;
      if(along){ put(bx,M.wall,x0+m,HGT/2,z0,0,0,0,l,HGT,WT); put(bx,M.trim,x0+m,.05,z0,0,0,0,l,.1,WT+.04); wallRect(x0+a,x0+b,z0-WT/2,z0+WT/2); }
      else { put(bx,M.wall,x0,HGT/2,z0+m,0,0,0,WT,HGT,l); put(bx,M.trim,x0,.05,z0+m,0,0,0,WT+.04,.1,l); wallRect(x0-WT/2,x0+WT/2,z0+a,z0+b); } };
    if(door){ const d0=.8+r()*(len-2.8); seg(0,d0); seg(d0+1.2,len);
      if(along) put(bx,M.wall,x0+d0+.6,HGT-.25,z0,0,0,0,1.2,.5,WT); else put(bx,M.wall,x0,HGT-.25,z0+d0+.6,0,0,0,WT,.5,1.2); } // lintel
    else seg(0,len); }
  const openAt=(i,j)=>i===SPAWN.i&&j===SPAWN.j;
  for(let i=0;i<=N;i++) for(let j=0;j<N;j++){ const x=X0+i*CELL, z0=X0+j*CELL, outer=i===0||i===N;   // walls running along z
    if(outer) edge(x,z0,x,z0+CELL,false); else if(!openAt(i,j)&&!openAt(i-1,j)&&r()<.42) edge(x,z0,x,z0+CELL,r()<.35); }
  for(let j=0;j<=N;j++) for(let i=0;i<N;i++){ const z=X0+j*CELL, x0=X0+i*CELL, outer=j===0||j===N;   // walls running along x
    if(outer) edge(x0,z,x0+CELL,z,false); else if(!openAt(i,j)&&!openAt(i,j-1)&&r()<.42) edge(x0,z,x0+CELL,z,r()<.35); }
  // the odd square pillar standing at a corner for no reason
  for(let i=1;i<N;i++) for(let j=1;j<N;j++){ if(r()>.12) continue; const x=X0+i*CELL, z=X0+j*CELL; if(Math.abs(i-SPAWN.i-.5)<1.5&&Math.abs(j-SPAWN.j-.5)<1.5) continue;
    put(bx,M.wall,x,HGT/2,z,0,0,0,.6,HGT,.6); wallRect(x-.3,x+.3,z-.3,z+.3); }
  // tube panels: most cells, one in the middle of the ceiling
  for(let i=0;i<N;i++) for(let j=0;j<N;j++){ if(r()<.25&&!openAt(i,j)) continue; const x=cx(i), z=cx(j);
    put(pl,M.panel,x,HGT-.01,z,Math.PI/2,0,0,.6,1.2,1); PANELS.push({x,z}); }
  flush(sc);
  sc.add(new THREE.HemisphereLight(0xfff0b0,0x4a3820,1.15));
  // the one tube that fails: a dark cover laid over whichever panel is nearest you, and a light that drops with it
  const cover=new THREE.Mesh(new THREE.PlaneGeometry(.62,1.22),new THREE.MeshBasicMaterial({color:0x4f451f})); cover.rotation.x=Math.PI/2; cover.visible=false; sc.add(cover);
  const tubeL=new THREE.PointLight(0xfff0c0,.9,7,2); sc.add(tubeL);
  W={sc,cover,tubeL}; }
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
const TP={x:0,z:0,bob:0,acc:0}, FL={next:0,left:0,lit:true};
function enter(){ if(!W) build();
  W.sc.add(cam); setPal(PAL_BACK); K.fallAudioStop();
  TP.x=cx(SPAWN.i)+.4; TP.z=cx(SPAWN.j)+.9; TP.acc=0; TP.bob=0; P.yaw=Math.PI*.25; P.pitch=-.05;
  FL.next=K.rr(18,35); FL.left=0; FL.lit=true; W.cover.visible=false;
  document.body.classList.add('twalk'); $('#yearVal').textContent='----'; $('#year').classList.remove('past'); $('#shiftBtn').textContent='Leave rift'; }
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
  if(FL.next<=0&&FL.left<=0){ FL.left=K.rr(.6,1.6); const p=nearestPanel(TP.x,TP.z); W.cover.position.set(p.x,HGT-.02,p.z); W.tubeL.position.set(p.x,HGT-.4,p.z); }
  if(FL.left>0){ FL.left-=dt; const lit=FL.left<=0||Math.random()<.45; if(lit!==FL.lit){ FL.lit=lit; if(!lit) sndB.tick(); }
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
})(window);
