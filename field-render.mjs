// One visible collection per field/frame. Depth depends on the ground anchor, never image height.
const fades=new Map();
export function visibleFieldFrame(field,camera,width,height){const props=field.propsIn(camera.x-width/2-40,camera.y-height/2-40,camera.x+width/2+40,camera.y+height/2+80);return {props,ground:props.filter(p=>p.kind==='small'),world:props.filter(p=>p.kind!=='small')};}
export const depthY=p=>p.y+(p.sortOffsetY??0)*(p.scale??1);
// Slice only at draw time. Original padded animation frames remain immutable, and no
// per-instance textures are allocated. The footing stays opaque while the crown fades.
export function drawFieldSprite(g,p,frame,x,y,alpha=1,coverAlpha=1){
  g.save();g.translate(Math.round(x),Math.round(y));g.scale(p.flip?-p.scale:p.scale,p.scale);
  const opacity=g.globalAlpha*alpha,layer=p.meta?.occlusion,w=frame.canvas.width,h=frame.canvas.height;
  const draw=(top,bottom,a)=>{if(bottom<=top)return;g.globalAlpha=opacity*a;g.drawImage(frame.canvas,0,top,w,bottom-top,-frame.ox,top-frame.oy,w,bottom-top);};
  if(!layer||coverAlpha>=.999){g.globalAlpha=opacity*coverAlpha;g.drawImage(frame.canvas,-frame.ox,-frame.oy);}
  else{
    const cut=Math.round(frame.oy+layer.cutY),start=Math.max(0,Math.min(h,cut)),end=Math.max(start,Math.min(h,cut+layer.feather));
    draw(0,start,coverAlpha);
    for(let top=start;top<end;top+=2){const bottom=Math.min(end,top+2),t=((top+bottom)/2-start)/(end-start);draw(top,bottom,coverAlpha+(1-coverAlpha)*t);}
    draw(end,h,1);
  }
  g.restore();
}
export function fadedPropAlpha(p,hero,occludes,now){
  if(p.layoutVersion!==2)return occludes?.28:1;
  const target=occludes?(p.meta.fade??.3):1,old=fades.get(p.key)??{value:1,at:now},dt=Math.max(0,Math.min(60,now-old.at));
  old.value+=Math.sign(target-old.value)*Math.min(Math.abs(target-old.value),dt/130);old.at=now;fades.set(p.key,old);
  if(fades.size>800)for(const [key,v]of fades)if(now-v.at>2000)fades.delete(key);
  return old.value;
}
export function drawFieldContact(g,props,left,top){
  g.save();g.translate(-left,-top);
  for(const p of props){
    if(!p.meta?.shadow)continue;
    const f=p.foot??{x:p.x,y:p.y-2,rx:15*p.scale,ry:5*p.scale},rx=f.rx,ry=f.ry;
    // Foundations belong to a building's ground plane; the native image remains complete and upright.
    if(p.meta.shadow==='house'){
      g.fillStyle='#ab9c713d';g.beginPath();g.moveTo(f.x-rx-9,f.y-ry+5);g.lineTo(f.x+rx,f.y-ry-4);g.lineTo(f.x+rx+15,f.y+ry+7);g.lineTo(f.x-rx+3,f.y+ry+13);g.closePath();g.fill();
      g.strokeStyle='#7f795647';g.lineWidth=1;g.beginPath();g.moveTo(f.x-rx+3,f.y+ry+13);g.lineTo(f.x+rx+15,f.y+ry+7);g.stroke();
    }
    const sw=p.meta.shadow==='tree'?Math.max(rx*2.4,p.prop.w*p.scale*.25):rx+11,sh=p.meta.shadow==='tree'?Math.max(9,sw*.19):Math.max(6,ry*.65);
    g.fillStyle='#263d2520';g.beginPath();g.ellipse(f.x+11,f.y+5,sw+6,sh+3,-.22,0,Math.PI*2);g.fill();
    g.fillStyle='#243d252a';g.beginPath();g.ellipse(f.x+5,f.y+2,sw,sh,-.22,0,Math.PI*2);g.fill();
    g.fillStyle='#25332124';g.beginPath();g.ellipse(f.x,f.y,Math.max(7,rx*.9),Math.max(4,ry*.55),0,0,Math.PI*2);g.fill();
  }
  g.restore();
}
