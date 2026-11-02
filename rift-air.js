/* Rift 86 · Flight 914
   The ghost-flight legend: an airliner that took off in 1955 and never quite came down. The crack opens in the rear galley
   of Halcyon Air Lines Flight 914 (a made-up carrier; the number is the nod), Idlewild to Miami, still in the air. The
   passengers are alive, and you are not on the manifest.
   T (or the HUD button) shifts to 2086: the same cabin, four thousand metres down, the nose torn away, nobody left in it
   but what the sea hasn't taken. Nothing to solve. It was always going to end there.
   1955's sky turns on a timer: clear above a floor of cloud, then into the storm, then out again. Now and then it tears,
   for a few seconds, onto a sky 130 million years older. And sometimes something rides along beside the wing. Never
   hinted, never scored. It vanishes if you watch it too long.
   2086 has its own: too big, the shapes that come up out of the dark to look at the wreck. Only ever a shadow in the fog,
   passing, or hanging off a window, looking. Up close they're never seen: only heard knocking on the hull, felt shoving it.
   Fetched the first time its crack is chosen; built with the kit rift-travel.js exposes (window.__RTK). */
(function(root){
'use strict';
const K=root.__RTK; if(!K) return;
const {R,S,P,reduce,cam,tex,px,disc,clamp,lerp,put,flush,after,title,untitle,msg,caption,fadeTo,setPal,toPal,rr,sstep,angLerp}=K;
const $=s=>document.querySelector(s);

/* ================= THE CABIN =================
   A four-engine propliner, 2+2. The nose points -z. Floor y 0, ceiling 2.15, inner walls at x ±1.45, windows
   y .9..1.35. Rear galley (z 9..11.8), the crack against its back wall; the cockpit door at z -8.7. In 2086 the
   fuselage is broken open at z -5.7: everything forward of that is somewhere else on the seabed. 1 unit ~ 1 m. */
const HW=1.45, CEIL=2.15, WIN_Y0=.9, WIN_Y1=1.35, Z_FRONT=-8.7, Z_BREAK=-5.7, Z_GALLEY=9, Z_REAR=11.8, EXZ=1.3;
const ROWS=[8,6.95,5.9,4.85,3.8,2.75,-.15,-1.2,-2.25,-3.3,-4.35,-5.4,-6.45,-7.5];
const SEATX=[-1.05,-.55,.55,1.05];
const WINZ=[...ROWS,EXZ];
const SPAWN={x:0,z:10.8}, RIFT={x:0,z:11.62}, STEW={x:-.5,z:9.75};
// 1955 clear: navy plush, cream panels, the blue over the cloud; 1955 storm: everything grey; the old sky: amber, olive, fire;
// 2086: the deep, and the bone. Mothman's red is in every 1955 set.
const PAL_CL=toPal(['#06070c','#141824','#232c40','#34466a','#4f6d9a','#7fa3cf','#b8d2ea','#eef5fb','#2a1d14','#4a3424',
  '#76563a','#a8835a','#d8bd8e','#f4e6c4','#5c6670','#9aa4ad','#2c3a5c','#6e2a22','#c9a227','#ff2a1a']);
const PAL_ST=toPal(['#040507','#0b0e12','#141a20','#1e262e','#2c3640','#3e4a55','#5a6672','#8592a0','#b9c4ce','#eef2f6',
  '#1e1610','#3a2a1e','#5e4630','#8a6a48','#c0a070','#e8d4a8','#1c2638','#3a4a6a','#6e2a22','#ff2a1a']);
const PAL_ANC=toPal(['#0a0604','#1c1008','#30200e','#4a3216','#6e4a1e','#9a6a28','#c89038','#f0c060','#fff0b0','#1a2010',
  '#2e3a18','#4a5a22','#6e7a30','#2a1d14','#76563a','#d8bd8e','#3a1408','#8a2a10','#ff5a10','#ff2a1a']);
const PAL_DEEP=toPal(['#010304','#02080a','#041012','#06191c','#0a2428','#0f3236','#164246','#20565a','#2e6e70','#44888a',
  '#68a8a8','#a0d0cc','#141410','#2a2a20','#4a4a38','#7a7a60','#b0ae90','#3a5a2a','#7a3a20','#9ef0e0']);   // one kelp green
const MKEY='r86.mothman';

/* ================= STATE ================= */
const TP={x:0,z:0,bob:0,acc:0,cr:0,crouch:false,hinted:false};   // cr: 0 standing .. 1 crouched at window height
const L={era:1,stay:0,sawAnc:false,seen86:false,capCD:0,met:{},creakT:6,bubT:3,mixT:0,ft:0};
const SKY={mode:'clear',t:0,dur:90,sk:0,anc:false,ancT:0,ancNext:45,flash:0,since:99,next:6,big:false,jolt:0,joltNext:9,belt:false,pal:null};
const MO={on:false,pose:null,side:1,t:0,watch:0,next:30,x:0,y:0,y0:0,z:0,life:0,logged:false};
// who's aboard. r: row (index into ROWS), s: seat (index into SEATX), k: man / woman / child.
// l: what they say the first time you're close; storm / anc: what they say instead in the storm, or once the sky has torn.
// f: what 2086 has left in that seat (dead, gone) or x: their row went with the nose.
const PAX=[
  {id:'p1',r:0,s:1,k:'m',f:'dead',l:'Where did you come from? You weren’t on at Idlewild.'},
  {id:'p2',r:1,s:3,k:'f',f:'gone',l:'Harold. Harold, there’s someone in the aisle who didn’t board.'},
  {id:'p3',r:2,s:0,k:'m',f:'dead',l:'You look like you’ve been out in the weather a long time.',storm:'Captain says we’ll be through this shortly. He said that an hour ago.'},
  {id:'p4',r:3,s:2,k:'c',f:'gone',l:'Mama, their clothes are funny.'},
  {id:'p5',r:3,s:3,k:'f',f:'gone',l:'Don’t stare, sweetheart. ...And you. Please don’t look at us like that.'},
  {id:'p6',r:4,s:1,k:'m',f:'dead',l:'Two more hours to Miami. I’ll believe it when we’re on the ground.'},
  {id:'p7',r:5,s:0,k:'f',f:'dead',l:'That coat. Is that the new style? I’ve never seen a zipper like it.',anc:'Did you see them out there? Birds. Big as automobiles.'},
  {id:'p8',r:6,s:2,k:'m',f:'gone',l:'My watch stopped. Has yours? What time do you make it?'},
  {id:'p9',r:7,s:3,k:'f',f:'dead',l:'Don’t look out the window. Just... don’t.'},
  {id:'p10',r:8,s:1,k:'m',f:'gone',l:'I’ve flown this route twelve times. It has never been this long.',storm:'This isn’t weather. Weather ends.'},
  {id:'p11',r:9,s:0,k:'f',f:'dead',l:'Funny. You look at us like we’re old photographs.'},
  {id:'p12',r:10,s:2,k:'m',f:'dead',l:'Are you with the airline? Then sit down, please. You’re making me nervous.',anc:'There was a mountain on fire down there. There are no mountains between New York and Miami.'},
  {id:'p13',r:12,s:1,k:'f',f:'x',l:'Smell that? Like a struck match. It’s been that way since the light went funny.'},
  {id:'p14',r:13,s:3,k:'m',f:'x',l:'Whatever you are: is it over? Did we land?'}
].map(p=>Object.assign(p,{x:SEATX[p.s],z:ROWS[p.r],g:null,head:null,hy:0}));

// where you can stand: the aisle, the galley, the over-wing exit row. In 2086 the aisle ends at the wreckage.
function walkable(x,z,era){
  if(Math.abs(x)<.28&&z>(era===2?-4.9:-8.35)&&z<9.3) return true;
  if(Math.abs(x)<.68&&z>=9&&z<11.35) return true;
  if(Math.abs(x)<1.2&&Math.abs(z-EXZ)<.3) return true;
  return false; }
function blockedAt(x,z,era){ if(!walkable(x,z,era)) return true; return era===1&&Math.hypot(x-STEW.x,z-STEW.z)<.36; }
const skyState=()=>SKY.anc?'ancient':SKY.sk>.5?'storm':'clear';
const wingTop=x=>-.25+Math.max(0,Math.abs(x)-1.5)*.04;

/* ================= BUILD ================= */
const BX=new THREE.BoxGeometry(1,1,1), PL=new THREE.PlaneGeometry(1,1), ICO=new THREE.IcosahedronGeometry(1,0), CYL=new THREE.CylinderGeometry(.5,.5,1,10);
const MC=new Map(); const mat=c=>{ if(!MC.has(c)) MC.set(c,new THREE.MeshLambertMaterial({color:c,flatShading:true})); return MC.get(c); };
function rng(seed){ let s=seed; return ()=>((s=(s*16807)%2147483647)/2147483647); }
const pick=(a,r)=>a[(r()*a.length)|0];
// several transformed pieces baked into one geometry (a seat, a cloud), so put() can place it again and again
function mergeGeo(parts){ const gs=[], m4=new THREE.Matrix4(), q=new THREE.Quaternion(), e=new THREE.Euler(), p=new THREE.Vector3(), s=new THREE.Vector3();
  for(const o of parts){ e.set(o.rx||0,o.ry||0,o.rz||0,'YXZ'); q.setFromEuler(e); p.set(o.x||0,o.y||0,o.z||0); s.set(o.sx||1,o.sy||o.sx||1,o.sz||o.sx||1);
    m4.compose(p,q,s); const g=o.geo.index?o.geo.toNonIndexed():o.geo.clone(); g.applyMatrix4(m4); gs.push(g); }
  let n=0; for(const g of gs) n+=g.attributes.position.count;
  const pos=new Float32Array(n*3), nor=new Float32Array(n*3), uv=new Float32Array(n*2); let k=0;
  for(const g of gs){ const c=g.attributes.position.count; pos.set(g.attributes.position.array,k*3); nor.set(g.attributes.normal.array,k*3); if(g.attributes.uv) uv.set(g.attributes.uv.array,k*2); k+=c; g.dispose(); }
  const bg=new THREE.BufferGeometry(); bg.setAttribute('position',new THREE.BufferAttribute(pos,3)); bg.setAttribute('normal',new THREE.BufferAttribute(nor,3)); bg.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  bg.computeBoundingSphere(); return bg; }
// a flat fan of triangles (wings: the bat-thing's, the pterosaurs')
function fanGeo(pts){ const v=[]; for(let i=1;i<pts.length-1;i++) v.push(pts[0][0],pts[0][1],pts[0][2],pts[i][0],pts[i][1],pts[i][2],pts[i+1][0],pts[i+1][1],pts[i+1][2]);
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(v),3)); g.computeVertexNormals(); return g; }
// a box in world units whose texture tiles every metre instead of stretching
function wb(m,x0,x1,y0,y1,z0,z1){ const g=new THREE.BoxGeometry(x1-x0,y1-y0,z1-z0); g.translate((x0+x1)/2,(y0+y1)/2,(z0+z1)/2);
  const p=g.attributes.position, n=g.attributes.normal, uv=g.attributes.uv;
  for(let i=0;i<p.count;i++){ const x=p.getX(i), y=p.getY(i), z=p.getZ(i); if(Math.abs(n.getY(i))>.5) uv.setXY(i,x,z); else if(Math.abs(n.getX(i))>.5) uv.setXY(i,z,y); else uv.setXY(i,x,y); }
  put(g,m,0,0,0); }
const label=(txt,w,h,bg,fg)=>tex(w,h,(g,W2,H2)=>{ px(g,bg,0,0,W2,H2); g.fillStyle=fg; g.font=`${H2-5}px monospace`; g.textAlign='center'; g.textBaseline='middle'; g.fillText(txt,W2/2,H2/2+1); });
function rrect(g,x,y,w,h,r){ g.beginPath(); g.moveTo(x+r,y); g.lineTo(x+w-r,y); g.arc(x+w-r,y+r,r,-Math.PI/2,0); g.lineTo(x+w,y+h-r); g.arc(x+w-r,y+h-r,r,0,Math.PI/2);
  g.lineTo(x+r,y+h); g.arc(x+r,y+h-r,r,Math.PI/2,Math.PI); g.lineTo(x,y+r); g.arc(x+r,y+r,r,Math.PI,Math.PI*1.5); g.closePath(); }

const SUIT=[0x3a3a40,0x4a3a2c,0x24304a,0x5a5248,0x2e2a26], DRESS=[0x6e2a2a,0x2e4a3a,0x4a3a5e,0x8a6a3a,0x5e6e8a], TIE=[0x6e2a22,0x24304a,0xc9a227];
const SKIN=[0xc89a78,0x9a6e50,0xe0b898,0x6e4a34,0xb8885e], HAIR=[0x2a1d14,0x5a3a20,0x8a6a3a,0x1a1410,0x9a9a90], HAT=[0x2e2a26,0x4a3a2c,0x5a5248];
// a passenger (seated, facing the nose) or the stewardess (standing). The head is its own group so it can turn to you.
function person(k,r,seated,uni){ const g=new THREE.Group(), f=k!=='m';
  const top=mat(uni||(f?pick(DRESS,r):pick(SUIT,r))), low=uni?mat(uni):(f?top:mat(pick(SUIT,r))), skin=mat(pick(SKIN,r)), hair=mat(pick(HAIR,r)), dark=mat(0x14100c), shirt=mat(0xe8e0cc);
  const b=(m,w,h,d,x,y,z,rx,par)=>{ const o=new THREE.Mesh(BX,m); o.scale.set(w,h,d); o.position.set(x,y,z); if(rx) o.rotation.x=rx; (par||g).add(o); return o; };
  if(seated){
    for(const s of [-1,1]){ b(low,.15,.14,.46,s*.1,.53,-.1); b(f?skin:low,.11,.42,.12,s*.1,.29,-.34); b(dark,.12,.07,.2,s*.1,.04,-.38); }
    if(f) b(top,.42,.1,.46,0,.58,-.06);                                  // the skirt over the lap
    b(top,.4,.56,.24,0,.88,.1); if(!f){ b(shirt,.1,.3,.01,0,.98,-.025); b(mat(pick(TIE,r)),.04,.24,.012,0,.96,-.03); }
    for(const s of [-1,1]){ b(top,.1,.4,.12,s*.25,.84,0,.35); b(skin,.08,.09,.09,s*.25,.62,-.1); }
  } else {
    for(const s of [-1,1]){ b(skin,.11,.5,.12,s*.09,.25,0); b(dark,.12,.07,.2,s*.09,.035,-.04); }
    b(low,.36,.34,.24,0,.66,0); b(top,.4,.5,.24,0,1.06,0); b(shirt,.1,.2,.01,0,1.18,-.125);
    for(const s of [-1,1]){ b(top,.1,.5,.12,s*.26,1.05,0); b(skin,.08,.09,.09,s*.26,.76,0); }
  }
  const head=new THREE.Group(); head.position.set(0,seated?1.17:1.32,seated?.1:0); g.add(head);
  b(skin,.2,.24,.22,0,.12,0,0,head); for(const s of [-1,1]) b(dark,.035,.025,.01,s*.05,.14,-.112,0,head);
  if(uni){ b(hair,.22,.1,.255,0,.24,.0025,0,head); b(hair,.22,.12,.08,0,.14,.1,0,head); b(top,.18,.06,.14,0,.31,-.02,0,head); }
  else if(!f){ if(r()<.65){ const hm=mat(pick(HAT,r)); b(hm,.34,.02,.34,0,.25,0,0,head); b(hm,.22,.11,.22,0,.31,0,0,head); b(dark,.225,.03,.225,0,.27,0,0,head); }
    else b(hair,.22,.06,.23,0,.25,.01,0,head); }
  else { b(hair,.23,.1,.255,0,.22,.0025,0,head); b(hair,.22,.2,.07,0,.12,.1,0,head); if(r()<.4) b(mat(pick(DRESS,r)),.16,.07,.16,0,.29,0,0,head); }
  if(k==='c') g.scale.setScalar(.72);
  return {g,head}; }

let W=null;
function build(){ const r=rng(1955914);
  const sc=new THREE.Scene(); sc.background=new THREE.Color(0xb8d2ea); sc.fog=new THREE.FogExp2(0xb8d2ea,.006);
  const T={
    wall:tex(16,16,(g,w,h)=>{ px(g,'#d8c8a8',0,0,w,h); for(let i=0;i<14;i++) px(g,'#cbb994',r()*w,r()*h,2,1); },1,1),
    carpet:tex(16,16,(g,w,h)=>{ px(g,'#2c3a5c',0,0,w,h); for(let y=0;y<h;y+=4) for(let x=(y/4)%2?0:2;x<w;x+=4) px(g,'#24304a',x,y,2,2); for(let i=0;i<8;i++) px(g,'#c9a227',r()*w,r()*h); },1,1),
    silt:tex(16,16,(g,w,h)=>{ px(g,'#4a4a38',0,0,w,h); for(let i=0;i<60;i++) px(g,['#2a2a20','#7a7a60','#4a4a38','#b0ae90'][i%4],r()*w,r()*h,1+(r()*2|0),1); },1,1),
    sand:tex(32,32,(g,w,h)=>{ px(g,'#2a2a20',0,0,w,h); for(let i=0;i<120;i++) px(g,['#141410','#4a4a38','#2a2a20'][i%3],r()*w,r()*h,1+(r()*3|0),1); },40,40),
    frame:tex(32,32,(g,w,h)=>{ px(g,'#cdbb98',0,0,w,h); g.strokeStyle='#a8935e'; g.lineWidth=1; rrect(g,6.5,2.5,19,27,7); g.stroke();
      g.globalCompositeOperation='destination-out'; rrect(g,8,4,16,24,6); g.fill(); g.globalCompositeOperation='source-over'; }),
    cloud:tex(64,64,(g,w,h)=>{ px(g,'#eef5fb',0,0,w,h); for(let i=0;i<34;i++) disc(g,'#b8d2ea',r()*w,r()*h,2+r()*4); for(let i=0;i<40;i++) disc(g,'#eef5fb',r()*w,r()*h-1,2+r()*4); },14,14),
    jungle:tex(32,32,(g,w,h)=>{ px(g,'#2e3a18',0,0,w,h); for(let i=0;i<50;i++) disc(g,['#4a5a22','#1a2010','#6e7a30'][i%3],r()*w,r()*h,1+r()*3);
      g.strokeStyle='#9a6a28'; g.beginPath(); g.moveTo(0,r()*h); for(let x=0;x<=w;x+=4) g.lineTo(x,h/2+Math.sin(x*.4)*6); g.stroke(); },10,10)
  };
  const skyT=(stops,draw)=>tex(64,64,(g,w,h)=>{ const gr=g.createLinearGradient(0,0,0,h); stops.forEach(([o,c])=>gr.addColorStop(o,c)); g.fillStyle=gr; g.fillRect(0,0,w,h); if(draw) draw(g,w,h); });
  const SK={
    clear:skyT([[0,'#232c40'],[.22,'#34466a'],[.38,'#4f6d9a'],[.46,'#7fa3cf'],[.5,'#b8d2ea'],[1,'#eef5fb']],g=>{ disc(g,'#b8d2ea',20,21,5); disc(g,'#eef5fb',20,21,3); }),
    storm:skyT([[0,'#0b0e12'],[.3,'#141a20'],[.45,'#1e262e'],[.5,'#2c3640'],[1,'#1e262e']],(g,w)=>{ for(let i=0;i<30;i++) px(g,i%2?'#1e262e':'#2c3640',r()*w,8+r()*20,6+r()*12,1); }),
    anc:skyT([[0,'#4a3216'],[.28,'#9a6a28'],[.44,'#c89038'],[.5,'#c89038'],[.6,'#6e4a1e'],[1,'#30200e']],g=>{ disc(g,'#ff5a10',40,27,5); disc(g,'#f0c060',40,27,3); for(let i=0;i<10;i++) px(g,'#6e4a1e',r()*64,14+r()*14,4+r()*8,1); })
  };
  const M={
    wall:new THREE.MeshLambertMaterial({map:T.wall}), trim:new THREE.MeshLambertMaterial({color:0x8a6a48}), ceil:new THREE.MeshLambertMaterial({color:0xe8dcc0}),
    carpet:new THREE.MeshLambertMaterial({map:T.carpet}), silt:new THREE.MeshLambertMaterial({map:T.silt}), sand:new THREE.MeshLambertMaterial({map:T.sand}),
    frame:new THREE.MeshLambertMaterial({map:T.frame,alphaTest:.5,side:THREE.DoubleSide}), strip:new THREE.MeshBasicMaterial({color:0xfff3d0}),
    wood:new THREE.MeshLambertMaterial({color:0x5a3a22}), metal:new THREE.MeshLambertMaterial({color:0x8a9098}),
    seat:new THREE.MeshLambertMaterial({color:0x34466a,flatShading:true}), lace:new THREE.MeshLambertMaterial({color:0xf4ecd8}), curtain:new THREE.MeshLambertMaterial({color:0x6e2a22}),
    seat86:new THREE.MeshLambertMaterial({color:0x1e3436,flatShading:true}), lace86:new THREE.MeshLambertMaterial({color:0x4a5a50}), bone:new THREE.MeshLambertMaterial({color:0xa8a68a,flatShading:true}),
    rot:new THREE.MeshLambertMaterial({color:0x1a2422,flatShading:true}), wreck:new THREE.MeshLambertMaterial({color:0x2e4440,flatShading:true}), rock:new THREE.MeshLambertMaterial({color:0x20302e,flatShading:true}),
    alu:new THREE.MeshLambertMaterial({color:0xb4bcc4,flatShading:true}), aluD:new THREE.MeshLambertMaterial({color:0x5c6670,flatShading:true}), cowl:new THREE.MeshLambertMaterial({color:0x8a2a22,flatShading:true}),
    bag:new THREE.MeshLambertMaterial({color:0x6e4a2c,flatShading:true}), bag2:new THREE.MeshLambertMaterial({color:0x3a4a3a,flatShading:true})
  };
  // the same panels in two times: cream and lit, then greened under the sea
  const TINT=[[M.wall,0xffffff,0x5a6a62],[M.trim,0x8a6a48,0x2a3430],[M.ceil,0xe8dcc0,0x4a5650],[M.strip,0xfff3d0,0x0a1414],[M.frame,0xffffff,0x5a6a62],[M.metal,0x8a9098,0x2a3a38],[M.wood,0x5a3a22,0x1e2420]];
  const seatCloth=mergeGeo([{geo:BX,y:.42,z:.02,sx:.46,sy:.12,sz:.48},{geo:BX,y:.8,z:.3,rx:.12,sx:.46,sy:.68,sz:.1},
    {geo:BX,x:-.235,y:.6,z:.04,sx:.05,sy:.08,sz:.46},{geo:BX,x:.235,y:.6,z:.04,sx:.05,sy:.08,sz:.46}]);
  const seatLace=mergeGeo([{geo:BX,y:1.04,z:.26,rx:.12,sx:.34,sy:.16,sz:.02}]);
  const seatLeg=mergeGeo([[-.18,-.12],[.18,-.12],[-.18,.24],[.18,.24]].map(([x,z])=>({geo:BX,x,y:.18,z,sx:.04,sy:.36,sz:.04})));

  /* ---- the shell: walls with their windows, the curve up to the ceiling, hat racks, light strips ---- */
  function shellRun(z0,z1){
    wb(M.trim,-HW-.1,HW+.1,-.15,0,z0,z1);
    for(const s of [-1,1]){ const xa=s<0?-HW-.1:HW, xb=s<0?-HW:HW+.1;
      wb(M.wall,xa,xb,0,WIN_Y0,z0,z1); wb(M.wall,xa,xb,WIN_Y1,1.8,z0,z1);
      const ws=WINZ.filter(w=>w>z0+.25&&w<z1-.25).sort((a,b)=>a-b); let zc=z0;
      for(const w of ws){ wb(M.wall,xa,xb,WIN_Y0,WIN_Y1,zc,w-.21); zc=w+.21; put(PL,M.frame,s*(HW-.01),1.125,w,0,-s*Math.PI/2,0,.56,.6,1); }
      wb(M.wall,xa,xb,WIN_Y0,WIN_Y1,zc,z1);
      put(BX,M.ceil,s*1.2,1.975,(z0+z1)/2,0,0,-s*.611,.62,.04,z1-z0);
      wb(M.trim,s<0?-HW:1,s<0?-1:HW,1.7,1.73,z0,z1); wb(M.trim,s<0?-1.02:.98,s<0?-.98:1.02,1.62,1.73,z0,z1);
      wb(M.trim,s<0?-HW:HW-.05,s<0?-HW+.05:HW,0,.12,z0,z1); }
    wb(M.ceil,-.96,.96,CEIL,CEIL+.04,z0,z1);
    wb(M.strip,-.52,-.46,CEIL-.01,CEIL,z0,z1); wb(M.strip,.46,.52,CEIL-.01,CEIL,z0,z1); }
  // both times, rear of the break
  const shellR=new THREE.Group(); sc.add(shellR);
  shellRun(Z_BREAK,Z_REAR);
  for(const s of [-1,1]){ wb(M.wall,s<0?-HW:.75,s<0?-.75:HW,0,CEIL,Z_GALLEY-.04,Z_GALLEY+.04);
    wb(M.trim,s<0?-HW:.9,s<0?-.9:HW,0,.95,9.3,Z_REAR); wb(M.metal,s<0?-HW:.88,s<0?-.88:HW,.95,.98,9.3,Z_REAR); wb(M.trim,s<0?-HW:.95,s<0?-.95:HW,1.4,CEIL,9.3,Z_REAR); }
  wb(M.wall,-.75,.75,1.92,CEIL,Z_GALLEY-.04,Z_GALLEY+.04);
  wb(M.wall,-HW,HW,0,CEIL+.05,Z_REAR,Z_REAR+.1);
  flush(shellR);
  // 1955 only: the front of the cabin, the cockpit door
  const shellF=new THREE.Group(); sc.add(shellF);
  shellRun(Z_FRONT,Z_BREAK);
  wb(M.wall,-HW,HW,0,CEIL+.05,Z_FRONT-.1,Z_FRONT); wb(M.wood,-.36,.36,0,1.92,Z_FRONT,Z_FRONT+.04); wb(M.metal,.22,.28,.95,1,Z_FRONT+.04,Z_FRONT+.07);
  flush(shellF);
  const beltOff=label('FASTEN SEAT BELT · NO SMOKING',128,16,'#2a1d14','#4a3424'), beltOn=label('FASTEN SEAT BELT · NO SMOKING',128,16,'#d8bd8e','#2a1d14');
  const belt=new THREE.MeshBasicMaterial({map:beltOff}); { const m=new THREE.Mesh(PL,belt); m.scale.set(.9,.14,1); m.position.set(0,2.02,Z_FRONT+.02); shellF.add(m);
    const c=new THREE.Mesh(PL,new THREE.MeshBasicMaterial({map:label('CREW',32,12,'#5a3a22','#d8bd8e')})); c.scale.set(.24,.09,1); c.position.set(0,1.6,Z_FRONT+.045); shellF.add(c); }

  /* ---- 1955: seats, curtains, the carpet, luggage up on the racks, the stewardess's urn ---- */
  const g55=new THREE.Group(); sc.add(g55);
  wb(M.carpet,-HW,HW,0,.005,Z_FRONT,Z_GALLEY); wb(M.metal,-HW,HW,0,.006,Z_GALLEY,Z_REAR);
  for(const z of ROWS) for(const x of SEATX){ put(seatCloth,M.seat,x,0,z); put(seatLace,M.lace,x,0,z); put(seatLeg,M.metal,x,0,z); }
  for(const w of WINZ) for(const s of [-1,1]) for(const o of [-.3,.3]) put(BX,M.curtain,s*1.41,1.12,w+o,0,0,0,.05,.56,.1);
  for(let i=0;i<22;i++){ const s=r()<.5?-1:1, z=lerp(Z_FRONT+.4,Z_GALLEY-.3,r()), w=.3+r()*.4, h=.16+r()*.14; put(BX,r()<.5?M.bag:M.bag2,s*1.2,1.73+h/2,z,0,(r()-.5)*.3,0,.36,h,w); }
  put(CYL,M.metal,1.15,1.15,10.2,0,0,0,.26,.36,.26); put(CYL,M.lace,-1.1,1.02,10.6,0,0,0,.08,.08,.08); put(CYL,M.lace,-1.2,1.02,10.4,0,0,0,.08,.08,.08);
  flush(g55);

  /* ---- 2086: silt, what's left of the seats, of the people in them; the break and the pile at it ---- */
  const g86=new THREE.Group(); sc.add(g86);
  wb(M.silt,-HW,HW,0,.03,Z_BREAK,Z_REAR);
  for(let i=0;i<30;i++){ const s=r()<.5?-1:1; put(ICO,M.silt,s*(1-r()*.9),.02,lerp(Z_BREAK,Z_REAR,r()),0,r()*3,0,.4+r()*.4,.08+r()*.06,.5+r()*.5); }
  const remains=(x,z)=>{ const B=M.bone, sl=(r()-.5)*.3;
    put(BX,B,x+sl*.3,.95,z+.02,.7,sl,0,.16,.18,.18); put(BX,B,x+sl*.3,.85,z-.07,.5,sl,0,.12,.04,.1);
    put(BX,B,x,.8,z+.18,.2,0,0,.04,.5,.04); for(let i=0;i<4;i++) put(BX,B,x,.62+i*.07,z+.12,.2,0,0,.3-i*.03,.025,.18);
    put(BX,B,x,.5,z+.06,0,0,0,.28,.08,.16);
    for(const s of [-1,1]){ put(BX,B,x+s*.1,.52,z-.12,0,0,0,.05,.05,.42); put(BX,B,x+s*.1,.27,z-.36,0,0,0,.04,.4,.04); put(BX,B,x+s*.22,.6,z+.02,.3,0,s*.15,.035,.38,.035); }
    put(BX,M.rot,x,.64,z+.18,.2,0,0,.34,.3,.08); };
  const strapped=(x,z)=>{ for(const s of [-1,1]) put(BX,M.rot,x+s*.14,.38,z-.2,.2,0,s*.2,.04,.32,.01); };
  for(let ri=0;ri<ROWS.length;ri++){ const z=ROWS[ri]; if(z<Z_BREAK+.3) continue;
    for(let si=0;si<4;si++){ const x=SEATX[si], p=PAX.find(q=>q.r===ri&&q.s===si);
      if(!p&&r()<.2){ if(r()<.5) put(seatCloth,M.seat86,x+(x<0?.08:-.08),.05,z-.3,1.2+r()*.3,r()-.5,(r()-.5)*.4); continue; }   // torn out; sometimes it fell forward
      const rx=(r()-.5)*.12, rz=(r()-.5)*.16;
      put(seatCloth,M.seat86,x,0,z,rx,0,rz); if(r()<.6) put(seatLace,M.lace86,x,0,z,rx,0,rz); put(seatLeg,M.metal,x,0,z,rx,0,rz);
      if(p&&p.f==='dead') remains(x,z);
      else if(p&&p.f==='gone'){ strapped(x,z); if(p.k==='m'){ put(BX,M.rot,x+.2,.03,z-.5,0,r()*3,.2,.32,.02,.32); put(BX,M.rot,x+.2,.08,z-.5,0,r()*3,.2,.2,.09,.2); } } } }
  for(let i=0;i<10;i++){ const s=r()<.5?-1:1; put(BX,r()<.5?M.bag:M.bag2,s*(.6+r()*.7),.12,lerp(Z_BREAK+.6,Z_GALLEY-.4,r()),r()*.3,r()*3,r()*.3,.4,.2,.3+r()*.3); }
  for(let i=0;i<5;i++){ const s=r()<.5?-1:1, z=lerp(Z_BREAK+1,8,r()); put(BX,M.ceil,s*.7,1.9,z,(r()-.5)*.6,0,s*(.6+r()*.5),.5,.03,.9); }   // ceiling panels hanging down
  // the break: torn skin, the floor ending in a lip, then the pile
  for(let i=0;i<16;i++){ const s=r()<.5?-1:1, len=.3+r()*1.1; put(BX,M.wall,s*(HW+.05),r()*1.9,Z_BREAK-len/2,(r()-.5)*.3,s*(r()*.25),0,.1,.25+r()*.4,len); }
  for(let i=0;i<8;i++){ const len=.3+r()*.9; put(BX,M.ceil,(r()-.5)*1.8,CEIL-.05,Z_BREAK-len/2,(r()-.5)*.5,0,(r()-.5)*.4,.35,.04,len); }
  for(let i=0;i<6;i++){ const len=.4+r()*1.2; put(BX,M.trim,-1.2+i*.48,-.08,Z_BREAK-len/2,(r()-.5)*.2,0,(r()-.5)*.2,.44,.12,len); }
  for(let i=0;i<16;i++) put(ICO,M.rock,(r()-.5)*2.6,r()*.9,Z_BREAK+.1-r()*.9,r()*3,r()*3,0,.3+r()*.35,.25+r()*.4,.3+r()*.35);
  for(let i=0;i<6;i++) put(BX,M.wreck,(r()-.5)*2.4,.2+r()*1.1,Z_BREAK+.2-r()*.8,r()*3,r()*3,r()*3,.6+r()*.6,.06,.3+r()*.5);
  put(seatCloth,M.seat86,-.1,.6,Z_BREAK+.05,.9,.4,1.4); put(BX,M.trim,0,.9,Z_BREAK+.25,.3,.2,.5,2.6,.05,.4);
  flush(g86);
  const lbl86=new THREE.Mesh(PL,new THREE.MeshBasicMaterial({map:label('HALCYON AIR L NES · 9 4',96,14,'#1e2420','#4a5650')})); lbl86.scale.set(1.3,.19,1); lbl86.position.set(0,2.03,Z_GALLEY-.05); lbl86.rotation.y=Math.PI; g86.add(lbl86);
  const lbl55=new THREE.Mesh(PL,new THREE.MeshBasicMaterial({map:label('HALCYON AIR LINES · 914',96,14,'#34466a','#f4e6c4')})); lbl55.scale.set(1.3,.19,1); lbl55.position.set(0,2.03,Z_GALLEY-.05); lbl55.rotation.y=Math.PI; g55.add(lbl55);

  /* ---- 1955 outside: the sky, the cloud floor, the wing and its engines ---- */
  const ext55=new THREE.Group(); sc.add(ext55);
  const dome=(t,rad,tr)=>{ const m=new THREE.Mesh(new THREE.SphereGeometry(rad,16,12),new THREE.MeshBasicMaterial({map:t,side:THREE.BackSide,fog:false,depthWrite:false,transparent:!!tr,opacity:1})); m.renderOrder=-1; ext55.add(m); return m; };
  const domeC=dome(SK.clear,200), domeS=dome(SK.storm,195,true), domeA=dome(SK.anc,190);
  const sea=new THREE.Mesh(PL,new THREE.MeshBasicMaterial({map:T.cloud})); sea.scale.set(560,560,1); sea.rotation.x=-Math.PI/2; sea.position.y=-28; ext55.add(sea);
  const wingG=new THREE.Group(); ext55.add(wingG);
  for(const s of [-1,1]){
    put(BX,M.alu,s*4.25,-.31,1.3,0,0,s*.04,5.5,.34,3.8); put(BX,M.alu,s*11.5,.05,1,0,0,s*.04,9,.2,2.6);
    put(BX,M.aluD,s*4.25,-.13,3.05,0,0,s*.04,5.3,.012,.06); put(BX,M.aluD,s*11.5,.16,2.2,0,0,s*.04,8.8,.012,.05);
    put(BX,M.cowl,s*15.7,.22,1,0,0,s*.04,.6,.21,2.62);
    for(const ex of [4.2,8.2]){ const y=wingTop(ex)+.1; put(BX,M.alu,s*ex,y,-.7,0,0,0,.95,.9,3.6); put(CYL,M.cowl,s*ex,y+.03,-2.55,Math.PI/2,0,0,1,.36,1);
      put(BX,M.aluD,s*ex+s*.2,y+.46,-.4,0,0,0,.22,.02,1.6); } }
  flush(wingG);
  const props=[]; const pdM=new THREE.MeshBasicMaterial({color:0x9aa4ad,transparent:true,opacity:.12,side:THREE.DoubleSide,depthWrite:false});
  for(const s of [-1,1]) for(const ex of [4.2,8.2]){ const g=new THREE.Group(); g.position.set(s*ex,wingTop(ex)+.13,-2.8); ext55.add(g);
    g.add(new THREE.Mesh(new THREE.CircleGeometry(1.6,20),pdM)); const hub=new THREE.Mesh(new THREE.ConeGeometry(.2,.4,8),M.aluD); hub.rotation.x=-Math.PI/2; hub.position.z=-.15; g.add(hub);
    for(let k=0;k<3;k++){ const p=new THREE.Group(); p.rotation.z=k*2.094; const bl=new THREE.Mesh(BX,mat(0x14100c)); bl.scale.set(.14,1.5,.04); bl.position.y=.8; p.add(bl); g.add(p); } props.push(g); }
  // cloud: in the clear, far and below; in the storm, close, all around, going past fast
  const cloudM=new THREE.MeshLambertMaterial({color:0xeef5fb,flatShading:true}), wispM=new THREE.MeshLambertMaterial({color:0x8592a0,flatShading:true,transparent:true,opacity:0,depthWrite:false});
  const puff=n=>mergeGeo(Array.from({length:n},()=>({geo:ICO,x:(r()-.5)*n*1.6,y:(r()-.3)*1.5,z:(r()-.5)*n*1.4,ry:r()*3,sx:1.6+r()*2.2,sy:1+r()*1.2,sz:1.6+r()*2.2})));
  const clouds=[], wisps=[];
  // a puff is placed by its centre, but it reaches metres either side of it: shrink it, then push it out, until its near
  // edge clears the fuselage (it slides the length of the plane, so only x matters)
  const outside=(m,s,x,y,z,sc,min)=>{ const bb=m.geometry.boundingBox||(m.geometry.computeBoundingBox(),m.geometry.boundingBox), reach=s>0?-bb.min.x:bb.max.x, edge=HW+.5;
    sc=clamp((x-edge)/Math.max(reach,.01),min,sc); m.scale.setScalar(sc); m.position.set(s*Math.max(x,edge+reach*sc),y,z); };
  for(let i=0;i<22;i++){ const m=new THREE.Mesh(puff(4+(r()*4|0)),cloudM); const s=r()<.5?-1:1; outside(m,s,18+r()*110,-22+r()*14,(r()-.5)*300,1.5+r()*2.5,1.2); ext55.add(m); clouds.push(m); }
  for(let i=0;i<36;i++){ const m=new THREE.Mesh(puff(3+(r()*3|0)),wispM); const s=r()<.5?-1:1; outside(m,s,3.5+r()*28,-8+r()*16,(r()-.5)*300,.8+r()*1.6,.45); ext55.add(m); wisps.push(m); }
  // rain going past the windows
  const RN=260, rp=new Float32Array(RN*6), rain=[]; for(let i=0;i<RN;i++){ const s=r()<.5?-1:1; rain.push({x:s*(1.7+r()*8),y:-3+r()*8,z:(r()-.5)*30}); }
  const rg=new THREE.BufferGeometry(); rg.setAttribute('position',new THREE.BufferAttribute(rp,3));
  const rainM=new THREE.LineBasicMaterial({color:0xb9c4ce,transparent:true,opacity:0}); const rainL=new THREE.LineSegments(rg,rainM); rainL.frustumCulled=false; ext55.add(rainL);
  const boltM=new THREE.LineBasicMaterial({color:0xeef2f6,fog:false}); const bolt=new THREE.LineSegments(new THREE.BufferGeometry(),boltM); bolt.visible=false; bolt.frustumCulled=false; ext55.add(bolt);

  /* ---- the old sky: a jungle floor, two volcanoes, the flock ---- */
  const ancG=new THREE.Group(); ancG.visible=false; ext55.add(ancG);
  { const gnd=new THREE.Mesh(PL,new THREE.MeshBasicMaterial({map:T.jungle})); gnd.scale.set(520,520,1); gnd.rotation.x=-Math.PI/2; gnd.position.y=-70; ancG.add(gnd);
    const vM=mat(0x30200e), lava=new THREE.MeshBasicMaterial({color:0xff5a10}), smoke=mat(0x1c1008);
    for(const [x,z,h] of [[-95,-120,58],[120,-60,44],[-70,90,36]]){ const v=new THREE.Mesh(new THREE.ConeGeometry(h*1.1,h,8),vM); v.position.set(x,-70+h/2,z); ancG.add(v);
      const l=new THREE.Mesh(new THREE.ConeGeometry(h*.18,h*.12,8),lava); l.position.set(x,-70+h-h*.04,z); ancG.add(l);
      for(let k=0;k<5;k++){ const p=new THREE.Mesh(ICO,smoke); p.scale.setScalar(h*(.12+k*.05)); p.position.set(x+k*h*.12,-70+h+h*.18*(k+1),z-k*h*.05); ancG.add(p); } } }
  const pteros=[]; const ptM=new THREE.MeshLambertMaterial({color:0x30200e,flatShading:true,side:THREE.DoubleSide});
  const wingL=fanGeo([[0,0,-.45],[-1.8,0,-.35],[-4.2,0,.1],[0,0,.55]]), wingR=fanGeo([[0,0,-.45],[1.8,0,-.35],[4.2,0,.1],[0,0,.55]]), crest=fanGeo([[0,.05,-1.25],[0,.6,-.6],[0,.05,-.9]]);
  for(let i=0;i<6;i++){ const g=new THREE.Group(); const b=(w,h,d,x,y,z)=>{ const o=new THREE.Mesh(BX,ptM); o.scale.set(w,h,d); o.position.set(x,y,z); g.add(o); };
    b(.35,.3,1.3,0,0,0); b(.12,.12,.9,0,.12,-.95); b(.07,.09,.8,0,.12,-1.75); b(.04,.04,.8,0,0,.95); g.add(new THREE.Mesh(crest,ptM));
    const wl=new THREE.Group(), wr=new THREE.Group(); wl.position.x=-.15; wr.position.x=.15; wl.add(new THREE.Mesh(wingL,ptM)); wr.add(new THREE.Mesh(wingR,ptM)); g.add(wl,wr);
    ancG.add(g); pteros.push({g,wl,wr,ph:r()*6,vz:0,s:1}); }

  /* ---- the thing on the wing: tall, black, no head to speak of, eyes like brake lights ---- */
  const moth=new THREE.Group(); moth.visible=false; ext55.add(moth);
  const mM=new THREE.MeshLambertMaterial({color:0x06070c,flatShading:true,side:THREE.DoubleSide});
  const mLegs=new THREE.Group(); moth.add(mLegs); for(const s of [-1,1]){ const l=new THREE.Mesh(BX,mM); l.scale.set(.14,1,.16); l.position.set(s*.12,.5,0); mLegs.add(l); }
  const mUp=new THREE.Group(); moth.add(mUp); const mBody=new THREE.Group(); mUp.add(mBody);
  for(const [w,h,d,y,z] of [[.5,.85,.3,1.42,0],[.64,.22,.34,1.84,-.02],[.26,.18,.24,2,-.06]]){ const o=new THREE.Mesh(BX,mM); o.scale.set(w,h,d); o.position.set(0,y,z); mBody.add(o); }
  const mwL=new THREE.Group(), mwR=new THREE.Group(); mwL.position.set(-.18,1.78,-.12); mwR.position.set(.18,1.78,-.12); mBody.add(mwL,mwR);
  const mwPts=[[0,0,0],[-.4,.45,0],[-1.4,.5,0],[-2,-.05,0],[-1.5,-.75,0],[-.6,-.95,0]];
  mwL.add(new THREE.Mesh(fanGeo(mwPts),mM)); mwR.add(new THREE.Mesh(fanGeo(mwPts.map(([x,y,z])=>[-x,y,z])),mM));
  const glow=tex(16,16,(g,w,h)=>{ const gr=g.createRadialGradient(8,8,0,8,8,8); gr.addColorStop(0,'rgba(255,255,255,1)'); gr.addColorStop(.35,'rgba(255,80,60,.8)'); gr.addColorStop(1,'rgba(255,0,0,0)'); g.fillStyle=gr; g.fillRect(0,0,w,h); });
  const eyeM=new THREE.SpriteMaterial({map:glow,color:0xff2a1a,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true,fog:false});
  const eyes=[-1,1].map(s=>{ const e=new THREE.Sprite(eyeM); e.scale.set(.2,.2,1); e.position.set(s*.11,1.74,.17); mUp.add(e); return e; });

  /* ---- 2086 outside: the seabed, the wing that stayed, the nose that didn't, things that glow ---- */
  const ext86=new THREE.Group(); sc.add(ext86);
  put(PL,M.sand,0,-.95,0,-Math.PI/2,0,0,120,120,1);
  for(let i=0;i<40;i++){ const a=r()*6.283, d=3+r()*30; put(ICO,M.sand,Math.cos(a)*d,-1,Math.sin(a)*d,0,r()*3,0,1+r()*3,.3+r()*.6,1+r()*3); }
  for(let i=0;i<18;i++){ const a=r()*6.283, d=4+r()*26; put(ICO,M.rock,Math.cos(a)*d,-.8,Math.sin(a)*d,r()*3,r()*3,0,.4+r()*1.2,.4+r()*.8,.4+r()*1.2); }
  put(BX,M.wreck,4.2,-.6,1.2,.08,.15,.12,5.5,.3,3.6); put(BX,M.wreck,8.4,-.7,3.4,.3,.6,-.2,.95,.9,3.6);   // the right wing, snapped at the root, an engine beside it
  put(BX,M.wreck,-3.4,-.75,.4,-.1,-.2,-.25,3.6,.26,3.2);
  for(const [w,h,d,x,y,z] of [[3,.12,6,0,-.6,0],[.12,2.2,6,-1.5,.45,0],[.12,2.2,6,1.5,.45,0],[3,.12,6,0,1.5,0]]) put(BX,M.wreck,-4+x*Math.cos(.5)+z*Math.sin(.5),y-.3,-17+z*Math.cos(.5)-x*Math.sin(.5),0,.5,.35,w,h,d);
  flush(ext86);
  const pts=(n,f)=>{ const a=new Float32Array(n*3); for(let i=0;i<n;i++){ const p=f(i); a[i*3]=p[0]; a[i*3+1]=p[1]; a[i*3+2]=p[2]; } const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(a,3)); return g; };
  const SN=500, snowB=[]; for(let i=0;i<SN;i++) snowB.push([(r()-.5)*7,r()*4-1,lerp(-12,12,r()),r()*6]);
  const snowG=pts(SN,i=>snowB[i]); const snow=new THREE.Points(snowG,new THREE.PointsMaterial({color:0x7a7a60,size:.016})); snow.frustumCulled=false; ext86.add(snow);
  const BN=60, bioB=[]; for(let i=0;i<BN;i++){ const s=r()<.5?-1:1; bioB.push([s*(2.2+r()*12),r()*4-.5,lerp(-14,12,r()),r()*6]); }
  const bioG=pts(BN,i=>bioB[i]); const bioM=new THREE.PointsMaterial({color:0x9ef0e0,size:.09,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false});
  const bio=new THREE.Points(bioG,bioM); bio.frustumCulled=false; ext86.add(bio);
  // seaweed: ribbons out on the seabed, and a few come up through the silt in the cabin. One mesh; swayed in deepFrame.
  const KS=6, kelpS=[];
  for(let i=0;i<64;i++){ const a=r()*6.283, d=2.2+r()*24, x=Math.cos(a)*d, z=Math.sin(a)*d; if(Math.abs(x)<1.8&&z>Z_BREAK-.6&&z<Z_REAR+.4) continue; kelpS.push([x,-.95,z,.6+r()*1.9]); }
  for(let i=0;i<18;i++){ const s=r()<.5?-1:1, z=lerp(Z_BREAK+.3,Z_GALLEY-.3,r()); kelpS.push([s*(.8+r()*.55),.03,z,.3+r()*.8]); }
  for(let i=0;i<6;i++) kelpS.push([(r()-.5)*2.4,.6+r()*.4,Z_BREAK+.1-r()*.6,.4+r()*.6]);   // out of the wreckage pile
  // sea grass: low tufts of thin blades, thick on the seabed, a few patches in the cabin's silt. [x,y,z,h,width,segments,tuft phase]
  const tuft=(x,y,z,n,hmax)=>{ const ph=r()*6.283; for(let k=0;k<n;k++) kelpS.push([x+(r()-.5)*.25,y,z+(r()-.5)*.25,.15+r()*hmax,.04+r()*.025,2,ph+(r()-.5)*.6]); };
  for(let i=0;i<240;i++){ const a=r()*6.283, d=1.9+Math.pow(r(),1.6)*16, x=Math.cos(a)*d, z=Math.sin(a)*d; if(Math.abs(x)<1.7&&z>Z_BREAK-.6&&z<Z_REAR+.4) continue; tuft(x,-.95,z,6+(r()*7|0),.45); }
  for(let i=0;i<26;i++){ const s=r()<.5?-1:1; tuft(s*(.65+r()*.7),.03,lerp(Z_BREAK+.3,Z_GALLEY-.3,r()),3+(r()*4|0),.18); }
  const kv=[], kh=[], kph=[], ki=[];
  for(const [x,y,z,h,wq,sq,pq] of kelpS){ const yaw=r()*3.14, cx=Math.cos(yaw), cz=Math.sin(yaw), ph=pq==null?r()*6.283:pq, b=kv.length/3, w0=wq||.06+r()*.05, ns=sq||KS;
    for(let l=0;l<=ns;l++){ const f=l/ns, w=wq?w0*(1-f*.9):w0*(1-f*.7)+.01, yy=y+f*h, bend=wq?f*f*h*.35*(r()-.5):Math.sin(f*2+ph)*.06;
      kv.push(x-cx*w+bend,yy,z-cz*w, x+cx*w+bend,yy,z+cz*w); kh.push(f*f*h,f*f*h); kph.push(ph,ph);
      if(l<ns){ const o=b+l*2; ki.push(o,o+1,o+2, o+1,o+3,o+2); } } }
  const kelpG=new THREE.BufferGeometry(); kelpG.setAttribute('position',new THREE.BufferAttribute(new Float32Array(kv),3)); kelpG.setIndex(ki); kelpG.computeVertexNormals();
  const kelp=new THREE.Mesh(kelpG,new THREE.MeshLambertMaterial({color:0x4e7a34,emissive:0x0c1808,side:THREE.DoubleSide})); kelp.frustumCulled=false; ext86.add(kelp);
  const kelpB=new Float32Array(kv), kelpH=new Float32Array(kh), kelpP=new Float32Array(kph);
  // fish: small, silver under the torch. Three schools circle the hull and the nose's absence; one noses along the aisle.
  const fishGeo=mergeGeo([{geo:BX,sx:.035,sy:.06,sz:.13},{geo:BX,z:-.075,sx:.025,sy:.04,sz:.04},{geo:fanGeo([[0,0,.06],[0,.045,.13],[0,-.045,.13]])}]);
  const fishM=new THREE.MeshLambertMaterial({color:0xa0d0cc,emissive:0x0f3236,flatShading:true,side:THREE.DoubleSide});
  const schools=[
    {cx:-6,cy:.6,cz:2,rx:3,rz:4,sp:.22,y:.5,n:7},{cx:6.5,cy:1.4,cz:-1,rx:2.6,rz:5,sp:-.18,y:.6,n:7},{cx:0,cy:.4,cz:-12,rx:4,rz:3.5,sp:.25,y:.4,n:8},
    {inside:true,sp:.12,n:6}].map((s,si)=>{ s.ph=r()*6.283; s.fish=[];
      for(let i=0;i<s.n;i++){ const m=new THREE.Mesh(fishGeo,fishM); m.scale.setScalar(s.inside?.5:.55+r()*.35); ext86.add(m);
        s.fish.push({m,ox:(r()-.5)*(s.inside?.4:1.2),oy:(r()-.5)*(s.inside?.25:.7),oz:(r()-.5)*(s.inside?.8:1.4),fx:0,fy:0,fz:0,ph:r()*6.283}); }
      return s; });
  // the ningen: one long smooth body (round head, a pinch of neck, wide shoulders, tapering to the hips), two long legs
  // trailing behind it, two long thin arms. No face to see. Never more than a shadow: unlit, so the torch shows nothing on
  // it, only a darker shape against the fog. Head to toe about five metres at scale 1, swimming flat, local -z forward.
  const ngM=new THREE.MeshBasicMaterial({color:0x010406,side:THREE.DoubleSide});
  const ngBody=new THREE.LatheGeometry([[0,0],[.26,.08],[.4,.28],[.43,.52],[.34,.78],[.48,.98],[.62,1.28],[.6,1.7],[.5,2.3],[.42,2.85],[.3,3.25],[0,3.3]].map(([x,y])=>new THREE.Vector2(x,y)),12);
  ngBody.rotateX(Math.PI/2); ngBody.scale(1,.78,1); ngBody.translate(0,0,-2.2);
  // a limb hangs from its pivot along -y, tapering: rotation.x turns it forward (+) or back (-)
  const limb=(r0,r1,len)=>{ const g=new THREE.CylinderGeometry(r0,r1,len,7); g.translate(0,-len/2,0); return g; };
  const ngLeg=limb(.2,.05,2.1), ngArm=limb(.11,.035,2.3);
  const ngs=[]; for(let i=0;i<3;i++){ const g=new THREE.Group(); g.visible=false; ext86.add(g); const body=new THREE.Group(); g.add(body);
    body.add(new THREE.Mesh(ngBody,ngM));
    const legs=[-1,1].map(s=>{ const l=new THREE.Group(); l.position.set(s*.2,0,.95); l.add(new THREE.Mesh(ngLeg,ngM)); body.add(l); return l; });
    const arms=[-1,1].map(s=>{ const a=new THREE.Group(); a.position.set(s*.56,-.08,-.95); a.add(new THREE.Mesh(ngArm,ngM)); body.add(a); return a; });
    ngs.push({g,body,legs,arms,on:false,keys:null,k:0,t:0,yaw:0,ph:r()*6.283,reach:0,sw:0,tap:0,tapA:0,sc:1,px:0,py:0,pz:0}); }

  /* ---- people ---- */
  for(const p of PAX){ const f=person(p.k,r,true); f.g.position.set(p.x,p.k==='c'?.13:0,p.z); sc.add(f.g); p.g=f.g; p.head=f.head; p.hy=0; }
  const stewF=person('f',r,false,0x24304a); stewF.g.position.set(STEW.x,0,STEW.z); sc.add(stewF.g);
  const stew={g:stewF.g,head:stewF.head,ry:0};

  /* ---- the crack you came through, and light ---- */
  const rift=K.crack({h:1.9,w:.9,seed:914,edge:0x7f98ad,n:22}); rift.g.position.set(RIFT.x,1.02,RIFT.z); sc.add(rift.g);
  const riftL=new THREE.PointLight(0x9ec8ff,1,5,1.6); riftL.position.set(0,1.1,11.2); sc.add(riftL);
  const hemi=new THREE.HemisphereLight(0xeef5fb,0x7a6a50,.85); sc.add(hemi);
  const cabinL=[]; for(const z of [-6,0,6,10.2]){ const l=new THREE.PointLight(0xffe2b0,.9,9,1.5); l.position.set(0,1.95,z); sc.add(l); cabinL.push(l); }
  // 2086: a faint glow so the dark is never total, and the flashlight, a narrow cone that does most of the seeing
  const lamp=new THREE.PointLight(0x4a8a88,0,2.6,1.6);
  const flash=new THREE.SpotLight(0xd8f4ee,0,14,.38,.5,1.2); flash.position.set(.15,-.15,0); const ftg=new THREE.Object3D(); ftg.position.set(0,-.08,-1); flash.target=ftg;
  W={flash,ftg,kelp,kelpG,kelpB,kelpH,kelpP,schools,sc,M,TINT,shellF,g55,g86,ext55,ext86,domeC,domeS,domeA,sea,props,clouds,wisps,cloudM,wispM,rain,rp,rg,rainM,bolt,ancG,pteros,
    moth,mLegs,mUp,mBody,mwL,mwR,eyes,ngs,snow,snowB,snowG,bio,bioB,bioG,bioM,stew,rift,riftL,hemi,cabinL,lamp,belt,beltOn,beltOff,T}; }

/* ================= SOUND ================= */
const sndA={
  step(){ const a=K.A(); if(!a) return; const t=a.ac.currentTime, v=.8+Math.random()*.3;
    if(L.era===1){ a.tone(t,'sine',80,42,.14*v,.004,.1); a.noise(t,.08,'lowpass',700,.8,.08*v,.06); }
    else { a.noise(t,.3,'lowpass',260,.7,.16*v,.25); a.tone(t,'sine',50,30,.08*v,.02,.2); } },
  fail(){ const a=K.A(); if(!a) return; const t=a.ac.currentTime; a.tone(t,'sine',70,34,.4,.006,.4); a.noise(t,.35,'bandpass',2400,3,.2,.25); a.tone(t,'square',180,90,.05,.004,.2); },
  ding(){ const a=K.A(); if(!a) return; const t=a.ac.currentTime; a.tone(t,'triangle',1250,1250,.07,.005,.7); a.tone(t+.45,'triangle',990,990,.07,.005,.9); },
  rattle(){ const a=K.A(); if(!a) return; const t=a.ac.currentTime; a.tone(t,'sine',60,32,.3,.01,.45); a.noise(t,.5,'bandpass',1400,2,.16,.35);
    for(let i=0;i<5;i++) a.tone(t+i*.05+Math.random()*.03,'square',1800+Math.random()*900,1200,.015,.001,.03); },
  thunder(dist,pan){ const a=K.A(); if(!a||!S.active||S.era!=='air'||L.era!==1) return; const t=a.ac.currentTime, near=clamp(1-dist/3,0,1), d=K.pout(pan*.7,.5+near*.4); if(!d) return;
    if(near>.55) a.noise(t,.3,'highpass',1500,.7,.45*near,.25,d);
    a.noise(t,4+dist,'lowpass',130+near*120,.8,.8,3.5+dist,d); a.tone(t,'sine',46,28,.28+near*.2,.08,3,d); },
  shriek(pan){ const a=K.A(); if(!a) return; const d=K.pout(pan,.45); if(!d) return; const t=a.ac.currentTime;
    a.tone(t,'sawtooth',1500,620,.1,.06,.9,d); a.tone(t+.04,'square',2100,900,.035,.05,.7,d); a.noise(t,.8,'bandpass',2600,3,.07,.6,d); },
  creak(){ const a=K.A(); if(!a) return; const d=K.pout(Math.random()*1.6-.8,.6); if(!d) return; const t=a.ac.currentTime;
    a.tone(t,'sawtooth',68,44,.05,.5,1.8,d); a.tone(t+.1,'sawtooth',71,47,.035,.6,1.6,d); a.noise(t,1.6,'lowpass',180,1,.15,1.4,d); },
  // the white ones: a knock on the hull, through four thousand metres of water; a shove, the whole wreck groaning; far off, a call
  knock(pan,v){ const a=K.A(); if(!a) return; const d=K.pout(pan,v); if(!d) return; const t=a.ac.currentTime;
    a.tone(t,'sine',120,55,.5,.002,.22,d); a.noise(t,.12,'lowpass',500,1,.4,.1,d); a.tone(t,'triangle',310,290,.05,.002,.6,d); },
  shove(pan,v){ const a=K.A(); if(!a) return; const d=K.pout(pan,v); if(!d) return; const t=a.ac.currentTime;
    a.tone(t,'sine',48,26,.45,.02,.9,d); a.noise(t,2.2,'lowpass',170,.8,.55,1.9,d); a.tone(t+.15,'sawtooth',40,27,.14,.25,2.2,d);
    a.noise(t+.2,1.5,'bandpass',720,7,.09,1.3,d); a.tone(t+.35,'sawtooth',92,61,.04,.45,1.5,d); },
  moan(pan,v){ const a=K.A(); if(!a) return; const d=K.pout(pan,v); if(!d) return; const t=a.ac.currentTime;
    a.tone(t,'sine',150,92,.09,.9,2.8,d); a.tone(t+.15,'triangle',225,140,.03,1,2.4,d); a.noise(t,2.4,'bandpass',300,4,.04,2.2,d); },
  bubbles(){ const a=K.A(); if(!a) return; const t=a.ac.currentTime, n=4+((Math.random()*4)|0); for(let i=0;i<n;i++){ const f=300+Math.random()*500; a.tone(t+i*.09+Math.random()*.05,'sine',f,f*2.2,.035,.005,.07); } }
};
// a bed for each time: four radials and the wind on the skin; the rain over it in the storm; the deep, after
let bed=null;
function bedStart(){ const a=K.A(); if(!a||bed) return; const {ac,master,nb}=a, srcs=[];
  const bus=()=>{ const g=ac.createGain(); g.gain.value=0; g.connect(master); return g; };
  const eng=bus(), rain=bus(), deep=bus();
  const n=(dest,type,f,q,v)=>{ const s=ac.createBufferSource(); s.buffer=nb; s.loop=true; const fl=ac.createBiquadFilter(); fl.type=type; fl.frequency.value=f; fl.Q.value=q; const g=ac.createGain(); g.gain.value=v; s.connect(fl).connect(g).connect(dest); s.start(); srcs.push(s); return g; };
  const o=(dest,type,f,v,lp)=>{ const s=ac.createOscillator(), g=ac.createGain(); s.type=type; s.frequency.value=f; g.gain.value=v;
    if(lp){ const fl=ac.createBiquadFilter(); fl.type='lowpass'; fl.frequency.value=lp; s.connect(fl).connect(g); } else s.connect(g); g.connect(dest); s.start(); srcs.push(s); return g; };
  o(eng,'sawtooth',52,.05,240); o(eng,'sawtooth',52.7,.05,240); o(eng,'sawtooth',78.5,.022,300); n(eng,'lowpass',650,.6,.06); n(eng,'bandpass',1800,.7,.008);
  n(rain,'highpass',2200,.5,.11); const gust=n(rain,'bandpass',420,1.2,.05); { const l=ac.createOscillator(), lg=ac.createGain(); l.frequency.value=.11; lg.gain.value=.04; l.connect(lg).connect(gust.gain); l.start(); srcs.push(l); }
  n(deep,'lowpass',110,.7,.3); o(deep,'sine',34,.07); o(deep,'sawtooth',46,.022,90);
  bed={eng,rain,deep,srcs}; }
function bedMix(tc){ if(!bed) return; const a=K.A(); if(!a) return; const t=a.ac.currentTime, old=L.era===1;
  bed.eng.gain.setTargetAtTime(old?(SKY.anc?.2:1):0,t,tc); bed.rain.gain.setTargetAtTime(old&&!SKY.anc?SKY.sk:0,t,tc); bed.deep.gain.setTargetAtTime(old?0:1,t,tc); }
function bedStop(){ if(!bed) return; const b=bed; bed=null; const a=K.A(); if(!a) return; const t=a.ac.currentTime; for(const g of [b.eng,b.rain,b.deep]) g.gain.setTargetAtTime(0,t,.1);
  setTimeout(()=>{ try{ b.srcs.forEach(s=>s.stop()); [b.eng,b.rain,b.deep].forEach(g=>g.disconnect()); }catch(e){} },1500); }

/* ================= THE SKY (1955) =================
   Clear for a minute or two, then into the storm for one, then out; round again. Under either, every so often (sooner the
   longer you stay), the sky tears for a few seconds onto the Cretaceous: no cloud, a jungle far below, fire on the
   horizon, and the flock. */
const tc=new THREE.Color(), CL={fog:new THREE.Color(0xb8d2ea),fogS:new THREE.Color(0x2c3640),fogA:new THREE.Color(0xc89038),fogF:new THREE.Color(0x8592a0),
  hC:new THREE.Color(0xeef5fb),hS:new THREE.Color(0x8592a0),hA:new THREE.Color(0xf0c060),gC:new THREE.Color(0x7a6a50),gS:new THREE.Color(0x2c3640),gA:new THREE.Color(0x4a3216)};
function flashAt(s){ if(reduce) return s<3?.3*Math.exp(-s*1.4):0;
  return s<.07?1:s<.15?.25:s<.24?.85:Math.exp(-(s-.24)*5)*.7; }
function strike(){ SKY.since=0; SKY.big=Math.random()<.55;
  const side=Math.random()<.5?-1:1, bx=side*(50+Math.random()*60), bz=-60+Math.random()*100, dist=Math.random()*3;
  if(SKY.big){ const v=[]; let x=bx,y=60,z=bz; while(y>-30){ const nx=x+(Math.random()-.5)*10, ny=y-4-Math.random()*8, nz=z+(Math.random()-.5)*6; v.push(x,y,z,nx,ny,nz); x=nx; y=ny; z=nz; }
    W.bolt.geometry.dispose(); const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(v),3)); W.bolt.geometry=g; }
  setTimeout(()=>sndA.thunder(dist,side),300+dist*900); }
function startAnc(){ if(SKY.anc||L.era!==1) return; SKY.anc=true; SKY.ancT=reduce?3:rr(3,5); L.sawAnc=true; S.glitch=Math.max(S.glitch,reduce?.5:1.8); R.sfx.shift();
  W.ancG.visible=true; W.pteros.forEach((p,i)=>{ const s=i%2?1:-1; p.g.position.set(s*(8+Math.random()*(i<2?6:24)),-5+Math.random()*13,-45+Math.random()*50); p.vz=14+Math.random()*10; p.s=1+Math.random()*.6; p.g.scale.setScalar(p.s); });
  setTimeout(()=>{ if(SKY.anc) sndA.shriek(Math.random()<.5?-.8:.8); },400); if(MO.on) mothHide(false); bedMix(.2); }
function endAnc(){ SKY.anc=false; W.ancG.visible=false; SKY.ancNext=rr(40,90); S.glitch=Math.max(S.glitch,reduce?.4:1.2); bedMix(.4); }
function setSky(st){ if(st==='ancient'){ startAnc(); return; } if(SKY.anc) endAnc(); SKY.mode=st==='storm'?'storm':'clear'; SKY.sk=SKY.mode==='storm'?1:0; SKY.t=0; SKY.dur=SKY.mode==='storm'?rr(50,80):rr(70,110); }
function skyFrame(dt,run){
  if(run){ SKY.t+=dt; if(SKY.t>SKY.dur){ SKY.mode=SKY.mode==='clear'?'storm':'clear'; SKY.t=0; SKY.dur=SKY.mode==='clear'?rr(70,110):rr(50,80); }
    SKY.ancNext-=dt*(1+L.stay/150); if(!SKY.anc&&SKY.ancNext<=0) startAnc();
    if(SKY.anc){ SKY.ancT-=dt; if(SKY.ancT<=0) endAnc(); } }
  const tgt=SKY.mode==='storm'?1:0; SKY.sk+=clamp(tgt-SKY.sk,-dt/6,dt/6); const sk=SKY.sk, anc=SKY.anc;
  // lightning, turbulence, the seat-belt sign
  SKY.since+=dt; if(run&&sk>.6&&!anc){ SKY.next-=dt; if(SKY.next<=0){ strike(); SKY.next=rr(4,11); } }
  const f=SKY.flash=anc?0:flashAt(SKY.since)*clamp(sk*1.5,0,1);
  if(run&&sk>.4&&!anc){ SKY.joltNext-=dt; if(SKY.joltNext<=0){ SKY.joltNext=rr(6,14); SKY.jolt=1; sndA.rattle(); } }
  SKY.jolt=Math.max(0,SKY.jolt-dt*1.4);
  const belt=sk>.5&&!anc; if(belt!==SKY.belt){ SKY.belt=belt; W.belt.map=belt?W.beltOn:W.beltOff; W.belt.needsUpdate=true; if(belt) sndA.ding(); }
  // what the windows show
  W.domeC.visible=!anc; W.domeS.visible=!anc&&sk>.01; W.domeS.material.opacity=sk; W.domeS.material.color.setScalar(1+f*1.6); W.domeA.visible=anc;
  W.sea.visible=!anc; W.clouds.forEach(c=>{ c.visible=!anc; }); W.wispM.opacity=sk*.85; W.wisps.forEach(c=>{ c.visible=!anc&&sk>.02; });
  W.rainM.opacity=anc?0:sk*.55; W.bolt.visible=SKY.big&&f>.3&&!anc;
  if(anc){ W.sc.fog.color.copy(CL.fogA); W.sc.fog.density=.005; W.hemi.color.copy(CL.hA); W.hemi.groundColor.copy(CL.gA); W.hemi.intensity=.8; }
  else { W.sc.fog.color.copy(CL.fog).lerp(CL.fogS,sk).lerp(CL.fogF,f*.5); W.sc.fog.density=lerp(.006,.05,sk);
    W.hemi.color.copy(CL.hC).lerp(CL.hS,sk); W.hemi.groundColor.copy(CL.gC).lerp(CL.gS,sk); W.hemi.intensity=lerp(.85,.4,sk)+f*1.8; }
  W.sc.background.copy(W.sc.fog.color);
  const pal=anc?PAL_ANC:sk>.5?PAL_ST:PAL_CL; if(pal!==SKY.pal){ SKY.pal=pal; setPal(pal); }
  // cabin lights: steady, until the air gets rough
  const dim=!reduce&&SKY.jolt>.5&&Math.random()<.5?.25:1; W.cabinL.forEach(l=>{ l.intensity=.9*dim*(anc?.7:1); });
  // everything going past
  const sp=dt*(anc?0:1);
  W.T.cloud.offset.y+=sp*.06; for(const c of W.clouds){ c.position.z+=sp*30; if(c.position.z>150) c.position.z-=300; }
  for(const c of W.wisps){ c.position.z+=sp*70; if(c.position.z>150) c.position.z-=300; }
  for(const p of W.props) p.rotation.z+=dt*(reduce?8:40);
  if(sk>.05&&!anc){ const rp=W.rp; for(let i=0;i<W.rain.length;i++){ const d=W.rain[i]; d.z+=dt*55; d.y-=dt*9; if(d.z>15){ d.z-=30; d.y=-3+Math.random()*8; } if(d.y<-3) d.y+=8;
      rp[i*6]=d.x; rp[i*6+1]=d.y; rp[i*6+2]=d.z; rp[i*6+3]=d.x; rp[i*6+4]=d.y+.14; rp[i*6+5]=d.z-.8; } W.rg.attributes.position.needsUpdate=true; }
  if(anc) for(const p of W.pteros){ p.g.position.z+=dt*p.vz; if(p.g.position.z>70) p.g.position.z-=130; const fl=Math.sin(S.T*2.6+p.ph);
    p.wl.rotation.z=-fl*.5; p.wr.rotation.z=fl*.5; p.g.position.y+=Math.cos(S.T*2.6+p.ph)*dt*.6; p.g.rotation.z=Math.sin(S.T*.5+p.ph)*.15; } }

/* ================= THE PASSENGER ON THE WING =================
   Rare: a roll every half-minute or so, never under the torn sky. It comes on the side you aren't looking at, so it's
   there when you turn. Perched at the wing root, or keeping pace out past the engines. In the storm only the
   lightning shows more than its eyes. Watch it too long, or let the lightning catch it while you watch, and it's gone. */
const _e=new THREE.Vector3();
function throughWindow(x,y,z){ const c=cam.position, dx=x-c.x, side=Math.sign(x); if(dx*side<=0) return false;
  const t=(side*HW-c.x)/dx; if(t<0||t>1) return false; const yy=c.y+(y-c.y)*t, zz=c.z+(z-c.z)*t;
  if(yy<WIN_Y0+.02||yy>WIN_Y1-.02) return false; let ok=false; for(const w of WINZ) if(Math.abs(zz-w)<.17) ok=true;
  return ok&&K.onScreen(x,y,z,.92); }
function mothSpawn(pose,side){ if(L.era!==1||SKY.anc) return; const fx=-Math.sin(P.yaw);
  MO.side=side||(Math.abs(fx)>.3?-Math.sign(fx):(Math.random()<.5?-1:1)); MO.pose=pose||(Math.random()<.5?'fly':'perch');
  MO.on=true; MO.t=0; MO.watch=0; MO.life=MO.pose==='fly'?rr(18,28):rr(20,35);
  if(MO.pose==='perch'){ MO.x=3.4; MO.y=wingTop(3.4); MO.z=EXZ+rr(-.5,.9); W.mLegs.scale.y=.45; W.mUp.position.y=-.55; W.mwL.rotation.set(.2,-1.25,0); W.mwR.rotation.set(.2,1.25,0); }   // folded back, away from the glass
  else { MO.x=rr(5.5,8.5); MO.y0=MO.y=rr(1.2,2.8); MO.z=rr(-3,3.5); W.mLegs.scale.y=1; W.mUp.position.y=0; }
  W.moth.rotation.y=-MO.side*Math.PI/2; W.moth.visible=true; }
function mothHide(blip){ MO.on=false; W.moth.visible=false; if(blip&&!reduce) S.glitch=Math.max(S.glitch,.35); }
function mothFrame(dt){
  if(L.era!==1||S.mode!=='air'){ if(MO.on) mothHide(false); return; }
  if(!MO.on){ MO.next-=dt; if(MO.next<=0){ MO.next=rr(30,60); if(!SKY.anc&&Math.random()<.55) mothSpawn(); } return; }
  MO.t+=dt; MO.life-=dt;
  if(MO.pose==='fly'){ MO.z+=Math.sin(MO.t*.4)*dt*.8; MO.y=MO.y0+Math.sin(MO.t*.9)*.35; const fl=Math.sin(MO.t*2.2);
    W.mwL.rotation.set(0,-.25+fl*.45,0); W.mwR.rotation.set(0,.25-fl*.45,0); W.mLegs.rotation.x=.3; }
  else { W.mLegs.rotation.x=0; W.mBody.rotation.y=Math.sin(MO.t*.3)*.15; }
  W.moth.position.set(MO.side*MO.x,MO.y,MO.z);
  W.mBody.visible=skyState()!=='storm'||SKY.flash>.15;
  W.moth.updateMatrixWorld(true); W.eyes[0].getWorldPosition(_e);
  if(throughWindow(_e.x,_e.y,_e.z)){ MO.watch+=dt;
    if(!MO.logged&&MO.watch>.4){ MO.logged=true; try{ localStorage.setItem(MKEY,'1'); }catch(e){} }
    if(SKY.flash>.6&&MO.watch>.3){ mothHide(true); return; } }
  if(MO.watch>(MO.pose==='fly'?3:2)||MO.life<=0) mothHide(MO.watch>0); }

/* ================= 2086: the drift ================= */
function deepFrame(dt){
  if((L.ft&1)===0){ const a=W.snowG.attributes.position.array; for(let i=0;i<W.snowB.length;i++){ const b=W.snowB[i]; b[1]-=dt*2*.06*(1+NG.shake*7); if(b[1]<-1) b[1]+=4;
      a[i*3]=b[0]+Math.sin(S.T*.2+b[3])*.15; a[i*3+1]=b[1]; a[i*3+2]=b[2]+Math.cos(S.T*.17+b[3])*.15; } W.snowG.attributes.position.needsUpdate=true;
    const c=W.bioG.attributes.position.array; for(let i=0;i<W.bioB.length;i++){ const b=W.bioB[i]; c[i*3]=b[0]+Math.sin(S.T*.3+b[3])*.4; c[i*3+1]=b[1]+Math.sin(S.T*.21+b[3])*.3; c[i*3+2]=b[2]+Math.cos(S.T*.25+b[3])*.4; }
    W.bioG.attributes.position.needsUpdate=true; }
  W.bioM.opacity=.5+Math.sin(S.T*.7)*.3;
  // seaweed: the current leans it one way, then lets it back
  if((L.ft&1)===0){ const p=W.kelpG.attributes.position.array, B=W.kelpB, H=W.kelpH, PH=W.kelpP, amp=reduce?.08:.22;
    for(let i=0;i<H.length;i++){ const h=H[i], ph=PH[i], s=Math.sin(S.T*.7+ph)+Math.sin(S.T*1.9+ph*1.7)*.3;
      p[i*3]=B[i*3]+s*h*amp; p[i*3+1]=B[i*3+1]; p[i*3+2]=B[i*3+2]+Math.cos(S.T*.5+ph)*h*amp*.5; }
    W.kelpG.attributes.position.needsUpdate=true; }
  // fish: each school follows its loop; each fish keeps its place in it, and bolts from your face if you get close
  const cp=cam.position, T=S.T;
  for(const s of W.schools){ const at=t=>s.inside?[.35*Math.sin(t*.37+s.ph),1.65+.15*Math.sin(t*.5+s.ph),1.8+6*Math.sin(t*s.sp+s.ph)]
      :[s.cx+s.rx*Math.cos(t*s.sp+s.ph),s.cy+.3*Math.sin(t*.4+s.ph),s.cz+s.rz*Math.sin(t*s.sp+s.ph)];
    const a=at(T), b=at(T+.1), hx=b[0]-a[0], hz=b[2]-a[2];
    for(const f of s.fish){ const x=a[0]+f.ox+f.fx, y=a[1]+f.oy+f.fy+Math.sin(T*1.3+f.ph)*.04, z=a[2]+f.oz+f.fz;
      const dx=x-cp.x, dy=y-cp.y, dz=z-cp.z, d=Math.hypot(dx,dy,dz);
      if(d<.9){ const k=(.9-d)*dt*6/Math.max(.05,d); f.fx+=dx*k; f.fy+=dy*k*.5; f.fz+=dz*k; }
      const dec=Math.exp(-dt*.7); f.fx*=dec; f.fy*=dec; f.fz*=dec;
      f.m.position.set(x,y,z); f.m.rotation.y=Math.atan2(-hx,-hz)+Math.sin(T*(d<.9?14:6)+f.ph)*.25; } }
  // the light that gets down here: almost none, and a slow shimmer through it; your torch, now and then catching
  W.hemi.intensity=.12+(reduce?0:Math.sin(S.T*1.3)*.02+Math.sin(S.T*2.9)*.015);
  W.lamp.intensity=.5;
  // the flashlight: steady, with the odd stutter (the water's got into it)
  if(FL.on){ if(!reduce&&Math.random()<.004) FL.stut=.25; FL.stut=Math.max(0,FL.stut-dt); W.flash.intensity=FL.stut>0?(Math.random()<.5?.3:2.6):2.6; } else W.flash.intensity=0; }
const FL={on:false,stut:0,hinted:false};

/* ================= 2086: THE WHITE ONES =================
   Three of them. Every half-minute or so (sooner the longer you stay down), one comes: it swims past in the fog, or two
   do; it hangs out past a window and looks in. Those you can see, a shadow at five metres and more, never closer. Or,
   unseen, it comes to the hull: knocks on it near you, or puts its hands on it and shoves, and the whole wreck rocks and
   sheds its silt. Whatever's on the hull is never drawn; you only know the side it's on by the sound.
   Each visit is a list of keys: a point to be at, how long to take getting there, whether the arms are reaching, which
   way it faces (else it faces where it's going), and what happens on arrival. */
const NG={next:20,shake:0,rk:0,rv:0};
const ngFaceHull=s=>s*Math.PI/2;                   // turned toward the cabin from side s
const ngAt=sc=>HW+.3+2.2*sc;                       // |x| of its centre with its face on the skin
function ngSnd(n,f,k){ const d=Math.hypot(n.px-TP.x,n.pz-TP.z); f(K.panOf(n.px,n.pz),K.vol(d,k||1.4)); }
function ngGo(n,sc,keys,unseen){ n.on=true; n.sc=sc; n.keys=keys; n.k=0; n.t=0; n.reach=0; n.tap=0; n.g.scale.setScalar(sc); n.g.visible=!unseen;
  const a=keys[0], b=keys.find(k=>k.p!==a.p)||keys[1]; [n.px,n.py,n.pz]=a.p; n.g.position.set(...a.p); n.yaw=a.face!=null?a.face:Math.atan2(-(b.p[0]-a.p[0]),-(b.p[2]-a.p[2])); n.g.rotation.y=n.yaw; }
function ngHide(n){ n.on=false; n.g.visible=false; }
function ngFree(){ return W.ngs.filter(n=>!n.on); }
// out of the fog to a spot off side s, then back into it
const ngIn=(s,y,z)=>({p:[s*rr(16,20),y+rr(-1.5,1),z+rr(-10,10)]});
const ngOut=(s,y,z)=>({p:[s*rr(15,19),y-rr(.5,2),z+rr(-12,12)],d:rr(7,10)});
const ngMoan=n=>{ if(Math.random()<.5) ngSnd(n,sndA.moan,1); };
function ngPass(n,delay){ const sc=rr(.75,1.15), dir=Math.random()<.5?-1:1; let keys;
  if(Math.random()<.6){ const s=Math.random()<.5?-1:1, y=rr(.2,2.4), T=rr(26,38), x=rr(5,7.5);   // along a side, past the windows
    keys=[{p:[s*(x+2),y,-dir*24]},{p:[s*rr(4.8,6.5),y+rr(-.4,.4),rr(-2,6)],d:T/2,lin:true,ev:ngMoan},{p:[s*(x+3),y+rr(-1,.6),dir*24],d:T/2,lin:true}]; }
  else { const z=rr(-12,-8), y=rr(-.2,2.6), T=rr(24,34);                                          // across the open front, where the nose was
    keys=[{p:[-dir*22,y,z]},{p:[rr(-1.5,1.5),y+rr(-.4,.4),Z_BREAK-rr(4.5,6.5)],d:T/2,lin:true,ev:ngMoan},{p:[dir*22,y+rr(-1,.6),z-rr(0,3)],d:T/2,lin:true}]; }
  if(delay) keys.splice(1,0,{p:keys[0].p,d:delay});   // waits out in the fog first
  ngGo(n,sc,keys); }
// the window nearest you
function ngWinZ(){ const ws=WINZ.filter(w=>w>Z_BREAK+.8&&w<Z_GALLEY-.4); let best=ws[0]; for(const w of ws) if(Math.abs(w-TP.z)<Math.abs(best-TP.z)) best=w; return best; }
function ngPeer(n){ const sc=rr(.7,.95), s=Math.random()<.5?-1:1, z=ngWinZ(), y=1.05, cx=ngAt(sc), f=ngFaceHull(s);
  const hx=Math.max(cx,rr(5,6))+2.2*sc;    // its face 5-6 m out from the aisle, never nearer
  ngGo(n,sc,[ngIn(s,y,z),{p:[s*(hx+2.2),y+.2,z],d:rr(8,11)},{p:[s*hx,y,z],d:2.6,face:f},
    {p:[s*(hx+.1),y+.05,z+.15],d:rr(4,7),face:f},{p:[s*(hx+2),y-.4,z],d:2.5,face:f},ngOut(s,y,z)]); }
function ngKnock(n){ const sc=rr(.7,.9), s=Math.random()<.5?-1:1, z=ngWinZ()+rr(-.25,.25), y=1, cx=ngAt(sc), f=ngFaceHull(s);
  const tap=k=>({p:[s*cx,y,z],d:k,face:f,reach:1,ev:m=>{ m.tap=1; m.tapA^=1; ngSnd(m,sndA.knock,2.2); NG.shake=Math.max(NG.shake,.18); }});
  const wait=k=>({p:[s*cx,y,z],d:k,face:f,reach:1});
  const knocks=[tap(.1),tap(.55),tap(.55)]; if(Math.random()<.6) knocks.push(wait(rr(2,3.5)),tap(.1),tap(.42),tap(.42),tap(.7));
  ngGo(n,sc,[ngIn(s,y,z),{p:[s*(cx+2.4),y+.2,z],d:rr(8,11)},{p:[s*(cx+.05),y,z],d:2.2,face:f,reach:1},...knocks,wait(rr(2.5,4)),
    {p:[s*(cx+2.2),y-.3,z],d:2.6,face:f},ngOut(s,y,z)],true); }
function ngShove(n){ const sc=rr(.95,1.2), s=Math.random()<.5?-1:1, z=rr(Z_BREAK+1.5,7.5), y=rr(.6,1.3), cx=ngAt(sc), f=ngFaceHull(s);
  const push=()=>[{p:[s*(cx+.4),y,z],d:.9,face:f,reach:1},
    {p:[s*(cx-.05),y,z],d:.35,face:f,reach:1,ev:m=>{ ngSnd(m,sndA.shove,2.4); NG.shake=1; NG.rv-=s*.09; L.creakT=Math.min(L.creakT,1.2); }},
    {p:[s*(cx-.05),y,z],d:rr(1.2,1.8),face:f,reach:1}];
  const keys=[ngIn(s,y,z),{p:[s*(cx+2.6),y+.2,z],d:rr(8,11)},{p:[s*(cx+.4),y,z],d:2,face:f,reach:1},...push()];
  if(Math.random()<.65) keys.push(...push()); if(Math.random()<.25) keys.push(...push());
  keys.push({p:[s*(cx+2.4),y-.3,z],d:2.4,face:f},ngOut(s,y,z)); ngGo(n,sc,keys,true); }
// one at a time on the hull; the others only ever pass
function ngVisit(){ const free=ngFree(); if(!free.length) return; const busy=W.ngs.some(n=>n.on&&n.keys.some(k=>k.face!=null));
  const r=Math.random(), n=free[0];
  if(busy||r<.4){ ngPass(n,0); if(free.length>1&&Math.random()<.35) ngPass(free[1],rr(1.5,5)); }
  else if(r<.6) ngPeer(n); else if(r<.8) ngKnock(n); else ngShove(n); }
function ngFrame(dt){
  if(L.era!==2||S.mode!=='air'){ for(const n of W.ngs) if(n.on) ngHide(n); NG.shake=0; NG.rk=0; NG.rv=0; return; }
  NG.next-=dt*(1+L.stay/300); if(NG.next<=0){ NG.next=rr(22,45); ngVisit(); }
  NG.shake=Math.max(0,NG.shake-dt*.9); NG.rv+=(-NG.rk*7-NG.rv*1.3)*dt; NG.rk+=NG.rv*dt;
  const id=1/Math.max(dt,1e-4);
  for(const n of W.ngs){ if(!n.on) continue; const a=n.keys[n.k], b=n.keys[n.k+1];
    n.t+=dt; const f=clamp(n.t/b.d,0,1), e=b.lin?f:sstep(0,1,f);
    const x=lerp(a.p[0],b.p[0],e), y=lerp(a.p[1],b.p[1],e), z=lerp(a.p[2],b.p[2],e), vx=(x-n.px)*id, vy=(y-n.py)*id, vz=(z-n.pz)*id, sp=Math.hypot(vx,vz);
    n.px=x; n.py=y; n.pz=z; n.g.position.set(x,y,z);
    const ty=b.face!=null?b.face:sp>.05?Math.atan2(-vx,-vz):n.yaw; n.yaw=angLerp(n.yaw,ty,1-Math.exp(-dt*(b.face!=null?3:1.6))); n.g.rotation.y=n.yaw;
    n.body.rotation.x=lerp(n.body.rotation.x,clamp(vy*.25,-.35,.35),1-Math.exp(-dt*2));
    // swimming: the tail beats, the arms sweep back along the body. Reaching: arms out flat to the hull, the tail just holding it there
    n.reach=lerp(n.reach,b.reach?1:0,1-Math.exp(-dt*3)); n.ph+=dt*(.7+sp*.8)*(reduce?.5:1); n.tap=Math.max(0,n.tap-dt*3.5);
    // legs: a slow scissor kick, trailing straight back. Arms: swept back along the body while it swims; hanging limp
    // beneath it when it stops to look; out ahead flat when it's on the hull
    n.sw=lerp(n.sw,clamp(sp/1.2,0,1),1-Math.exp(-dt*1.5)); const kick=(.08+n.sw*.2)*(1-n.reach*.6);
    n.legs.forEach((lg,i)=>{ lg.rotation.x=-Math.PI/2+Math.sin(n.ph+i*Math.PI)*kick; lg.rotation.z=(i?1:-1)*.04; });
    n.arms.forEach((am,i)=>{ const s=i?1:-1, sway=Math.sin(n.ph*.45+i*1.7)*(.08+n.sw*.1);
      am.rotation.x=lerp(lerp(-.2,-1.35,n.sw),1.5,n.reach)+sway+(i===n.tapA?-Math.sin(n.tap*Math.PI)*.4:0); am.rotation.z=s*lerp(.14,.06,n.sw); });
    if(f>=1){ if(b.ev) b.ev(n); n.k++; n.t=0; if(n.k>=n.keys.length-1) ngHide(n); } } }
function toggleFlash(){ if(S.mode!=='air'||L.era!==2) return; FL.on=!FL.on; R.sfx.ui(); }
const flashBtn=K.el('button','aFlash','pbtn'); flashBtn.type='button'; flashBtn.textContent='Flashlight'; flashBtn.hidden=true; flashBtn.addEventListener('click',toggleFlash);

/* ================= TIME ================= */
function applyEra(){ const old=L.era===1;
  for(const [m,a,b] of W.TINT) m.color.setHex(old?a:b);
  W.g55.visible=old; W.g86.visible=!old; W.shellF.visible=old; W.ext55.visible=old; W.ext86.visible=!old;
  for(const p of PAX) p.g.visible=old; W.stew.g.visible=old;
  W.cabinL.forEach(l=>{ l.intensity=old?.9:0; }); W.lamp.intensity=old?0:.5; W.riftL.color.setHex(old?0x9ec8ff:0x9ef0e0);
  FL.on=!old; FL.stut=0; W.flash.intensity=old?0:2.6; flashBtn.hidden=old||!R.touch();
  if(old){ SKY.pal=null; }
  else { W.sc.fog.color.setHex(0x06191c); W.sc.fog.density=.16; W.sc.background.setHex(0x06191c);
    W.hemi.color.setHex(0x4a8a88); W.hemi.groundColor.setHex(0x041012); W.hemi.intensity=.3; setPal(PAL_DEEP); }
  if(MO.on) mothHide(false);
  $('#yearVal').textContent=old?'1955':'2086'; $('#year').classList.toggle('past',old);
  $('#shiftBtn').textContent=old?'Shift to 2086':'Return to 1955'; bedMix(.3); }
// T, or the HUD button: anywhere, any time. Refused where 2086 has no cabin left to stand in.
function shiftTime(){ if(S.mode!=='air') return; const to=L.era===1?2:1;
  if(blockedAt(TP.x,TP.z,to)){ S.glitch=Math.max(S.glitch,reduce?.4:1.3); sndA.fail(); msg('Nothing to stand on in 2086',2); return; }
  L.era=to; if(to===2&&SKY.anc) endAnc(); applyEra(); S.glitch=reduce?.6:1.8; R.sfx.shift(); caption('');
  if(to===2&&!L.seen86){ L.seen86=true; const t='AD 2086 · four thousand metres down.';
    after(1.4,()=>{ if(L.era===2&&S.mode==='air'){ caption(t); after(4.5,()=>{ if(S.cap===t) caption(''); }); } }); }
  if(to===2&&!FL.hinted&&!R.touch()){ FL.hinted=true; after(6.5,()=>{ if(L.era===2&&S.mode==='air') msg('F · flashlight',2.6); }); } }

/* ================= PEOPLE ================= */
function say(id,t){ L.met[id]=true; L.capCD=4.2; caption(t); after(5.2,()=>{ if(S.cap===t) caption(''); }); }
function linesFrame(dt){ if(L.era!==1) return; L.capCD-=dt; if(L.capCD>0) return;
  for(const p of PAX){ if(L.met[p.id]) continue; if(Math.hypot(p.x-TP.x,p.z-TP.z)>1.55) continue;
    const t=(skyState()==='storm'&&p.storm)||(L.sawAnc&&p.anc)||p.l; say(p.id,t); return; } }
// heads turn to follow you while you're near; the ones you've passed look over their shoulders
function headsFrame(dt){ if(L.era!==1) return; const k=1-Math.exp(-dt*4);
  for(const p of PAX){ const dx=TP.x-p.x, dz=TP.z-p.z, d=Math.hypot(dx,dz); let ty=0;
    if(d<3.2) ty=clamp(Math.atan2(-dx,-dz),-1.35,1.35); else ty=Math.sin(S.T*.3+p.z)*.08;
    p.hy=lerp(p.hy,ty,k); p.head.rotation.y=p.hy; p.head.rotation.x=d<3.2?-.05:.04; }
  const s=W.stew; s.ry=lerp(s.ry,Math.atan2(-(TP.x-STEW.x),-(TP.z-STEW.z)),k); s.g.rotation.y=s.ry; }

/* ================= ACTIONS ================= */
function findAct(){ if(S.mode!=='air') return null;
  if(Math.hypot(TP.x-RIFT.x,TP.z-RIFT.z)<1.3) return {t:'Step back through the rift',fn:()=>K.leave()};
  return null; }
const act=K.el('button','aAct','pbtn'); act.type='button'; act.hidden=true; act.addEventListener('click',()=>{ const a=findAct(); if(a) a.fn(); });
const leaveB=K.el('button','aLeave','pbtn'); leaveB.type='button'; leaveB.textContent='Leave flight'; leaveB.hidden=true; leaveB.addEventListener('click',()=>{ if(S.mode==='air') K.leave(); });
{ const st=document.createElement('style'); st.textContent=`#aAct{position:fixed;z-index:12;left:50%;bottom:calc(84px + env(safe-area-inset-bottom));transform:translateX(-50%)}
#aAct[hidden],#aLeave[hidden],#aFlash[hidden]{display:none}
#aCrouch[hidden]{display:none}
#aCrouch{position:fixed;z-index:6;right:calc(16px + env(safe-area-inset-right));bottom:calc(150px + env(safe-area-inset-bottom));padding:10px 14px}
#aCrouch.on{border-color:var(--amber);color:var(--amber)}
#aFlash{position:fixed;z-index:6;right:calc(16px + env(safe-area-inset-right));bottom:calc(204px + env(safe-area-inset-bottom));padding:10px 14px}
#aLeave{position:fixed;z-index:6;right:calc(16px + env(safe-area-inset-right));bottom:calc(96px + env(safe-area-inset-bottom));padding:10px 14px}
body.touch #aAct{bottom:calc(14px + env(safe-area-inset-bottom))}
body.tair #tJump{display:none!important}`; document.head.appendChild(st); }
// crouch: C, or the button on touch. Brings your eyes down level with the windows.
function toggleCrouch(){ if(S.mode!=='air') return; TP.crouch=!TP.crouch; crouchB.classList.toggle('on',TP.crouch); sndA.step(); }
const crouchB=K.el('button','aCrouch','pbtn'); crouchB.type='button'; crouchB.textContent='Crouch'; crouchB.hidden=true; crouchB.addEventListener('click',toggleCrouch);
function drawAct(){ const a=findAct(), t=a?a.t+(R.touch()?'':' (E)'):''; if(act.textContent!==t) act.textContent=t; act.hidden=!a; }

/* ================= LIFECYCLE ================= */
function enter(){ if(!W) build();
  W.sc.add(cam); cam.children.forEach(o=>{ if(o.isLight) o.intensity=0; }); if(W.lamp.parent!==cam) cam.add(W.lamp); if(W.flash.parent!==cam) cam.add(W.flash,W.ftg); K.fallAudioStop(); FL.hinted=false;
  TP.x=SPAWN.x; TP.z=SPAWN.z; TP.acc=0; TP.bob=0; TP.cr=0; TP.crouch=false; TP.hinted=false; P.yaw=0; P.pitch=0;
  crouchB.classList.remove('on'); crouchB.hidden=!R.touch();
  Object.assign(L,{era:1,stay:0,sawAnc:false,seen86:false,capCD:0,met:{},creakT:6,bubT:3,mixT:0,ft:0});
  Object.assign(SKY,{mode:'clear',t:0,dur:rr(70,110),sk:0,anc:false,ancT:0,ancNext:rr(35,60),flash:0,since:99,next:5,big:false,jolt:0,joltNext:9,belt:false,pal:null});
  W.belt.map=W.beltOff; W.belt.needsUpdate=true; W.ancG.visible=false; W.bolt.visible=false;
  MO.on=false; MO.next=rr(20,40); W.moth.visible=false;
  Object.assign(NG,{next:rr(12,25),shake:0,rk:0,rv:0}); for(const n of W.ngs) ngHide(n);
  for(const p of PAX){ p.hy=0; p.head.rotation.set(0,0,0); }
  bedStart(); applyEra(); leaveB.hidden=false;
  document.body.classList.add('twalk','tair'); }
// black, the engines come up, then the galley: somebody's already looking at you
function arrive(){ enter(); S.mode='airEnter'; S.t=0; S.fade=1; fadeTo(1,0,'#000'); R.sfx.shift(); bedMix(2);
  title('Temporal recovery · Rift 86','AD 1955','Flight 914 · Idlewild to Miami · two hours from landing');
  after(3,()=>{ untitle(); fadeTo(0,reduce?.6:2.4); S.mode='air'; S.t=0; });
  after(5.2,()=>{ if(S.mode==='air'&&L.era===1&&!L.met.stew) say('stew','Excuse me, you can’t be back here. ...Were you on the manifest?'); }); }
function walk(dt,inp){
  // the first time you're at a window, a nudge (desktop; touch has the button on screen)
  if(!TP.hinted&&!R.touch()&&!TP.crouch&&Math.abs(TP.z-EXZ)<.3&&Math.abs(TP.x)>.6){ TP.hinted=true; msg('C · crouch to look out',2.6); }
  const m=inp.m; if(m<=.05) return; const wet=L.era===2, run=inp.run&&!TP.crouch, sp=(run?3.2:1.8)*(wet?.6:1)*(1-TP.cr*.5)*Math.min(1,m)/Math.max(1,m), yaw=P.yaw;
  const vx=(-Math.sin(yaw)*inp.f+Math.cos(yaw)*inp.s)*sp*dt, vz=(-Math.cos(yaw)*inp.f-Math.sin(yaw)*inp.s)*sp*dt;
  if(!blockedAt(TP.x+vx,TP.z,L.era)) TP.x+=vx; if(!blockedAt(TP.x,TP.z+vz,L.era)) TP.z+=vz;
  TP.bob+=dt*(run?10:7)*(wet?.6:1)*(1-TP.cr*.3); TP.acc+=Math.hypot(vx,vz); if(TP.acc>(run?1:.75)){ TP.acc=0; sndA.step(); } }
function frame(dt,inp){ L.ft++;
  if(S.mode==='air'){ walk(dt,inp); L.stay+=dt; linesFrame(dt); drawAct();
    if(L.era===2){ L.creakT-=dt; if(L.creakT<=0){ L.creakT=rr(6,13); sndA.creak(); } L.bubT-=dt; if(L.bubT<=0){ L.bubT=rr(3,8); sndA.bubbles(); } } }
  else act.hidden=true;
  if(L.era===1) skyFrame(dt,S.mode==='air'); else deepFrame(dt);
  L.mixT-=dt; if(L.mixT<=0){ L.mixT=.5; bedMix(.8); }
  // the camera: a little turbulence in 1955; in 2086 the cabin lies on its side a few degrees, and the water sways you
  const wet=L.era===2, bob=reduce?0:Math.sin(TP.bob)*(wet?.02:.03); let sx=0, sy=0, roll=0;
  if(!wet&&!reduce){ const k=SKY.sk*.006+SKY.jolt*.035; sy=(Math.sin(S.T*23.1)+Math.sin(S.T*37.7))*k*.5; sx=Math.sin(S.T*17.3)*k*.4; roll=Math.sin(S.T*.35)*.006*(1+SKY.sk*2); }
  if(wet){ roll=.06+(reduce?0:Math.sin(S.T*.4)*.012); sx=reduce?0:Math.sin(S.T*.3)*.03;
    // the white ones, pushing: the wreck shudders, then rocks on the seabed and settles
    const k=NG.shake*NG.shake*(reduce?.012:.05); sx+=(Math.random()-.5)*k; sy+=(Math.random()-.5)*k*.7; roll+=NG.rk*(reduce?.3:1); }
  TP.cr+=clamp((TP.crouch?1:0)-TP.cr,-dt*(reduce?20:4),dt*(reduce?20:4));
  cam.position.set(TP.x+sx,lerp(1.6,1.12,TP.cr)+bob*(1-TP.cr*.5)+sy,TP.z); cam.rotation.set(P.pitch,P.yaw,roll); cam.updateMatrixWorld();
  headsFrame(dt); mothFrame(dt); ngFrame(dt);
  K.shimmer(W.rift,S.T,.8); W.rift.em.opacity=.7+Math.random()*.15; W.riftL.intensity=.9+Math.sin(S.T*9)*.15;
  K.render(W.sc); }
function key(k){ if(S.mode!=='air') return;
  if(k==='t'){ shiftTime(); return; }
  if(k==='e'){ const a=findAct(); if(a) a.fn(); return; }
  if(k==='f'){ if(L.era===2) toggleFlash(); return; }
  if(k==='c'){ toggleCrouch(); return; }
  if(k>='1'&&k<='5') msg('Your records stayed in 1986'); }
function click(){ if(S.mode==='air'&&!R.touch()&&!R.locked()) R.lock(); }
function shiftBtn(){ if(S.mode==='air') shiftTime(); }
function exit(){ bedStop(); caption(''); act.hidden=true; leaveB.hidden=true; flashBtn.hidden=true; crouchB.hidden=true; FL.on=false; TP.crouch=false; TP.cr=0; if(W){ W.lamp.intensity=0; W.flash.intensity=0; if(MO.on) mothHide(false); for(const n of W.ngs) ngHide(n); if(SKY.anc){ SKY.anc=false; W.ancG.visible=false; } }
  document.body.classList.remove('tair'); }

K.register('air',{arrive,frame,key,click,exit,shiftBtn});
K.airDebug={L,SKY,MO,TP,PAX,setSky,spawnMoth:mothSpawn,NG,ngPass:()=>ngPass(ngFree()[0],0),ngPeer:()=>ngPeer(ngFree()[0]),ngKnock:()=>ngKnock(ngFree()[0]),ngShove:()=>ngShove(ngFree()[0]),shiftTime,startAnc,get W(){ return W; }};
})(window);
