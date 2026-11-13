(() => {
  'use strict';
  const cfg=window.MH_ANALYTICS;
  if(!cfg||cfg.enabled!==true||!/^https:\/\/[a-z0-9]+\.supabase\.co\/functions\/v1\/analytics$/.test(cfg.endpoint)||!/^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(cfg.publishableKey))return;
  const ENDPOINT=cfg.endpoint;
  const CONSENT='mh_analytics_consent_v1', VISITOR='mh_analytics_visitor_v1', SESSION='mh_analytics_session_v1';
  const protectedBrowser=()=>navigator.doNotTrack==='1'||window.doNotTrack==='1'||navigator.globalPrivacyControl===true;
  function consent(){try{const v=JSON.parse(localStorage.getItem(CONSENT));return v&&v.until>Date.now()?v.value:null;}catch{return null;}}
  let sent=false,controller=null,withdrawn=false;
  async function record(){
    if(sent||withdrawn||consent()!=='yes'||protectedBrowser()||location.origin!=='https://tutminchai.github.io'||!['/minchaihsieh/','/minchaihsieh/index.html','/minchaihsieh/en.html'].includes(location.pathname))return;
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
      const d=await r.json();if(!d.ticket||withdrawn||consent()!=='yes'||protectedBrowser())return;
      let referrer='';try{referrer=new URL(document.referrer).origin;}catch{}
      await fetch(ENDPOINT+'/api/collect',{method:'POST',mode:'cors',credentials:'omit',cache:'no-store',signal:controller.signal,headers:{apikey:cfg.publishableKey,'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({ticket:d.ticket,id:crypto.randomUUID(),visitor,session,path:location.pathname,referrer,consent:true,touch:navigator.maxTouchPoints||0,mobile:navigator.userAgentData?.mobile===true})});
    }catch{/* Browsing remains available if statistics cannot be reached. */}
  }
  function init(){
    const footer=document.querySelector('.footer-links');
    if(footer){
      const link=document.createElement('a');
      link.href='./privacy.html';
      link.textContent=document.documentElement.lang==='en'?'Privacy notice':'隱私說明';
      footer.append(link);
    }
    record();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  addEventListener('storage',e=>{if(e.key===CONSENT&&consent()!=='yes')controller?.abort();});
})();
