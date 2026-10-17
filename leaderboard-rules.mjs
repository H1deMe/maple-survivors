// Shared display/server score formula. The server ignores any submitted score field.
export const SCORE_RULES={kill:10,level:100,boss:3000,clear:50000};
export const scoreOf=s=>s.kills*SCORE_RULES.kill+s.level*SCORE_RULES.level+s.bossKills*SCORE_RULES.boss+(s.cleared?SCORE_RULES.clear:0);
export function validateAppearance(input){
  if(!input||!['m','f'].includes(input.gender)||!Number.isInteger(input.skin)||input.skin<2000||input.skin>2020)throw Error('캐릭터 외형 정보가 올바르지 않습니다.');
  const result={gender:input.gender,skin:input.skin};
  for(const key of ['Hair','Face','Cap','FaceAccessory','EyeAccessory','Earrings','Coat','Pants','Longcoat','Shoes','Glove','Cape','Weapon','Shield']){const v=input[key]??0;if(!Number.isInteger(v)||v<0||v>1999999)throw Error('캐릭터 외형 정보가 올바르지 않습니다.');result[key]=v;}
  return result;
}
export function validateRecord(input){
  if(!input||typeof input!=='object')throw Error('기록 형식이 올바르지 않습니다.');
  const name=typeof input.name==='string'?input.name.normalize('NFC').trim().replace(/\s+/g,' '):'';
  if([...name].length<2||[...name].length>16||!/^[-\p{L}\p{N}_. ]+$/u.test(name))throw Error('이름은 한글·영문·숫자 등 2~16자로 입력해 주세요.');
  const limits={kills:[0,1000000],level:[1,500],bossKills:[0,7],duration:[0,21600]};
  for(const [key,[min,max]]of Object.entries(limits))if(!Number.isSafeInteger(input[key])||input[key]<min||input[key]>max)throw Error('기록 수치가 올바르지 않습니다.');
  if(typeof input.cleared!=='boolean'||input.kills<input.bossKills)throw Error('모험 결과가 올바르지 않습니다.');
  if(input.cleared&&(input.bossKills!==7||input.duration<1200||input.finalBoss!=='8130100'))throw Error('최종 보스 클리어 기록을 확인하지 못했습니다.');
  return {name,kills:input.kills,level:input.level,bossKills:input.bossKills,duration:input.duration,cleared:input.cleared,appearance:validateAppearance(input.appearance)};
}
