const AriClient = require('ari-client');
const WebSocket = require('ws');

// ARI connection parameters
const ariUrl = 'http://192.168.0.181:8088';
const ariUser = 'asterisk';
const ariPassword = 'secret';
const externalWebSocketUrl = 'ws://localhost:8085'; // URL of the WebSocket server

// Connect to Asterisk ARI
AriClient.connect(ariUrl, ariUser, ariPassword)
    .then(client => {
        console.log('Connected to ARI');

        // Connect to external WebSocket server
        const externalWebSocket = new WebSocket(externalWebSocketUrl);
        externalWebSocket.on('open', () => {
            console.log('Connected to external WebSocket server');
        });

        // Event handler for StasisStart event
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

            // Get the bridge associated with the channel
            const bridge = client.Bridge();

            // Originate a new call to create a channel
            const originator = {
                endpoint: 'SIP/endpoint', // Replace with your SIP endpoint
                app: 'my_stasis_app',
                appArgs: 'dialed'
            };

            client.channels.originate(originator)
                .then(bridgedChannel => {
                    // Bridge the channel with the newly created channel
                    bridge.create({ type: 'mixing' }).then(bridge => {
                        bridge.addChannel({ channel: [channel.id, bridgedChannel.id] });
                        bridge.startMoh();

                        // Event handler for ChannelDtmfReceived event
                        bridge.on('ChannelDtmfReceived', dtmfEvent => {
                            const dtmfDigit = dtmfEvent.digit;
                            externalWebSocket.send(dtmfDigit);
                        });

                        // Event handler for ChannelDestroyed event
                        bridge.once('ChannelDestroyed', () => {
                            console.log(`Channel ${channel.id} destroyed`);
                            externalWebSocket.close();
                        });
                    });
                });
        });

        client.start('my_stasis_app')
            .catch(err => console.error('Error starting Stasis application:', err));
    })
    .catch(err => console.error('Error connecting to ARI:', err));
