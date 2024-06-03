const AriClient = require('ari-client');
const WebSocket = require('ws');

// ARI connection parameters
const ariUrl = 'http://192.168.0.180:8088';
const ariUser = 'asterisk';
const ariPassword = 'secret';

// Connect to Asterisk ARI
AriClient.connect(ariUrl, ariUser, ariPassword)
    .then(client => {
        console.log('Connected to ARI');

        client.on('StasisStart', event => {
            const channel = event.channel;
            console.log(`Channel ${channel.id} entered Stasis application`);

            // Connect to WebSocket server
            const ws = new WebSocket('ws://localhost:8080');

            ws.on('open', () => {
                console.log('Connected to WebSocket server');

                // Send call details to WebSocket server
                ws.send(JSON.stringify({
                    event: 'call',
                    channel: channel.id,
                    caller: channel.caller.number,
                    callee: channel.dialplan.exten
                }));

                // Answer the call
                client.channels.answer({ channelId: channel.id })
                    .catch(err => console.error('Error answering call:', err));
            });

            ws.on('message', message => {
                console.log('Received from WebSocket server:', message);
                // Handle messages from WebSocket server
            });

            ws.on('close', () => {
                console.log('WebSocket connection closed');
            });

            ws.on('error', err => {
                console.error('WebSocket error:', err);
            });
        });

        client.start('my-stasis-app')
            .catch(err => console.error('Error starting Stasis application:', err));
    })
    .catch(err => console.error('Error connecting to ARI:', err));
