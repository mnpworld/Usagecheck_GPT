const STORAGE_KEY='usageStateV2';
const BRIDGE_REQUEST='USAGECHECK_GPT_REQUEST';
const BRIDGE_RESPONSE='USAGECHECK_GPT_RESPONSE';
const CATEGORIES=['chat','image','code','research'];

function dayKey(date=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(date)}
function blank(){return Object.fromEntries(CATEGORIES.map(k=>[k,0]))}
function blankLast(){return Object.fromEntries(CATEGORIES.map(k=>[k,null]))}
function normalize(input={}){
 const day=dayKey(), limits={chat:100,image:100,code:100,research:100};
 for(const k of CATEGORIES){const n=Number(input?.limits?.[k]);if(Number.isFinite(n)&&n>0)limits[k]=Math.floor(n)}
 if(input.day!==day)return{day,usage:blank(),limits,warnAt:[70,90,100],lastEventAt:blankLast()};
 const usage=blank(),lastEventAt=blankLast();
 for(const k of CATEGORIES){const n=Number(input?.usage?.[k]);usage[k]=Number.isFinite(n)&&n>=0?Math.floor(n):0;lastEventAt[k]=input?.lastEventAt?.[k]||null}
 return{day,usage,limits,warnAt:[70,90,100],lastEventAt};
}
async function getState(){const d=await chrome.storage.local.get([STORAGE_KEY]);const s=normalize(d[STORAGE_KEY]);await chrome.storage.local.set({[STORAGE_KEY]:s});return s}
async function saveState(s){const n=normalize(s);await chrome.storage.local.set({[STORAGE_KEY]:n});return n}
async function increment(category='chat',count=1){const s=await getState();const k=CATEGORIES.includes(category)?category:'chat';s.usage[k]+=Math.max(1,Math.floor(Number(count)||1));s.lastEventAt[k]=new Date().toISOString();return saveState(s)}
async function setLimit(category,dailyLimit){const s=await getState(),n=Number(dailyLimit);if(CATEGORIES.includes(category)&&Number.isFinite(n)&&n>0)s.limits[category]=Math.floor(n);return saveState(s)}
async function resetToday(){const s=await getState();s.usage=blank();s.lastEventAt=blankLast();return saveState(s)}

function detectCategory(){
 const text=(document.body?.innerText||'').toLowerCase();
 const url=location.href.toLowerCase();
 if(url.includes('deep-research')||text.includes('deep research')||text.includes('ค้นคว้าเชิงลึก'))return'research';
 if(url.includes('image')||text.includes('create image')||text.includes('generate image')||text.includes('สร้างรูปภาพ'))return'image';
 if(url.includes('codex')||text.includes('codex')||text.includes('code canvas')||text.includes('เขียนโค้ด'))return'code';
 return'chat';
}

if(location.hostname==='chatgpt.com'){
 let lastSubmittedAt=0;
 function maybeReport(){const now=Date.now();if(now-lastSubmittedAt<800)return;lastSubmittedAt=now;increment(detectCategory(),1).catch(()=>{})}
 document.addEventListener('keydown',e=>{if(e.key!=='Enter'||e.shiftKey)return;const t=e.target;if(t instanceof HTMLElement&&t.closest('textarea,[contenteditable="true"]'))setTimeout(maybeReport,50)},true);
 document.addEventListener('click',e=>{const t=e.target;if(!(t instanceof Element))return;const b=t.closest('button');if(!b)return;const label=`${b.getAttribute('aria-label')||''} ${b.textContent||''}`.toLowerCase();if(label.includes('send')||label.includes('ส่ง'))setTimeout(maybeReport,50)},true);
}

if(location.hostname==='mnpworld.github.io'&&location.pathname.startsWith('/Usagecheck_GPT')){
 window.addEventListener('message',async e=>{if(e.source!==window||e.data?.type!==BRIDGE_REQUEST)return;const{id,action,payload={}}=e.data;let result;if(action==='get')result=await getState();else if(action==='increment')result=await increment(payload.category,payload.count||1);else if(action==='setLimit')result=await setLimit(payload.category,payload.dailyLimit);else if(action==='reset')result=await resetToday();else return;window.postMessage({type:BRIDGE_RESPONSE,id,result},'*')});
}
