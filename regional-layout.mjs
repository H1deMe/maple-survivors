// Original regional battlefields. Combat STAGES remain in engine.mjs.
import {pointSegmentDistance,shapeBounds} from './field-collision.mjs';
export const REGIONAL_FIELDS={
  lith:{name:'리스항구',surface:'sand',ground:'#d4bd88',path:'#ead4a1',edge:'#c5ad75',accent:'#ae9c68',rx:850,ry:430,width:160,shape:[[-1,-.12],[-.62,-1],[.4,-.9],[1,.1],[.62,1],[-.55,.9]]},
  ellinia:{name:'엘리니아',surface:'grass',ground:'#6c9d58',path:'#a8b77a',edge:'#61874b',accent:'#56844b',rx:700,ry:560,width:160,shape:[[-1,-.3],[-.6,-1],[.45,-.9],[.92,-.1],[.62,.9],[-.4,1],[-.87,.5]]},
  perion:{name:'페리온',surface:'dust',ground:'#b9824e',path:'#d6a970',edge:'#a66e42',accent:'#9b6b45',rx:830,ry:470,width:170,shape:[[-1,-.25],[-.4,-1],[.65,-.8],[1,.3],[.35,1],[-.78,.78]]},
  kerning:{name:'커닝시티',surface:'paving',ground:'#77847e',path:'#b8b39f',edge:'#65736e',accent:'#63756d',rx:780,ry:510,width:176,shape:[[-1,-.85],[.9,-.85],[1,.8],[-.9,.85]]},
  sleepywood:{name:'슬리피우드',surface:'moss',ground:'#426a55',path:'#7c8b68',edge:'#395c49',accent:'#335a48',rx:690,ry:580,width:160,shape:[[-1,-.25],[-.4,-1],[.6,-.95],[.95,-.1],[.6,.95],[-.25,.88],[-.94,.5]]},
  orbis:{name:'오르비스',surface:'marble',ground:'#c8d4c5',path:'#ebe7d5',edge:'#a9bca7',accent:'#a0b2a2',rx:810,ry:520,width:170,shape:[[-1,0],[-.65,-.86],[0,-1],[.75,-.8],[1,0],[.65,.85],[0,1],[-.75,.8]]},
};
const plans=new Map();
export const regionalRandom=(seed,x=0,y=0)=>{let n=(seed^Math.imul(x,374761393)^Math.imul(y,668265263)^0x734922)>>>0||1;return()=>{n^=n<<13;n^=n>>>17;n^=n<<5;return(n>>>0)/2**32;};};
export function regionalPlan(id,seed,arrival={x:0,y:0}){
  const c=REGIONAL_FIELDS[id],x=Math.round(arrival.x/1080)*1080,y=Math.round(arrival.y/820)*820,key=`${id}/${seed}/${x}/${y}`;if(plans.has(key))return plans.get(key);
  const r=regionalRandom(seed),rx=c.rx+(r()-.5)*80,ry=c.ry+(r()-.5)*64;
  const corners=c.shape.map(([a,b])=>({x:x+a*rx+(r()-.5)*52,y:y+b*ry+(r()-.5)*44}));
  const curve=(a,b,c,d,t)=>.5*(2*b+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t),loop=[];
  for(let k=0;k<corners.length;k++)for(let i=0;i<8;i++){const n=corners.length,a=corners[(k+n-1)%n],b=corners[k],c=corners[(k+1)%n],d=corners[(k+2)%n],t=i/8;loop.push({x:curve(a.x,b.x,c.x,d.x,t),y:curve(a.y,b.y,c.y,d.y,t)});}loop.push({...loop[0]});
  const roads=loop.slice(1).map((p,i)=>[loop[i],p]),boss={x:x+900,y:y-650},landmark={x:x-1030,y:y-500};
  for(const target of [{x:x-1570,y},{x:x+1560,y},{x,y:y-1230},{x,y:y+1240},boss,{x:landmark.x,y:landmark.y+240}]){const from=loop.reduce((a,b)=>Math.hypot(a.x-target.x,a.y-target.y)<Math.hypot(b.x-target.x,b.y-target.y)?a:b);roads.push([from,target]);}
  if(id==='kerning')roads.push([{x:x-600,y},{x:x+600,y}],[{x,y:y-400},{x,y:y+400}]);
  const barriers=id==='lith'?[{key:`${key}/cove`,type:'circle',x:x+1280,y:y+650,radius:175}]:[];
  const sites=[[0,-1040,-580],[1,-1320,-530],[2,-940,-220],[3,-1200,-290],[1,-520,-770],[3,-420,-710],[2,1040,-830],[3,1150,-720],[0,-1120,570],[3,-930,650],[1,930,810],[2,1100,400]];
  for(const side of [-1,1])for(let i=0;i<23;i++){
    const a=-1560+i*145+(r()-.5)*75,b=side*(950+(r()-.5)*110),kind=id==='kerning'?i%3===0?0:2:id==='orbis'?i%3===0?2:1:i%4===0?3:1;
    sites.push([kind,a,b]);if(i%3===0)sites.push([3,a+58,b+65]);
  }
  for(const side of [-1,1])for(let i=0;i<11;i++)sites.push([i%3===0?0:1,side*(1550+(r()-.5)*80),-740+i*165]);
  if(id==='kerning')for(const side of [-1,1])for(let i=0;i<4;i++)sites.push([0,side*(930+i%2*340),-680+Math.floor(i/2)*1280]);
  const plan={key,id,...c,x,y,rx,ry,boss,landmark,roads,loop,barriers,sites:sites.map(([kind,a,b])=>[kind,x+a,y+b])};plans.set(key,plan);if(plans.size>24)plans.delete(plans.keys().next().value);return plan;
}
export function regionalReserved(s,p,padding=16){const radius=s.type==='circle'?s.radius:Math.hypot(s.rx,s.ry);return Math.hypot((s.x-p.x)/(460+radius),(s.y-p.y)/(300+radius))<1||Math.hypot(s.x-p.boss.x,s.y-p.boss.y)<200+radius||p.roads.some(([a,b])=>pointSegmentDistance(s,a,b)<p.width/2+radius+padding)||p.barriers.some(b=>Math.hypot(s.x-b.x,s.y-b.y)<b.radius+radius+12);}
const overlap=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
export function regionalScene(id,seed,ix,iy,arrival,art){
  const p=regionalPlan(id,seed,arrival),r=regionalRandom(seed,ix,iy),cx=ix*1080,cy=iy*820,core=Math.abs(ix-Math.round(p.x/1080))<=1&&Math.abs(iy-Math.round(p.y/820))<=1,props=[],obstacles=[],safe={left:arrival.x-108,right:arrival.x+108,top:arrival.y-92,bottom:arrival.y+42};
  const add=(kind,x,y)=>{const prop=art[kind],meta=prop.meta,scale=1,serial=props.length,key=`${p.key}/${ix}/${iy}/${serial}`,b=prop.bounds,bounds={left:x+b.left,right:x+b.right,top:y+b.top,bottom:y+b.bottom};if(overlap(bounds,safe))return;
    const foot={...meta.footprint,x,y:y-5,key};foot.rx??=foot.radius;foot.ry??=foot.radius;if(regionalReserved(foot,p))return;if(!core&&(Math.abs(x-cx)<155+(foot.rx??foot.radius)||Math.abs(y-cy)<130+(foot.ry??foot.radius)))return;
    if(obstacles.some(o=>overlap(shapeBounds(o,12),shapeBounds(foot))))return;obstacles.push(foot);
    props.push({id:prop.id,key,x,y,scale,flip:false,phase:0,prop,solid:true,kind:'big',layoutVersion:2,sortOffsetY:meta.sortOffsetY,meta,foot,bounds});};
  if(core){for(const [kind,x,y]of p.sites)if(Math.round(x/1080)===ix&&Math.round(y/820)===iy)add(kind,x,y);}
  else{const side=r()<.5?-1:1;add(0,cx-side*330,cy-220);add(1,cx+side*340,cy+240);add(2,cx-side*330,cy+250);add(3,cx+side*430,cy-200);}
  return {type:`${id}-${seed%3}`,ix,iy,x:cx,y:cy,props,obstacles,layoutVersion:2};
}
