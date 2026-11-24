-- The public footer reads through the Edge Function. Browser roles cannot call
-- the database function or read the daily rollups directly.
create or replace function public.site_page_views()
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(sum(views), 0)::text from analytics_private.daily;
$$;

revoke all on function public.site_page_views() from public, anon, authenticated;
grant execute on function public.site_page_views() to service_role;

alter table analytics_private.events
  drop constraint events_path_check,
  add constraint events_path_check check (path in (
    '/minchaihsieh/', '/minchaihsieh/index.html',
    '/minchaihsieh/en.html', '/minchaihsieh/ja.html'
  ));

notify pgrst, 'reload schema';
