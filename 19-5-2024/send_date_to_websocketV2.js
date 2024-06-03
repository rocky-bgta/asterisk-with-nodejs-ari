const AriClient = require('ari-client');
const WebSocket = require('ws');
const fs = require('fs');

// ARI connection parameters
const ariUrl = 'http://192.168.0.181:8088';
const ariUser = 'asterisk';
const ariPassword = 'secret';

// WebSocket server URL
const wsUrl = 'ws://localhost:8080';

// Connect to Asterisk ARI
AriClient.connect(ariUrl, ariUser, ariPassword)
    .then(client => {
        console.log('Connected to ARI');

        client.on('StasisStart', async event => {
            const channel = event.channel;
            console.log(`Channel ${channel.id} entered Stasis application`);

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

            // Answer the call
            try {
                await client.channels.answer({ channelId: channel.id });
                console.log(`Call answered: ${channel.id}`);

                // Start recording the call
                const recordingName = `recording_${channel.id}`;
                const recordingPath = `/var/spool/asterisk/${recordingName}.wav`;

                client.channels.record({
                    channelId: channel.id,
                    name: recordingName,
                    format: 'wav',
                    ifExists: 'overwrite',
                    beep: true,
                    maxDurationSeconds: 0, // Set to 0 to record indefinitely
                    maxSilenceSeconds: 0  // Set to 0 to avoid stopping recording due to silence
                }).then(recording => {
                    console.log(`Recording started: ${recording.name}`);

                    // Listen for recording completion
                    client.on('RecordingFinished', async (recordingFinishedEvent) => {
                        if (recordingFinishedEvent.recording.name === recordingName) {
                            console.log(`Recording finished: ${recordingFinishedEvent.recording.name}`);

                            // Confirm the recording file exists before streaming
                            fs.access(recordingPath, fs.constants.F_OK, (err) => {
                                if (err) {
                                    console.error(`Recording file not found: ${recordingPath}`);
                                    return;
                                }

                                // Stream the recorded audio file
                                const readStream = fs.createReadStream(recordingPath);
                                readStream.on('data', chunk => {
                                    ws.send(chunk);
                                });

                                readStream.on('end', () => {
                                    ws.send(JSON.stringify({ event: 'stream_end' }));
                                    ws.close();
                                });

                                readStream.on('error', err => {
                                    console.error('Error reading the recorded file:', err);
                                    ws.send(JSON.stringify({ event: 'stream_error', error: err.message }));
                                    ws.close();
                                });
                            });
                        }
                    });
                }).catch(err => {
                    console.error('Error starting recording:', err);
                });

            } catch (err) {
                console.error('Error during call handling:', err);
            }
        });

        client.start('my_stasis_app')
            .catch(err => console.error('Error starting Stasis application:', err));
    })
    .catch(err => console.error('Error connecting to ARI:', err));
