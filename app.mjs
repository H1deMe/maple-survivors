import {Game,rulesFrom,WEAPONS,PASSIVES,JOBS,STAGES,stageById,RUN_TIME,MAX_WEAPONS,MAX_PASSIVES,WEAPON_MAX,PASSIVE_MAX,weaponStats,upgradeText} from './engine.mjs';
import {Field} from './field.mjs';
import {loadNativeFieldArt} from './native-field-art.mjs';
import {propBounds,intersects} from './field-geometry.mjs';
import {Wardrobe,DEFAULT_LOOK,FOOT_X,FOOT_Y} from './avatar.mjs';
import {Dresser} from './dresser.mjs';
const $=id=>document.getElementById(id);
const canvas=$('game'),ctx=canvas.getContext('2d'),portrait=$('portrait'),pctx=portrait.getContext('2d');
const LOOK_KEY='maple-survivors-look',BEST_KEY='maple-survivors-best',SOUND_KEY='maple-survivors-sound',STAGE_KEY='maple-survivors-stages';
let combat,field,wardrobe,dresser,look,game,rules;
let combatImages=[],hero={},width=900,height=600,lastTime=0,clock=0,lastMode='',toastUntil=0,hudKey='';
let camera={x:0,y:0},levelFx=null,bgm={},music=null,audio=null,sound=true,lastPickup=0;
const keys=new Set(),touch={x:0,y:0};
// Best runs per stage ({lith:{...},henesys:{...}}); an older single record was a Henesys run.
let best={};try{best=JSON.parse(localStorage.getItem(BEST_KEY))??{};if('time' in best)best={henesys:best};}catch{best={};}
// Cleared stage ids. Stage 1 is always open; each clear opens the next stage.
let cleared=[];try{cleared=JSON.parse(localStorage.getItem(STAGE_KEY))??[];}catch{}
const unlocked=i=>i===0||cleared.includes(STAGES[i-1].id);
let stageId=STAGES[[...STAGES.keys()].filter(unlocked).at(-1)].id;
try{sound=localStorage.getItem(SOUND_KEY)!=='off';}catch{}
const timeLabel=n=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(Math.floor(n%60)).padStart(2,'0')}`;
const bestLabel=b=>!b?'첫 도전을 기다리고 있어요':b.won?`클리어 · ${b.kills}마리 처치`:`${timeLabel(b.time)} 생존`;
// Korean particles: josa('킹크랑','을','를') → 킹크랑을.
const josa=(w,a,b)=>{const c=w.charCodeAt(w.length-1)-0xac00;return w+(c>=0&&c<11172&&c%28?a:b);};
const bossLine=st=>st.bosses.map(b=>`${timeLabel(b.at).replace(/^0/,'')} ${combat.mobs[b.id].name}`).join(' · ');
$('modal').innerHTML='<div class="seal">✳</div><span class="eyebrow">GETTING READY</span><h2 id="modal-title">들판으로 가는 중</h2><p class="intro">몬스터와 스킬, 들판을 불러오고 있어요.</p>';

// ---------- loading ----------
const loadImage=src=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error(`이미지 불러오기 실패: ${src}`));i.src=src;});
const json=async src=>{const r=await fetch(src);if(!r.ok)throw new Error(`${src}를 읽지 못했습니다 (${r.status}).`);return r.json();};
function frameAt(frames,time,loop=true){if(!frames?.length)return null;const total=frames.reduce((s,f)=>s+Math.max(1,f.delay),0);let t=loop?((time%total)+total)%total:Math.min(time,total-1);for(const f of frames){t-=Math.max(1,f.delay);if(t<0)return f;}return frames[frames.length-1];}
const framesLength=frames=>frames.reduce((s,f)=>s+f.delay,0);
function loadLook(){
  try{const saved=JSON.parse(localStorage.getItem(LOOK_KEY));if(saved&&wardrobe.parts(saved).length>2&&wardrobe.catalog.skins.some(s=>s.id===saved.skin))return saved;}catch{}
  return {...DEFAULT_LOOK.m};
}
async function dressHero(){
  const [stand,walk]=await Promise.all([wardrobe.frames(look,'stand'),wardrobe.frames(look,'walk')]);
  hero={stand,walk};$('char-name').textContent=look.name||'모험가';$('portrait-name').textContent=look.name||'초보 모험가';
}

// ---------- sound ----------
const buffers=new Map();
function ensureAudio(){if(!audio){audio=new(window.AudioContext||window.webkitAudioContext)();}if(audio.state==='suspended')audio.resume();return audio;}
async function play(src,volume=.5){
  if(!sound||!src)return;const a=ensureAudio();
  if(!buffers.has(src))buffers.set(src,fetch(src).then(r=>r.arrayBuffer()).then(b=>a.decodeAudioData(b)).catch(()=>null));
  const buffer=await buffers.get(src);if(!buffer)return;
  const node=a.createBufferSource(),gain=a.createGain();node.buffer=buffer;gain.gain.value=volume;node.connect(gain);gain.connect(a.destination);node.start();
}
const BGM_NAME={field:'Go Picnic',harbor:'Above The Treetops',ellinia:'When The Morning Comes',boss:'Where The Barlog From'};
function setMusic(kind){const next=bgm[kind];if(music===next)return;if(music)music.pause();music=next;if(music)music.currentTime=0;syncMusic();}
function syncMusic(){
  if(!music)return;const want=sound&&game&&game.mode!=='menu';
  if(want&&music.paused)music.play().catch(()=>{});else if(!want&&!music.paused)music.pause();
  music.volume=['paused','upgrade','reward'].includes(game?.mode)?.15:.4;
}
function soundLabel(){$('sound').innerHTML=`♪ <span>소리 ${sound?'켜짐':'꺼짐'}</span>`;$('sound').setAttribute('aria-label',`소리 ${sound?'끄기':'켜기'}`);$('sound').title=`배경음악·효과음 ${sound?'끄기':'켜기'}`;}
$('sound').onclick=()=>{sound=!sound;try{localStorage.setItem(SOUND_KEY,sound?'on':'off');}catch{}if(sound)ensureAudio();soundLabel();syncMusic();};soundLabel();

// ---------- drawing helpers ----------
function drawImage(list,images,index,x,y,flip=false,alpha=1){
  const meta=list[index],image=images[index];if(!meta||!image)return;
  if(alpha<1){ctx.save();ctx.globalAlpha=alpha;}
  if(flip){ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.scale(-1,1);ctx.drawImage(image,-meta.origin[0],-meta.origin[1]);ctx.restore();}
  else ctx.drawImage(image,Math.round(x-meta.origin[0]),Math.round(y-meta.origin[1]));
  if(alpha<1)ctx.restore();
}
const fxDraw=(i,x,y,flip,alpha)=>drawImage(combat.images,combatImages,i,x,y,flip,alpha);
function shadow(x,y,w,alpha=.22){ctx.fillStyle=`rgba(30,60,20,${alpha})`;ctx.beginPath();ctx.ellipse(Math.round(x),Math.round(y),w,w*.32,0,0,Math.PI*2);ctx.fill();}
function nameTag(text,x,y,color='#fff',bg='#000a'){
  ctx.font='12px "Malgun Gothic",sans-serif';ctx.textAlign='center';const w=Math.ceil(ctx.measureText(text).width)+8;
  ctx.fillStyle=bg;ctx.fillRect(Math.round(x-w/2),Math.round(y),w,16);ctx.fillStyle=color;ctx.fillText(text,Math.round(x),Math.round(y+12));
}

// ---------- world ----------
function mobFrame(m){
  const r=combat.mobs[m.type].actions,walk=r.move??r.fly??r.stand;
  if(m.dying)return frameAt(r.die1,m.dying*1000,false);
  if(m.pat&&r.attack1)return frameAt(r.attack1,m.pat.t*1000,false);   // boss pattern: the client attack animation
  if(m.flash>0&&r.hit1)return r.hit1[0];
  return frameAt(walk,m.anim);
}
function drawMob(m,x,y){
  const f=mobFrame(m);if(!f)return;
  if(!m.dying)shadow(x,y,m.radius*.9);
  // Frozen monsters (Ice line) turn icy blue.
  if(m.frozen>0&&!m.stun&&!m.dying)ctx.filter='saturate(.35) brightness(1.15) sepia(.35) hue-rotate(160deg)';
  else if(m.weak>0&&!m.dying)ctx.filter='saturate(1.3) brightness(.85) sepia(.4) hue-rotate(230deg)';   // threatened (Page)
  const lift=m.flying?14+Math.sin(m.anim/220)*4:0,alpha=m.dying?Math.max(0,1-m.dying/1.2):1;
  if(m.scale&&m.scale!==1){ctx.save();ctx.translate(x,y);ctx.scale(m.scale,m.scale);fxDraw(f.img,0,-lift,m.face>0,alpha);ctx.restore();}   // enlarged bosses
  else fxDraw(f.img,x,y-lift,m.face>0,alpha);
  ctx.filter='none';
  if(m.boss&&!m.dying)nameTag(combat.mobs[m.type].name,x,y+4,'#ffde45');
  if(m.stun&&m.frozen>0&&!m.dying)drawStun(x,y-(m.height??40)*(m.scale??1)-8);
}
// Stunned monsters (Shout, Charge Blow): little stars circling over the head.
function drawStun(x,y){
  ctx.save();ctx.fillStyle='#ffe35a';ctx.strokeStyle='#7a5200';ctx.lineWidth=1;
  for(let i=0;i<3;i++){const a=clock/260+i*Math.PI*2/3,sx=x+Math.cos(a)*12,sy=y+Math.sin(a)*4;
    ctx.beginPath();for(let k=0;k<10;k++){const r=k%2?2:5,b=k*Math.PI/5-Math.PI/2;ctx.lineTo(sx+Math.cos(b)*r,sy+Math.sin(b)*r);}ctx.closePath();ctx.fill();ctx.stroke();}
  ctx.restore();
}
function drawHero(x,y){
  const p=game.player;shadow(x,y,16,.28);
  if(!(p.invincible>0&&Math.floor(clock/70)%2)){
    const f=frameAt(p.moving?hero.walk:hero.stand,clock);
    if(f){ctx.save();ctx.translate(Math.round(x),Math.round(y));if(p.face>0)ctx.scale(-1,1);ctx.drawImage(f.canvas,-FOOT_X,-FOOT_Y);ctx.restore();}
  }
  // Survivors-style health bar under the character.
  const w=40,top=Math.round(y+6);ctx.fillStyle='#1d1d1d';ctx.fillRect(Math.round(x-w/2-1),top-1,w+2,6);
  ctx.fillStyle='#e8433d';ctx.fillRect(Math.round(x-w/2),top,Math.round(w*p.hp/game.maxHp),4);
}
// Original map assemblies cover all frames with padding and an explicit ground anchor.
function drawProp(o,x,y,alpha=1){
  const f=frameAt(o.prop.frames,clock+o.phase);if(!f)return;
  if(alpha<1){ctx.save();ctx.globalAlpha=alpha;}
  if(o.flip){ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.scale(-1,1);ctx.drawImage(f.canvas,-f.ox,-f.oy);ctx.restore();}
  else ctx.drawImage(f.canvas,Math.round(x-f.ox),Math.round(y-f.oy));
  if(alpha<1)ctx.restore();
}
function drawDrop(d,x,y){
  if(d.kind==='potion'){const img=combat.potions[d.item];shadow(x,y,9,.2);fxDraw(img,x,y-6+Math.sin(clock/200+d.id)*2);return;}
  const tier=d.value<10?0:d.value<40?1:d.value<150?2:3,f=frameAt(combat.meso[tier],clock+d.id*37);if(!f)return;
  const meta=combat.images[f.img];shadow(x,y,7,.18);fxDraw(f.img,x+meta.origin[0]-meta.w/2,y+meta.origin[1]-meta.h-2);
}
// Damage numbers drawn with the client's digit fonts: the first digit uses the large set.
function drawNumber(n,x,y){
  const alpha=n.t>.55?Math.max(0,1-(n.t-.55)/.45):1;
  if(n.kind==='heal'){ctx.save();ctx.globalAlpha=alpha;ctx.font='bold 14px "Malgun Gothic",sans-serif';ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='#1d4a22';ctx.strokeText(`+${n.value}`,x,y);ctx.fillStyle='#8cf08a';ctx.fillText(`+${n.value}`,x,y);ctx.restore();return;}
  if(n.kind==='miss'){ctx.save();ctx.globalAlpha=alpha;ctx.font='bold 15px "Malgun Gothic",sans-serif';ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='#3a2a6a';ctx.strokeText('MISS',x,y);ctx.fillStyle='#d8c8ff';ctx.fillText('MISS',x,y);ctx.restore();return;}
  const fonts=n.kind==='taken'?['NoViolet1','NoViolet0']:n.crit?['NoCri1','NoCri0']:['NoRed1','NoRed0'];
  const digits=String(n.value).split('').map(Number),imgs=digits.map((d,i)=>combat.digits[fonts[i?1:0]]?.[d]);
  const widths=imgs.map(i=>combat.images[i]?.w??20),total=widths.reduce((s,w)=>s+w-6,6);
  let cx=x-total/2;
  imgs.forEach((img,i)=>{const meta=combat.images[img];if(!meta)return;ctx.globalAlpha=alpha;ctx.drawImage(combatImages[img],Math.round(cx),Math.round(y-meta.h-(i?0:4)));ctx.globalAlpha=1;cx+=widths[i]-6;});
}
function drawProjectile(b,x,y){
  const w={kind:b.kind??WEAPONS[b.weapon].kind};
  if(w.kind==='shell'){const img=combat.shells[b.tier];ctx.save();ctx.translate(Math.round(x),Math.round(y));if(b.vx>0)ctx.scale(-1,1);fxDraw(img,0,0);ctx.restore();return;}
  const frames=w.kind==='star'?combat.stars:combat.skills[b.skill??b.weapon]?.ball;const f=frameAt(frames,clock);if(!f)return;
  // Client projectiles face left; rotate them along their flight.
  ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.rotate((b.angle??0)+Math.PI);if(w.kind==='star'||b.spin)ctx.rotate(clock/40);fxDraw(f.img,0,0);ctx.restore();
}
// Thunder Spear's lance and Chain Lightning's arcs: drawn bolts (the client draws these with its own engine).
function drawBeam(e,ox,oy){
  const k=Math.max(0,1-e.t/e.life),x1=e.x+ox,y1=e.y+oy,x2=e.x2+ox,y2=e.y2+oy;
  ctx.save();ctx.globalCompositeOperation='lighter';ctx.lineCap='round';
  const pal=e.tint==='rush'?['rgba(255,150,70,.22)','rgba(255,205,140,.5)','rgba(255,250,230,.9)']:e.tint==='fire'?['rgba(255,80,30,.28)','rgba(255,170,60,.6)','rgba(255,240,180,.95)']:['rgba(110,170,255,.25)','rgba(170,215,255,.6)','rgba(255,255,255,.95)'];
  for(const [w,c]of[[e.width,pal[0]],[e.width*.45,pal[1]],[e.width*.15,pal[2]]]){ctx.globalAlpha=k;ctx.strokeStyle=c;ctx.lineWidth=w*k+1;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
  ctx.restore();
}
// Boss pattern warnings (red, filling up until the attack lands), the slam shockwave and boss bullets.
function drawWarn(e,ox,oy){
  const k=Math.min(1,e.t/e.life),x=e.x+ox,y=e.y+oy;
  ctx.save();
  if(e.shape==='line'){
    const a=Math.atan2(e.y2-e.y,e.x2-e.x),len=Math.hypot(e.x2-e.x,e.y2-e.y);ctx.translate(x,y-10);ctx.rotate(a);
    ctx.fillStyle='rgba(230,40,40,.18)';ctx.fillRect(0,-e.width/2,len,e.width);
    ctx.fillStyle='rgba(255,70,60,.35)';ctx.fillRect(0,-e.width/2,len*k,e.width);
    ctx.strokeStyle='rgba(255,90,80,.85)';ctx.lineWidth=2;ctx.strokeRect(0,-e.width/2,len,e.width);
  }else if(e.shape==='ring'){
    ctx.fillStyle='rgba(230,40,40,.16)';ctx.beginPath();ctx.ellipse(x,y-8,e.r,e.r*.62,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(255,70,60,.32)';ctx.beginPath();ctx.ellipse(x,y-8,e.r*k,e.r*.62*k,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='rgba(255,90,80,.9)';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,y-8,e.r,e.r*.62,0,0,Math.PI*2);ctx.stroke();
  }else if(e.shape==='lanes'){     // where the boss bullets will fly
    ctx.translate(x,y);
    for(const a of e.angles){
      ctx.save();ctx.rotate(a);
      const g=ctx.createLinearGradient(0,0,e.len,0);g.addColorStop(0,'rgba(255,60,50,.42)');g.addColorStop(1,'rgba(255,60,50,0)');
      ctx.fillStyle=g;ctx.fillRect(0,-e.width/2,e.len,e.width);
      ctx.fillStyle='rgba(255,90,80,.55)';ctx.fillRect(0,-e.width/2,e.len*k,3);ctx.fillRect(0,e.width/2-3,e.len*k,3);
      ctx.restore();
    }
  }else{
    const g=ctx.createRadialGradient(x,y,2,x,y,e.r*(1+k*.4));g.addColorStop(0,'rgba(255,255,255,.75)');g.addColorStop(.4,e.color);g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.globalCompositeOperation='lighter';ctx.globalAlpha=.35+.4*k;ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,e.r*(1+k*.4),0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
}
function drawShock(e,ox,oy){
  const k=e.t/e.life,x=e.x+ox,y=e.y+oy,r=e.r*(.6+k*.5);
  ctx.save();ctx.globalAlpha=Math.max(0,1-k);ctx.strokeStyle=e.color??'#ffe0a0';ctx.lineWidth=8*(1-k)+2;
  ctx.beginPath();ctx.ellipse(x,y-8,r,r*.62,0,0,Math.PI*2);ctx.stroke();ctx.restore();
}
function drawHazard(h,x,y){
  ctx.save();ctx.globalCompositeOperation='lighter';
  const g=ctx.createRadialGradient(x,y,1,x,y,h.r*1.9);g.addColorStop(0,'#ffffff');g.addColorStop(.35,h.color);g.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,h.r*1.9,0,Math.PI*2);ctx.fill();
  ctx.globalCompositeOperation='source-over';ctx.strokeStyle='rgba(60,0,0,.75)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,h.r,0,Math.PI*2);ctx.stroke();ctx.restore();
}
// Arrow Rain / Arrow Eruption: a soft ring on the ground where the arrows land.
function drawZone(e,ox,oy){
  const k=Math.max(0,1-e.t/e.life),x=e.x+ox,y=e.y+oy;
  ctx.save();ctx.globalAlpha=.55*k;ctx.fillStyle='rgba(255,236,170,.35)';ctx.strokeStyle='#fff3c4';ctx.lineWidth=2;
  ctx.beginPath();ctx.ellipse(x,y-6,e.r,e.r*.6,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();
}
function drawChain(e,ox,oy){
  const k=Math.max(0,1-e.t/e.life),pts=e.points;let seed=Math.floor(clock/45);const r=()=>((seed=seed*16807%2147483647)/2147483647)-.5;
  ctx.save();ctx.globalCompositeOperation='lighter';ctx.lineJoin='round';
  for(const [w,c]of[[9,'rgba(120,170,255,.35)'],[3,'rgba(235,245,255,.95)']]){
    ctx.globalAlpha=k;ctx.strokeStyle=c;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(pts[0].x+ox,pts[0].y+oy);
    for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i];for(let j=1;j<=4;j++){const t=j/4,jit=j<4?18:0;ctx.lineTo(a.x+(b.x-a.x)*t+ox+r()*jit,a.y+(b.y-a.y)*t+oy+r()*jit);}}
    ctx.stroke();}
  ctx.restore();
}
function drawEffects(ox,oy){
  const p=game.player;
  for(const e of game.effects){if(e.t<0)continue;const ms=e.t*1000;
    if(e.kind==='skill'){const fr=combat.skills[e.skill]?.effect;if(!fr||ms>framesLength(fr))continue;
      const x=(e.follow?p.x:e.x)+ox,y=(e.follow?p.y:e.y)+oy;
      if(e.radius){ctx.save();ctx.globalAlpha=Math.max(0,.35-e.t*.5);ctx.strokeStyle='#fff6c8';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(x,y-10,e.radius,e.radius*.7,0,0,Math.PI*2);ctx.stroke();ctx.restore();}
      fxDraw(frameAt(fr,ms,false).img,x,y,e.face>0);}
    else if(e.kind==='beam')drawBeam(e,ox,oy);
    else if(e.kind==='chain')drawChain(e,ox,oy);
    else if(e.kind==='zone')drawZone(e,ox,oy);
    else if(e.kind==='warn')drawWarn(e,ox,oy);
    else if(e.kind==='shock')drawShock(e,ox,oy);
    else if(e.kind==='hit'){const fr=combat.skills[e.skill]?.hit??combat.sparks.mace1;if(!fr||ms>framesLength(fr))continue;fxDraw(frameAt(fr,ms,false).img,e.x+ox,e.y+oy,e.face>0);}
  }
  for(const b of game.projectiles)if(!(b.delay>0))drawProjectile(b,b.x+ox,b.y+oy);
  for(const h of game.hazards)if(!(h.delay>0))drawHazard(h,h.x+ox,h.y+oy);
  if(levelFx!==null){const t=clock-levelFx,fr=combat.levelUp;if(t>framesLength(fr))levelFx=null;else fxDraw(frameAt(fr,t,false).img,p.x+ox,p.y+oy);}
  for(const n of game.numbers)drawNumber(n,n.x+ox,n.y+oy-n.t*34);
}
// An arrow on the screen edge points at a boss that is out of view.
function drawBossPointer(ox,oy){
  const b=game.boss;if(!b||b.dying)return;const x=b.x+ox,y=b.y-40+oy;if(x>0&&x<width&&y>40&&y<height-60)return;
  const cx=width/2,cy=height/2,a=Math.atan2(y-cy,x-cx),r=Math.min(width/2-30,(height-110)/2);
  ctx.save();ctx.translate(cx+Math.cos(a)*r,cy+Math.sin(a)*r);ctx.rotate(a);ctx.fillStyle='#ff5a3c';ctx.strokeStyle='#fff';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(14,0);ctx.lineTo(-8,-10);ctx.lineTo(-8,10);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
}
function draw(){
  const p=game.player;camera.x=Math.round(p.x);camera.y=Math.round(p.y-30);
  const ox=Math.round(width/2-camera.x),oy=Math.round(height/2-camera.y);
  ctx.imageSmoothingEnabled=false;
  field.drawGround(ctx,camera.x,camera.y,width,height);
  for(const d of game.drops){const x=d.x+ox,y=d.y+oy;if(x>-30&&x<width+30&&y>-30&&y<height+30)drawDrop(d,x,y);}
  // Props, monsters and the hero sorted by their feet.
  const view={left:camera.x-width/2,right:camera.x+width/2,top:camera.y-height/2,bottom:camera.y+height/2},margin=field.extents;
  const left=view.left-margin.right-20,right=view.right+margin.left+20,top=view.top-margin.down-60,bottom=view.bottom+margin.up+60;
  const items=[],critters=[];
  for(const o of field.propsIn(left,top,right,bottom)){if(!intersects(propBounds(o),{left:view.left-20,right:view.right+20,top:view.top-60,bottom:view.bottom+60}))continue;(o.kind==='critter'?critters:items).push({y:o.y,prop:o});}
  for(const m of game.mobs){const x=m.x+ox,y=m.y+oy;if(x>-120&&x<width+120&&y>-40&&y<height+200)items.push({y:m.y,mob:m});}
  items.push({y:p.y,hero:true});items.sort((a,b)=>a.y-b.y);
  for(const it of items){
    if(it.hero)drawHero(p.x+ox,p.y+oy);
    else if(it.mob)drawMob(it.mob,it.mob.x+ox,it.mob.y+oy);
    else{const o=it.prop,meta=o.prop;
      // Trees and big bushes fade when the hero walks behind them.
      const behind=(o.kind==='big'||o.kind==='landmark')&&meta.h>70&&p.y<o.y&&p.y>o.y-meta.h*.9&&Math.abs(p.x-o.x)<meta.w*.45;
      drawProp(o,o.x+ox,o.y+oy,behind?.45:1);}
  }
  drawMir(ox,oy);
  for(const o of critters)drawProp(o,o.x+ox+Math.sin((clock+o.phase)/900)*14,o.y+oy-40+Math.sin((clock+o.phase)/350)*6);
  drawEffects(ox,oy);drawBossPointer(ox,oy);
}

// Evan's dragon Mir follows the hero while Magic Missile is equipped. It grows with the job (one client dragon image
// per job) and plays the client action of each cast skill (its animation is the skill's visual).
const MIR_STAGE=['2200','2211','2214','2217'],mir={x:0,y:0,act:null,at:0,seen:false};
function drawMir(ox,oy){
  const p=game.player;if(!game.weapons['22001001']||!combat.dragon){mir.seen=false;return;}
  const stage=MIR_STAGE[game.jobs['22001001']?.tier??0],set=combat.dragon[stage]??combat.dragon['2200'];if(!set)return;
  const tx=p.x-p.face*42,ty=p.y-6;
  if(!mir.seen){mir.x=tx;mir.y=ty;mir.seen=true;}else{mir.x+=(tx-mir.x)*.12;mir.y+=(ty-mir.y)*.12;}
  let fr=mir.act&&set[mir.act],t=clock-mir.at;
  if(!fr||t>framesLength(fr)){mir.act=null;fr=Math.hypot(tx-mir.x,ty-mir.y)>6?set.move??set.stand:set.stand;t=clock;}
  shadow(mir.x+ox,mir.y+oy,18,.22);
  fxDraw(frameAt(fr,t,!mir.act).img,Math.round(mir.x+ox),Math.round(mir.y+oy),p.face>0);
}

// ---------- HUD ----------
// A weapon slot shows its current (advanced) client skill.
const slotName=id=>game.jobs[id]?combat.skills[game.skillOf(id)].name:WEAPONS[id].name;
const slotIcon=id=>iconOf(WEAPONS[id]?game.skillOf(id):id);
const JOB_NAME=['','2차','3차','4차'];
// "3차 메이지(썬,콜)": the advancement and the client's job name at it.
const jobLabel=(id,j)=>`${JOB_NAME[j.tier]} ${JOBS[id]?.[j.branch]?.names?.[j.tier-1]??''}`.trim();
const iconOf=id=>combat.images[combat.skills[id]?.icon??combat.passiveIcons[id]?.icon]?.src;
const passiveName=id=>PASSIVES[id].name;
function ui(){
  const p=game.player,maxHp=game.maxHp;
  $('level').textContent=p.level;
  $('hp-fill').style.width=`${p.hp/maxHp*100}%`;$('hp-text').textContent=`${Math.ceil(p.hp)} / ${maxHp}`;
  const need=game.expNeed,exp=Math.floor(p.exp);$('exp-fill').style.width=`${Math.min(100,p.exp/need*100)}%`;$('exp-text').textContent=`${exp} / ${need} [${(p.exp/need*100).toFixed(2)}%]`;
  $('timer').textContent=timeLabel(game.time);$('kills').textContent=game.kills;
  const next=game.bosses[game.bossIndex];
  $('next-event').textContent=game.boss?`보스: ${combat.mobs[game.boss.type].name}`:next?`${timeLabel(next.at).replace(/^0/,'')} ${combat.mobs[next.id].name}`:'최종 보스를 쓰러뜨리세요';
  const progress=Math.min(1,game.time/RUN_TIME);$('progress-label').textContent=`${timeLabel(game.time)} / 10:00`;$('progress-fill').style.width=`${progress*100}%`;
  $('boss-bar').classList.toggle('hidden',!game.boss);
  if(game.boss){$('boss-name').textContent=combat.mobs[game.boss.type].name;$('boss-fill').style.width=`${Math.max(0,game.boss.hp/game.boss.maxHp*100)}%`;}
  const key=JSON.stringify([game.weapons,game.passives,game.jobs]);if(key!==hudKey){hudKey=key;renderLoadout();}
  $('pause').disabled=!['playing','paused'].includes(game.mode);$('pause').textContent=game.mode==='paused'?'▶':'Ⅱ';
  if(game.mode!==lastMode){lastMode=game.mode;showOverlay();syncMusic();}
}
function renderLoadout(){
  const w=Object.entries(game.weapons),ps=Object.entries(game.passives);
  const slot=(id,lv,cls='')=>id?`<div class="slot ${cls}${game.jobs[id]?' advanced':''}" title="${WEAPONS[id]?slotName(id):passiveName(id)} Lv.${lv}"><img src="${slotIcon(id)}" alt=""><em>${lv}</em></div>`:`<div class="slot ${cls} empty"></div>`;
  $('loadout-hud').innerHTML=`<div class="row">${Array.from({length:MAX_WEAPONS},(_,i)=>slot(w[i]?.[0],w[i]?.[1])).join('')}</div><div class="row">${Array.from({length:MAX_PASSIVES},(_,i)=>slot(ps[i]?.[0],ps[i]?.[1],'passive')).join('')}</div>`;
  $('skill-count').textContent=`${w.length} / ${MAX_WEAPONS}`;
  $('skill-list').innerHTML=w.map(([id,lv])=>{const s=game.stats(id),j=game.jobs[id];return `<div class="skill"><img src="${slotIcon(id)}" alt=""><div><b>${slotName(id)}${j?` <i class="job-tag">${jobLabel(id,j)}</i>`:''}</b><small>피해 ${s.damage}${s.targets?` · 최대 ${s.targets}마리`:s.count>1?` · ${s.count}발`:''} · ${s.cooldown.toFixed(2)}초</small></div><span>LV.<b>${lv}</b></span></div>`;}).join('');
  $('passive-list').innerHTML=ps.map(([id,lv])=>`<div class="mini-skill"><span><img src="${iconOf(id)}" alt=""> ${passiveName(id)}</span><b>LV.${lv}</b></div>`).join('');
  $('portrait-stats').textContent=`공격력 +${Math.round(game.stat('might')*100)}% · 이동 ${Math.round(100+game.stat('speed')*100)}%`;
}
function choiceCard(c){
  if(c.type==='advance'){const line=JOBS[c.id][c.branch],t=line.tiers[c.tier-1],sk=combat.skills[t.skill];
    return {icon:iconOf(t.skill),title:sk.name,text:`${slotName(c.id)} → ${sk.name}. ${t.desc}`,tag:`${JOB_NAME[c.tier]} 전직 · ${line.names?.[c.tier-1]??line.job}`,advance:true};}
  if(c.type==='weapon'){const w=WEAPONS[c.id];return {icon:iconOf(c.id),title:w.name,text:c.level===1?w.desc:upgradeText(c.id,c.level),tag:c.level===1?`새 스킬 · ${w.cls}`:`Lv.${c.level-1} → ${c.level}${c.level===WEAPON_MAX?' (MAX)':''}`};}
  if(c.type==='passive'){const s=PASSIVES[c.id];return {icon:iconOf(c.id),title:s.name,text:s.text(s.per*c.level),tag:c.level===1?'새 패시브':`Lv.${c.level-1} → ${c.level}${c.level===PASSIVE_MAX?' (MAX)':''}`};}
  if(c.type==='heal')return {icon:combat.images[combat.potions['02000000']].src,title:'빨간 포션',text:'HP를 30 회복합니다.',tag:'회복'};
  return {icon:combat.images[combat.meso[3][0].img].src,title:'메소 주머니',text:'모든 스킬을 다 익혔어요. 다음 레벨을 노려 보세요.',tag:'보너스'};
}
function showOverlay(){
  const overlay=$('overlay'),modal=$('modal');overlay.classList.toggle('hidden',game.mode==='playing');modal.className='modal';
  if(game.mode==='playing')return;
  if(game.mode==='menu'){
    modal.classList.add('title');
    const icon=id=>{const a=combat.mobs[id].actions;return combat.images[(a.stand??a.move??a.fly)[0].img].src;};
    const card=(st,i)=>{const open=unlocked(i),boss=st.bosses.at(-1).id,b=best[st.id];
      return `<button class="stage-card${st.id===stageId?' selected':''}" data-stage="${st.id}" ${open?'':'disabled'} aria-pressed="${st.id===stageId}"><img src="${icon(boss)}" alt=""><span>STAGE ${st.num}</span><b>${st.name}</b><small>${open?(cleared.includes(st.id)?'클리어 ✓':b?`최고 ${timeLabel(b.time)}`:`최종 보스 ${combat.mobs[boss].name}`):`🔒 ${STAGES[i-1].name} 클리어 시 열림`}</small></button>`;};
    modal.innerHTML=`<span class="eyebrow">KMS 1.2.65 · 1.2.95 · MAPLE SURVIVORS</span><h2 id="modal-title" class="logo"><small>MAPLE</small>SURVIVORS<span>메이플 서바이버</span></h2><p class="intro">끝없이 몰려오는 몬스터 속에서 10분을 버티세요.<br>스킬은 자동으로 나가고, 메소를 주우면 성장해요.</p><div class="stage-cards">${STAGES.map(card).join('')}</div><nav class="title-menu"><button class="primary" id="start">${stageById(stageId).name} 시작 →</button><button class="secondary" id="customize">캐릭터 꾸미기</button></nav><p class="hint">Enter 게임 시작 · ←→ 스테이지 · C 캐릭터 꾸미기</p><p class="credit">제작 <b>S0rryMyBad</b></p>`;
    modal.querySelectorAll('[data-stage]').forEach(b=>b.onclick=()=>pickStage(b.dataset.stage));
    $('start').onclick=()=>start();$('customize').onclick=openDresser;$('start').focus({preventScroll:true});
  }else if(game.mode==='upgrade'||game.mode==='reward'){
    const reward=game.mode==='reward';modal.classList.add('upgrade');
    modal.innerHTML=`<div class="seal">${reward?'♛':'✦'}</div><span class="eyebrow">${reward?'BOSS DEFEATED · REWARD':`LEVEL ${game.player.level} · LEVEL UP!`}</span><h2 id="modal-title">${reward?'보스를 물리쳤어요!':'무엇을 익힐까요?'}</h2><p class="intro">${reward?(game.choices.some(c=>c.type==='advance')?'전직할 수 있어요! 하나를 고르세요. HP도 모두 회복돼요.':'보상을 하나 고르세요. HP도 모두 회복돼요.'):'새 스킬, 스킬 레벨, 패시브 중 하나를 고르세요.'}</p><div class="choices">${game.choices.map((c,i)=>{const d=choiceCard(c);return `<button class="choice${d.advance?' advance':''}" data-choice="${i}"><img class="choice-icon" src="${d.icon}" alt=""><strong>${d.title}</strong><p>${d.text}</p><span class="choice-tag">${d.tag}</span><span class="choice-key">${i+1}</span></button>`;}).join('')}</div><p class="hint">선택하는 동안 전투가 멈춥니다 · 숫자 1 / 2 / 3</p>`;
    modal.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>choose(Number(b.dataset.choice)));modal.querySelector('button')?.focus({preventScroll:true});
  }else if(game.mode==='paused'){
    modal.innerHTML='<div class="seal">Ⅱ</div><span class="eyebrow">TAKE A BREATH</span><h2 id="modal-title">잠깐 쉬어가세요</h2><p class="intro">몬스터들도 기다려 줄 거예요.</p><button class="primary" id="resume">계속하기 →</button><button class="secondary" id="restart">처음부터 다시 시작</button><button class="secondary" id="to-title">타이틀로</button>';
    $('resume').onclick=()=>game.pause();$('restart').onclick=()=>start();$('to-title').onclick=toTitle;
  }else{
    const won=game.mode==='won',st=game.stage,run={time:game.time,won,kills:game.kills},old=best[st.id];
    if(!old||won&&!old.won||won===old.won&&(won?run.kills>old.kills:run.time>old.time)){best[st.id]=run;try{localStorage.setItem(BEST_KEY,JSON.stringify(best));}catch{}}
    const i=STAGES.indexOf(st),next=STAGES[i+1],opened=won&&next&&!unlocked(i+1);
    if(won&&!cleared.includes(st.id)){cleared.push(st.id);try{localStorage.setItem(STAGE_KEY,JSON.stringify(cleared));}catch{}}
    stageHeading();
    const finalBoss=combat.mobs[st.bosses.at(-1).id].name,goNext=won&&next;
    modal.innerHTML=`<div class="seal">${won?'✳':'✧'}</div><span class="eyebrow">${won?`STAGE ${st.num} CLEAR!`:'GAME OVER'}</span><h2 id="modal-title">${won?`${josa(finalBoss,'을','를')} 쓰러뜨렸어요`:'다음 모험은 더 멀리'}</h2><p class="intro">${won?(opened?`${josa(st.title,'을','를')} 지켜냈어요!<br><b>STAGE ${next.num} ${josa(next.name,'이','가')}</b> 열렸어요.`:next?`${josa(st.title,'을','를')} 지켜냈어요. 다음 스테이지로 가 볼까요?`:`${josa(st.title,'을','를')} 지켜냈어요. 다른 스킬 조합으로도 도전해 보세요.`):'처음부터 다시! 다른 스킬 조합에 도전해 보세요.'}</p><div class="result-stats"><div><b>${timeLabel(game.time)}</b><span>버틴 시간</span></div><div><b>${game.kills}</b><span>처치한 몬스터</span></div><div><b>${game.player.level}</b><span>도달한 레벨</span></div></div>${goNext?`<button class="primary" id="next-stage">STAGE ${next.num} ${next.name}로 →</button><button class="secondary" id="restart">${st.name} 다시 도전</button>`:'<button class="primary" id="restart">다시 도전하기 →</button>'}<button class="secondary" id="to-title">타이틀로</button><p class="hint">R 키로 바로 다시 시작할 수 있어요</p>`;
    $('restart').onclick=()=>start();$('to-title').onclick=toTitle;if(goNext)$('next-stage').onclick=()=>start(next.id);
  }
}
// Each stage is its own 10-minute run. The field hook lets the map module draw a stage's own area once it has one.
function start(id=game.mode==='menu'?stageId:game.stage.id){
  stageId=stageById(id).id;ensureAudio();keys.clear();field.setStage(stageId);field.reseed(Math.floor(Math.random()*2**31));game.start(stageId);field.constrain(game);
  clock=0;lastTime=performance.now();lastMode='';hudKey='';setMusic(game.stage.bgm);if(music)music.currentTime=0;play(combat.sounds.gameIn,.5);stageHeading();ui();
}
function toTitle(){game.reset();game.mode='menu';hudKey='';stageHeading();ui();}
function pickStage(id){const i=STAGES.findIndex(s=>s.id===id);if(i<0||!unlocked(i))return;stageId=id;game.stage=stageById(id);field.setStage(id);stageHeading();lastMode='';ui();}
function stageHeading(){
  const st=game.mode==='menu'?stageById(stageId):game.stage,boss=combat.mobs[st.bosses.at(-1).id].name,num=String(st.num).padStart(2,'0');
  $('stage-eyebrow').textContent=`STAGE ${st.num} · VICTORIA ISLAND`;$('stage-title').textContent=st.title;$('stage-num').textContent=num;
  $('objective').textContent=`10분을 버티고 ${josa(boss,'을','를')} 쓰러뜨리세요`;$('mission-num').textContent=num;$('mission-title').textContent=`${st.title}에서 버티기`;
  $('mission-text').textContent=`스킬은 자동으로 나갑니다. 메소를 주워 성장하고 10분에 나타나는 ${josa(boss,'을','를')} 쓰러뜨리세요.`;
  $('stage-bgm').textContent=`BGM ${BGM_NAME[st.bgm]??st.bgm}`;$('stage-schedule').textContent=bossLine(st);$('best').textContent=bestLabel(best[st.id]);
}
function choose(i){if(game.choose(i)){keys.clear();lastMode='';ui();}}
function toast(text){$('toast').textContent=text;toastUntil=performance.now()+1800;}

// ---------- events → sound and effects ----------
const FIRE_SOUND={shell:'tGlove',bolt:null,star:'tGlove',arrow:'bow',strike:'swordL',blast:'swordL',claw:null,stab:'swordS'};
function events(){
  let hitSounds=0;
  for(const e of game.events){
    if(e.type==='fire'){const w=WEAPONS[e.weapon];play(combat.skills[e.skill??e.weapon]?.sound??combat.sounds[FIRE_SOUND[w.kind]],.28);
      if(e.weapon==='22001001'){mir.act=combat.skills[e.skill]?.action?.[0]??'magicmissile';mir.at=clock;}}
    if(e.type==='bossSkill'){const snd=combat.mobs[e.mob]?.sounds;play(snd?.attack??snd?.damage,.45);}
    if(e.type==='advance'){play(combat.sounds.levelUp,.6);levelFx=clock;toast(`${JOB_NAME[e.tier]} 전직! ${combat.skills[e.skill].name}`);}
    if(e.type==='mobHit'&&hitSounds++<2)play(combat.mobs[e.mob]?.sounds.damage,.22);
    if(e.type==='kill'&&hitSounds++<3)play(combat.mobs[e.mob]?.sounds.die,e.boss?.7:.25);
    if(e.type==='pickup'&&clock-lastPickup>70){lastPickup=clock;play(combat.sounds.pickUp,.18);}
    if(e.type==='potion'){play(combat.sounds.buff,.5);toast(e.item==='02000005'?'파워 엘릭서! HP가 모두 회복됐어요.':`빨간 포션! HP +${e.heal}`);}
    if(e.type==='level'){play(combat.sounds.levelUp,.6);levelFx=clock;}
    if(e.type==='boss'){toast(`${josa(combat.mobs[e.mob].name,"이","가")} 나타났습니다!`);play(combat.mobs[e.mob].sounds.attack??combat.mobs[e.mob].sounds.damage,.7);if(e.final)setMusic(game.stage.bossBgm);}
    if(e.type==='bossDown'&&!e.final)setMusic(game.stage.bgm);
    if(e.type==='swarm')toast('몬스터 무리가 몰려옵니다!');
    if(e.type==='end'&&!e.won)play(combat.sounds.tombstone,.6);
  }
  game.events=[];
}

// ---------- input ----------
const MOVE={arrowleft:[-1,0],a:[-1,0],arrowright:[1,0],d:[1,0],arrowup:[0,-1],w:[0,-1],arrowdown:[0,1],s:[0,1]};
window.addEventListener('keydown',e=>{
  if(dresser?.open)return;
  const k=e.key.toLowerCase();
  if(['arrowup','arrowdown','arrowleft','arrowright',' ','escape','tab'].includes(k))e.preventDefault();
  if(e.repeat)return;
  if(['upgrade','reward'].includes(game?.mode)&&['1','2','3'].includes(k)){choose(Number(k)-1);return;}
  if(k==='escape'){game.pause();keys.clear();return;}
  if(k==='r'&&['lost','won','paused'].includes(game.mode)){start();return;}
  if(game?.mode==='menu'){if(k==='enter')start();if(k==='c')openDresser();
    if(k==='arrowleft'||k==='arrowright'){const i=STAGES.findIndex(s=>s.id===stageId)+(k==='arrowleft'?-1:1);if(STAGES[i])pickStage(STAGES[i].id);}return;}
  if(MOVE[k])keys.add(k);
});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
function focusLost(){keys.clear();touch.x=touch.y=0;if(game?.mode==='playing')game.pause();}
window.addEventListener('blur',focusLost);document.addEventListener('visibilitychange',()=>{if(document.hidden)focusLost();});
let pointer=null;const joystick=$('joystick'),stick=joystick.firstElementChild;
function moveStick(e){const rect=joystick.getBoundingClientRect(),x=e.clientX-rect.left-rect.width/2,y=e.clientY-rect.top-rect.height/2,d=Math.max(1,Math.hypot(x,y)/27);touch.x=x/d/27;touch.y=y/d/27;stick.style.transform=`translate(${x/d}px,${y/d}px)`;}
joystick.addEventListener('pointerdown',e=>{if(game.mode!=='playing')return;pointer=e.pointerId;joystick.setPointerCapture(pointer);moveStick(e);});joystick.addEventListener('pointermove',e=>{if(e.pointerId===pointer)moveStick(e);});
for(const ev of ['pointerup','pointercancel','lostpointercapture'])joystick.addEventListener(ev,()=>{pointer=null;touch.x=touch.y=0;stick.style.transform='';});
function readInput(){
  let x=touch.x,y=touch.y;for(const k of keys){x+=MOVE[k][0];y+=MOVE[k][1];}
  return {x:Math.max(-1,Math.min(1,x)),y:Math.max(-1,Math.min(1,y))};
}

// ---------- dresser ----------
function openDresser(){if(game.mode!=='menu')return;keys.clear();dresser.show(look);}

// ---------- loop ----------
function resize(){const rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);width=Math.round(rect.width);height=Math.round(rect.height);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.imageSmoothingEnabled=false;if(game)game.view={w:width,h:height};}
new ResizeObserver(resize).observe(canvas);
function drawPortrait(){pctx.clearRect(0,0,140,120);pctx.imageSmoothingEnabled=false;const f=frameAt(hero.stand,clock);if(!f)return;pctx.save();pctx.translate(70,112);pctx.scale(1.2,1.2);pctx.drawImage(f.canvas,-FOOT_X,-FOOT_Y);pctx.restore();}
function loop(now){
  const dt=Math.min((now-lastTime)/1000,.05);lastTime=now;
  if(game.mode==='playing'||game.mode==='menu')clock+=dt*1000;
  if(game.mode==='playing')game.update(dt,readInput());
  else if(game.mode==='menu')game.player.x+=dt*30; // the title screen drifts slowly across the field
  field.constrain(game);events();ui();draw();drawPortrait();$('toast').classList.toggle('visible',now<toastUntil);requestAnimationFrame(loop);
}
try{
  combat=await json('assets/combat/combat.json');
  const catalog=await json('assets/avatar/catalog.json');wardrobe=new Wardrobe(catalog);look=loadLook();
  combatImages=await Promise.all(combat.images.map(i=>loadImage(i.src)));
  await loadNativeFieldArt();rules=rulesFrom(combat);game=new Game(rules);field=new Field();
  await dressHero();
  for(const [k,src]of Object.entries(combat.bgm))if(src){const a=new Audio(src);a.loop=true;a.preload='auto';bgm[k]=a;}
  game.stage=stageById(stageId);field.setStage(stageId);music=bgm[game.stage.bgm]??bgm.field;stageHeading();
  dresser=new Dresser(wardrobe,{onSave:async next=>{look=next;try{localStorage.setItem(LOOK_KEY,JSON.stringify(look));}catch{}await dressHero();},onClose:()=>{lastMode='';ui();}});
  resize();ui();lastTime=performance.now();requestAnimationFrame(loop);
  if(new URLSearchParams(location.search).has('test'))window.gameDebug={get game(){return game;},snapshot:()=>game.snapshot(),start,choose,pickStage,stages:()=>({stageId,cleared:[...cleared]}),render:()=>{ui();draw();},dresser,wardrobe,look:()=>look,openDresser,field,
    bgm:()=>music&&{src:music.src,paused:music.paused,volume:music.volume},camera:()=>({...camera}),assets:{combat:combatImages.length,field:Object.keys(field.byId).length,actions:Object.keys(hero)}};
}catch(error){$('modal').innerHTML=`<div class="seal">!</div><h2 id="modal-title">준비를 마치지 못했어요</h2><p class="loading-error"></p><button class="primary" id="reload">다시 불러오기</button>`;$('modal').querySelector('p').textContent=`${error.message} 실행하기.cmd로 로컬 서버를 먼저 켜 주세요.`;$('reload').onclick=()=>location.reload();console.error(error);}
