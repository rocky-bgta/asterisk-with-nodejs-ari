const AriClient = require('ari-client');
const WebSocket = require('ws');

// ARI connection parameters
const ariUrl = 'http://192.168.0.181:8088';
const ariUser = 'asterisk';
const ariPassword = 'secret';

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
            }).catch(err => {
                console.error('Error starting recording:', err);
            });

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

            // Event handler for when the recording is finished
            client.on('RecordingFinished', recording => {
                if (recording.name === recordingName) {
                    console.log(`Recording finished: ${recording.name}`);

                    // Send the recorded file details via WebSocket
                    ws.send(JSON.stringify({
                        event: 'recording_finished',
                        recording: {
                            name: recording.name,
                            format: recording.format,
                            duration: recording.duration
                        }
                    }));
                }
            });
        });

        client.start('my_stasis_app')
            .catch(err => console.error('Error starting Stasis application:', err));
    })
    .catch(err => console.error('Error connecting to ARI:', err));
