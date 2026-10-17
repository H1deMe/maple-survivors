// Original Henesys battlefield geometry. Shared by terrain, placement and ground actors.
import {pointSegmentDistance,shapeBounds,penetration} from './field-collision.mjs';
const cache=new Map(),clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function townPlan(seed,arrival={x:0,y:0}){
  const x=Math.round(arrival.x/1080)*1080,y=Math.round(arrival.y/820)*820,key=`${seed}/${x}/${y}`;if(cache.has(key))return cache.get(key);
  let n=(seed^0x6a1b27)>>>0;const random=()=>{n^=n<<13;n^=n>>>17;n^=n<<5;return(n>>>0)/2**32;};
  const rx=700+Math.round((random()-.5)*96),ry=470+Math.round((random()-.5)*64),bridgeY=480+Math.round((random()-.5)*64),roadWidth=144;
  const point=(dx,dy)=>({x:x+dx,y:y+dy}),variant=seed%3;
  // A rounded chain of authored districts, rather than a geometric oval around the player.
  const corners=[[-rx-40,-30],[-rx*.72,-ry*.86],[rx*.02,-ry-30],[rx*.8,-ry*.7],[rx+30,20],[rx*.68,ry*.95],[-rx*.12,ry+25],[-rx*.82,ry*.66]].map(([a,b])=>[a+(random()-.5)*100,b+(random()-.5)*70]);
  const curve=(a,b,c,d,t)=>.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);
  const loop=Array.from({length:49},(_,i)=>{const k=Math.floor((i%48)/6),t=(i%6)/6,a=corners[(k+7)%8],b=corners[k],c=corners[(k+1)%8],d=corners[(k+2)%8];return point(curve(a[0],b[0],c[0],d[0],t),curve(a[1],b[1],c[1],d[1],t));});
  const roads=[];for(let i=1;i<loop.length;i++)roads.push([loop[i-1],loop[i]]);
  for(const [a,b]of [[[-rx,0],[-1450,0]],[[rx,0],[1030,0]],[[0,-ry],[0,-1100]],[[0,ry],[0,1150]],[[-rx*.72,-ry*.7],[-1250,-410]],[[rx*.65,-ry*.72],[810,-680]],[[rx*.76,ry*.65],[1320,bridgeY]]]){const from=point(...a),near=loop.reduce((best,p)=>Math.hypot(p.x-from.x,p.y-from.y)<Math.hypot(best.x-from.x,best.y-from.y)?p:best);roads.push([near,point(...b)]);}
  const boss=point(810,-680),landmark=point(-940,-610),riverX=dy=>1180+Math.sin((dy+96)/240)*52,water=[],start=-4096,end=4096;
  for(let top=start,i=0;top<end;top+=96,i++){
    const bottom=Math.min(end,top+100),ranges=bottom<bridgeY-96||top>bridgeY+96?[[top,bottom]]:[[top,Math.min(bottom,bridgeY-96)],[Math.max(top,bridgeY+96),bottom]];
    for(const [a,b]of ranges)if(b>a)water.push({type:'box',key:`river/${key}/${i}/${a}`,x:x+riverX((a+b)/2),y:y+(a+b)/2,rx:72,ry:(b-a)/2});
  }
  const plan={key,x,y,rx,ry,variant,roads,loop,roadWidth,boss,landmark,riverX,bridge:{x:x+riverX(bridgeY),y:y+bridgeY,width:288,height:192},water,riverStart:y+start,riverEnd:y+end};
  cache.set(key,plan);if(cache.size>8)cache.delete(cache.keys().next().value);return plan;
}
export function onTownRoute(shape,plan,padding=12){
  const support=shape.type==='circle'?shape.radius:Math.hypot(shape.rx,shape.ry);
  if(Math.hypot((shape.x-plan.x)/(490+support),(shape.y-plan.y)/(310+support))<1)return true;
  if(Math.hypot((shape.x-plan.boss.x)/(230+support),(shape.y-plan.boss.y)/(180+support))<1)return true;
  return plan.roads.some(([a,b])=>pointSegmentDistance(shape,a,b)<plan.roadWidth/2+support+padding);
}
export function waterNear(plan,x,y,radius){return plan.water.filter(s=>{const b=shapeBounds(s,radius);return x>=b.left&&x<=b.right&&y>=b.top&&y<=b.bottom;});}
export function leaveWater(actor,radius,plan,ignored){
  const parts=plan.water.filter(s=>!ignored?.has(s.key)&&Math.abs(actor.y-s.y)<s.ry+radius);
  if(!parts.some(s=>penetration(actor,radius,s)))return;
  const left=Math.min(...parts.map(s=>s.x-s.rx))-radius-.01,right=Math.max(...parts.map(s=>s.x+s.rx))+radius+.01;
  actor.x=Math.abs(actor.x-left)<Math.abs(actor.x-right)?left:right;
}
export function riverDirection(actor,target,direction,plan){
  const side=p=>Math.sign(p.x-plan.x-plan.riverX(clamp(p.y-plan.y,plan.riverStart-plan.y,plan.riverEnd-plan.y)))||1,a=side(actor),b=side(target);
  const bridge=plan.bridge;let route=actor.fieldRiver;
  if(route&&(route.key!==plan.key||route.goal!==b)){route=null;actor.fieldRiver=null;}
  if(route&&(actor.x-bridge.x)*route.goal>=180){actor.fieldRiver=null;return direction;}
  if(!route){
    if(a===b||actor.y<plan.riverStart-120||actor.y>plan.riverEnd+120||target.y<plan.riverStart-120||target.y>plan.riverEnd+120)return direction;
    route={key:plan.key,from:a,goal:b,crossing:false};actor.fieldRiver=route;
  }
  if(Math.abs(actor.y-bridge.y)<48)route.crossing=true;
  const waypoint=route.crossing?{x:bridge.x+route.goal*200,y:bridge.y}:{x:bridge.x+route.from*185,y:bridge.y};
  const dx=waypoint.x-actor.x,dy=waypoint.y-actor.y,d=Math.hypot(dx,dy)||1;return{x:dx/d,y:dy/d};
}
// Short independent clusters, never an enclosed yard or a wall across the loop.
export function townSites(plan){
  const sites=[['house',-940,-610],['cottage',-1220,-590],['mailbox',-1070,-550],['pot',-810,-605],['pot',-1170,-520],['bench',-1090,-250],['sign',-650,-400],['fence',-1120,-750],['fence',-1340,-510],
    ['oak',-1150,-540],['apple',-940,-650],['apple',-590,-580],['sunflowerTall',-350,-570],['sunflowerTall',-420,-600],['sunflower',-490,-560],
    ['oak',-810,430],['apple',-1000,620],['oak',-570,670],['rock',-870,580],['rock',-950,460],['fence',-1090,500],['fence',-560,800],['mushroom',-730,650],['bush',-980,730],
    ['apple',180,-680],['apple',360,-720],['bush',320,-610],['oak',1030,-680],['apple',1070,-330],['rock',1010,-140],['fence',950,110],
    ['apple',720,760],['oak',960,850],['bush',840,660],['rock',980,710],['sign',1090,300],['bench',480,600]];
  // Layered groves frame the battlefield; the shared route/clearing reservations reject every obstruction.
  for(const side of [-1,1]){
    const phase=(Number(plan.key.split('/')[0])%83)/83*Math.PI*2;
    for(let i=0;i<30;i++){const x=-1440+i*100+Math.sin(i*3.1+phase)*26,y=side*(890+Math.sin(i*2.3+phase)*70);sites.push([i%3?'apple':'oak',x,y],['bush',x+45,y+20],['purple',x-32,y+22],['orange',x-9,y+28]);if(i%2===0)sites.push(['oak',x+30,y+side*140]);}
    for(let i=0;i<12;i++){const y=-740+i*145+Math.sin(i*2.4+phase)*34,x=side*(1450+Math.sin(i*1.8+phase)*55);sites.push([i%2?'oak':'apple',x,y],['clover',x-side*55,y+10]);}
    for(const y of [-180,205])sites.push([y<0?'apple':'oak',side*860,y],['purple',side*811,y+20],['clover',side*790,y+32]);
  }
  for(let i=0;i<10;i++){const y=10+i*106,x=plan.riverX(y);for(const side of [-1,1])sites.push([i%3?'apple':'oak',x+side*190,y+20],['bush',x+side*151,y+40],['orange',x+side*160,y+55]);}
  for(const [cx,cy]of [[-710,-300],[-1050,-100],[-800,740],[-490,660],[240,-620],[910,-700],[820,640]])for(let i=0;i<5;i++)sites.push([i%2?'purple':'orange',cx+(i-2)*30,cy+Math.sin(i*1.8)*10]);
  for(const [cx,cy]of [[-930,-550],[-1220,-530],[-1150,-690],[-570,-630],[-850,440],[-570,740],[400,-760],[950,870]]){
    sites.push(['bush',cx-48,cy+12],['bush',cx+46,cy+14]);
    for(let i=0;i<7;i++)sites.push([i%3?'purple':'orange',cx+(i-3)*23,cy+24+Math.sin(i*1.9)*14]);
  }
  for(let i=0;i<16;i++){if(i%4===0)continue;const a=i/16*Math.PI*2;sites.push(['rock',plan.boss.x-plan.x+Math.cos(a)*263,plan.boss.y-plan.y+Math.sin(a)*207]);}
  // Landmark groups keep houses and services together. Wide routes are still filtered by shared geometry.
  sites.unshift(['terrace',-520,-870],['terrace',-1050,780],['waterfall',plan.riverX(-720),-720],['waterfall',plan.riverX(1080),1080],['well',-730,-620],['stall',-1240,-210],['greatOak',-280,-740],['bench',-380,-680],['bench',-180,-680]);
  if(plan.variant===1)sites.push(['cottage',-1170,260],['house',-1050,500],['stall',-1280,600],['well',-890,700]);
  if(plan.variant===2)for(let i=0;i<4;i++)sites.push(['apple',-1200+i*115,500+Math.sin(i)*65],['sunflowerTall',-1230+i*115,610]);
  if(plan.variant===0)sites.push(['greatOak',-1030,550],['bench',-1160,600],['well',-860,670]);
  return sites.map(([id,x,y])=>[id,x+plan.x,y+plan.y]);
}
