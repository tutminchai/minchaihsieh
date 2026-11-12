import {isIP} from 'node:net';
type CountryReader={get:(ip:string)=>{country?:{iso_code?:string}}|null};
type Options={reader:(bytes:Uint8Array)=>CountryReader;fetcher?:typeof fetch};
const ROOT='https://github.com/sapics/ip-location-db/releases/download/latest/';
const MAX_BYTES=12*1024*1024;
// PDDL user-country databases are downloaded into the function. Visitor IPs are
// looked up locally and never included in a request to the database publisher.
export function createCountryLookup({reader,fetcher=fetch}:Options){
 const cache=new Map<number,{value?:CountryReader;pending?:Promise<CountryReader|null>;expires:number;retry:number}>();
 async function database(family:number){
  let entry=cache.get(family);if(!entry){entry={expires:0,retry:0};cache.set(family,entry);}
  if(entry.value&&entry.expires>Date.now())return entry.value;
  if(entry.pending)return entry.pending;
  if(entry.retry>Date.now())return entry.value||null;
  const current=entry;
  current.pending=(async()=>{
   try{
    const response=await fetcher(ROOT+`user-country-ipv${family}.mmdb`,{signal:AbortSignal.timeout(20000)});
    if(!response.ok||Number(response.headers.get('content-length'))>MAX_BYTES||!response.body)throw Error('database_unavailable');
    const stream=response.body.getReader(),parts:Uint8Array[]=[];let size=0;
    while(true){const chunk=await stream.read();if(chunk.done)break;size+=chunk.value.length;if(size>MAX_BYTES){await stream.cancel();throw Error('database_too_large');}parts.push(chunk.value);}
    if(size<1000)throw Error('database_invalid');
    const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
    current.value=reader(bytes);current.expires=Date.now()+86400000;return current.value;
   }catch{current.retry=Date.now()+300000;return current.value||null;}
   finally{current.pending=undefined;}
  })();
  return current.pending;
 }
 return async function country(ip:string){
  const family=isIP(ip);if(!family)return '';
  try{const db=await database(family),code=db?.get(ip)?.country?.iso_code;return typeof code==='string'&&/^[A-Z]{2}$/.test(code)&&!['XX','ZZ'].includes(code)?code:'';}catch{return '';}
 };
}
