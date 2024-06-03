const AriClient = require('ari-client');
const WebSocket = require('ws');

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
                }).catch(err => {
                    console.error('Error starting recording:', err);
                });

                // Listen for audio frames
                client.on('ChannelTalkingStarted', talkingEvent => {
                    if (talkingEvent.channel.id === channel.id) {
                        console.log(`Channel ${channel.id} started talking`);
                    }
                });

                client.on('ChannelTalkingFinished', talkingEvent => {
                    if (talkingEvent.channel.id === channel.id) {
                        console.log(`Channel ${channel.id} stopped talking`);
                    }
                });

                client.on('ChannelUserevent', userEvent => {
                    if (userEvent.channel.id === channel.id && userEvent.userevent && userEvent.userevent.type === 'AudioFrame') {
                        const audioData = userEvent.userevent.data;
                        ws.send(audioData);
                    }
                });

            } catch (err) {
                console.error('Error during call handling:', err);
            }
        });

        client.start('my_stasis_app')
            .catch(err => console.error('Error starting Stasis application:', err));
    })
    .catch(err => console.error('Error connecting to ARI:', err));
