import {topRecords} from './leaderboard-client.mjs';
export async function drawRankingAvatar(canvas,appearance,wardrobe){
  try{const frame=(await wardrobe.frames(appearance,'stand',true))[0].canvas,fg=frame.getContext('2d',{willReadFrequently:true}),data=fg.getImageData(0,0,frame.width,frame.height).data;let l=frame.width,t=frame.height,r=0,b=0;
    for(let y=0;y<frame.height;y++)for(let x=0;x<frame.width;x++)if(data[(y*frame.width+x)*4+3]>16){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y);}if(r<l)return;
    const g=canvas.getContext('2d');g.clearRect(0,0,canvas.width,canvas.height);g.imageSmoothingEnabled=false;const w=r-l+1,h=b-t+1,scale=Math.min((canvas.width-8)/w,(canvas.height-8)/h,1.25);g.drawImage(frame,l,t,w,h,(canvas.width-w*scale)/2,canvas.height-h*scale-4,w*scale,h*scale);
  }catch{canvas.setAttribute('aria-label','캐릭터 외형을 불러오지 못했습니다.');}
}
export class RankingUI{
  constructor(wardrobe,{onOpen,onClose}){
    this.wardrobe=wardrobe;this.onOpen=onOpen;this.onClose=onClose;this.open=false;this.generation=0;
    this.root=document.createElement('div');this.root.className='ranking hidden';this.root.setAttribute('role','dialog');this.root.setAttribute('aria-modal','true');this.root.setAttribute('aria-labelledby','ranking-title');
    this.root.innerHTML='<section class="ranking-panel"><header><div><h2 id="ranking-title">모험가 순위표</h2><p>클리어 우선 · 점수순 · 동점은 빠른 클리어순</p></div><button type="button" id="ranking-close" aria-label="순위표 닫기">×</button></header><p class="ranking-status" role="status"></p><div class="ranking-rows"></div><p class="ranking-foot">처치 ×10 + 레벨 ×100 + 보스 ×3,000 + 클리어 50,000점<br>캐릭터는 모험이 끝났을 당시의 모습입니다.</p><button type="button" class="secondary" id="ranking-refresh">새로고침</button></section>';
    document.body.append(this.root);this.root.querySelector('#ranking-close').onclick=()=>this.hide();this.root.querySelector('#ranking-refresh').onclick=()=>this.load();this.root.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();this.hide();}});
  }
  show(){this.onOpen?.();this.open=true;this.root.classList.remove('hidden');this.root.querySelector('#ranking-close').focus();this.load();}
  hide(){this.open=false;this.generation++;this.root.classList.add('hidden');this.onClose?.();}
  async load(){
    const generation=++this.generation,status=this.root.querySelector('.ranking-status'),rows=this.root.querySelector('.ranking-rows');status.textContent='순위를 불러오는 중…';rows.replaceChildren();
    try{const {entries}=await topRecords();if(!this.open||generation!==this.generation)return;status.textContent=entries.length?'':'아직 등록된 기록이 없습니다. 첫 기록을 남겨 보세요.';
      const pending=[];
      entries.forEach((entry,i)=>{const row=document.createElement('div');row.className='ranking-row';row.dataset.record=entry.id;const rank=document.createElement('b');rank.className='ranking-place';rank.textContent=i+1;const avatar=document.createElement('canvas');avatar.width=80;avatar.height=96;avatar.setAttribute('aria-label',`${entry.name}의 종료 당시 캐릭터`);
        const info=document.createElement('div'),name=document.createElement('b'),detail=document.createElement('small');name.textContent=entry.name;detail.textContent=`${entry.cleared?'클리어':'게임오버'} · Lv.${entry.level} · ${Math.floor(entry.duration/60)}:${String(entry.duration%60).padStart(2,'0')}`;info.append(name,detail);const score=document.createElement('strong');score.textContent=new Intl.NumberFormat('ko-KR').format(entry.score);row.append(rank,avatar,info,score);rows.append(row);pending.push([avatar,entry.appearance]);});
      // At most two compositions at once; shared Wardrobe caches each original item atlas.
      let index=0;await Promise.all([0,1].map(async()=>{while(this.open&&generation===this.generation&&index<pending.length){const [canvas,look]=pending[index++];await drawRankingAvatar(canvas,look,this.wardrobe);}}));
    }catch(error){if(generation===this.generation)status.textContent=error.message;}
  }
}
