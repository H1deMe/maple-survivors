// DOM-free ground geometry. Images, camera, render bounds and combat numbers do not participate.
const EPS=.002,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function shapeBounds(s,padding=0){const rx=s.type==='circle'?s.radius:s.rx,ry=s.type==='circle'?s.radius:s.ry;return {left:s.x-rx-padding,right:s.x+rx+padding,top:s.y-ry-padding,bottom:s.y+ry+padding};}
export function penetration(p,r,s){
  if(s.type==='circle'){
    const dx=p.x-s.x,dy=p.y-s.y,d=Math.hypot(dx,dy),over=r+s.radius-d;
    return over>0?{x:d>1e-8?dx/d:0,y:d>1e-8?dy/d:1,depth:over}:null;
  }
  const dx=p.x-s.x,dy=p.y-s.y,qx=clamp(dx,-s.rx,s.rx),qy=clamp(dy,-s.ry,s.ry),ox=dx-qx,oy=dy-qy,d=Math.hypot(ox,oy);
  if(d>1e-8)return d<r?{x:ox/d,y:oy/d,depth:r-d}:null;
  const ex=s.rx-Math.abs(dx),ey=s.ry-Math.abs(dy);
  return ex<ey?{x:dx<0?-1:1,y:0,depth:ex+r}:{x:0,y:dy<0?-1:1,depth:ey+r};
}
export function resolveCircle(position,from,radius,obstacles){
  const p={...from};
  const project=()=>{for(let pass=0;pass<5;pass++){let touched=false;for(const o of obstacles){const hit=penetration(p,radius,o);if(hit){p.x+=hit.x*(hit.depth+EPS);p.y+=hit.y*(hit.depth+EPS);touched=true;}}if(!touched)break;}};
  project();const dx=position.x-from.x,dy=position.y-from.y,steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/Math.max(3,Math.min(6,radius/2))));
  for(let i=0;i<steps;i++){p.x+=dx/steps;p.y+=dy/steps;project();}
  position.x=p.x;position.y=p.y;return position;
}
export function pointSegmentDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);}
export function steerAround(actor,target,direction,obstacles){
  const radius=clamp((actor.radius??16)*.6,10,28),ahead=64+radius;
  let closest=null,best=Infinity;
  for(const o of obstacles){const b=shapeBounds(o,radius+12),dx=o.x-actor.x,dy=o.y-actor.y,along=dx*direction.x+dy*direction.y;
    if(along<0||along>ahead+Math.max(o.rx??o.radius,o.ry??o.radius))continue;
    const test={x:actor.x+direction.x*Math.min(ahead,along),y:actor.y+direction.y*Math.min(ahead,along)};
    if(test.x<b.left||test.x>b.right||test.y<b.top||test.y>b.bottom)continue;
    if(along<best){best=along;closest={o,b};}
  }
  if(!closest){actor.fieldAvoid=null;return direction;}
  const {o,b}=closest;let side=actor.fieldAvoid?.key===o.key?actor.fieldAvoid.side:0;
  if(!side){const cross=(target.x-o.x)*direction.y-(target.y-o.y)*direction.x;side=Math.abs(cross)>2?Math.sign(cross):actor.id%2?1:-1;actor.fieldAvoid={key:o.key,side};}
  const tx=-direction.y*side,ty=direction.x*side,amount=1.5;
  const x=direction.x*.35+tx*amount,y=direction.y*.35+ty*amount,len=Math.hypot(x,y)||1;return {x:x/len,y:y/len};
}
