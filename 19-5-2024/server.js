const WebSocket = require('ws');

// Define the port on which the WebSocket server will listen
const port = 8085;

// Create a WebSocket server
const wss = new WebSocket.Server({ port });

// Event listener for when a new client connects
wss.on('connection', ws => {
    console.log('New client connected');

    // Event listener for when a message is received from the client
    ws.on('data', message => {
        console.log('Received message:', message);

        // Process the received message as needed
    });

    // Event listener for when the connection is closed
    ws.on('close', () => {
        console.log('Client disconnected');
    });

    // Send a message to the client
    ws.send('Welcome to the WebSocket server');
});

console.log(`WebSocket server is listening on ws://localhost:${port}`);
