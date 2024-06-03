const WebSocket = require('ws');

// WebSocket server parameters
const port = 3000;

// Create WebSocket server
const wss = new WebSocket.Server({ port: port });

// WebSocket server event handlers
wss.on('connection', function connection(ws) {
    console.log('Client connected');

    ws.on('message', function incoming(message) {
        console.log('Received message:', message);
    });

    ws.on('close', function close() {
        console.log('Client disconnected');
    });
});

console.log(`WebSocket server listening on port ${port}`);
