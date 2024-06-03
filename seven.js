const AriClient = require('ari-client');
const WebSocket = require('ws');

// ARI connection parameters
const ariUrl = 'http://192.168.0.181:8088';
const ariUser = 'asterisk';
const ariPassword = 'secret';
const destinationExtension = '6001';

// Connect to Asterisk ARI
AriClient.connect(ariUrl, ariUser, ariPassword)
    .then(client => {
        console.log('Connected to ARI');

        client.on('StasisStart', event => {
            const channel = event.channel;
            console.log(`Channel ${channel.id} entered Stasis application`);

            // Start recording the call and stream it to the destination extension
            const recordingName = `recording_${channel.id}`;
            client.channels.record({
                channelId: channel.id,
                name: recordingName,
                format: 'wav',
                ifExists: 'overwrite',
                beep: true
            }).then(recording => {
                console.log(`Recording started: ${recording.name}`);

                // Originate a new call to the destination extension
                client.channels.originate({
                    endpoint: `SIP/${destinationExtension}`,
                    callerId: 'Recorder <6000>',
                    app: 'my_stasis_app',
                    appArgs: 'stream',
                    context: 'from-internal',
                    priority: 1,
                    timeout: 3000,
                    async: true
                }).then(newChannel => {
                    console.log(`Call to ${destinationExtension} originated successfully: ${newChannel.id}`);

                    // When the new channel answers, bridge it with the recording channel
                    client.bridges.create({ type: 'mixing' })
                        .then(bridge => {
                            console.log(`Bridge created: ${bridge.id}`);

                            // Add both channels to the bridge
                            Promise.all([
                                client.bridges.addChannel({ bridgeId: bridge.id, channel: channel.id }),
                                client.bridges.addChannel({ bridgeId: bridge.id, channel: newChannel.id })
                            ]).then(() => {
                                console.log('Channels added to bridge');
                            }).catch(err => {
                                console.error('Error adding channels to bridge:', err);
                            });
                        }).catch(err => {
                        console.error('Error creating bridge:', err);
                    });
                }).catch(err => {
                    console.error('Error making call to extension 6001:', err);
                });
            }).catch(err => {
                console.error('Error starting recording:', err);
            });
        });

        client.start('my_stasis_app')
            .catch(err => console.error('Error starting Stasis application:', err));
    })
    .catch(err => console.error('Error connecting to ARI:', err));
