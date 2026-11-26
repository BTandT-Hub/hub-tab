const MAX_TEXT=4000;
const validHint=x=>typeof x==='string'&&x.length<=60&&/^[\p{L}\p{N}][\p{L}\p{N} .&/()'_-]*$/u.test(x);
export function learnedShortcuts(ownCompletedJobs=[]){
 const counts=new Map();
 for(const row of ownCompletedJobs){
  if(!row||!validHint(row.jobType))continue;
  const key=row.jobType.toLowerCase();
  const prior=counts.get(key);
  counts.set(key,{label:prior?.label??row.jobType,n:(prior?.n??0)+1});
 }
 return [...counts.values()].filter(x=>x.n>=2).sort((a,b)=>b.n-a.n||a.label.localeCompare(b.label)).slice(0,6).map(x=>x.label);
}
export function askPayload(text, hint, choices){
 const body=typeof text==='string'?text.trim():'';
 if(!body||body.length>MAX_TEXT)return null;
 return validHint(hint)&&choices.includes(hint)?{text:body,jobTypeHint:hint}:{text:body};
}
export function createAskSubmit(transport, nextId=()=>crypto.randomUUID()){
 let active=null,busy=false;
 return async function submit(payload){
  if(!payload)return {kind:'invalid'};
  if(busy)return {kind:'busy'};
  if(typeof transport!=='function')return {kind:'unavailable'};
  if(active)return {kind:'unconfirmed',clientRequestId:active};
  busy=true;
  try{
   active=nextId();
   const receipt=await transport({...payload,clientRequestId:active});
   if(typeof receipt?.messageId!=='string'||!receipt.messageId.trim())return {kind:'unconfirmed',clientRequestId:active};
   const confirmed={kind:'posted',messageId:receipt.messageId};
   active=null;
   return confirmed;
  }catch{
   return {kind:'unconfirmed',clientRequestId:active};
  }finally{busy=false;}
 };
}
