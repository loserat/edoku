// Trusted publisher roots; administrator-owned config may add verified publishers.
const sources={
 zappzimmermann:['z-z.de'],
 abb:['abb.com'],bachmann:['bachmann.com'],berker:['hager.com','hager.de','berker.com'],
 buschjaeger:['busch-jaeger.de','abb.com'],cellpack:['cellpack.com'],eaton:['eaton.com'],
 eltropa:['eltropa.de'],esser:['esser-systems.com'],hegler:['hegler.de'],hensel:['hensel-electric.de','hensel-electric.com'],
 indexa:['indexa.de'],klauke:['klauke.com'],mersen:['mersen.com'],phoenixcontact:['phoenixcontact.com'],
 rittal:['rittal.com'],siemens:['siemens.com'],siteco:['siteco.com','siteco.de'],weidmuller:['weidmueller.com'],
 bega:['bega.com'],sikora:['sikora-notlicht.de'],
 bals:['bals.com','bals.cz','bals.nl'],brumberg:['brumberg.com'],esylux:['esylux.com','esylux.de'],
 gira:['gira.de','gira.com'],hager:['hager.com','hager.de'],niedax:['niedax.de','niedax.com','niedax-group.com'],
 mennekes:['mennekes.de','mennekes.org'],warema:['warema.com'],trilux:['trilux.com'],
 schneider:['se.com','schneider-electric.com'],telegartner:['telegaertner.com'],rm:['rdm.com'],eupen:['eupen.com'],
 kaiser:['kaiser-elektro.de','kaiser-elektro.ch','kaisergroup.com'],spelsberg:['spelsberg.de','spelsberg.com'],wiska:['wiska.com'],
 ledvance:['ledvance.de','ledvance.com'],obo:['obo.de','obo.global'],frankische:['fraenkische.com'],
 kleinhuis:['kleinhuis.de'],isoled:['isoled.de','isoled.info'],striebeljohn:['striebelundjohn.com','abb.com'],
 walther:['walther-werke.de','walther-electric.de'],signify:['signify.com','lighting.philips.com','lighting.philips.de']
};
const key=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
function domainsFor(manufacturer,extra={}){
 const normalized=key(manufacturer),k=({obobettermann:'obo',abbstotz:'abb',abbstriebeljohn:'striebeljohn'})[normalized]||normalized,registry={...sources,...extra};
 const own=Object.keys(extra).find(x=>key(x)===normalized)||Object.keys(extra).find(x=>key(x)===k);
 if(own)return extra[own];
 const exact=Object.keys(registry).find(x=>key(x)===normalized)||Object.keys(registry).find(x=>key(x)===k);
 const alias=exact||Object.keys(sources).find(x=>x.length>=4&&k.startsWith(x));
 return (exact?({...sources,...extra})[exact]:sources[alias])||[];
}
function trustedPage(manufacturer,url,extra){try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&domainsFor(manufacturer,extra).some(host=>u.hostname===host||u.hostname.endsWith('.'+host));}catch{return false;}}
// Previously verified catalogue alias. New aliases require an administrator's source check.
const articleAliases={frankische:{'FPKu-EM-F 32':'22210032'},brumberg:{'00535500':'5355'},signify:{'72837600':'929001218102'},ledvance:{'PL625RECESS.MOUNTFR.':'4058075402904','PL625SUR.MOUNTKITH75':'4058075472938'},obobettermann:{'DORT3B':'SDE-RW D0RT3B','DORW2B':'SDE-RW D0RW2B','GS-KUP70 (VE2)':'6277290'}};
function aliasFor(manufacturer,model,extra={}){
 const name=key(manufacturer),group=Object.entries(extra).find(([k])=>key(k)===name)?.[1]||articleAliases[name];
 // Rittal prints "DK 7072100" for the catalogue notation "DK 7072.100".
 // Preserve DK and every digit; page and PDF still need their own article proof.
 if(name==='rittal'&&!group&&/^DK\s+\d{4}\.\d{3}$/.test(model))return model.replace('.','');
 return group&&Object.hasOwn(group,model)?String(group[model]):null;
}
function confirmedAlias(manufacturer,model,documentModel,extra={}){return aliasFor(manufacturer,model,extra)===documentModel;}
function publisherNames(manufacturer){
 const name=key(manufacturer);
 return ({abbstotz:['ABB'],abbstriebeljohn:['ABB','STRIEBEL & JOHN'],striebeljohn:['STRIEBEL & JOHN','ABB'],berker:['Berker','Hager']})[name]||[manufacturer];
}
module.exports={trustedPage,domainsFor,confirmedAlias,aliasFor,publisherNames};
