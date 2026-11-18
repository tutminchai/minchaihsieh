import assert from 'node:assert/strict';
import {createTaiwanCityLookup,type CityData} from '../supabase/functions/analytics/city.ts';
import data from '../supabase/functions/analytics/data/tw-city.json' with {type:'json'};

const lookup=createTaiwanCityLookup();
assert.deepEqual(lookup('1.172.33.0'),{region:'',city:'台南市'});
assert.deepEqual(lookup('1.172.129.0'),{region:'',city:'高雄市'});
assert.deepEqual(lookup('2001:b011::'),{region:'',city:'高雄市'});
assert.deepEqual(lookup('2001:0B011::'),null); // invalid 5-digit IPv6 component
assert.deepEqual(lookup('2001:B011:0000:0000:0000:0000:0000:0000'),lookup('2001:b011::'));
assert.deepEqual(lookup('2407:9240:3109::'),{region:'',city:'台南市'});
assert.deepEqual(lookup('::ffff:1.172.33.0'),lookup('1.172.33.0'));
assert.deepEqual(lookup('::ffff:1ac:2100'),lookup('1.172.33.0'));
for(const ip of ['8.8.8.8','203.0.113.1','192.168.1.1','::1','fe80::1%en0','invalid','999.1.1.1','1.2.3.4/path'])assert.equal(lookup(ip),null);

const fixture=createTaiwanCityLookup({locations:[['Taiwan','Tainan'],['Taipei','ambiguous'],['Kaohsiung','Kaohsiung City']],ipv4:[[10,20,0],[30,40,1],[50,60,2]],ipv6:[['20010000000000000000000000000001','20010000000000000000000000000003',0]]} as CityData);
for(const ip of ['0.0.0.10','0.0.0.20','2001::1','2001::3'])assert.equal(fixture(ip)?.city,'台南市');
for(const ip of ['0.0.0.9','0.0.0.21','0.0.0.29','0.0.0.61','2001::','2001::4'])assert.equal(fixture(ip),null);
assert.equal(fixture('0.0.0.30'),null); // Do not turn a province into a city or guess a place.
assert.equal(fixture('0.0.0.50')?.city,'高雄市');
assert.equal(data.country,'TW');assert.equal(data.source.license,'CC-BY-4.0');
assert(data.ipv4.length>10000&&data.ipv6.length>1000);
for(const rows of [data.ipv4,data.ipv6]){
 let previous:number|string|undefined;
 for(const [start,end,id] of rows){
  assert(start<=end);if(previous!==undefined)assert(previous<start);
  assert(Number.isInteger(id)&&Number(id)>=0&&Number(id)<data.locations.length);
  previous=end;
 }
}
// All representative IPs above are public database boundaries, not visit logs.
console.log('PASS: Taiwan city data integrity, IPv4/IPv6/mapped addresses, range boundaries, Chinese labels and unknown-location fallback.');
