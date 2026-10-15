// Shared, frame-independent geometry: native sprites are placed and culled by their complete bounds.
export function propBounds(p,art=p.prop){
  const b=art.bounds??{left:-art.w/2,top:-art.h,right:art.w/2,bottom:0};
  return {left:p.x+(p.flip?-b.right:b.left),right:p.x+(p.flip?-b.left:b.right),top:p.y+b.top,bottom:p.y+b.bottom};
}
export function intersects(a,b,gap=0){return a.left<b.right+gap&&a.right>b.left-gap&&a.top<b.bottom+gap&&a.bottom>b.top-gap;}
export const structural=id=>/^(house-|village-tower$|fountain$|harbor-(house|cottage|crane|arch|stall)$|ellinia-(house-.+|tree|tree-twisted|mill|bridge|bridge-up)$)/.test(id);
export function spaceStructures(props,art,{start=false,shoreY=null}={}){
  const placed=[],result=props.map(p=>({...p})),priority=p=>/^house-|^harbor-(house|cottage)$/.test(p.id)?0:p.id==='fountain'?2:1;
  const indices=result.map((p,i)=>i).filter(i=>art[result[i].id]&&structural(result[i].id)).sort((a,b)=>priority(result[a])-priority(result[b])||a-b);
  const shifts=[0,-24,24,-48,48,-80,80,-120,120,-170,170,-230,230];
  for(const i of indices){
    const p=result[i],original={...p};let found=false;
    for(const dy of [0,35,70,110,150,-35,-70]){
      for(const dx of shifts){
        const trial={...original,x:original.x+dx,y:original.y+dy},b=propBounds(trial,art[p.id]);
        if(start&&intersects(b,{left:-55,right:55,top:-75,bottom:25}))continue;
        if(shoreY&&trial.y>shoreY(trial.x)-18)continue;
        if(placed.some(other=>intersects(b,other,6)))continue;
        p.x=trial.x;p.y=trial.y;placed.push(b);found=true;break;
      }
      if(found)break;
    }
    if(!found)placed.push(propBounds(p,art[p.id]));
  }
  return result;
}
export function artExtents(art){const all=Object.values(art).map(p=>propBounds({x:0,y:0},p));return {left:Math.max(...all.map(b=>-b.left)),right:Math.max(...all.map(b=>b.right)),up:Math.max(...all.map(b=>-b.top)),down:Math.max(...all.map(b=>b.bottom))};}
