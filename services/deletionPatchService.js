const {isDeepStrictEqual:equal}=require('node:util');
const own=(o,k)=>o!==null&&typeof o==='object'&&Object.hasOwn(o,k);
const set=(o,k,v)=>Object.defineProperty(o,k,{value:structuredClone(v),writable:true,enumerable:true,configurable:true});
function arrayKey(a,b){
  return ['id','pos'].find(key=>[a,b].every(items=>items.every(x=>own(x,key))&&new Set(items.map(x=>x[key])).size===items.length));
}
// Selektoren verwenden stabile IDs/Positionsnummern statt veränderlicher Array-Indizes.
function changes(before,after,path=[],out=[]){
  if(equal(before,after))return out;
  if(Array.isArray(before)&&Array.isArray(after)){
    const key=arrayKey(before,after);
    if(key){
      for(const value of new Set([...before,...after].map(x=>x[key]))){
        const a=before.findIndex(x=>x[key]===value),b=after.findIndex(x=>x[key]===value),next=[...path,{key,value}];
        if(a<0||b<0)out.push({path:next,beforePresent:a>=0,afterPresent:b>=0,...(a>=0?{before:before[a]}:{}),...(b>=0?{after:after[b]}:{}),index:Math.max(a,b)});
        else changes(before[a],after[b],next,out);
      }
      return out;
    }
  }else if(before&&after&&typeof before==='object'&&typeof after==='object'&&!Array.isArray(before)&&!Array.isArray(after)){
    for(const key of new Set([...Object.keys(before),...Object.keys(after)])){
      if(!own(before,key)||!own(after,key))out.push({path:[...path,key],beforePresent:own(before,key),afterPresent:own(after,key),...(own(before,key)?{before:before[key]}:{}),...(own(after,key)?{after:after[key]}:{})});
      else changes(before[key],after[key],[...path,key],out);
    }
    return out;
  }
  out.push({path,beforePresent:true,afterPresent:true,before,after});return out;
}
function parentAt(root,path){
  let node=root;
  for(const step of path){
    if(typeof step==='object'){
      if(!Array.isArray(node))return;
      const matches=node.filter(x=>own(x,step.key)&&x[step.key]===step.value);
      if(matches.length!==1)return;node=matches[0];
    }else{if(!own(node,step))return;node=node[step];}
  }
  return node;
}
function reverse(current,patches){
  const result=structuredClone(current);
  for(const p of patches){
    const parent=parentAt(result,p.path.slice(0,-1)),key=p.path.at(-1);
    if(!parent||key===undefined)throw Error('RESTORE_CONFLICT');
    let present,value,index;
    if(typeof key==='object'){
      if(!Array.isArray(parent))throw Error('RESTORE_CONFLICT');
      const matches=parent.map((x,i)=>({x,i})).filter(({x})=>own(x,key.key)&&x[key.key]===key.value);
      if(matches.length>1)throw Error('RESTORE_CONFLICT');present=matches.length===1;value=matches[0]?.x;index=matches[0]?.i;
    }else{present=own(parent,key);value=present?parent[key]:undefined;}
    if(present!==p.afterPresent||(present&&!equal(value,p.after)))throw Error('RESTORE_CONFLICT');
    if(typeof key==='object'){
      if(p.beforePresent){if(present)parent[index]=structuredClone(p.before);else parent.splice(Math.min(p.index,parent.length),0,structuredClone(p.before));}
      else if(present)parent.splice(index,1);
    }else if(p.beforePresent)set(parent,key,p.before);else delete parent[key];
  }
  return result;
}
module.exports={changes,reverse};
