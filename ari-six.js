const AriClient = require('ari-client');
const WebSocket = require('ws');

// ARI connection parameters
const ariUrl = 'http://192.168.0.181:8088';
const ariUser = 'asterisk';
const ariPassword = 'secret';
const destinationExtension = '5001';

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

                    // Check if the channel is still available before answering
                    client.channels.get({ channelId: channel.id })
                        .then(() => {
                            // Answer the call
                            client.channels.answer({ channelId: channel.id })
                                .catch(err => console.error('Error answering call:', err));
                        })
                        .catch(err => {
                            console.error('Channel not available:', err);
                        });

                    // Make a call to extension 6001
                    client.channels.originate({
                        endpoint: `SIP/${destinationExtension}`,
                        callerId: 'Asterisk <1000>',  // Modify Caller ID as needed
                        app: 'my_stasis_app',
                        appArgs: 'playback',
                        context: 'from-internal',
                        priority: 1,
                        timeout: 300,
                        async: true
                    }).then(newChannel => {
                        console.log(`Call to ${destinationExtension} originated successfully: ${newChannel.id}`);

                        // Play the recording to the new channel once it's answered
                        client.channels.on('StasisStart', event => {
                            const newChannel = event.channel;
                            console.log(`Channel ${newChannel.id} answered`);

                            // Playback the recording to the new channel
                            client.channels.play({
                                channelId: newChannel.id,
                                media: `sound:${recordingName}`
                            }).catch(err => {
                                console.error('Error playing recording:', err);
                            });
                        });
                    }).catch(err => {
                        console.error('Error making call to extension 6001:', err);
                    });
                });

                ws.on('message', message => {
                    console.log('Received from WebSocket server:', message);
                    // Handle messages from WebSocket server
                });

                ws.on('close', (code, reason) => {
                    console.log('WebSocket connection closed', code, reason);
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
