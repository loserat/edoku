const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process"), ejs = require("ejs");
function walk(file) { return fs.statSync(file).isDirectory() ? fs.readdirSync(file).flatMap(name => walk(path.join(file,name))) : [file]; }
const scripts = ["server.js","services","src","public/js","scripts"].flatMap(walk).filter(file => file.endsWith(".js"));
for (const file of scripts) execFileSync(process.execPath,["--check",file]);
const views=walk("views").filter(file=>file.endsWith(".ejs"));
for(const file of views)ejs.compile(fs.readFileSync(file,"utf8"),{filename:path.resolve(file)});
console.log(JSON.stringify({javascriptFiles:scripts.length,templates:views.length,syntax:"ok"}));
