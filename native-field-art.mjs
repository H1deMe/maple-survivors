// Load full KMS images and assemble before placing. Bounds cover EVERY animation frame plus padding.
let nativeArt=null,textures={},manifest=null;
export async function loadNativeFieldArt(){
  if(nativeArt)return;
  const response=await fetch('assets/field/field.json');if(!response.ok)throw new Error('원본 맵 리소스 목록을 읽지 못했습니다.');manifest=await response.json();
  const descriptions=[...Object.values(manifest.aliases),...Object.values(manifest.textures).map(p=>({parts:[p]}))];
  const sources=[...new Set(descriptions.flatMap(a=>a.parts.flatMap(p=>p.frames.map(f=>f.src))))];
  const images=Object.fromEntries(await Promise.all(sources.map(src=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve([src,image]);image.onerror=()=>reject(new Error(`맵 이미지 로딩 실패: ${src}`));image.src=`assets/field/${src}`;}))));
  nativeArt={};
  for(const [id,description]of Object.entries(manifest.aliases))nativeArt[id]=assemble(description,images,id);
  textures=Object.fromEntries(Object.entries(manifest.textures).map(([id,p])=>[id,images[p.frames[0].src]]));
}
function assemble(description,images,id){
  const pad=manifest.padding??8,parts=description.parts;
  const limits=parts.flatMap(p=>p.frames.map(f=>({left:p.x-f.ox,top:p.y-f.oy,right:p.x-f.ox+f.w,bottom:p.y-f.oy+f.h})));
  const left=Math.min(...limits.map(b=>b.left)),top=Math.min(...limits.map(b=>b.top)),right=Math.max(...limits.map(b=>b.right)),bottom=Math.max(...limits.map(b=>b.bottom));
  const scale=Math.min(description.maxWidth/(right-left),description.maxHeight/(bottom-top),1.7),w=Math.ceil((right-left)*scale)+pad*2,h=Math.ceil((bottom-top)*scale)+pad*2;
  const durations=parts.map(p=>p.frames.reduce((s,f)=>s+Math.max(1,f.delay),0)),cycle=Math.min(6000,Math.max(...durations));
  const changes=new Set([0,cycle]);
  parts.forEach((p,i)=>{if(p.frames.length<2)return;for(let base=0;base<cycle;base+=durations[i]){let t=base;for(const f of p.frames){t+=Math.max(1,f.delay);if(t<cycle)changes.add(t);}}});
  const times=[...changes].sort((a,b)=>a-b),frames=[];
  for(let i=0;i<times.length-1;i++){
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const g=canvas.getContext('2d');g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
    for(let j=0;j<parts.length;j++){const p=parts[j];let t=times[i]%durations[j],f=p.frames.at(-1);for(const candidate of p.frames){if(t<Math.max(1,candidate.delay)){f=candidate;break;}t-=Math.max(1,candidate.delay);}
      g.drawImage(images[f.src],pad+(p.x-f.ox-left)*scale,pad+(p.y-f.oy-top)*scale,f.w*scale,f.h*scale);
    }
    frames.push({canvas,ox:w/2,oy:h-pad,delay:times[i+1]-times[i]});
  }
  return {id,w,h,frames,native:true,parts:parts.length,padding:pad,sourcePaths:parts.map(p=>p.source),scale,bounds:{left:-w/2,top:-(h-pad),right:w/2,bottom:pad}};
}
export function nativeGroup(group){if(!nativeArt)throw new Error('원본 맵 리소스를 먼저 불러와야 합니다.');return Object.fromEntries(Object.entries(nativeArt).filter(([id])=>manifest.aliases[id].group===group));}
export function nativeTexture(ctx,name){const image=textures[name];return image?ctx.createPattern(image,'repeat'):null;}
