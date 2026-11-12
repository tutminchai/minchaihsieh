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
 return <main className="login">
  <section className="login-main" aria-labelledby="login-title">
   <h1 id="login-title">管理者登入</h1>
   <div className="login-box">
    {!configured?<p className="notice status-message" role="status">登入服務暫時無法使用。</p>:<button className="primary" disabled={busy} onClick={signedIn?logout:login}>{busy?'處理中…':signedIn?'登出並切換帳號':'使用 Google 帳號登入'}<span aria-hidden="true">↗</span></button>}
    {error&&<p role="alert" className="error status-message">{error}</p>}
   </div>
   <a className="login-back" href="../">返回個人網站</a>
  </section>
 </main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
