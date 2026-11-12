import {createHandler} from './core.ts';
Deno.serve(createHandler({
 SUPABASE_URL:Deno.env.get('SUPABASE_URL')||'',
 SUPABASE_ANON_KEY:Deno.env.get('SUPABASE_ANON_KEY')||'',
 SUPABASE_SERVICE_ROLE_KEY:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',
 ADMIN_EMAIL:Deno.env.get('ADMIN_EMAIL')||'',
 ANALYTICS_SECRET:Deno.env.get('ANALYTICS_SECRET')||'',
}));
