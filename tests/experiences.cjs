'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const dir=path.resolve(__dirname,'..');
const I=require('../i18n.js'),C=require('../app.js'),oldPicks=require('../youtube-workouts.js');
function context(mode,seed={},query=''){
 const data=new Map(Object.entries(seed)),nodes=new Map();
 const node=id=>{if(!nodes.has(id))nodes.set(id,{id,hidden:false,textContent:'',value:'',open:false,onclick:null,showModal(){this.open=true;},close(){this.open=false;},focus(){},addEventListener(){},closest(){return this;},querySelector(){return node(id+' child');},querySelectorAll(){return [];}});return nodes.get(id);};
 const document={getElementById:node,documentElement:{lang:'zh-CN'},querySelector:node,querySelectorAll:()=>[],body:{}};
 const window={MoveMixI18n:{localizeDOM(){}}};const localStorage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
 const location={href:'https://splitscreenmovemix.com/'+(query||'?mode='+mode),assign(url){this.href=url;}};
 const ctx=vm.createContext({window,document,localStorage,location,URL,history:{replaceState(a,b,url){location.href=String(url);}},console});
 vm.runInContext(fs.readFileSync(path.join(dir,'experience.js'),'utf8'),ctx);return {ctx,data,nodes,window,location};
}
const cnFavorite=[{id:'one',url:'https://www.bilibili.com/video/BV1mB4y127g8/?p=7',title:'保留名称',platform:'Bilibili',role:'workout',group:'全身'}];
const seed={'move-mix-cn:favorites:v1':JSON.stringify(cnFavorite),'move-mix-cn:workout-records:v1':'[{"original":true}]','move-mix-cn:parts:v1':'{"workout":{"selections":[[2,8]]}}','move-mix-v1':JSON.stringify({workoutUrl:'https://youtu.be/M7lc1UVf-VE',favorites:[{name:'Legacy pick',category:'workout',videoId:'M7lc1UVf-VE',url:'https://youtu.be/M7lc1UVf-VE'}]})};
const first=context('invalid');assert.equal(first.nodes.get('experienceDialog').open,true);
const remembered=context('ignored',{'move-mix:experience:v1':'youtube-en'},'?');assert.equal(remembered.window.MoveMixExperience.mode,'youtube-en');assert.equal(remembered.nodes.get('experienceDialog').open,false);
const en=context('youtube-en',seed),cn=context('bilibili-cn',seed);
assert.equal(en.window.MoveMixExperience.storageKey('move-mix-cn:workout-records:v1'),'move-mix-en:workout-records:v1');
assert.equal(cn.window.MoveMixExperience.storageKey('move-mix-cn:workout-records:v1'),'move-mix-cn:workout-records:v1');
for(const [key,value] of Object.entries(seed))assert.equal(en.data.get(key),value,'legacy data preserved: '+key);
assert.equal(JSON.parse(en.data.get('move-mix-en:favorites:v1'))[0].title,'Legacy pick');
const again=context('youtube-en',Object.fromEntries(en.data));assert.equal(again.data.get('move-mix-en:favorites:v1'),en.data.get('move-mix-en:favorites:v1'));
assert.throws(()=>en.window.MoveMixExperience.validateSources([C.parseVideo('BV1mB4y127g8')]),/YouTube/);
assert.throws(()=>cn.window.MoveMixExperience.validateSources([C.parseVideo('https://youtu.be/M7lc1UVf-VE')]),/English/);
assert.equal(en.window.MoveMixExperience.validateSources([C.parseVideo('https://youtu.be/M7lc1UVf-VE')]).length,1);
assert.notEqual(C.sourceKey(C.parseVideo('BV1mB4y127g8?p=1')),C.sourceKey(C.parseVideo('BV1mB4y127g8?p=7')));
// Load the existing store classes under each real mode without calling their DOM controllers.
for(const name of ['youtube-workouts.js','library.js','records.js'])vm.runInContext(fs.readFileSync(path.join(dir,name),'utf8'),en.ctx);
assert.equal(en.window.MoveMixLibrary.workouts.length,11);assert.equal(oldPicks.length,11);
for(const pick of oldPicks){const imported=en.window.MoveMixLibrary.workouts.find(x=>x.id===pick.videoId);assert.ok(imported);if(pick.timerPreset){const expected=pick.timerPreset.segments.flatMap(s=>{const ranges=[];for(let t=s.start;t<s.end;){const end=Math.min(t+s.work,s.end);ranges.push([t,end]);t=end+s.rest;}return ranges;});assert.deepEqual(JSON.parse(JSON.stringify(imported.plan)),expected);}}
const store=new en.window.MoveMixLibrary.Favorites({getItem:k=>en.data.get(k),setItem:(k,v)=>en.data.set(k,v)},C.parseVideo);store.add({url:'https://youtu.be/gFeEUq2624Q',title:'English pick',role:'entertainment'});assert.equal(store.items.at(-1).sourceKey,'youtube:gFeEUq2624Q');assert.equal(en.data.get('move-mix-cn:favorites:v1'),seed['move-mix-cn:favorites:v1']);
assert.equal(I.english('锻炼'),'Workout');assert.equal(I.english('已识别 2 项 · YouTube'),'2 items recognized · YouTube');assert.equal(I.english('A user title 中文'),'A user title 中文');assert.equal(I.english('06:50–07:20（30秒）；07:45–08:00（15秒）'),'06:50–07:20 (30s); 07:45–08:00 (15s)');
const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');assert.equal((html.match(/static.cloudflareinsights.com\/beacon.min.js/g)||[]).length,1);assert.ok(html.indexOf('data-cf-beacon')<html.indexOf('</body>'));assert.equal(fs.readFileSync(path.join(dir,'CNAME'),'utf8').trim(),'splitscreenmovemix.com');
assert.ok(html.indexOf('experience.js')<html.indexOf('library.js'));assert.ok(html.indexOf('youtube-workouts.js')<html.indexOf('library.js'));
console.log('PASS mode isolation, legacy preservation/idempotent migration, platform guards, P identities, all 11 old YouTube picks and exact timer windows, English copy, one beacon, unchanged production domain.');
