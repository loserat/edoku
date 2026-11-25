const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {generate,validateMap,operationIndex}=require('./api-docs');
test('Referenz entspricht dem tatsächlichen MCP-Katalog und OpenAPI-Vertrag ohne echten API-Zugang',async()=>{
 const files=await generate(),api=JSON.parse(files['openapi.json']),mcp=JSON.parse(files['mcp-tools.json']),manifest=JSON.parse(files['manifest.json']);
 assert.equal(manifest.operations,operationIndex(api).length);assert.equal(manifest.totalTools,mcp.tools.length);assert.equal(manifest.readTools,mcp.readOnlyToolNames.length);assert.equal(manifest.writeTools,mcp.tools.filter(t=>!t.annotations.readOnlyHint).length);
 assert.ok(!mcp.tools.some(t=>/approve|freigeben/i.test(t.name)));assert.ok(mcp.tools.some(t=>t.name==='edoku_correct_requirement_devices'));
 for(const[name,content]of Object.entries(files))assert.equal(await fs.readFile(path.join(__dirname,'../docs/api',name),'utf8'),content,'Veraltete Dokumentation: '+name);
});
test('Neue Werkzeuge, falsche API-Zuordnungen und abweichender Lesekatalog werden erkannt',async()=>{
 const files=await generate(),mcp=JSON.parse(files['mcp-tools.json']),operations=operationIndex(JSON.parse(files['openapi.json']));
 const read={tools:mcp.tools.filter(t=>t.annotations.readOnlyHint)};
 assert.throws(()=>validateMap(operations,{tools:[...mcp.tools,{name:'edoku_undocumented'}]},read),/Zuordnung fehlt/);
 assert.throws(()=>validateMap([],mcp,read),/Unbekannte API-Operation/);
 assert.throws(()=>validateMap(operations,mcp,{tools:read.tools.slice(1)}),/Lesekatalog/);
});
