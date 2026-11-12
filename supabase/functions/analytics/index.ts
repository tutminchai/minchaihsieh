import {createHandler} from './core.ts';
import {createCountryLookup} from './country.ts';
import {Reader} from 'npm:mmdb-lib@3.0.5';
import {Buffer} from 'node:buffer';
const countryLookup=createCountryLookup({reader:bytes=>new Reader(Buffer.from(bytes))});
Deno.serve(createHandler({
 SUPABASE_URL:Deno.env.get('SUPABASE_URL')||'',
 SUPABASE_ANON_KEY:Deno.env.get('SUPABASE_ANON_KEY')||'',
 SUPABASE_SERVICE_ROLE_KEY:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',
 ADMIN_EMAIL:Deno.env.get('ADMIN_EMAIL')||'',
 ANALYTICS_SECRET:Deno.env.get('ANALYTICS_SECRET')||'',
},{countryLookup}));

