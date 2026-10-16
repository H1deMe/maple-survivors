// A continuous ground plane with upright native sprites, foot-based depth and sparse scenery districts.
// Original side-view art is reused as billboards; the map layout and collision footprints are new.
import {nativeGroup,loadNativeFieldArt} from './native-field-art.mjs';
import {paintFloor} from './floor-tiles.mjs';
export {loadNativeFieldArt};
const CW=1080,CH=820,MAX_CACHE=96;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function random(ix,iy,seed){let n=(Math.imul(ix,374761393)^Math.imul(iy,668265263)^Math.imul(seed,2246822519))>>>0||1;return ()=>{n^=n<<13;n^=n>>>17;n^=n<<5;return (n>>>0)/4294967296;};}
const structural=id=>/^(house-|tree-|fountain$|statue-|hay-stack|cart$|harbor-(house|cottage|palm|crane|stall|crates|barrels|rock)|ellinia-(house-|tree|mill)|perion-(chief-hut|temple|tent|forge|tree|totem)|kerning-(factory|apartments|shop|lamp|phone|pipes|barrier)|sleepy-(lodge|stump|arch|root)|orbis-(house-|statue|column|ruin|topiary))/.test(id);
const REGIONS=['lith','henesys','ellinia','perion','kerning','sleepywood','orbis'];
export function arenaLayout(width,height,statusHeight=78){const bottom=Math.max(180,height-statusHeight);return {width,height,top:0,bottom,playHeight:bottom,heroX:width/2,heroY:Math.round(bottom*.56)};}
export function sceneryBounds(p){const b=p.prop.bounds,s=p.scale;return {left:p.x+(p.flip?-b.right:b.left)*s,right:p.x+(p.flip?-b.left:b.right)*s,top:p.y+b.top*s,bottom:p.y+b.bottom*s};}
export function obscuresHero(p,hero){const b=sceneryBounds(p);return p.y>hero.y-4&&hero.x+23>b.left&&hero.x-23<b.right&&hero.y>b.top&&hero.y-67<b.bottom;}
export class OverworldField{
  constructor(seed=1065){this.byId=Object.assign({},...['henesys','lith','ellinia','perion','kerning','sleepy','orbis'].map(nativeGroup));this.stage='lith';this.reseed(seed);}
  reseed(seed){this.seed=seed>>>0;this.chunks=new Map();this.arrival={x:0,y:0};}
  setStage(id){this.stage=REGIONS.includes(id)?id:'lith';this.chunks.clear();}
  enterAt(x,y){this.arrival={x,y};this.chunks.clear();}
  scene(ix,iy){
    const key=`${ix},${iy}`;if(this.chunks.has(key))return this.chunks.get(key);
    const r=random(ix,iy,this.seed+({lith:29,henesys:61,ellinia:97,perion:147,kerning:199,sleepywood:241,orbis:283}[this.stage])),pick=a=>a[Math.floor(r()*a.length)],side=r()<.5?-1:1;
    const cx=ix*CW,cy=iy*CH,props=[];let n=0;
    const add=(id,dx,dy,scale=1)=>{
      const prop=this.byId[id];if(!prop)return;
      const p={id,key:`${this.stage}/${ix}/${iy}/${n++}`,x:Math.round(cx+dx*side),y:Math.round(cy+dy),scale,flip:false,phase:r()*5000,prop,solid:structural(id),kind:/flower|clover|carrots|grass|rope|leaves|sprout|ferns|mush-(tiny|small|yellow|white)|butterfly/.test(id)?'small':'big'};
      // Each arrival reserves enough space for the complete hero, without moving a travelling hero.
      const b=sceneryBounds(p),a=this.arrival;
      if(b.left<a.x+105&&b.right>a.x-105&&b.top<a.y+38&&b.bottom>a.y-90)return;
      if(p.solid){
        const width=prop.w*scale;
        p.foot={x:p.x,y:p.y-3,rx:clamp(width*(/tree|palm/.test(id)?.12:.32),13,94),ry:clamp(width*.075,10,24)};
        // Wide continuous north/south and east/west escape lanes cross every district.
        if(Math.abs(p.x-cx)-p.foot.rx<125||Math.abs(p.y-cy)-p.foot.ry<100)return;
      }
      props.push(p);
    };
    const type=Math.floor(r()*4),jitter=(r()-.5)*54;
    // Every district has a readable landmark cluster and an opposite, smaller natural cluster.
    // Props are composed around a shared anchor, rather than scattered independently across the combat space.
    if(this.stage==='henesys'){
      if(type===0){add('house-ochre',-300,-155+jitter);add('mailbox-heart',-445,-137);add('pot-lily',-175,-139);add('fence-flower',-315,-105,.75);}
      else if(type===1){add('hay-stack',-325,-158);add('cart',-210,-133,.85);add('sack',-420,-130);for(let i=0;i<5;i++)add(['sunflower','sunflower2','sunflower3'][i%3],-430+i*49,-211);}
      else if(type===2){add('tree-big',-310,-145,.9);add('tree-apple',-435,-157);add('logs',-215,-137,.85);add('bush-berry',-402,-108,.7);}
      else{add('house-red',-330,-150+jitter);add('mush-cluster',-195,-118,.7);add('mush-red',-440,-121,.8);add('pot-sunflower',-225,-146,.8);}
      add(pick(['tree-apple','house-mini','tree-big']),315,228,type===2?.7:.88);
      add('bench',208,213,.85);add(pick(['bush-small','bush-berry']),423,236,.8);
      for(let i=0;i<6;i++)add(pick(['flower-purple2','flower-orange2','clover','mush-small']),225+i*37,265+(r()-.5)*28,.6+r()*.2);
    }else if(this.stage==='lith'){
      if(type===0){add('harbor-house',-315,-146+jitter,.92);add('harbor-lamp',-470,-133,.85);add('harbor-crates',-155,-123,.65);}
      else if(type===1){add('harbor-crane',-335,-145,.9);add('harbor-crates',-178,-130,.85);add('harbor-barrels',-440,-120,.75);add('harbor-net',-208,-191,.75);}
      else if(type===2){add('harbor-stall',-300,-150);add('harbor-crates',-435,-137,.75);add('harbor-barrels',-176,-125,.75);add('harbor-lamp',-425,-235,.8);}
      else{add('harbor-cottage',-320,-151);add('harbor-palm-lean',-457,-145,.78);add('harbor-barrels',-195,-128,.65);}
      add('harbor-palm',315,216,.87);add('harbor-palm-lean',435,236,.65);add('harbor-rock',228,226,.7);
      for(let i=0;i<5;i++)add(pick(['harbor-grass','harbor-rope']),220+i*47,264+(r()-.5)*30,.65+r()*.2);
    }else if(this.stage==='ellinia'){
      add(pick(['ellinia-house-green','ellinia-house-blue','ellinia-house-red','ellinia-house-round','ellinia-mill']),-325,-151+jitter,.86);
      add('ellinia-bellflower',-463,-126,.7);add('ellinia-bluebud',-187,-126,.75);add('ellinia-ferns',-331,-111,.65);
      add(type%2?'ellinia-tree':'ellinia-tree-twisted',325,217,.78);add('ellinia-shrub',447,242,.82);add('ellinia-branch',205,228,.75);
      for(let i=0;i<6;i++)add(pick(['ellinia-leaves','ellinia-sprout','ellinia-bluebud']),235+i*39,274+(r()-.5)*20,.55+r()*.2);
    }else if(this.stage==='perion'){
      add(['perion-chief-hut','perion-temple','perion-tent','perion-forge'][type],-315,-150+jitter,.95);
      add('perion-totem',-466,-129,.8);add('perion-stones',-171,-121,.8);add('perion-dry-bush',-407,-112,.7);
      add('perion-tree',320,215);add('perion-thorns',435,239,.85);add('perion-skull',212,220);
      for(let i=0;i<5;i++)add(pick(['perion-twig','perion-grass','perion-stones']),225+i*43,264+(r()-.5)*24,.65);
    }else if(this.stage==='kerning'){
      add(['kerning-factory','kerning-apartments','kerning-shop','kerning-factory'][type],-320,-152+jitter,.9);
      add('kerning-phone',-467,-126,.8);add('kerning-hydrant',-159,-128);add('kerning-trash',-427,-110);
      add('kerning-pipes',320,220,.95);add('kerning-lamp',445,234,.8);add('kerning-barrier',214,250,.8);add('kerning-planks',410,277,.7);
    }else if(this.stage==='sleepywood'){
      add(type%2?'sleepy-lodge':'sleepy-stump',-320,-150+jitter);
      add('sleepy-mushrooms',-467,-126,.8);add('sleepy-moss',-184,-120,.8);add('sleepy-vine',-410,-119,.7);
      add(type%2?'sleepy-root':'sleepy-arch',321,220);add('sleepy-bush',439,243,.9);add('sleepy-mushrooms',210,246,.7);
      for(let i=0;i<5;i++)add(pick(['sleepy-moss','sleepy-bush','sleepy-vine']),230+i*43,280+(r()-.5)*20,.6);
    }else{
      add(pick(['orbis-house-blue','orbis-house-wing','orbis-house-rose']),-321,-150+jitter,.92);
      add('orbis-statue',-466,-131,.9);add('orbis-topiary',-171,-128,.78);
      add('orbis-column',305,216);add('orbis-topiary-round',429,239,.88);add('orbis-ruin',203,241,.9);add('orbis-bench',329,277,.8);
      for(let i=0;i<4;i++)add('orbis-ivy',214+i*65,270+(r()-.5)*20,.65);
    }
    const scene={type,ix,iy,x:cx,y:cy,props};this.chunks.set(key,scene);if(this.chunks.size>MAX_CACHE)this.chunks.delete(this.chunks.keys().next().value);return scene;
  }
  propsIn(left,top,right,bottom){
    const out=[];
    // Include offscreen feet when their complete native canopy/roof is still onscreen.
    for(let iy=Math.floor((top-80)/CH)-1;iy<=Math.ceil((bottom+430)/CH)+1;iy++)for(let ix=Math.floor((left-360)/CW)-1;ix<=Math.ceil((right+360)/CW)+1;ix++)for(const p of this.scene(ix,iy).props){const b=sceneryBounds(p);if(b.left<right&&b.right>left&&b.top<bottom&&b.bottom>top)out.push(p);}
    return out;
  }
  solidsNear(x,y,radius=160){const out=[];for(let iy=Math.round((y-radius)/CH);iy<=Math.round((y+radius)/CH);iy++)for(let ix=Math.round((x-radius)/CW);ix<=Math.round((x+radius)/CW);ix++)for(const p of this.scene(ix,iy).props)if(p.solid)out.push(p);return out;}
  constrain(game){
    if(game.mode!=='playing')return;
    const actors=[{actor:game.player,radius:13},...game.mobs.filter(m=>!m.dying&&!m.flying).map(m=>({actor:m,radius:clamp(m.radius*.6,10,28)}))];
    // Solve feet against small ground footprints; roofs and foliage never form invisible walls.
    for(const {actor:p,radius}of actors)for(let pass=0;pass<2;pass++)for(const o of this.solidsNear(p.x,p.y,radius+110)){
      const f=o.foot,rx=f.rx+radius,ry=f.ry+radius,dx=p.x-f.x,dy=p.y-f.y,n=Math.hypot(dx/rx,dy/ry);
      if(n>=1)continue;
      if(n<.001){p.y=f.y+ry;continue;}
      p.x=f.x+dx/n;p.y=f.y+dy/n;
    }
  }
  drawGround(g,camX,camY,width,height){
    const left=camX-width/2,top=camY-height/2;paintFloor(g,this.stage,left,top,width,height);
    // Shared ground-contact shadows give upright sprites a footprint on the same plane as the hero.
    g.save();g.translate(-left,-top);
    for(const p of this.propsIn(left-10,top-10,left+width+10,top+height+350)){
      if(!p.solid)continue;const f=p.foot;
      g.fillStyle=this.stage==='lith'?'#735c3528':'#183b272c';g.beginPath();g.ellipse(f.x+8,f.y+4,f.rx+12,f.ry+5,-.12,0,Math.PI*2);g.fill();
      g.fillStyle='#18322124';g.beginPath();g.ellipse(f.x,f.y,f.rx,f.ry,0,0,Math.PI*2);g.fill();
    }
    g.restore();
  }
}
