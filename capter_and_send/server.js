const WebSocket = require('ws');
const fs = require('fs');

// Create a WebSocket server
const wss = new WebSocket.Server({ port: 8000 });

wss.on('connection', ws => {
    console.log('New client connected');

    ws.on('message', message => {
        console.log('Received data of length:', message.length);
        fs.appendFileSync('received_audio.raw', message); // Save received audio data to a file
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });

    ws.on('error', error => {
        console.error('WebSocket error:', error);
    });
});

console.log('WebSocket server is listening on ws://localhost:8000');
