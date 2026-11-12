// This check prevents accidentally publishing privileged keys. Server permissions
// remain authoritative; decoding a public JWT is not authentication.
export function isPublicKey(value:string):boolean {
 if (/^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(value)) return true;
 try {
  const parts=value.split('.');
  if(parts.length!==3||!parts.every(p=>/^[A-Za-z0-9_-]+$/.test(p)))return false;
  const payload=JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')));
  return payload.role==='anon'&&payload.iss==='supabase';
 } catch {return false;}
}
