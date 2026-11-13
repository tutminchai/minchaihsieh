(() => {
  'use strict';
  const cfg=window.MH_ANALYTICS;
  if(!cfg||cfg.enabled!==true||!/^https:\/\/[a-z0-9]+\.supabase\.co\/functions\/v1\/analytics$/.test(cfg.endpoint)||!/^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(cfg.publishableKey))return;
  const ENDPOINT=cfg.endpoint;
  const CONSENT='mh_analytics_consent_v1', VISITOR='mh_analytics_visitor_v1', SESSION='mh_analytics_session_v1';
  const en=document.documentElement.lang==='en';
  const txt=en?{
    title:'Website statistics',settings:'Privacy settings',
    allow:'Allow statistics',deny:'Do not allow',close:'Close',blocked:'Your browser has enabled Do Not Track or Global Privacy Control. Statistics are disabled.',
    policy:'Visits are recorded only after you agree. A random browser ID is stored on your device to estimate unique visitors; it does not identify your name. Full IP addresses are encrypted. IP addresses, visit details, daily totals and the pseudonymous visitor index are retained without an automatic expiry date and are accessible only to the site owner. Available network location is approximate, not your precise address; some locations may be unavailable. No GPS, message contents or search parameters are collected. Data is processed by this site’s private analytics service hosted on Supabase. You may withdraw permission here at any time; this stops future collection and removes the analytics ID from this browser; previously recorded data remains stored. Contact: shiehminchai@gmail.com.',
    status:'Current preference: ',yes:'Statistics allowed',no:'Statistics disabled',unset:'Not selected'
  }:{title:'網站流量統計',settings:'隱私設定',allow:'允許統計',deny:'不同意',close:'關閉',blocked:'你的瀏覽器已啟用 DNT 或 GPC 隱私選項，目前不會記錄統計。',policy:'只有在你同意後才會記錄。網站會在此瀏覽器儲存隨機編號，用來估計不重複訪客，無法因此知道你的姓名。完整 IP 加密保存；IP、瀏覽明細、每日彙總及訪客編號持續保留，不設定自動到期刪除期限，僅網站管理者可查看。可取得的地區依網路位置推估，不代表實際地址；部分地區資料可能未提供；不取得 GPS、訊息內容或網址搜尋參數。資料由本站使用的 Supabase 流量服務處理。你可以隨時在此撤回同意，停止後續記錄並移除此瀏覽器的統計編號；先前已記錄的資料仍會保留。聯絡信箱：shiehminchai@gmail.com。',status:'目前設定：',yes:'允許統計',no:'不記錄統計',unset:'尚未選擇'};
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
  function choose(value){
    withdrawn=value==='no';if(withdrawn)controller?.abort();
    try{localStorage.setItem(CONSENT,JSON.stringify({value,until:Date.now()+180*86400000}));}catch{}
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
    const state=document.createElement('p');state.textContent=protectedBrowser()?txt.blocked:txt.status+(consent()==='yes'?txt.yes:consent()==='no'?txt.no:txt.unset);dlg.append(state);
    const actions=document.createElement('div');actions.className='mh-analytics-actions';if(!protectedBrowser())actions.append(button(txt.allow,()=>choose('yes'),'mh-allow'));actions.append(button(txt.deny,()=>choose('no')));dlg.append(actions);dlg.showModal();
  }
  function init(){
    const footer=document.querySelector('.footer-links');
    if(footer){
      const settings=button(txt.settings,showDetails,'mh-privacy-link');
      settings.setAttribute('aria-haspopup','dialog');
      footer.append(settings);
    }
    // No unsolicited prompt; existing visitor preferences still govern collection.
    if(location.hash==='#privacy')showDetails();
    if(!protectedBrowser()&&consent()==='yes')record();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  addEventListener('hashchange',()=>{if(location.hash==='#privacy')showDetails();});
  addEventListener('storage',e=>{if(e.key===CONSENT&&consent()!=='yes')controller?.abort();});
})();

