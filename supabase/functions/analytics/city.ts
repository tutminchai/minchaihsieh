import {isIP} from 'node:net';
import taiwan from './data/tw-city.json' with {type:'json'};

type Ranges<T> = ReadonlyArray<readonly [T,T,number]>;
export type CityData = {locations:ReadonlyArray<readonly [string,string]>;ipv4:Ranges<number>;ipv6:Ranges<string>};

// Only translate unambiguous names. The source's legacy state/province field
// (e.g. "Taiwan") is not a modern county and must not be displayed as one.
const names:Record<string,string>={
 'Taipei':'台北市','Taipei City':'台北市','New Taipei City':'新北市',
 'Taoyuan':'桃園市','Taoyuan City':'桃園市','Taichung':'台中市','Taichung City':'台中市',
 'Tainan':'台南市','Tainan City':'台南市','Kaohsiung':'高雄市','Kaohsiung City':'高雄市',
 'Keelung':'基隆市','Keelung City':'基隆市','Hsinchu City':'新竹市','Hsinchu':'新竹',
 'Chiayi City':'嘉義市','Chiayi':'嘉義','Changhua':'彰化','Yilan':'宜蘭','Miaoli':'苗栗',
 'Hualien City':'花蓮市','Pingtung City':'屏東市','Nantou City':'南投市','Taitung':'台東',
 // District affiliations checked against their official city/office websites.
 'Yongkang District':'台南市','Xinying District':'台南市',
 'Fongshan District':'高雄市','Fengshan District':'高雄市',
};

function find<T extends number|string>(rows:Ranges<T>,value:T):number|undefined{
 let lo=0,hi=rows.length-1;
 while(lo<=hi){const mid=(lo+hi)>>>1,row=rows[mid];if(value<row[0])hi=mid-1;else if(value>row[1])lo=mid+1;else return row[2];}
 return undefined;
}
const ipv4=(ip:string)=>ip.split('.').reduce((value,octet)=>value*256+Number(octet),0);
function ipv6(ip:string){
 // isIP has already validated the address. Normalize embedded dotted IPv4,
 // compressed notation and letter case before lexicographic range comparison.
 const dotted=ip.lastIndexOf(':');
 if(ip.includes('.')){const n=ipv4(ip.slice(dotted+1));ip=ip.slice(0,dotted+1)+(n>>>16).toString(16)+':'+(n&65535).toString(16);}
 const halves=ip.split('::'),left=halves[0]?halves[0].split(':'):[],right=halves[1]?halves[1].split(':'):[];
 const parts=halves.length===2?[...left,...Array(8-left.length-right.length).fill('0'),...right]:left;
 return parts.map(part=>part.padStart(4,'0')).join('').toLowerCase();
}

// The compact public dataset is bundled with the function. This lookup makes
// no requests and never sends a visitor IP to the database publisher.
export function createTaiwanCityLookup(data:CityData=taiwan as unknown as CityData){
 return (ip:string):{region:string;city:string}|null=>{
  if(typeof ip!=='string'||ip.includes('%'))return null;
  const family=isIP(ip);let id:number|undefined;
  if(family===4)id=find(data.ipv4,ipv4(ip));
  else if(family===6){const hex=ipv6(ip);id=hex.startsWith('00000000000000000000ffff')?find(data.ipv4,parseInt(hex.slice(24),16)):find(data.ipv6,hex);}
  else return null;
  const location=id===undefined?undefined:data.locations[id];
  const city=location?names[location[1]]:undefined;
  return city?{region:'',city}:null;
 };
}
