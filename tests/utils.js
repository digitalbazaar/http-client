/*!
 * Copyright (c) 2018-2026 Digital Bazaar, Inc.
 */
import cors from 'cors';
import express from 'express';
import fs from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import {setTimeout} from 'node:timers/promises';

export async function startServers() {
  let _httpResolve;
  let _httpsResolve;
  const _httpStarted = new Promise(resolve => {
    _httpResolve = resolve;
  });
  const _httpsStarted = new Promise(resolve => {
    _httpsResolve = resolve;
  });
  const key =
    await fs.readFile(path.join(import.meta.dirname, './test-server.key'));
  const cert =
    await fs.readFile(path.join(import.meta.dirname, './test-server.crt'));
  const app = createApp();
  const httpServer = http.createServer(app).listen({
    host: '0.0.0.0',
    port: 0
  }, () => {
    _httpResolve(httpServer);
  });
  const httpsServer = https.createServer({cert, key}, app).listen({
    host: '0.0.0.0',
    port: 0
  }, () => {
    _httpsResolve(httpsServer);
  });
  await Promise.all([_httpStarted, _httpsStarted]);

  /*
  The servers bind to every interface, so `address()` reports `0.0.0.0`.
  Only Chromium treats that as loopback when used as a request host; Firefox
  and WebKit refuse to connect to it. Advertise the loopback address instead
  so the same host works in every engine.
  */
  const clientHost = '127.0.0.1';
  const httpHost = `${clientHost}:${httpServer.address().port}`;
  const httpsHost = `${clientHost}:${httpsServer.address().port}`;

  return {
    httpServer,
    httpsServer,
    httpHost,
    httpsHost
  };
}

export function makeAgent(options) {
  return https.Agent(options);
}

function createApp() {
  const app = express();

  app.get('/ping', cors(), (req, res) => {
    res.json({
      pong: true
    });
  });

  app.get('/json', cors(), (req, res) => {
    res.json({
      json: true
    });
  });

  app.get('/html', cors(), (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(
      '<!DOCTYPE html><html><head></head><body><p>HTML</p></body></html>'
    );
  });

  // emulate http://httpbin.org/status/404
  app.get('/status/404', cors(), (req, res) => {
    res.status(404).send('NOT FOUND');
  });

  // emulate https://httpstat.us/404
  app.get('/404', cors(), (req, res) => {
    res.status(404).json({
      code: 404,
      description: 'Not Found'
    });
  });

  app.get('/delay/:seconds', cors(), async (req, res) => {
    await setTimeout(req.params.seconds * 1000);
    res.status(200).send();
  });

  // handle CORS preflight for non-simple request headers (e.g. Authorization)
  app.options('/headers', cors());
  app.get('/headers', cors(), (req, res) => {
    res.json({
      headers: req.headers
    });
  });

  app.get('/nocors', (req, res) => {
    res.json({
      cors: false
    });
  });

  app.post('/echo', cors(), express.json(), (req, res) => {
    res.json({
      echo: req.body
    });
  });

  return app;
}
