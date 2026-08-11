export const CATEGORIES = ['chat','image','code','research'];
export const CATEGORY_LABELS = { chat:'แชททั่วไป', image:'สร้างรูปภาพ', code:'เขียนโค้ด', research:'Deep Research' };
export const DEFAULT_LIMITS = { chat:100, image:100, code:100, research:100 };
export const DEFAULT_WARN_AT = [70,90,100];

export function bangkokDayKey(date=new Date()) {
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
}

function blankUsage(){ return Object.fromEntries(CATEGORIES.map(k=>[k,0])); }
function blankLast(){ return Object.fromEntries(CATEGORIES.map(k=>[k,null])); }

export function defaultState(day=bangkokDayKey()) {
  return { day, usage:blankUsage(), limits:{...DEFAULT_LIMITS}, warnAt:[...DEFAULT_WARN_AT], lastEventAt:blankLast() };
}

export function normalizeState(input={}, day=bangkokDayKey()) {
  const limits={...DEFAULT_LIMITS};
  for(const k of CATEGORIES){ const n=Number(input?.limits?.[k]); if(Number.isFinite(n)&&n>0) limits[k]=Math.floor(n); }
  const warnAt=Array.isArray(input.warnAt)?input.warnAt.map(Number).filter(n=>n>0&&n<=100).sort((a,b)=>a-b):[...DEFAULT_WARN_AT];
  if(input.day!==day) return {day,usage:blankUsage(),limits,warnAt:warnAt.length?warnAt:[...DEFAULT_WARN_AT],lastEventAt:blankLast()};
  const usage=blankUsage(), lastEventAt=blankLast();
  for(const k of CATEGORIES){
    const n=Number(input?.usage?.[k]); usage[k]=Number.isFinite(n)&&n>=0?Math.floor(n):0;
    lastEventAt[k]=input?.lastEventAt?.[k]||null;
  }
  return {day,usage,limits,warnAt:warnAt.length?warnAt:[...DEFAULT_WARN_AT],lastEventAt};
}

export function summarize(input={},day=bangkokDayKey()){
  const state=normalizeState(input,day); const categories={};
  for(const k of CATEGORIES){ const total=state.usage[k], limit=state.limits[k]; categories[k]={key:k,label:CATEGORY_LABELS[k],total,limit,percent:limit>0?Math.min(999,Math.round(total/limit*100)):0,remaining:Math.max(0,limit-total),lastEventAt:state.lastEventAt[k]}; }
  return {...state,categories};
}

export function incrementUsage(input={},category='chat',count=1,now=new Date()){
  const day=bangkokDayKey(now), state=normalizeState(input,day), key=CATEGORIES.includes(category)?category:'chat';
  const n=Number(count), amount=Number.isFinite(n)&&n>0?Math.floor(n):1;
  state.usage[key]+=amount; state.lastEventAt[key]=now.toISOString(); return state;
}

export function setCategoryLimit(input={},category,dailyLimit,day=bangkokDayKey()){
  const state=normalizeState(input,day), key=CATEGORIES.includes(category)?category:null, n=Number(dailyLimit);
  if(key&&Number.isFinite(n)&&n>0) state.limits[key]=Math.floor(n); return state;
}

export function resetToday(input={},day=bangkokDayKey()){
  const state=normalizeState(input,day); state.usage=blankUsage(); state.lastEventAt=blankLast(); return state;
}

export function statusFor(percent){
  if(percent>=100)return{text:'ถึง Limit',help:'แตะ 100% ของ Limit ที่ตั้งไว้',level:'red'};
  if(percent>=90)return{text:'ใกล้เต็ม',help:'ถึงระดับเตือน 90%',level:'orange'};
  if(percent>=70)return{text:'ควรระวัง',help:'ถึงระดับเตือน 70%',level:'yellow'};
  return{text:'ปกติ',help:'ยังไม่ถึงระดับแจ้งเตือน',level:'green'};
}
