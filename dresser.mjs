import {SLOTS, DEFAULT_LOOK, HAIR_COLORS, FACE_COLORS, FOOT_X, FOOT_Y, fits, styleOf, colorOf, withColor} from './avatar.mjs';
// Character customization screen: gender, skin, hair/face styles with colours, and every cash equip.
const $=id=>document.getElementById(id);
const GENDER_LABEL={m:'남자',f:'여자'};
// Skin is part of the look but not an item slot, so it gets its own tab beside hair and face.
const TABS=[SLOTS[0],SLOTS[1],{id:'Skin',label:'피부'},...SLOTS.slice(2)];
const clean=(name,id)=>name||`이름 없는 아이템 #${id}`;
// Hair names start with the colour ("검은색 토벤 머리"); the style list shows the shared part.
const styleName=(slot,name)=>slot==='Hair'?name.replace(/^\S+색\s*/,''):name.replace(/^\S+\s(렌즈)\s*/,'');

export class Dresser{
  constructor(wardrobe,{onSave,onClose}){
    this.wardrobe=wardrobe;this.onSave=onSave;this.onClose=onClose;this.open=false;
    this.slot='Hair';this.kind='stand';this.facing=-1;this.frames=[];this.time=0;this.token=0;this.query='';
    this.root=$('dresser');this.canvas=$('dresser-canvas');this.context=this.canvas.getContext('2d');
    this.thumbs=new Map();this.observer=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){this.observer.unobserve(e.target);this.thumb(e.target);}},{root:$('dresser-grid'),rootMargin:'120px'});
    $('dresser-tabs').innerHTML=TABS.map(s=>`<button role="tab" data-slot="${s.id}">${s.label}</button>`).join('');
    $('dresser-tabs').onclick=e=>{const b=e.target.closest('[data-slot]');if(b){this.slot=b.dataset.slot;this.query='';$('dresser-search').value='';this.renderShop();}};
    $('dresser-gender').onclick=e=>{const b=e.target.closest('[data-gender]');if(b)this.setGender(b.dataset.gender);};
    $('dresser-skins').onclick=e=>{const b=e.target.closest('[data-skin]');if(b)this.change({skin:Number(b.dataset.skin)});};
    $('dresser-pose').onclick=()=>{this.kind=this.kind==='stand'?'walk':'stand';this.refresh();};
    $('dresser-turn').onclick=()=>{this.facing*=-1;};
    $('dresser-random').onclick=()=>this.randomize();
    $('dresser-reset').onclick=()=>this.change({...DEFAULT_LOOK[this.look.gender]},true);
    $('dresser-search').oninput=e=>{this.query=e.target.value.trim();this.renderGrid();};
    $('dresser-colors').onclick=e=>{const b=e.target.closest('[data-color]');if(!b)return;const id=withColor(this.slot,this.look[this.slot],Number(b.dataset.color));if(this.wardrobe.item(id))this.change({[this.slot]:id});};
    $('dresser-grid').onclick=e=>{const b=e.target.closest('[data-id]');if(b)this.pick(Number(b.dataset.id));};
    $('dresser-worn').onclick=e=>{const b=e.target.closest('[data-remove]');if(b)this.change({[b.dataset.remove]:0});};
    $('dresser-save').onclick=async()=>{$('dresser-save').disabled=true;await this.onSave({...this.look});$('dresser-save').disabled=false;this.hide();};
    $('dresser-cancel').onclick=()=>this.hide();
    this.root.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();this.hide();}});
    const loop=now=>{this.time+=Math.min(50,now-(this.last??now));this.last=now;if(this.open)this.draw();requestAnimationFrame(loop);};requestAnimationFrame(loop);
  }
  async show(look){
    this.look={...look};this.open=true;this.root.classList.remove('hidden');document.body.classList.add('dressing');
    // Icon sheets are only needed here, so they load on first open.
    this.sheets??=Promise.all(Object.values(this.wardrobe.catalog.icons).map(s=>new Promise(r=>{const i=new Image();i.onload=i.onerror=r;i.src=s.src;})));
    this.renderAll();$('dresser-save').focus({preventScroll:true});
  }
  hide(){this.open=false;this.root.classList.add('hidden');document.body.classList.remove('dressing');this.onClose?.();}
  setGender(gender){
    if(gender===this.look.gender)return;
    const next={...DEFAULT_LOOK[gender],skin:this.look.skin};
    // Keep everything the other gender can also wear.
    for(const {id:slot}of SLOTS){if(slot==='Hair'||slot==='Face'||!(slot in this.look))continue;const item=this.wardrobe.item(this.look[slot]);if(!this.look[slot])next[slot]=0;else if(item&&fits(item,gender)&&!item.basic)next[slot]=item.id;}
    this.change(next,true);
  }
  pick(id){
    if(this.slot==='Skin'){this.change({skin:id});return;}
    const slot=this.slot,patch={[slot]:id};
    if(slot==='Longcoat'&&id)patch.Coat=patch.Pants=0;
    if((slot==='Coat'||slot==='Pants')&&id)patch.Longcoat=0;
    if(slot==='Hair'||slot==='Face'){const current=this.look[slot];const recolored=withColor(slot,id,colorOf(slot,current));patch[slot]=this.wardrobe.item(recolored)?recolored:id;}
    this.change(patch);
  }
  change(patch,replace=false){this.look=replace?{...patch}:{...this.look,...patch};this.renderAll();}
  randomize(){
    const items=this.wardrobe.catalog.items,g=this.look.gender,any=list=>{const pool=list.filter(i=>fits(i,g));return pool[Math.floor(Math.random()*pool.length)]?.id??0;};
    const next={gender:g,skin:this.look.skin,Hair:any(items.Hair),Face:any(items.Face)};
    if(Math.random()<.4)next.Longcoat=any(items.Longcoat);else{next.Coat=any(items.Coat);next.Pants=any(items.Pants);}
    next.Shoes=any(items.Shoes);
    for(const [slot,chance]of [['Cap',.6],['Cape',.35],['Glove',.25],['Weapon',.45],['FaceAccessory',.2],['EyeAccessory',.3],['Earrings',.2]])if(Math.random()<chance)next[slot]=any(items[slot]);
    this.change(next,true);
  }
  renderAll(){
    $('dresser-gender').querySelectorAll('[data-gender]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.gender===this.look.gender));
    $('dresser-skins').innerHTML=this.wardrobe.catalog.skins.map((s,i)=>`<button data-skin="${s.id}" style="--swatch:${s.color}" aria-pressed="${s.id===this.look.skin}" aria-label="피부색 ${i+1}" title="피부색 ${i+1}"></button>`).join('');
    $('dresser-worn').innerHTML=SLOTS.filter(s=>this.look[s.id]).map(s=>{const item=this.wardrobe.item(this.look[s.id]);const removable=s.id!=='Hair'&&s.id!=='Face';return `<li><span>${s.label}</span><b title="${item?.name??''}">${clean(item?.name,this.look[s.id])}</b>${removable?`<button data-remove="${s.id}" aria-label="${s.label} 벗기">×</button>`:''}</li>`;}).join('');
    this.renderShop();this.refresh();
  }
  renderShop(){
    $('dresser-tabs').querySelectorAll('[data-slot]').forEach(b=>{b.setAttribute('aria-selected',b.dataset.slot===this.slot);b.classList.toggle('worn',b.dataset.slot==='Skin'||!!this.look[b.dataset.slot]);});
    const style=this.slot==='Hair'||this.slot==='Face',colors=style?(this.slot==='Hair'?HAIR_COLORS:FACE_COLORS):[];
    const current=this.look[this.slot];
    $('dresser-colors').hidden=!style;
    if(style)$('dresser-colors').innerHTML=`<span>${this.slot==='Hair'?'머리 색':'눈 색'}</span>`+colors.map((c,i)=>{const ok=current&&this.wardrobe.item(withColor(this.slot,current,i));return `<button data-color="${i}" style="--swatch:${c}" ${ok?'':'disabled'} aria-pressed="${current&&colorOf(this.slot,current)===i}" aria-label="색상 ${i+1}"></button>`;}).join('');
    this.renderGrid();
  }
  // One tile per item; hair and faces collapse colour variants into one style tile.
  entries(){
    if(this.slot==='Skin')return this.wardrobe.catalog.skins.map((s,i)=>({id:s.id,name:`피부색 ${i+1}`}));
    const slot=this.slot,list=(this.wardrobe.catalog.items[slot]??[]).filter(i=>fits(i,this.look.gender));
    if(slot!=='Hair'&&slot!=='Face')return list.map(i=>({id:i.id,name:clean(i.name,i.id),basic:i.basic}));
    const styles=new Map();for(const i of list){const s=styleOf(slot,i.id);const e=styles.get(s);if(!e||colorOf(slot,i.id)===0)styles.set(s,{id:e&&colorOf(slot,e.id)===0?e.id:i.id,name:i.name?styleName(slot,i.name):e?.name??''});}
    return [...styles.values()].map(e=>({...e,name:clean(e.name,e.id)}));
  }
  renderGrid(){
    const slot=this.slot,skin=slot==='Skin',style=slot==='Hair'||slot==='Face',grid=$('dresser-grid'),q=this.query.toLowerCase();
    const current=skin?this.look.skin:this.look[slot],selected=style&&current?styleOf(slot,current):current;
    let entries=this.entries();if(q)entries=entries.filter(e=>e.name.toLowerCase().includes(q)||String(e.id).includes(q));
    const sheet=this.wardrobe.catalog.icons[slot],index=this.wardrobe.iconIndex[slot];
    const tile=e=>{
      const pressed=style?styleOf(slot,e.id)===selected:e.id===selected;
      let art='';
      if(style||skin)art=`<canvas width="70" height="64" data-thumb="${e.id}"></canvas>`;
      else if(sheet&&index.has(e.id)){const i=index.get(e.id);art=`<i style="background-image:url(${sheet.src});background-position:-${i%sheet.columns*sheet.cell}px -${Math.floor(i/sheet.columns)*sheet.cell}px"></i>`;}
      return `<button data-id="${e.id}" aria-pressed="${pressed}" title="${e.name} (${e.id})">${art}<span>${e.name}</span>${e.basic?'<em>기본</em>':''}</button>`;
    };
    grid.innerHTML=(style||skin?'':`<button data-id="0" aria-pressed="${!current}" class="none"><i></i><span>착용 안 함</span></button>`)+entries.map(tile).join('');
    $('dresser-count').textContent=`${skin?`${entries.length}개 피부색`:`${entries.length}${style?'개 스타일':'개 아이템'} · ${GENDER_LABEL[this.look.gender]}`}`;
    grid.querySelectorAll('[data-thumb]').forEach(c=>this.observer.observe(c));
    $('dresser-empty').hidden=entries.length>0;
  }
  // Hair/face tiles show the style on the current character's head.
  async thumb(canvas){
    if(this.slot==='Skin')return this.skinThumb(canvas);
    const style=Number(canvas.dataset.thumb),current=this.look[this.slot],tinted=current&&withColor(this.slot,style,colorOf(this.slot,current));
    // Show each style in the colour currently worn when that variant exists.
    const id=tinted&&this.wardrobe.item(tinted)?tinted:style,look={...this.look,[this.slot]:id,Cap:0,FaceAccessory:0,EyeAccessory:0},key=`${this.slot}:${id}:${look.skin}:${this.slot==='Hair'?look.Face:look.Hair}`;
    try{
      if(!this.thumbs.has(key))this.thumbs.set(key,this.wardrobe.frames(look,'stand',true).then(f=>f[0].canvas));
      const source=await this.thumbs.get(key),context=canvas.getContext('2d');context.imageSmoothingEnabled=false;
      context.drawImage(source,FOOT_X-35,FOOT_Y-(this.slot==='Face'?84:100),70,64,0,0,70,64);
    }catch{}
  }
  // Skin tiles show the whole current character in that skin.
  async skinThumb(canvas){
    const skin=Number(canvas.dataset.thumb),look={...this.look,skin},key=`Skin:${JSON.stringify(look)}`;
    try{
      if(!this.thumbs.has(key))this.thumbs.set(key,this.wardrobe.frames(look,'stand',true).then(f=>f[0].canvas));
      const source=await this.thumbs.get(key),context=canvas.getContext('2d');context.imageSmoothingEnabled=false;
      context.drawImage(source,FOOT_X-36,FOOT_Y-84,72,88,(70-52)/2,0,52,64);
    }catch{}
  }
  async refresh(){
    const token=++this.token;$('dresser-pose').textContent=this.kind==='stand'?'걷기 보기':'서있기 보기';
    const frames=await this.wardrobe.frames(this.look,this.kind).catch(()=>null);
    if(token===this.token&&frames){this.frames=frames;this.time=0;}
  }
  draw(){
    const c=this.context,w=this.canvas.width,h=this.canvas.height;c.clearRect(0,0,w,h);if(!this.frames.length)return;
    const total=this.frames.reduce((s,f)=>s+f.delay,0);let t=this.time%total,frame=this.frames[0];for(const f of this.frames){t-=f.delay;if(t<0){frame=f;break;}}
    c.imageSmoothingEnabled=false;c.fillStyle='#2c3b2a26';c.beginPath();c.ellipse(w/2,h-34,46,11,0,0,Math.PI*2);c.fill();
    c.save();c.translate(w/2,h-36);c.scale(this.facing>0?-2.4:2.4,2.4);c.drawImage(frame.canvas,-FOOT_X,-FOOT_Y);c.restore();
  }
}
