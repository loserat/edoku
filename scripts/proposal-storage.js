#!/usr/bin/env node
const path=require('node:path'),Database=require('better-sqlite3');
const args=process.argv.slice(2),at=args.indexOf('--root');
if(at<0||!args[at+1]||!path.isAbsolute(args[at+1])||args.some((x,i)=>!['--root','--apply'].includes(x)&&i!==at+1)){
 console.error('Aufruf: node scripts/proposal-storage.js --root /absoluter/installationsordner [--apply]');process.exit(2);
}
const db=new Database(path.join(args[at+1],'storage/app.db'),{fileMustExist:true,readonly:!args.includes('--apply')});
try{console.log(JSON.stringify(require('../services/documentProposalStorageService').upgrade(db,{apply:args.includes('--apply')})));}finally{db.close();}
