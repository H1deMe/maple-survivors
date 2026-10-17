import {pointSegmentDistance,shapeBounds} from './field-collision.mjs';
import {townPlan,townSites,onTownRoute,waterNear} from './henesys-map.mjs';
export function seededFieldRandom(ix,iy,seed,salt=0){let s=(Math.imul(ix,374761393)^Math.imul(iy,668265263)^Math.imul(seed,2246822519)^salt)>>>0||1;return ()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return (s>>>0)/2**32;};}
export function districtRoutes(config,seed,ix,iy){
  const [w,h]=config.cell,c={x:ix*w,y:iy*h},edge=(x,y,salt)=>(seededFieldRandom(x,y,seed,salt)()-.5)*150;
  const ports={north:{x:c.x+edge(ix,iy-1,313),y:c.y-h/2},south:{x:c.x+edge(ix,iy,313),y:c.y+h/2},west:{x:c.x-w/2,y:c.y+edge(ix-1,iy,719)},east:{x:c.x+w/2,y:c.y+edge(ix,iy,719)}};
  return {center:c,ports,segments:Object.values(ports).map(p=>[c,p]),width:config.corridorWidth};
}
export function inRoute(p,routes,padding=0){return routes.segments.some(([a,b])=>pointSegmentDistance(p,a,b)<routes.width/2+padding);}
export function shapeInRoute(shape,routes,padding=12){return routes.segments.some(([a,b])=>{const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,support=shape.type==='circle'?shape.radius:(Math.abs(dy)*shape.rx+Math.abs(dx)*shape.ry)/d;return pointSegmentDistance(shape,a,b)<routes.width/2+support+padding;});}
function overlaps(a,b){return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;}
export function generateDistrict(config,catalog,art,seed,ix,iy,arrival={x:0,y:0},mode='seeded'){
  const [w,h]=config.cell,r=seededFieldRandom(ix,iy,seed,211),routes=districtRoutes(config,seed,ix,iy),cx=ix*w,cy=iy*h;
  const plan=config.battlefield?townPlan(seed,arrival):null,core=plan&&Math.abs(ix-Math.round(plan.x/w))<=1&&Math.abs(iy-Math.round(plan.y/h))<=1;
  let roll=r()*config.templates.reduce((n,t)=>n+t.weight,0),template=config.templates.at(-1);
  for(const t of config.templates){roll-=t.weight;if(roll<0){template=t;break;}}
  let inTown=false;
  if(config.town){
    const tx=ix-Math.round(arrival.x/w),ty=iy-Math.round(arrival.y/h),ring=Math.max(Math.abs(tx),Math.abs(ty)),town=config.town;inTown=ring<=town.radius;
    let id;
    if(!ring)id=town.center;
    else if(ring===1){const roles=[...town.inner],shuffle=seededFieldRandom(0,0,seed,613);for(let i=roles.length-1;i>0;i--){const j=Math.floor(shuffle()*(i+1));[roles[i],roles[j]]=[roles[j],roles[i]];}const slots=[[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];id=roles[slots.findIndex(([x,y])=>x===tx&&y===ty)];}
    else{const choices=inTown?town.outer:town.wild;id=choices[Math.floor(r()*choices.length)];}
    template=config.templates.find(t=>t.id===id);
  }
  if(mode==='fixed'&&Math.abs(ix)<=1&&Math.abs(iy)<=1)template=config.templates.find(t=>t.id===config.fixedPatch[iy+1][ix+1]);
  // Reflect the authored positions, never the upright artwork or its lettering.
  // An independent stream keeps template selection stable when decoration is edited.
  const variant=seededFieldRandom(ix,iy,seed,809),orientation=mode==='fixed'?{x:1,y:1}:{x:variant()<.5?-1:1,y:variant()<.5?-1:1};
  const props=[],shapes=[],safe={left:arrival.x-108,right:arrival.x+108,top:arrival.y-92,bottom:arrival.y+42};let serial=0;
  const add=(metaId,dx,dy,absolute=false)=>{
    const meta=catalog[metaId],prop=art[meta.asset];if(!prop)throw new Error(`Missing native prototype: ${meta.asset}`);
    const scale=meta.scale,x=Math.round(absolute?dx:cx+dx*orientation.x),y=Math.round(absolute?dy:cy+dy*orientation.y),b=prop.bounds;
    if(plan&&!meta.footprint&&waterNear(plan,x,y,20).length)return;
    const p={id:meta.asset,metaId,key:`h2/${seed}/${ix}/${iy}/${serial++}`,x,y,scale,prop,flip:false,phase:seededFieldRandom(ix,iy,seed,serial+1701)()*5000,kind:meta.kind,solid:!!meta.footprint,layoutVersion:2,sortOffsetY:meta.sortOffsetY,meta};
    p.bounds={left:x+b.left*scale,right:x+b.right*scale,top:y+b.top*scale,bottom:y+Math.max(b.bottom*scale,30)};
    if(overlaps(p.bounds,safe))return;
    if(meta.footprint){
      const f=meta.footprint;p.foot={...f,key:p.key,x:x+f.x*scale,y:y+f.y*scale,rx:(f.rx??f.radius)*scale,ry:(f.ry??f.radius)*scale};if(f.type==='circle')p.foot.radius=f.radius*scale;
      const bound=shapeBounds(p.foot),radius=Math.hypot(bound.right-bound.left,bound.bottom-bound.top)/2;
      if(plan&&(onTownRoute(p.foot,plan)||(!meta.waterFeature&&waterNear(plan,p.foot.x,p.foot.y,radius+30).length)))return;
      if(!absolute&&(Math.hypot(p.foot.x-cx,p.foot.y-cy)<config.clearingRadius+radius||shapeInRoute(p.foot,routes)))return;
      if(shapes.some(s=>overlaps(shapeBounds(s,22),bound)))return;
      shapes.push(p.foot);
    }
    props.push(p);
  };
  if(core){for(const [id,x,y]of townSites(plan))if(Math.round(x/w)===ix&&Math.round(y/h)===iy)add(id,x,y,true);}
  else for(const [id,x,y]of template.props){const shift=mode==='fixed'?0:(r()-.5)*24;add(id,x+shift,y+(mode==='fixed'?0:(r()-.5)*18));}
  // Low, grouped planting gives direction cues without changing the uniform floor or blocking a lane.
  const decor=seededFieldRandom(ix,iy,seed,937);
  if(!core)for(const [bx,by,count]of template.flowerBeds??config.flowerBeds)for(let i=0;i<count;i++)add(i%2?'purple':'orange',bx+(i-(count-1)/2)*28,by+Math.sin(i*1.7)*12);
  for(let i=0;i<(core?3:config.accentCount);i++){const a=decor()*Math.PI*2,d=140+decor()*200;add(config.accents[Math.floor(decor()*config.accents.length)],Math.cos(a)*d,Math.sin(a)*d*.72);}
  return {type:template.id,name:template.name,terrain:template.terrain,inTown,ix,iy,x:cx,y:cy,orientation,props,obstacles:shapes,routes,layoutVersion:2};
}
