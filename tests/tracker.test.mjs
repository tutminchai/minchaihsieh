import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';

const source=await readFile(new URL('../analytics.js',import.meta.url),'utf8');
const legacy='mh_analytics_consent_v1',preference='mh_analytics_preference_v2';
function storage(entries={}){const data=new Map(Object.entries(entries));return {data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};}
function create(options={}){
 const elements=[],listeners={},requests=[];
 const node=tag=>{const el={tag,children:[],handlers:{},textContent:'',open:false,append(...children){this.children.push(...children)},replaceChildren(){this.children=[]},setAttribute(k,v){this[k]=v},addEventListener(k,f){this.handlers[k]=f},showModal(){this.open=true},close(){this.open=false}};elements.push(el);return el;};
 const footer=node('footer'),head=node('head'),body=node('body');
 const document={head,body,documentElement:{lang:options.lang||'zh-Hant'},visibilityState:options.hidden?'hidden':'visible',readyState:'complete',referrer:'https://example.com/path?private=secret',createElement:node,querySelector:s=>s==='.footer-links'?footer:null,getElementById:id=>elements.find(x=>x.id===id),addEventListener:(k,f)=>listeners[k]=f};
 const localStorage=options.storage||storage(options.entries),sessionStorage=storage();
 const window={MH_ANALYTICS:{enabled:true,endpoint:'https://testproject.supabase.co/functions/v1/analytics',publishableKey:'sb_publishable_example_1234567890123456'}};
 const fetch=async(url,init={})=>{requests.push({url,init});return {ok:true,json:async()=>url.endsWith('/api/ticket')?{ticket:'test-ticket',...(options.oldBackend?{}:{collection:'automatic-v1'})}:{ok:true}};};
 vm.runInNewContext(source,{window,document,localStorage,sessionStorage,navigator:{doNotTrack:options.dnt?'1':null,globalPrivacyControl:options.gpc===true,maxTouchPoints:0},location:{origin:'https://tutminchai.github.io',pathname:options.path||'/minchaihsieh/',hash:''},crypto:webcrypto,AbortController,URL,fetch,addEventListener:(k,f)=>listeners[k]=f});
 return {elements,requests,footer,localStorage,sessionStorage,document,listeners,collects:()=>requests.filter(x=>x.url.endsWith('/api/collect'))};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
for(const lang of ['zh-Hant','en']){
 const app=create({lang});await settle();
 assert.equal(app.collects().length,1,'new visitor records without interaction');
 const payload=JSON.parse(app.collects()[0].init.body);
 assert.equal(payload.collection,'automatic-v1');assert(!('consent' in payload));
 assert.equal(payload.referrer,'https://example.com');assert.equal(app.localStorage.getItem(legacy),null);assert.equal(app.localStorage.getItem(preference),null);
 assert.equal(app.elements.filter(x=>x.tag==='dialog').length,0,'no automatic popup');
 app.footer.children[0].handlers.click();
 const dialog=app.document.getElementById('mh-analytics-dialog');assert.equal(dialog.open,true);
 const stop=app.elements.find(x=>x.textContent===(lang==='en'?'Stop statistics':'停止記錄'));stop.handlers.click();
 assert.equal(dialog.open,false);assert.equal(app.localStorage.getItem(preference),'no');assert.equal(app.localStorage.getItem('mh_analytics_visitor_v1'),null);
 const reload=create({storage:app.localStorage,lang});await settle();assert.equal(reload.requests.length,0);
 reload.footer.children[0].handlers.click();
 const resume=reload.elements.find(x=>x.textContent===(lang==='en'?'Resume statistics':'恢復記錄'));resume.handlers.click();await settle();assert.equal(reload.collects().length,1);
}
for(const options of [{dnt:true},{gpc:true},{entries:{[legacy]:JSON.stringify({value:'no',until:0})}},{entries:{[preference]:'no'}},{path:'/minchaihsieh/admin/'}]){
 const app=create(options);await settle();assert.equal(app.requests.length,0,'privacy choice or disallowed path prevents requests');
}
const previousYes=create({entries:{[legacy]:JSON.stringify({value:'yes',until:0})}});await settle();assert.equal(previousYes.collects().length,1);
const oldServer=create({oldBackend:true});await settle();assert.equal(oldServer.collects().length,0,'new tracker waits for backend capability');
const hidden=create({hidden:true});await settle();assert.equal(hidden.requests.length,0);hidden.document.visibilityState='visible';hidden.listeners.visibilitychange();await settle();assert.equal(hidden.collects().length,1);
const externalStop=create();externalStop.localStorage.setItem(preference,'no');externalStop.listeners.storage({key:preference});await settle();assert.equal(externalStop.collects().length,0,'cross-tab opt-out stops pending collect');
console.log('PASS: automatic recording, no fabricated consent, no popup, old opt-outs, stop/resume, DNT/GPC, hidden tabs, admin exclusion and backend capability guard.');
