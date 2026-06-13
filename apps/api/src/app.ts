import Fastify from 'fastify';
export function buildApp(){const app=Fastify({logger:true});app.get('/health',async()=> 'ok');app.get('/api/health',async()=>({status:'ok'}));return app;}
