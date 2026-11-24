(() => {
  'use strict';
  const cfg=window.MH_ANALYTICS;
  if(!cfg||cfg.enabled!==true||!/^https:\/\/[a-z0-9]+\.supabase\.co\/functions\/v1\/analytics$/.test(cfg.endpoint)||!/^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(cfg.publishableKey))return;
  const ENDPOINT=cfg.endpoint;
  const LEGACY_CONSENT='mh_analytics_consent_v1', PREFERENCE='mh_analytics_preference_v2', VISITOR='mh_analytics_visitor_v1', SESSION='mh_analytics_session_v1';
  const protectedBrowser=()=>navigator.doNotTrack==='1'||window.doNotTrack==='1'||navigator.globalPrivacyControl===true;
  function optedOut(){
    try{
      const preference=localStorage.getItem(PREFERENCE);
      if(preference==='no'||preference==='yes')return preference==='no';
      // Preserve previous refusals; never manufacture a consent response.
      return JSON.parse(localStorage.getItem(LEGACY_CONSENT))?.value==='no';
    }catch{return false;}
  }
  let sent=false,controller=null,withdrawn=false;
  let durationToken='',activeMs=0,lastTick=null,timer=null,lastPosted=-1,paused=false;
  const now=()=>performance.now();
  function sample(){
    const t=now();
    // Cap long suspended ticks so sleep / throttling does not become reading time.
    if(lastTick!==null)activeMs=Math.min(86400000,activeMs+Math.max(0,Math.min(30000,t-lastTick)));
    lastTick=!paused&&document.visibilityState==='visible'?t:null;
  }
  function stopDuration(){if(timer!==null)clearInterval(timer);timer=null;lastTick=null;durationToken='';}
  async function flushDuration(leaving=false){
    if(withdrawn||optedOut()||protectedBrowser()){stopDuration();return;}
    if(!durationToken)return;
    sample();const value=Math.floor(activeMs);if(value===lastPosted)return;lastPosted=value;
    try{
      const r=await fetch(ENDPOINT+'/api/duration',{method:'POST',mode:'cors',credentials:'omit',cache:'no-store',keepalive:leaving,headers:{apikey:cfg.publishableKey,'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({token:durationToken,activeMs:value})});
      if(r.status===403||value>=86400000){stopDuration();return;}
      if(!r.ok&&lastPosted===value)lastPosted=-1;
    }catch{if(lastPosted===value)lastPosted=-1;}
  }
  function startDuration(token){
    durationToken=token;lastTick=document.visibilityState==='visible'?now():null;
    timer=setInterval(()=>{void flushDuration();},15000);
    document.addEventListener('visibilitychange',()=>{void flushDuration(true);});
    addEventListener('pagehide',()=>{paused=true;void flushDuration(true);if(timer!==null)clearInterval(timer);timer=null;});
    addEventListener('pageshow',e=>{if(e.persisted&&durationToken){paused=false;lastTick=document.visibilityState==='visible'?now():null;if(timer===null)timer=setInterval(()=>{void flushDuration();},15000);}});
  }
  async function record(){
    if(sent||withdrawn||optedOut()||protectedBrowser()||location.origin!=='https://tutminchai.github.io'||!['/minchaihsieh/','/minchaihsieh/index.html','/minchaihsieh/en.html','/minchaihsieh/ja.html'].includes(location.pathname))return;
    if(document.visibilityState==='hidden'){document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')record();},{once:true});return;}
    let visitor,session;
    try{
      visitor=localStorage.getItem(VISITOR);if(!visitor){visitor=crypto.randomUUID();localStorage.setItem(VISITOR,visitor);}
      let s;try{s=JSON.parse(sessionStorage.getItem(SESSION));}catch{}
      if(!s||s.until<Date.now())s={id:crypto.randomUUID()};s.until=Date.now()+30*60000;sessionStorage.setItem(SESSION,JSON.stringify(s));session=s.id;
    }catch{return;}
    sent=true;controller=new AbortController();
    try{
      const r=await fetch(ENDPOINT+'/api/ticket',{mode:'cors',credentials:'omit',cache:'no-store',signal:controller.signal,headers:{apikey:cfg.publishableKey}});if(!r.ok)return;
      const d=await r.json();if(!d.ticket||d.collection!=='automatic-v1'||withdrawn||optedOut()||protectedBrowser())return;
      let referrer='';try{referrer=new URL(document.referrer).origin;}catch{}
      const collected=await fetch(ENDPOINT+'/api/collect',{method:'POST',mode:'cors',credentials:'omit',cache:'no-store',signal:controller.signal,headers:{apikey:cfg.publishableKey,'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({ticket:d.ticket,id:crypto.randomUUID(),visitor,session,path:location.pathname,referrer,collection:'automatic-v1',trackDuration:true,touch:navigator.maxTouchPoints||0,mobile:navigator.userAgentData?.mobile===true})});
      if(collected.ok){const result=await collected.json();if(typeof result.durationToken==='string'&&!withdrawn&&!optedOut()&&!protectedBrowser())startDuration(result.durationToken);}
    }catch{/* Browsing remains available if statistics cannot be reached. */}
  }
  function init(){
    cfg.currentPageView = record();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  addEventListener('storage',e=>{if([PREFERENCE,LEGACY_CONSENT].includes(e.key)&&optedOut()){withdrawn=true;controller?.abort();stopDuration();}});
})();
