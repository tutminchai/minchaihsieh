import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import Dashboard from './dashboard';
import {client,configured,apiFetch,signIn,signOut} from './session';
import './styles.css';
function App(){
 const [ready,setReady]=useState(!configured),[owner,setOwner]=useState(false),[signedIn,setSignedIn]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{
  if(!client)return;
  let active=true,revision=0;
  async function check(){const rev=++revision;setReady(false);setOwner(false);try{const {data:{session}}=await client!.auth.getSession();if(!active||rev!==revision)return;setSignedIn(!!session);if(session){const r=await apiFetch('/api/me');if(!active||rev!==revision)return;if(r.ok){setOwner(true);setError('');}else{setError(r.status===403?'此帳號沒有管理權限，請改用網站擁有者的帳號登入。':'登入驗證失敗，請重新登入。');}}}catch{if(active&&rev===revision)setError('暫時無法連接後台，請稍後再試。');}finally{if(active&&rev===revision)setReady(true);}}
  const {data:{subscription}}=client.auth.onAuthStateChange(()=>{setTimeout(()=>{if(active)void check();},0);});
  const expired=()=>{revision++;setOwner(false);setSignedIn(true);setError('登入已到期，請重新登入。');setReady(true);};window.addEventListener('mh-session-expired',expired);
  return()=>{active=false;revision++;subscription.unsubscribe();window.removeEventListener('mh-session-expired',expired);};
 },[]);
 const login=async()=>{setBusy(true);setError('');try{await signIn();}catch{setBusy(false);setError('無法開啟 Google 登入，請稍後再試。');}};
 const logout=async()=>{setBusy(true);try{await signOut();}catch{setBusy(false);setError('登出失敗，請重試。');}};
 if(!ready)return <div className="boot" role="status">正在確認登入身分…</div>;
 if(owner)return <Dashboard/>;
 return <main className="login"><section className="login-main"><a className="brand" href="../"><span className="monogram">MH</span><span>MIN-CHAI HSIEH<small>個人網站 · 流量管理</small></span></a><div className="login-copy"><p className="eyebrow">PRIVATE ANALYTICS</p><h1>看見每一次<br/>交流的起點<span>。</span></h1><p>從瀏覽趨勢、來訪地區到裝置分布，<br/>了解網站如何與讀者相遇。</p><div className="login-box"><p className="login-label">管理者登入</p><p>僅網站擁有者可查看流量及瀏覽紀錄。</p>{!configured?<p className="notice status-message" role="status">後台正在完成帳號與資料庫連接，目前尚未啟用。</p>:<button className="primary" disabled={busy} onClick={signedIn?logout:login}>{busy?'處理中…':signedIn?'登出並切換帳號':'使用 Google 帳號登入'}<span>↗</span></button>}{error&&<p role="alert" className="error status-message">{error}</p>}<small>登入後會返回此網站。其他帳號無法查看資料。</small></div></div><footer>謝旻儕 · 研究、教學與實作</footer></section><aside className="login-art"><div className="orbit one"/><div className="orbit two"/><div className="art-label">RESEARCH / TEACHING / PRACTICE</div><div className="art-core"><span>01—03</span><h2>來訪・地域・裝置</h2><p>把數據整理成清楚的日常紀錄。</p><div className="art-bars">{[26,46,38,68,52,84,66,98,80,116,91,132].map((h,i)=><i key={i} style={{height:h}}/>)}</div><small>抽象示意圖，非實際流量</small></div><div className="art-bottom">PRIVATE ACCESS <span>TAIPEI, UTC+8</span></div></aside></main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
