const AriClient = require('ari-client');
const WebSocket = require('ws');

// ARI connection parameters
const ariUrl = 'http://192.168.0.181:8088';
const ariUser = 'asterisk';
const ariPassword = 'secret';

// Destination extension
const destinationExtension = '6001';

// Connect to Asterisk ARI
AriClient.connect(ariUrl, ariUser, ariPassword)
    .then(client => {
        console.log('Connected to ARI');

        client.on('StasisStart', event => {
            const channel = event.channel;
            console.log(`Channel ${channel.id} entered Stasis application`);

            // Start recording the call
            const recordingName = `recording_${channel.id}`;
            client.channels.record({
                channelId: channel.id,
                name: recordingName,
                format: 'wav',
                ifExists: 'overwrite',
                beep: true
            }).then(recording => {
                console.log(`Recording started: ${recording.name}`);

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

                    // Play the recorded audio to extension 6001
                    client.channels.playback({
                        channelId: channel.id,
                        media: `recording:${recordingName}`
                    }).catch(err => {
                        console.error('Error playing recording:', err);
                    });
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
            }).catch(err => {
                console.error('Error starting recording:', err);
            });
        });

        client.start('my_stasis_app')
            .catch(err => console.error('Error starting Stasis application:', err));
    })
    .catch(err => console.error('Error connecting to ARI:', err));
