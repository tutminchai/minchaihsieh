-- Dedicated schema; browser keys have no table or function privileges.
create schema analytics_private;
revoke all on schema analytics_private from public, anon, authenticated;
grant usage on schema analytics_private to service_role;
create table analytics_private.events (
 id uuid primary key, ticket uuid not null unique, at bigint not null, day date not null,
 visitor text not null, session text not null, path text not null check(path in ('/minchaihsieh/','/minchaihsieh/index.html','/minchaihsieh/en.html')),
 referrer text not null default '', device text not null check(device in ('mobile','desktop','tablet')),
 browser text not null, os text not null, country text not null default '', region text not null default '', city text not null default '',
 ip_masked text not null, ip_cipher text
);
create index events_at_idx on analytics_private.events(at desc);
create index events_visitor_idx on analytics_private.events(visitor);
create table analytics_private.visitors(id text primary key,first_at bigint not null,last_at bigint not null,views bigint not null);
create table analytics_private.daily(day date primary key,views bigint not null,unique_visitors bigint not null);
create table analytics_private.daily_visitors(day date not null,visitor text not null,primary key(day,visitor));
create table analytics_private.sessions(id text primary key,first_at bigint not null,last_at bigint not null);
create table analytics_private.rates(key text primary key,count integer not null,expires bigint not null);
create index rates_expires_idx on analytics_private.rates(expires);
create table analytics_private.owner(id boolean primary key default true check(id),user_id uuid not null,email text not null);
create table analytics_private.audit(id bigint generated always as identity primary key,at bigint not null,action text not null,event uuid not null,actor uuid not null);
alter table analytics_private.events enable row level security;
alter table analytics_private.visitors enable row level security;
alter table analytics_private.daily enable row level security;
alter table analytics_private.daily_visitors enable row level security;
alter table analytics_private.sessions enable row level security;
alter table analytics_private.rates enable row level security;
alter table analytics_private.owner enable row level security;
alter table analytics_private.audit enable row level security;
revoke all on all tables in schema analytics_private from public, anon, authenticated;
revoke all on all sequences in schema analytics_private from public, anon, authenticated;
grant all on all tables in schema analytics_private to service_role;
grant usage,select on all sequences in schema analytics_private to service_role;

-- Invoker rights: only service_role may invoke this RPC. No arbitrary SQL.
create function public.analytics_rpc(p_action text,p_data jsonb default '{}'::jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
 now_ms bigint := floor(extract(epoch from clock_timestamp())*1000)::bigint;
 n integer; fresh integer; x bigint; a jsonb; b jsonb; c jsonb; d jsonb; e jsonb; f jsonb; g jsonb; h jsonb;
 start_ms bigint; end_ms bigint; from_day date; to_day date;
 q text; device_filter text; page_number integer;
begin
 if p_action in ('collect','stats') then
  update analytics_private.events set ip_cipher=null where at<now_ms-2592000000 and ip_cipher is not null;
  delete from analytics_private.events where at<now_ms-7776000000;
  delete from analytics_private.daily_visitors where day<(current_timestamp at time zone 'Asia/Taipei')::date-89;
  delete from analytics_private.sessions where last_at<now_ms-7776000000;
  delete from analytics_private.rates where expires<now_ms;
  delete from analytics_private.audit where at<now_ms-7776000000;
 end if;
 if p_action='owner' then
  insert into analytics_private.owner(id,user_id,email) values(true,(p_data->>'id')::uuid,p_data->>'email') on conflict(id) do nothing;
  return jsonb_build_object('allowed',exists(select 1 from analytics_private.owner where user_id=(p_data->>'id')::uuid and email=p_data->>'email'));
 elsif p_action='rate' then
  delete from analytics_private.rates where expires<now_ms;
  insert into analytics_private.rates(key,count,expires) values(p_data->>'key',1,(p_data->>'expires')::bigint)
  on conflict(key) do update set count=analytics_private.rates.count+1 returning count into n;
  return jsonb_build_object('allowed',n<=(p_data->>'limit')::integer);
 elsif p_action='collect' then
  insert into analytics_private.events(id,ticket,at,day,visitor,session,path,referrer,device,browser,os,country,region,city,ip_masked,ip_cipher)
  values((p_data->>'id')::uuid,(p_data->>'ticket')::uuid,now_ms,(current_timestamp at time zone 'Asia/Taipei')::date,p_data->>'visitor',p_data->>'session',p_data->>'path',p_data->>'referrer',p_data->>'device',p_data->>'browser',p_data->>'os',p_data->>'country',p_data->>'region',p_data->>'city',p_data->>'ipMasked',p_data->>'ipCipher') on conflict do nothing;
  get diagnostics n=row_count;
  if n=1 then
   insert into analytics_private.visitors values(p_data->>'visitor',now_ms,now_ms,1)
   on conflict(id) do update set last_at=greatest(analytics_private.visitors.last_at,now_ms),views=analytics_private.visitors.views+1;
   insert into analytics_private.daily_visitors values((current_timestamp at time zone 'Asia/Taipei')::date,p_data->>'visitor') on conflict do nothing;
   get diagnostics fresh=row_count;
   insert into analytics_private.daily values((current_timestamp at time zone 'Asia/Taipei')::date,1,fresh)
   on conflict(day) do update set views=analytics_private.daily.views+1,unique_visitors=analytics_private.daily.unique_visitors+fresh;
   insert into analytics_private.sessions values(p_data->>'session',now_ms,now_ms)
   on conflict(id) do update set last_at=greatest(analytics_private.sessions.last_at,now_ms);
  end if;
  return jsonb_build_object('ok',true);
 elsif p_action='ip' then
  select jsonb_build_object('cipher',ip_cipher) into a from analytics_private.events where id=(p_data->>'id')::uuid and at>=now_ms-2592000000 and ip_cipher is not null;
  if a is not null then
   insert into analytics_private.audit(at,action,event,actor) values(now_ms,'reveal_ip',(p_data->>'id')::uuid,(p_data->>'actor')::uuid);
  end if;
  return coalesce(a,'{}'::jsonb);
 elsif p_action in ('stats','records') then
  from_day=(p_data->>'from')::date;to_day=(p_data->>'to')::date;
  if from_day>(current_timestamp at time zone 'Asia/Taipei')::date or to_day>(current_timestamp at time zone 'Asia/Taipei')::date or from_day<(current_timestamp at time zone 'Asia/Taipei')::date-89 or from_day>to_day then raise exception 'Invalid dates'; end if;
  start_ms=floor(extract(epoch from (from_day::timestamp at time zone 'Asia/Taipei'))*1000)::bigint;
  end_ms=floor(extract(epoch from ((to_day+1)::timestamp at time zone 'Asia/Taipei'))*1000)::bigint-1;
  if p_action='records' then
   q=lower(coalesce(p_data->>'q',''));device_filter=coalesce(p_data->>'device','all');page_number=(p_data->>'page')::integer;
   if page_number<1 or page_number>10000 or device_filter not in ('all','mobile','desktop','tablet') then raise exception 'Invalid filter';end if;
   select count(*) into x from analytics_private.events v where v.at between greatest(start_ms,now_ms-7776000000) and end_ms
    and (device_filter='all' or v.device=device_filter) and (q='' or strpos(lower(v.visitor||' '||v.ip_masked||' '||v.country||' '||v.region||' '||v.city),q)>0);
   select coalesce(jsonb_agg(t order by t.at desc,t.id desc),'[]'::jsonb) into a from (
    select v.id,v.at,substr(v.visitor,1,12) as visitor,v.path,v.referrer,v.device,v.browser,v.os,v.country,v.region,v.city,v.ip_masked as "ipMasked",
     case when v.at>=now_ms-2592000000 and v.ip_cipher is not null then 1 else 0 end as "ipAvailable"
    from analytics_private.events v where v.at between greatest(start_ms,now_ms-7776000000) and end_ms
    and (device_filter='all' or v.device=device_filter) and (q='' or strpos(lower(v.visitor||' '||v.ip_masked||' '||v.country||' '||v.region||' '||v.city),q)>0)
    order by v.at desc,v.id desc limit 25 offset (page_number-1)*25
   ) t;
   return jsonb_build_object('rows',a,'total',x,'page',page_number);
  end if;
  select jsonb_build_object('views',(select coalesce(sum(views),0) from analytics_private.daily),'visitors',count(*),'since',min(first_at)) into a from analytics_private.visitors;
  select jsonb_build_object('views',(select coalesce(sum(views),0) from analytics_private.daily where day between from_day and to_day),
   'visitors',(select count(distinct visitor) from analytics_private.daily_visitors where day between from_day and to_day),
   'newVisitors',(select count(*) from analytics_private.visitors where first_at between start_ms and end_ms),
   'sessions',(select count(*) from analytics_private.sessions where first_at between start_ms and end_ms)) into b;
  select coalesce(jsonb_agg(t order by t.day),'[]'::jsonb) into c from (select day,views,unique_visitors as visitors from analytics_private.daily where day between from_day and to_day)t;
  select coalesce(jsonb_agg(t),'[]'::jsonb) into d from (select device as name,count(*) as value from analytics_private.events where at between start_ms and end_ms group by device order by count(*) desc)t;
  select coalesce(jsonb_agg(t),'[]'::jsonb) into e from (select country,region,city,count(*) as value from analytics_private.events where at between start_ms and end_ms group by country,region,city order by count(*) desc limit 12)t;
  select coalesce(jsonb_agg(t),'[]'::jsonb) into f from (select path as name,count(*) as value from analytics_private.events where at between start_ms and end_ms group by path)t;
  select coalesce(jsonb_agg(t),'[]'::jsonb) into g from (select referrer as name,count(*) as value from analytics_private.events where at between start_ms and end_ms group by referrer order by count(*) desc limit 8)t;
  select count(distinct visitor) into x from analytics_private.events where at>=now_ms-300000;
  return jsonb_build_object('all',a,'period',b,'trend',c,'devices',d,'regions',e,'pages',f,'referrers',g,'active',x,'updatedAt',now_ms);
 end if;
 raise exception 'Unsupported action';
end $$;
revoke all on function public.analytics_rpc(text,jsonb) from public,anon,authenticated;
grant execute on function public.analytics_rpc(text,jsonb) to service_role;
