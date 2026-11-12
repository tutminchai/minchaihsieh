import {createClient} from '@supabase/supabase-js';
import {config} from './config';
import {isPublicKey} from './public-config';
export const configured = /^https:\/\/[a-z0-9]+\.supabase\.co$/.test(config.supabaseUrl) && isPublicKey(config.publishableKey);
export const client = configured ? createClient(config.supabaseUrl,config.publishableKey,{auth:{flowType:'pkce',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:sessionStorage,storageKey:'mh_admin_session_v1'}}) : null;
export async function signIn(){
 if(!client)throw Error('尚未完成後台設定');
 const {error}=await client.auth.signInWithOAuth({provider:config.provider,options:{redirectTo:config.redirectUrl,queryParams:{prompt:'select_account'}}});
 if(error)throw error;
}
export async function signOut(){
 if(client){const {error}=await client.auth.signOut({scope:'local'});if(error)throw error;}
 location.replace(config.redirectUrl);
}
export async function apiFetch(path:string,options:RequestInit={}){
 if(!client||!path.startsWith('/api/'))throw Error('後台尚未連接');
 const {data:{session},error}=await client.auth.getSession();
 if(error||!session)throw Error('登入已到期，請重新登入');
 const headers=new Headers(options.headers);headers.set('Authorization','Bearer '+session.access_token);headers.set('apikey',config.publishableKey);
 const response=await fetch(config.supabaseUrl+'/functions/v1/analytics'+path,{...options,headers,credentials:'omit',cache:'no-store'});
 if(response.status===401)window.dispatchEvent(new Event('mh-session-expired'));
 return response;
}
