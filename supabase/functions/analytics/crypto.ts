import { isIP } from "node:net";
export const ORIGIN = "https://tutminchai.github.io";
export const PATHS = new Set(["/minchaihsieh/", "/minchaihsieh/index.html", "/minchaihsieh/en.html"]);
const enc=new TextEncoder();


const noCache={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","X-Robots-Tag":"noindex, nofollow","Referrer-Policy":"no-referrer"};
export const taipeiDay=(ms=Date.now())=>new Date(ms+8*3600000).toISOString().slice(0,10);
export const validUUID=(v:unknown):v is string=>typeof v==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export function b64(data:Uint8Array){return btoa(String.fromCharCode(...data)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");}
export function unb64(s:string){return Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0));}
export async function key(secret:string,kind:"HMAC"|"AES-GCM"){
 const digest=await crypto.subtle.digest("SHA-256",enc.encode(kind+":"+secret));
 return crypto.subtle.importKey("raw",digest,kind==="HMAC"?{name:kind,hash:"SHA-256"}:{name:kind},false,kind==="HMAC"?["sign","verify"]:["encrypt","decrypt"]);
}
export async function hash(secret:string,value:string){return b64(new Uint8Array(await crypto.subtle.sign("HMAC",await key(secret,"HMAC"),enc.encode(value))));}
export async function encryptIP(secret:string,ip:string){const iv=crypto.getRandomValues(new Uint8Array(12));const bytes=await crypto.subtle.encrypt({name:"AES-GCM",iv},await key(secret,"AES-GCM"),enc.encode(ip));return b64(iv)+"."+b64(new Uint8Array(bytes));}
export async function decryptIP(secret:string,cipher:string){const [iv,data]=cipher.split(".");return new TextDecoder().decode(await crypto.subtle.decrypt({name:"AES-GCM",iv:unb64(iv)},await key(secret,"AES-GCM"),unb64(data)));}
export function clientIP(request:Request){const ip=(request.headers.get("cf-connecting-ip")||"").trim();return !isIP(ip)||["2a06:98c0:3600::103","127.0.0.1","::1"].includes(ip)?"":ip;}
export function maskIP(ip:string){if(isIP(ip)===4)return ip.split(".").slice(0,3).join(".")+".*";if(isIP(ip)===6)return ip.split(":").slice(0,3).join(":")+":…";return "未提供";}
export function deviceInfo(ua:string,hints:any={}){
 const tablet=/iPad|Tablet|Kindle|Silk|PlayBook/i.test(ua)||(/Android/i.test(ua)&&!/Mobile/i.test(ua))||(/Macintosh/i.test(ua)&&hints.touch>1);
 const device=tablet?"tablet":/Mobi|iPhone|iPod|Android/i.test(ua)||hints.mobile===true?"mobile":"desktop";
 const browser=/Edg/i.test(ua)?"Edge":/OPR|Opera/i.test(ua)?"Opera":/Firefox|FxiOS/i.test(ua)?"Firefox":/Chrome|CriOS/i.test(ua)?"Chrome":/Safari/i.test(ua)?"Safari":"其他";
 const os=/iPad|iPhone|iPod/i.test(ua)||tablet&&/Macintosh/i.test(ua)?"iOS / iPadOS":/Android/i.test(ua)?"Android":/Windows/i.test(ua)?"Windows":/Mac/i.test(ua)?"macOS":/Linux/i.test(ua)?"Linux":"其他";
 return {device,browser,os};
}
