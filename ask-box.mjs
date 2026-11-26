import {askPayload,createAskSubmit,learnedShortcuts} from './ask-model.mjs';
export function mountAskBox(container,{ownCompletedJobs=[],postToPrivateAiDesk,aiDeskUrl}={}){
 const doc=container.ownerDocument;
 const make=(tag,txt)=>{const node=doc.createElement(tag);if(txt)node.textContent=txt;return node};
 const form=make('form');form.className='ask-box';
 const heading=make('h2','Ask / Talk');
 const label=make('label','What do you need?');
 const input=make('textarea');input.name='ask';input.required=true;input.maxLength=4000;input.rows=4;
 input.placeholder='Type what you need done';
 label.append(input);
 const chips=make('div');chips.className='ask-shortcuts';chips.setAttribute('role','group');chips.setAttribute('aria-label','Optional shortcuts');
 const status=make('p');status.setAttribute('role','status');
 const choices=learnedShortcuts(ownCompletedJobs);
 const connections=make('p');
 if(typeof postToPrivateAiDesk!=='function'){
  connections.textContent='Posting from this tab is not connected.';
  if(typeof aiDeskUrl==='string'){
   try{const url=new URL(aiDeskUrl);if(['https://teams.microsoft.com','https://teams.cloud.microsoft'].includes(url.origin)){const link=make('a','Open AI Desk in Teams');link.href=url.href;connections.append(' ',link)}}catch{}
  }
 }
 const button=make('button','Send to AI Desk');button.type='submit';
 button.disabled=typeof postToPrivateAiDesk!=='function';
 const send=createAskSubmit(postToPrivateAiDesk);
 let hint=null;
 for(const choice of choices){
  const chip=make('button',choice);chip.type='button';chip.setAttribute('aria-pressed','false');
  chip.addEventListener('click',()=>{
   hint=hint===choice?null:choice;
   for(const node of chips.children)node.setAttribute('aria-pressed',String(node.textContent===hint));
   input.focus();
  });
  chips.append(chip);
 }
 form.append(heading,label);
 if(choices.length)form.append(chips);
 form.append(button,connections,status);
 form.addEventListener('submit',async event=>{
  event.preventDefault();
  if(button.disabled)return;
  const payload=askPayload(input.value,hint,choices);
  if(!payload){status.textContent='Enter a message first.';return}
  button.disabled=true;
  input.readOnly=true;status.textContent='Sending to AI Desk…';
  const result=await send(payload);
  input.readOnly=false;
  if(result.kind==='posted'){
   status.textContent='Posted to AI Desk. Watch the Teams thread for the doorman’s reply.';
   input.value='';hint=null;
   for(const node of chips.children)node.setAttribute('aria-pressed','false');
   button.disabled=false;
  }else{
   status.textContent='Could not confirm the post. Your text was kept. Check AI Desk before sending it again.';
  }
 });
 container.replaceChildren(form);
}
