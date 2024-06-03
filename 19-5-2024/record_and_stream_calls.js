const AriClient = require('ari-client');
const WebSocket = require('ws');
const fs = require('fs');
const { Readable } = require('stream');

// ARI connection parameters
const ariUrl = 'http://192.168.0.181:8088';
const ariUser = 'asterisk';
const ariPassword = 'secret';
const destinationExtension = '6001';

// WebSocket server URL
const wsUrl = 'ws://localhost:8080';

// Connect to Asterisk ARI
AriClient.connect(ariUrl, ariUser, ariPassword)
    .then(client => {
        console.log('Connected to ARI');

        client.on('StasisStart', async event => {
            const channel = event.channel;
            console.log(`Channel ${channel.id} entered Stasis application`);

            // Start recording the call
            const recordingName = `recording_${channel.id}`;
            const recordingPath = `/var/spool/asterisk/recording_${channel.id}.wav`;

            client.channels.record({
                channelId: channel.id,
                name: recordingName,
                format: 'wav',
                ifExists: 'overwrite',
                beep: true
            }).then(async recording => {
                console.log(`Recording started: ${recording.name}`);

                // Wait for the recording to finish
                client.on('RecordingFinished', async recording => {
                    if (recording.name === recordingName) {
                        console.log(`Recording finished: ${recording.name}`);

                        // Connect to WebSocket server
                        const ws = new WebSocket(wsUrl);

                        ws.on('open', () => {
                            console.log('Connected to WebSocket server');

                            // Send call details to WebSocket server
                            ws.send(JSON.stringify({
                                event: 'call',
                                channel: channel.id,
                                caller: channel.caller.number,
                                callee: channel.dialplan.exten
                            }));

                            // Stream the recorded audio file
                            const readStream = fs.createReadStream(recordingPath);
                            readStream.on('data', (chunk) => {
                                ws.send(chunk);
                            });

                            readStream.on('end', () => {
                                ws.send(JSON.stringify({ event: 'stream_end' }));
                                ws.close();
                            });

                            readStream.on('error', (err) => {
                                console.error('Error reading the recorded file:', err);
                                ws.send(JSON.stringify({ event: 'stream_error', error: err.message }));
                                ws.close();
                            });
                        });

                        ws.on('message', message => {
                            console.log('Received from WebSocket server:', message);
                        });

                        ws.on('close', () => {
                            console.log('WebSocket connection closed');
                        });

                        ws.on('error', err => {
                            console.error('WebSocket error:', err);
                        });
                    }
                });
            }).catch(err => {
                console.error('Error starting recording:', err);
            });

            // Answer the call
            try {
                await client.channels.answer({ channelId: channel.id });
            } catch (err) {
                console.error('Error answering call:', err);
            }
        });

        client.start('my_stasis_app')
            .catch(err => console.error('Error starting Stasis application:', err));
    })
    .catch(err => console.error('Error connecting to ARI:', err));
