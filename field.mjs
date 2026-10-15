// Seeded top-view layouts with full original KMS map objects and preassembled mushroom buildings.
// Ground-plane geometry is adapted for free movement; native tile textures dress the village squares.
import {buildArt} from './field-art.mjs';
import {HarborField} from './harbor-field.mjs';
import {ElliniaField} from './ellinia-field.mjs';
import {nativeTexture} from './native-field-art.mjs';
import {spaceStructures,artExtents} from './field-geometry.mjs';
const CHUNK=512,GRID=8,SCENE=680,SINGLE=155,PLAZA=200,ROAD_CELL=960;

function hash(x,y,seed){let h=Math.imul(x|0,374761393)^Math.imul(y|0,668265263)^Math.imul(seed,2246822519);h=Math.imul(h^h>>>13,1274126177);return ((h^h>>>16)>>>0)/4294967296;}
function rng(x,y,seed){let s=Math.floor(hash(x,y,seed)*4294967296)||1;return ()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return (s>>>0)/4294967296;};}
const smooth=t=>t*t*(3-2*t);
function noise(x,y,seed){
  const xi=Math.floor(x),yi=Math.floor(y),xf=smooth(x-xi),yf=smooth(y-yi);
  const a=hash(xi,yi,seed),b=hash(xi+1,yi,seed),c=hash(xi,yi+1,seed),d=hash(xi+1,yi+1,seed);
  return a+(b-a)*xf+(c-a)*yf+(a-b-c+d)*xf*yf;
}
function fbm(x,y,seed,octaves){let v=0,amp=.5,f=1,sum=0;for(let i=0;i<octaves;i++){v+=noise(x*f,y*f,seed+i*101)*amp;sum+=amp;f*=2.07;amp*=.45;}return v/sum;}
const clamp01=v=>v<0?0:v>1?1:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const mix=(a,b,t)=>[lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)];
const hex=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];

// Henesys palette: fresh yellow-greens, creamy sand, warm brown soil.
const C={
  grassDark:hex('#84b151'),grass:hex('#99bf61'),grassLight:hex('#afcf77'),shade:hex('#6d9849'),
  sand:hex('#e6cc91'),sandLight:hex('#f0dca8'),rim:hex('#baa16b'),rimShadow:hex('#78964a'),
  soil:hex('#b98a55'),soilDark:hex('#9a6f40'),bed:hex('#7cbf4a'),stone:hex('#e3d6b8'),
};
const SMALL=/^(flower|sunflower|clover|carrots|mush-tiny|mush-small|mush-yellow|mush-white)/;
export const START_THEMES=['village','farm','orchard','mushrooms','rest'];

export class Field{
  constructor(seed=1065){this.harbor=new HarborField(seed);this.ellinia=new ElliniaField(seed);this.byId={...buildArt(),...this.harbor.byId,...this.ellinia.byId};this.extents=artExtents(this.byId);this.stage='henesys';this.reseed(seed);}
  setStage(id){const next=['lith','ellinia'].includes(id)?id:'henesys';if(this.stage!==next){this.stage=next;this.reseed(this.seed);}}
  constrain(game){if(this.stage==='lith')this.harbor.constrain(game);}
  // Every layout cache, including the village, belongs to a run's seed.
  reseed(seed){this.seed=seed>>>0;this.harbor.reseed(seed);this.ellinia.reseed(seed);this.chunks=this.stage==='lith'?this.harbor.chunks:this.stage==='ellinia'?this.ellinia.chunks:new Map();this.sceneCache=new Map();this.singleCache=new Map();this.roadCache=new Map();this.plazaCache=null;}
  // ---------- fields ----------
  band(x,y){return fbm(x/420,y/420,this.seed,2)*.8+fbm(x/90,y/90,this.seed+50,1)*.2;}
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
  // ---------- ground ----------
  chunk(cx,cy){
    if(this.stage==='lith')return this.harbor.chunk(cx,cy);
    if(this.stage==='ellinia')return this.ellinia.chunk(cx,cy);
    const key=`${cx},${cy}`;let c=this.chunks.get(key);if(c)return c;
    const x0=cx*CHUNK,y0=cy*CHUNK,n=CHUNK/GRID+1,bandG=new Float32Array(n*n),pathG=new Float32Array(n*n);
    const roads=this.roadsNear(x0+CHUNK/2,y0+CHUNK/2);
    for(let j=0;j<n;j++)for(let i=0;i<n;i++){const wx=x0+i*GRID,wy=y0+j*GRID;bandG[j*n+i]=this.band(wx,wy);pathG[j*n+i]=this.pathValue(wx,wy,roads);}
    const decals=this.scenesNear(x0,y0,x0+CHUNK,y0+CHUNK).flatMap(s=>s.decals).filter(d=>d.x+d.rx>x0-20&&d.x-d.rx<x0+CHUNK+20&&d.y+d.ry>y0-20&&d.y-d.ry<y0+CHUNK+20);
    c=document.createElement('canvas');c.width=c.height=CHUNK;const ctx=c.getContext('2d'),img=ctx.createImageData(CHUNK,CHUNK),px=img.data;
    const P=Field.PATH,R=Field.RIM;
    for(let y=0;y<CHUNK;y++){
      const gy=y/GRID,j=Math.floor(gy),fy=gy-j;
      for(let x=0;x<CHUNK;x++){
        const gx=x/GRID,i=Math.floor(gx),fx=gx-i,k=j*n+i;
        const b=lerp(lerp(bandG[k],bandG[k+1],fx),lerp(bandG[k+n],bandG[k+n+1],fx),fy);
        const pv=lerp(lerp(pathG[k],pathG[k+1],fx),lerp(pathG[k+n],pathG[k+n+1],fx),fy);
        // Cel-shaded grass: three bands with narrow soft edges.
        let col=mix(C.grassDark,C.grass,clamp01((b-.4)/.07));col=mix(col,C.grassLight,clamp01((b-.6)/.07));
        const wx=x0+x,wy=y0+y;
        // A single signed-distance union for road and village sand avoids rims across a plaza.
        let sandDistance=pv-P;
        for(const d of decals){
          const dx=(wx-d.x)/d.rx,dy=(wy-d.y)/d.ry,e=dx*dx+dy*dy;if(e>1.15)continue;
          const edge=1-clamp01((Math.sqrt(e)-.9)/.1);
          if(d.kind==='shade')col=mix(col,C.shade,.45*smooth(clamp01((1-Math.sqrt(e))*1.6)));
          else if(d.kind==='bed'){if(e<1)col=mix(col,C.bed,edge);}
          else if(d.kind==='tilled'){if(e<1){const furrow=.5+.5*Math.sin((wy-d.y)/6);col=mix(mix(C.soil,C.soilDark,furrow*.7),C.rim,e>.8?(e-.8)*3:0);}}
          else if(d.kind==='sand'||d.kind==='plaza')sandDistance=Math.min(sandDistance,(Math.sqrt(e)-1)*Math.min(d.rx,d.ry));
        }
        if(sandDistance<R)col=sandDistance<0?mix(C.sand,C.sandLight,.28*clamp01(-sandDistance/25)):C.rim;
        else if(sandDistance<R+2)col=mix(col,C.rimShadow,.35);
        const o=(y*CHUNK+x)*4,grain=(hash(wx,wy,this.seed+3)-.5)*5;
        px[o]=col[0]+grain;px[o+1]=col[1]+grain;px[o+2]=col[2]+grain*.5;px[o+3]=255;
      }
    }
    ctx.putImageData(img,0,0);
    ctx.save();ctx.translate(-x0,-y0);ctx.globalAlpha=.36;ctx.fillStyle=nativeTexture(ctx,'henesys')??'#e6d8b6';
    for(const d of decals)if(d.kind==='plaza'){ctx.beginPath();ctx.ellipse(d.x,d.y,d.rx-7,d.ry-7,0,0,Math.PI*2);ctx.fill();}
    ctx.restore();
    this.paintDetails(ctx,x0,y0,decals);
    this.chunks.set(key,c);if(this.chunks.size>48)this.chunks.delete(this.chunks.keys().next().value);
    return c;
  }
  insideDecal(decals,wx,wy,kinds){return decals.some(d=>kinds.includes(d.kind)&&((wx-d.x)/d.rx)**2+((wy-d.y)/d.ry)**2<1);}
  // Crisp cartoon details: grass tufts, clovers, daisies; pebbles on sand; flowers packed into beds.
  paintDetails(ctx,x0,y0,decals){
    const r=rng(x0,y0,this.seed+5),roads=this.roadsNear(x0+CHUNK/2,y0+CHUNK/2);
    const tuft=(x,y,s=1)=>{
      ctx.fillStyle='#6b9645';
      for(const [dx,h,lean]of [[-3.2,7,-2.2],[0,10,0],[3.2,7.5,2.4]]){ctx.beginPath();ctx.moveTo(x+dx*s-2*s,y);ctx.quadraticCurveTo(x+(dx+lean*.4)*s,y-h*.55*s,x+(dx+lean)*s,y-h*s);ctx.quadraticCurveTo(x+(dx+lean*.2)*s+1*s,y-h*.45*s,x+dx*s+2*s,y);ctx.fill();}
      ctx.fillStyle='#c3d987';ctx.fillRect(Math.round(x-.5),Math.round(y-9*s),1,2);
    };
    const flower=(x,y,petal,center='#ffd84a',size=2)=>{
      ctx.fillStyle='rgba(60,110,40,.35)';ctx.beginPath();ctx.arc(x,y+1,size*1.9,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=petal;for(let i=0;i<5;i++){const a=i*1.2566-1.57;ctx.beginPath();ctx.arc(x+Math.cos(a)*size,y+Math.sin(a)*size,size*.85,0,Math.PI*2);ctx.fill();}
      ctx.fillStyle=center;ctx.beginPath();ctx.arc(x,y,size*.7,0,Math.PI*2);ctx.fill();
    };
    const clover=(x,y)=>{ctx.fillStyle='#5fae3b';for(let i=0;i<3;i++){const a=i*2.094-1.57;ctx.beginPath();ctx.arc(x+Math.cos(a)*2.6,y+Math.sin(a)*2.6,2.4,0,Math.PI*2);ctx.fill();}ctx.fillStyle='#9ddc63';ctx.fillRect(x-1,y-3,1,1);};
    const pebble=(x,y)=>{ctx.fillStyle='#c9a46c';ctx.beginPath();ctx.ellipse(x,y+1,3.4,2.2,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff6dc';ctx.beginPath();ctx.ellipse(x,y,3,1.9,0,0,Math.PI*2);ctx.fill();};
    const PETALS=['#ffffff','#ffffff','#ffb3d1','#fff27a','#d4b8ff','#ffc078'];
    for(let k=0;k<230;k++){
      const x=r()*CHUNK,y=r()*CHUNK,wx=x0+x,wy=y0+y,roll=r();
      if(this.pathValue(wx,wy,roads)<Field.PATH+Field.RIM+2||this.insideDecal(decals,wx,wy,['sand','plaza','tilled'])){
        if(roll<.12)pebble(x,y);
        continue;
      }
      if(this.insideDecal(decals,wx,wy,['bed'])){flower(x,y,PETALS[Math.floor(r()*PETALS.length)],'#ffd84a',2.3);flower(x+6,y+4,PETALS[Math.floor(r()*PETALS.length)],'#ffd84a',2);continue;}
      if(roll<.45)tuft(x,y,.45+r()*.35);
      else if(roll<.6)clover(x,y);
      else if(roll<.72)flower(x,y,PETALS[Math.floor(r()*PETALS.length)]);
    }
    // Grass leaning over the path edges.
    for(let k=0;k<160;k++){const x=r()*CHUNK,y=r()*CHUNK,pv=this.pathValue(x0+x,y0+y,roads);if(pv>Field.PATH+Field.RIM&&pv<Field.PATH+Field.RIM+6)tuft(x,y+2,.7);}
    // Loose stepping stones lead from cottage doors. World positions remain stable across chunks.
    for(const s of this.scenesNear(x0-100,y0-100,x0+CHUNK+100,y0+CHUNK+100))for(const p of s.props)if(p.id.startsWith('house')){
      for(let i=0;i<4;i++){const x=p.x+Math.sin(i*2)*4-x0,y=p.y+14+i*13-y0;if(x<-12||y<-8||x>CHUNK+12||y>CHUNK+8)continue;
        ctx.fillStyle='#a89974';ctx.beginPath();ctx.ellipse(x,y+1,8-i*.7,3.8,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#e8ddbe';ctx.beginPath();ctx.ellipse(x,y,7-i*.7,3.2,0,0,Math.PI*2);ctx.fill();}
    }
  }
  drawGround(ctx,camX,camY,w,h){
    if(this.stage==='lith'){this.harbor.drawGround(ctx,camX,camY,w,h);return;}
    if(this.stage==='ellinia'){this.ellinia.drawGround(ctx,camX,camY,w,h);return;}
    const left=camX-w/2,top=camY-h/2;
    for(let cy=Math.floor(top/CHUNK);cy<=Math.floor((top+h)/CHUNK);cy++)for(let cx=Math.floor(left/CHUNK);cx<=Math.floor((left+w)/CHUNK);cx++)
      ctx.drawImage(this.chunk(cx,cy),Math.round(cx*CHUNK-left),Math.round(cy*CHUNK-top));
  }
}
