import {buildHarborArt} from './harbor-art.mjs';
import {paintFloor} from './floor-tiles.mjs';
import {spaceStructures} from './field-geometry.mjs';
const CHUNK=512,CELL=820,SCENE=720,TAU=Math.PI*2;
export const HARBOR_STARTS=['quay','village','shipyard','market','beach'];
function hash(x,y,seed){let h=Math.imul(x|0,374761393)^Math.imul(y|0,668265263)^Math.imul(seed,2246822519);h=Math.imul(h^h>>>13,1274126177);return ((h^h>>>16)>>>0)/4294967296;}
function rng(x,y,seed){let s=(hash(x,y,seed)*2**32)>>>0||1;return ()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return (s>>>0)/2**32;};}
function cache(map,key,value,max){map.set(key,value);if(map.size>max)map.delete(map.keys().next().value);return value;}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export class HarborField{
  constructor(seed=1065,art=buildHarborArt()){this.byId=art;this.reseed(seed);}
  reseed(seed){this.seed=seed>>>0;this.coastOffset=0;this.phase=hash(0,0,this.seed+11)*TAU;this.chunks=new Map();this.sceneCache=new Map();this.dockCache=new Map();this.plazaCache=null;this.seenMobs=new WeakSet();}
  placeCoastNear(y){if(this.coastOffset===y)return;this.coastOffset=y;this.chunks.clear();this.sceneCache.clear();this.dockCache.clear();this.plazaCache=null;this.seenMobs=new WeakSet();}
  shoreY(x){return this.coastOffset+115+Math.sin(x/590+this.phase)*42+Math.sin(x/217+this.phase*.7)*13;}
  dock(i){
    if(this.dockCache.has(i))return this.dockCache.get(i);
    const r=rng(i,0,this.seed+23);if(i!==0&&r()<.3)return cache(this.dockCache,i,null,100);
    const side=r()<.5?-1:1,x=i===0?side*(200+r()*55):i*CELL+(r()-.5)*260,w=105+r()*34,y=this.shoreY(x)-54;
    return cache(this.dockCache,i,{x:x-w/2,y,w,h:167+r()*42},100);
  }
  docksNear(left,right){const out=[];for(let i=Math.floor(left/CELL)-1;i<=Math.ceil(right/CELL)+1;i++){const d=this.dock(i);if(d&&d.x+d.w+30>left&&d.x-30<right)out.push(d);}return out;}
  walkable(x,y){return y<=this.shoreY(x)-9||this.docksNear(x-8,x+8).some(d=>x>=d.x+7&&x<=d.x+d.w-7&&y>=d.y&&y<=d.y+d.h-9);}
  constrainPosition(p){
    if(this.walkable(p.x,p.y))return;
    let bestX=p.x,bestY=this.shoreY(p.x)-10,best=(p.y-bestY)**2;
    for(const d of this.docksNear(p.x-230,p.x+230)){
      const x=clamp(p.x,d.x+8,d.x+d.w-8),y=clamp(p.y,d.y,d.y+d.h-10),dist=(p.x-x)**2+(p.y-y)**2;
      if(dist<best){best=dist;bestX=x;bestY=y;}
    }
    p.x=bestX;p.y=bestY;
  }
  constrain(game){
    this.constrainPosition(game.player);
    for(const m of game.mobs){
      // A new enemy rolled on the sea side enters from an off-screen part of the beach instead.
      if(!this.seenMobs.has(m)){
        this.seenMobs.add(m);
        if(!this.walkable(m.x,m.y)){const side=m.x<game.player.x?-1:1;m.x=game.player.x+side*(game.view.w/2+140);m.y=Math.min(m.y,this.shoreY(m.x)-28);}
      }
      this.constrainPosition(m);
    }
    for(const d of game.drops)this.constrainPosition(d);
  }
  compose(type,cx,cy,r,start=false){
    const props=[],decals=[],side=r()<.5?-1:1,pick=ids=>ids[Math.floor(r()*ids.length)];
    const add=(id,x,y)=>props.push({id,x:Math.round(cx+x*side+(r()-.5)*14),y:Math.round(cy+y+(r()-.5)*10),flip:false,phase:r()*4000});
    const patch=(kind,x,y,rx,ry)=>decals.push({kind,x:cx+x*side,y:cy+y,rx,ry});
    if(type==='quay'){
      patch('paving',0,-72,249,99);add('harbor-house',-205,-100);add('harbor-cottage',90,-150);add('harbor-arch',290,-95);
      add('harbor-crates',-330,65);add('harbor-barrels',316,58);add('harbor-lamp',-125,-65);add('harbor-lamp',240,83);add('harbor-rope',-234,120);
      add('harbor-palm',-390,40);add('harbor-palm-lean',393,-55);add('harbor-net',340,136);
    }else if(type==='village'){
      patch('paving',-60,-94,273,90);add('harbor-house',-244,-112);add('harbor-cottage',-5,-143);add('harbor-house',225,-105);
      add('harbor-palm',355,43);add('harbor-palm-lean',-425,-95);add('harbor-lamp',-120,-56);
      add('harbor-barrels',252,107);add('harbor-crates',-235,109);add('harbor-fence',-327,160);add('harbor-rope',130,117);
    }else if(type==='shipyard'){
      patch('paving',230,-71,149,74);add('harbor-cottage',-273,-116);add('harbor-crane',238,-66);add('harbor-hull',-224,68);
      add('harbor-crates',-387,115);add('harbor-barrels',354,105);add('harbor-net',144,96);add('harbor-rope',-136,-97);add('harbor-palm',-425,-47);add('harbor-lamp',357,-51);
      add('harbor-fence',-266,176);add('harbor-grass',98,-137);
    }else if(type==='market'){
      patch('paving',0,-96,338,72);add('harbor-stall',-235,-92);add('harbor-stall',220,-89);add('harbor-cottage',-2,-173);
      add('harbor-crates',-350,102);add('harbor-barrels',312,95);add('harbor-net',-162,105);add('harbor-rope',179,129);add('harbor-palm',-420,-57);add('harbor-palm-lean',419,13);
      add('harbor-lamp',-120,-52);add('harbor-lamp',119,-57);add('harbor-fence',-290,177);
    }else{
      patch('dune',-260,-65,170,88);patch('dune',260,-107,200,93);
      add('harbor-palm',-258,-74);add('harbor-palm-lean',276,-106);add('harbor-palm',-406,103);add('harbor-rock',230,84);add('harbor-hull',-243,132);
      add('harbor-grass',-165,-112);add('harbor-grass',173,-142);add('harbor-rope',134,74);add('harbor-rope',-142,43);add('harbor-net',343,68);add('harbor-rope',-350,107);
    }
    for(let i=0;i<(start?8:4);i++){const angle=r()*TAU;add(pick(['harbor-grass','harbor-rope','harbor-rock']),Math.cos(angle)*(285+r()*140),Math.sin(angle)*95+48);}
    // Ordinary scenes stay inland. Starting scenes deliberately frame the shore and quays.
    const placed=props.filter(p=>start?!(Math.abs(p.x)<100&&p.y>-100&&p.y<85):p.y<this.shoreY(p.x)-12);
    for(const p of placed)p.y=Math.min(p.y,this.shoreY(p.x)-18);
    return {type,x:cx,y:cy,props:spaceStructures(start?placed.filter(p=>!(Math.abs(p.x)<100&&p.y>-100&&p.y<85)):placed,this.byId,{start,shoreY:x=>this.shoreY(x)}),decals};
  }
  plaza(){
    if(this.plazaCache)return this.plazaCache;
    const r=rng(0,0,this.seed+901),type=HARBOR_STARTS[Math.floor(r()*HARBOR_STARTS.length)];
    const scene=this.compose(type,(r()-.5)*35,-6+r()*12,r,true),dock=this.dock(0);
    if(dock){
      const x=dock.x+dock.w/2,sy=this.shoreY(x);
      scene.props.push({id:'harbor-boat',x:clamp(x+(x<0?-130:130),-320,320),y:sy+133,flip:x>0,phase:0},
        {id:'harbor-bollard',x:dock.x+5,y:dock.y+dock.h-5,flip:false,phase:0},
        {id:'harbor-bollard',x:dock.x+dock.w-5,y:dock.y+dock.h-5,flip:false,phase:0});
    }
    return this.plazaCache=scene;
  }
  scene(ix,iy){
    const key=`${ix},${iy}`;if(this.sceneCache.has(key))return this.sceneCache.get(key);
    const r=rng(ix,iy,this.seed+71),x=(ix+.5)*SCENE+(r()-.5)*220,y=(iy+.5)*SCENE+(r()-.5)*150;
    let s=null;if(Math.hypot(x,y)>660&&y<this.shoreY(x)-185&&r()>.12)s=this.compose(HARBOR_STARTS[Math.floor(r()*5)],x,y,r);
    return cache(this.sceneCache,key,s,180);
  }
  scenesNear(left,top,right,bottom){const out=[];if(left<700&&right>-700&&top<600&&bottom>-500)out.push(this.plaza());for(let iy=Math.floor((top-350)/SCENE)-1;iy<=Math.ceil((bottom+350)/SCENE);iy++)for(let ix=Math.floor((left-400)/SCENE)-1;ix<=Math.ceil((right+400)/SCENE);ix++){const s=this.scene(ix,iy);if(s)out.push(s);}return out;}
  propsIn(left,top,right,bottom){
    const props=this.scenesNear(left,top,right,bottom).flatMap(s=>s.props);
    for(let j=Math.floor(top/185)-1;j<=Math.ceil(bottom/185);j++)for(let i=Math.floor(left/185)-1;i<=Math.ceil(right/185);i++){
      const r=rng(i,j,this.seed+111),x=(i+.2+r()*.6)*185,y=(j+.2+r()*.6)*185;
      if(Math.hypot(x,y)<520||y>this.shoreY(x)-24||r()>.22)continue;
      const ids=['harbor-rope','harbor-grass','harbor-rock','harbor-palm'];props.push({id:ids[Math.floor(r()*ids.length)],x:Math.round(x),y:Math.round(y),flip:r()<.5,phase:r()*4000});
    }
    return props.filter(p=>this.byId[p.id]).map(p=>({...p,prop:this.byId[p.id],kind:/shells|rope|grass|gull/.test(p.id)?'small':'big'}));
  }
  chunk(ix,iy){
    const key=`${ix},${iy}`;if(this.chunks.has(key))return this.chunks.get(key);
    const c=document.createElement('canvas');c.width=c.height=CHUNK;const g=c.getContext('2d'),x0=ix*CHUNK,y0=iy*CHUNK,r=rng(ix,iy,this.seed+219);
    paintFloor(g,'lith',x0,y0);
    const data=g.getImageData(0,0,CHUNK,CHUNK),p=data.data;
    for(let x=0;x<CHUNK;x++){
      const shore=this.shoreY(x0+x);
      for(let y=Math.max(0,Math.floor(shore-y0)+1);y<CHUNK;y++){
        const depth=y0+y-shore,k=(y*CHUNK+x)*4,grain=(hash(x+x0,y+y0,this.seed+9)-.5)*5,t=clamp(depth/210,0,1);
        let red=112-t*52,green=190-t*35,blue=189-t*18;
        if(depth<12){const foam=(1-depth/12)*.6;red+=(232-red)*foam;green+=(238-green)*foam;blue+=(213-blue)*foam;}
        p[k]=red+grain;p[k+1]=green+grain;p[k+2]=blue+grain;p[k+3]=255;
      }
    }
    g.putImageData(data,0,0);g.save();g.translate(-x0,-y0);
    for(const d of this.docksNear(x0-10,x0+CHUNK+10)){
      g.fillStyle='#6d927c66';g.fillRect(d.x+8,d.y+5,d.w,d.h+7);g.fillStyle='#8f805e';g.fillRect(d.x-2,d.y,d.w+4,d.h+3);
      for(let y=d.y;y<d.y+d.h;y+=12){g.fillStyle=(Math.floor(y-d.y)/12)%2?'#c5ad7b':'#d4bd8b';g.fillRect(d.x,y,d.w,10);g.strokeStyle='#a38b60';g.lineWidth=1;g.beginPath();g.moveTo(d.x+10,y+5);g.quadraticCurveTo(d.x+d.w*.5,y+7,d.x+d.w-10,y+4);g.stroke();}
      for(const x of [d.x+6,d.x+d.w-6]){g.fillStyle='#8e7951';g.fillRect(x-2,d.y,4,d.h);}
    }
    g.restore();
    for(let i=0;i<330;i++){const x=r()*CHUNK,y=r()*CHUNK,depth=y+y0-this.shoreY(x+x0);if(depth>3){g.fillStyle='#d5efda30';g.fillRect(x,y,3+r()*7,1);}}
    return cache(this.chunks,key,c,48);
  }
  drawGround(g,camX,camY,w,h){
    const left=camX-w/2,top=camY-h/2;
    for(let iy=Math.floor(top/CHUNK);iy<=Math.floor((top+h)/CHUNK);iy++)for(let ix=Math.floor(left/CHUNK);ix<=Math.floor((left+w)/CHUNK);ix++)g.drawImage(this.chunk(ix,iy),Math.round(ix*CHUNK-left),Math.round(iy*CHUNK-top));
    // The sea moves while cached sand and buildings remain fixed in world space.
    const time=performance.now()/1400;g.save();g.lineCap='round';
    for(const offset of [7,26,60,106,166]){
      g.beginPath();let drawing=false;
      for(let x=Math.floor(left/8)*8;x<=left+w+8;x+=8){const y=this.shoreY(x)+offset+Math.sin(x/63+time)*2;if(this.walkable(x,y)||y<top-10||y>top+h+10){drawing=false;continue;}if(drawing)g.lineTo(x-left,y-top);else g.moveTo(x-left,y-top);drawing=true;}
      g.strokeStyle=offset<30?'#ecf5dc9a':'#b9e2d359';g.lineWidth=offset<30?2:1;g.stroke();
    }
    g.restore();
  }
}
