(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MoveMixParts=api;})(typeof window==='undefined'?this:window,function(){
 'use strict';
 const endpoints=['https://api.bilibili.com/x/web-interface/view','https://api.bilibili.com/x/player/pagelist'];
 function validPage(value){return /^\d+$/.test(String(value))&&Number.isSafeInteger(Number(value))&&Number(value)>0;}
 function readMetadata(body){
  if(body?.code!==0)throw Error('metadata unavailable');
  const data=body.data,raw=Array.isArray(data)?data:data?.pages;
  if(!Array.isArray(raw)||!raw.length)throw Error('no pages');
  const seen=new Set(),pages=raw.map(item=>{
   if(!validPage(item.page)||!validPage(item.cid)||seen.has(Number(item.page)))throw Error('invalid pages');
   seen.add(Number(item.page));return {page:Number(item.page),cid:Number(item.cid),title:typeof item.part==='string'?item.part.slice(0,500):''};
  }).sort((a,b)=>a.page-b.page);
  return {videoTitle:typeof data?.title==='string'?data.title.slice(0,500):'',pages};
 }
 function createLoader(fetcher=(...args)=>fetch(...args),timeout=4500){
  const cache=new Map();
  return async function load(video){
   if(video.platform!=='Bilibili'||video.shortUrl)return video;
   const key=video.aid?'aid:'+video.aid:video.id;let entry=cache.get(key);
   if(!entry||entry.expires<Date.now()){
    entry={expires:Infinity};cache.set(key,entry);
    entry.promise=(async()=>{
     for(const endpoint of endpoints){
      const controller=new AbortController(),alarm=setTimeout(()=>controller.abort(),timeout);
      try{
       const url=new URL(endpoint);url.searchParams.set(video.aid?'aid':'bvid',video.aid||video.id);
       const response=await fetcher(url.href,{mode:'cors',credentials:'omit',signal:controller.signal});
       if(!response.ok)throw Error('HTTP '+response.status);
       const metadata=readMetadata(await response.json());entry.expires=Date.now()+600000;return {...metadata,metadataEndpoint:endpoint,metadataStatus:'ready'};
      }catch{}finally{clearTimeout(alarm);}
     }
     entry.expires=Date.now()+30000;return {pages:[],metadataStatus:'failed'};
    })();
   }
   const metadata=await entry.promise;
   return {...video,...metadata,p:validPage(video.p)?Number(video.p):1};
  };
 }
 function selectPage(core,video,page){
  if(!validPage(page))throw Error('请输入大于0的分P整数编号。');
  const p=Number(page),part=video.pages?.find(item=>item.page===p),next={...video,p};
  next.sourceKey=core.sourceKey(next);
  if(video.videoTitle)next.title=video.videoTitle+(video.pages.length>1?' · '+(part?.title||'P'+p):'');
  return next;
 }
 function createController(core,onSessionSelect){
  const $=id=>document.getElementById(id),load=createLoader(),states={},savedKey='move-mix-cn:parts:v1';let saved={};
  try{saved=JSON.parse(localStorage.getItem(savedKey)||'{}')||{};}catch{}
  const persist=()=>{saved=Object.fromEntries(Object.entries(states).map(([role,state])=>[role,{input:state.input,pages:state.videos.map(v=>v.p||1)}]));try{localStorage.setItem(savedKey,JSON.stringify(saved));}catch{}};
  const node=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;};
  function control(video,label,onChange){
   const box=node('div');box.className='part-picker';
   if(video.platform!=='Bilibili')return box;
   if(video.shortUrl){box.append(node('small','短链展开后尝试获取分P。'));return box;}
   if(video.metadataStatus==='loading'){box.append(node('small','已识别 Bilibili · 正在获取分P…'));return box;}
   if(video.videoTitle)box.append(node('p','《'+video.videoTitle+'》'));
   const available=video.metadataStatus==='ready'&&video.pages?.length;
   if(available&&video.pages.length===1&&video.p===video.pages[0].page)return box;
   const wrapper=node('label',label+' · '+(available?'选择分P':'分P')),field=node(available?'select':'input');
   field.setAttribute('aria-label',label+'分P');
   if(available){
    for(const part of video.pages){const option=node('option','P'+part.page+(part.title?' · '+part.title:''));option.value=String(part.page);field.append(option);}
    if(!video.pages.some(item=>item.page===video.p)){const option=node('option','P'+video.p+' · 当前链接（列表中未找到）');option.value=String(video.p);field.append(option);}
    field.value=String(video.p);
   }else{field.type='number';field.min='1';field.step='1';field.inputMode='numeric';field.value=String(video.p||1);}
   const error=node('small');error.className='error';error.setAttribute('role','status');
   field.onchange=()=>{try{onChange(selectPage(core,video,field.value));error.textContent='';}catch(e){error.textContent=e.message;field.value=String(video.p||1);}};
   wrapper.append(field);box.append(wrapper);
   if(!available)box.append(node('small','暂时无法自动获取分P，可手动输入分P编号。'));
   box.append(error);return box;
  }
  function render(role){
   const state=states[role],host=$(role+'Parts');host.replaceChildren();
   state?.videos.forEach((video,index)=>host.append(control(video,(role==='workout'?'锻炼':'娱乐')+(state.videos.length>1?'第'+(index+1)+'项':''),next=>{state.videos[index]=next;persist();render(role);})));
  }
  function refresh(role,input){
   if(states[role]?.input===input)return;
   let videos=[];try{videos=core.parseImport(input);}catch{}
   const restore=saved[role]?.input===input?saved[role].pages:[];
   const state={input,videos:videos.map((v,i)=>v.platform==='Bilibili'&&!v.shortUrl?selectPage(core,{...v,metadataStatus:'loading'},validPage(restore?.[i])?restore[i]:v.p):v)};states[role]=state;render(role);
   // A changed field gets a new state object; stale responses cannot replace it.
   state.ready=Promise.all(state.videos.map(async(video,index)=>{
    try{const resolved=await core.resolveVideo(video),enriched=await load(resolved);if(states[role]!==state)return;const selected=state.videos[index].p||enriched.p||1;state.videos[index]=selectPageIfBilibili(enriched,selected);render(role);}catch{if(states[role]===state){state.videos[index]={...video,metadataStatus:'failed'};render(role);}}
   }));
  }
  function selectPageIfBilibili(video,p){return video.platform==='Bilibili'&&!video.shortUrl?selectPage(core,video,p):video;}
  async function prepare(role,input){
   refresh(role,input);const state=states[role];await state.ready;
   if(states[role]!==state)throw Error('输入已改变，请再次点击开始。');
   // Resolve again to surface the existing short-link replacement UX on failure.
   return Promise.all(state.videos.map(async video=>selectPageIfBilibili(await core.resolveVideo(video),video.p||1)));
  }
  function session(role,video,index){
   const host=$(role+'SessionParts');host.replaceChildren();
   host.append(control(video,role==='workout'?'锻炼':'娱乐',next=>{
    if(states[role]?.videos[index]){states[role].videos[index]=next;persist();render(role);}
    onSessionSelect(role,next);
   }));
  }
  return {refresh,prepare,session};
 }
 return {endpoints,validPage,readMetadata,createLoader,selectPage,createController};
});
