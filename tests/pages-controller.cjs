const assert=require('node:assert/strict'),C=require('../app.js'),P=require('../parts.js');
class Element{constructor(tag){this.tagName=tag;this.children=[];this.attributes={};this.value='';}append(...nodes){this.children.push(...nodes)}replaceChildren(...nodes){this.children=nodes}setAttribute(k,v){this.attributes[k]=v}}
const hosts={};global.document={getElementById:id=>hosts[id]||=(new Element('div')),createElement:tag=>new Element(tag)};let saved='{}';global.localStorage={getItem:()=>saved,setItem:(_,value)=>saved=value};
const raw=[{page:1,cid:11,part:'A'},{page:2,cid:12,part:'B'},{page:3,cid:13,part:'C'}];let releaseOld;
global.fetch=async url=>{const bv=new URL(url).searchParams.get('bvid');if(bv==='BVTEST123456')await new Promise(r=>releaseOld=r);return {ok:true,json:async()=>({code:0,data:{title:bv,pages:bv==='BV1kts5zoErK'?[raw[0]]:raw}})}};
function field(host,label){function scan(e){if(e.attributes?.['aria-label']===label)return e;for(const child of e.children||[]){const found=scan(child);if(found)return found;}}return scan(host)}
(async()=>{
const controller=P.createController(C,()=>{}),bv='BV1mB4y127g8';controller.refresh('workout',bv);controller.refresh('entertainment',`https://www.bilibili.com/video/${bv}/?p=2`);
assert.equal((await controller.prepare('workout',bv))[0].pages.length,3);await controller.prepare('entertainment',`https://www.bilibili.com/video/${bv}/?p=2`);
const w=field(hosts.workoutParts,'锻炼 P3'),e=field(hosts.entertainmentParts,'娱乐 P2');assert.equal(w.checked,false);assert.equal(e.checked,true);w.checked=true;w.onchange();assert.deepEqual((await controller.prepare('workout',bv)).map(v=>v.p),[1,3]);assert.equal((await controller.prepare('entertainment',`https://www.bilibili.com/video/${bv}/?p=2`))[0].p,2);
const reopened=P.createController(C,()=>{});assert.equal((await reopened.prepare('workout',bv))[1].p,3);
controller.refresh('workout','BV1kts5zoErK');await controller.prepare('workout','BV1kts5zoErK');assert.equal(field(hosts.workoutParts,'锻炼 P1'),undefined);
controller.refresh('workout','BVTEST123456');const pending=controller.prepare('workout','BVTEST123456');controller.refresh('workout',bv);await controller.prepare('workout',bv);releaseOld();await assert.rejects(()=>pending,/输入已改变/);assert.equal(field(hosts.workoutParts,'锻炼 P1').checked,true);
global.fetch=async()=>{throw Error('offline')};const manual=P.createController(C);await manual.prepare('entertainment',bv);const input=field(hosts.entertainmentParts,'娱乐想看的分P');input.value='1,3,5~7';input.oninput();assert.deepEqual((await manual.prepare('entertainment',bv)).map(v=>v.p),[1,3,5,6,7]);assert.deepEqual((await P.createController(C).prepare('entertainment',bv)).map(v=>v.p),[1,3,5,6,7]);
console.log('PASS setup multi-select defaults/selection, independent roles, saved selection restore, single-P hidden, stale metadata ignored. Synthetic metadata only.');
})().catch(e=>{console.error(e);process.exitCode=1;});

