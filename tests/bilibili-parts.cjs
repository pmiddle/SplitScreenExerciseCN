'use strict';
const assert=require('node:assert/strict'),C=require('../app.js'),L=require('../library.js');
// BVTEST12345 is 11 characters, so use a valid 12-character fixture without
// weakening the production BV validator merely to accept an illustrative ID.
const bv='BVTEST123456',base=`https://www.bilibili.com/video/${bv}/`;
const cases=[['A',base,1],['B',base+'?p=2',2],['C',base+'?p=17',17],['D',base+'?spm_id_from=xxx&p=6',6],['E',base+'?p=9&vd_source=xxx',9],['order',base+'?vd_source=xxx&p=7&spm_id_from=xxx',7],['time',base+'?p=5&t=120',5],['no scheme',`www.bilibili.com/video/${bv}/?p=8`,8],['mobile',`https://m.bilibili.com/video/${bv}/?p=12`,12],['normalized',base+'?p=007',7]];
for(const [name,input,page] of cases){const v=C.parseVideo(input);assert.equal(v.id,bv);assert.equal(v.p,page);assert.equal(v.sourceKey,`bilibili:${bv}:p${page}`);assert.equal(v.originalUrl,input);for(const muted of [true,false]){const u=new URL(C.bilibiliURL(v,muted));assert.equal(u.searchParams.get('bvid'),bv);assert.equal(u.searchParams.get('p'),String(page));}console.log(`PASS ${name}: P${page}`);}
for(const value of ['0','-1','1.5','1e2','no','9007199254740992'])assert.equal(C.parseVideo(base+'?p='+value).p,1);
assert.equal(C.parseVideo(bv).p,1);assert.equal(C.parseVideo('av170001').p,1);assert.equal(C.parseVideo('https://www.bilibili.com/video/av170001/?p=4').p,4);
assert.equal(new URL(C.bilibiliURL({platform:'Bilibili',id:bv},true)).searchParams.get('p'),'1');
assert.throws(()=>C.parseVideo('https://www.bilibili.com/video/BVTEST12345/'),/invalid BV ID/);
const first=C.parseVideo(base+'?p=1'),seventh=C.parseVideo(base+'?p=7');assert.notEqual(first.sourceKey,seventh.sourceKey);assert.notEqual(L.canonical(first),L.canonical(seventh));assert.equal(L.canonical(C.parseVideo(base)),L.canonical(first));
let data=JSON.stringify([{id:'legacy',url:base,title:'P1',platform:'Bilibili',role:'workout'}]);const storage={getItem:()=>data,setItem:(_,v)=>data=v};const favorites=new L.Favorites(storage,C.parseVideo);assert.equal(favorites.items[0].p,1);favorites.add({url:base+'?p=7',title:'P7',role:'workout'});favorites.add({url:base+'?p=1',title:'P1 updated',role:'workout'});assert.equal(favorites.items.length,2);assert.equal(new L.Favorites(storage,C.parseVideo).items.length,2);assert.equal(favorites.items[1].originalUrl,base+'?p=7');
// Exercise actual adapter iframe creation independently for both role slots.
global.document={createElement:tag=>({tag,addEventListener(){}})};
const yt=C.parseVideo('https://youtu.be/M7lc1UVf-VE');
for(const [workout,entertainment] of [[3,'yt'],['yt',5],[2,8]]){
 const parts=[];for(const [role,part] of [['workout',workout],['entertainment',entertainment]]){const video=part==='yt'?yt:C.parseVideo(base+'?p='+part);const mount={replaceChildren(node){this.node=node}};const adapter=C.createAdapter(mount,video,{role,muted:role==='workout'});if(part!=='yt'){adapter.load();assert.equal(new URL(mount.node.src).searchParams.get('p'),String(part));assert.equal(adapter.sourceKey,video.sourceKey);}else assert(adapter instanceof C.YouTubePlayerAdapter);parts.push(part);}console.log('PASS adapter roles: '+parts.join(' × '));
}
console.log('PASS identity, favorites and P1 normalization.');
