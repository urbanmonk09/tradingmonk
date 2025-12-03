// expressServer.js
const express = require('express');
const cors = require('cors');
const { rtConnect, rtFeed } = require('truedata-nodejs');

const app = express();
app.use(cors());

const user = 'Trial175';
const pwd = 'ankit175';
const port = 8086;
const symbols = ['NIFTY-I', 'RELIANCE'];

// Connect TrueData once
rtConnect(user, pwd, symbols, port, 1, 1, 0, 'push');

const clients = [];

rtFeed.on('tick', (tick) => {
  const data = JSON.stringify({
    s: tick.s,
    c: tick.c ?? tick.LTP ?? 0,
    h: tick.h ?? tick.high ?? 0,
    l: tick.l ?? tick.low ?? 0,
    o: tick.o ?? tick.open ?? 0,
    pc: tick.pc ?? tick.previousClose ?? 0,
    timestamp: Date.now(),
  });
  clients.forEach((res) => res.write(`data: ${data}\n\n`));
});

app.get('/sse', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  clients.push(res);

  req.on('close', () => {
    const idx = clients.indexOf(res);
    if (idx >= 0) clients.splice(idx, 1);
  });
});

app.listen(3001, () => console.log('TrueData SSE server running on port 3001'));
