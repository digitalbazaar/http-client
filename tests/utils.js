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

  const httpServerAddress = httpServer.address();
  const httpsServerAddress = httpsServer.address();
  const httpHost =
    `${httpServerAddress.address}:${httpServerAddress.port}`;
  const httpsHost =
    `${httpsServerAddress.address}:${httpsServerAddress.port}`;

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

  return app;
}
