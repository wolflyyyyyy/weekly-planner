import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import http from 'http';
import https from 'https';

/**
 * Custom Vite plugin: proxy /llm-api requests to the real API endpoint.
 * The browser sends requests to /llm-api with X-Target-Url header.
 * This middleware reads that header and forwards the request.
 */
function llmProxyPlugin(): Plugin {
  return {
    name: 'llm-proxy',
    configureServer(server) {
      server.middlewares.use('/llm-api', (req, res) => {
        const realUrl = req.headers['x-target-url'];
        if (typeof realUrl !== 'string') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing X-Target-Url header' }));
          return;
        }

        let target: URL;
        try {
          target = new URL(realUrl);
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid X-Target-Url' }));
          return;
        }

        // Collect request body
        const bodyChunks: Buffer[] = [];
        req.on('data', (chunk) => bodyChunks.push(chunk));
        req.on('end', () => {
          const body = Buffer.concat(bodyChunks);

          const options: http.RequestOptions = {
            hostname: target.hostname,
            port: target.port || (target.protocol === 'https:' ? 443 : 80),
            path: target.pathname + target.search,
            method: req.method,
            headers: {
              ...req.headers,
              host: target.host,
              'content-length': body.length,
            },
          };

          // Remove our custom header so it doesn't leak to the real API
          delete options.headers!['x-target-url'];

          const transport = target.protocol === 'https:' ? https : http;
          const proxyReq = transport.request(options, (proxyRes) => {
            res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
            proxyRes.pipe(res);
          });

          proxyReq.on('error', (err) => {
            console.error('[LLM Proxy]', err.message);
            if (!res.headersSent) {
              res.writeHead(502, { 'Content-Type': 'application/json' });
            }
            res.end(JSON.stringify({ error: `Proxy error: ${err.message}` }));
          });

          if (body.length > 0) {
            proxyReq.write(body);
          }
          proxyReq.end();
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), llmProxyPlugin()],
  base: './',
  appType: 'spa',
  preview: {
    port: 8080,
    host: '0.0.0.0',
  },
});
