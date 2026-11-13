(() => {
  'use strict';
  const cfg=window.MH_ANALYTICS;
  if(!cfg||cfg.enabled!==true||!/^https:\/\/[a-z0-9]+\.supabase\.co\/functions\/v1\/analytics$/.test(cfg.endpoint)||!/^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(cfg.publishableKey))return;
  const ENDPOINT=cfg.endpoint;
  const LEGACY_CONSENT='mh_analytics_consent_v1', PREFERENCE='mh_analytics_preference_v2', VISITOR='mh_analytics_visitor_v1', SESSION='mh_analytics_session_v1';
  const en=document.documentElement.lang==='en';
  const txt=en?{
    title:'Website statistics',settings:'Privacy settings',
    allow:'Resume statistics',deny:'Stop statistics',close:'Close',blocked:'Your browser has enabled Do Not Track or Global Privacy Control. Statistics are disabled.',
    policy:'This site automatically records visits for website statistics: IP address, time, page, approximate country, device and visit counts. A random browser ID estimates unique visitors; it does not reveal your name. Full IP addresses are encrypted, and records and totals remain stored without automatic expiry, accessible only to the site owner through Supabase. No GPS, message contents or URL search parameters are collected. You can stop future recording here; previous records remain stored. For access, correction or deletion requests, contact shiehminchai@gmail.com.',
    status:'Current preference: ',yes:'Automatic recording',no:'Recording stopped'
  }:{title:'網站流量統計',settings:'隱私設定',allow:'恢復記錄',deny:'停止記錄',close:'關閉',blocked:'你的瀏覽器已啟用 DNT 或 GPC 隱私選項，目前不會記錄統計。',policy:'本站自動記錄來訪 IP、時間、頁面、概略國家、裝置與次數，供網站流量統計使用；以隨機瀏覽器編號估計不重複訪客，無法得知姓名。完整 IP 加密保存，紀錄與累計數持續保留、不自動到期刪除，由 Supabase 處理，僅網站管理者可查看。不取得 GPS、訊息內容或網址搜尋參數。可在此停止後續記錄；既有紀錄仍會保留。如需查詢、更正或刪除，請聯絡 shiehminchai@gmail.com。',status:'目前設定：',yes:'自動記錄中',no:'已停止記錄'};
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
  async function record(){
    if(sent||withdrawn||optedOut()||protectedBrowser()||location.origin!=='https://tutminchai.github.io'||!['/minchaihsieh/','/minchaihsieh/index.html','/minchaihsieh/en.html'].includes(location.pathname))return;
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
      await fetch(ENDPOINT+'/api/collect',{method:'POST',mode:'cors',credentials:'omit',cache:'no-store',signal:controller.signal,headers:{apikey:cfg.publishableKey,'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({ticket:d.ticket,id:crypto.randomUUID(),visitor,session,path:location.pathname,referrer,collection:'automatic-v1',touch:navigator.maxTouchPoints||0,mobile:navigator.userAgentData?.mobile===true})});
    }catch{/* Browsing remains available if statistics cannot be reached. */}
  }
  function choose(value){
    withdrawn=value==='no';if(withdrawn)controller?.abort();
    try{localStorage.setItem(PREFERENCE,value);}catch{}
    if(withdrawn){try{localStorage.removeItem(VISITOR);}catch{}try{sessionStorage.removeItem(SESSION);}catch{}}
    document.getElementById('mh-analytics-dialog')?.close();if(value==='yes')record();
  }
  const css=document.createElement('style');css.textContent=`.footer-links .mh-privacy-link{display:inline-flex;align-items:center;min-height:44px;padding:0;border:0;background:transparent;color:inherit;font-family:inherit;font-size:13px;line-height:1.5;cursor:pointer}.footer-links .mh-privacy-link:hover{text-decoration:underline;text-underline-offset:4px}.mh-privacy-link:focus-visible{outline:3px solid #ae8043;outline-offset:3px}.mh-analytics-actions{display:flex;gap:9px;flex-wrap:wrap}.mh-analytics-actions button{border:1px solid #aebcb5;border-radius:3px;padding:9px 12px;background:#fff;color:#203842;font:12px/1.3 system-ui,sans-serif;cursor:pointer}.mh-analytics-actions .mh-allow{background:#203842;color:#fff;border-color:#203842}.mh-analytics-dialog{border:1px solid #ccd6d0;border-radius:6px;max-width:560px;width:calc(100% - 32px);padding:27px;color:#203842;max-height:85svh;overflow:auto;background:#fff;font:14px/1.9 system-ui,sans-serif}.mh-analytics-dialog::backdrop{background:#10222b70}.mh-analytics-dialog h2{font-size:20px;line-height:1.5;margin:0 0 20px}.mh-analytics-dialog p{font-size:13px;line-height:2;margin:0 0 20px}.mh-analytics-dialog .mh-close{float:right;border:0;background:transparent;font-size:24px;color:#52665b;cursor:pointer}.mh-analytics-actions button:focus-visible,.mh-close:focus-visible{outline:3px solid #ae8043;outline-offset:3px}`;
  document.head.append(css);
  function button(label,fn,className=''){const b=document.createElement('button');b.type='button';b.textContent=label;b.className=className;b.addEventListener('click',fn);return b;}
  function showDetails(){
    let dlg=document.getElementById('mh-analytics-dialog');if(!dlg){dlg=document.createElement('dialog');dlg.id='mh-analytics-dialog';dlg.className='mh-analytics-dialog';dlg.setAttribute('aria-labelledby','mh-analytics-title');document.body.append(dlg);}
    dlg.replaceChildren();const close=button('×',()=>dlg.close(),'mh-close');close.setAttribute('aria-label',txt.close);dlg.append(close);
    const h=document.createElement('h2');h.id='mh-analytics-title';h.textContent=txt.title;dlg.append(h);
    const p=document.createElement('p');p.textContent=txt.policy;dlg.append(p);
    const state=document.createElement('p');state.textContent=protectedBrowser()?txt.blocked:txt.status+(optedOut()?txt.no:txt.yes);dlg.append(state);
    const actions=document.createElement('div');actions.className='mh-analytics-actions';if(!protectedBrowser())actions.append(optedOut()?button(txt.allow,()=>choose('yes'),'mh-allow'):button(txt.deny,()=>choose('no')));dlg.append(actions);dlg.showModal();
  }
  function init(){
    const footer=document.querySelector('.footer-links');
    if(footer){
      const settings=button(txt.settings,showDetails,'mh-privacy-link');
      settings.setAttribute('aria-haspopup','dialog');
      footer.append(settings);
    }
    // Automatic collection without a prompt; explicit opt-outs remain effective.
    if(location.hash==='#privacy')showDetails();
    if(!protectedBrowser()&&!optedOut())record();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  addEventListener('hashchange',()=>{if(location.hash==='#privacy')showDetails();});
  addEventListener('storage',e=>{if([PREFERENCE,LEGACY_CONSENT].includes(e.key)&&optedOut()){withdrawn=true;controller?.abort();}});
})();


