import {scoreOf} from './leaderboard-rules.mjs';
export {scoreOf};
let base=null,configuration;
export async function loadLeaderboard(){
  if(['127.0.0.1','localhost'].includes(location.hostname)){base='/api';return;}
  configuration??=fetch('assets/leaderboard-config.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Missing ranking configuration');return r.json();}).then(c=>{base=c.apiBase?.replace(/\/$/,'')||null;}).catch(()=>{});return configuration;
}
async function request(path,data){await loadLeaderboard();if(!base)throw Error('온라인 순위 서버 연결을 준비하고 있습니다.');const response=await fetch(`${base}/${path}`,{method:data?'POST':'GET',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(8000)});const result=await response.json();if(!response.ok)throw Error(result.error??'순위 서버에 연결하지 못했습니다.');return result;}
export const beginRankedRun=()=>request('runs',{});
export const topRecords=()=>request('leaderboard?limit=50');
export const saveRecord=(session,record)=>request('scores',{...record,runId:session.id,token:session.token});
