/* Rift 86 · rift travel
   The fall through the rift, the choice of crack, and the eras behind them (only the Cretaceous is open so far).
   index.html fetches this on the first step through and hands over its renderer, post pass, look/keys and audio
   via window.__R86; this file owns the screen until the player is sent home. */
(function(){
'use strict';
const R=window.__R86, $=s=>document.querySelector(s);
const {renderer,rt,postMat,postScene,postCam,P,reduce}=R;

/* ================= HELPERS ================= */
let seed=8606; const rnd=()=>((seed=(seed*16807)%2147483647)/2147483647); const rr=(a,b)=>a+(b-a)*rnd();
const clamp=(v,a,b)=>v<a?a:v>b?b:v, lerp=(a,b,k)=>a+(b-a)*k;
const sstep=(a,b,v)=>{ const t=clamp((v-a)/(b-a),0,1); return t*t*(3-2*t); };
const angLerp=(a,b,k)=>{ let d=((b-a+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI; return a+d*k; };
function tex(w,h,draw,rx,ry){ const c=document.createElement('canvas'); c.width=w; c.height=h; draw(c.getContext('2d'),w,h);
  const t=new THREE.CanvasTexture(c); t.magFilter=THREE.NearestFilter; t.minFilter=THREE.LinearMipmapLinearFilter;
  if(rx){ t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(rx,ry||rx); } return t; }
function px(g,c,x,y,w,h){ g.fillStyle=c; g.fillRect(x|0,y|0,w||1,h||1); }
function disc(g,c,x,y,r){ g.fillStyle=c; g.beginPath(); g.arc(x,y,r,0,7); g.fill(); }
const toPal=a=>a.map(h=>{ const c=new THREE.Color(h); return new THREE.Vector3(c.r,c.g,c.b); });
// the post pass snaps every pixel to 20 colours: the corridor keeps its own, the void and the night get theirs
const PAL_CORR=toPal(R.PAL);
const PAL_VOID=toPal(['#05060a','#0f141a','#1d2630','#3a4a58','#7f98ad','#e3ecf1','#12262a','#3b6862','#7da597','#2c1d16',
  '#6e3720','#b5622b','#f0a43c','#fff3d0','#8a2f26','#ff2a1a','#1b301f','#3c613b','#9ea198','#d9d3bf']);
const PAL_NIGHT=toPal(['#04060a','#0a0f15','#111a22','#1a2630','#28394a','#3f566b','#7f98ad','#e3ecf1','#0a130d','#112016',
  '#1b301f','#2a462c','#3c613b','#191510','#2c241b','#463a2b','#ff2a1a','#9e130b','#f0a43c','#fff3d0']);
const setPal=p=>{ postMat.uniforms.pal.value=p; };
const V=(x,y,z)=>new THREE.Vector3(x,y,z), tv=V(0,0,0), tv2=V(0,0,0), tq=new THREE.Quaternion(), te=new THREE.Euler();

const cam=new THREE.PerspectiveCamera(68,innerWidth/innerHeight,.05,300); cam.rotation.order='YXZ';
addEventListener('resize',()=>{ cam.aspect=innerWidth/innerHeight; cam.updateProjectionMatrix(); });
function render(sc){ renderer.setRenderTarget(rt); renderer.render(sc,cam); renderer.setRenderTarget(null); renderer.render(postScene,postCam); }
function onScreen(x,y,z,m){ tv.set(x,y,z).project(cam); return tv.z<1&&Math.abs(tv.x)<(m||.95)&&Math.abs(tv.y)<(m||.95); }

/* ================= UI ================= */
const css=`
#tFade{position:fixed;inset:0;z-index:9;background:#000;opacity:0;pointer-events:none}
.tui{position:fixed;z-index:11;pointer-events:none;color:var(--ink);text-shadow:2px 2px 0 #000}
#tCap{left:50%;bottom:11%;transform:translateX(-50%);width:min(92vw,720px);text-align:center;font-size:clamp(22px,3.4vw,30px);min-height:1.3em}
#tTitle{left:50%;top:50%;transform:translate(-50%,-50%);text-align:center;width:min(92vw,640px);opacity:0;transition:opacity .9s steps(6)}
#tTitle.on{opacity:1}
#tTitle h2{font-family:var(--px);font-weight:700;font-size:clamp(22px,5vw,38px);line-height:1.1;margin:6px 0;color:#fff;text-shadow:3px 3px 0 #6e3720}
#tTitle p{margin:0;color:var(--dim)}
#tTitle.dead h2{color:#ff2a1a;text-shadow:3px 3px 0 #3a0705;letter-spacing:.12em}
#tSkip{position:fixed;z-index:11;right:max(16px,env(safe-area-inset-right));bottom:max(16px,env(safe-area-inset-bottom))}
.tpick{position:fixed;z-index:11;left:0;top:0;padding:0;border:0;background:none;cursor:pointer;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;transform:translateX(-50%)}
.tpick span{display:block;font-family:var(--px);font-size:10px;letter-spacing:.06em;text-transform:uppercase;text-align:center;white-space:nowrap;
  background:rgba(10,12,15,.9);border:2px solid #434b50;padding:5px 8px;color:var(--ink)}
.tpick span small{display:block;font-family:var(--vt);font-size:17px;letter-spacing:0;text-transform:none;color:var(--dim)}
.tpick span em{display:block;font-style:normal;font-family:var(--vt);font-size:15px;letter-spacing:0;text-transform:none;color:var(--rust)}
.tpick:hover span,.tpick:focus-visible span{border-color:var(--amber);color:var(--amber)}
.tpick:focus-visible{outline:none}
.tpick.locked span{color:var(--mute);border-color:#2a3136}
.tpick.locked:hover span,.tpick.locked:focus-visible span{border-color:var(--rust);color:var(--rust)}
#tMsg{left:50%;top:22%;transform:translateX(-50%);font-family:var(--px);font-size:11px;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap;
  background:rgba(10,12,15,.9);border:2px solid var(--rust);padding:6px 10px;opacity:0;transition:opacity .3s steps(3)}
#tMsg.on{opacity:1}
#tObj{left:50%;bottom:calc(16px + env(safe-area-inset-bottom));transform:translateX(-50%);text-align:center;font-size:18px;color:var(--dim);opacity:0;transition:opacity .6s steps(4)}
#tObj.on{opacity:1}
#tObj b{display:block;font-family:var(--px);font-size:11px;font-weight:400;letter-spacing:.08em;text-transform:uppercase;color:var(--amber);margin-bottom:2px}
body.travel .labels,body.travel .dock,body.travel .aim,body.travel .xhair{display:none!important}
body.travel:not(.twalk) .stick{display:none!important}
#tJump{position:fixed;z-index:6;right:calc(16px + env(safe-area-inset-right));bottom:calc(96px + env(safe-area-inset-bottom));padding:12px 16px;display:none}
body.touch.twalk #tJump{display:block}
@media (pointer:coarse){#tObj{left:auto;right:calc(12px + env(safe-area-inset-right));transform:none;text-align:right}}
body.touch #tObj{left:auto;right:calc(12px + env(safe-area-inset-right));transform:none;text-align:right}`;
const sty=document.createElement('style'); sty.textContent=css; document.head.appendChild(sty);
function el(tag,id,cls){ const e=document.createElement(tag); if(id) e.id=id; if(cls) e.className=cls; document.body.appendChild(e); return e; }
const fadeEl=el('div','tFade'), capEl=el('div','tCap','tui'), titleEl=el('div','tTitle','tui'), msgEl=el('div','tMsg','tui'), objEl=el('div','tObj','tui');
capEl.setAttribute('aria-live','polite'); titleEl.setAttribute('aria-live','polite');
const skipEl=el('button','tSkip','pbtn'); skipEl.type='button'; skipEl.textContent='Skip ▸▸'; skipEl.title='Skip (Space)'; skipEl.hidden=true;
skipEl.addEventListener('click',()=>skip());
const jumpEl=el('button','tJump','pbtn'); jumpEl.type='button'; jumpEl.textContent='Jump'; jumpEl.addEventListener('click',()=>jump());
function title(kick,h,p,dead){ titleEl.className='tui on'+(dead?' dead':''); titleEl.innerHTML=`${kick?`<div class="kick">${kick}</div>`:''}<h2>${h}</h2>${p?`<p>${p}</p>`:''}`; }
const untitle=()=>{ titleEl.classList.remove('on'); };
let msgT=0; function msg(t,sec){ msgEl.textContent=t; msgEl.classList.add('on'); msgT=sec||2.4; }
function objective(head,line){ objEl.innerHTML=`<b>${head}</b>${line||''}`; objEl.classList.add('on'); }

/* ================= STATE ================= */
const S={active:false,mode:null,t:0,T:0,fade:0,fadeTo:0,fadeRate:1,glitch:0,cap:'',capT:0,leaving:false};
let Q=[]; const after=(sec,fn)=>Q.push({at:S.T+sec,fn});
function fadeTo(v,sec,color){ if(color) fadeEl.style.background=color; S.fadeTo=v; S.fadeRate=sec>0?1/sec:1e6; }
function caption(t){ S.cap=t; S.capT=0; }

/* ================= AUDIO ================= */
const A=()=>R.audio();
// a short-lived panned output: sounds placed left/right of the listener, dropped once they have played
function pout(pan,gain){ const a=A(); if(!a) return null; const g=a.ac.createGain(); g.gain.value=gain; let p=null;
  if(a.ac.createStereoPanner){ p=a.ac.createStereoPanner(); p.pan.value=clamp(pan,-1,1); g.connect(p).connect(a.master); } else g.connect(a.master);
  setTimeout(()=>{ try{ g.disconnect(); if(p) p.disconnect(); }catch(e){} },5000); return g; }
function swell(t,dur,type,freq,peak,dest){ const a=A(); const s=a.ac.createBufferSource(); s.buffer=a.nb; s.loop=true; const f=a.ac.createBiquadFilter(); f.type=type; f.frequency.value=freq;
  const g=a.ac.createGain(); g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(peak,t+dur*.4); g.gain.linearRampToValueAtTime(0,t+dur);
  s.connect(f).connect(g).connect(dest); s.start(t); s.stop(t+dur+.05); return f; }
const snd={
  rustle(pan,v){ const a=A(); if(!a) return; const d=pout(pan,v), t=a.ac.currentTime; a.noise(t,.4,'bandpass',900+Math.random()*900,1.1,.55,.28,d); a.noise(t+.1,.3,'highpass',2600,.7,.16,.2,d); },
  click(pan,v){ const a=A(); if(!a) return; const d=pout(pan,v), t=a.ac.currentTime; const n=3+(Math.random()*4|0), f=650+Math.random()*350;
    for(let i=0;i<n;i++){ const tt=t+i*(.06+Math.random()*.05); a.tone(tt,'square',f,f*.7,.07,.002,.03,d); a.noise(tt,.05,'bandpass',1700,5,.18,.03,d); } },
  breath(pan,v){ const a=A(); if(!a) return; const d=pout(pan,v), t=a.ac.currentTime; swell(t,1.5,'lowpass',340,.5,d); swell(t+1.6,1.1,'lowpass',260,.35,d); },
  growl(pan,v){ const a=A(); if(!a) return; const d=pout(pan,v), t=a.ac.currentTime; a.tone(t,'sawtooth',78,58,.16,.2,1.1,d); a.tone(t,'square',39,30,.08,.2,1.1,d); swell(t,1.3,'lowpass',260,.3,d); },
  screech(){ const a=A(); if(!a) return; const d=pout(0,1), t=a.ac.currentTime; a.noise(t,1.1,'highpass',1300,.7,.9,.9,d);
    a.tone(t,'sawtooth',1500,360,.4,.01,.85,d); a.tone(t,'square',2700,800,.2,.01,.6,d); a.tone(t+.02,'sawtooth',1110,300,.25,.01,.8,d); a.tone(t,'sine',95,38,.7,.01,1,d); },
  // lub-dub: a deep sine for the body, a triangle and a muffled knock so it still reads on small speakers
  heart(v){ const a=A(); if(!a) return; const t=a.ac.currentTime;
    for(const [o,k] of [[0,1],[.2,.72]]){ a.tone(t+o,'sine',64,38,.55*v*k,.004,.18); a.tone(t+o,'triangle',130,70,.22*v*k,.003,.1); a.noise(t+o,.12,'lowpass',220,.8,.3*v*k,.08); } },
  step(){ const a=A(); if(!a) return; const t=a.ac.currentTime, v=.8+Math.random()*.3; a.tone(t,'sine',85,44,.2*v,.004,.12); a.noise(t,.18,'lowpass',520,.9,.2*v,.1);
    a.noise(t+.03,.2,'bandpass',2200+Math.random()*900,1.4,.07*v,.14); }, // leaf litter
  chime(){ const a=A(); if(!a) return; const t=a.ac.currentTime; [880,1320,1760,2640].forEach((f,i)=>a.tone(t+i*.07,'triangle',f,f,.08,.005,.9)); a.noise(t,.8,'bandpass',5000,3,.05,.7); },
  crackle(){ const a=A(); if(!a) return; const t=a.ac.currentTime; for(let i=0;i<6;i++) a.noise(t+i*.05,.06,'bandpass',2500+Math.random()*2500,3,.2,.05); a.tone(t,'square',180,70,.08,.01,.4); },
  whoosh(){ const a=A(); if(!a) return; const t=a.ac.currentTime; const f=a.noise(t,1.6,'bandpass',300,1.2,.5,1.4); f.frequency.setValueAtTime(300,t); f.frequency.exponentialRampToValueAtTime(3200,t+1.4);
    a.tone(t,'sawtooth',50,700,.12,.9,.5); },
  thud(){ const a=A(); if(!a) return; const t=a.ac.currentTime; a.tone(t,'sine',64,30,.6,.01,.8); a.noise(t,.5,'lowpass',240,1,.4,.4); },
  call(){ const a=A(); if(!a) return; const d=pout(Math.random()*1.6-.8,.5), t=a.ac.currentTime; const lp=a.ac.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=420; lp.connect(d);
    a.tone(t,'sawtooth',96,72,.3,.5,2.2,lp); a.tone(t+.05,'sawtooth',101,70,.2,.5,2.2,lp); }
};
// fall: wind rushing past and a low drone
let fallA=null;
function fallAudio(level,wind){ const a=A(); if(!a) return; const {ac,master,nb}=a;
  if(!fallA){ const g=ac.createGain(); g.gain.value=0; g.connect(master);
    const w=ac.createBufferSource(); w.buffer=nb; w.loop=true; const bp=ac.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=500; bp.Q.value=.6; const wg=ac.createGain(); wg.gain.value=.55; w.connect(bp).connect(wg).connect(g); w.start();
    const lp=ac.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=200; lp.connect(g);
    const os=[41,41.7,61.8].map(f=>{ const o=ac.createOscillator(), og=ac.createGain(); o.type='sawtooth'; o.frequency.value=f; og.gain.value=.09; o.connect(og).connect(lp); o.start(); return o; });
    fallA={g,bp,wg,w,os}; }
  const t=ac.currentTime; fallA.g.gain.setTargetAtTime(level,t,.35); fallA.wg.gain.setTargetAtTime(.1+wind*.6,t,.3); fallA.bp.frequency.setTargetAtTime(380+wind*1500,t,.3); }
function fallAudioStop(){ if(!fallA) return; const f=fallA; fallA=null; const a=A(); f.g.gain.setTargetAtTime(0,a.ac.currentTime,.4);
  setTimeout(()=>{ try{ f.w.stop(); f.os.forEach(o=>o.stop()); f.g.disconnect(); }catch(e){} },2500); }
// night in the sinkhole: two insect choruses, leaves, a sub drone. The insects fall silent when something hunts.
let night=null;
function nightAudio(level){ const a=A(); if(!a) return; const {ac,master,nb}=a;
  if(!night){ const out=ac.createGain(); out.gain.value=0; out.connect(master); const ins=ac.createGain(); ins.connect(out);
    for(const [f,rate,lv] of [[4300,17,.05],[6300,23,.032],[3100,9,.022]]){ const s=ac.createBufferSource(); s.buffer=nb; s.loop=true; s.playbackRate.value=.9+Math.random()*.2;
      const bp=ac.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=f; bp.Q.value=9; const g=ac.createGain(); g.gain.value=lv*.5;
      const l=ac.createOscillator(), lg=ac.createGain(); l.type='square'; l.frequency.value=rate; lg.gain.value=lv*.5; l.connect(lg).connect(g.gain); l.start();
      const sw=ac.createOscillator(), swg=ac.createGain(); sw.frequency.value=.04+Math.random()*.06; swg.gain.value=lv*.35; sw.connect(swg).connect(g.gain); sw.start();
      s.connect(bp).connect(g).connect(ins); s.start(); }
    const w=ac.createBufferSource(); w.buffer=nb; w.loop=true; const lp=ac.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=420; const wg=ac.createGain(); wg.gain.value=.06;
    const wl=ac.createOscillator(), wlg=ac.createGain(); wl.frequency.value=.08; wlg.gain.value=.045; wl.connect(wlg).connect(wg.gain); wl.start(); w.connect(lp).connect(wg).connect(out); w.start();
    const sub=ac.createOscillator(), sg=ac.createGain(); sub.frequency.value=33; sg.gain.value=.08; sub.connect(sg).connect(out); sub.start();
    night={out,ins}; }
  night.out.gain.setTargetAtTime(level,ac.currentTime,level?1.2:.08); }
function insects(k){ if(night) night.ins.gain.setTargetAtTime(k,A().ac.currentTime,.6); }

/* ================= PREVIEWS: what each crack opens onto ================= */
const PW=48, PH=80;
function sky(g,w,h,stops){ const gr=g.createLinearGradient(0,0,0,h); stops.forEach((c,i)=>gr.addColorStop(i/(stops.length-1),c)); g.fillStyle=gr; g.fillRect(0,0,w,h); }
function stars(g,w,h,n,c){ for(let i=0;i<n;i++) px(g,c,rnd()*w,rnd()*h); }
const PREV={
  cret:()=>tex(PW,PH,(g,w,h)=>{ sky(g,w,h,['#0a0f15','#111a22','#1a2630']); stars(g,w,h*.6,40,'#7f98ad');
    disc(g,'#e3ecf1',31,18,7); px(g,'#7f98ad',28,15,3,2); px(g,'#7f98ad',33,21,2,2); px(g,'#7f98ad',30,22,2,1);
    g.fillStyle='#04060a'; g.beginPath(); g.moveTo(0,0); g.lineTo(9,0); g.lineTo(6,30); g.lineTo(10,h); g.lineTo(0,h); g.fill();
    g.beginPath(); g.moveTo(w,0); g.lineTo(w-8,0); g.lineTo(w-5,34); g.lineTo(w-11,h); g.lineTo(w,h); g.fill();
    for(let i=0;i<9;i++){ const x=4+i*5+rnd()*3, y=h-10-rnd()*16; g.fillStyle='#0a130d'; g.fillRect(x,y,2,h-y); for(let k=0;k<5;k++) g.fillRect(x-4+k*2,y-1+Math.abs(k-2),2,2); }
    g.fillStyle='#04060a'; g.fillRect(0,h-9,w,9); px(g,'#ff2a1a',15,h-14); px(g,'#ff2a1a',17,h-14); }),
  med:()=>tex(PW,PH,(g,w,h)=>{ sky(g,w,h,['#1d2630','#6e3720','#b5622b','#f0a43c']); disc(g,'#fff3d0',34,46,5);
    g.fillStyle='#1d2630'; g.beginPath(); g.moveTo(0,h); g.lineTo(0,58); g.quadraticCurveTo(24,48,w,60); g.lineTo(w,h); g.fill();
    g.fillStyle='#0f141a'; g.fillRect(10,40,26,20); g.fillRect(8,30,7,30); g.fillRect(31,26,7,34); g.fillRect(20,34,6,26);
    for(const x of [8,11,14,31,34,37,20,23]) g.fillRect(x,x>28?24:(x>18?32:28),2,2);
    px(g,'#f0a43c',33,34); px(g,'#f0a43c',11,38); px(g,'#f0a43c',22,44); px(g,'#8a2f26',33,20,1,6); px(g,'#8a2f26',34,20,3,2);
    for(let i=0;i<4;i++){ const x=6+rnd()*36, y=8+rnd()*16; px(g,'#0f141a',x,y,3,1); px(g,'#0f141a',x+1,y-1); } }),
  atom:()=>tex(PW,PH,(g,w,h)=>{ sky(g,w,h,['#3a4a58','#9ea198','#f0a43c','#b5622b']);
    g.fillStyle='#b5622b'; g.fillRect(20,32,8,32); g.fillStyle='#6e3720'; g.fillRect(17,44,14,3);
    for(const [x,y,r,c] of [[24,24,12,'#6e3720'],[15,25,7,'#b5622b'],[33,25,7,'#b5622b'],[24,21,9,'#f0a43c'],[24,22,5,'#fff3d0'],[18,19,4,'#f0a43c'],[30,19,4,'#f0a43c']]) disc(g,c,x,y,r);
    g.fillStyle='#2c1d16'; let x=0; while(x<w){ const bw=3+(rnd()*5|0), bh=6+(rnd()*14|0); g.fillRect(x,h-bh,bw,bh); x+=bw+1; } g.fillRect(0,h-5,w,5);
    g.strokeStyle='rgba(227,236,241,.8)'; g.lineWidth=1; for(let i=0;i<3;i++){ let cx=24,cy=40; g.beginPath(); g.moveTo(cx,cy); for(let k=0;k<5;k++){ cx+=rr(-8,8); cy+=rr(-9,9); g.lineTo(cx|0,cy|0); } g.stroke(); } }),
  sea:()=>tex(PW,PH,(g,w,h)=>{ sky(g,w,h,['#7da597','#3b6862','#12262a']); for(let y=40;y<h;y+=4) for(let x=(y%8);x<w;x+=8) px(g,'#7da597',x,y,4,1); disc(g,'#fff3d0',12,16,4); }),
  ice:()=>tex(PW,PH,(g,w,h)=>{ sky(g,w,h,['#3a4a58','#7f98ad','#e3ecf1']); g.fillStyle='#e3ecf1'; g.beginPath(); g.moveTo(0,h); g.lineTo(8,46); g.lineTo(18,58); g.lineTo(30,38); g.lineTo(w,60); g.lineTo(w,h); g.fill(); }),
  sand:()=>tex(PW,PH,(g,w,h)=>{ sky(g,w,h,['#b5622b','#f0a43c','#fff3d0']); g.fillStyle='#6e3720'; g.beginPath(); g.moveTo(8,62); g.lineTo(24,38); g.lineTo(40,62); g.fill(); g.fillStyle='#b5622b'; g.fillRect(0,62,w,h); }),
  space:()=>tex(PW,PH,(g,w,h)=>{ sky(g,w,h,['#05060a','#0f141a']); stars(g,w,h,60,'#e3ecf1'); disc(g,'#3b6862',30,52,12); disc(g,'#7da597',27,49,5); }),
  city:()=>tex(PW,PH,(g,w,h)=>{ sky(g,w,h,['#12262a','#3b6862','#b5622b']); let x=0; while(x<w){ const bw=6+(rnd()*8|0), bh=20+(rnd()*34|0); g.fillStyle='#0f141a'; g.fillRect(x,h-bh,bw,bh);
    for(let wy=h-bh+3;wy<h-2;wy+=4) for(let wx=x+1;wx<x+bw-1;wx+=2) if(rnd()<.4) px(g,'#f0a43c',wx,wy); x+=bw+1; } }),
  red:()=>tex(PW,PH,(g,w,h)=>{ sky(g,w,h,['#2c1d16','#8a2f26','#b5622b']); g.fillStyle='#6e3720'; g.fillRect(0,58,w,h); disc(g,'#d9d3bf',36,14,2); }),
  // crossover egg, a nod to Cronos: a steelworks district of concrete blocks, winter smog, 1980s
  huta:()=>tex(PW,PH,(g,w,h)=>{ sky(g,w,h,['#3a4a58','#7f98ad','#9ea198']); g.fillStyle='#0f141a'; g.fillRect(34,22,4,40); g.fillRect(40,30,3,32);
    for(let i=0;i<7;i++) disc(g,i%2?'#9ea198':'#7f98ad',36+i*1.5,20-i*3,2+i*.6);
    for(const [x,y,bw] of [[0,46,16],[17,40,14],[30,52,18]]){ g.fillStyle='#1d2630'; g.fillRect(x,y,bw,h-y); for(let wy=y+2;wy<h-6;wy+=3) for(let wx=x+1;wx<x+bw-1;wx+=2) px(g,rnd()<.15?'#f0a43c':'#0f141a',wx,wy); }
    g.fillStyle='#d9d3bf'; g.fillRect(0,h-5,w,5); }),
  // crossover egg, a nod to Dead Space: a cracked planet, a ship broken in two, something red still lit aboard
  ship:()=>tex(PW,PH,(g,w,h)=>{ sky(g,w,h,['#05060a','#0f141a']); stars(g,w,h,50,'#9ea198'); disc(g,'#6e3720',8,72,22); disc(g,'#2c1d16',12,76,16);
    g.strokeStyle='#ff2a1a'; g.lineWidth=1; g.beginPath(); g.moveTo(0,58); g.lineTo(10,64); g.lineTo(18,58); g.lineTo(26,66); g.stroke();
    for(const [x,y,sz] of [[30,50,3],[26,44,2],[36,58,2]]) px(g,'#6e3720',x,y,sz,sz);
    g.fillStyle='#3a4a58'; g.fillRect(8,24,20,5); g.fillRect(31,19,13,5); g.fillStyle='#1d2630'; g.fillRect(8,28,20,2); g.fillRect(27,22,4,3);
    for(let x=10;x<27;x+=3) px(g,rnd()<.3?'#f0a43c':'#0f141a',x,26); px(g,'#8a2f26',34,20,4,4); px(g,'#ff2a1a',35,21,2,2); })
};
const EXTRA=['sea','ice','sand','space','city','red'];

/* a crack in time: a stack of jagged strips, glowing at the edges, with another when showing through */
function crack(o){ const g=new THREE.Group(), n=o.n||22, sh=o.h/n, bits=[]; let s=o.seed||1; const r=()=>((s=(s*16807+11)%2147483647)/2147483647);
  const em=new THREE.MeshBasicMaterial({color:o.edge,transparent:true,opacity:o.dim?.4:.9,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false,fog:false});
  const wm=o.tex?new THREE.MeshBasicMaterial({map:o.tex,side:THREE.DoubleSide,color:o.dim?0x777777:0xffffff,fog:false})
    :new THREE.MeshBasicMaterial({color:0xfff3d0,transparent:true,opacity:.95,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false,fog:false});
  const span=o.w*1.45;
  for(let i=0;i<n;i++){ const k=i/(n-1), y=(i+.5)*sh-o.h/2;
    const x=Math.sin(i*.9+o.seed)*o.w*.16+Math.sin(i*2.3+o.seed*.3)*o.w*.06;
    const w=o.w*(.1+Math.pow(Math.sin(k*Math.PI),.8)*.9)*(.82+r()*.36);
    const e=new THREE.Mesh(new THREE.PlaneGeometry(w+o.w*.22,sh*1.1),em); e.position.set(x,y,-.01); g.add(e);
    const ww=o.tex?w:w*.35, wg=new THREE.PlaneGeometry(ww,sh*1.02);
    if(o.tex){ const uv=wg.attributes.uv, u0=.5+(x-ww/2)/span, u1=.5+(x+ww/2)/span, v0=(y-sh/2)/o.h+.5, v1=(y+sh/2)/o.h+.5;
      uv.setXY(0,u0,v1); uv.setXY(1,u1,v1); uv.setXY(2,u0,v0); uv.setXY(3,u1,v0); }
    const m=new THREE.Mesh(wg,wm); m.position.set(x,y,0); g.add(m); bits.push({e,m,x,ph:r()*6}); }
  return {g,bits,em,wm,o}; }
function shimmer(c,t,amt){ for(const b of c.bits){ const j=Math.sin(t*7+b.ph)*.02*amt+(Math.random()<.04*amt?(Math.random()-.5)*.1:0);
  b.e.position.x=b.x+j; b.m.position.x=b.x+j*.5; b.e.scale.x=1+Math.sin(t*3+b.ph)*.22*amt; } }

/* ================= THE FALL ================= */
const ERAS=[
  {key:'cret',date:'c. 130,000,000 BC',name:'Early Cretaceous',note:'Contains jump scares',edge:0xf0a43c},
  {key:'med',date:'c. AD 1350',name:'Middle Ages',locked:true,edge:0x7da597,sealed:'Sealed · this crack will not hold yet'},
  {key:'atom',date:'AD 2030',name:'The last second',locked:true,edge:0xb5622b,sealed:'Sealed · the blast froze this one shut'},
  {key:'ship',date:'AD 2508',name:'Adrift',locked:true,secret:true,edge:0xff2a1a,tag:'Something is still aboard',sealed:'Sealed · make us whole'}
];
const T_SLOW=reduce?0:7.2, DEC_T=1.8, V_MAX=24, SPIN=.22;
let F=null;
function buildFall(){
  const sc=new THREE.Scene(); sc.background=new THREE.Color(0x05060a); sc.fog=new THREE.FogExp2(0x05060a,.02);
  const extra=EXTRA.map(k=>PREV[k]()), cols=[0xf0a43c,0x7da597,0xb5622b,0xd9d3bf,0x3b6862,0x8a2f26];
  const cracks=[];
  for(let i=0;i<48;i++){ const c=crack({h:rr(1.4,4.4),w:rr(.45,1.1),seed:i*7+3,tex:rnd()<.55?extra[i%extra.length]:null,edge:cols[i%cols.length]}); sc.add(c.g); cracks.push(c); }
  // speed streaks, recycled below the camera as it falls
  const SN=240, sp=new Float32Array(SN*6), sb=[];
  for(let i=0;i<SN;i++){ const a=rnd()*6.283, r=rr(1.2,20); sb.push({x:Math.cos(a)*r,z:Math.sin(a)*r,y:-rr(0,160),l:rr(1.5,5)}); }
  const sg=new THREE.BufferGeometry(); sg.setAttribute('position',new THREE.BufferAttribute(sp,3));
  const sm=new THREE.LineBasicMaterial({color:0x9ea198,transparent:true,opacity:.5,blending:THREE.AdditiveBlending,depthWrite:false,fog:true});
  const streaks=new THREE.LineSegments(sg,sm); streaks.frustumCulled=false; sc.add(streaks);
  // floating shards of other times
  const deb=[]; const dm=[0x6e3720,0x3b6862,0x434b50,0x9ea198].map(c=>new THREE.MeshBasicMaterial({color:c}));
  for(let i=0;i<50;i++){ const s=rr(.05,.3), m=new THREE.Mesh(new THREE.BoxGeometry(s,s*rr(.3,1),s*rr(.4,1.5)),dm[i%4]); sc.add(m); deb.push({m,r:V(rnd(),rnd(),rnd())}); }
  const picks=ERAS.map((e,i)=>{ e.tex=PREV[e.key](); const c=crack({h:3.8,w:1.25,seed:101+i*13,tex:e.tex,edge:e.edge,n:30,dim:e.locked}); c.g.visible=false; sc.add(c.g); return c; });
  F={huta:PREV.huta(),sc,cracks,sb,sg,sp,sm,deb,picks,y:0,v:0,yaw:0,pitch:-1.2,placed:false,yStop:0,yawEnd:0,dec:0,hov:-1,shake:[0,0,0,0],pick:null,mx:0,my:0};
}
function placeAmbient(c,top){ const a=rnd()*6.283, r=rr(2.4,15); c.g.position.set(Math.cos(a)*r,top-rr(4,150),Math.sin(a)*r);
  c.g.rotation.set(rr(-.4,.4),rnd()*6.283,rr(-.5,.5)); c.g.scale.setScalar(rr(.7,1.5)); }
function placePicks(yStop,yaw){ F.placed=true; F.yStop=yStop; F.yawEnd=yaw;
  const fx=-Math.sin(yaw), fz=-Math.cos(yaw), rx=Math.cos(yaw), rz=-Math.sin(yaw);
  const vis=ERAS.map((e,i)=>i).filter(i=>!ERAS[i].secret||S.marked), n=vis.length, gap=n>3?3:3.3, dist=n>3?8.6:7.5;
  F.center=V(fx*dist,yStop,fz*dist);
  F.picks.forEach((c,i)=>{ const k=vis.indexOf(i); c.g.visible=k>=0; if(k<0) return; const o=(k-(n-1)/2)*gap;
    c.g.position.set(F.center.x+rx*o,yStop+.1,F.center.z+rz*o); c.g.rotation.set(0,yaw,0); c.home=c.g.position.clone(); });
  // clear the ambient cracks out of the way of the three
  for(const c of F.cracks) if(c.g.position.distanceTo(F.center)<7 || Math.abs(c.g.position.y-yStop)<3&&Math.hypot(c.g.position.x,c.g.position.z)<3) placeAmbient(c,yStop-12);
}
let pickEls=[];
function buildPickUI(){ pickEls=ERAS.map((e,i)=>{ const b=el('button',null,'tpick'+(e.locked?' locked':'')); b.type='button'; b.hidden=true;
  b.innerHTML=`<span>${e.date}<small>${e.name}</small><em>${e.locked?(e.tag||'Sealed'):e.note}</em></span>`;
  b.setAttribute('aria-label',`${e.date}, ${e.name}${e.locked?', sealed':''}`);
  b.addEventListener('click',()=>choose(i)); b.addEventListener('mouseenter',()=>{ F.hov=i; }); b.addEventListener('mouseleave',()=>{ if(F.hov===i) F.hov=-1; });
  b.addEventListener('focus',()=>{ F.hov=i; }); b.addEventListener('blur',()=>{ if(F.hov===i) F.hov=-1; }); return b; }); }
addEventListener('mousemove',e=>{ if(F){ F.mx=(e.clientX/innerWidth)*2-1; F.my=(e.clientY/innerHeight)*2-1; } });

function startFall(){ if(!F) buildFall(); if(!pickEls.length) buildPickUI();
  F.y=0; F.v=0; F.yaw=rnd()*6.283; F.pitch=-1.2; F.placed=false; F.pick=null;
  S.marked=!!(R.marked&&R.marked());
  // marked by the crossover egg: some cracks bleed red, some open on Nowa Huta
  F.cracks.forEach((c,i)=>{ placeAmbient(c,-2); c.em.color.setHex(S.marked&&i%4===0?0xff2a1a:c.o.edge); if(c.o.tex) c.wm.map=S.marked&&i%5===0?F.huta:c.o.tex; });
  for(const c of F.picks) c.g.visible=false;
  for(const b of F.sb){ b.y=-rr(0,160); }
  for(const d of F.deb){ const a=rnd()*6.283, r=rr(.8,10); d.m.position.set(Math.cos(a)*r,-rr(2,150),Math.sin(a)*r); }
  F.sc.add(cam); setPal(PAL_VOID); S.mode='fall'; S.t=0;
  fadeTo(1,0,'#fff3d0'); S.fade=1; fadeTo(0,.9);
  if(reduce){ toChoose(); return; }
  skipEl.hidden=false; fallAudio(.9,0); snd.whoosh();
  after(.9,()=>{ if(S.mode==='fall') caption('You fall through the rift.'); });
  after(3.1,()=>{ if(S.mode==='fall') caption(S.marked?'Something else fell with you.':'Not one crack in time. Thousands.'); });
  after(5.3,()=>{ if(S.mode==='fall') caption(S.marked?'Every crack is a when. Some are a what.':'Each one opens on a different when.'); });
}
function skip(){ if(S.mode==='fall') toChoose(); }
function toChoose(){ if(!F.placed) placePicks(F.y-6,F.yaw);
  F.y=F.yStop; F.yaw=F.yawEnd; F.v=0; F.pitch=0; S.mode='choose'; S.t=0; skipEl.hidden=true; caption('Choose a when.');
  if(S.fade<.5){ fadeTo(.6,0,'#fff3d0'); S.fade=.6; fadeTo(0,.6); }
  S.glitch=Math.max(S.glitch,.6); fallAudio(.35,0); R.unlock();
  pickEls.forEach((b,i)=>{ b.hidden=!F.picks[i].g.visible; }); setTimeout(()=>{ if(S.mode==='choose'&&!R.touch()) pickEls[0].focus({preventScroll:true}); },400); }
function choose(i){ if(S.mode!=='choose'||!F.picks[i]||!F.picks[i].g.visible) return; const e=ERAS[i];
  if(e.locked){ F.shake[i]=.5; snd.crackle(); S.glitch=Math.max(S.glitch,e.secret?.9:.35); if(e.secret&&R.sfx.whisper) R.sfx.whisper(); msg(e.sealed); return; }
  S.mode='go'; S.t=0; F.pick=i; pickEls.forEach(b=>{ b.hidden=true; b.blur(); }); caption(''); snd.whoosh(); fallAudio(.8,1);
  after(.75,()=>fadeTo(1,.6,'#000')); after(1.5,arrive); }
function fallFrame(dt){ const t=S.t;
  if(S.mode==='fall'){
    if(t<T_SLOW){ F.v=lerp(F.v,V_MAX,1-Math.exp(-dt*1.1)); F.yaw+=dt*SPIN*F.v/V_MAX; }
    else { if(!F.placed){ F.dec=F.v/DEC_T; const dist=F.v*DEC_T/2, dyaw=SPIN*F.v/V_MAX*DEC_T/2; placePicks(F.y-dist,F.yaw+dyaw); F.y0=F.y; F.yaw0=F.yaw; F.v0=F.v; }
      const k=clamp((t-T_SLOW)/DEC_T,0,1); F.v=F.v0*(1-k);
      // exact ease to the stop so the three cracks land where they were placed
      F.y=F.y0-F.v0*DEC_T*(k-k*k/2); F.yaw=F.yaw0+(F.yawEnd-F.yaw0)*(2*k-k*k); }
    if(t<T_SLOW) F.y-=F.v*dt;
    F.pitch=t<T_SLOW?-1.2+Math.sin(t*.6)*.08:lerp(-1.2,0,sstep(T_SLOW,T_SLOW+DEC_T,t));
    fallAudio(.9,F.v/V_MAX);
    if(t>=T_SLOW+DEC_T) toChoose();
  }
  const sp=F.v/V_MAX;
  cam.position.set(0,F.y,0);
  if(S.mode==='go'){ const k=sstep(0,1.4,t); cam.position.lerp(F.picks[F.pick].home,k*.92); }
  cam.rotation.set(F.pitch+(S.mode==='choose'?-F.my*.06:0),F.yaw+(S.mode==='choose'?-F.mx*.08:0),S.mode==='fall'?Math.sin(S.t*.7)*.22*sp:0);
  // ambient cracks: recycle the ones left above, drift and shimmer the rest
  for(const c of F.cracks){ if(c.g.position.y>F.y+5) placeAmbient(c,F.y-10); c.g.rotation.y+=dt*.1; shimmer(c,S.T,1); }
  const P2=F.sp; for(let i=0;i<F.sb.length;i++){ const b=F.sb[i]; if(b.y>F.y+6) b.y=F.y-rr(60,160); const l=b.l*(.3+sp*1.6);
    P2[i*6]=b.x; P2[i*6+1]=b.y; P2[i*6+2]=b.z; P2[i*6+3]=b.x; P2[i*6+4]=b.y+l; P2[i*6+5]=b.z; }
  F.sg.attributes.position.needsUpdate=true; F.sm.opacity=.06+sp*.5;
  for(const d of F.deb){ if(d.m.position.y>F.y+5) d.m.position.y=F.y-rr(40,150); d.m.rotation.x+=dt*d.r.x; d.m.rotation.y+=dt*d.r.y; }
  // the three
  if(F.placed) F.picks.forEach((c,i)=>{ if(!c.g.visible) return; const e=ERAS[i], hov=F.hov===i&&S.mode==='choose';
    shimmer(c,S.T+i,e.locked?.5:1.2);
    if(e.secret){ c.em.opacity=.25+Math.pow(Math.max(0,Math.sin(S.T*2.4)),8)*.75; c.wm.color.setHex(hov?0xbbbbbb:0x888888); } // a slow red heartbeat
    else if(e.locked){ c.wm.color.setHex(Math.random()<.06?0x333333:(hov?0x999999:0x777777)); c.em.opacity=Math.random()<.08?.15:.4; }
    else { c.em.opacity=.75+Math.sin(S.T*3)*.15+(hov?.1:0); }
    const s=hov?1.06:1; c.g.scale.set(s,s,s); F.shake[i]=Math.max(0,F.shake[i]-dt);
    c.g.position.copy(c.home); c.g.position.y+=Math.sin(S.T*.8+i*2)*.06; if(F.shake[i]>0) c.g.position.x+=(Math.random()-.5)*F.shake[i]*.3; });
  if(S.mode==='choose'){ cam.updateMatrixWorld(); F.picks.forEach((c,i)=>{ const b=pickEls[i], h=c.o.h/2; if(b.hidden) return;
    tv.copy(c.home).add(tv2.set(0,h,0)).project(cam); const top=(-tv.y*.5+.5)*innerHeight; tv.copy(c.home).add(tv2.set(0,-h,0)).project(cam);
    const bot=(-tv.y*.5+.5)*innerHeight, x=(tv.x*.5+.5)*innerWidth;
    b.style.transform=`translate(${x|0}px,${top|0}px) translateX(-50%)`; b.style.height=Math.max(60,bot-top+46|0)+'px'; b.style.width=Math.max(120,(bot-top)*.45|0)+'px'; }); }
  render(F.sc);
}

/* ================= THE CRETACEOUS: a jungle at the bottom of a sinkhole ================= */
const RB=34, RT=27, DEP=36;                 // floor radius, rim radius (the walls overhang), depth
const POND={x:-3,z:-11,r:4.2}, WATER_Y=-.3;
const SPAWN={x:0,z:-23}, RIFTP={x:0,z:-25.6};
const MOON=V(.15,.9,.42).normalize();
const MOONF=V(-MOON.x*DEP/MOON.y,0,-MOON.z*DEP/MOON.y); // where the moonlight lands on the floor: a clearing
const SHARDS=[{x:3.2,z:-7.6},{x:-14,z:14},{x:18.5,z:7.5}];
function gh(x,z){ let h=.32*Math.sin(x*.21+1.3)+.26*Math.cos(z*.17)+.18*Math.sin((x+z)*.37);
  const e=Math.hypot(x,z)-(RB-7); if(e>0) h+=e*e*.11;
  const pd=Math.hypot(x-POND.x,z-POND.z); if(pd<POND.r+1.5) h-=(1-sstep(POND.r-1,POND.r+1.5,pd))*.9;
  return h; }
// static geometry is merged per material: hundreds of plants, a handful of draw calls
const BK=new Map(), _m4=new THREE.Matrix4(), _q=new THREE.Quaternion(), _s=V(1,1,1), _p=V(0,0,0);
function put(geo,mat,x,y,z,rx,ry,rz,sx,sy,sz){ te.set(rx||0,ry||0,rz||0,'YXZ'); _q.setFromEuler(te); _p.set(x,y,z); _s.set(sx||1,sy||sx||1,sz||sx||1);
  _m4.compose(_p,_q,_s); const g=geo.index?geo.toNonIndexed():geo.clone(); g.applyMatrix4(_m4); if(!BK.has(mat)) BK.set(mat,[]); BK.get(mat).push(g); }
function flush(sc){ for(const [mat,gs] of BK){ let n=0; for(const g of gs) n+=g.attributes.position.count;
    const pos=new Float32Array(n*3), nor=new Float32Array(n*3), uv=new Float32Array(n*2); let o=0;
    for(const g of gs){ const c=g.attributes.position.count; pos.set(g.attributes.position.array,o*3); nor.set(g.attributes.normal.array,o*3); if(g.attributes.uv) uv.set(g.attributes.uv.array,o*2); o+=c; g.dispose(); }
    const bg=new THREE.BufferGeometry(); bg.setAttribute('position',new THREE.BufferAttribute(pos,3)); bg.setAttribute('normal',new THREE.BufferAttribute(nor,3)); bg.setAttribute('uv',new THREE.BufferAttribute(uv,2));
    bg.computeBoundingSphere(); sc.add(new THREE.Mesh(bg,mat)); } BK.clear(); }
function frondGeo(len,wid,droop){ const g=new THREE.PlaneGeometry(wid,len,1,6); g.translate(0,len/2,0); const p=g.attributes.position;
  for(let i=0;i<p.count;i++){ const t=p.getY(i)/len; p.setZ(i,t*t*droop); } g.computeVertexNormals(); return g; }

let C=null; // the built world
const CIRC=[], VP=[];
function clearOf(x,z,r){ for(const k of [SPAWN,RIFTP,...SHARDS]) if(Math.hypot(x-k.x,z-k.z)<r+1.6) return false;
  if(Math.hypot(x-POND.x,z-POND.z)<POND.r+r+.6||Math.hypot(x-MOONF.x,z-MOONF.z)<5+r) return false; for(const c of CIRC) if(Math.hypot(x-c.x,z-c.z)<c.r+r+.4) return false; return true; }
function spot(rMin,rMax,r,tries){ for(let i=0;i<(tries||40);i++){ const a=rnd()*6.283, d=Math.sqrt(rr(rMin*rMin,rMax*rMax)), x=Math.cos(a)*d, z=Math.sin(a)*d; if(clearOf(x,z,r)) return {x,z}; } return null; }

function buildCret(){ seed=1986130;
  const sc=new THREE.Scene(); sc.background=new THREE.Color(0x04060a); sc.fog=new THREE.FogExp2(0x070b10,.03);
  const T={
    soil:tex(32,32,(g,w,h)=>{ px(g,'#191510',0,0,w,h); for(let i=0;i<260;i++) px(g,['#2c241b','#112016','#1b301f','#0a130d'][i%4],rnd()*w,rnd()*h,1+(rnd()*2|0),1); for(let i=0;i<14;i++) px(g,'#463a2b',rnd()*w,rnd()*h,2,1); },22),
    rock:tex(32,32,(g,w,h)=>{ px(g,'#1a2630',0,0,w,h); for(let y=0;y<h;y+=5+(rnd()*3|0)) px(g,'#111a22',0,y,w,1); for(let i=0;i<120;i++) px(g,rnd()<.5?'#28394a':'#111a22',rnd()*w,rnd()*h,1+(rnd()*3|0),1);
      for(let i=0;i<10;i++) px(g,'#112016',rnd()*w,rnd()*h,2+(rnd()*5|0),1+(rnd()*3|0)); },10,5),
    fern:tex(32,32,(g,w,h)=>{ g.clearRect(0,0,w,h); for(let k=0;k<3;k++){ const bx=8+k*8, lean=(k-1)*5; for(let y=0;y<28;y++){ const t=y/28, x=bx+lean*t*t; px(g,'#1b301f',x,h-1-y);
      const l=Math.round((1-t)*5*Math.sin(t*3.1+.3)); if(y%2===0&&l>0){ px(g,k===1?'#3c613b':'#2a462c',x-l,h-1-y-1,l,1); px(g,'#2a462c',x+1,h-1-y-1,l,1); } } } }),
    frond:tex(16,64,(g,w,h)=>{ g.clearRect(0,0,w,h); for(let y=0;y<h;y++){ const t=y/h; px(g,'#1b301f',7,h-1-y,2,1); const l=Math.round(Math.sin(t*3.1)*6);
      if(y%2===0&&l>0){ px(g,'#2a462c',7-l,h-2-y,l,1); px(g,'#3c613b',9,h-2-y,l,1); } } }),
    moon:tex(32,32,(g,w,h)=>{ g.clearRect(0,0,w,h); disc(g,'#7f98ad',16,16,14); disc(g,'#e3ecf1',15,15,13); for(const [x,y,r] of [[9,9,3],[20,13,4],[12,21,2],[22,22,2],[15,16,1]]) disc(g,'#a9bccb',x,y,r); }),
    halo:tex(64,64,(g,w,h)=>{ const gr=g.createRadialGradient(32,32,2,32,32,32); gr.addColorStop(0,'rgba(170,190,210,.55)'); gr.addColorStop(.35,'rgba(110,135,160,.18)'); gr.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle=gr; g.fillRect(0,0,w,h); }),
    sky:tex(4,64,(g,w,h)=>{ sky(g,w,h,['#111a22','#1a2630','#22303d','#28394a']); })
  };
  const M={
    soil:new THREE.MeshPhongMaterial({map:T.soil,shininess:2,specular:0x050505}),
    rock:new THREE.MeshPhongMaterial({map:T.rock,flatShading:true,shininess:4,specular:0x0a0a0a,side:THREE.BackSide}),
    stone:new THREE.MeshPhongMaterial({map:T.rock,flatShading:true,shininess:4,specular:0x0a0a0a}),
    bark:new THREE.MeshPhongMaterial({color:0x3a2f24,flatShading:true,shininess:2}),
    leaf:new THREE.MeshPhongMaterial({color:0x22381f,flatShading:true,shininess:2}),
    dark:new THREE.MeshPhongMaterial({color:0x0a100c,flatShading:true,shininess:0}),
    vine:new THREE.MeshPhongMaterial({color:0x172a1a,flatShading:true,shininess:0}),
    fern:new THREE.MeshPhongMaterial({map:T.fern,alphaTest:.5,side:THREE.DoubleSide,shininess:0}),
    frond:new THREE.MeshPhongMaterial({map:T.frond,alphaTest:.5,side:THREE.DoubleSide,shininess:0}),
  };
  // ground
  const gg=new THREE.PlaneGeometry(RB*2+8,RB*2+8,72,72); gg.rotateX(-Math.PI/2); const gp=gg.attributes.position;
  for(let i=0;i<gp.count;i++) gp.setY(i,gh(gp.getX(i),gp.getZ(i))); gg.computeVertexNormals(); sc.add(new THREE.Mesh(gg,M.soil));
  // walls: an overhanging bell of limestone, roughened so the flat shading catches
  const WH=DEP+6, wg=new THREE.CylinderGeometry(RT,RB+2,WH,56,16,true); wg.translate(0,WH/2-3,0); const wp=wg.attributes.position;
  for(let i=0;i<wp.count;i++){ const x=wp.getX(i), y=wp.getY(i), z=wp.getZ(i), a=Math.atan2(z,x), r=Math.hypot(x,z);
    const off=1.3*Math.sin(a*7+y*.3)+.8*Math.sin(a*13-y*.5)+.5*Math.sin(a*29+y*1.1)+.4*Math.sin(y*2.2)+rr(-.25,.25), k=(r+off)/r; wp.setX(i,x*k); wp.setZ(i,z*k); }
  wg.computeVertexNormals(); const wall=new THREE.Mesh(wg,M.rock); wall.material.map.repeat.set(12,6); sc.add(wall);
  // the world above: rim ground and a ring of conifers, only ever seen as silhouettes against the sky
  const rim=new THREE.RingGeometry(RT-2,160,48,1); rim.rotateX(-Math.PI/2); const rimM=new THREE.Mesh(rim,M.dark); rimM.position.y=DEP+2.6; sc.add(rimM);
  const cone=new THREE.ConeGeometry(1,1,6), cyl=new THREE.CylinderGeometry(1,1,1,6,1), ico=new THREE.IcosahedronGeometry(1,0);
  for(let i=0;i<70;i++){ const a=rnd()*6.283, d=rr(RT+1,RT+16), x=Math.cos(a)*d, z=Math.sin(a)*d, h=rr(8,18), y=DEP+2.6;
    put(cyl,M.dark,x,y+h*.3,z,0,0,0,.3,h*.6,.3); for(let k=0;k<4;k++){ const r=lerp(3.2,1,k/3)*rr(.8,1.2); put(cone,M.dark,x,y+h*(.35+k*.17),z,0,rnd()*3,0,r,h*.28,r); } }
  // hanging vines and roots from the rim
  const vbox=new THREE.BoxGeometry(1,1,1);
  for(let i=0;i<80;i++){ const a=rnd()*6.283, x=Math.cos(a)*(RT-.6), z=Math.sin(a)*(RT-.6), L=rr(6,DEP-2); put(vbox,M.vine,x,DEP+2.6-L/2,z,rr(-.04,.04),a,rr(-.04,.04),rr(.05,.14),L,rr(.05,.14)); }
  // boulders, mostly against the walls
  for(let i=0;i<22;i++){ const p=spot(i<14?24:6,i<14?30:22,2); if(!p) continue; const s=rr(1,2.4); put(ico,M.stone,p.x,gh(p.x,p.z)+s*.35,p.z,rnd()*3,rnd()*3,0,s*rr(1,1.4),s*rr(.6,1),s*rr(1,1.3)); CIRC.push({x:p.x,z:p.z,r:s*.95}); }
  // fallen logs
  for(let i=0;i<4;i++){ const p=spot(8,24,3); if(!p) continue; const L=rr(5,9), a=rnd()*3.14, y=gh(p.x,p.z)+.38;
    put(cyl,M.bark,p.x,y,p.z,0,a,Math.PI/2,.42,L,.42); for(let k=-2;k<=2;k++) CIRC.push({x:p.x+Math.cos(a)*k*L/5,z:p.z-Math.sin(a)*k*L/5,r:.6}); }
  // araucaria-like conifers: tall bare trunks, crowns high in the dark
  const trees=[];
  for(let i=0;i<16;i++){ const p=spot(i<8?18:6,29,.8); if(!p||Math.hypot(p.x-SPAWN.x,p.z-SPAWN.z)<10) continue; const H=rr(14,24), y=gh(p.x,p.z); trees.push({x:p.x,z:p.z,r:.5});
    put(cyl,M.bark,p.x,y+H/2,p.z,0,0,0,rr(.3,.45),H,rr(.3,.45)); CIRC.push({x:p.x,z:p.z,r:.5});
    for(let k=0;k<6;k++){ const hy=y+H*(.55+k*.08), n=5, len=lerp(3.2,.9,k/5);
      for(let b=0;b<n;b++){ const a=b/n*6.283+k; put(vbox,M.bark,p.x+Math.cos(a)*len/2,hy,p.z+Math.sin(a)*len/2,0,-a,.12,len,.12,.12);
        put(ico,M.leaf,p.x+Math.cos(a)*len,hy-.1,p.z+Math.sin(a)*len,rnd()*3,rnd()*3,0,rr(.6,.9),rr(.35,.5),rr(.6,.9)); } } }
  // tree ferns
  const frondL=frondGeo(2.4,.7,1.1), frondS=frondGeo(1.5,.5,.25);
  for(let i=0;i<34;i++){ const p=spot(4,29,.4); if(!p) continue; const H=rr(2.4,4.6), y=gh(p.x,p.z); trees.push({x:p.x,z:p.z,r:.3});
    put(cyl,M.bark,p.x,y+H/2,p.z,rr(-.06,.06),0,rr(-.06,.06),rr(.13,.2),H,rr(.13,.2)); CIRC.push({x:p.x,z:p.z,r:.28});
    for(let k=0;k<9;k++) put(frondL,M.frond,p.x,y+H,p.z,rr(.9,1.25),k/9*6.283+rnd(),0); }
  // cycads: stout trunks, stiff crowns
  for(let i=0;i<26;i++){ const p=spot(4,29,.5); if(!p) continue; const H=rr(.6,1.6), y=gh(p.x,p.z);
    put(cyl,M.bark,p.x,y+H/2,p.z,0,0,0,rr(.3,.42),H,rr(.3,.42)); CIRC.push({x:p.x,z:p.z,r:.42});
    for(let k=0;k<12;k++) put(frondS,M.frond,p.x,y+H,p.z,rr(.5,.95),k/12*6.283+rnd()*.4,0); }
  flush(sc);
  // ground ferns (instanced): thick at the edges and around trunks, thin in the moonlit clearing; tall enough to hide in
  const fg=new THREE.BufferGeometry(); { const parts=[0,1,2].map(k=>{ const p=new THREE.PlaneGeometry(1.4,1,1,1); p.translate(0,.5,0); p.rotateY(k*Math.PI/3); return p.toNonIndexed(); });
    const n=parts.reduce((s,p)=>s+p.attributes.position.count,0), pos=new Float32Array(n*3), nor=new Float32Array(n*3), uv=new Float32Array(n*2); let o=0;
    for(const p of parts){ pos.set(p.attributes.position.array,o*3); nor.set(p.attributes.normal.array,o*3); uv.set(p.attributes.uv.array,o*2); o+=p.attributes.position.count; }
    fg.setAttribute('position',new THREE.BufferAttribute(pos,3)); fg.setAttribute('normal',new THREE.BufferAttribute(nor,3)); fg.setAttribute('uv',new THREE.BufferAttribute(uv,2)); }
  const FN=520, ferns=new THREE.InstancedMesh(fg,M.fern,FN); let fi=0;
  const moonF=MOONF;
  for(let i=0;i<FN*3&&fi<FN;i++){ let x,z; if(rnd()<.35&&trees.length){ const t=trees[(rnd()*trees.length)|0], a=rnd()*6.283, d=rr(.6,2.6); x=t.x+Math.cos(a)*d; z=t.z+Math.sin(a)*d; }
    else { const a=rnd()*6.283, d=Math.sqrt(rnd())*29; x=Math.cos(a)*d; z=Math.sin(a)*d; }
    if(Math.hypot(x,z)>29.5||Math.hypot(x-POND.x,z-POND.z)<POND.r+.4) continue;
    const dm=Math.hypot(x-moonF.x,z-moonF.z); if(dm<8&&rnd()<.75) continue;
    if(Math.hypot(x-SPAWN.x,z-SPAWN.z)<2||Math.hypot(x-RIFTP.x,z-RIFTP.z)<1.6) continue;
    const s=rr(.6,1.7)*(dm<9?.7:1); te.set(0,rnd()*6.283,0); _q.setFromEuler(te); _m4.compose(_p.set(x,gh(x,z)-.05,z),_q,_s.set(s,s*rr(.8,1.2),s)); ferns.setMatrixAt(fi++,_m4); }
  ferns.count=fi; ferns.instanceMatrix.needsUpdate=true; sc.add(ferns);
  // pond, with the moon's reflection placed per frame
  const pond=new THREE.Mesh(new THREE.CircleGeometry(POND.r+.8,28),new THREE.MeshPhongMaterial({color:0x05080b,shininess:120,specular:0x7a96b0}));
  pond.rotation.x=-Math.PI/2; pond.position.set(POND.x,WATER_Y,POND.z); sc.add(pond);
  const moonRef=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:T.moon,transparent:true,opacity:.75,depthWrite:false,fog:false}));
  moonRef.rotation.x=-Math.PI/2; sc.add(moonRef);
  // sky, stars, moon
  const skyM=new THREE.Mesh(new THREE.SphereGeometry(240,24,12),new THREE.MeshBasicMaterial({map:T.sky,side:THREE.BackSide,fog:false})); sc.add(skyM);
  const stp=[]; for(let i=0;i<800;i++){ const u=rr(.3,1), a=rnd()*6.283, s=Math.sqrt(1-u*u); stp.push(Math.cos(a)*s*230,u*230,Math.sin(a)*s*230); }
  const stg=new THREE.BufferGeometry(); stg.setAttribute('position',new THREE.Float32BufferAttribute(stp,3));
  const starM=new THREE.PointsMaterial({color:0x9fb2c2,size:1,sizeAttenuation:false,fog:false,transparent:true}); sc.add(new THREE.Points(stg,starM));
  const moon=new THREE.Mesh(new THREE.PlaneGeometry(26,26),new THREE.MeshBasicMaterial({map:T.moon,transparent:true,alphaTest:.1,fog:false}));
  moon.position.copy(MOON).multiplyScalar(210); moon.lookAt(0,0,0); sc.add(moon);
  const halo=new THREE.Mesh(new THREE.PlaneGeometry(90,90),new THREE.MeshBasicMaterial({map:T.halo,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,fog:false}));
  halo.position.copy(MOON).multiplyScalar(214); halo.lookAt(0,0,0); sc.add(halo);
  // light: almost nothing, except where the moon reaches down through the opening
  const hemi=new THREE.HemisphereLight(0x2c4058,0x060a08,.4); sc.add(hemi);
  const moonL=new THREE.SpotLight(0xa9bdd6,1.35,0,.15,.8,1); moonL.position.copy(moonF).addScaledVector(MOON,70); moonL.target.position.copy(moonF); sc.add(moonL,moonL.target);
  const shaftL=DEP/MOON.y+4, shaft=new THREE.Mesh(new THREE.CylinderGeometry(8,10.5,shaftL,20,1,true),
    new THREE.MeshBasicMaterial({color:0x3f566b,transparent:true,opacity:.07,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,fog:false}));
  shaft.position.copy(moonF).addScaledVector(MOON,shaftL/2); shaft.quaternion.setFromUnitVectors(V(0,1,0),MOON); sc.add(shaft);
  // motes drifting in the shaft
  const MN=180, mp=new Float32Array(MN*3), mb=[]; for(let i=0;i<MN;i++){ const a=rnd()*6.283, d=Math.sqrt(rnd())*8; mb.push([Math.cos(a)*d,rr(-shaftL/2,shaftL/2),Math.sin(a)*d,rnd()*6]); }
  const mg=new THREE.BufferGeometry(); mg.setAttribute('position',new THREE.BufferAttribute(mp,3));
  const motes=new THREE.Points(mg,new THREE.PointsMaterial({color:0x7f98ad,size:1,sizeAttenuation:false,transparent:true,opacity:.7,depthWrite:false})); motes.position.copy(shaft.position); motes.quaternion.copy(shaft.quaternion); motes.frustumCulled=false; sc.add(motes);
  // flashlight
  const flash=new THREE.SpotLight(0xffe6c0,2.6,26,.46,.55,1); flash.position.set(.15,-.15,0); const ft=new THREE.Object3D(); ft.position.set(0,-.1,-1); cam.add(flash,ft); flash.target=ft;
  // the rift you came through: collapsed to a hairline until the shards open it again
  const rift=crack({h:2.6,w:.9,seed:5,edge:0xf0a43c}); rift.g.position.set(RIFTP.x,gh(RIFTP.x,RIFTP.z)+1.4,RIFTP.z); sc.add(rift.g);
  const riftL=new THREE.PointLight(0xf0a43c,.4,8,2); riftL.position.set(RIFTP.x,1.6,RIFTP.z+.6); sc.add(riftL);
  // shards
  const shM=new THREE.MeshBasicMaterial({color:0xf0a43c}), shC=new THREE.MeshBasicMaterial({color:0xfff3d0});
  const shG=new THREE.PointsMaterial({color:0xf0a43c,size:5,sizeAttenuation:false,transparent:true,opacity:.6,depthWrite:false,fog:false,blending:THREE.AdditiveBlending});
  const shards=SHARDS.map(s=>{ const g=new THREE.Group(); const y=gh(s.x,s.z)+1; g.position.set(s.x,y,s.z);
    const a=new THREE.Mesh(new THREE.OctahedronGeometry(.16,0),shM); a.scale.y=2; g.add(a); const b=new THREE.Mesh(new THREE.OctahedronGeometry(.07,0),shC); b.scale.y=2; g.add(b);
    const pg=new THREE.BufferGeometry(); pg.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0],3)); g.add(new THREE.Points(pg,shG));
    const L=new THREE.PointLight(0xf0a43c,.9,6,2); g.add(L); sc.add(g); return {g,a,y,x:s.x,z:s.z,got:false}; });
  // vantage points the raptors use: just behind trunks (peeking out), and open ground
  for(const t of trees){ const d=Math.hypot(t.x,t.z)||1; for(const s of [-1,1]){ const ox=t.x+(t.x/d)*.9+(-t.z/d)*s*.7, oz=t.z+(t.z/d)*.9+(t.x/d)*s*.7; if(Math.hypot(ox,oz)<28.5&&Math.hypot(ox-POND.x,oz-POND.z)>POND.r+1) VP.push({x:ox,z:oz}); } }
  for(let i=0;i<24;i++){ const a=rnd()*6.283, d=rr(8,28); const x=Math.cos(a)*d, z=Math.sin(a)*d; if(Math.hypot(x-POND.x,z-POND.z)>POND.r+1.5) VP.push({x,z}); }
  C={sc,flash,rift,riftL,shards,moonRef,mp,mb,mg,shaftL,hemi,moonL,shaft,moon,halo,skyM,starM,motes};
  RAP.length=0; for(let i=0;i<3;i++){ const r=makeRaptor(i); sc.add(r.root); RAP.push(r); }
  makeEyes(sc);
}

/* ================= UTAHRAPTOR =================
   Utahraptor ostrommaysi, Early Cretaceous: ~6 m nose to tail, hip near head height, feathered, sickle claw held up.
   Built near-black so it lives in the dark; the flashlight and the moon are the only things that show its shape. */
const RAP=[];
const rapM=new THREE.MeshPhongMaterial({color:0x1b1d18,specular:0x101010,shininess:8,flatShading:true});
const featM=new THREE.MeshPhongMaterial({color:0x141612,flatShading:true,side:THREE.DoubleSide});
const clawM=new THREE.MeshPhongMaterial({color:0x5a4c3a,flatShading:true,shininess:20});
const toothM=new THREE.MeshPhongMaterial({color:0x8a8a7a,flatShading:true});
// the eyes: a glowing almond with a cat's slit, billboarded so they always stare straight at you
const eyeTex=tex(48,24,(g,w,h)=>{
  const almond=(rx,ry)=>{ g.beginPath(); g.moveTo(w/2-rx,h/2); g.quadraticCurveTo(w/2,h/2-ry*2,w/2+rx,h/2); g.quadraticCurveTo(w/2,h/2+ry*2,w/2-rx,h/2); g.closePath(); };
  g.shadowColor='#9e130b'; g.shadowBlur=6; almond(17,6); g.fillStyle='#9e130b'; g.fill(); g.shadowBlur=0;
  almond(15,5); g.fillStyle='#ff2a1a'; g.fill();
  g.fillStyle='#04060a'; g.beginPath(); g.ellipse(w/2,h/2,1.6,4.6,0,0,7); g.fill(); });
eyeTex.minFilter=THREE.LinearFilter;
// box tapered along z: scale `back` at -z end, `front` at +z end, then shifted by zo
function tbox(w,h,d,back,front,zo){ const g=new THREE.BoxGeometry(w,h,d,1,1,2), p=g.attributes.position;
  for(let i=0;i<p.count;i++){ const k=p.getZ(i)/d+.5, s=lerp(back,front,k); p.setX(i,p.getX(i)*s); p.setY(i,p.getY(i)*s); }
  g.translate(0,0,zo||0); g.computeVertexNormals(); return g; }
function hang(w,h,d){ const g=new THREE.BoxGeometry(w,h,d); g.translate(0,-h/2,0); return g; }
function part(geo,mat,par,x,y,z,rx,ry,rz){ const m=new THREE.Mesh(geo,mat); m.position.set(x,y,z); m.rotation.set(rx||0,ry||0,rz||0); par.add(m); return m; }
function grp(par,x,y,z,rx,ry,rz){ const g=new THREE.Group(); g.position.set(x,y,z); g.rotation.set(rx||0,ry||0,rz||0); par.add(g); return g; }
function makeRaptor(i){
  const root=new THREE.Group(), hip=grp(root,0,1.42,0), body=grp(hip,0,0,0,-.1);
  part(tbox(.74,.88,2.1,.85,.78,.55),rapM,body,0,.05,0);
  part(tbox(.5,.4,1.2,.8,.7,.6),rapM,body,0,-.32,.2); // belly
  for(let k=0;k<9;k++) part(new THREE.PlaneGeometry(.55,.26),featM,body,0,.5,-.35+k*.21,-1.25+rr(-.2,.2),0,rr(-.3,.3)); // ruffled back feathers
  const neck=grp(body,0,.28,1.45,-.78); part(tbox(.38,.44,1.05,1,.72,.5),rapM,neck,0,0,0);
  for(let k=0;k<4;k++) part(new THREE.PlaneGeometry(.35,.2),featM,neck,0,.22,.15+k*.22,-1.3);
  const head=grp(neck,0,.02,1.0,.7); const qRest=head.quaternion.clone();
  part(tbox(.32,.36,.8,1,.45,.32),rapM,head,0,0,0);
  part(new THREE.BoxGeometry(.2,.025,.5),toothM,head,0,-.17,.4);
  const jaw=grp(head,0,-.12,.0); part(tbox(.24,.09,.66,1,.5,.32),rapM,jaw,0,-.03,0); part(new THREE.BoxGeometry(.16,.025,.45),toothM,jaw,0,.02,.36);
  for(let k=0;k<3;k++) part(new THREE.PlaneGeometry(.22,.3),featM,head,0,.2,-.05-k*.06,-.9-k*.25);
  const eyes=grp(head,0,.07,.3), eyeMat=new THREE.SpriteMaterial({map:eyeTex,transparent:true,depthWrite:false,fog:false});
  const eyeS=[-1,1].map(s=>{ const e=new THREE.Sprite(eyeMat); e.position.x=s*.17; e.renderOrder=2; eyes.add(e); return e; });
  // tail: a stiff chain, feathered toward the tip
  const tail=[]; let par=body;
  for(let k=0;k<8;k++){ const w=.54*(1-k/8.6); const g=grp(par,0,k?0:.12,k?-.5:-.48,-.02); part(tbox(w,w*1.05,.54,.8,1,-.26),rapM,g,0,0,0);
    if(k>3){ const f=part(new THREE.PlaneGeometry(w*2.6,.6),featM,g,0,0,-.3,-Math.PI/2); f.rotation.x=-Math.PI/2; } tail.push(g); par=g; }
  // legs: thigh / shin / foot, digit II's sickle claw raised off the ground
  const legs=[-1,1].map((s,j)=>{ const th=grp(hip,s*.38,-.05,.15,-.65); part(hang(.3,.66,.42),rapM,th,0,0,0);
    const kn=grp(th,0,-.62,0,1.35); part(hang(.18,.72,.22),rapM,kn,0,0,0);
    const an=grp(kn,0,-.7,0,-.95); part(hang(.13,.44,.15),rapM,an,0,0,0);
    const ft=grp(an,0,-.42,0,.25); part(new THREE.BoxGeometry(.24,.07,.4),rapM,ft,0,-.02,.14); part(new THREE.BoxGeometry(.04,.22,.07),clawM,ft,-s*.06,.08,.13,-.7);
    return {th,kn,an,o:j*Math.PI}; });
  // folded, feathered arms
  for(const s of [-1,1]){ const up=grp(body,s*.36,-.05,1.25,.9,0,s*.25); part(hang(.1,.44,.12),rapM,up,0,0,0);
    const fo=grp(up,0,-.42,0,-1.7); part(hang(.08,.4,.09),rapM,fo,0,0,0); part(new THREE.PlaneGeometry(.12,.55),featM,fo,0,-.3,-.1,.2);
    for(let k=0;k<3;k++) part(new THREE.BoxGeometry(.02,.12,.03),clawM,fo,(k-1)*.025,-.44,.03,.4); }
  const parts=[]; root.traverse(o=>{ if(o.isMesh) parts.push(o); });
  root.visible=false;
  return {i,root,parts,hideT:0,hip,body,neck,head,jaw,eyes,eyeS,eyeMat,tail,legs,qRest,qCur:qRest.clone(),
    x:0,z:0,h:0,tx:0,tz:0,st:'off',tm:4+i*7,mv:0,mvS:0,ph:rnd()*6,crouch:0,jawT:0,tilt:0,tiltT:1,blink:3+rnd()*4,lid:0,litT:0,seen:false,d:99,sndT:0,lookW:1};
}

/* ================= THE EYES =================
   Before the dark nothing out there has a body: only single eyes, scattered far from the rift, that watch you and blink.
   Come close or put the light on one and it shuts and is gone, to open again somewhere else. */
const EYES=[], EF=V(0,0,0), ET=V(0,0,0);
function makeEyes(sc){ EYES.length=0;
  for(let i=0;i<16;i++){ const s=new THREE.Sprite(new THREE.SpriteMaterial({map:eyeTex,transparent:true,depthWrite:false,fog:false,rotation:rr(-.3,.3)}));
    s.renderOrder=2; s.visible=false; sc.add(s); EYES.push({s,x:0,y:0,z:0,lid:0,blink:rr(1,5),hideT:0,shut:false,litT:0}); } }
function eyeSpot(hidden){ const minD=D.shards>=3?20:13;
  for(let i=0;i<60;i++){ const a=rnd()*6.283, d=Math.sqrt(rr(36,28.5*28.5)), x=Math.cos(a)*d, z=Math.sin(a)*d;
    if(Math.hypot(x-RIFTP.x,z-RIFTP.z)<16||Math.hypot(x-TP.x,z-TP.z)<minD||Math.hypot(x-POND.x,z-POND.z)<POND.r+.5) continue;
    if(CIRC.some(c=>Math.hypot(x-c.x,z-c.z)<c.r+.2)) continue;
    const y=gh(x,z)+rr(.4,2.6); if(hidden&&onScreen(x,y,z,1)) continue; return {x,y,z}; }
  return null; }
function placeEye(e){ const p=eyeSpot(true)||eyeSpot(false); if(!p){ e.hideT=.5; return; }
  e.x=p.x; e.y=p.y; e.z=p.z; e.s.position.set(p.x,p.y,p.z); e.lid=0; e.shut=false; e.litT=0; }
function resetEyes(){ for(const e of EYES){ e.s.visible=false; e.lid=0; e.shut=false; e.hideT=rr(0,6); } }
function eyesFrame(dt){ EF.set(0,0,-1).applyQuaternion(cam.quaternion); const beam=D.flashOn&&(D.flashDead?D.sput>0:D.flick<=0);
  for(const e of EYES){
    if(e.hideT>0){ e.hideT-=dt; e.s.visible=false; if(e.hideT<=0) placeEye(e); continue; }
    const d=Math.hypot(e.x-TP.x,e.z-TP.z); ET.set(e.x,e.y,e.z).sub(cam.position).normalize();
    e.litT=beam&&d<14&&EF.dot(ET)>.93?e.litT+dt:0;
    if(d<9||e.litT>.25) e.shut=true;
    e.blink-=dt; if(e.blink<-.16) e.blink=rr(1.5,6);
    const t=e.shut?0:e.blink>0?1:.05; e.lid=lerp(e.lid,t,1-Math.exp(-dt*(t<e.lid?30:6)));
    if(e.shut&&e.lid<.05){ e.s.visible=false; e.hideT=rr(1.5,5); continue; }
    const k=clamp(d*.11,1,3.2); e.s.scale.set(.28*k,.14*k*e.lid,1); e.s.visible=e.lid>.04; } }
// the last shard: whatever is near you is sent far off, so there is a head start for the rift
function scatter(){ for(const e of EYES) if(Math.hypot(e.x-TP.x,e.z-TP.z)<20){ e.s.visible=false; e.hideT=rr(.3,2); }
  for(const r of RAP) if(r.root.visible&&r.d<20){ const v=pickVP(r,20,34,true,true)||pickVP(r,16,34,false,true); if(v) placeAt(r,v); } }
// something out there to make a sound: a raptor if one is about, otherwise one of the eyes
function voice(){ const rs=RAP.filter(r=>r.root.visible&&r.st!=='retreat'); if(rs.length) return rs[(rnd()*rs.length)|0];
  const es=EYES.filter(e=>e.s.visible); if(!es.length) return null; const e=es[(rnd()*es.length)|0];
  return {x:e.x,z:e.z,d:Math.hypot(e.x-TP.x,e.z-TP.z)}; }

/* ================= THE HUNT ================= */
const TP={x:0,z:0,bob:0,acc:0,jy:0,vy:0};
const D={t:0,dark:0,lightsOut:false,flashDie:0,flashDead:false,sput:0,sputT:0,hunt:false,huntIn:-1,shards:0,callT:24,clickT:14,beatT:0,flick:0,flickT:45,danger:0,flashOn:true};
// until the last shard there are no bodies, only the eyes; the raptors come with the dark
function reveal(on){ for(const r of RAP) for(const m of r.parts) m.visible=on; }
function inViewXZ(x,z,y){ return onScreen(x,(y==null?gh(x,z)+1.9:y),z,.92); }
function headY(r){ return gh(r.x,r.z)+1.9; }
function placeAt(r,v){ r.x=v.x; r.z=v.z; r.tx=v.x; r.tz=v.z; r.h=Math.atan2(TP.x-r.x,TP.z-r.z); r.lid=0; r.root.visible=true; }
function pickVP(r,minD,maxD,hidden,far){ let best=null,bs=-1e9;
  for(const v of VP){ const d=Math.hypot(v.x-TP.x,v.z-TP.z); if(d<minD||d>maxD) continue;
    if(RAP.some(o=>o!==r&&o.st!=='off'&&Math.hypot(o.tx-v.x,o.tz-v.z)<5)) continue;
    if(D.shards>=3&&Math.hypot(v.x-RIFTP.x,v.z-RIFTP.z)<10) continue; // leave the way home open
    if(hidden&&inViewXZ(v.x,v.z)) continue; const s=(far?d:0)+rnd()*8; if(s>bs){ bs=s; best=v; } }
  return best; }
function panOf(x,z){ tv.set(x,1.6,z).sub(cam.position).applyQuaternion(tq.copy(cam.quaternion).invert()); return clamp(tv.x/Math.max(1,Math.hypot(tv.x,tv.z)),-1,1); }
function vol(d,k){ return clamp((k||1.4)/(1+d*.22),0,1); }
function relocate(r){
  const v=pickVP(r,14,26,false)||VP[(rnd()*VP.length)|0]; r.tx=v.x; r.tz=v.z;
  // out of sight on both ends: it is simply somewhere else when you look back
  if(!r.seen&&!inViewXZ(v.x,v.z)){ placeAt(r,v); r.st='watch'; r.tm=rr(6,14); } else { r.st='walk'; } }
function retreat(r){ if(r.d<14) snd.rustle(panOf(r.x,r.z),vol(r.d));
  const v=pickVP(r,14,30,false,true)||VP[(rnd()*VP.length)|0]; r.tx=v.x; r.tz=v.z; r.st='retreat'; r.tm=0; }
function attack(r){ if(S.mode!=='cret') return; S.mode='dead'; S.t=0; D.killer=r; r.st='attack'; snd.screech(); S.glitch=1; R.unlock();
  D.yaw0=P.yaw; D.yawTo=Math.atan2(-(r.x-TP.x),-(r.z-TP.z)); objEl.classList.remove('on'); }
function respawn(){ TP.x=D.shards>=3?RIFTP.x:SPAWN.x; TP.z=D.shards>=3?RIFTP.z+2.4:SPAWN.z; P.yaw=Math.PI; P.pitch=0;
  RAP.forEach((r,i)=>{ r.st='off'; r.root.visible=false; r.tm=D.hunt?2+i*1.5:5+i*6; }); D.danger=0;
  untitle(); fadeTo(0,1.6); nightAudio(1); S.mode='cret'; S.t=0; after(1.2,()=>updateObjective()); }
function updateObjective(){ if(S.mode!=='cret'||S.leaving) return;
  const look=!R.touch()&&!R.locked()?'<br>Click to look around · F flashlight · Space jump':'';
  if(D.shards<3) objective(`Rift shards ${D.shards}/3`,`The rift sealed behind you. Find the glowing shards to reopen it.${look}`);
  else objective('The rift is open','The light is gone. Follow the glow back. Run (Shift).'+(!R.touch()&&!R.locked()?'<br>Click to look around':'')); }

function rapThink(r,dt){
  const dx=TP.x-r.x, dz=TP.z-r.z, d=Math.hypot(dx,dz); r.d=d;
  r.seen=d<28&&onScreen(r.x,headY(r),r.z,.9);
  tv2.set(r.x,gh(r.x,r.z)+1.3,r.z).sub(cam.position); const ld=tv2.length(); tv2.divideScalar(ld||1);
  tv.set(0,0,-1).applyQuaternion(cam.quaternion); const lit=D.flashOn&&(D.flashDead?D.sput>0:D.flick<=0)&&ld<12&&tv.dot(tv2)>.9; r.litT=lit?r.litT+dt:0;
  let spd=0, tx=r.tx, tz=r.tz; r.crouch=lerp(r.crouch,0,dt*2); r.lookW=1;
  switch(r.st){
    case 'off': if(!D.hunt) return; r.tm-=dt; if(r.tm<=0){ const v=pickVP(r,20,34,true,true)||pickVP(r,14,34,false,true); if(v){ placeAt(r,v); r.st='hunt'; r.tm=rr(4,9); } else r.tm=1; } return;
    case 'watch': r.tm-=dt; r.h=angLerp(r.h,Math.atan2(dx,dz),dt*1.5); r.crouch=lerp(r.crouch,.6,dt);
      if(r.litT>.45) retreat(r); else if(r.tm<=0) relocate(r); break;
    case 'walk': spd=1.3; r.lookW=.7; r.crouch=.4;
      if(Math.hypot(tx-r.x,tz-r.z)<.5){ r.st='watch'; r.tm=rr(4,9); } else if(r.litT>.45) retreat(r); break;
    case 'hunt': tx=TP.x; tz=TP.z; r.crouch=.5; spd=r.litT>.2?1.3:2.9;
      if(d<2.3) attack(r);
      r.sndT-=dt; if(r.sndT<=0){ r.sndT=rr(.5,1); snd.rustle(panOf(r.x,r.z),vol(d,1.2)); if(rnd()<.25) snd.click(panOf(r.x,r.z),vol(d)); } break;
    case 'retreat': spd=6; r.lookW=0; r.tm+=dt;
      if(Math.hypot(tx-r.x,tz-r.z)<.6||(!r.seen&&r.tm>1.4)){ if(!r.seen) placeAt(r,{x:tx,z:tz}); r.st='watch'; r.tm=rr(8,15); } break;
    case 'attack': return;
  }
  if(spd>0){ const want=Math.atan2(tx-r.x,tz-r.z); r.h=angLerp(r.h,want,1-Math.exp(-dt*5)); const step=Math.min(spd*dt,Math.hypot(tx-r.x,tz-r.z));
    r.x+=Math.sin(r.h)*step; r.z+=Math.cos(r.h)*step; const rd=Math.hypot(r.x,r.z); if(rd>29){ r.x*=29/rd; r.z*=29/rd; } }
  // never closer than arm's reach unless it means to be
  const d2=Math.hypot(TP.x-r.x,TP.z-r.z); if(d2<1.8&&r.st!=='attack'){ const k=1.8/Math.max(.01,d2); r.x=TP.x-(TP.x-r.x)*k; r.z=TP.z-(TP.z-r.z)*k; }
  r.mv=lerp(r.mv,spd,1-Math.exp(-dt*6));
}
function rapPose(r,dt){ if(!r.root.visible) return; const a=clamp(r.mv/2.6,0,1); r.mvS=lerp(r.mvS,a,1-Math.exp(-dt*6)); const m=r.mvS, c=r.crouch;
  r.ph+=dt*(1.4+r.mv*2.4);
  r.root.position.set(r.x,gh(r.x,r.z),r.z); r.root.rotation.y=r.h;
  r.hip.position.y=1.42-c*.2+Math.abs(Math.sin(r.ph))*.06*m;
  r.body.rotation.x=-.1+c*.1; const br=Math.sin(S.T*1.7+r.i*2); r.body.scale.set(1+br*.012,1+br*.02,1);
  for(const L of r.legs){ const p=r.ph+L.o, lift=Math.max(0,Math.sin(p+1.3));
    L.th.rotation.x=-.65+Math.sin(p)*.5*m-c*.25; L.kn.rotation.x=1.35+lift*.8*m+c*.4; L.an.rotation.x=-.95-lift*.4*m-c*.15; }
  r.tail.forEach((g,k)=>{ g.rotation.y=Math.sin(S.T*1.1-k*.45+r.i)*.035*(1+m*3); g.rotation.x=-.02+Math.sin(S.T*.8-k*.3)*.012; });
  r.neck.rotation.x=lerp(-.78,-.5,c);
  r.jaw.rotation.x=lerp(r.jaw.rotation.x,r.jawT,1-Math.exp(-dt*10));
  // the head: snaps to you like a bird's, with sudden tilts
  r.tiltT-=dt; if(r.tiltT<=0){ r.tiltT=rr(.7,2.6); r.tilt=rnd()<.5?0:rr(-.45,.45); }
  r.root.updateMatrixWorld(true); r.head.lookAt(cam.position); tq.copy(r.head.quaternion).multiply(_q.setFromEuler(te.set(0,0,r.tilt)));
  const ang=Math.abs(angLerp(0,Math.atan2(TP.x-r.x,TP.z-r.z)-r.h,1)), w=r.lookW*(ang>2?0:1);
  const target=r.qRest.clone().slerp(tq,w); r.qCur.slerp(target,1-Math.exp(-dt*14)); r.head.quaternion.copy(r.qCur);
  // eyes: lit when the head faces you; the lids snap shut and slide back open; dark while it bolts
  r.blink-=dt; if(r.blink<-.16) r.blink=rr(1.5,4.5); if(r.hideT>0) r.hideT-=dt;
  r.head.updateMatrixWorld(true); r.head.getWorldQuaternion(tq); tv.set(0,0,1).applyQuaternion(tq); r.head.getWorldPosition(tv2); const toCam=cam.position.clone().sub(tv2).normalize();
  const on=r.st!=='retreat'&&r.hideT<=0&&tv.dot(toCam)>.25, lidT=r.blink>0?1:.05;
  r.lid=on?lerp(r.lid,lidT,1-Math.exp(-dt*(lidT<r.lid?45:7))):0;
  r.eyes.visible=r.lid>.04;
  // bodiless in the dark they loom, big enough to read from across the sinkhole; once hunting they sit in the skull
  r.eyes.scale.setScalar(D.hunt?clamp(r.d*.05,.7,1.6):clamp(r.d*.11,1,3.2));
  for(const e of r.eyeS) e.scale.set(.28,.14*r.lid,1); r.eyeMat.rotation=-r.tilt*.6;
}
function director(dt){ D.t+=dt;
  if(D.huntIn>0){ D.huntIn-=dt; if(D.huntIn<=0){ D.hunt=true; reveal(true); RAP.forEach((r,i)=>{ if(r.st==='off') r.tm=.5+i; else r.st='hunt'; }); snd.growl(0,.8); } }
  // the pack talks
  D.clickT-=dt; if(D.clickT<=0){ D.clickT=rr(9,20); const r=voice(); if(r){ snd.click(panOf(r.x,r.z),vol(r.d)); r.jawT=.25; setTimeout(()=>{ r.jawT=0; },400); } }
  D.callT-=dt; if(D.callT<=0){ D.callT=rr(30,60); snd.call(); }
  // danger: how close the nearest hunter is. Silences the insects, starts the heart.
  let dg=0; for(const r of RAP){ if(!r.root.visible) continue; const k=r.st==='hunt'?1-r.d/24:0; if(k>dg) dg=k; }
  D.danger=lerp(D.danger,clamp(dg,0,1),1-Math.exp(-dt*2)); insects(D.lightsOut?0:1-D.danger*.97);
  // once they hunt, the heart never stops: slow and faint at a distance, racing as they close
  if(D.hunt||D.danger>.05){ D.beatT-=dt; if(D.beatT<=0){ D.beatT=lerp(.95,.34,D.danger); snd.heart(.35+D.danger*.65); } }
  // a flashlight on its last legs, and, once the rift is open, the dark
  if(D.lightsOut) D.dark=Math.min(1,D.dark+dt/3.5);
  if(D.flashDie>0){ D.flashDie-=dt; D.flick=.1; if(D.flashDie<=0){ D.flashDead=true; D.sputT=rr(2,4); snd.crackle(); } }
  // dead, but not quite: every few seconds it sputters back for a moment
  if(D.flashDead){ if(D.sput>0) D.sput-=dt; else { D.sputT-=dt; if(D.sputT<=0){ D.sputT=rr(2.5,5.5); D.sput=rr(.15,.7); } } }
  D.flickT-=dt; if(D.flickT<=0){ D.flickT=rr(35,70); D.flick=1.3; }
  if(D.flick>0) D.flick-=dt;
}

function enterCret(){ if(!C) buildCret();
  C.sc.add(cam); setPal(PAL_NIGHT); fallAudioStop(); nightAudio(1); insects(1);
  TP.x=SPAWN.x; TP.z=SPAWN.z; TP.acc=0; TP.jy=TP.vy=0; P.yaw=Math.PI; P.pitch=.72;
  Object.assign(D,{t:0,dark:0,lightsOut:false,flashDie:0,flashDead:false,sput:0,sputT:0,hunt:false,huntIn:-1,shards:0,callT:18,clickT:12,beatT:0,flick:0,flickT:50,danger:0,flashOn:true});
  RAP.forEach((r,i)=>{ r.st='off'; r.root.visible=false; r.tm=[4,10,16][i]; r.litT=0; r.jawT=0; r.hideT=0; }); reveal(false); resetEyes();
  C.shards.forEach(s=>{ s.got=false; s.g.visible=true; });
  C.rift.g.scale.set(.25,.85,1); C.rift.em.opacity=.35; C.riftL.intensity=.4;
  document.body.classList.add('twalk'); $('#yearVal').textContent='130M BC'; $('#year').classList.add('past'); $('#shiftBtn').textContent='Leave rift';
}
function arrive(){ pickEls.forEach(b=>{ b.hidden=true; }); enterCret(); S.mode='enter'; S.t=0; S.fade=1; fadeTo(1,0,'#000'); snd.thud(); R.sfx.shift();
  title('Temporal recovery · Rift 86','c. 130,000,000 BC','Early Cretaceous · a sinkhole in what will one day be Utah');
  after(3,()=>{ untitle(); fadeTo(0,reduce?.6:2.4); S.mode='cret'; S.t=0; }); after(4.6,updateObjective); }

function cretFrame(dt,inp){ const t=S.t;
  if(S.mode==='cret'){
    const m=inp.m; if(m>.05){ const sp=(inp.run?3.6:2)*Math.min(1,m)/Math.max(1,m), yaw=P.yaw;
      const vx=(-Math.sin(yaw)*inp.f+Math.cos(yaw)*inp.s)*sp*dt, vz=(-Math.cos(yaw)*inp.f-Math.sin(yaw)*inp.s)*sp*dt;
      if(!blockedC(TP.x+vx,TP.z)) TP.x+=vx; if(!blockedC(TP.x,TP.z+vz)) TP.z+=vz;
      TP.bob+=dt*(inp.run?11:8); TP.acc+=Math.hypot(vx,vz); if(TP.jy<=0&&TP.acc>(inp.run?1:.78)){ TP.acc=0; snd.step(); } }
    // shards
    for(const s of C.shards){ if(s.got) continue; if(Math.hypot(TP.x-s.x,TP.z-s.z)<1.3){ s.got=true; s.g.visible=false; D.shards++; snd.chime(); S.glitch=.5;
      if(D.shards<3){ msg(`Shard ${D.shards} of 3`); for(let k=0;k<3;k++){ const r=voice(); if(r) setTimeout(()=>snd.click(panOf(r.x,r.z),vol(r.d)),rnd()*900); } }
      else { msg('The rift is open'); D.lightsOut=true; D.flashDie=1.8; D.huntIn=4.5; scatter(); snd.thud(); setTimeout(()=>snd.growl(0,.7),2600); } updateObjective(); } }
    if(D.shards>=3&&Math.hypot(TP.x-RIFTP.x,TP.z-RIFTP.z)<1.5) leave();
    director(dt);
  }
  for(const r of RAP){ if(S.mode==='cret') rapThink(r,dt); }
  // camera
  const bob=reduce?0:Math.sin(TP.bob)*.035;
  if(TP.jy>0||TP.vy>0){ TP.vy-=13*dt; TP.jy+=TP.vy*dt; if(TP.jy<=0){ TP.jy=0; TP.vy=0; snd.step(); } }
  cam.position.set(TP.x,gh(TP.x,TP.z)+1.6+bob+TP.jy,TP.z);
  let pitch=P.pitch;
  if(S.mode==='dead'){ const r=D.killer, k=reduce?1:sstep(0,.22,t);
    P.yaw=angLerp(D.yaw0,D.yawTo,k); pitch=P.pitch=lerp(P.pitch,.05,k);
    if(!reduce){ const dd=Math.max(.9,2.4-t*7); r.x=TP.x-Math.sin(P.yaw)*dd; r.z=TP.z-Math.cos(P.yaw)*dd; } r.h=Math.atan2(TP.x-r.x,TP.z-r.z); r.jawT=.6; r.crouch=0; r.mv=4;
    if(t>(reduce?.05:.5)&&!D.blacked){ D.blacked=true; S.fade=1; fadeTo(1,0,'#000'); nightAudio(0); title('','HUNTED','It was behind you the whole time.',true); }
    if(t>3.4){ D.blacked=false; respawn(); } }
  cam.rotation.set(pitch,P.yaw,reduce?0:Math.sin(TP.bob*.5)*.004);
  cam.updateMatrixWorld();
  for(const r of RAP) rapPose(r,dt);
  eyesFrame(dt);
  // flashlight (with the odd failing flicker)
  const fl=D.flick>0?(Math.random()<.5?0:.6):1; C.flash.intensity=!D.flashOn?0:D.flashDead?(D.sput>0?(Math.random()<.65?2.4:.4):0):2.6*fl; if(S.mode==='dead') C.flash.intensity=2.6;
  // rift + shards
  const open=D.shards>=3; C.rift.g.scale.x=lerp(C.rift.g.scale.x,open?1:.25,dt*2); C.rift.g.scale.y=lerp(C.rift.g.scale.y,open?1:.85,dt*2);
  C.rift.em.opacity=open?.9:.3+Math.random()*.1; shimmer(C.rift,S.T,open?1.2:.4); C.riftL.intensity=(open?1.6:.35)+Math.sin(S.T*9)*.15; C.riftL.distance=open?14:8;
  // the moon goes behind cloud and takes every other light with it
  const k=D.dark; C.hemi.intensity=.4*(1-k*.9); C.moonL.intensity=1.35*(1-k); C.shaft.material.opacity=.07*(1-k); C.motes.material.opacity=.7*(1-k);
  C.moon.material.opacity=1-k*.95; C.halo.material.opacity=1-k; C.skyM.material.color.setScalar(1-k*.75); C.starM.opacity=1-k*.85; C.sc.fog.color.setHex(0x070b10).multiplyScalar(1-k);
  for(const s of C.shards){ if(s.got) continue; s.a.rotation.y+=dt*1.5; s.g.position.y=s.y+Math.sin(S.T*2+s.x)*.08; }
  // moon in the pond
  const ty=(cam.position.y-WATER_Y)/MOON.y; tv.set(cam.position.x+MOON.x*ty,WATER_Y+.01,cam.position.z+MOON.z*ty);
  const inPond=Math.hypot(tv.x-POND.x,tv.z-POND.z)<POND.r-.2; C.moonRef.visible=inPond&&D.dark<.4; if(inPond){ C.moonRef.position.copy(tv); const s=ty*.16; C.moonRef.scale.set(s,s,1); }
  // motes
  if((S.frame=(S.frame||0)+1)%2===0){ const mp=C.mp, L=C.shaftL; for(let i=0;i<C.mb.length;i++){ const b=C.mb[i]; mp[i*3]=b[0]+Math.sin(S.T*.2+b[3])*.3; mp[i*3+1]=((b[1]+S.T*.15+L/2)%L+L)%L-L/2; mp[i*3+2]=b[2]+Math.cos(S.T*.17+b[3])*.3; } C.mg.attributes.position.needsUpdate=true; }
  if(S.frame%45===0) updateObjective();
  render(C.sc);
}
function blockedC(x,z){ if(Math.hypot(x,z)>RB-4.6) return true; if(Math.hypot(x-POND.x,z-POND.z)<POND.r-.7) return true;
  for(const c of CIRC){ const dx=x-c.x, dz=z-c.z, rr2=c.r+.3; if(dx*dx+dz*dz<rr2*rr2) return true; } return false; }

/* ================= LIFECYCLE ================= */
function begin(){ if(S.active) return; S.active=true; S.leaving=false; Q=[]; S.T=0; S.glitch=1;
  R.setTravelling(true); R.unlock(); document.body.classList.add('travel'); $('#shiftBtn').textContent='Leave rift';
  startFall(); }
function leave(){ if(!S.active||S.leaving) return; S.leaving=true; skipEl.hidden=true; pickEls.forEach(b=>{ b.hidden=true; });
  caption(''); untitle(); objEl.classList.remove('on'); snd.whoosh(); S.glitch=1; fadeTo(1,.7,'#000');
  after(.8,()=>{ S.active=false; S.mode=null; Q=[]; msgT=0; msgEl.classList.remove('on'); objEl.classList.remove('on'); capEl.textContent=''; untitle(); fallAudioStop(); if(night) nightAudio(0); setPal(PAL_CORR); postMat.uniforms.glitch.value=0;
    document.body.classList.remove('travel','twalk'); $('#year').classList.remove('past'); R.setTravelling(false); R.home();
    fadeEl.style.transition='none'; fadeEl.style.opacity=1; requestAnimationFrame(()=>{ fadeEl.style.transition='opacity 1s steps(8)'; fadeEl.style.opacity=0; setTimeout(()=>{ fadeEl.style.transition='none'; },1100); }); }); }
function key(k){
  if(S.mode==='fall'&&(k===' '||k==='enter'||k==='escape')) skip();
  else if(S.mode==='choose'){ if(k>='1'&&k<='4') choose(+k-1); else if(k==='escape') leave(); }
  else if(S.mode==='cret'){ if(k===' ') jump(); else if(k==='f'){ if(D.flashDead) msg('The flashlight is dying'); else { D.flashOn=!D.flashOn; R.sfx.ui(); } } else if(k==='t') msg('Time will not shift here'); else if(k>='1'&&k<='5') msg('Your records stayed in 1986'); }
}
function jump(){ if(S.mode!=='cret'||TP.jy>0||TP.vy>0) return; TP.vy=4.4; TP.jy=.001; }
function click(){ if(S.mode==='cret'&&!R.touch()&&!R.locked()) R.lock(); }
function frame(dt,inp){ if(!S.active) return; S.t+=dt; S.T+=dt;
  for(let i=0;i<Q.length;i++) if(Q[i].at<=S.T){ const f=Q[i].fn; Q.splice(i--,1); f(); if(!S.active) return; }
  postMat.uniforms.time.value=S.T; postMat.uniforms.glitch.value=S.glitch; postMat.uniforms.lift.value=S.mode==='cret'||S.mode==='dead'||S.mode==='enter'?.012:0;
  S.glitch=Math.max(0,S.glitch-dt*1.6);
  if(S.mode==='fall'||S.mode==='choose'||S.mode==='go') fallFrame(dt); else if(C&&S.mode) cretFrame(dt,inp);
  // fade, caption typewriter, toast
  const st=dt*S.fadeRate; S.fade=S.fade<S.fadeTo?Math.min(S.fadeTo,S.fade+st):Math.max(S.fadeTo,S.fade-st); fadeEl.style.opacity=Math.round(S.fade*8)/8;
  if(S.cap||capEl.textContent){ S.capT+=dt; const n=Math.min(S.cap.length,Math.floor(S.capT*32)); const s=S.cap.slice(0,n); if(capEl.textContent!==s) capEl.textContent=s; }
  if(msgT>0){ msgT-=dt; if(msgT<=0) msgEl.classList.remove('on'); }
}

window.RiftTravel={begin,leave,key,click,frame,get active(){ return S.active; }};
})();
