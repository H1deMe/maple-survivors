// Ellinia's original houses, vines and wooden bridges in a seeded, freely walkable forest.
import {nativeGroup} from './native-field-art.mjs';
import {paintFloor} from './floor-tiles.mjs';
import {spaceStructures,propBounds,intersects} from './field-geometry.mjs';
const CHUNK=512,CELL=860,SCENE=880,TAU=Math.PI*2;
export const ELLINIA_STARTS=['village','grove','bridges','bellflowers','watermill'];
function hash(x,y,seed){let h=Math.imul(x|0,374761393)^Math.imul(y|0,668265263)^Math.imul(seed,2246822519);h=Math.imul(h^h>>>13,1274126177);return ((h^h>>>16)>>>0)/2**32;}
function rng(x,y,seed){let s=(hash(x,y,seed)*2**32)>>>0||1;return ()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return (s>>>0)/2**32;};}
function cache(map,key,value,max){map.set(key,value);if(map.size>max)map.delete(map.keys().next().value);return value;}
export class ElliniaField{
  constructor(seed=1065){this.byId=nativeGroup('ellinia');this.reseed(seed);}
  reseed(seed){this.seed=seed>>>0;this.phase=hash(0,0,this.seed+821)*TAU;this.chunks=new Map();this.sceneCache=new Map();this.plazaCache=null;}
  // Both winding trail families cross the clearing and continue beyond every chunk boundary.
  trail(x,y){
    const p=this.phase,h=(Math.sin(x/315+p)-Math.sin(p))*64,v=(Math.sin(y/365+p*1.7)-Math.sin(p*1.7))*70;
    return Math.min(Math.abs(y-Math.round(y/CELL)*CELL-h),Math.abs(x-Math.round(x/CELL)*CELL-v))-30;
  }
  compose(type,cx,cy,r,start=false){
    const props=[],decals=[],side=r()<.5?-1:1,pick=ids=>ids[Math.floor(r()*ids.length)];
    const add=(id,x,y)=>props.push({id:`ellinia-${id}`,x:Math.round(cx+x*side+(r()-.5)*18),y:Math.round(cy+y+(r()-.5)*14),flip:false,phase:r()*6000});
    const patch=(kind,x,y,rx,ry)=>decals.push({kind,x:cx+x*side,y:cy+y,rx,ry});
    patch('clearing',0,12,205+r()*25,122+r()*16);
    if(type==='village'){
      add('house-blue',-255,-20);add('house-round',250,-30);add('house-red',15,-115);
      add('tree',-440,170);add('tree-twisted',435,155);
      add('bridge',-225,175);add('bellflower',170,90);add('bellflower',-110,-120);
      patch('moss',-255,15,180,90);patch('moss',250,-15,170,85);
    }else if(type==='grove'){
      add('tree',-245,80);add('tree-twisted',265,110);add('tree',-420,240);add('house-green',410,-20);
      add('branch',-230,170);add('branch-lean',230,192);add('bellflower',-150,70);add('bluebud',150,-115);
      patch('shade',-265,15,180,105);patch('shade',270,30,175,100);
    }else if(type==='bridges'){
      add('house-narrow',-275,-60);add('house-green',245,-65);add('tree-twisted',-445,180);
      add('bridge',-255,165);add('bridge-up',255,145);add('tree',440,225);
      add('bellflower',-135,60);add('bluebud',145,50);
      patch('moss',-255,115,180,83);patch('moss',245,105,180,80);
    }else if(type==='bellflowers'){
      add('tree-twisted',-345,80);add('house-clock',300,-70);add('tree',425,190);add('branch',-260,195);
      for(let i=0;i<7;i++)add(i%2?'bluebud':'bellflower',-270+i*88,135+Math.sin(i*1.7)*75);
      add('bellflower',-165,-122);add('bluebud',165,-118);
      patch('moss',-230,115,160,100);patch('moss',235,120,165,92);
    }else{
      add('mill',-235,-35);add('house-clock',235,-35);add('tree',-445,105);add('tree-twisted',435,170);
      add('bridge-up',-250,165);add('branch',240,140);add('bellflower',-125,55);add('bellflower',160,-125);
      patch('moss',-230,-30,160,90);patch('moss',230,45,150,85);
    }
    // Low leaf clusters follow the edges, never filling the central combat/arrival space.
    for(let i=0;i<12;i++){
      const a=i/12*TAU,x=Math.cos(a)*(300+r()*110),y=Math.sin(a)*(190+r()*55)+20;
      add(pick(['ferns','shrub','leaves','vine','sprout']),x,y);
    }
    const placed=spaceStructures(props,this.byId,{start});
    const arrival={left:cx-75,right:cx+75,top:cy-85,bottom:cy+35};
    return {type,x:cx,y:cy,props:start?placed.filter(p=>!intersects(propBounds(p,this.byId[p.id]),arrival)):placed,decals};
  }
  plaza(){
    if(this.plazaCache)return this.plazaCache;
    const r=rng(0,0,this.seed+901),type=ELLINIA_STARTS[Math.floor(r()*ELLINIA_STARTS.length)];
    return this.plazaCache=this.compose(type,0,0,r,true);
  }
  scene(ix,iy){
    const key=`${ix},${iy}`;if(this.sceneCache.has(key))return this.sceneCache.get(key);
    const r=rng(ix,iy,this.seed+51),x=(ix+.5)*SCENE+(r()-.5)*170,y=(iy+.5)*SCENE+(r()-.5)*150;
    const s=Math.hypot(x,y)>1000&&r()>.13?this.compose(ELLINIA_STARTS[Math.floor(r()*5)],x,y,r):null;
    return cache(this.sceneCache,key,s,180);
  }
  scenesNear(left,top,right,bottom){
    const out=[];if(left<750&&right>-750&&top<550&&bottom>-650)out.push(this.plaza());
    for(let j=Math.floor((top-480)/SCENE);j<=Math.ceil((bottom+480)/SCENE);j++)for(let i=Math.floor((left-520)/SCENE);i<=Math.ceil((right+520)/SCENE);i++){const s=this.scene(i,j);if(s)out.push(s);}
    return out;
  }
  propsIn(left,top,right,bottom){
    const props=this.scenesNear(left,top,right,bottom).flatMap(s=>s.props);
    for(let j=Math.floor(top/205)-1;j<=Math.ceil(bottom/205);j++)for(let i=Math.floor(left/205)-1;i<=Math.ceil(right/205);i++){
      const r=rng(i,j,this.seed+111),x=(i+.2+r()*.6)*205,y=(j+.2+r()*.6)*205;
      if(Math.hypot(x,y)<670||r()>.36||this.trail(x,y)<24)continue;
      const ids=['shrub','leaves','bluebud','bellflower','ferns','tree-twisted'];
      props.push({id:`ellinia-${ids[Math.floor(r()*ids.length)]}`,x:Math.round(x),y:Math.round(y),flip:false,phase:r()*6000});
    }
    return props.map(p=>({...p,prop:this.byId[p.id],kind:/leaves|sprout|vine/.test(p.id)?'small':'big'}));
  }
  chunk(ix,iy){
    const key=`${ix},${iy}`;if(this.chunks.has(key))return this.chunks.get(key);
    const c=document.createElement('canvas');c.width=c.height=CHUNK;
    paintFloor(c.getContext('2d'),'ellinia',ix*CHUNK,iy*CHUNK);
    return cache(this.chunks,key,c,48);
  }
  drawGround(ctx,camX,camY,w,h){
    const left=camX-w/2,top=camY-h/2;
    for(let j=Math.floor(top/CHUNK);j<=Math.floor((top+h)/CHUNK);j++)for(let i=Math.floor(left/CHUNK);i<=Math.floor((left+w)/CHUNK);i++)ctx.drawImage(this.chunk(i,j),Math.round(i*CHUNK-left),Math.round(j*CHUNK-top));
    // Object shadows are a separate scenery layer; the underlying floor remains identical everywhere.
    ctx.save();ctx.translate(-left,-top);ctx.fillStyle='rgba(23,62,42,.18)';
    for(const p of this.scenesNear(left-120,top-20,left+w+120,top+h+20).flatMap(s=>s.props))if(/house-|tree|mill/.test(p.id)){
      ctx.beginPath();ctx.ellipse(p.x,p.y,this.byId[p.id].w*.35,12,0,0,TAU);ctx.fill();
    }
    ctx.restore();
  }
}
