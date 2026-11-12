import {ORIGIN,PATHS,taipeiDay,validUUID,clientIP,maskIP,deviceInfo,hash,key,b64,unb64,encryptIP,decryptIP} from './crypto.ts';
export type Env={SUPABASE_URL:string;SUPABASE_ANON_KEY:string;SUPABASE_SERVICE_ROLE_KEY:string;ADMIN_EMAIL:string;ANALYTICS_SECRET:string};
type Dependencies={fetcher?:typeof fetch;rpc?:(action:string,data:Record<string,unknown>)=>Promise<any>};
const DAY=86400000,enc=new TextEncoder();
const headers={'Cache-Control':'private, no-store','Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'};
const cors={'Access-Control-Allow-Origin':ORIGIN,'Vary':'Origin','Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Max-Age':'600'};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...headers,...cors}});
const text=(v:unknown,n=80)=>typeof v==='string'?v.replace(/[\u0000-\u001f\u007f]/g,'').slice(0,n):'';
function source(req:Request){try{const u=new URL(req.headers.get('referer')||'');return req.headers.get('origin')===ORIGIN&&u.origin===ORIGIN&&(u.pathname==='/'||PATHS.has(u.pathname));}catch{return false;}}
function ignored(req:Request){return /bot|spider|crawler|headless|preview|facebookexternalhit/i.test(req.headers.get('user-agent')||'')||req.headers.get('dnt')==='1'||req.headers.get('sec-gpc')==='1';}
async function body(req:Request){
 const reader=req.body?.getReader();if(!reader)throw Error('bad_body');
 let size=0;const parts:Uint8Array[]=[];
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2048){await reader.cancel();throw Error('body_too_large');}parts.push(value);}
 const out=new Uint8Array(size);let offset=0;for(const p of parts){out.set(p,offset);offset+=p.length;}
 try{return JSON.parse(new TextDecoder().decode(out));}catch{throw Error('bad_body');}
}
function dates(u:URL){const from=u.searchParams.get('from')||taipeiDay(Date.now()-6*DAY),to=u.searchParams.get('to')||taipeiDay();if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||from<taipeiDay(Date.now()-89*DAY)||to>taipeiDay()||from>to)throw Error('bad_dates');for(const d of [from,to]){const n=Date.parse(d+'T00:00:00+08:00');if(!Number.isFinite(n)||taipeiDay(n)!==d)throw Error('bad_dates');}return {from,to};}
export function createHandler(env:Env,deps:Dependencies={}){
 const fetcher=deps.fetcher||fetch;
 const rpc=deps.rpc||async function(action:string,data:Record<string,unknown>){
  const r=await fetcher(env.SUPABASE_URL+'/rest/v1/rpc/analytics_rpc',{method:'POST',headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({p_action:action,p_data:data}),signal:AbortSignal.timeout(10000)});
  if(!r.ok)throw Error('database_error');return r.json();
 };
 async function rate(identity:string,limit:number){const bucket=Math.floor(Date.now()/60000);return (await rpc('rate',{key:identity+':'+bucket,limit,expires:(bucket+2)*60000})).allowed===true;}
 return async function handler(req:Request):Promise<Response>{
  try{
   if(req.headers.get('origin')!==ORIGIN)return json({error:'來源不符'},403);
   if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,...cors}});
   if(!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(env.SUPABASE_URL)||!env.SUPABASE_ANON_KEY||!env.SUPABASE_SERVICE_ROLE_KEY||!env.ADMIN_EMAIL||env.ANALYTICS_SECRET.length<32)return json({error:'後台尚未設定完成'},503);
   const url=new URL(req.url),path=url.pathname.replace(/^\/functions\/v1\/analytics/,'');
   const ip=clientIP(req),ua=(req.headers.get('user-agent')||'').slice(0,512);
   if(path==='/api/ticket'&&req.method==='GET'){
    if(!source(req))return json({error:'來源不符'},403);if(ignored(req))return json({ignored:true});
    const identity=await hash(env.ANALYTICS_SECRET,'rate:'+(ip||ua));
    if(!await rate(identity,60))return json({error:'請稍後重試'},429);
    const payload=b64(enc.encode(JSON.stringify({nonce:crypto.randomUUID(),origin:ORIGIN,identity,exp:Date.now()+300000})));
    return json({ticket:payload+'.'+await hash(env.ANALYTICS_SECRET,'ticket:'+payload)});
   }
   if(path==='/api/collect'&&req.method==='POST'){
    if(!source(req))return json({error:'來源不符'},403);if(ignored(req))return json({ignored:true});
    const data=await body(req);
    if(!data||data.consent!==true||!validUUID(data.id)||!validUUID(data.visitor)||!validUUID(data.session)||!PATHS.has(data.path)||typeof data.ticket!=='string'||data.ticket.length>1000)return json({error:'紀錄格式錯誤'},400);
    let ticket:any;try{const parts=data.ticket.split('.');if(parts.length!==2||!await crypto.subtle.verify('HMAC',await key(env.ANALYTICS_SECRET,'HMAC'),unb64(parts[1]),enc.encode('ticket:'+parts[0])))throw Error();ticket=JSON.parse(new TextDecoder().decode(unb64(parts[0])));if(!validUUID(ticket.nonce)||ticket.origin!==ORIGIN||typeof ticket.exp!=='number'||ticket.exp<Date.now()||ticket.exp>Date.now()+300000||ticket.identity!==await hash(env.ANALYTICS_SECRET,'rate:'+(ip||ua)))throw Error();}catch{return json({error:'紀錄憑證失效'},403);}
    const visitor=await hash(env.ANALYTICS_SECRET,'visitor:'+data.visitor),session=await hash(env.ANALYTICS_SECRET,'session:'+data.session);
    if(!await rate('v:'+visitor,30))return json({error:'請稍後重試'},429);
    let referrer='';try{const r=new URL(data.referrer);if(/^https?:$/.test(r.protocol)&&r.origin!==ORIGIN)referrer=r.hostname.slice(0,150);}catch{}
    // Supabase gateway supplies the client IP. Never accept IP/geo fields from body,
    // X-Forwarded-For, deployment region or locale. Country is kept only if supplied
    // by the gateway; city/region remain empty until forwarding is verified live.
    const cfCountry=req.headers.get('cf-ipcountry')||'';
    const country=ip&&/^[A-Z]{2}$/.test(cfCountry)&&cfCountry!=='XX'?cfCountry:'';
    await rpc('collect',{id:data.id,ticket:ticket.nonce,visitor,session,path:data.path,referrer,...deviceInfo(ua,{touch:Number(data.touch)||0,mobile:data.mobile===true}),country,region:'',city:'',ipMasked:maskIP(ip),ipCipher:ip?await encryptIP(env.ANALYTICS_SECRET,ip):null});
    return json({ok:true});
   }
   // No header names, decoded JWT claims or browser storage decide authorization.
   // Supabase Auth verifies the access token; the email allowlist and pinned user
   // ID are then both checked before any read of analytics data.
   const authorization=req.headers.get('authorization')||'';
   if(!/^Bearer [^\s]+$/.test(authorization))return json({error:'請先登入'},401);
   const auth=await fetcher(env.SUPABASE_URL+'/auth/v1/user',{headers:{apikey:env.SUPABASE_ANON_KEY,Authorization:authorization},signal:AbortSignal.timeout(10000)});
   if(!auth.ok)return json({error:'登入已到期，請重新登入'},401);
   const user=await auth.json() as any;
   if(!validUUID(user.id)||!user.email_confirmed_at||typeof user.email!=='string'||user.email.toLowerCase()!==env.ADMIN_EMAIL.toLowerCase())return json({error:'此帳號沒有後台權限'},403);
   if(!(await rpc('owner',{id:user.id,email:user.email.toLowerCase()})).allowed)return json({error:'此帳號沒有後台權限'},403);
   if(path==='/api/me'&&req.method==='GET')return json({email:user.email});
   if(path==='/api/stats'&&req.method==='GET')return json(await rpc('stats',dates(url)));
   if(path==='/api/records'&&req.method==='GET'){
    const page=Number(url.searchParams.get('page')||'1'),device=url.searchParams.get('device')||'all';
    if(!Number.isInteger(page)||page<1||page>10000||!['all','mobile','desktop','tablet'].includes(device))return json({error:'篩選格式錯誤'},400);
    return json(await rpc('records',{...dates(url),page,device,q:text(url.searchParams.get('q'))}));
   }
   if(path==='/api/ip'&&req.method==='POST'){
    const data=await body(req);if(!data||!validUUID(data.id))return json({error:'找不到紀錄'},404);
    const row=await rpc('ip',{id:data.id,actor:user.id});if(!row.cipher)return json({error:'IP 未提供或已超過 30 天保存期限'},404);
    return json({ip:await decryptIP(env.ANALYTICS_SECRET,row.cipher)});
   }
   return json({error:'找不到此功能'},404);
  }catch(e){const code=e instanceof Error?e.message:'';if(code==='bad_dates')return json({error:'日期需在最近 90 天內'},400);if(code==='bad_body')return json({error:'資料格式錯誤'},400);if(code==='body_too_large')return json({error:'資料過長'},413);return json({error:'服務暫時無法使用，請稍後重試'},500);}
 };
}
