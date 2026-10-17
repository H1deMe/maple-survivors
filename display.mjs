// World zoom is independent of CSS-sized HUD and touch controls.
export function cameraView(cssWidth,cssHeight,mobile){
  // Phones see ~1.54x farther. Bound the world diagonal on tablets/large monitors
  // so visible terrain stays cached and ordinary spawns remain below recycle distance.
  const zoom=Math.max(mobile?.65:1,Math.hypot(cssWidth,Math.max(1,cssHeight-78))/1900);
  return {zoom,width:cssWidth/zoom,height:cssHeight/zoom,statusHeight:78/zoom};
}

export class FullscreenToggle{
  constructor(button,onChange){
    this.button=button;this.onChange=onChange;this.fallback=false;this.pending=false;
    button.onclick=()=>this.toggle();
    document.addEventListener('fullscreenchange',()=>this.update());
    document.addEventListener('webkitfullscreenchange',()=>this.update());
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&this.fallback){e.preventDefault();e.stopImmediatePropagation();this.toggle();}},true);
    this.update();
  }
  get native(){return document.fullscreenElement??document.webkitFullscreenElement;}
  get active(){return !!this.native||this.fallback;}
  update(){
    const on=this.active;document.body.classList.toggle('game-fullscreen',on);
    this.button.setAttribute('aria-pressed',String(on));this.button.setAttribute('aria-label',`전체화면 ${on?'끄기':'켜기'}`);
    this.button.querySelector('b').textContent=on?'ON':'OFF';this.button.dataset.mode=this.native?'native':this.fallback?'fill':'off';
    this.button.title=on?(this.fallback?'화면 채우기 해제 · Esc':'전체화면 해제 · Esc'):'전체화면 켜기';this.onChange?.();
  }
  async toggle(){
    if(this.pending)return;this.pending=true;
    try{
      if(this.native){const exit=document.exitFullscreen??document.webkitExitFullscreen;if(exit)await exit.call(document);}
      else if(this.fallback)this.fallback=false;
      else{
        const root=document.documentElement,request=root.requestFullscreen??root.webkitRequestFullscreen;
        if(request){try{await request.call(root,{navigationUI:'hide'});}catch{this.fallback=true;}}
        else this.fallback=true;
      }
    }finally{this.pending=false;this.update();}
  }
}
