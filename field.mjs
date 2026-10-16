// Seeded top-view layouts with full original KMS map objects and preassembled mushroom buildings.
// Floor tiles repeat uniformly; the seeded scene layout stays independent of the floor.
import {buildArt} from './field-art.mjs';
import {HarborField} from './harbor-field.mjs';
import {ElliniaField} from './ellinia-field.mjs';
import {paintFloor} from './floor-tiles.mjs';
import {spaceStructures,artExtents} from './field-geometry.mjs';
const CHUNK=512,SCENE=680,SINGLE=155,PLAZA=200,ROAD_CELL=960;

function hash(x,y,seed){let h=Math.imul(x|0,374761393)^Math.imul(y|0,668265263)^Math.imul(seed,2246822519);h=Math.imul(h^h>>>13,1274126177);return ((h^h>>>16)>>>0)/4294967296;}
function rng(x,y,seed){let s=Math.floor(hash(x,y,seed)*4294967296)||1;return ()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return (s>>>0)/4294967296;};}
const SMALL=/^(flower|sunflower|clover|carrots|mush-tiny|mush-small|mush-yellow|mush-white)/;
export const START_THEMES=['village','farm','orchard','mushrooms','rest'];

export class Field{
  constructor(seed=1065){this.harbor=new HarborField(seed);this.ellinia=new ElliniaField(seed);this.byId={...buildArt(),...this.harbor.byId,...this.ellinia.byId};this.extents=artExtents(this.byId);this.stage='henesys';this.reseed(seed);}
  setStage(id){const next=['lith','ellinia'].includes(id)?id:'henesys';if(this.stage!==next){this.stage=next;this.reseed(this.seed);}}
  constrain(game){if(this.stage==='lith')this.harbor.constrain(game);}
  // Every layout cache, including the village, belongs to a run's seed.
  reseed(seed){this.seed=seed>>>0;this.harbor.reseed(seed);this.ellinia.reseed(seed);this.chunks=this.stage==='lith'?this.harbor.chunks:this.stage==='ellinia'?this.ellinia.chunks:new Map();this.sceneCache=new Map();this.singleCache=new Map();this.roadCache=new Map();this.plazaCache=null;}
  // ---------- fields ----------
  roadNode(ix,iy){const r=rng(ix,iy,this.seed+701);return ix===0&&iy===0?{x:0,y:0}:{x:ix*ROAD_CELL+(r()-.5)*360,y:iy*ROAD_CELL+(r()-.5)*360};}
  road(ix,iy,vertical){
    const key=`${ix},${iy},${vertical}`;if(this.roadCache.has(key))return this.roadCache.get(key);
    const a=this.roadNode(ix,iy),b=this.roadNode(ix+(vertical?0:1),iy+(vertical?1:0)),r=rng(ix,iy,this.seed+(vertical?720:730));
    const bend=(r()-.5)*340,dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy),nx=-dy/len,ny=dx/len;
    const c={x:a.x+dx*.32+nx*bend,y:a.y+dy*.32+ny*bend},d={x:a.x+dx*.7+nx*bend,y:a.y+dy*.7+ny*bend},points=[];
    for(let i=0;i<=20;i++){const t=i/20,u=1-t;points.push({x:u*u*u*a.x+3*u*u*t*c.x+3*u*t*t*d.x+t*t*t*b.x,y:u*u*u*a.y+3*u*u*t*c.y+3*u*t*t*d.y+t*t*t*b.y});}
    const road={points,width:58+r()*18};this.roadCache.set(key,road);if(this.roadCache.size>240)this.roadCache.delete(this.roadCache.keys().next().value);return road;
  }
  roadsNear(x,y){const ix=Math.floor(x/ROAD_CELL),iy=Math.floor(y/ROAD_CELL),out=[];for(let j=iy-1;j<=iy+1;j++)for(let i=ix-1;i<=ix+1;i++)for(const v of [false,true])out.push(this.road(i,j,v));return out;}
  pathValue(x,y,roads=this.roadsNear(x,y)){
    let distance=1e6;
    for(const road of roads){
      let squared=Infinity;
      for(let i=1;i<road.points.length;i++){
        const a=road.points[i-1],b=road.points[i],dx=b.x-a.x,dy=b.y-a.y;
        const t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1)));
        const ex=x-a.x-dx*t,ey=y-a.y-dy*t;squared=Math.min(squared,ex*ex+ey*ey);
      }
      distance=Math.min(distance,Math.sqrt(squared)-road.width/2+Field.PATH);
    }
    return distance;
  }
  static PATH=32;static RIM=2.4;
  onPath(x,y,margin=16){return this.pathValue(x,y)<Field.PATH+Field.RIM+margin||Math.hypot(x,y)<PLAZA+35;}
  // ---------- scenes ----------
  scene(mx,my){
    if(this.stage==='lith')return this.harbor.scene(mx,my);
    if(this.stage==='ellinia')return this.ellinia.scene(mx,my);
    const key=`${mx},${my}`;if(this.sceneCache.has(key))return this.sceneCache.get(key);
    const r=rng(mx,my,this.seed+21);let out=null;
    const cx=(mx+.5)*SCENE+(r()-.5)*240,cy=(my+.5)*SCENE+(r()-.5)*240;
    if(Math.hypot(cx,cy)>PLAZA+420&&r()>.12){
      const types=[['grove',26],['village',14],['farm',15],['garden',18],['mushrooms',16],['rest',11]];
      let roll=r()*types.reduce((s,t)=>s+t[1],0),type=types[0][0];for(const [t,w]of types){roll-=w;if(roll<0){type=t;break;}}
      out=this.compose(type,cx,cy,r);
      // Keep paths clear: drop props standing on a path.
      out.props=out.props.filter(p=>!this.onPath(p.x,p.y,/^(tree|house)/.test(p.id)?65:16));
    }
    this.sceneCache.set(key,out);if(this.sceneCache.size>600)this.sceneCache.delete(this.sceneCache.keys().next().value);
    return out;
  }
  compose(type,cx,cy,r){
    const props=[],decals=[],add=(id,dx,dy,flip=r()<.5)=>{if(this.byId[id])props.push({id,x:Math.round(cx+dx),y:Math.round(cy+dy),flip,phase:r()*4000});};
    const pick=list=>list[Math.floor(r()*list.length)],around=(rx,ry)=>{const a=r()*Math.PI*2,d=.55+r()*.45;return [Math.cos(a)*rx*d,Math.sin(a)*ry*d];};
    if(type==='grove'){
      decals.push({kind:'shade',x:cx,y:cy+10,rx:190,ry:110});
      if(r()<.45)add('tree-big',0,20);
      const n=2+Math.floor(r()*3);for(let i=0;i<n;i++)add('tree-apple',...around(170,90));
      for(let i=0;i<4;i++)add(pick(['bush-big','bush-small','bush-small','bush-berry']),...around(210,120));
      for(let i=0;i<4;i++)add(pick(['flower-purple','flower-orange','clover','mush-small']),...around(230,130));
    }else if(type==='village'){
      decals.push({kind:'sand',x:cx,y:cy+16,rx:150,ry:70});
      add('house-ochre',-60,0,false);if(r()<.6)add('house-red',105,-26,false);
      add('mailbox-heart',-120,20,false);add('mush-red',125,30);add('mush-orange',10,55);
      add('fence-flower',-10,95,false);add(pick(['pot-lily','pot-sunflower']),-150,60);add(pick(['pot-sunflower','pot-lily']),150,70);
      for(let i=0;i<3;i++)add(pick(['flower-orange','flower-purple2','mush-yellow']),...around(220,120));
    }else if(type==='farm'){
      decals.push({kind:'tilled',x:cx,y:cy+20,rx:130,ry:62});
      add('fence',-85,-50,false);add('fence',83,-50,false);
      for(let row=0;row<3;row++)for(let i=0;i<3;i++)if(r()<.8)add('carrots',-80+i*80+(r()-.5)*14,row*36,false);
      add(pick(['hay-stack','hay-bale','wheat']),-210,10);add(pick(['hay-small','sack','barrel']),195,-10);
      if(r()<.5)add('cart',210,70);else add('sunflower2',190,60);
      add(pick(['sunflower','sunflower3']),-200,80);
    }else if(type==='garden'){
      decals.push({kind:'bed',x:cx,y:cy,rx:170,ry:85});
      for(let i=-2;i<=2;i++)add(pick(['sunflower','sunflower2','sunflower3']),i*48+(r()-.5)*10,-40+(r()-.5)*8,false);
      for(let i=0;i<5;i++)add(pick(['flower-purple','flower-purple2','flower-orange','flower-orange2','clover']),...around(150,70));
      add('bush-berry',0,95,false);add(pick(['pot-sunflower','pot-lily']),-200,40);
      props.push({id:pick(['butterfly-pink','butterfly-yellow','butterfly-orange']),x:Math.round(cx+40),y:Math.round(cy),flip:false,phase:r()*4000});
    }else if(type==='mushrooms'){
      decals.push({kind:'shade',x:cx,y:cy+10,rx:150,ry:80});
      add('mush-red',0,0);if(r()<.5)add('mush-red',90,40);
      add('mush-cluster',-110,35);add('mush-tiny',40,70,false);
      for(let i=0;i<4;i++)add(pick(['mush-yellow','mush-white','mush-small','mush-orange']),...around(200,100));
    }else{ // rest
      decals.push({kind:'sand',x:cx,y:cy+10,rx:120,ry:56});
      add('bench',0,0,false);add('logs',-140,30);add(pick(['barrel','barrel-side']),120,20);
      add(pick(['signpost','board']),-60,-50,false);add(pick(['sack','bush-small']),150,-30);
      for(let i=0;i<3;i++)add(pick(['flower-orange','clover','bush-small']),...around(200,110));
    }
    return {type,x:cx,y:cy,props:spaceStructures(props,this.byId),decals};
  }
  // Starting scenery changes in composition, not just orientation. Every theme leaves spawn clear.
  plaza(){
    if(this.stage==='lith')return this.harbor.plaza();
    if(this.stage==='ellinia')return this.ellinia.plaza();
    if(this.plazaCache)return this.plazaCache;
    const type=START_THEMES[Math.floor(rng(0,0,this.seed+905)()*START_THEMES.length)];
    if(type!=='village'){const s=this.startLandscape(type);s.props=spaceStructures(s.props,this.byId,{start:true});return this.plazaCache=s;}
    const r=rng(0,0,this.seed+901),shift=Math.round((r()-.5)*60),bend=Math.round((r()-.5)*24),side=r()<.5?-1:1;
    const p=(id,x,y,flip=false)=>({id,x:Math.round(x*side+shift+(id.startsWith('house')?(r()-.5)*35:0)),y:Math.round(y+bend),flip,phase:r()*4096});
    const scene={type,props:[
      p('house-ochre',20,-110),p('house-red',-283,-106+r()*24),p('house-mini',290,-105+r()*30),
      p('fountain',-118,-61),p('statue-mushroom',-268,42),
      p('bench',-120,105),p('bench',125,117),p('pot-lily',-200,80),p('pot-sunflower',208,96),
      p('tree-big',-435,-50),p('tree-apple',430,-80),p('tree-apple',415,165),
      p('fence',-304,160),p('fence',305,170),
      p('sunflower2',-363,74),p('sunflower',-328,87),p('sunflower3',-296,78),p('sunflower',-238,68),
      p('sunflower',260,77),p('sunflower2',295,93),p('sunflower3',331,79),p('sunflower',369,87),
      p('flower-purple2',-328,208),p('flower-orange2',-267,216),p('clover',-205,211),p('flower-purple2',281,218),p('flower-orange2',346,207),
      p('bush-berry',-340,-35),p('bush-small',375,-28),p('mush-small',-390,215),p('mush-cluster',420,245),
      p('mailbox-heart',-211,-40),p('butterfly-yellow',-180,65),p('butterfly-pink',305,145),
    ],decals:[{kind:'plaza',x:shift,y:18,rx:PLAZA+35+r()*16,ry:132},
      {kind:'sand',x:-220*side+shift,y:-95+bend,rx:133,ry:55},{kind:'sand',x:240*side+shift,y:-85+bend,rx:146,ry:62},
      {kind:'bed',x:-300+shift,y:76+bend,rx:98,ry:40},{kind:'bed',x:310+shift,y:85+bend,rx:98,ry:40},
      {kind:'shade',x:-410+shift,y:-45,rx:140,ry:90}]};
    scene.props=spaceStructures(scene.props,this.byId,{start:true});return this.plazaCache=scene;
  }
  startLandscape(type){
    const r=rng(0,0,this.seed+951),side=r()<.5?-1:1,shift=(r()-.5)*48,dy=(r()-.5)*22;
    const props=[],decals=[],pick=ids=>ids[Math.floor(r()*ids.length)];
    const add=(id,x,y)=>props.push({id,x:Math.round(x*side+shift+(r()-.5)*12),y:Math.round(y+dy+(r()-.5)*10),flip:false,phase:r()*4096});
    const patch=(kind,x,y,rx,ry)=>decals.push({kind,x:x*side+shift,y:y+dy,rx:rx*(.94+r()*.12),ry:ry*(.94+r()*.12)});
    if(type==='farm'){
      // Separate sunflower and vegetable plots frame a grassy farmyard, not a town square.
      add(pick(['house-ochre','house-mini']),-220,-110);add('hay-stack',268,-74);add('cart',265,98);add('barrel',340,-25);add('sack',190,115);
      patch('sand',-210,-82,127,53);patch('tilled',212,-48,108,64);patch('tilled',-270,88,110,61);
      add('fence',185,-123);add('fence',-278,156);
      for(let row=0;row<3;row++)for(let col=0;col<2;col++){add('carrots',174+col*77,-86+row*35);add('carrots',-312+col*77,43+row*35);}
      for(let i=0;i<5;i++)add(pick(['sunflower','sunflower2','sunflower3']),-365+i*43,-35+r()*15);
      add('wheat',365,120);add('hay-small',65,-128);add('flower-orange2',-145,180);add('clover',130,204);add('butterfly-yellow',-260,10);
    }else if(type==='orchard'){
      patch('shade',-265,-40,170,130);patch('shade',260,35,190,140);patch('sand',-170,118,110,50);
      for(const [x,y]of [[-340,-105],[-192,-132],[175,-121],[333,-72],[-340,75],[290,130]])add('tree-apple',x,y);
      add('tree-big',-435,-30);add('bench',-157,120);add('cart',190,15);add('barrel',298,25);add('sack',350,48);add('logs',-325,168);
      add('fence',-300,217);add('fence',294,220);add('bush-berry',-206,25);add('bush-berry',180,178);
      for(let i=0;i<5;i++)add(pick(['clover','flower-orange2','mush-small']),-365+i*170,250+r()*18);
      add('butterfly-pink',-280,25);add('butterfly-yellow',200,100);
    }else if(type==='mushrooms'){
      // No buildings or paving: a woodland clearing with several scales of mushrooms.
      patch('shade',-270,-25,215,140);patch('shade',280,-40,205,140);
      add('tree-big',-300,-102);add('tree-big',315,-74);add('tree-apple',425,180);add('logs',-325,142);
      add('mush-red',-210,24);add('mush-red',215,-99);add('mush-cluster',245,114);add('mush-orange',-175,-110);add('mush-tiny',-190,205);
      add('bush-big',-420,200);add('bush-berry',375,76);
      for(let i=0;i<9;i++){const a=(i/9)*Math.PI*2;add(pick(['mush-yellow','mush-white','mush-small','mush-cluster']),Math.cos(a)*(235+r()*90),Math.sin(a)*(160+r()*70));}
      add('flower-purple2',-190,109);add('flower-purple',180,210);add('butterfly-pink',165,24);
    }else{
      // An open flower garden with small seating areas, keeping the centre a meadow.
      patch('sand',-230,60,115,53);patch('sand',235,-52,110,55);patch('bed',-255,-90,135,51);patch('bed',285,130,135,56);
      add('bench',-234,63);add('bench',230,-60);add('fountain',-166,-111);add('tree-big',-438,-54);add('tree-apple',395,-80);
      add('fence-flower',-263,145);add('fence-flower',277,228);add('pot-lily',140,-34);add('pot-sunflower',-130,87);
      for(let i=0;i<5;i++){add(pick(['sunflower','sunflower2','sunflower3']),-357+i*46,-70+r()*15);add(pick(['flower-purple2','flower-orange2','clover']),190+i*45,142+r()*20);}
      add('bush-berry',-360,220);add('mush-white',415,232);add('butterfly-yellow',-245,-35);add('butterfly-pink',220,118);
    }
    // A few seed-dependent accents change each layout without blocking the central spawn.
    for(const s of [-1,1])add(pick(['flower-orange2','flower-purple2','mush-small','clover']),s*(120+r()*50),-80-r()*45);
    return {type,props,decals};
  }
  single(sx,sy){
    const key=`${sx},${sy}`;if(this.singleCache.has(key))return this.singleCache.get(key);
    const r=rng(sx,sy,this.seed+33),x=Math.round((sx+.2+r()*.6)*SINGLE),y=Math.round((sy+.2+r()*.6)*SINGLE);let out=null;
    if(r()<.16&&!this.onPath(x,y)&&Math.hypot(x,y)>PLAZA+200){
      const near=this.scene(Math.floor(x/SCENE),Math.floor(y/SCENE));
      if(!near||Math.hypot(near.x-x,near.y-y)>300){
        const ids=['bush-small','bush-small','flower-purple','flower-orange','flower-orange2','clover','mush-small','mush-yellow','sunflower','butterfly-pink','butterfly-yellow'];
        out={id:ids[Math.floor(r()*ids.length)],x,y,flip:r()<.5,phase:r()*4000};
      }
    }
    this.singleCache.set(key,out);if(this.singleCache.size>5000)this.singleCache.delete(this.singleCache.keys().next().value);
    return out;
  }
  scenesNear(left,top,right,bottom){
    if(this.stage==='lith')return this.harbor.scenesNear(left,top,right,bottom);
    if(this.stage==='ellinia')return this.ellinia.scenesNear(left,top,right,bottom);
    const out=[];if(left<PLAZA+500&&right>-PLAZA-500&&top<PLAZA+500&&bottom>-PLAZA-500)out.push(this.plaza());
    for(let my=Math.floor((top-300)/SCENE);my<=Math.floor((bottom+300)/SCENE);my++)for(let mx=Math.floor((left-300)/SCENE);mx<=Math.floor((right+300)/SCENE);mx++){const s=this.scene(mx,my);if(s)out.push(s);}
    return out;
  }
  propsIn(left,top,right,bottom){
    if(this.stage==='lith')return this.harbor.propsIn(left,top,right,bottom);
    if(this.stage==='ellinia')return this.ellinia.propsIn(left,top,right,bottom);
    const out=[],wrap=p=>{const prop=this.byId[p.id];if(prop)prop.id=p.id;if(prop)out.push({...p,prop,kind:p.id.startsWith('butterfly')?'critter':SMALL.test(p.id)?'small':/^(fountain|house-village)$/.test(p.id)?'landmark':'big'});};
    for(const s of this.scenesNear(left,top,right,bottom))for(const p of s.props)wrap(p);
    for(let sy=Math.floor(top/SINGLE)-1;sy<=Math.floor(bottom/SINGLE)+1;sy++)for(let sx=Math.floor(left/SINGLE)-1;sx<=Math.floor(right/SINGLE)+1;sx++){const p=this.single(sx,sy);if(p)wrap(p);}
    return out;
  }
  // ---------- uniform floor ----------
  chunk(cx,cy){
    if(this.stage==='lith')return this.harbor.chunk(cx,cy);
    if(this.stage==='ellinia')return this.ellinia.chunk(cx,cy);
    const key=`${cx},${cy}`;if(this.chunks.has(key))return this.chunks.get(key);
    const c=document.createElement('canvas');c.width=c.height=CHUNK;
    paintFloor(c.getContext('2d'),'henesys',cx*CHUNK,cy*CHUNK);
    this.chunks.set(key,c);if(this.chunks.size>48)this.chunks.delete(this.chunks.keys().next().value);
    return c;
  }
  drawGround(ctx,camX,camY,w,h){
    if(this.stage==='lith'){this.harbor.drawGround(ctx,camX,camY,w,h);return;}
    if(this.stage==='ellinia'){this.ellinia.drawGround(ctx,camX,camY,w,h);return;}
    const left=camX-w/2,top=camY-h/2;
    for(let cy=Math.floor(top/CHUNK);cy<=Math.floor((top+h)/CHUNK);cy++)for(let cx=Math.floor(left/CHUNK);cx<=Math.floor((left+w)/CHUNK);cx++)
      ctx.drawImage(this.chunk(cx,cy),Math.round(cx*CHUNK-left),Math.round(cy*CHUNK-top));
  }
}
