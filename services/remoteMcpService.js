// Authenticated, stateless HTTP transport. No shared client/server instances or cookie auth.
const { createMcpHandler } = require('@modelcontextprotocol/server');
const { toNodeHandler } = require('@modelcontextprotocol/node');
const { createMcpServer } = require('./mcpServerService');
const MAX_BODY_BYTES = 256 * 1024;
function createRemoteMcpHandler({ tokens, settings, apiBaseUrl, publicOrigin = process.env.APP_ORIGIN, maxActive = 8, maxPerUser = 2 }) {
  const api = new URL(apiBaseUrl);
  if (api.protocol !== 'http:' || !['127.0.0.1','[::1]'].includes(api.hostname) || api.pathname !== '/' || api.search || api.hash || api.username || api.password) throw Error('Remote-MCP benötigt eine feste interne Loopback-API.');
  let active = 0; const users = new Map();
  function reject(res,status,code,message) { return res.status(status).json({jsonrpc:'2.0',id:null,error:{code:-32000,message,data:{code}}}); }
  return async (req,res) => {
    res.set('Cache-Control','no-store');
    let handler, admitted = false, userId; const inFlight = new Set();
    const trackToolCall = work => { const task = Promise.resolve().then(work); inFlight.add(task); return task.finally(()=>inFlight.delete(task)); };
    try {
      const configuration = await settings.read();
      if (!configuration.apiEnabled || !configuration.remoteMcpEnabled) return reject(res,404,'REMOTE_MCP_DISABLED','Remote-MCP ist ausgeschaltet.');
      let origin;
      try { origin = new URL(publicOrigin); } catch { return reject(res,503,'PUBLIC_ORIGIN_REQUIRED','Öffentliche HTTPS-Serveradresse konfigurieren.'); }
      if (origin.protocol !== 'https:' || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/') return reject(res,503,'PUBLIC_ORIGIN_REQUIRED','Öffentliche HTTPS-Serveradresse konfigurieren.');
      if (!req.secure) return reject(res,403,'HTTPS_REQUIRED','Remote-MCP benötigt HTTPS.');
      for (const name of ['authorization','origin','host','mcp-protocol-version','mcp-session-id']) {
        if (req.rawHeaders.filter((_,index)=>index%2===0).filter(value=>value.toLowerCase()===name).length>1) return reject(res,400,'DUPLICATE_HEADER','Mehrdeutige Anfrageheader.');
      }
      if (req.get('host')?.toLowerCase() !== origin.host.toLowerCase()) return reject(res,403,'HOST_REJECTED','Serveradresse stimmt nicht überein.');
      if ((req.get('origin') && req.get('origin') !== origin.origin) || req.get('sec-fetch-site') === 'cross-site') return reject(res,403,'ORIGIN_REJECTED','Anfrage von dieser Herkunft nicht erlaubt.');
      const match = /^Bearer (\S+)$/i.exec(req.get('authorization') || ''), auth = match && tokens.authenticate(match[1]);
      if (!auth) { res.set('WWW-Authenticate','Bearer realm="edoku-mcp"'); return reject(res,401,'UNAUTHORIZED','Gültiger edoku-API-Schlüssel erforderlich.'); }
      if (req.method !== 'POST') { res.set('Allow','POST'); return reject(res,405,'METHOD_NOT_ALLOWED','Dieser zustandslose MCP-Zugang verwendet POST.'); }
      if (Object.keys(req.query).some(key=>key!=='access') || (req.query.access !== undefined && !['read','write'].includes(req.query.access))) return reject(res,400,'INVALID_ACCESS','Zugriffsmodus ungültig. Schlüssel nur im Authorization-Header senden.');
      if (!req.is('application/json') || (req.get('content-encoding') && req.get('content-encoding') !== 'identity')) return reject(res,415,'CONTENT_TYPE_REQUIRED','Unkomprimiertes application/json erforderlich.');
      userId = auth.user.id;
      if (active >= maxActive || (users.get(userId)||0) >= maxPerUser) { res.set('Retry-After','1');return reject(res,429,'MCP_BUSY','Weitere Verarbeitung läuft bereits. Bitte später fortsetzen.'); }
      admitted = true;active++;users.set(userId,(users.get(userId)||0)+1);
      const writable = req.query.access === 'write' && configuration.allowWrites && auth.user.role !== 'viewer' && auth.token.scopes.some(scope=>scope.endsWith(':write'));
      // Re-check revocation, roles and server write policy at the internal API on every tool call.
      // No local document root: remote callers cannot read server-side file paths.
      handler = createMcpHandler(()=>createMcpServer({baseUrl:api.origin,token:match[1],allowWrites:writable,documentRoot:'',responseMode:'structured',allowLocalFiles:false,trackToolCall}),{legacy:'stateless',maxRequestBodySize:MAX_BODY_BYTES,maxSubscriptions:0});
      const serve = toNodeHandler({fetch:async (...args)=>{
        let payload; try { payload=await args[0].clone().json(); } catch {}
        if(Array.isArray(payload)) return Response.json({jsonrpc:'2.0',id:null,error:{code:-32600,message:'MCP-Batches werden nicht unterstützt.'}},{status:400,headers:{'Cache-Control':'no-store'}});
        const response=await handler.fetch(...args), headers=new Headers(response.headers);
        headers.set('Cache-Control','no-store');
        return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
      }},{maxRequestBodySize:MAX_BODY_BYTES,onerror:()=>{}});
      await serve(req,res);
    } catch {
      if (!res.headersSent) reject(res,503,'MCP_UNAVAILABLE','Remote-MCP ist vorübergehend nicht verfügbar. Schreibanfragen nicht ungeprüft wiederholen.');
      else if (!res.writableEnded) res.end();
    } finally {
      if (handler) await handler.close().catch(()=>{});
      await Promise.allSettled([...inFlight]);
      if (admitted) { active--;const count=users.get(userId)-1;if(count)users.set(userId,count);else users.delete(userId); }
    }
  };
}
module.exports = { createRemoteMcpHandler, MAX_BODY_BYTES };
