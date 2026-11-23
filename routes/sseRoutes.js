const express = require("express");

function createSseHub(requireAuth) {
  const router = express.Router();
  const clients = new Set();

  router.get("/stream", requireAuth, (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const client = {
      id: Date.now() + Math.random(),
      userId: req.user.id,
      squadId: req.user.squadId,
      res
    };

    clients.add(client);
    res.write(`event: connected\ndata: ${JSON.stringify({ status: "live", onlinePeers: clients.size })}\n\n`);

    const keepAlive = setInterval(() => {
      res.write(": ping\n\n");
    }, 25000);
    keepAlive.unref();

    req.on("close", () => {
      clearInterval(keepAlive);
      clients.delete(client);
    });
  });

  function broadcastEvent(eventName, payload) {
    const serialized = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const client of clients) {
      client.res.write(serialized);
    }
  }

  return {
    router,
    broadcastEvent,
    getConnectedCount: () => clients.size
  };
}

module.exports = createSseHub;
