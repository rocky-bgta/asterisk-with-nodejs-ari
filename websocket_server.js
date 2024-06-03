const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', function connection(ws) {
    console.log('A new client connected!');

    ws.on('message', function incoming(message) {
        console.log('received: %s', message);
        // Handle incoming messages from Asterisk
    });

    ws.send('Hello! You are connected.');
});

console.log('WebSocket server is running on ws://localhost:8080');
