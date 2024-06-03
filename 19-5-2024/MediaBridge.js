const AriClient = require('ari-client');
const WebSocket = require('ws');
const fs = require('fs');

// ARI connection parameters
const ariUrl = 'http://192.168.0.181:8088';
const ariUser = 'asterisk';
const ariPassword = 'secret';

// WebSocket server URL
const webSocketUrl = 'ws://localhost:8085';

// Connect to Asterisk ARI
AriClient.connect(ariUrl, ariUser, ariPassword)
    .then(client => {
        console.log('Connected to ARI');

        // Create WebSocket client
        const webSocket = new WebSocket(webSocketUrl);
        webSocket.on('open', () => {
            console.log('Connected to WebSocket server');
        });

        // Event handler for StasisStart event
        client.on('StasisStart', event => {
            const channel = event.channel;
            console.log(`Channel ${channel.id} entered Stasis application`);

            // Start recording the call with MixMonitor
            const recordingName = `recording_${channel.id}.wav`;
            const recordingFile = fs.createWriteStream(recordingName);

            client.bridges.create({ type: 'mixing' }).then(bridge => {
                return bridge.addChannel({ channel: channel.id });
            }).then(() => {
                return client.channels.record({
                    channelId: channel.id,
                    name: recordingName,
                    format: 'wav',
                    ifExists: 'overwrite',
                    beep: true
                });
            }).then(() => {
                console.log(`Recording started: ${recordingName}`);
            }).catch(err => {
                console.error('Error starting recording:', err);
            });
        });

        // Event handler for ChannelDestroyed event
        client.on('ChannelDestroyed', event => {
            const channelId = event.channel.id;
            console.log(`Channel ${channelId} destroyed`);

            const recordingName = `recording_${channelId}.wav`;
            const audioStream = fs.createReadStream(recordingName);
            audioStream.on('data', data => {
                webSocket.send(data);
            });

            audioStream.on('end', () => {
                console.log(`Finished streaming recording ${recordingName}`);
            });
        });

        // Start the ARI client
        client.start('my_stasis_app')
            .catch(err => console.error('Error starting Stasis application:', err));
    })
    .catch(err => console.error('Error connecting to ARI:', err));
