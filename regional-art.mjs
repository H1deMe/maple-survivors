// Extract complete alpha-connected sprite groups from the preserved generated atlas.
// No WZ image is read here. A component mask prevents a neighbouring canopy entering a crop.
import {REGIONAL_FIELDS} from './regional-layout.mjs';
let assets=null;const reports={};
const canvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
function split(image,id){
  const c=canvas(image.width,image.height),g=c.getContext('2d',{willReadFrequently:true});g.drawImage(image,0,0);const {data}=g.getImageData(0,0,c.width,c.height),w=c.width,h=c.height,n=w*h,labels=new Int32Array(n),queue=new Int32Array(n),components=[];
  for(let index=0;index<n;index++)if(data[index*4+3]>=16&&!labels[index]){
    const label=components.length+1;let head=0,tail=1,left=w,top=h,right=0,bottom=0,sx=0,sy=0;queue[0]=index;labels[index]=label;
    while(head<tail){const p=queue[head++],x=p%w,y=Math.floor(p/w);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);sx+=x;sy+=y;
      for(const q of [x>0?p-1:-1,x<w-1?p+1:-1,y>0?p-w:-1,y<h-1?p+w:-1])if(q>=0&&!labels[q]&&data[q*4+3]>=16){labels[q]=label;queue[tail++]=q;}}
    components.push({label,count:tail,left,top,right,bottom,x:sx/tail,y:sy/tail});
  }
  const main=components.toSorted((a,b)=>b.count-a.count).slice(0,4).sort((a,b)=>a.y-b.y),anchors=[...main.slice(0,2).sort((a,b)=>a.x-b.x),...main.slice(2).sort((a,b)=>a.x-b.x)];if(anchors.length!==4||anchors.some(a=>a.count<5000))throw Error(`${id} 도트 소재가 분리되지 않았습니다.`);
  const groups=new Int32Array(components.length+1);for(const part of components){let nearest=0,distance=Infinity;for(let i=0;i<4;i++){const a=anchors[i],dx=Math.max(a.left-part.x,0,part.x-a.right),dy=Math.max(a.top-part.y,0,part.y-a.bottom),d=dx*dx+dy*dy;if(d<distance){nearest=i;distance=d;}}groups[part.label]=nearest;}
  return anchors.map((anchor,kind)=>{
    const parts=components.filter(a=>groups[a.label]===kind&&a.count>=3),left=Math.min(...parts.map(a=>a.left)),right=Math.max(...parts.map(a=>a.right)),top=Math.min(...parts.map(a=>a.top)),bottom=Math.max(...parts.map(a=>a.bottom)),cut=canvas(right-left+1,bottom-top+1),cg=cut.getContext('2d'),pixels=cg.createImageData(cut.width,cut.height);
    for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){const at=y*w+x;if(labels[at]&&groups[labels[at]]===kind){const dest=((y-top)*cut.width+x-left)*4;pixels.data.set(data.subarray(at*4,at*4+4),dest);}}cg.putImageData(pixels,0,0);
    const worldWidth=[256,180,170,100][kind],lw=Math.round(worldWidth/2),lh=Math.round(cut.height/cut.width*lw),sprite=canvas(lw*2+16,lh*2+16),sg=sprite.getContext('2d');sg.imageSmoothingEnabled=false;const logical=canvas(lw,lh),lg=logical.getContext('2d');lg.imageSmoothingEnabled=false;lg.drawImage(cut,0,0,lw,lh);sg.drawImage(logical,8,8,lw*2,lh*2);
    const meta={kind:'big',sortOffsetY:kind===0?10:0,footprint:kind===1?{type:'circle',radius:id==='kerning'?29:17}:{type:'box',rx:[85,0,50,30][kind],ry:[26,0,22,16][kind]},fade:.28,shadow:kind===1?'tree':'house',occlusion:{cutY:-Math.max(30,Math.min(100,lh*.7)),feather:12}};
    return {id:`original-${id}-${kind}`,w:sprite.width,h:sprite.height,native:false,sourceKind:'generated-original',sourcePaths:[`assets/battlefield/regional/${id}-v1.png`],bounds:{left:-sprite.width/2,right:sprite.width/2,top:-(sprite.height-8),bottom:8},frames:[{canvas:sprite,ox:sprite.width/2,oy:sprite.height-8,delay:1000}],meta,sourcePixels:anchor.count};
  });
}
export async function loadRegionalArt(){if(assets)return;assets={};for(const id of Object.keys(REGIONAL_FIELDS)){const image=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error(`${id} 새 소재 로딩 실패`));i.src=`assets/battlefield/regional/${id}-v1.png`;});assets[id]=split(image,id);reports[id]={sourceKind:'generated-original',originalWzReferences:0,sprites:assets[id].map(p=>({id:p.id,pixels:p.sourcePixels,width:p.w,height:p.h}))};}}
export function regionalArt(id){return assets?.[id]??null;}
export function regionalArtReport(){return reports;}
