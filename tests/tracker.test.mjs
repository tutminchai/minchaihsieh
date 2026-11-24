import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';

const source=await readFile(new URL('../analytics.js',import.meta.url),'utf8');
const legacy='mh_analytics_consent_v1',preference='mh_analytics_preference_v2';
function storage(entries={}){const data=new Map(Object.entries(entries));return {data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};}
function create(options={}){
 const elements=[],listeners={},requests=[];let clock=0,interval=null;
 const node=tag=>{const el={tag,children:[],handlers:{},textContent:'',open:false,append(...children){this.children.push(...children)},replaceChildren(){this.children=[]},setAttribute(k,v){this[k]=v},addEventListener(k,f){this.handlers[k]=f},showModal(){this.open=true},close(){this.open=false}};elements.push(el);return el;};
 const footer=node('footer'),head=node('head'),body=node('body');
 const document={head,body,documentElement:{lang:options.lang||'zh-Hant'},visibilityState:options.hidden?'hidden':'visible',readyState:'complete',referrer:'https://example.com/path?private=secret',createElement:node,querySelector:s=>s==='.footer-links'?footer:null,getElementById:id=>elements.find(x=>x.id===id),addEventListener:(k,f)=>listeners[k]=f};
 const localStorage=options.storage||storage(options.entries),sessionStorage=storage();
 const window={MH_ANALYTICS:{enabled:true,endpoint:'https://testproject.supabase.co/functions/v1/analytics',publishableKey:'sb_publishable_example_1234567890123456'}};
 const fetch=async(url,init={})=>{requests.push({url,init});return {ok:true,json:async()=>url.endsWith('/api/ticket')?{ticket:'test-ticket',...(options.oldBackend?{}:{collection:'automatic-v1'})}:{ok:true,...(options.duration?{durationToken:'test-duration'}:{})}};};
 vm.runInNewContext(source,{window,document,localStorage,sessionStorage,navigator:{doNotTrack:options.dnt?'1':null,globalPrivacyControl:options.gpc===true,maxTouchPoints:0},location:{origin:'https://tutminchai.github.io',pathname:options.path||'/minchaihsieh/',hash:''},crypto:webcrypto,AbortController,URL,fetch,performance:{now:()=>clock},setInterval:fn=>{interval=fn;return 1},clearInterval:()=>{interval=null},addEventListener:(k,f)=>listeners[k]=f});
 return {advance:ms=>{clock+=ms},tick:()=>interval?.(),durations:()=>requests.filter(x=>x.url.endsWith('/api/duration')),elements,requests,footer,localStorage,sessionStorage,document,listeners,collects:()=>requests.filter(x=>x.url.endsWith('/api/collect'))};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
for(const [lang,path] of [['zh-Hant','/minchaihsieh/'],['en','/minchaihsieh/en.html'],['ja','/minchaihsieh/ja.html']]){
 const app=create({lang,path});await settle();
 assert.equal(app.collects().length,1,'new visitor records without interaction');
 const payload=JSON.parse(app.collects()[0].init.body);
 assert.equal(payload.collection,'automatic-v1');assert(!('consent' in payload));
 assert.equal(payload.referrer,'https://example.com');assert.equal(app.localStorage.getItem(legacy),null);assert.equal(app.localStorage.getItem(preference),null);
 assert.equal(app.elements.filter(x=>x.tag==='dialog').length,0,'no automatic popup');
 assert.equal(app.footer.children.length,0,'tracker adds no footer links');
 assert.equal(app.elements.filter(x=>x.tag==='button').length,0,'no consent or preference buttons');
}
for(const options of [{dnt:true},{gpc:true},{entries:{[legacy]:JSON.stringify({value:'no',until:0})}},{entries:{[preference]:'no'}},{path:'/minchaihsieh/admin/'}]){
 const app=create(options);await settle();assert.equal(app.requests.length,0,'privacy choice or disallowed path prevents requests');
}
const previousYes=create({entries:{[legacy]:JSON.stringify({value:'yes',until:0})}});await settle();assert.equal(previousYes.collects().length,1);
const oldServer=create({oldBackend:true});await settle();assert.equal(oldServer.collects().length,0,'new tracker waits for backend capability');
const hidden=create({hidden:true});await settle();assert.equal(hidden.requests.length,0);hidden.document.visibilityState='visible';hidden.listeners.visibilitychange();await settle();assert.equal(hidden.collects().length,1);
const externalStop=create();externalStop.localStorage.setItem(preference,'no');externalStop.listeners.storage({key:preference});await settle();assert.equal(externalStop.collects().length,0,'cross-tab opt-out stops pending collect');
console.log('PASS: automatic recording, no fabricated consent, no popup, old opt-outs, no injected footer links, DNT/GPC, hidden tabs, admin exclusion and backend capability guard.');

const timed=create({duration:true});await settle();
timed.advance(15000);timed.tick();await settle();
assert.equal(JSON.parse(timed.durations().at(-1).init.body).activeMs,15000);
timed.advance(5000);timed.document.visibilityState='hidden';timed.listeners.visibilitychange();await settle();
assert.equal(JSON.parse(timed.durations().at(-1).init.body).activeMs,20000);
timed.advance(600000);timed.tick();await settle();
assert.equal(timed.durations().length,2,'background time is not reported');
timed.document.visibilityState='visible';timed.listeners.visibilitychange();
timed.advance(15000);timed.tick();await settle();
assert.equal(JSON.parse(timed.durations().at(-1).init.body).activeMs,35000);
timed.advance(5000);timed.listeners.pagehide();await settle();
assert.equal(JSON.parse(timed.durations().at(-1).init.body).activeMs,40000);
assert.equal(timed.durations().at(-1).init.keepalive,true);
timed.advance(600000);timed.listeners.pageshow({persisted:true});timed.advance(5000);timed.tick();await settle();
assert.equal(JSON.parse(timed.durations().at(-1).init.body).activeMs,45000);
timed.advance(3600000);timed.tick();await settle();
assert.equal(JSON.parse(timed.durations().at(-1).init.body).activeMs,75000,'suspended ticks are capped');
const sends=timed.durations().length;timed.localStorage.setItem(preference,'no');timed.listeners.storage({key:preference});timed.advance(15000);timed.tick();await settle();
assert.equal(timed.durations().length,sends);assert.equal(timed.collects().length,1);
console.log('PASS: foreground timing, background pause, keepalive exit, BFCache restoration, sleep cap, opt-out and no extra page views.');
