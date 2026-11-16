-- Add foreground time without changing retained history or view counters.
-- NULL identifies historical / legacy records with no duration measurement.
alter table analytics_private.events add column if not exists active_ms bigint check(active_ms between 0 and 86400000);
alter table analytics_private.events add column if not exists last_seen_at bigint;
-- Keep full encrypted IP, visit details and all historical totals until the owner requests deletion.
-- Only short-lived abuse-rate counters expire; no visitor history is automatically deleted.
create or replace function public.analytics_rpc(p_action text,p_data jsonb default '{}'::jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
 now_ms bigint := floor(extract(epoch from clock_timestamp())*1000)::bigint;
 n integer; fresh integer; x bigint; a jsonb; b jsonb; c jsonb; d jsonb; e jsonb; f jsonb; g jsonb; h jsonb;
 start_ms bigint; end_ms bigint; from_day date; to_day date;
 q text; device_filter text; page_number integer;
begin
 if p_action='owner' then
  insert into analytics_private.owner(id,user_id,email) values(true,(p_data->>'id')::uuid,p_data->>'email') on conflict(id) do nothing;
  return jsonb_build_object('allowed',exists(select 1 from analytics_private.owner where user_id=(p_data->>'id')::uuid and email=p_data->>'email'));
 elsif p_action='rate' then
  delete from analytics_private.rates where expires<now_ms;
  insert into analytics_private.rates(key,count,expires) values(p_data->>'key',1,(p_data->>'expires')::bigint)
  on conflict(key) do update set count=analytics_private.rates.count+1 returning count into n;
  return jsonb_build_object('allowed',n<=(p_data->>'limit')::integer);
 elsif p_action='collect' then
  insert into analytics_private.events(id,ticket,at,day,visitor,session,path,referrer,device,browser,os,country,region,city,ip_masked,ip_cipher,active_ms,last_seen_at)
  values((p_data->>'id')::uuid,(p_data->>'ticket')::uuid,now_ms,(current_timestamp at time zone 'Asia/Taipei')::date,p_data->>'visitor',p_data->>'session',p_data->>'path',p_data->>'referrer',p_data->>'device',p_data->>'browser',p_data->>'os',p_data->>'country',p_data->>'region',p_data->>'city',p_data->>'ipMasked',p_data->>'ipCipher',case when p_data->>'trackDuration'='true' then 0 else null end,now_ms) on conflict do nothing;
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
  return jsonb_build_object('ok',true,'durationReady',exists(select 1 from analytics_private.events
   where id=(p_data->>'id')::uuid and ticket=(p_data->>'ticket')::uuid and visitor=p_data->>'visitor' and active_ms is not null));
 elsif p_action='duration' then
  -- A cumulative maximum makes duplicate and out-of-order heartbeats harmless.
  -- The capability is checked by the Edge function; match its event ownership again here.
  update analytics_private.events set active_ms=greatest(active_ms,(p_data->>'activeMs')::bigint),
   last_seen_at=case when (p_data->>'activeMs')::bigint>active_ms then now_ms else last_seen_at end
   where id=(p_data->>'id')::uuid and ticket=(p_data->>'ticket')::uuid and visitor=p_data->>'visitor'
   and active_ms is not null and now_ms-at between 0 and 86400000
   and (p_data->>'activeMs')::bigint between 0 and least(86400000,now_ms-at+2000);
  get diagnostics n=row_count;
  return jsonb_build_object('ok',n=1);
 elsif p_action='ip' then
  select jsonb_build_object('cipher',ip_cipher) into a from analytics_private.events where id=(p_data->>'id')::uuid and ip_cipher is not null;
  if a is not null then
   insert into analytics_private.audit(at,action,event,actor) values(now_ms,'reveal_ip',(p_data->>'id')::uuid,(p_data->>'actor')::uuid);
  end if;
  return coalesce(a,'{}'::jsonb);
 elsif p_action in ('stats','records') then
  from_day=(p_data->>'from')::date;to_day=(p_data->>'to')::date;
  if from_day>(current_timestamp at time zone 'Asia/Taipei')::date or to_day>(current_timestamp at time zone 'Asia/Taipei')::date or from_day<date '2000-01-01' or from_day>to_day then raise exception 'Invalid dates'; end if;
  start_ms=floor(extract(epoch from (from_day::timestamp at time zone 'Asia/Taipei'))*1000)::bigint;
  end_ms=floor(extract(epoch from ((to_day+1)::timestamp at time zone 'Asia/Taipei'))*1000)::bigint-1;
  if p_action='records' then
   q=lower(coalesce(p_data->>'q',''));device_filter=coalesce(p_data->>'device','all');page_number=(p_data->>'page')::integer;
   if page_number<1 or page_number>10000 or device_filter not in ('all','mobile','desktop','tablet') then raise exception 'Invalid filter';end if;
   select count(*) into x from analytics_private.events v where v.at between start_ms and end_ms
    and (device_filter='all' or v.device=device_filter) and (q='' or strpos(lower(v.visitor||' '||v.ip_masked||' '||v.country||' '||v.region||' '||v.city),q)>0);
   select coalesce(jsonb_agg(t order by t.at desc,t.id desc),'[]'::jsonb) into a from (
    select v.id,v.at,substr(v.visitor,1,12) as visitor,v.path,v.referrer,v.device,v.browser,v.os,v.country,v.region,v.city,v.ip_masked as "ipMasked",v.active_ms as "activeMs",v.last_seen_at as "lastSeenAt",
     case when v.ip_cipher is not null then 1 else 0 end as "ipAvailable"
    from analytics_private.events v where v.at between start_ms and end_ms
    and (device_filter='all' or v.device=device_filter) and (q='' or strpos(lower(v.visitor||' '||v.ip_masked||' '||v.country||' '||v.region||' '||v.city),q)>0)
    order by v.at desc,v.id desc limit 25 offset (page_number-1)*25
   ) t;
   return jsonb_build_object('rows',a,'total',x,'page',page_number);
  end if;
  select jsonb_build_object('views',(select coalesce(sum(views),0) from analytics_private.daily),'visitors',count(*),'since',min(first_at)) into a from analytics_private.visitors;
  select jsonb_build_object('views',(select coalesce(sum(views),0) from analytics_private.daily where day between from_day and to_day),
   'visitors',(select count(distinct visitor) from analytics_private.daily_visitors where day between from_day and to_day),
   'newVisitors',(select count(*) from analytics_private.visitors where first_at between start_ms and end_ms),
   'averageActiveMs',(select round(avg(active_ms)) from analytics_private.events where at between start_ms and end_ms),
   'measuredViews',(select count(active_ms) from analytics_private.events where at between start_ms and end_ms),
   'totalActiveMs',(select coalesce(sum(active_ms),0) from analytics_private.events where at between start_ms and end_ms),
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

