/* Rift 86 · Convergence
   Where the leaks run to. Reached only by getting out of the Backrooms: the escape lift goes down, not up
   (rift-back.js escape → K.go('conv')). Never labelled, never hinted, never in the picker.
   Calder Street Station, one building in two times: 1886, in use, the week of the subway fall; and 20??, after.
   T shifts between them anywhere (the corridor's rule: no cooldown). The only refusal: a shift that would put you
   inside something the other time has where you stand.
   Lore notes live in CONVERGENCE-LORE.md. The analog-horror figures here are original, in the style of the genre; the
   containment-log framing is a nod to the SCP Foundation (CC BY-SA 3.0, scp-wiki.wikidot.com); the obelisk is a generic
   homage, not anyone's model. */
(function(root){
'use strict';
const K=root.__RTK; if(!K) return;
const {R,S,P,reduce,cam,tex,px,clamp,lerp,sstep,put,flush,after,title,untitle,msg,caption,fadeTo,setPal,toPal}=K;
const $=s=>document.querySelector(s);

/* ================= RULES =================
   1. Causality runs one way: what you change in 1886 is still there in 20?? (rotted, rusted). Nothing you do in 20??
      reaches back.
   2. The three men exist only in 1886. They can't shift. They walk only where 1886 lets them.
   3. 20?? is for scouting: the collapse has settled, so you can see where the rock is thin and get round what 1886 bars.
   4. They follow you while you're with them in 1886. Shift away and they wait where they stand, in the dark.
   5. All three up on the concourse: nobody digs under the up line. The timeline that always was stops being the only one. */
const TS=2;                                         // metres per texture tile on walls and floors
const DEEP=-5, TUN_H=2.6, HALL_H=8;                 // the old subway runs 5 m down
const SPAWN={x:0,z:-1.1};
const PAL_A=toPal(['#07050a','#140d0a','#24170f','#3a2416','#55331d','#744626','#9a5f31','#c27d3e','#e3a457','#f6d38c',
  '#fff1cc','#1d2420','#33413a','#536457','#7d8d7c','#4a1712','#7a2a1c','#a83f26','#5e5a52','#a49a86']);   // 1886: soot, brick, gaslight, iron green
const PAL_B=toPal(['#040506','#0b0f10','#151b1c','#202a2a','#2f3c3b','#45534f','#5f6e67','#7f8c82','#a3ada0','#d0d6c8',
  '#f1f4ea','#1a0c0c','#3a1414','#5e1d1a','#8a2a22','#b8402e','#2a2a1c','#4a4a2c','#6e6a3e','#ff2a1a']);   // 20??: grey-green ruin, the growth, one red
const SKEY='r86.conv', FKEY='r86.fracture';

/* ================= STATE ================= */
const TP={x:0,z:0,bob:0,acc:0};
const L={era:2,fract:false,carry:false,reading:null,loops:0,trainIn:false,trainT:0,pickT:0,helpT:0,tickT:0,tcT:0,tcOn:0,met:{}};
const G={dug1:false,dug2:false,bolt:false,prop:false,hit1:0,hit2:0};
// the men: Amos Reid (behind the first fall), Tom Hale (bolted in), Walter Brisk (nearest the thing)
const WK=[
  {id:'a',name:'Amos',hx:-21.2,hz:-22,  sx:-2.2,sz:-9.4},
  {id:'b',name:'Tom',hx:-22.6,hz:-33,   sx:-.6,sz:-9.9},
  {id:'c',name:'Walter',hx:-21.5,hz:-50,sx:1,sz:-9.3}].map(w=>Object.assign(w,{x:w.hx,z:w.hz,st:'wait',joined:false,out:false,bob:0,g:null}));
const trail=[];
function load(){ let d={}; try{ d=JSON.parse(localStorage.getItem(SKEY)||'{}')||{}; }catch(e){}
  G.dug1=!!d.d1; G.dug2=!!d.d2; G.bolt=!!d.b; G.prop=!!d.p; const o=d.o||[]; WK.forEach((w,i)=>{ w.out=!!o[i]; });
  try{ L.fract=localStorage.getItem(FKEY)==='1'; }catch(e){ L.fract=false; }
  if(L.fract) WK.forEach(w=>{ w.out=true; }); }
function save(){ try{ localStorage.setItem(SKEY,JSON.stringify({d1:G.dug1,d2:G.dug2,b:G.bolt,p:G.prop,o:WK.map(w=>w.out?1:0)})); }catch(e){} }

/* ================= THE PLACE =================
   Surface (y 0): concourse z 0..-14 (lift in the south wall, waiting room SW, booking office SE), then the platforms
   to the north end wall at z -46: 4 (x -12..-7), track, 4½ (x -1..3), track, 5 (x 9..12).
   Down (y -5): the subway, x -24..-20, from z -9 to the end wall at -56. 1886 reached it by the stair off the
   concourse; in 20?? the stair is grown shut and the platform has split open just north of the buffers.
   Along it, south to north: the first fall (X1, z -18), Amos; Tom's door (D1, z -27); the bad roof (Y, z -37.5);
   the second fall (X2, z -41), Walter; the end wall, and in 20?? what's behind it. */
// solid rects: on(era) says whether the rect is there in that time (1 = 1886, 2 = 20??)
const ALL=()=>true, OLD=e=>e===1, RUIN=e=>e===2&&!L.fract;
const RECTS=[];
const rect=(x0,x1,z0,z1,on)=>RECTS.push({x0,x1,z0,z1,on:on||ALL});
function solids(){ RECTS.length=0;
  // the hall
  rect(-12.3,12.3,0,.3); rect(12,12.3,-46,0); rect(-12.3,12.3,-46.3,-46);
  rect(-12.3,-12,-46,-16.5); rect(-12.3,-12,-14.5,-12.5); rect(-12.3,-12,-10.5,-3.6); rect(-12.3,-12,-2.4,0);
  rect(-12.3,-12,-16.5,-14.5,e=>e===1||L.fract);                       // the wall the ruin broke through
  // the waiting room, and the door in its far wall that only ever leads back into it
  rect(-6.15,-5.85,-6,-3.6); rect(-6.15,-5.85,-2.4,0); rect(-12,-5.85,-6.15,-5.85);
  rect(-13,-12.7,-3.9,-2.1); rect(-12.7,-12,-3.9,-3.6); rect(-12.7,-12,-2.4,-2.1);
  // the booking office
  rect(5.85,6.15,-6,-3.6); rect(5.85,6.15,-2.4,0); rect(5.85,12,-6.15,-5.85); rect(9.6,11.4,-2.6,-1.6);   // desk
  // the tracks: you don't walk the line
  rect(-7,-1,-46,-15); rect(3,9,-46,-15);
  // the stair down, and the split in the platform beside it
  rect(-20,-12,-12.8,-12.5); rect(-20,-12,-10.5,-10.2); rect(-20,-12.3,-14.5,-12.8); rect(-20,-12.3,-16.8,-16.5);
  rect(-13,-12,-12.5,-10.5,RUIN);                                       // grown shut at the top
  rect(-20,-12,-16.5,-14.5,e=>e===1||L.fract);                          // 1886 (and after): solid ground, no way down
  // the subway shell
  rect(-24.3,-24,-56,-9); rect(-24.3,-19.7,-9,-8.7);
  rect(-20,-19.7,-56,-16.5); rect(-20,-19.7,-14.5,-12.5); rect(-20,-19.7,-10.5,-9);
  rect(-24.3,-19.7,-56.3,-56,e=>e===1||L.fract);                        // the end wall, while it still stands
  // what's under the up line (20??): the chamber, and the thing in it
  rect(-26.3,-26,-64,-56); rect(-14,-13.7,-64,-56); rect(-26.3,-13.7,-64.3,-64); rect(-26.3,-24,-56.3,-56); rect(-20,-13.7,-56.3,-56);
  rect(-21,-19,-62,-60);
  // X1: the first fall. 1886 is solid across; by 20?? it has settled, and a gap shows where it was always thin
  rect(-24,-23.6,-18.75,-17.25); rect(-22.4,-20,-18.75,-17.25); rect(-23.6,-22.4,-18.75,-17.25,e=>e===1&&!G.dug1);
  // D1: Tom's door, bolted on his side. Rotted to nothing by 20??
  rect(-24,-20,-27.15,-26.85,e=>e===1&&!G.bolt);
  // Y: the bad roof. Fine in 1886; in 20?? it came down, unless someone propped it
  rect(-24,-20,-38.5,-36.5,e=>e===2&&!G.prop&&!L.fract);
  // X2: the second fall, thin near the east wall
  rect(-24,-21.6,-41.75,-40.25); rect(-20.4,-20,-41.75,-40.25); rect(-21.6,-20.4,-41.75,-40.25,e=>e===1&&!G.dug2);
}
solids();
function blockedAt(x,z,era){ const rr=.28; for(const c of RECTS) if(x>c.x0-rr&&x<c.x1+rr&&z>c.z0-rr&&z<c.z1+rr&&c.on(era)) return true; return false; }
function floorH(x,z){ if(x<-19.99||(z<-55.9&&x<-13.5)) return DEEP;
  if(x<-12&&z>-16.6&&z<-10.4) return DEEP*clamp((-12-x)/8,0,1); return 0; }
const under=()=>floorH(TP.x,TP.z)<-2.5;

/* ================= BUILD ================= */
let W=null;
function build(){ const r=(()=>{ let s=1886; return ()=>((s=(s*16807)%2147483647)/2147483647); })();
  const sc=new THREE.Scene(); sc.background=new THREE.Color(0x101414); sc.fog=new THREE.FogExp2(0x101414,.05);
  const T={
    brick:tex(16,16,(g,w,h)=>{ px(g,'#7a3a24',0,0,w,h); for(let y=0;y<h;y+=4){ px(g,'#3a2416',0,y,w,1); for(let x=(y/4)%2?0:4;x<w;x+=8) px(g,'#3a2416',x,y,1,4); }
      for(let i=0;i<14;i++) px(g,['#8a4a2c','#5e2c1c'][i%2],r()*w,r()*h,2,1); },1,1),
    flag:tex(16,16,(g,w,h)=>{ px(g,'#6a645a',0,0,w,h); px(g,'#3a3630',0,0,w,1); px(g,'#3a3630',0,8,w,1); px(g,'#3a3630',0,0,1,8); px(g,'#3a3630',8,8,1,8);
      for(let i=0;i<20;i++) px(g,['#5e5a52','#7a746a'][i%2],r()*w,r()*h); },1,1),
    rock:tex(16,16,(g,w,h)=>{ px(g,'#4a4238',0,0,w,h); for(let i=0;i<60;i++) px(g,['#2e2924','#5e554a','#3a342d','#6e6458'][i%4],r()*w,r()*h,1+(r()*2|0),1+(r()*2|0)); },1,1),
    wood:tex(16,16,(g,w,h)=>{ px(g,'#6e4a2c',0,0,w,h); for(let y=0;y<h;y+=4) px(g,'#3a2416',0,y,w,1); for(let i=0;i<10;i++) px(g,'#8a5e38',r()*w,r()*h,3,1); },1,1),
    growth:tex(8,8,(g,w,h)=>{ px(g,'#5e1d1a',0,0,w,h); for(let i=0;i<20;i++) px(g,['#8a2a22','#3a1414','#b8402e'][i%3],r()*w,r()*h); },1,1),
    paper:tex(8,8,(g,w,h)=>{ px(g,'#d9cfb4',0,0,w,h); for(let y=1;y<h;y+=2) px(g,'#8a8270',1,y,w-2,1); })
  };
  const M={
    brick:new THREE.MeshLambertMaterial({map:T.brick}), flag:new THREE.MeshLambertMaterial({map:T.flag}), rock:new THREE.MeshLambertMaterial({map:T.rock}),
    wood:new THREE.MeshLambertMaterial({map:T.wood}), iron:new THREE.MeshLambertMaterial({color:0x2e3a33}), roof:new THREE.MeshLambertMaterial({color:0x3a3630}),
    growth:new THREE.MeshLambertMaterial({map:T.growth,emissive:0x1a0404}), paper:new THREE.MeshBasicMaterial({map:T.paper}),
    dark:new THREE.MeshBasicMaterial({color:0x050404}), cloth:new THREE.MeshLambertMaterial({color:0x3a3024}), skin:new THREE.MeshLambertMaterial({color:0x9a7a5e}),
    glass:new THREE.MeshBasicMaterial({color:0xf6d38c}), obel:new THREE.MeshLambertMaterial({color:0x1a0c0c,emissive:0x3a0805})
  };
  // the same stone in two times: clean and gaslit, then greyed and wet
  const TINT=[[M.brick,0xffffff,0x8a9690],[M.flag,0xffffff,0x8a948c],[M.wood,0xffffff,0x6e7066],[M.iron,0x2e3a33,0x3a403c],[M.roof,0x3a3630,0x2a302e],[M.rock,0xffffff,0xa0a49c]];
  const bx=new THREE.BoxGeometry(1,1,1), pl=new THREE.PlaneGeometry(1,1), ico=new THREE.IcosahedronGeometry(.5,0);
  // a box in world units whose texture tiles every TS metres instead of stretching
  function wbox(mat,x0,x1,y0,y1,z0,z1){ const g=new THREE.BoxGeometry(x1-x0,y1-y0,z1-z0); g.translate((x0+x1)/2,(y0+y1)/2,(z0+z1)/2);
    const p=g.attributes.position, n=g.attributes.normal, uv=g.attributes.uv;
    for(let i=0;i<p.count;i++){ const x=p.getX(i), y=p.getY(i), z=p.getZ(i);
      if(Math.abs(n.getY(i))>.5) uv.setXY(i,x/TS,z/TS); else if(Math.abs(n.getX(i))>.5) uv.setXY(i,z/TS,y/TS); else uv.setXY(i,x/TS,y/TS); }
    put(g,mat,0,0,0); }
  const label=(txt,w,h,bg,fg,font)=>tex(w,h,(g,W2,H2)=>{ px(g,bg,0,0,W2,H2); g.fillStyle=fg; g.font=font||`${H2-4}px monospace`; g.textAlign='center'; g.textBaseline='middle'; g.fillText(txt,W2/2,H2/2+1); });
  const sign=(par,t,x,y,z,ry,w,h,bg,fg)=>{ const m=new THREE.Mesh(pl,new THREE.MeshBasicMaterial({map:label(t,64,16,bg,fg)})); m.scale.set(w,h,1); m.position.set(x,y,z); m.rotation.y=ry||0; par.add(m); return m; };

  /* ---- both times: the bones ---- */
  wbox(M.flag,-12,12,-.2,0,-15,0); for(const [a,b] of [[-12,-7],[-1,3],[9,12]]) wbox(M.flag,a,b,-1,0,-46,-15);   // concourse, then the platforms
  wbox(M.roof,-12.3,12.3,HALL_H,HALL_H+.3,-46.3,.3);                     // hall roof
  wbox(M.brick,-12.3,12.3,0,HALL_H,0,.3); wbox(M.brick,12,12.3,0,HALL_H,-46,0);
  wbox(M.brick,-12.3,-12,0,HALL_H,-46,-16.5); wbox(M.brick,-12.3,-12,0,HALL_H,-14.5,-12.5); wbox(M.brick,-12.3,-12,0,HALL_H,-10.5,-3.6); wbox(M.brick,-12.3,-12,0,HALL_H,-2.4,0);
  wbox(M.brick,-12.3,-12,2.6,HALL_H,-16.5,-14.5); wbox(M.brick,-12.3,-12,2.4,HALL_H,-3.6,-2.4); wbox(M.brick,-12.3,-12,2.6,HALL_H,-12.5,-10.5);
  // north end: wall with the arch the line runs through
  wbox(M.brick,-12.3,-6.5,0,HALL_H,-46.3,-46); wbox(M.brick,-1.5,12.3,0,HALL_H,-46.3,-46); wbox(M.brick,-6.5,-1.5,4.6,HALL_H,-46.3,-46);
  put(pl,M.dark,-4,2.3,-46.4,0,0,0,5,4.6,1);
  // waiting room, booking office
  wbox(M.wood,-6.15,-5.85,0,3.2,-6,-3.6); wbox(M.wood,-6.15,-5.85,0,3.2,-2.4,0); wbox(M.wood,-6.15,-5.85,2.4,3.2,-3.6,-2.4); wbox(M.wood,-12,-5.85,0,3.2,-6.15,-5.85); wbox(M.wood,-12,-5.85,3.2,3.3,-6.15,0);
  wbox(M.dark,-13,-12.7,0,2.4,-3.9,-2.1); wbox(M.wood,-12.7,-12,0,2.4,-3.9,-3.6); wbox(M.wood,-12.7,-12,0,2.4,-2.4,-2.1);
  for(const z of [-1.2,-4.8]) { wbox(M.wood,-11.4,-6.8,.42,.5,z-.25,z+.25); wbox(M.wood,-11.4,-6.8,.5,1,z+.2,z+.25); }
  wbox(M.wood,5.85,6.15,0,3.2,-6,-3.6); wbox(M.wood,5.85,6.15,0,3.2,-2.4,0); wbox(M.wood,5.85,6.15,2.4,3.2,-3.6,-2.4); wbox(M.wood,5.85,12,0,3.2,-6.15,-5.85); wbox(M.wood,5.85,12,3.2,3.3,-6.15,0);
  wbox(M.wood,9.6,11.4,0,.9,-2.6,-1.6);
  // platforms: a coping edge, the line sunk between
  for(const [a,b] of [[-7,-1],[3,9]]){ wbox(M.rock,a,b,-1.1,-.9,-46,-15); for(const x of [a+1.6,b-1.6]) wbox(M.iron,x-.05,x+.05,-.9,-.8,-46,-15);
    wbox(M.wood,a+.6,b-.6,0,.9,-15.4,-15); }                              // buffers
  for(const [a,b] of [[-7,-1],[3,9]]) wbox(M.rock,a,b,-1,0,-15.2,-15);                           // the face below the buffers
  for(const x of [-6.95,-1.05,3.05,8.95]) wbox(M.rock,x-.05,x+.05,-1,0,-46,-15);
  // canopy columns
  for(let z=-18;z>-46;z-=7) for(const x of [-9.5,1,10.5]) wbox(M.iron,x-.12,x+.12,0,HALL_H,z-.12,z+.12);
  // the stair down: steps, walls, a ceiling that follows
  for(let i=0;i<16;i++){ const x0=-12-i*.5; wbox(M.flag,x0-.5,x0,DEEP*(i+1)/16-.3,DEEP*(i+1)/16+.001,-12.5,-10.5); }
  wbox(M.brick,-20,-12,DEEP,2.6,-12.8,-12.5); wbox(M.brick,-20,-12,DEEP,2.6,-10.5,-10.2);
  put(bx,M.roof,-16,2.6+DEEP/2,-11.5,0,0,Math.atan2(-DEEP,8),Math.hypot(8,DEEP),.2,2.6);
  // the split passage beside it (walls in both times; only 20?? has a way through)
  wbox(M.rock,-20,-12.3,DEEP,2.6,-14.5,-12.8); wbox(M.rock,-20,-12.3,DEEP,2.6,-16.8,-16.5);
  put(bx,M.rock,-16,2.6+DEEP/2,-15.5,0,0,Math.atan2(-DEEP,8),Math.hypot(8,DEEP),.2,2.4);
  // the subway: floor, walls, ceiling
  wbox(M.flag,-24,-20,DEEP-.2,DEEP,-56,-9); wbox(M.roof,-24.3,-19.7,DEEP+TUN_H,DEEP+TUN_H+.2,-56,-9);
  wbox(M.brick,-24.3,-24,DEEP,DEEP+TUN_H,-56,-9); wbox(M.brick,-24.3,-19.7,DEEP,DEEP+TUN_H,-9,-8.7);
  wbox(M.brick,-20,-19.7,DEEP,DEEP+TUN_H,-56,-16.5); wbox(M.brick,-20,-19.7,DEEP,DEEP+TUN_H,-14.5,-12.5); wbox(M.brick,-20,-19.7,DEEP,DEEP+TUN_H,-10.5,-9);
  // the falls: what stays in both times (the thin plugs are separate, below)
  const rubble=(x0,x1,z0,z1,h)=>{ wbox(M.rock,x0,x1,DEEP,DEEP+h,z0,z1); for(let i=0;i<5;i++) put(ico,M.rock,lerp(x0,x1,r()),DEEP+h*.4+r()*.5,lerp(z0,z1,r()),r()*3,r()*3,0,.8+r()*.6,.6,.8); };
  rubble(-24,-23.6,-18.75,-17.25,TUN_H); rubble(-22.4,-20,-18.75,-17.25,TUN_H); rubble(-24,-21.6,-41.75,-40.25,TUN_H); rubble(-20.4,-20,-41.75,-40.25,TUN_H);
  wbox(M.wood,-24,-23.7,DEEP,DEEP+2.4,-27.3,-26.7); wbox(M.wood,-20.3,-20,DEEP,DEEP+2.4,-27.3,-26.7); wbox(M.wood,-24,-20,DEEP+2.2,DEEP+TUN_H,-27.3,-26.7);   // Tom's door frame
  // the lift, which has no business in a station this old, in either time
  const lift=new THREE.Group();
  for(const [w,h,d,x,y,z,m] of [[1.6,2.45,.05,0,1.225,.17,M.dark],[.7,2.2,.04,-.36,1.1,.21,M.iron],[.7,2.2,.04,.36,1.1,.21,M.iron],[1.75,.12,.08,0,2.5,.18,M.iron]]){
    const o=new THREE.Mesh(bx,m); o.scale.set(w,h,d); o.position.set(x,y,-z); lift.add(o); }
  sc.add(lift);
  sign(sc,'CALDER STREET',0,6.2,-.02,Math.PI,7,1.6,'#1d2420','#e3d6b0');
  sign(sc,'4',-9.5,4.6,-15.2,0,1.2,.9,'#1d2420','#e3d6b0'); sign(sc,'4½',1,4.6,-15.2,0,1.2,.9,'#1d2420','#e3d6b0'); sign(sc,'5',10.5,4.6,-15.2,0,1.2,.9,'#1d2420','#e3d6b0');
  sign(sc,'WAITING ROOM',-5.83,2.8,-3,Math.PI/2,2.4,.5,'#1d2420','#e3d6b0'); sign(sc,'BOOKING OFFICE',5.83,2.8,-3,-Math.PI/2,2.4,.5,'#1d2420','#e3d6b0');
  // the clock over the platforms: kept going in 1886, stopped at twelve past three after
  const clock=new THREE.Group(); clock.position.set(0,5.6,-13.9); sc.add(clock);
  clock.add(new THREE.Mesh(new THREE.CircleGeometry(.9,16),new THREE.MeshBasicMaterial({map:tex(32,32,(g,w,h)=>{ px(g,'#1d2420',0,0,w,h); g.fillStyle='#e3d6b0'; g.beginPath(); g.arc(16,16,15,0,7); g.fill();
    for(let i=0;i<12;i++){ const a=i/12*Math.PI*2; px(g,'#1d2420',16+Math.sin(a)*12.5,16-Math.cos(a)*12.5,1,1); } })})));
  const hand=(len,w)=>{ const g=new THREE.Group(), m=new THREE.Mesh(bx,new THREE.MeshBasicMaterial({color:0x14100c})); m.scale.set(w,len,.02); m.position.set(0,len/2,.02); g.add(m); clock.add(g); return g; };
  const hH=hand(.45,.07), hM=hand(.7,.05);
  flush(sc);

  /* ---- 1886 only ---- */
  const g1=new THREE.Group(); sc.add(g1);
  for(const [x,y,z] of [[-6,4.2,-7],[6,4.2,-7],[-9.5,3.6,-28],[1,3.6,-34],[-22,DEEP+2.2,-11],[-22,DEEP+2.2,-49]]){ wbox(M.iron,x-.04,x+.04,y,y<0?DEEP+TUN_H:HALL_H,z-.04,z+.04); put(bx,M.glass,x,y-.15,z,0,0,0,.22,.3,.22); }
  // the timetable, painted; the hoarding round Coyle's dig at the end of the up line
  put(pl,new THREE.MeshBasicMaterial({map:tex(64,32,(g,w,h)=>{ px(g,'#1d2420',0,0,w,h); px(g,'#e3d6b0',4,3,56,2); for(let y=9;y<30;y+=4){ px(g,'#a49a86',4,y,24,1); px(g,'#a49a86',36,y,10,1); px(g,'#e3a457',52,y,8,1); } })}),6,4.4,-13.85,0,0,0,4.2,2.1,1);
  for(let x=-6.8;x<-1.2;x+=.6) wbox(M.wood,x,x+.5,-1,1.6,-42.2,-42); wbox(M.rock,-6.4,-1.6,-1,-.3,-45.5,-42.6);
  for(let i=0;i<6;i++) put(ico,M.rock,-4+(r()-.5)*4,-.5,-44+(r()-.5)*2.4,r(),r(),0,.9,.5,.9);
  // posters, a bench on each platform, Coyle's barrow
  for(const z of [-22,-36]){ wbox(M.wood,-11.6,-11,0,.45,z-1.2,z+1.2); wbox(M.wood,-11.9,-11.8,.45,1,z-1.2,z+1.2); }
  // the booking office: the photograph (see the extra face), the paper on the desk
  const photo=new THREE.Mesh(pl,new THREE.MeshBasicMaterial({map:tex(48,32,(g,w,h)=>{ px(g,'#3a2416',0,0,w,h); px(g,'#c9b08a',2,2,w-4,h-4); px(g,'#a4875e',2,18,w-4,12);
    for(let i=0;i<11;i++){ const x=5+(i%6)*7, y=i<6?8:17; px(g,'#3a2416',x,y,4,7); px(g,'#5e4430',x+1,y-3,2,3); }
    px(g,'#14100c',42,3,3,14); px(g,'#e8dcc4',42,3,3,3); })}));                                 // twelve people, eleven names: the last one is too tall, and its face is blank
  photo.scale.set(1.2,.8,1); photo.position.set(11.84,1.8,-3.2); photo.rotation.y=-Math.PI/2; g1.add(photo);
  put(pl,M.paper,10.4,.91,-2.1,-Math.PI/2,0,.2,.5,.35,1); put(pl,M.paper,-9,.51,-4.85,-Math.PI/2,0,-.3,.4,.3,1);
  // down below: Coyle's men left timber at the stair foot; the rock face on 1886's side of each fall
  const timber=new THREE.Group(); for(let i=0;i<4;i++){ const m=new THREE.Mesh(bx,M.wood); m.scale.set(.18,.18,2.4); m.position.set(-23.2+i*.22,DEEP+.09+(i%2)*.18,-10.2); timber.add(m); } g1.add(timber);
  // the bad roof: split, and it knows it
  for(let i=0;i<5;i++) put(bx,M.dark,-22+(r()-.5)*3,DEEP+TUN_H-.01,-37.5+(r()-.5)*1.4,0,r()*3,0,.9,.01,.05);
  // the end wall, while it stands: the voices come through here, and it isn't the men
  wbox(M.rock,-24.3,-19.7,DEEP,DEEP+TUN_H,-56.3,-56);
  for(let i=0;i<4;i++) put(bx,new THREE.MeshBasicMaterial({color:0x7a2a1c}),-22+(r()-.5)*3,DEEP+.4+r()*1.8,-55.98,0,0,r()*3,.04,.5+r()*.4,.01);
  wbox(M.brick,-12.3,-12,0,2.6,-16.5,-14.5); wbox(M.brick,-20,-19.7,DEEP,DEEP+TUN_H,-16.5,-14.5);   // no split in 1886
  flush(g1);

  /* ---- 20?? only: what's left (both before and after the fracture) ---- */
  const g2=new THREE.Group(); sc.add(g2);
  // the departure screens, dead but for a test card
  const TC=[testcard(0),testcard(1),testcard(2)], scrM=new THREE.MeshBasicMaterial({map:TC[0]});
  for(const [x,y,z,ry] of [[6,4.4,-13.85,0],[-9.5,3.4,-30,Math.PI/2],[-22,DEEP+1.7,-9.05,Math.PI]]){ const s=new THREE.Mesh(pl,scrM); s.scale.set(3.2,1.8,1); s.position.set(x,y,z); s.rotation.y=ry; g2.add(s);
    const f=new THREE.Mesh(bx,M.iron); f.scale.set(3.4,2,.1); f.position.set(x-Math.sin(ry)*.06,y,z-Math.cos(ry)*.06); f.rotation.y=ry; g2.add(f); }
  for(const z of [-22,-36]) { const b=new THREE.Mesh(bx,M.iron); b.scale.set(.5,.45,2.6); b.position.set(-11.4,.22,z); g2.add(b); }

  /* ---- 20?? before the fracture: the ruin ---- */
  const gR=new THREE.Group(); sc.add(gR);
  const blob=(x,y,z,s)=>put(ico,M.growth,x,y,z,r()*3,r()*3,0,s*(1+r()*.6),s*(.5+r()*.5),s*(1+r()*.6));
  for(let i=0;i<40;i++){ const x=(r()-.5)*22, z=-r()*45; if(z>-5&&Math.abs(x)<4) continue; blob(x,r()*.3,z,.5+r()*.9); }   // on the floor of the hall, clear of the lift
  for(let i=0;i<24;i++){ const s=r()<.5?-11.9:11.9; blob(s,r()*6,-r()*45,.6+r()*.8); }   // climbing the walls
  for(let i=0;i<10;i++) blob(-12.4-r()*.6,r()*2.4,-11.5+(r()-.5)*1.8,.7);               // over the stair head
  for(let i=0;i<8;i++) put(bx,M.roof,(r()-.5)*20,.2,-r()*40,r()*.4,r()*3,r()*.4,1+r()*3,.25,.8+r()*2);   // fallen roof
  // the split in the platform, and the rubble slope down
  put(bx,M.rock,-16,DEEP/2-.15,-15.5,0,0,Math.atan2(-DEEP,8),Math.hypot(8,DEEP),.3,2);
  for(let i=0;i<8;i++) put(ico,M.rock,-12.5-r()*7,-r()*4,-15.5+(r()-.5)*1.6,r(),r(),0,.7,.4,.7);
  // Y in the ruin: the fall that didn't happen in 1886 (hidden if it was propped: see gYp)
  // the chamber under the up line, and what was dug up
  wbox(M.rock,-26,-14,DEEP-.2,DEEP,-64,-56); wbox(M.rock,-26.3,-13.7,DEEP+4.5,DEEP+4.7,-64.3,-56);
  wbox(M.rock,-26.3,-26,DEEP,DEEP+4.5,-64,-56); wbox(M.rock,-14,-13.7,DEEP,DEEP+4.5,-64,-56); wbox(M.rock,-26.3,-13.7,DEEP,DEEP+4.5,-64.3,-64);
  wbox(M.rock,-26.3,-24,DEEP,DEEP+4.5,-56.3,-56); wbox(M.rock,-20,-13.7,DEEP,DEEP+4.5,-56.3,-56); wbox(M.rock,-24,-20,DEEP+TUN_H,DEEP+4.5,-56.3,-56);
  for(let i=0;i<9;i++){ const h=4.2-i*.38, w=1.5-i*.11; put(bx,M.obel,-20,DEEP+i*.42+.21,-61,0,i*.09,0,w,.44,w*.8); }
  for(const s of [-1,1]) put(bx,M.obel,-20+s*.35,DEEP+4.1,-61,0,.8,s*.25,.12,.7,.12);
  for(let i=0;i<30;i++){ const a=r()*Math.PI*2, d=1.4+r()*3.5; blob(-20+Math.cos(a)*d,DEEP+r()*.4,-60+Math.sin(a)*d*.6,.5+r()*.6); }
  // what's left of the three men, where they waited (20??, before)
  for(const w of WK){ put(bx,M.cloth,w.hx,DEEP+.08,w.hz,0,r()*3,0,.5,.12,.3); put(bx,M.dark,w.hx+.3,DEEP+.1,w.hz-.2,0,r()*3,0,.12,.2,.28); put(bx,M.dark,w.hx+.45,DEEP+.1,w.hz-.1,0,r()*3,0,.12,.2,.28); }
  // the containment logs, dropped where they were written
  for(const n of NOTES) if(n.era===2&&!n.quiet) put(pl,M.paper,n.x,floorH(n.x,n.z)+.01,n.z,-Math.PI/2,0,r()*3,.32,.42,1);
  flush(gR);
  // the quiet after: one sheet by the lift
  const gQ=new THREE.Group(); sc.add(gQ); for(const n of NOTES) if(n.quiet) put(pl,M.paper,n.x,.01,n.z,-Math.PI/2,0,.4,.32,.42,1);
  wbox(M.brick,-12.3,-12,0,2.6,-16.5,-14.5); wbox(M.brick,-20,-19.7,DEEP,DEEP+TUN_H,-16.5,-14.5); wbox(M.rock,-24.3,-19.7,DEEP,DEEP+TUN_H,-56.3,-56);   // healed: no split, the end wall never opened
  flush(gQ);

  /* ---- things that change ---- */
  const plug=(x,z)=>{ const g=new THREE.Group(); for(let i=0;i<4;i++){ const m=new THREE.Mesh(ico,M.rock); m.position.set(x+(r()-.5)*.6,DEEP+.4+i*.55,z+(r()-.5)*.6); m.scale.set(1.3,.8,1.3); g.add(m); }
    const f=new THREE.Mesh(bx,M.rock); f.scale.set(1.2,TUN_H,1.5); f.position.set(x,DEEP+TUN_H/2,z); g.add(f); sc.add(g); return g; };
  const plug1=plug(-23,-18), plug2=plug(-21,-41);
  const door=new THREE.Group(); door.position.set(-23.7,DEEP,-27); { const d=new THREE.Mesh(bx,M.wood); d.scale.set(3.4,2.2,.12); d.position.set(1.7,1.1,0); door.add(d);
    const b=new THREE.Mesh(bx,M.iron); b.scale.set(.6,.08,.06); b.position.set(3.1,1.1,-.1); door.add(b); } sc.add(door);
  const prop=new THREE.Group(); { for(const x of [-23.6,-20.4]){ const p=new THREE.Mesh(bx,M.wood); p.scale.set(.18,TUN_H,.18); p.position.set(x,DEEP+TUN_H/2,-37.5); prop.add(p); }
    const t=new THREE.Mesh(bx,M.wood); t.scale.set(3.6,.18,.22); t.position.set(-22,DEEP+TUN_H-.1,-37.5); prop.add(t); } sc.add(prop);
  const fallY=new THREE.Group(); { const f=new THREE.Mesh(bx,M.rock); f.scale.set(4,TUN_H,2); f.position.set(-22,DEEP+TUN_H/2,-37.5); fallY.add(f);
    for(let i=0;i<5;i++){ const m=new THREE.Mesh(ico,M.rock); m.position.set(-22+(r()-.5)*3,DEEP+.5,-36.4-r()*.3); m.scale.set(1.2,.7,1); fallY.add(m); } } sc.add(fallY);
  // the three of them: your height, caps, coats
  for(const w of WK){ const g=new THREE.Group(); for(const [sx,sy,sz,x,y,z,m] of [[.14,.84,.16,-.1,.42,0,M.cloth],[.14,.84,.16,.1,.42,0,M.cloth],[.44,.64,.26,0,1.16,0,M.cloth],[.11,.66,.13,-.29,1.1,0,M.cloth],[.11,.66,.13,.29,1.1,0,M.cloth],[.22,.26,.24,0,1.62,0,M.skin],[.28,.08,.3,0,1.78,.02,M.dark]]){
      const o=new THREE.Mesh(bx,m); o.scale.set(sx,sy,sz); o.position.set(x,y,z); g.add(o); } sc.add(g); w.g=g; }
  // the last train, after
  const train=new THREE.Group(); { const tb=new THREE.MeshLambertMaterial({color:0x1d3a2a}), win=new THREE.MeshBasicMaterial({color:0xe3a457});
    for(let c=0;c<3;c++){ const z=c*9.4; const b=new THREE.Mesh(bx,tb); b.scale.set(3.2,2.8,9); b.position.set(0,.6,z); train.add(b);
      const roof=new THREE.Mesh(bx,M.roof); roof.scale.set(3.3,.2,9.1); roof.position.set(0,2.1,z); train.add(roof);
      for(let k=-3;k<=3;k++){ const wn=new THREE.Mesh(pl,win); wn.scale.set(.8,.6,1); wn.position.set(-1.61,1.2,z+k*1.2); wn.rotation.y=-Math.PI/2; train.add(wn); } }
    const eng=new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.1,6,10),new THREE.MeshLambertMaterial({color:0x14100c})); eng.rotation.x=Math.PI/2; eng.position.set(0,.9,26); train.add(eng); } train.position.set(-4.6,0,-90); train.visible=false; sc.add(train);
  // light
  const hemi=new THREE.HemisphereLight(0xfff0d0,0x3a2416,1); sc.add(hemi);
  const lamps=[]; for(const [x,y,z] of [[-6,4,-7],[6,4,-7],[-9.5,3.4,-28],[1,3.4,-34],[-22,DEEP+2,-11],[-22,DEEP+2,-49]]){ const l=new THREE.PointLight(0xffb060,0,y<0?9:16,1.6); l.position.set(x,y,z); sc.add(l); lamps.push(l); }
  const obelL=new THREE.PointLight(0xff2a1a,0,14,1.4); obelL.position.set(-20,DEEP+2.5,-59); sc.add(obelL);
  const lamp=new THREE.PointLight(0xffe0b0,0,9,1.5);
  W={sc,M,TINT,g1,g2,gR,gQ,timber,plug1,plug2,door,prop,fallY,train,hemi,lamps,obelL,lamp,scrM,TC,hH,hM}; }

// the test card: bars, a ring. Frame 1 has someone standing in it. Frame 2, after, has them closer.
function testcard(k){ return tex(32,24,(g,w,h)=>{ const bars=['#d0d6c8','#a3ada0','#6e6a3e','#45534f','#8a2a22','#2f3c3b','#151b1c'];
  bars.forEach((c,i)=>px(g,c,i*4.6,0,5,16)); px(g,'#0b0f10',0,16,w,8); px(g,'#f1f4ea',12,17,8,1); px(g,'#f1f4ea',12,22,8,1);
  g.strokeStyle='#f1f4ea'; g.beginPath(); g.arc(16,10,6,0,7); g.stroke();
  if(k===1){ px(g,'#040506',22,5,2,11); px(g,'#040506',21,4,4,3); }
  if(k===2){ px(g,'#040506',13,2,6,22); px(g,'#040506',12,0,8,5); px(g,'#f1f4ea',14,2,1,1); px(g,'#f1f4ea',17,2,1,1); } }); }

/* ================= THE PAPER TRAIL =================
   1886: what the station and the Holloway Society knew. 20??: Site-86's logs. After the fracture: one blank sheet. */
const NOTES=[
  {era:1,x:10.4,z:-2.1,kick:'The Calder Courier · 10 March 1886',h:'Fall at Calder Street',
    p:'Three of Mr. Coyle\'s gang remain beneath the new subway since Tuesday. Mr. Coyle says he hears them calling still, and has set his men to dig for them at the far end, under the up line, against the advice of the Company\'s engineer.'},
  {era:1,x:11.3,z:-3.2,kick:'Photograph · station staff, February 1886',h:'',p:'Eleven names are written on the back. There are twelve people in the photograph.'},
  {era:1,x:-9,z:-4.85,kick:'Holloway Society for Irregular Phenomena · File 86',h:'The Calder Street voices',
    p:'Coyle hears his trapped men from beneath the up line. The men were trapped beneath the subway, forty yards west. The voices are not where the men are. We recommend the digging stop. The recommendation was not heeded.'},
  {era:2,x:2,z:-2.2,kick:'Site-86 · Containment log',h:'Entry 1',p:'Arrivals by the lift: 41. Departures by the lift: 0. The lift does not go up.'},
  {era:2,x:-22.6,z:-13.8,kick:'Site-86 · Containment log',h:'Entry 7',
    p:'The object under the up line was uncovered on 11 March 1886 by a railway foreman digging for his men. His men were never under the up line. Everything after that date is the object\'s work.'},
  {era:2,x:-21.4,z:-31,kick:'Site-86 · Containment log',h:'Entry 9',
    p:'Three men recovered from the old subway. They lived eleven days. The foreman dug the whole time, forty yards east, toward their voices. It was using their voices.'},
  {era:2,x:-16.5,z:-58.5,kick:'Site-86 · Containment log',h:'Entry 12',
    p:'We cannot reach 1886. Nothing from here fits through. It has to be someone already halfway out of time. Someone who heard it ask, and came anyway.'},
  {era:2,quiet:true,x:2,z:-2.2,kick:'—',h:'',p:'A blank sheet. Someone has written one line on it, recently: WHO ARE YOU'}];
function noteHere(){ for(const n of NOTES){ if(n.era!==L.era) continue; if(n.era===2&&(!!n.quiet)!==L.fract) continue;
    if(Math.hypot(n.x-TP.x,n.z-TP.z)<1.6&&Math.abs(floorH(n.x,n.z)-floorH(TP.x,TP.z))<1) return n; } return null; }
function read(n){ L.reading=n; R.sfx.ui(); title(n.kick,n.h||'—',n.p); }
function unread(){ if(!L.reading) return; L.reading=null; untitle(); }

/* ================= SOUND ================= */
const sndC={
  step(){ const a=K.A(); if(!a) return; const t=a.ac.currentTime, v=.8+Math.random()*.3; a.tone(t,'sine',90,46,.16*v,.004,.1); a.noise(t,.1,'bandpass',L.era===1?1500:900,1.2,.12*v,.07); },
  fail(){ const a=K.A(); if(!a) return; const t=a.ac.currentTime; a.tone(t,'sine',70,34,.4,.006,.4); a.noise(t,.35,'bandpass',2400,3,.2,.25); a.tone(t,'square',180,90,.05,.004,.2); },
  strike(ok){ const a=K.A(); if(!a) return; const t=a.ac.currentTime; a.tone(t,'square',ok?1500:2400,ok?900:1800,.1,.002,.08); a.noise(t,.2,ok?'lowpass':'highpass',ok?900:3200,.8,.3,.16); },
  rumble(){ const a=K.A(); if(!a) return; const t=a.ac.currentTime; a.noise(t,2.4,'lowpass',220,.8,.6,2); a.tone(t,'sine',48,26,.6,.05,2); },
  bolt(){ const a=K.A(); if(!a) return; const t=a.ac.currentTime; a.tone(t,'square',600,300,.08,.002,.06); a.noise(t+.08,.12,'bandpass',1800,4,.25,.1); a.tone(t+.2,'square',420,260,.07,.002,.05); },
  thunk(){ const a=K.A(); if(!a) return; const t=a.ac.currentTime; a.tone(t,'sine',140,70,.4,.004,.22); a.noise(t,.15,'lowpass',700,1,.3,.1); },
  pick(pan,v){ const a=K.A(); if(!a||v<.01) return; const d=K.pout(pan,v), t=a.ac.currentTime; a.tone(t,'square',2100,1600,.06,.002,.06,d); a.noise(t,.08,'highpass',3000,.7,.12,.05,d); },
  tick(){ const a=K.A(); if(!a) return; const t=a.ac.currentTime; a.tone(t,'square',3000,2600,.012,.001,.02); },
  doors(){ const a=K.A(); if(!a) return; const t=a.ac.currentTime; a.noise(t,1.2,'bandpass',500,1.4,.18,1); a.tone(t+1,'sine',120,60,.3,.01,.3); },
  whistle(){ const a=K.A(); if(!a) return; const t=a.ac.currentTime; for(const [f,o] of [[640,0],[760,0],[640,1.5],[760,1.5]]) a.tone(t+o,'triangle',f,f*.98,.12,.08,1.1); a.noise(t,2.4,'bandpass',2600,1.4,.08,2); },
  chuff(v){ const a=K.A(); if(!a) return; const t=a.ac.currentTime; a.noise(t,.3,'lowpass',500,.8,.35*v,.25); }
};
// a bed for each time, crossfaded on the shift: 1886 hisses (gas, steam); the ruin drones; after, only the test card
let bed=null;
function bedStart(){ const a=K.A(); if(!a||bed) return; const {ac,master,nb}=a, srcs=[];
  const bus=v=>{ const g=ac.createGain(); g.gain.value=0; g.connect(master); return g; };
  const old=bus(), ruin=bus(), card=bus();
  const n=(dest,type,f,q,v)=>{ const s=ac.createBufferSource(); s.buffer=nb; s.loop=true; const fl=ac.createBiquadFilter(); fl.type=type; fl.frequency.value=f; fl.Q.value=q; const g=ac.createGain(); g.gain.value=v; s.connect(fl).connect(g).connect(dest); s.start(); srcs.push(s); };
  const o=(dest,type,f,v,lp)=>{ const s=ac.createOscillator(), g=ac.createGain(); s.type=type; s.frequency.value=f; g.gain.value=v;
    if(lp){ const fl=ac.createBiquadFilter(); fl.type='lowpass'; fl.frequency.value=lp; s.connect(fl).connect(g); } else s.connect(g); g.connect(dest); s.start(); srcs.push(s); };
  n(old,'bandpass',3200,.8,.018); n(old,'lowpass',300,.7,.03);
  o(ruin,'sawtooth',41,.05,180); o(ruin,'sawtooth',41.7,.05,180); o(ruin,'sine',62,.04); n(ruin,'lowpass',420,.6,.05);
  o(card,'sine',1000,.004);
  bed={old,ruin,card,srcs}; }
function bedMix(tc){ if(!bed) return; const t=K.A().ac.currentTime, u=under();
  bed.old.gain.setTargetAtTime(L.era===1?(u?.6:1):0,t,tc); bed.ruin.gain.setTargetAtTime(L.era===2&&!L.fract?(u?1.3:1):0,t,tc); bed.card.gain.setTargetAtTime(L.era===2&&!u?1:0,t,tc); }
function bedStop(){ if(!bed) return; const b=bed; bed=null; const t=K.A().ac.currentTime; for(const g of [b.old,b.ruin,b.card]) g.gain.setTargetAtTime(0,t,.1);
  setTimeout(()=>{ try{ b.srcs.forEach(s=>s.stop()); [b.old,b.ruin,b.card].forEach(g=>g.disconnect()); }catch(e){} },1500); }
// the voice through the end wall: the corridor's HELP US, muffled by forty yards of rock
let helpBuf=null, helpLoading=false;
function helpLoad(){ const a=K.A(); if(!a||helpBuf||helpLoading) return; helpLoading=true;
  fetch('audio/help-us.mp3').then(r=>r.arrayBuffer()).then(b=>new Promise((ok,no)=>a.ac.decodeAudioData(b,ok,no))).then(buf=>{ helpBuf=buf; }).catch(()=>{ helpLoading=false; }); }
function helpPlay(){ const a=K.A(); if(!a||!helpBuf) return; const s=a.ac.createBufferSource(), lp=a.ac.createBiquadFilter(); s.buffer=helpBuf; lp.type='lowpass'; lp.frequency.value=520;
  const d=K.pout(K.panOf(-22,-56),clamp(1.4-Math.hypot(TP.x+22,TP.z+56)/14,.1,1)*.8); if(!d) return; s.connect(lp).connect(d); s.start(); }

/* ================= TIME ================= */
function applyEra(){ const e=L.era, old=e===1;
  for(const [m,a,b] of W.TINT) m.color.setHex(old?a:b);
  W.g1.visible=old; W.g2.visible=!old; W.gR.visible=!old&&!L.fract; W.gQ.visible=!old&&L.fract;
  W.timber.visible=old&&!G.prop&&!L.carry; W.plug1.visible=old&&!G.dug1; W.plug2.visible=old&&!G.dug2;
  W.door.visible=old; W.door.rotation.y=G.bolt?-1.4:0;
  W.prop.visible=G.prop; W.fallY.visible=!old&&!G.prop&&!L.fract;
  for(const w of WK) w.g.visible=old;
  W.train.visible=old&&L.trainIn;
  W.obelL.intensity=!old&&!L.fract?1.6:0;
  W.lamps.forEach(l=>{ l.intensity=old?1.1:0; });
  const fc=old?0x1a120c:(L.fract?0x1a1e1e:0x101414); W.sc.fog.color.setHex(fc); W.sc.background.setHex(fc); W.sc.fog.density=old?.035:(L.fract?.035:.05);
  W.hemi.color.setHex(old?0xfff0d0:0xc8d4d0); W.hemi.groundColor.setHex(old?0x3a2416:0x1a1e1e);
  W.lamp.color.setHex(old?0xffd090:0xd8e4e8);
  setPal(old?PAL_A:PAL_B);
  $('#yearVal').textContent=old?'1886':'20??'; $('#year').classList.toggle('past',old);
  $('#shiftBtn').textContent=old?'Return to 20??':'Shift to 1886'; bedMix(.25); }
// T, or the HUD button: anywhere, any time. Refused only if the other time has something solid where you stand.
function shiftTime(){ if(S.mode!=='conv') return; const to=L.era===1?2:1;
  if(blockedAt(TP.x,TP.z,to)){ S.glitch=Math.max(S.glitch,reduce?.4:1.3); sndC.fail(); return; }
  unread(); L.era=to; trail.length=0; for(const w of WK) if(w.st==='follow') w.st='wait';
  if(L.carry&&to===2){ L.carry=false; }                                // the timber is 1886's: it stays there, back on the stack
  applyEra(); S.glitch=reduce?.6:1.8; R.sfx.shift(); }

/* ================= THE RESCUE ================= */
function nearX(n){ const z=n===1?-18:-41; return L.era===1&&under()&&Math.abs(TP.z-z)<1.9&&!(n===1?G.dug1:G.dug2); }
function dig(n){ const tx=n===1?-23:-21, ok=Math.abs(TP.x-tx)<.9;
  if(!ok){ sndC.strike(false); msg('Solid rock. It won’t give here',2); return; }
  sndC.strike(true); S.glitch=Math.max(S.glitch,.15);
  if(n===1) G.hit1++; else G.hit2++;
  if((n===1?G.hit1:G.hit2)>=6){ if(n===1) G.dug1=true; else G.dug2=true; sndC.rumble(); applyEra(); save(); } }
function workersFrame(dt){
  if(L.era===1){ const l=trail[trail.length-1]; if(!l||Math.hypot(l.x-TP.x,l.z-TP.z)>.3){ trail.push({x:TP.x,z:TP.z}); if(trail.length>240) trail.shift(); } }
  let k=0;
  for(const w of WK){
    if(w.out){ const tx=w.sx, tz=w.sz; w.x=lerp(w.x,tx,Math.min(1,dt*1.5)); w.z=lerp(w.z,tz,Math.min(1,dt*1.5)); w.g.position.set(w.x,0,w.z); w.g.rotation.y=Math.atan2(TP.x-w.x,TP.z-w.z); continue; }
    const d=Math.hypot(w.x-TP.x,w.z-TP.z);
    if(w.st==='wait'&&w.joined&&L.era===1&&d<2.4){ w.st='follow'; trail.length=0; trail.push({x:TP.x,z:TP.z}); }
    let mv=0;
    if(w.st==='follow'){ k++; const i=trail.length-1-k*5;
      if(i>=0){ const p=trail[i], dx=p.x-w.x, dz=p.z-w.z, l=Math.hypot(dx,dz); if(l>.05){ const s=Math.min(l,Math.min(3.6,l*3)*dt); w.x+=dx/l*s; w.z+=dz/l*s; mv=s; w.g.rotation.y=Math.atan2(dx,dz); } }
      if(d>12) w.st='wait'; }
    w.bob+=mv*7; const y=floorH(w.x,w.z); w.g.position.set(w.x,y+Math.abs(Math.sin(w.bob))*.04,w.z);
    if(w.st==='wait'&&L.era===1&&d<6) w.g.rotation.y=Math.atan2(TP.x-w.x,TP.z-w.z);
    if(w.st==='follow'&&y===0&&w.z>-13.5&&w.x>-11&&w.x<5.5){ w.out=true; w.st='out'; save(); R.sfx.ui();
      if(WK.every(o=>o.out)) fracture(); } } }
// lines, once each, the first time you're close in 1886
const LINES={
  a:['Who\'s there? ...You came through the rock?','Lead on. I\'ll follow your light.'],
  b:['You came out of nowhere. You\'re warm. You\'re real, aren\'t you?','All right. All right. Don\'t leave me behind.'],
  c:['Don\'t listen to it. It has been using our voices. It has been using mine.','Get me out before it learns yours.']};
function linesFrame(){ if(L.era!==1) return;
  for(const w of WK){ if(w.out||L.met[w.id]) continue; const d=Math.hypot(w.x-TP.x,w.z-TP.z);
    if(d<(w.id==='b'?3.4:4.5)&&Math.abs(floorH(w.x,w.z)-floorH(TP.x,TP.z))<1){ L.met[w.id]=true; caption(LINES[w.id][0]); after(5,()=>{ if(S.cap===LINES[w.id][0]) caption(''); }); } } }
function join(w){ w.joined=true; w.st='follow'; trail.length=0; trail.push({x:TP.x,z:TP.z}); caption(LINES[w.id][1]); after(4,()=>{ if(S.cap===LINES[w.id][1]) caption(''); }); }

/* ================= THE FRACTURE =================
   The last man up the stair. Nobody digs; the voices under the up line have nothing to borrow. Only ever one
   timeline, and now there are two. Something notices. That isn't explained here or anywhere. */
function fracture(){ if(L.fract) return; L.fract=true; save(); try{ localStorage.setItem(FKEY,'1'); }catch(e){}
  after(1.2,()=>{ S.glitch=reduce?1:3; R.sfx.shift(); sndC.rumble(); });
  after(2.4,()=>{ unread(); title('Calder Street · 11 March 1886','No one digs','Under the up line, the voices have stopped.'); });
  after(8,()=>{ if(!L.reading) untitle(); L.trainIn=true; L.trainT=0; applyEra(); sndC.whistle(); }); }
function board(){ if(S.mode!=='conv') return; S.mode='convOut'; unread(); sndC.doors(); fadeTo(1,1.4,'#000'); after(1.6,()=>sndC.whistle()); after(3.2,()=>K.leave()); }
const trainDoor=()=>L.era===1&&L.trainIn&&L.trainT>9.5&&Math.abs(TP.x+7.6)<1.2&&Math.abs(TP.z+32.6)<1.8;

/* ================= ACTIONS: E on desktop, one button on touch ================= */
function findAct(){ if(S.mode!=='conv') return null;
  if(L.reading) return {t:'Put it down',fn:unread};
  const n=noteHere(); const old=L.era===1, u=under();
  if(old){
    if(trainDoor()) return {t:'Board the train',fn:board};
    if(u&&!G.prop&&!L.carry&&Math.hypot(TP.x+22.9,TP.z+10.2)<1.8) return {t:'Take a length of timber',fn:()=>{ L.carry=true; sndC.thunk(); applyEra(); msg('A length of timber, on your shoulder',2.2); }};
    if(u&&L.carry&&Math.abs(TP.z+37.5)<1.6) return {t:'Prop the roof',fn:()=>{ L.carry=false; G.prop=true; sndC.thunk(); after(.3,sndC.thunk); applyEra(); save(); }};
    if(nearX(1)) return {t:'Swing the pick',fn:()=>dig(1)};
    if(nearX(2)) return {t:'Swing the pick',fn:()=>dig(2)};
    if(u&&!G.bolt&&Math.abs(TP.z+27)<1.6){ if(TP.z<-27) return {t:'Draw the bolt',fn:()=>{ G.bolt=true; sndC.bolt(); applyEra(); save(); }};
      return {t:'Try the door',fn:()=>{ sndC.thunk(); if(!L.met.door){ L.met.door=true; caption('Go away! I know what you are. You talk like them.'); after(4,()=>caption('')); } else msg('Bolted from the other side',2); }}; }
    for(const w of WK) if(!w.out&&!w.joined&&Math.hypot(w.x-TP.x,w.z-TP.z)<2.6) return {t:'Come with me',fn:()=>join(w)};
  }
  if(n) return {t:'Read',fn:()=>read(n)};
  return null; }
const act=K.el('button','cAct','pbtn'); act.type='button'; act.hidden=true; act.addEventListener('click',()=>{ const a=findAct(); if(a) a.fn(); });
const leaveB=K.el('button','cLeave','pbtn'); leaveB.type='button'; leaveB.textContent='Leave station'; leaveB.hidden=true; leaveB.addEventListener('click',()=>{ if(S.mode==='conv') K.leave(); });
{ const st=document.createElement('style'); st.textContent=`#cAct{position:fixed;z-index:12;left:50%;bottom:calc(84px + env(safe-area-inset-bottom));transform:translateX(-50%)}
#cAct[hidden],#cLeave[hidden]{display:none}
#cLeave{position:fixed;z-index:6;right:calc(16px + env(safe-area-inset-right));bottom:calc(96px + env(safe-area-inset-bottom));padding:10px 14px}
body.touch #cAct{bottom:calc(14px + env(safe-area-inset-bottom))}
body.tconv #tJump{display:none!important}`; document.head.appendChild(st); }
function drawAct(){ const a=findAct(), t=a?a.t+(R.touch()?'':' (E)'):''; if(act.textContent!==t) act.textContent=t; act.hidden=!a; }

/* ================= LIFECYCLE ================= */
function enter(){ if(!W) build(); load(); solids();
  W.sc.add(cam); cam.children.forEach(o=>{ if(o.isLight) o.intensity=0; }); if(W.lamp.parent!==cam) cam.add(W.lamp); K.fallAudioStop();
  TP.x=SPAWN.x; TP.z=SPAWN.z; TP.acc=0; TP.bob=0; P.yaw=0; P.pitch=0;
  L.era=2; L.carry=false; L.reading=null; L.loops=0; L.met={}; G.hit1=0; G.hit2=0; trail.length=0;
  L.trainIn=L.fract; L.trainT=L.fract?99:0; L.pickT=K.rr(1,2); L.helpT=K.rr(6,10);
  for(const w of WK){ w.joined=false; w.st=w.out?'out':'wait'; w.x=w.out?w.sx:w.hx; w.z=w.out?w.sz:w.hz; }
  bedStart(); helpLoad(); applyEra(); leaveB.hidden=false;
  document.body.classList.add('twalk','tconv'); }
// the lift settles, the doors part, a station that shouldn't be under anything
function arrive(){ enter(); S.mode='convEnter'; S.t=0; S.fade=1; fadeTo(1,0,'#000'); 
  after(.5,()=>sndC.thunk()); after(1.3,()=>{ sndC.doors(); bedMix(1.2); fadeTo(0,reduce?.6:2.2); S.mode='conv'; S.t=0; });
  after(3.6,()=>{ if(!L.reading) title('Temporal recovery · Rift 86','20??',L.fract?'Calder Street. Quieter than you left it.':'A station. The lift was never meant to stop here.'); });
  after(7.6,()=>{ if(!L.reading) untitle(); }); }
function walk(dt,inp){ const m=inp.m; if(m<=.05) return; const sp=(inp.run?3.6:2)*Math.min(1,m)/Math.max(1,m), yaw=P.yaw;
  const vx=(-Math.sin(yaw)*inp.f+Math.cos(yaw)*inp.s)*sp*dt, vz=(-Math.cos(yaw)*inp.f-Math.sin(yaw)*inp.s)*sp*dt;
  if(!blockedAt(TP.x+vx,TP.z,L.era)) TP.x+=vx; if(!blockedAt(TP.x,TP.z+vz,L.era)) TP.z+=vz;
  // the waiting room's far door opens onto the waiting room, from its other door
  if(TP.x<-11.9&&TP.z>-3.6&&TP.z<-2.4){ TP.x+=5.3; L.loops++; trail.length=0; }
  if(L.reading&&Math.hypot(L.reading.x-TP.x,L.reading.z-TP.z)>2.6) unread();
  TP.bob+=dt*(inp.run?10:7.5); TP.acc+=Math.hypot(vx,vz); if(TP.acc>(inp.run?1:.8)){ TP.acc=0; sndC.step(); } }
function frame(dt,inp){
  const u=under();
  if(S.mode==='conv'){ walk(dt,inp); workersFrame(dt); linesFrame(); drawAct();
    // 1886: Coyle's picks at the far end, until there's nobody to dig for; through the end wall, the voice
    if(L.era===1&&!L.fract){ L.pickT-=dt; if(L.pickT<=0){ L.pickT=K.rr(1.2,2.2); const sx=u?-22:-4, sz=u?-56:-44; sndC.pick(K.panOf(sx,sz),K.vol(Math.hypot(sx-TP.x,sz-TP.z),2.2)*.7); }
      if(u&&TP.z<-41){ L.helpT-=dt; if(L.helpT<=0){ L.helpT=K.rr(12,18); helpPlay(); } } }
    if(L.era===1&&!u){ L.tickT-=dt; if(L.tickT<=0){ L.tickT=1; sndC.tick(); } }
    if((S.frame=(S.frame||0)+1)%20===0) bedMix(.6); }
  else { act.hidden=true; }
  // the light: the hall by its lamps or the grey after; below, only what you carry
  const k=sstep(-.5,-3.5,floorH(TP.x,TP.z));
  W.hemi.intensity=L.era===1?lerp(.85,.08,k):lerp(L.fract?.7:.5,.03,k); W.lamp.intensity=lerp(.15,1.2,k);
  // the test card holds; now and then, for a frame or two, it isn't empty
  L.tcT-=dt; if(L.tcT<=0){ L.tcT=K.rr(L.fract?3:6,L.fract?7:12); L.tcOn=reduce?0:.12; }
  if(L.tcOn>0){ L.tcOn-=dt; W.scrM.map=W.TC[L.fract?2:1]; } else W.scrM.map=W.TC[0];
  // the clock: running in 1886, twelve past three for ever after
  const ct=L.era===1?S.T/60:0; W.hM.rotation.z=L.era===1?-ct*Math.PI*2:-Math.PI*2*12/60; W.hH.rotation.z=L.era===1?-ct*Math.PI*2/12-1.2:-Math.PI*2*(3.2/12);
  if(L.trainIn&&L.era===1){ const was=L.trainT; L.trainT+=dt; const kk=sstep(0,9.5,L.trainT); W.train.position.z=lerp(-90,-42,kk);
    if(L.trainT<9.5&&Math.floor(was*(3-kk*2.5))!==Math.floor(L.trainT*(3-kk*2.5))) sndC.chuff(1-kk*.6); }
  const bob=reduce?0:Math.sin(TP.bob)*.03;
  cam.position.set(TP.x,floorH(TP.x,TP.z)+1.6+bob,TP.z); cam.rotation.set(P.pitch,P.yaw,0); cam.updateMatrixWorld();
  K.render(W.sc); }
function key(k){ if(S.mode!=='conv') return;
  if(k==='t'){ shiftTime(); return; }
  if(k==='e'){ const a=findAct(); if(a) a.fn(); return; }
  if(k>='1'&&k<='5') msg('Your records stayed in 1986'); }
function click(){ if(S.mode==='conv'&&!R.touch()&&!R.locked()) R.lock(); }
function shiftBtn(){ if(S.mode==='conv') shiftTime(); }
function exit(){ bedStop(); unread(); caption(''); act.hidden=true; leaveB.hidden=true; L.carry=false; if(W){ W.lamp.intensity=0; }
  document.body.classList.remove('tconv'); }

K.register('conv',{arrive,frame,key,click,exit,shiftBtn});
K.convDebug={L,G,WK,TP,RECTS,blockedAt,floorH,shiftTime,fracture,dig,join,findAct,get W(){ return W; },
  // jump straight to the end state, for testing
  rescueAll(){ for(const w of WK){ w.out=true; w.st='out'; } save(); fracture(); },
  reset(){ try{ localStorage.removeItem(SKEY); localStorage.removeItem(FKEY); }catch(e){} }};
})(window);
