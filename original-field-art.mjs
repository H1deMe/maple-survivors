// Entirely new generated pixel artwork. This module never reads a WZ-derived image.
import {registerFloorTile} from './floor-tiles.mjs';
let art=null,report=null,terrain=null;
const canvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
export async function loadOriginalFieldArt(){
  if(art)return;
  const base='assets/battlefield/original/',response=await fetch(`${base}art.json`);if(!response.ok)throw Error('새 헤네시스 소재 목록을 읽지 못했습니다.');
  const spec=await response.json(),images=Object.fromEntries(await Promise.all(Object.entries(spec.sources).map(async([key,file])=>[key,await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error(`새 도트 소재 로딩 실패: ${file}`));i.src=base+file;})])));
  art={};report={sourceKind:spec.sourceKind,assets:[],originalWzReferences:0};
  for(const [id,s]of Object.entries(spec.sprites)){
    const image=images[s.source],[nx,ny,nw,nh]=s.rect,sx=Math.round(nx*image.width),sy=Math.round(ny*image.height),sw=Math.min(image.width-sx,Math.round(nw*image.width)),sh=Math.min(image.height-sy,Math.round(nh*image.height));
    const region=canvas(sw,sh),r=region.getContext('2d',{willReadFrequently:true});r.drawImage(image,sx,sy,sw,sh,0,0,sw,sh);const pixels=r.getImageData(0,0,sw,sh).data;
    let left=sw,top=sh,right=-1,bottom=-1,count=0,border=0;
    for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){if(pixels[(y*sw+x)*4+3]<16)continue;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);count++;if(x<2||x>=sw-2||y<2||y>=sh-2)border++;}
    if(!count||border>8)throw Error(`도트 소재가 잘렸거나 비었습니다: ${id} (${border}; ${left},${top}–${right},${bottom} / ${sw},${sh})`);
    const width=right-left+1,height=bottom-top+1,lw=Math.max(4,Math.round(s.width/spec.pixelSize)),lh=Math.max(4,Math.round(height/width*lw));
    const logical=canvas(lw,lh),lg=logical.getContext('2d');lg.imageSmoothingEnabled=false;lg.drawImage(region,left,top,width,height,0,0,lw,lh);
    const pad=8,c=canvas(lw*2+pad*2,lh*2+pad*2),g=c.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(logical,pad,pad,lw*2,lh*2);
    art[id]={id,w:c.width,h:c.height,native:false,sourceKind:spec.sourceKind,sourcePaths:[base+spec.sources[s.source]],padding:pad,bounds:{left:-c.width/2,right:c.width/2,top:-(c.height-pad),bottom:pad},frames:[{canvas:c,ox:c.width/2,oy:c.height-pad,delay:1000}]};
    report.assets.push({id,source:spec.sources[s.source],sourcePixels:count,borderPixels:border,width:c.width,height:c.height});
  }
  // Small editable pixel props, drawn from scratch; no extracted texture or lettering.
  for(const [id,w,h]of [['hn-fence',96,44],['hn-sign',48,64]]){
    const c=canvas(w,h),g=c.getContext('2d');
    if(id==='hn-fence'){
      g.fillStyle='#67452c';g.fillRect(8,16,80,6);g.fillRect(8,28,80,5);g.fillStyle='#b5894c';g.fillRect(8,16,80,3);
      for(const x of [8,44,80]){g.fillStyle='#62432b';g.fillRect(x,8,8,30);g.fillStyle='#b98c50';g.fillRect(x,8,5,28);g.fillStyle='#e1b775';g.fillRect(x,6,6,4);}
    }else{
      g.fillStyle='#64452e';g.fillRect(22,24,8,32);g.fillRect(5,6,38,28);g.fillStyle='#ba8a4e';g.fillRect(7,8,34,22);g.fillStyle='#e0b976';g.fillRect(9,10,30,4);g.fillStyle='#7d5835';g.fillRect(12,21,23,3);g.fillRect(26,18,9,8);
    }
    art[id]={id,w,h,native:false,sourceKind:'original-procedural',sourcePaths:[`procedural:${id}`],padding:4,bounds:{left:-w/2,right:w/2,top:-(h-8),bottom:8},frames:[{canvas:c,ox:w/2,oy:h-8,delay:1000}]};
    report.assets.push({id,source:`procedural:${id}`,width:w,height:h,borderPixels:0});
  }
  // Large two-pixel materials replace the old 64px microtexture; mirrored edges meet exactly.
  terrain={};const atlas=images.terrain;
  for(const [name,x,y]of [['grass',0,0],['dirt',1,0],['water',0,1],['lush',1,1]]){
    const logical=canvas(128,128),lg=logical.getContext('2d');lg.imageSmoothingEnabled=false;
    lg.drawImage(atlas,x*atlas.width/2,y*atlas.height/2,atlas.width/2,atlas.height/2,0,0,128,128);
    const tile=canvas(512,512),g=tile.getContext('2d');g.imageSmoothingEnabled=false;
    for(let iy=0;iy<2;iy++)for(let ix=0;ix<2;ix++){g.save();g.translate(ix?512:0,iy?512:0);g.scale(ix?-1:1,iy?-1:1);g.drawImage(logical,0,0,256,256);g.restore();}
    // Quiet ground values leave the stronger silhouettes and combat effects readable.
    if(name==='grass'){g.fillStyle='#86ad50b5';g.fillRect(0,0,512,512);}
    if(name==='dirt'){g.fillStyle='#e3ba7b80';g.fillRect(0,0,512,512);}
    terrain[name]=tile;
  }
  registerFloorTile('henesys',terrain.grass);
}
export function originalFieldArt(){if(!art)throw Error('새 헤네시스 그림을 먼저 로드해야 합니다.');return art;}
export function originalArtReport(){return report;}
export function originalTerrainArt(){if(!terrain)throw Error('새 지형 소재를 먼저 로드해야 합니다.');return terrain;}
