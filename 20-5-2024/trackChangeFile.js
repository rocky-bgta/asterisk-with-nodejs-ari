const AriClient = require('ari-client');
const WebSocket = require('ws');
const fs = require('fs');

// ARI connection parameters
const ariUrl = 'http://192.168.0.181:8088';
const ariUser = 'asterisk';
const ariPassword = 'secret';

// WebSocket server URL
const wsServerUrl = 'ws://localhost:3000'; // Change to your WebSocket server URL

// Connect to Asterisk ARI
AriClient.connect(ariUrl, ariUser, ariPassword)
    .then(client => {
        console.log('Connected to ARI');

        // Create WebSocket connection
        const ws = new WebSocket(wsServerUrl);

        ws.on('open', function open() {
            console.log('WebSocket connection established');
        });

        client.on('StasisStart', event => {
            const channel = event.channel;
            console.log(`Channel ${channel.id} entered Stasis application`);

            // Create a mixing bridge and add the channel to it
            client.bridges.create({ type: 'mixing' })
                .then(bridge => {
                    console.log(`Created bridge ${bridge.id}`);
                    return bridge.addChannel({ channel: channel.id }).then(() => bridge);
                })
                .then(bridge => {
                    const recordingName = `recording_${channel.id}`;
                    const recordingFilePath = `/var/spool/asterisk/recording/${recordingName}.wav`;

                    // Start recording the bridge
                    client.bridges.record({
                        bridgeId: bridge.id,
                        name: recordingName,
                        format: 'wav',
                        ifExists: 'overwrite',
                        beep: false,
                        maxDurationSeconds: 3600 // Example: Set max recording duration to 1 hour
                    }).then(recording => {
                        console.log(`Recording started: ${recording.name}`);

                        // Watch the recording file and stream it to the WebSocket server
                        fs.watchFile(recordingFilePath, { interval: 100 }, (curr, prev) => {
                            if (curr.size > prev.size) {
                                const readStream = fs.createReadStream(recordingFilePath, { start: prev.size, end: curr.size });
                                readStream.on('data', (chunk) => {
                                    if (ws.readyState === WebSocket.OPEN) {
                                        ws.send(chunk);
                                    }
                                });
                            }
                        });

                        client.on('ChannelHangupRequest', hangupEvent => {
                            if (hangupEvent.channel.id === channel.id) {
                                console.log(`Channel ${channel.id} left Stasis application`);
                                fs.unwatchFile(recordingFilePath);
                                recording.stop().then(() => {
                                    console.log('Recording stopped');
                                }).catch(err => {
                                    console.error('Error stopping recording:', err);
                                });
                                bridge.destroy().then(() => {
                                    console.log(`Bridge ${bridge.id} destroyed`);
                                }).catch(err => {
                                    console.error('Error destroying bridge:', err);
                                });
                                ws.close();
                            }
                        });
                    }).catch(err => {
                        console.error('Error starting recording:', err);
                    });
                }).catch(err => {
                console.error('Error creating bridge or adding channel:', err);
            });
        });

        client.start('my_stasis_app')
            .catch(err => console.error('Error starting Stasis application:', err));
    })
    .catch(err => console.error('Error connecting to ARI:', err));
