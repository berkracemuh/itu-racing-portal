// ITU Racing portal — background push notifications (runs on GitHub Actions every 15 min).
// Reads the team data with the service account and sends FCM web-push messages to registered devices.
import {initializeApp,cert} from 'firebase-admin/app';
import {getFirestore,FieldPath,FieldValue} from 'firebase-admin/firestore';
import {getMessaging} from 'firebase-admin/messaging';

const sa=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT||'{}');
if(!sa.project_id){console.error('FIREBASE_SERVICE_ACCOUNT secret eksik ya da hatalı.');process.exit(1)}
initializeApp({credential:cert(sa)});
const db=getFirestore(),fcm=getMessaging();
const TEST=process.env.PUSH_TEST==='true';
const SITE='https://berkracemuh.github.io/itu-racing-portal/';
const TZ='Europe/Istanbul';
const now=Date.now();
const today=new Date().toLocaleDateString('en-CA',{timeZone:TZ});
const hour=+new Date().toLocaleString('en-GB',{timeZone:TZ,hour:'2-digit',hour12:false});
const DAYTIME=hour>=9&&hour<22;
const daysTo=d=>Math.round((Date.parse(d+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))/864e5);
const ms=v=>v&&typeof v.toMillis==='function'?v.toMillis():(typeof v==='number'?v:0);
const fdate=d=>{const [y,m,dd]=d.split('-').map(Number);return new Date(Date.UTC(y,m-1,dd)).toLocaleDateString('tr-TR',{day:'numeric',month:'short',timeZone:'UTC'})};

const logRef=db.doc('meta/pushlog');
const log=(await logRef.get()).data()||{};
const last=log.last||0,sent=log.sent||{};
const Q=new Map();const push=(uid,m)=>{if(!uid)return;if(!Q.has(uid))Q.set(uid,[]);Q.get(uid).push(m)};

const users=async(field,val)=>(await db.collection('users').where(field,'==',val).get()).docs.map(d=>({id:d.id,...d.data()}));

if(TEST){
  const admins=await users('role','admin');
  admins.forEach(a=>push(a.id,{title:'ITU Racing · Test bildirimi',body:'Arka plan bildirimleri çalışıyor.',url:SITE+'#takim',tag:'test'}));
  console.log('Test modu: '+admins.length+' yöneticiye test bildirimi hazırlandı.');
}else if(!last){
  await logRef.set({last:now,sent:{}},{merge:true});
  console.log('İlk çalışma: başlangıç zamanı kaydedildi, bildirim gönderilmedi.');process.exit(0);
}else{
  // 1) new assignments + tasks due today/tomorrow
  for(const col of ['teamchk','teampcb']){
    const snap=await db.collection(col).get();
    snap.forEach(doc=>{
      const as=doc.get('as')||{},st=doc.get('s')||{};
      for(const [k,a] of Object.entries(as)){
        if(!a||!a.u)continue;
        const label=col==='teampcb'?doc.id+' · '+k:k;
        if(ms(a.a)>last&&a.by!==a.u)push(a.u,{title:'Sana yeni görev atandı',body:label+(a.d?' · son tarih '+fdate(a.d):''),url:SITE+'#takim',tag:'as-'+doc.id+'-'+k});
        if(a.d&&st[k]!=='ok'&&DAYTIME){
          const dd=daysTo(a.d),key=['due',col,doc.id,k,a.d,dd].join('|');
          if((dd===0||dd===1)&&!sent[key]){sent[key]=now;push(a.u,{title:dd===0?'Görevinin son günü bugün':'Görevinin son günü yarın',body:label,url:SITE+'#takim',tag:'due-'+doc.id+'-'+k})}
        }
      }
    });
  }
  // 2) team deadlines: 7, 3, 1 days left and the day itself
  const dls=((await db.doc('meta/deadlines').get()).data()||{}).d||{};
  let members=null;
  for(const [id,d] of Object.entries(dls)){
    if(!d||d.done||!d.date||!DAYTIME)continue;
    const dd=daysTo(d.date),key=['dl',id,d.date,dd].join('|');
    if(![7,3,1,0].includes(dd)||sent[key])continue;
    sent[key]=now;members=members||await users('status','approved');
    members.forEach(u=>push(u.id,{title:dd===0?(d.t||'Teslim')+' için son gün bugün':(d.t||'Teslim')+' teslimine '+dd+' gün kaldı',body:fdate(d.date)+(d.time?' · '+d.time:'')+(d.note?' · '+d.note:''),url:SITE+'#takim',tag:'dl-'+id}));
  }
  // 3) new membership applications -> admins
  const pend=(await users('status','pending')).filter(u=>!sent['pend|'+u.id]);
  if(pend.length){
    const admins=await users('role','admin');
    pend.forEach(u=>{sent['pend|'+u.id]=now});
    const names=pend.map(u=>((u.ad||'')+' '+(u.soyad||'')).trim()||'İsimsiz').join(', ');
    admins.forEach(a=>push(a.id,{title:pend.length===1?'Yeni üyelik başvurusu':pend.length+' yeni üyelik başvurusu',body:names+' onayını bekliyor.',url:SITE+'#profil',tag:'pend'}));
  }
}

// send
let ok=0,fail=0,removed=0,noDevice=0;
for(const [uid,msgs] of Q){
  const sref=db.doc('users/'+uid+'/private/state');
  const tokens=Object.keys(((await sref.get()).data()||{}).push||{});
  if(!tokens.length){noDevice++;continue}
  const list=msgs.length>3?[{title:msgs.length+' yeni bildirimin var',body:msgs.slice(0,3).map(m=>m.title).join(' · ')+'…',url:SITE+'#takim',tag:'sum'}]:msgs;
  for(const m of list){
    const r=await fcm.sendEachForMulticast({tokens,data:{title:m.title,body:m.body||'',url:m.url||SITE,tag:m.tag||''},webpush:{headers:{Urgency:'high',TTL:'86400'}}});
    ok+=r.successCount;fail+=r.failureCount;
    for(let i=0;i<r.responses.length;i++){
      const e=r.responses[i].error;if(!e)continue;
      if(['messaging/registration-token-not-registered','messaging/invalid-registration-token','messaging/invalid-argument'].includes(e.code)){
        await sref.update(new FieldPath('push',tokens[i]),FieldValue.delete()).catch(()=>{});removed++;tokens.splice(i,1);r.responses.splice(i,1);i--;
      }else console.log('Gönderim hatası:',e.code);
    }
  }
}
// prune old keys, save state
for(const k of Object.keys(sent))if(now-sent[k]>45*864e5)delete sent[k];
if(!TEST)await logRef.set({last:now,sent},{merge:false});
console.log(`Kişi: ${Q.size} · gönderilen: ${ok} · başarısız: ${fail} · cihazı olmayan: ${noDevice} · silinen eski cihaz: ${removed}`);
