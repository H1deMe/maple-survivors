import {Game,rulesFrom,WEAPONS,PASSIVES,JOBS,STAGES,stageById,JOURNEY,REGION_BLEND_SECONDS,MAX_WEAPONS,MAX_PASSIVES,WEAPON_MAX,PASSIVE_MAX,START_WEAPON,CYGNUS_VARIANTS,formatNumber,formatPercent,upgradeText} from './engine.mjs';
import {EQUIPMENT,EQUIP_SLOTS,ENCHANTS,CONSUMABLES,TROPHIES,RARITIES,rankMultiplier,itemIcon,WEAPON_FAMILIES,WEAPON_BONUS,SCROLLS,scrollStats} from './items.mjs';
import {loadUiFont,uiNumber} from './ui-font.mjs';
import {OverworldField as Field,loadBattlefield,arenaLayout,sceneryBounds,obscuresHero} from './overworld-field.mjs';
import {visibleFieldFrame,depthY,fadedPropAlpha,drawFieldSprite} from './field-render.mjs';
import {townPlan} from './henesys-map.mjs';
import {drawBossVfx} from './boss-vfx.mjs';
import {Wardrobe,DEFAULT_LOOK,FOOT_X,FOOT_Y} from './avatar.mjs';
import {Dresser} from './dresser.mjs';
import {beginRankedRun,saveRecord,scoreOf,loadLeaderboard} from './leaderboard-client.mjs';
import {RankingUI,drawRankingAvatar} from './ranking-ui.mjs';
import {cameraView,FullscreenToggle} from './display.mjs';
const $=id=>document.getElementById(id);
const canvas=$('game'),ctx=canvas.getContext('2d'),portrait=$('portrait'),pctx=portrait.getContext('2d');
const damageNumber=new Intl.NumberFormat('ko-KR',{maximumFractionDigits:0});
let damageSource=null,damageKey='',nextDamageAt=0;
const cygnusIcons=new Map();
const cygnusRoot=id=>CYGNUS_VARIANTS[id]?id:Object.keys(CYGNUS_VARIANTS).find(root=>JOBS[root].some(line=>line.tiers.some(t=>t.skill===id)));
const LOOK_KEY='maple-survivors-look',BEST_KEY='maple-survivors-best',SOUND_KEY='maple-survivors-sound',STAGE_KEY='maple-survivors-stages';
let combat,field,wardrobe,dresser,look,game,rules;
let combatImages=[],hero={},width=900,height=600,lastTime=0,clock=0,lastMode='',toastUntil=0,hudKey='';
let camera={x:0,y:0},levelFx=null,bgm={},music=null,audio=null,sound=true,lastPickup=0;
let viewZoom=1,viewStatusHeight=78,screenMode;
const mobileControls=()=>matchMedia('(pointer:coarse)').matches||navigator.maxTouchPoints>0;
const currentArena=()=>arenaLayout(width,height,viewStatusHeight);
let regionBlend=null,musicFade=null,musicKey='menu',audioActivated=false,itemImages={},inventoryReturn='playing';
let ranking,rankedSession=Promise.resolve(null),endRecord=null;
const keys=new Set(),touch={x:0,y:0};
// Best runs per stage ({lith:{...},henesys:{...}}); an older single record was a Henesys run.
let best={};try{best=JSON.parse(localStorage.getItem(BEST_KEY))??{};if('time' in best)best={henesys:best};}catch{best={};}
// Cleared stage ids. Stage 1 is always open; each clear opens the next stage.
let cleared=[];try{cleared=JSON.parse(localStorage.getItem(STAGE_KEY))??[];}catch{}
const unlocked=i=>i===0||cleared.includes(STAGES[i-1].id);
let stageId=JOURNEY[0].id;
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
function ensureAudio(){audioActivated=true;if(!audio){audio=new(window.AudioContext||window.webkitAudioContext)();}if(audio.state==='suspended')audio.resume();return audio;}
async function play(src,volume=.5){
  if(!sound||!src)return;const a=ensureAudio();
  if(!buffers.has(src))buffers.set(src,fetch(src).then(r=>r.arrayBuffer()).then(b=>a.decodeAudioData(b)).catch(()=>null));
  const buffer=await buffers.get(src);if(!buffer)return;
  const node=a.createBufferSource(),gain=a.createGain();node.buffer=buffer;gain.gain.value=volume;node.connect(gain);gain.connect(a.destination);node.start();
}
const BGM_NAME={menu:'Title',field:'Go Picnic',harbor:'Above The Treetops',ellinia:'When The Morning Comes',perion:'Nightmare',kerning:'Bad Guys',sleepy:'Sleepy Wood',orbis:"Shinin’ Harbor",boss:'Where The Barlog From'};
function setMusic(kind,fade=false){
  const next=bgm[kind];if(!next||music===next)return;
  if(musicFade){musicFade.from.pause();musicFade=null;}
  const old=music;music=next;musicKey=kind;music.currentTime=0;$('stage-bgm').textContent=`BGM ${BGM_NAME[kind]??kind}`;
  if(fade&&old&&sound&&audioActivated){musicFade={from:old,at:game.time};music.volume=0;}else old?.pause();
  syncMusic();
}
function syncMusic(){
  if(!music)return;const want=sound&&game&&(audioActivated||game.mode==='menu');
  if(want&&music.paused)music.play().catch(()=>{});else if(!want&&!music.paused)music.pause();
  const volume=game?.mode==='menu'?.28:['starter','paused','upgrade','reward','loot','inventory'].includes(game?.mode)?.15:.4;
  if(musicFade){
    const t=Math.max(0,Math.min(1,(game.time-musicFade.at)/REGION_BLEND_SECONDS));
    musicFade.from.volume=want?volume*(1-t):0;music.volume=want?volume*t:0;
    if(!want)musicFade.from.pause();else if(musicFade.from.paused&&t<1)musicFade.from.play().catch(()=>{}); // sound back on mid-fade
    if(t>=1){musicFade.from.pause();musicFade=null;}
  }else music.volume=volume;
}
function soundLabel(){$('sound').innerHTML=`♪ <span>소리 ${sound?'켜짐':'꺼짐'}</span>`;$('sound').setAttribute('aria-label',`소리 ${sound?'끄기':'켜기'}`);$('sound').title=`배경음악·효과음 ${sound?'끄기':'켜기'}`;$('mobile-sound').textContent=sound?'♪':'×';$('mobile-sound').setAttribute('aria-label',`소리 ${sound?'끄기':'켜기'}`);}
$('sound').onclick=()=>{sound=!sound;try{localStorage.setItem(SOUND_KEY,sound?'on':'off');}catch{}if(sound)ensureAudio();soundLabel();syncMusic();};soundLabel();
$('mobile-sound').onclick=()=>$('sound').click();
// Menu music attempts autoplay immediately. A blocked browser retries on genuine interaction.
window.addEventListener('pointerdown',()=>{ensureAudio();syncMusic();},{once:true});
window.addEventListener('keydown',()=>{ensureAudio();syncMusic();},{once:true});

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
  ctx.font='12px KMSClassic, Dotum, "돋움", Gulim, sans-serif';ctx.textAlign='center';const w=Math.ceil(ctx.measureText(text).width)+8;
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
  if(m.burn&&!m.dying){for(let i=0;i<3;i++){const dy=(m.anim/35+i*7)%22;ctx.fillStyle=i%2?'#ffbc42':'#e96b24';ctx.fillRect(Math.round(x-7+i*6),Math.round(y-12-dy),3,5);}}
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
// Original upright assemblies use world-space feet for depth and a small collision footprint.
function drawProp(o,x,y,alpha=1,coverAlpha=1){
  const f=frameAt(o.prop.frames,clock+o.phase);if(!f)return;
  drawFieldSprite(ctx,o,f,x,y,alpha,coverAlpha);
}
function drawDrop(d,x,y){
  if(d.kind==='loot'){shadow(x,y,14,.3);fxDraw(combat.meso[3][0].img,x,y-5+Math.sin(clock/240+d.id)*2);nameTag('장비',x,y+2,'#fff','#76519ccc');return;}
  if(d.kind==='item'){const image=itemImages[d.item];if(image){shadow(x,y,10,.2);ctx.drawImage(image,Math.round(x-image.width/2),Math.round(y-image.height-4+Math.sin(clock/200+d.id)*2));}return;}
  if(d.kind==='potion'){const img=combat.potions[d.item];shadow(x,y,9,.2);fxDraw(img,x,y-6+Math.sin(clock/200+d.id)*2);return;}
  const tier=d.value<10?0:d.value<40?1:d.value<150?2:3,f=frameAt(combat.meso[tier],clock+d.id*37);if(!f)return;
  const meta=combat.images[f.img];shadow(x,y,7,.18);fxDraw(f.img,x+meta.origin[0]-meta.w/2,y+meta.origin[1]-meta.h-2);
}
// Damage numbers drawn with the client's digit fonts: the first digit uses the large set.
function drawNumber(n,x,y){
  const alpha=n.t>.55?Math.max(0,1-(n.t-.55)/.45):1;
  if(n.kind==='heal'){ctx.save();ctx.globalAlpha=alpha;ctx.font='bold 14px KMSClassic, Dotum, "돋움", Gulim, sans-serif';ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='#1d4a22';ctx.strokeText(`+${n.value}`,x,y);ctx.fillStyle='#8cf08a';ctx.fillText(`+${n.value}`,x,y);ctx.restore();return;}
  if(n.kind==='miss'){ctx.save();ctx.globalAlpha=alpha;ctx.font='bold 15px KMSClassic, Dotum, "돋움", Gulim, sans-serif';ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='#3a2a6a';ctx.strokeText('MISS',x,y);ctx.fillStyle='#d8c8ff';ctx.fillText('MISS',x,y);ctx.restore();return;}
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
  ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.rotate((b.angle??0)+Math.PI);if(w.kind==='star'||b.spin)ctx.rotate(clock/40);
  if(b.variant==='shadow')ctx.filter='sepia(1) saturate(2.5) hue-rotate(225deg)';
  if(b.variant==='wind')ctx.filter='sepia(.7) saturate(1.8) hue-rotate(80deg)';
  if(b.shadow)ctx.globalAlpha=.55;fxDraw(f.img,0,0);ctx.restore();
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
    ctx.fillStyle='rgba(230,40,40,.16)';ctx.beginPath();ctx.arc(x,y,e.r,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(255,70,60,.32)';ctx.beginPath();ctx.arc(x,y,e.r*k,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='rgba(255,90,80,.9)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,e.r,0,Math.PI*2);ctx.stroke();
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
  if(h.ground)return;
  ctx.save();ctx.globalCompositeOperation='lighter';
  const speed=Math.hypot(h.vx,h.vy)||1,tail=24+(h.rank??1)*3;
  ctx.strokeStyle=h.color;ctx.globalAlpha=.5;ctx.lineWidth=h.r*.8;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-h.vx/speed*tail,y-h.vy/speed*tail);ctx.stroke();ctx.globalAlpha=1;
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
    else if(e.kind==='bossCast'||e.kind==='bossTrail'||e.kind==='bossImpact')drawBossVfx(ctx,e,ox,oy);
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
  const b=game.boss;if(!b||b.dying)return;const x=b.x+ox,y=b.y-40+oy,s=currentArena();if(x>0&&x<width&&y>s.top&&y<s.bottom)return;
  const cx=width/2,cy=(s.top+s.bottom)/2,a=Math.atan2(y-cy,x-cx),r=Math.max(20,Math.min(width/2-30,s.playHeight/2-20));
  ctx.save();ctx.translate(cx+Math.cos(a)*r,cy+Math.sin(a)*r);ctx.scale(1/viewZoom,1/viewZoom);ctx.rotate(a);ctx.fillStyle='#ff5a3c';ctx.strokeStyle='#fff';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(14,0);ctx.lineTo(-8,-10);ctx.lineTo(-8,10);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
}
function draw(){
  const p=game.player,arena=currentArena();camera.x=Math.round(p.x);camera.y=Math.round(p.y+height/2-arena.heroY);
  const ox=Math.round(width/2-camera.x),oy=Math.round(height/2-camera.y);
  ctx.imageSmoothingEnabled=false;
  let blend=1;
  if(regionBlend){blend=Math.max(0,Math.min(1,(game.time-regionBlend.at)/REGION_BLEND_SECONDS));if(blend>=1)regionBlend=null;}
  const frame=visibleFieldFrame(field,camera,width,height),oldFrame=regionBlend?visibleFieldFrame(regionBlend.field,camera,width,height):null;
  if(regionBlend){regionBlend.field.drawGround(ctx,camera.x,camera.y,width,height,oldFrame);ctx.save();ctx.globalAlpha=blend;}
  field.drawGround(ctx,camera.x,camera.y,width,height,frame);
  if(regionBlend)ctx.restore();
  ctx.save();ctx.beginPath();ctx.rect(0,0,width,arena.bottom);ctx.clip();
  const props=frame.props,previousProps=oldFrame?.props??[];
  for(const o of previousProps)if(o.kind==='small')drawProp(o,o.x+ox,o.y+oy,1-blend);
  for(const o of props)if(o.kind==='small')drawProp(o,o.x+ox,o.y+oy,blend);
  for(const d of game.drops){const x=d.x+ox,y=d.y+oy;if(x>-30&&x<width+30&&y>-30&&y<height+30)drawDrop(d,x,y);}
  const items=[];
  for(const o of previousProps)if(o.kind!=='small')items.push({y:depthY(o),prop:o,alpha:1-blend});
  for(const o of props)if(o.kind!=='small')items.push({y:depthY(o),prop:o,alpha:blend});
  for(const m of game.mobs){const x=m.x+ox,y=m.y+oy;if(x>-120&&x<width+120&&y>-40&&y<height+200)items.push({y:m.y,mob:m});}
  items.push({y:p.y,hero:true});items.sort((a,b)=>a.y-b.y);
  for(const it of items){
    if(it.hero)drawHero(p.x+ox,p.y+oy);
    else if(it.mob)drawMob(it.mob,it.mob.x+ox,it.mob.y+oy);
    else if(it.prop)drawProp(it.prop,it.prop.x+ox,it.prop.y+oy,it.alpha,fadedPropAlpha(it.prop,p,obscuresHero(it.prop,p),performance.now()));
  }
  drawMir(ox,oy);
  drawEffects(ox,oy);drawBossPointer(ox,oy);ctx.restore();
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
const iconOf=id=>{
  const key=WEAPONS[id]?.visual??id,index=combat.skills[key]?.icon??combat.passiveIcons[key]?.icon,source=combat.images[index]?.src,root=cygnusRoot(id);
  const explorer=WEAPONS[id]?['전사','마법사','궁수','도적','해적'].includes(WEAPONS[id].cls):Object.entries(JOBS).some(([base,lines])=>['전사','마법사','궁수','도적','해적'].includes(WEAPONS[base].cls)&&lines.some(line=>line.tiers.some(t=>t.skill===id)));
  if((!root&&!explorer)||!combatImages[index])return source;
  if(!cygnusIcons.has(id)){const c=document.createElement('canvas');c.width=c.height=36;const g=c.getContext('2d');g.imageSmoothingEnabled=false;g.fillStyle=root?'#8953c3':'#387eb5';g.fillRect(0,0,36,36);g.fillStyle='#ffffff';g.fillRect(2,2,32,32);g.drawImage(combatImages[index],3,3,30,30);cygnusIcons.set(id,c.toDataURL());}
  return cygnusIcons.get(id);
};
const passiveName=id=>PASSIVES[id].name;
function ui(){
  document.body.classList.toggle('on-title',game.mode==='menu');
  document.body.classList.toggle('mobile-play',mobileControls()&&!dresser?.open);
  if(game.mode!=='playing')releaseStick();
  const p=game.player,maxHp=game.maxHp;
  uiNumber($('level'),p.level,'level');
  $('hp-track').setAttribute('aria-valuemax',maxHp);$('hp-track').setAttribute('aria-valuenow',Math.max(0,Math.ceil(p.hp)));
  $('exp-track').setAttribute('aria-valuenow',Math.min(100,Math.floor(p.exp/game.expNeed*100)));
  $('hp-fill').style.width=`${p.hp/maxHp*100}%`;uiNumber($('hp-text'),`${Math.ceil(p.hp)} / ${maxHp}`);
  const need=game.expNeed,exp=Math.floor(p.exp);$('exp-fill').style.width=`${Math.min(100,p.exp/need*100)}%`;uiNumber($('exp-text'),`${exp} / ${need} [${(p.exp/need*100).toFixed(2)}%]`);
  uiNumber($('timer'),timeLabel(game.time));$('kills').textContent=game.kills;
  const buffKey=Object.entries(game.buffs??{}).map(([id,b])=>id+':'+Math.ceil(b.time)).join();if(buffKey!==$('buffs').dataset.key){$('buffs').dataset.key=buffKey;$('buffs').innerHTML=Object.entries(game.buffs??{}).map(([id,b])=>`<span title="${CONSUMABLES[id].name} · ${CONSUMABLES[id].text}"><img src="${itemIcon(id)}" alt="${CONSUMABLES[id].name}"><b>${Math.ceil(b.time)}</b></span>`).join('');}
  const next=game.bosses[game.bossIndex];
  $('next-event').textContent=game.boss?`보스: ${combat.mobs[game.boss.type].name}`:next?`${timeLabel(next.at).replace(/^0/,'')} ${combat.mobs[next.id].name}`:'최종 보스를 쓰러뜨리세요';
  const progress=Math.min(1,game.time/game.runTime);$('progress-label').textContent=game.continuous?`${game.regionIndex+1} / ${STAGES.length} 지역 · ${timeLabel(game.time)}`:timeLabel(game.time);$('progress-fill').style.width=`${progress*100}%`;
  $('boss-bar').classList.toggle('hidden',!game.boss);
  if(game.boss){$('boss-name').textContent=combat.mobs[game.boss.type].name;$('boss-fill').style.width=`${Math.max(0,game.boss.hp/game.boss.maxHp*100)}%`;}
  const key=JSON.stringify([game.weapons,game.passives,game.jobs,game.equipment,game.trophies]);if(key!==hudKey){hudKey=key;renderLoadout();renderEquipment();}
  renderDamage();
  $('damage-panel').classList.toggle('hidden',['menu','starter'].includes(game.mode));
  $('equipment-open').disabled=!['playing','paused','inventory'].includes(game.mode);
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
function renderDamage(){
  if(damageSource!==game.damageBySkill){damageSource=game.damageBySkill;damageKey='';nextDamageAt=0;}
  const now=performance.now();if(now<nextDamageAt)return;nextDamageAt=now+250;
  const ids=[...new Set([...Object.keys(damageSource),...Object.keys(game.weapons).map(id=>game.skillOf(id))])];
  const rows=ids.map(id=>({id,damage:damageSource[id]??0})).sort((a,b)=>b.damage-a.damage||a.id.localeCompare(b.id));
  const key=JSON.stringify([rows,Math.floor(game.time),game.weapons[START_WEAPON]]);if(key===damageKey)return;damageKey=key;
  $('damage-total').textContent=damageNumber.format(game.totalDamage);
  // Preserve scroll position while the data updates. No sorting or DOM work at render-frame frequency.
  const list=$('damage-list'),scroll=list.scrollTop;
  list.innerHTML=rows.length?rows.map(({id,damage})=>{
    const name=id===START_WEAPON?slotName(id):CYGNUS_VARIANTS[id]?`${WEAPONS[id].name} · ${WEAPONS[id].cls}`:WEAPONS[id]?.name??combat.skills[id]?.name??(id==='trophy-spore'?'머쉬맘의 포자':'기타 피해');
    const icon=id==='trophy-spore'?itemIcon(TROPHIES.spore.icon):iconOf(id),percent=game.totalDamage?damage/game.totalDamage*100:0,dps=game.time>0?damage/game.time:0;
    return `<li class="damage-row" data-damage-skill="${id}">${icon?`<img src="${icon}" alt="">`:''}<div class="damage-info"><div class="damage-label"><span title="${name}">${name}</span><b>${damageNumber.format(damage)}</b></div><div class="damage-share"><span style="width:${percent.toFixed(2)}%"></span></div><div class="damage-meta"><span>${percent.toFixed(1)}%</span><span>DPS ${damageNumber.format(dps)}</span></div></div></li>`;
  }).join(''):'<li class="damage-empty">스킬을 선택하고 공격하면 기록됩니다.</li>';
  list.scrollTop=scroll;
}
$('damage-toggle').onclick=()=>{const collapsed=$('damage-panel').classList.toggle('collapsed');$('damage-toggle').textContent=collapsed?'+':'−';$('damage-toggle').setAttribute('aria-expanded',String(!collapsed));$('damage-toggle').setAttribute('aria-label',`피해량 목록 ${collapsed?'펼치기':'접기'}`);};
const STAT_LABELS={maxHp:'최대 HP',armor:'피해 감소',regen:'초당 HP 회복',might:'공격력',crit:'치명타 확률',speed:'이동 속도',dodge:'회피 확률',area:'공격 범위',magnet:'줍는 범위',haste:'쿨타임 감소',growth:'경험치'};
const statText=(stat,value)=>`${STAT_LABELS[stat]??(stat==='push'?'넉백':stat)} ${value>=0?'+':''}${['regen','push','pierce'].includes(stat)?formatNumber(value):formatPercent(value)}`;
function gearText(e){const def=EQUIPMENT[e.id],parts=[];
  if(def.slot==='weapon')parts.push(`${WEAPON_FAMILIES[def.family].name} 계열 스킬 피해 +${formatPercent(WEAPON_BONUS*rankMultiplier(e.rank))}`);
  for(const [stat,value] of Object.entries(def.stats))parts.push(statText(stat,value*rankMultiplier(e.rank)));
  for(const [stat,value] of Object.entries(e.bonus??{}))parts.push(`주문서 ${statText(stat,value)}`);
  if(e.enchant)parts.push(ENCHANTS[e.enchant].name);
  return parts.join(' · ')+` · 업그레이드 가능 ${def.tuc-(e.used??0)}회`;}
const gearName=e=>`${EQUIPMENT[e.id].name}${e.upgrades?` (+${e.upgrades})`:''}`;
function equipmentMarkup(){return `<div class="equipment-grid">${Object.entries(EQUIP_SLOTS).map(([slot,label])=>{const e=game.equipment[slot];return `<div class="equipment-cell slot-${slot} rank-${e?.rank??0}" title="${e?`${gearName(e)} · ${gearText(e)}`:label+' 미착용'}"><span>${label}</span>${e?`<img src="${itemIcon(e.id)}" alt="${EQUIPMENT[e.id].name}"><b>${RARITIES[e.rank]}${e.upgrades?` +${e.upgrades}`:''}</b>${e.enchant?`<i>${ENCHANTS[e.enchant].name}</i>`:''}`:'<em>—</em>'}</div>`;}).join('')}</div><div class="trophy-list">${game.trophies.length?game.trophies.map(id=>`<div title="${TROPHIES[id].text}"><img src="${itemIcon(TROPHIES[id].icon)}" alt=""><span><b>${TROPHIES[id].name}</b><small>${TROPHIES[id].text}</small></span></div>`).join(''):'<p>보스 전리품을 모아 고유 효과를 얻으세요.</p>'}</div>`;}
function renderEquipment(){$('equipment-count').textContent=`${Object.keys(game.equipment).length} / ${Object.keys(EQUIP_SLOTS).length}`;$('equipment-list').innerHTML=equipmentMarkup();}
function toggleInventory(){if(game.mode==='inventory'){game.mode=inventoryReturn;return;}if(!['playing','paused'].includes(game.mode))return;inventoryReturn=game.mode;game.mode='inventory';keys.clear();touch.x=touch.y=0;}
$('equipment-open').onclick=toggleInventory;
$('pause').onclick=()=>{keys.clear();touch.x=touch.y=0;game.pause();};
function choiceCard(c){
  if(c.type==='equip'){const def=EQUIPMENT[c.id],old=game.equipment[def.slot];return {icon:itemIcon(c.id),title:def.name,text:`${gearText({...c,used:0})}${old?`\n현재: ${gearName(old)} · ${gearText(old)}${old.upgrades?'\n현재 장비의 주문서 강화는 사라집니다.':''}`:'\n비어 있는 부위에 착용합니다.'}`,tag:`${RARITIES[c.rank]} · ${EQUIP_SLOTS[def.slot]}${def.slot==='weapon'?` · ${WEAPON_FAMILIES[def.family].name}`:''}${old?' 교체':''}`};}
  if(c.type==='scroll'){const sc=SCROLLS[c.id],e=game.equipment[c.slot],left=EQUIPMENT[e.id].tuc-(e.used??0);
    return {icon:itemIcon(c.id),title:sc.name,text:`${gearName(e)}에 사용 · 남은 업그레이드 ${left}회\n성공 ${sc.success}%: ${Object.entries(scrollStats(c.id)).map(([k,v])=>statText(k,v)).join(' · ')}\n${sc.cursed?`실패하면 ${sc.cursed}% 확률로 장비가 파괴됩니다!`:'실패해도 장비는 그대로입니다.'}`,tag:`주문서 ${sc.success}% · ${EQUIP_SLOTS[c.slot]}`,danger:!!sc.cursed};}
  if(c.type==='enchant')return {icon:itemIcon(ENCHANTS[c.id].icon),title:ENCHANTS[c.id].name,text:`${EQUIPMENT[game.equipment[c.slot].id].name}에 적용\n${ENCHANTS[c.id].text}${game.equipment[c.slot].enchant?'\n기존 각인을 교체합니다.':''}`,tag:`주문서 · ${EQUIP_SLOTS[c.slot]}`};
  if(c.type==='trophy')return {icon:itemIcon(TROPHIES[c.id].icon),title:TROPHIES[c.id].name,text:TROPHIES[c.id].text,tag:'보스 전리품 · 이번 모험 동안 유지'};
  if(c.type==='advance'){const line=JOBS[c.id][c.branch],t=line.tiers[c.tier-1],sk=combat.skills[t.skill];
    return {icon:iconOf(t.skill),title:sk.name,text:`${slotName(c.id)===sk.name?`${sk.name} 강화`:`${slotName(c.id)} → ${sk.name}`}. ${t.desc}`,tag:`${JOB_NAME[c.tier]} 전직 · ${line.names?.[c.tier-1]??line.job}`,advance:true};}
  if(c.type==='weapon'){const w=WEAPONS[c.id];return {icon:iconOf(c.id),title:w.name,text:c.level===1?w.desc:upgradeText(c.id,c.level),tag:c.level===1?`새 스킬 · ${w.cls}`:`Lv.${c.level-1} → ${c.level}${c.level===WEAPON_MAX?' (MAX)':''}`};}
  if(c.type==='passive'){const s=PASSIVES[c.id];return {icon:iconOf(c.id),title:s.name,text:s.text(s.per*c.level),tag:c.level===1?'새 패시브':`Lv.${c.level-1} → ${c.level}${c.level===PASSIVE_MAX?' (MAX)':''}`};}
  if(c.type==='heal')return {icon:combat.images[combat.potions['02000000']].src,title:'빨간 포션',text:'HP를 30 회복합니다.',tag:'회복'};
  return {icon:combat.images[combat.meso[3][0].img].src,title:'메소 주머니',text:'모든 스킬을 다 익혔어요. 다음 레벨을 노려 보세요.',tag:'보너스'};
}
function showOverlay(){
  const overlay=$('overlay'),modal=$('modal');overlay.classList.toggle('hidden',game.mode==='playing');modal.className='modal';
  if(game.mode==='playing')return;
  if(game.mode==='menu'){
    modal.classList.add('title','simple-title');
    modal.innerHTML=`<h2 id="modal-title" class="logo"><small>MAPLE</small>SURVIVORS<span>메이플 서바이버</span></h2><div class="credit creator-credit"><span>제작자</span><b>S0rryMyBad</b></div><p class="intro">매번 새로운 모험, 마지막은 주니어 발록.</p><nav class="title-menu"><button class="primary" id="start">모험 시작</button><button class="secondary" id="customize">캐릭터 꾸미기</button><button class="secondary" id="rankings-open">순위표</button></nav><p class="hint">Enter 시작 · C 꾸미기</p>`;
    $('start').onclick=()=>start();$('customize').onclick=openDresser;$('start').focus({preventScroll:true});
    $('rankings-open').onclick=()=>ranking.show();
  }else if(game.mode==='starter'){
    modal.classList.add('upgrade','starter-pick');
    modal.innerHTML=`<span class="eyebrow">FIRST SKILL · RANDOM CHOICE</span><h2 id="modal-title" tabindex="-1">시작 스킬을 골라주세요</h2><p class="intro">무작위로 나온 세 스킬 중 하나로 시작합니다.</p><div class="choices">${game.choices.map((c,i)=>{const d=choiceCard(c);return `<button class="choice" data-starter="${c.id}"><img class="choice-icon" src="${d.icon}" alt=""><strong>${d.title}</strong><p>${d.text}</p><span class="choice-tag">${WEAPONS[c.id].cls}</span><span class="choice-key">${i+1}</span></button>`;}).join('')}</div><button class="secondary" id="starter-back">타이틀로</button><p class="hint">숫자 1 / 2 / 3 · 선택 전 전투 정지<br>파란 테두리: 모험가 · 보라 테두리: 시그너스</p>`;
    modal.querySelectorAll('[data-starter]').forEach(b=>b.onclick=()=>selectStarter(b.dataset.starter));
    $('starter-back').onclick=toTitle;$('modal-title').focus({preventScroll:true});
  }else if(game.mode==='loot'){
    modal.classList.add('upgrade');modal.innerHTML=`<div class="seal">♜</div><span class="eyebrow">BOSS LOOT</span><h2 id="modal-title">전리품을 골라주세요</h2><p class="intro">장비·주문서·보스 전리품 중 하나를 얻습니다.<br>장비 효과는 이번 모험 동안 유지되고 꾸미기 외형도 유지됩니다.</p><div class="choices">${game.choices.map((c,i)=>{const d=choiceCard(c);return `<button class="choice item-choice${d.danger?' danger':''}" data-choice="${i}"><img class="choice-icon" src="${d.icon}" alt=""><strong>${d.title}</strong><p>${d.text}</p><span class="choice-tag">${d.tag}</span><span class="choice-key">${i+1}</span></button>`;}).join('')}</div><p class="hint">선택하는 동안 전투가 멈춥니다 · 숫자 1 / 2 / 3</p>`;
    modal.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>choose(Number(b.dataset.choice)));modal.querySelector('button')?.focus({preventScroll:true});
  }else if(game.mode==='inventory'){
    modal.classList.add('inventory');modal.innerHTML=`<span class="eyebrow">EQUIPMENT & TROPHIES</span><h2 id="modal-title">이번 모험의 장비</h2>${equipmentMarkup()}<div class="equipment-details">${Object.values(game.equipment).map(e=>`<p><b>${EQUIPMENT[e.id].name}</b><span>${gearText(e)}</span></p>`).join('')||'<p>보스를 처치하면 장비를 고를 수 있어요.</p>'}</div><p class="hint">부위별 1개 · 각인은 교체 장비에 계승 · 새 모험에서 초기화</p><button class="primary" id="inventory-close">돌아가기</button>`;$('inventory-close').onclick=toggleInventory;
  }else if(game.mode==='upgrade'||game.mode==='reward'){
    const reward=game.mode==='reward';modal.classList.add('upgrade');
    modal.innerHTML=`<div class="seal">${reward?'♛':'✦'}</div><span class="eyebrow">${reward?'BOSS DEFEATED · REWARD':`LEVEL ${game.player.level} · LEVEL UP!`}</span><h2 id="modal-title">${reward?'보스를 물리쳤어요!':'무엇을 익힐까요?'}</h2><p class="intro">${reward?(game.choices.some(c=>c.type==='advance')?'전직할 수 있어요! 하나를 고르세요. HP도 모두 회복돼요.':'보상을 하나 고르세요. HP도 모두 회복돼요.'):'새 스킬, 스킬 레벨, 패시브 중 하나를 고르세요.'}</p><div class="choices">${game.choices.map((c,i)=>{const d=choiceCard(c);return `<button class="choice${d.advance?' advance':''}" data-choice="${i}"><img class="choice-icon" src="${d.icon}" alt=""><strong>${d.title}</strong><p>${d.text}</p><span class="choice-tag">${d.tag}</span><span class="choice-key">${i+1}</span></button>`;}).join('')}</div><p class="hint">선택하는 동안 전투가 멈춥니다 · 숫자 1 / 2 / 3</p>`;
    modal.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>choose(Number(b.dataset.choice)));modal.querySelector('button')?.focus({preventScroll:true});
  }else if(game.mode==='paused'){
    modal.innerHTML='<div class="seal">Ⅱ</div><h2 id="modal-title">일시정지</h2><button class="primary" id="resume">계속하기 →</button><button class="secondary" id="pause-customize">캐릭터 꾸미기</button><button class="secondary" id="restart">처음부터 다시 시작</button><button class="secondary" id="to-title">타이틀로</button>';
    $('resume').onclick=()=>game.pause();$('restart').onclick=()=>start();$('to-title').onclick=toTitle;
    $('pause-customize').onclick=openDresser;
  }else{
    const won=game.mode==='won',st=game.stage,run={time:game.time,won,kills:game.kills},recordKey=game.continuous?'journey':st.id,old=best[recordKey];
    if(!old||won&&!old.won||won===old.won&&(won?run.kills>old.kills:run.time>old.time)){best[recordKey]=run;try{localStorage.setItem(BEST_KEY,JSON.stringify(best));}catch{}}
    const next=null,opened=false;
    if(won&&!cleared.includes(st.id)){cleared.push(st.id);try{localStorage.setItem(STAGE_KEY,JSON.stringify(cleared));}catch{}}
    stageHeading();
    const finalBoss=combat.mobs[game.bosses.at(-1).id].name,goNext=won&&next;
    modal.innerHTML=`<div class="seal">${won?'✳':'✧'}</div><span class="eyebrow">${won?'ADVENTURE CLEAR!':'GAME OVER'}</span><h2 id="modal-title">${won?`${josa(finalBoss,'을','를')} 쓰러뜨렸어요`:'다음 모험은 더 멀리'}</h2><p class="intro">${won?`${STAGES.length}개 지역을 지나 마지막 보스까지 쓰러뜨렸어요!`:'처음부터 다시! 새로운 지역 순서와 스킬 조합에 도전해 보세요.'}</p><div class="result-stats"><div><b>${timeLabel(game.time)}</b><span>버틴 시간</span></div><div><b>${game.kills}</b><span>처치한 몬스터</span></div><div><b>${game.player.level}</b><span>도달한 레벨</span></div></div><button class="primary" id="restart">다시 도전하기 →</button><button class="secondary" id="to-title">타이틀로</button><p class="hint">R 키로 바로 다시 시작할 수 있어요</p>`;
    endRecord??={cleared:won,kills:game.kills,level:game.player.level,bossKills:game.bossKills,duration:Math.floor(game.time),finalBoss:won?game.bosses.at(-1).id:null,appearance:structuredClone(look)};
    const form=document.createElement('form');form.className='record-form';form.innerHTML=`<canvas id="result-avatar" width="80" height="96" aria-label="모험 종료 당시 캐릭터"></canvas><div><b>${damageNumber.format(scoreOf(endRecord))}점</b><label for="record-name">순위표에 남길 이름</label><input id="record-name" name="nickname" minlength="2" maxlength="16" required autocomplete="nickname" placeholder="이름 2~16자"><button class="secondary" type="submit">기록 등록</button><button class="secondary" type="button" id="result-rankings">순위표 보기</button><p id="record-status" role="status"></p></div>`;modal.insertBefore(form,$('restart'));drawRankingAvatar(form.querySelector('canvas'),endRecord.appearance,wardrobe);
    try{form.querySelector('input').value=localStorage.getItem('maple-survivors-ranking-name')??'';}catch{}
    $('result-rankings').onclick=()=>ranking.show();form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector('[type="submit"]'),status=form.querySelector('#record-status'),record=structuredClone(endRecord),name=form.querySelector('input').value,sessionPromise=rankedSession;button.disabled=true;status.textContent='등록하는 중…';try{const session=await sessionPromise;if(!session)throw Error('이 모험은 순위 등록을 사용할 수 없습니다.');await saveRecord(session,{...record,name});try{localStorage.setItem('maple-survivors-ranking-name',name);}catch{}status.textContent='기록을 등록했습니다.';form.querySelector('input').disabled=true;}catch(error){status.textContent=error.message;button.disabled=false;}};
    $('restart').onclick=()=>start();$('to-title').onclick=toTitle;if(goNext)$('next-stage').onclick=()=>start(next.id);
  }
}
// The visible menu always begins one complete adventure. Explicit regions are test-only previews.
function start(id,starter=null){
  const preview=new URLSearchParams(location.search).has('test')&&typeof id==='string';
  ensureAudio();keys.clear();touch.x=touch.y=0;game.start(preview?id:undefined,starter);stageId=game.stage.id;regionBlend=null;
  endRecord=null;const query=new URLSearchParams(location.search);rankedSession=game.continuous&&(!query.has('test')||query.has('online'))?beginRankedRun().catch(()=>null):Promise.resolve(null);
  field.setStage(stageId);field.reseed(Math.floor(Math.random()*2**31));field.enterAt(game.player.x,game.player.y);field.constrain(game);
  clock=0;lastTime=performance.now();lastMode='';hudKey='';setMusic(game.stage.bgm);if(music)music.currentTime=0;play(combat.sounds.gameIn,.5);stageHeading();ui();
}
function selectStarter(id){if(game.selectStarter(id)){keys.clear();touch.x=touch.y=0;field.constrain(game);lastTime=performance.now();lastMode='';hudKey='';ui();return true;}return false;}
function toTitle(){game.reset();game.mode='menu';game.continuous=true;game.stage=stageById(JOURNEY[0].id);stageId=game.stage.id;field.setStage(stageId);field.enterAt(0,0);regionBlend=null;hudKey='';setMusic('menu');stageHeading();ui();}
function pickStage(id){if(!new URLSearchParams(location.search).has('test'))return;stageId=id;game.stage=stageById(id);field.setStage(id);stageHeading();lastMode='';ui();}
function stageHeading(){
  const st=game.stage,phase=game.continuous?game.regionIndex+1:st.num,num=String(phase).padStart(2,'0'),menu=game.mode==='menu';
  $('stage-eyebrow').textContent=menu?'RANDOM JOURNEY · MAPLE WORLD':`AREA ${phase} / ${STAGES.length} · MAPLE WORLD`;$('stage-title').textContent=menu?`매판 달라지는 ${STAGES.length}개 지역`:st.title;$('stage-num').textContent=menu?'?':num;
  $('objective').textContent=`${STAGES.length}개 지역을 지나 최종 보스 주니어 발록을 쓰러뜨리세요`;$('mission-num').textContent=num;$('mission-title').textContent=`${st.title} 탐험 중`;
  $('mission-text').textContent='지역과 중간 보스 순서는 매판 달라지고 시간이 흐를수록 적이 강해집니다. 스킬과 장비를 키워 주니어 발록을 처치하세요.';
  $('stage-bgm').textContent=`BGM ${BGM_NAME[musicKey]??musicKey}`;
  $('stage-schedule').textContent=menu?`${STAGES.length}개 지역 · 순서는 매판 무작위`:game.route.map(p=>stageById(p.id).name).join(' → ');$('best').textContent=bestLabel(best.journey);
}
function choose(i){if(game.mode==='starter'){selectStarter(game.choices[i]?.id);return;}if(game.choose(i)){keys.clear();lastMode='';ui();}}
function toast(text){$('toast').textContent=text;toastUntil=performance.now()+1800;}

// ---------- events → sound and effects ----------
const FIRE_SOUND={shell:'tGlove',bolt:null,star:'tGlove',arrow:'bow',strike:'swordL',blast:'swordL',claw:null,stab:'swordS'};
function events(){
  let hitSounds=0;
  for(const e of game.events){
    if(e.type==='fire'){const w=WEAPONS[e.weapon];play(combat.skills[e.skill??e.weapon]?.sound??combat.sounds[FIRE_SOUND[w.kind]],.28);
      if(e.weapon==='22001001'){mir.act=combat.skills[e.skill]?.action?.[0]??'magicmissile';mir.at=clock;}}
    if(e.type==='region'){const previous=new Field(field.seed,field.options);previous.setStage(e.from);previous.enterAt(field.arrival.x,field.arrival.y);field.setStage(e.to);field.enterAt(game.player.x,game.player.y);if(field.v2)field.beginTransition(e.at,REGION_BLEND_SECONDS);regionBlend={field:previous,at:e.at};stageId=e.to;stageHeading();toast(`${game.stage.name} 도착 · 성장과 장비 유지`);if(!game.boss?.final)setMusic(game.stage.bgm,true);}
    if(e.type==='bossSkill'){const snd=combat.mobs[e.mob]?.sounds;play(snd?.attack??snd?.damage,.45);}
    if(e.type==='advance'){play(combat.sounds.levelUp,.6);levelFx=clock;toast(`${JOB_NAME[e.tier]} 전직! ${combat.skills[e.skill].name}`);}
    if(e.type==='mobHit'&&hitSounds++<2)play(combat.mobs[e.mob]?.sounds.damage,.22);
    if(e.type==='kill'&&hitSounds++<3)play(combat.mobs[e.mob]?.sounds.die,e.boss?.7:.25);
    if(e.type==='pickup'&&clock-lastPickup>70){lastPickup=clock;play(combat.sounds.pickUp,.18);}
    if(e.type==='potion'){play(combat.sounds.buff,.5);toast(e.item==='02000005'?'파워 엘릭서! HP가 모두 회복됐어요.':`빨간 포션! HP +${e.heal}`);}
    if(e.type==='consume'){play(combat.sounds.buff,.5);toast(`${CONSUMABLES[e.item].name} · ${CONSUMABLES[e.item].text}`);}
    if(e.type==='itemChoice'){play(combat.sounds.levelUp,.4);const c=e.choice;if(c.type!=='scroll')toast(c.type==='equip'?`${EQUIPMENT[c.id].name} 착용`:c.type==='enchant'?`${ENCHANTS[c.id].name} 적용`:`${TROPHIES[c.id].name} 획득`);}
    if(e.type==='guard')toast('마노의 수호 · 공격을 막았어요!');
    if(e.type==='scroll'){const name=EQUIPMENT[e.item].name;if(e.success){play(combat.sounds.levelUp,.5);toast(`주문서 성공! ${name} 강화`);}else if(e.destroyed){play(combat.sounds.tombstone,.5);toast(`주문서 실패… ${name}이(가) 파괴됐어요`);}else toast(`주문서 실패… ${name}은(는) 그대로예요`);}
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
  if(dresser?.open||ranking?.open||e.target.closest?.('input,textarea,select,[contenteditable="true"]'))return;
  const k=e.key.toLowerCase();
  if(e.target.closest?.('#fullscreen-toggle')&&['enter',' '].includes(k))return;
  if(k==='escape'&&screenMode?.active)return; // Browser owns native fullscreen exit.
  if(['arrowup','arrowdown','arrowleft','arrowright',' ','escape'].includes(k))e.preventDefault();
  if(e.repeat)return;
  if(k==='c'&&['menu','playing','paused'].includes(game?.mode)){e.preventDefault();openDresser();return;}
  if(game?.mode==='starter'){
    if(['1','2','3'].includes(k)){e.preventDefault();choose(Number(k)-1);return;}
    if(k==='escape'){toTitle();keys.clear();}
    if(k==='tab'){
      const buttons=[...$('modal').querySelectorAll('button')],i=buttons.indexOf(document.activeElement);
      if(i<0||(!e.shiftKey&&i===buttons.length-1)||(e.shiftKey&&i===0)){e.preventDefault();buttons[e.shiftKey?buttons.length-1:0].focus();}
    }
    return;
  }
  if(['upgrade','reward','loot'].includes(game?.mode)&&['1','2','3'].includes(k)){choose(Number(k)-1);return;}
  if(k==='i'){toggleInventory();return;}
  if(k==='escape'){if(game?.mode==='inventory')toggleInventory();else game?.pause();keys.clear();return;}
  if(k==='r'&&['lost','won','paused'].includes(game.mode)){start();return;}
  if(game?.mode==='menu'){if(k==='enter'){e.preventDefault();start();}if(k==='c')openDresser();
    return;}
  if(MOVE[k])keys.add(k);
});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
function focusLost(){keys.clear();touch.x=touch.y=0;if(game?.mode==='playing')game.pause();}
window.addEventListener('blur',focusLost);document.addEventListener('visibilitychange',()=>{if(document.hidden)focusLost();});
let pointer=null,stickOrigin=null;const joystick=$('joystick'),stick=joystick.firstElementChild,gameFrame=canvas.parentElement;
function releaseStick(){
  const previous=pointer;pointer=null;stickOrigin=null;touch.x=touch.y=0;stick.style.transform='';joystick.classList.remove('active');joystick.style.left=joystick.style.top=joystick.style.bottom='';
  if(previous!=null&&gameFrame.hasPointerCapture(previous))gameFrame.releasePointerCapture(previous);
}
function moveStick(e){
  if(!stickOrigin)return;const x=e.clientX-stickOrigin.x,y=e.clientY-stickOrigin.y,len=Math.hypot(x,y),radius=42,power=Math.min(1,Math.max(0,(len-5)/(radius-5)));
  touch.x=len?x/len*power:0;touch.y=len?y/len*power:0;
  const travel=Math.min(radius,len);stick.style.transform=`translate(${len?x/len*travel:0}px,${len?y/len*travel:0}px)`;
}
gameFrame.addEventListener('pointerdown',e=>{
  if(game?.mode!=='playing'||pointer!=null||e.target.closest('button,#overlay,.damage-panel,.status-bar,.stage-hud'))return;
  const fixed=e.target.closest('#joystick');if(!fixed&&!document.body.classList.contains('mobile-play'))return;
  e.preventDefault();pointer=e.pointerId;const rect=gameFrame.getBoundingClientRect(),base=joystick.getBoundingClientRect();
  stickOrigin=fixed?{x:base.left+base.width/2,y:base.top+base.height/2}:{x:e.clientX,y:e.clientY};
  if(!fixed){joystick.style.left=`${e.clientX-rect.left-60}px`;joystick.style.top=`${e.clientY-rect.top-60}px`;joystick.style.bottom='auto';}
  joystick.classList.add('active');gameFrame.setPointerCapture(pointer);moveStick(e);
});
gameFrame.addEventListener('pointermove',e=>{if(e.pointerId===pointer){e.preventDefault();moveStick(e);}});
for(const ev of ['pointerup','pointercancel','lostpointercapture'])gameFrame.addEventListener(ev,e=>{if(e.pointerId===pointer)releaseStick();});
window.addEventListener('resize',releaseStick);
function readInput(){
  let x=touch.x,y=touch.y;for(const k of keys){x+=MOVE[k][0];y+=MOVE[k][1];}
  return {x:Math.max(-1,Math.min(1,x)),y:Math.max(-1,Math.min(1,y))};
}

// ---------- dresser ----------
function openDresser(){if(!['menu','playing','paused'].includes(game.mode))return;if(game.mode==='playing')game.pause();keys.clear();releaseStick();dresser.show(look);ui();}

// ---------- loop ----------
function resize(){
  const rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2),view=cameraView(rect.width,rect.height,mobileControls());
  width=view.width;height=view.height;viewZoom=view.zoom;viewStatusHeight=view.statusHeight;
  canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);ctx.setTransform(dpr*viewZoom,0,0,dpr*viewZoom,0,0);ctx.imageSmoothingEnabled=false;
  if(game)game.view={w:width,h:currentArena().playHeight};
}
new ResizeObserver(resize).observe(canvas);
screenMode=new FullscreenToggle($('fullscreen-toggle'),()=>{keys.clear();releaseStick();requestAnimationFrame(resize);});
function drawPortrait(){pctx.clearRect(0,0,140,120);pctx.imageSmoothingEnabled=false;const f=frameAt(hero.stand,clock);if(!f)return;pctx.save();pctx.translate(70,112);pctx.scale(1.2,1.2);pctx.drawImage(f.canvas,-FOOT_X,-FOOT_Y);pctx.restore();}
function loop(now){
  const dt=Math.min((now-lastTime)/1000,.05);lastTime=now;
  if(game.mode==='playing'||game.mode==='menu')clock+=dt*1000;
  if(game.mode==='playing')game.update(dt,readInput());
  else if(game.mode==='menu')game.player.x+=dt*30; // the title screen drifts slowly across the field
  events();if(!field.v2)field.constrain(game);if(musicFade)syncMusic();ui();draw();drawPortrait();$('toast').classList.toggle('visible',now<toastUntil);requestAnimationFrame(loop);
}
try{
  combat=await json('assets/combat/combat.json');
  const catalog=await json('assets/avatar/catalog.json');wardrobe=new Wardrobe(catalog);look=loadLook();
  combatImages=await Promise.all(combat.images.map(i=>loadImage(i.src)));
  await loadBattlefield();await loadUiFont();rules=rulesFrom(combat);game=new Game(rules);const params=new URLSearchParams(location.search);field=new Field(1065,{mode:params.has('fixed')?'fixed':'seeded'});game.world=field.worldAdapter(game);
  const itemManifest=await json('assets/items/items.json');itemImages=Object.fromEntries(await Promise.all(Object.keys(itemManifest.entries).map(async id=>[id,await loadImage(itemIcon(id))])));
  await dressHero();
  for(const [k,src]of Object.entries(combat.bgm))if(src){const a=new Audio(src);a.loop=true;a.preload='auto';bgm[k]=a;}
  const menuTrack=new Audio('assets/ui/menu.mp3');menuTrack.loop=true;menuTrack.preload='auto';bgm.menu=menuTrack;game.continuous=true;game.stage=stageById(stageId);field.setStage(stageId);music=bgm.menu;stageHeading();
  dresser=new Dresser(wardrobe,{onSave:async next=>{look=next;try{localStorage.setItem(LOOK_KEY,JSON.stringify(look));}catch{}await dressHero();},onClose:()=>{lastMode='';ui();}});
  ranking=new RankingUI(wardrobe,{onOpen:()=>{if(game.mode==='playing')game.pause();keys.clear();releaseStick();},onClose:()=>{lastMode='';ui();}});await loadLeaderboard();
  resize();ui();lastTime=performance.now();requestAnimationFrame(loop);
  if(new URLSearchParams(location.search).has('test'))window.gameDebug={get game(){return game;},snapshot:()=>game.snapshot(),start:(id,starter=START_WEAPON)=>start(id,starter),selectStarter,choose,pickStage,stages:()=>({stageId,cleared:[...cleared]}),render:()=>{ui();draw();},dresser,wardrobe,look:()=>look,openDresser,field,
    bgm:()=>music&&{src:music.src,paused:music.paused,volume:music.volume,activated:audioActivated,fade:musicFade&&{src:musicFade.from.src,paused:musicFade.from.paused,volume:musicFade.from.volume}},camera:()=>({...camera}),arena:currentArena,viewport:()=>({zoom:viewZoom,width,height,statusHeight:viewStatusHeight}),scenery:()=>field.propsIn(camera.x-width/2,camera.y-height/2,camera.x+width/2,camera.y+height/2).map(p=>({id:p.id,key:p.key,x:p.x,y:p.y,foot:p.foot,bounds:sceneryBounds(p),faded:obscuresHero(p,game.player)})),transition:()=>regionBlend?{from:regionBlend.field.stage,to:field.stage,progress:Math.max(0,Math.min(1,(game.time-regionBlend.at)/REGION_BLEND_SECONDS))}:null,assets:{combat:combatImages.length,field:Object.keys(field.byId).length,actions:Object.keys(hero)}};
  if(params.has('test')&&params.get('region')==='henesys'){start('henesys');if(params.has('seed'))field.reseed(Number(params.get('seed')));field.enterAt(0,0);const plan=townPlan(field.seed,field.arrival),view=params.get('view');if(view==='village'){game.player.x=plan.landmark.x+170;game.player.y=plan.landmark.y+80;}else if(view==='bridge'){game.player.x=plan.bridge.x-220;game.player.y=plan.bridge.y;}else if(view==='boss'){game.player.x=plan.boss.x;game.player.y=plan.boss.y;}field.constrain(game);ui();draw();}
}catch(error){$('modal').innerHTML=`<div class="seal">!</div><h2 id="modal-title">준비를 마치지 못했어요</h2><p class="loading-error"></p><button class="primary" id="reload">다시 불러오기</button>`;$('modal').querySelector('p').textContent=`${error.message} 실행하기.cmd로 로컬 서버를 먼저 켜 주세요.`;$('reload').onclick=()=>location.reload();console.error(error);}
