const AriClient = require('ari-client');
const WebSocket = require('ws');
const ami = require('asterisk-manager');

// ARI connection parameters
const ariUrl = 'http://192.168.0.181:8088';
const ariUser = 'asterisk';
const ariPassword = 'secret';

// AMI connection parameters
const amiConfig = {
    username: 'mediaoffice',
    secret: 'mediaoffice',
    host: '192.168.0.181',
    port: 5038,
    events: 'on'
};

// Destination extension
const destinationExtension = '6001';

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

            // Start recording the call using MixMonitor
            const recordingName = `recording_${channel.id}`;
            client.channels.mute({ channelId: channel.id })
                .then(() => {
                    console.log('Channel muted');
                    return client.channels.startMixing({ channelId: channel.id, name: recordingName });
                })
                .then(() => {
                    console.log(`Recording started: ${recordingName}`);
                })
                .catch(err => {
                    console.error('Error starting recording:', err);
                });

            // Event handler for when the call ends
            client.on('StasisEnd', endEvent => {
                if (endEvent.channel.id === channel.id) {
                    console.log(`Channel ${channel.id} ended Stasis`);

                    // Connect to Asterisk AMI
                    const amiConnection = new ami(amiConfig);
                    amiConnection.on('connect', () => {
                        console.log('Connected to AMI');

                        // Originate call to extension 6001
                        const originateParams = {
                            Action: 'Originate',
                            Channel: `Local/${destinationExtension}@from-internal`,
                            Context: 'from-internal',
                            Exten: destinationExtension,
                            Priority: 1,
                            Async: true
                        };

                        amiConnection.action(originateParams, response => {
                            console.log('Originate response:', response);
                        });
                    });

                    amiConnection.on('disconnect', () => {
                        console.log('AMI connection closed');
                    });

                    amiConnection.connect();
                }
            });
        });

        client.start('my_stasis_app')
            .catch(err => console.error('Error starting Stasis application:', err));
    })
    .catch(err => console.error('Error connecting to ARI:', err));
