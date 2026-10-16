// Character look: loads per-item atlases exported from Character.wz and composes animation frames
// using the client's own layer order (Base.wz zmap) and slot-covering rules (smap / vslot).
export const SLOTS=[
  {id:'Hair',label:'헤어',style:true},{id:'Face',label:'성형',style:true},
  {id:'Cap',label:'모자'},{id:'Coat',label:'상의'},{id:'Longcoat',label:'한벌옷'},{id:'Pants',label:'하의'},
  {id:'Shoes',label:'신발'},{id:'Glove',label:'장갑'},{id:'Cape',label:'망토'},{id:'Weapon',label:'무기'},{id:'Shield',label:'방패'},
  {id:'FaceAccessory',label:'얼굴장식'},{id:'EyeAccessory',label:'눈장식'},{id:'Earrings',label:'귀고리'},
];
// Later entries take covered slots from earlier ones (a cap hides hair over the head, an overall hides pants).
const PRIORITY=['Body','Head','Face','Hair','Pants','Shoes','Coat','Longcoat','Glove','Shield','Weapon','Cape','Earrings','FaceAccessory','EyeAccessory','Cap'];
export const DEFAULT_LOOK={
  m:{gender:'m',skin:2000,Face:20000,Hair:30000,Coat:1040002,Pants:1060002,Shoes:1072001},
  f:{gender:'f',skin:2000,Face:21000,Hair:31000,Coat:1041002,Pants:1061002,Shoes:1072005},
};
export const fits=(item,gender)=>item.gender==='u'||item.gender===gender;
// Hair colour is the last digit; face colour is the hundreds digit.
export const styleOf=(slot,id)=>slot==='Hair'?id-id%10:id-Math.floor(id/100)%10*100;
export const colorOf=(slot,id)=>slot==='Hair'?id%10:Math.floor(id/100)%10;
export const withColor=(slot,id,color)=>slot==='Hair'?styleOf(slot,id)+color:styleOf(slot,id)+color*100;
export const HAIR_COLORS=['#2b2724','#b8473a','#d88a35','#e1c15a','#5b8a4a','#4466aa','#8a5aa6','#8c6a4c'];
export const FACE_COLORS=['#3b3a38','#4a74b8','#c24a3e','#5d9a4a','#9a7a52','#5ab0b0','#9a6ac0','#b04a8a'];

export class Wardrobe{
  constructor(catalog){
    this.catalog=catalog;this.cache=new Map();
    this.zIndex=new Map(catalog.zmap.map((z,i)=>[z,i]));
    this.byId=new Map();for(const [slot,list]of Object.entries(catalog.items))for(const item of list)this.byId.set(item.id,{...item,slot});
    this.iconIndex={};for(const [slot,sheet]of Object.entries(catalog.icons))this.iconIndex[slot]=new Map(sheet.ids.map((id,i)=>[id,i]));
  }
  item(id){return this.byId.get(id);}
  load(id){
    if(!this.cache.has(id))this.cache.set(id,(async()=>{
      const response=await fetch(`assets/avatar/items/${id}.json`);if(!response.ok)throw new Error(`아바타 리소스 ${id}를 읽지 못했습니다.`);
      const data=await response.json(),image=new Image();image.src=`assets/avatar/items/${id}.png`;await image.decode();data.image=image;return data;
    })());
    return this.cache.get(id);
  }
  // Every item worn by a look, body and head first.
  parts(look){
    const skin=this.catalog.skins.find(s=>s.id===look.skin)??this.catalog.skins[0];
    const parts=[{slot:'Body',id:skin.id,vslot:'Bd'},{slot:'Head',id:skin.head,vslot:'Hd'}];
    for(const {id:slot}of SLOTS){const id=look[slot];if(!id)continue;const item=this.byId.get(id);if(item)parts.push({slot,id,vslot:slot==='Face'?'Fc':item.vslot,stance:item.stance});}
    return parts;
  }
  stance(look){return this.byId.get(look.Weapon)?.stance===2?2:1;}
  // kind is 'stand'/'walk' (stance-dependent) or a full action name such as 'jump', 'ladder', 'swingO1'.
  async frames(look,kind,first=false){
    const parts=this.parts(look),data=await Promise.all(parts.map(p=>this.load(p.id).catch(()=>null)));
    const action=kind==='stand'||kind==='walk'?`${kind}${this.stance(look)}`:kind,body=data[0],count=first?1:body.actions[action]?.length??1;
    const owner={};for(const slot of PRIORITY)for(const [i,p]of parts.entries())if(p.slot===slot)for(const code of (p.vslot||'').match(/../g)??[])owner[code]=i;
    const capCoversHair=look.Cap&&owner.H1!==undefined&&parts[owner.H1].slot==='Cap';
    const frames=[];
    for(let index=0;index<count;index++){
      const layers=[];
      for(const [i,p]of parts.entries()){
        const d=data[i];if(!d)continue;
        // Ladder/rope frames are seen from behind: the face and face accessories are hidden.
        if(body.faces?.[action]?.[index]===0&&['Face','FaceAccessory','EyeAccessory'].includes(p.slot))continue;
        const list=d.actions[action]??d.actions[`${kind}1`]??(d.default?.length?null:d.actions.stand1);
        const frame=list?.length?list[index%list.length]:d.default;
        for(const layer of frame??[]){
          // A layer is shown when one of its slot codes still belongs to its own item, or nobody claims them.
          const codes=(this.catalog.smap[layer.z]||'').match(/../g)??[];
          const claimed=codes.filter(c=>owner[c]!==undefined);
          if(claimed.length&&!claimed.some(c=>owner[c]===i))continue;
          // Hair ships extra "below cap" drawings that only replace the hidden parts when a cap is worn.
          if(p.slot==='Hair'&&!capCoversHair&&/BelowCap/.test(layer.n))continue;
          layers.push({...layer,image:d.image,part:i});
        }
      }
      frames.push({delay:body.delays?.[action]?.[index]??180,canvas:compose(layers,this.zIndex)});
    }
    return frames;
  }
  // Draws the item's inventory icon (equipment only) into a canvas context.
  icon(context,slot,id,x,y,images){
    const sheet=this.catalog.icons[slot],i=this.iconIndex[slot]?.get(id);if(sheet==null||i==null)return false;
    const image=images.get(sheet.src);if(!image)return false;
    context.drawImage(image,i%sheet.columns*sheet.cell,Math.floor(i/sheet.columns)*sheet.cell,sheet.cell,sheet.cell,x,y,sheet.cell,sheet.cell);return true;
  }
}
// Feet sit at (FOOT_X, FOOT_Y) in every composed frame canvas.
export const FRAME_W=200,FRAME_H=190,FOOT_X=100,FOOT_Y=150;
function compose(layers,zIndex){
  const canvas=document.createElement('canvas');canvas.width=FRAME_W;canvas.height=FRAME_H;const context=canvas.getContext('2d');context.imageSmoothingEnabled=false;
  const base=layers.find(l=>l.z==='body'&&l.part===0)??layers[0];if(!base)return canvas;
  const anchors={};base.pos=[0,0];for(const [n,v]of Object.entries(base.a))anchors[n]=v.slice();
  for(let pass=0;pass<6;pass++)for(const layer of layers){if(layer.pos)continue;for(const [n,v]of Object.entries(layer.a)){if(!anchors[n])continue;layer.pos=[anchors[n][0]-v[0],anchors[n][1]-v[1]];for(const [m,w]of Object.entries(layer.a))anchors[m]??=[layer.pos[0]+w[0],layer.pos[1]+w[1]];break;}}
  // Pieces without any anchor (rare: a few accessories) are placed relative to the body origin.
  const fallback=zIndex.get('body')??0;
  layers.sort((a,b)=>(zIndex.get(b.z)??fallback)-(zIndex.get(a.z)??fallback));
  for(const l of layers){const [x,y]=l.pos??[0,0];context.drawImage(l.image,l.r[0],l.r[1],l.r[2],l.r[3],FOOT_X+x-l.o[0],FOOT_Y+y-l.o[1],l.r[2],l.r[3]);}
  return canvas;
}
