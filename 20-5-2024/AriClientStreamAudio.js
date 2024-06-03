const AriClient = require('ari-client');
const WebSocket = require('ws');
const fs = require('fs');
//const WebSocket = require('ws');

// ARI connection parameters
const ariUrl = 'http://192.168.0.181:8088';
const ariUser = 'asterisk';
const ariPassword = 'secret';

// WebSocket server parameters
const wsServerUrl = 'ws://localhost:3000'; // Change to your WebSocket server URL
var wavFilePath;
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

            // Start recording the call
            const recordingName = `recording_${channel.id}`;
            client.channels.record({
                channelId: channel.id,
                name: recordingName,
                format: 'wav',
                ifExists: 'overwrite',
                beep: true,
                maxDurationSeconds: 3600 // Example: Set max recording duration to 1 hour
            }).then(recording => {
                // Path to the .wav file to watch
                wavFilePath = '/var/spool/asterisk/recording/'+`${recording.name}.wav`; // Change to your .wav file path
                console.log(`Recording started: ${recording.name}`);
                setTimeout(
                fs.watch(wavFilePath, (eventType, filename) => {
                    if (eventType === 'change') {
                        console.log(`File ${filename} changed, streaming data...`);
                        // Stream the contents of the .wav file
                        streamWavFile(wavFilePath, ws);
                    }
                }),100);

                // Stream recording to WebSocket server
                const recordingStream = client.channels.get({
                    channelId: channel.id
                }).then(channelInfo => {
                    console.log('Subscribed to ChannelRecording event');

                    // Stream audio to WebSocket
                    channelInfo.on('ChannelRecording', (event) => {
                        console.log('Received ChannelRecording event');
                        ws.send(event.audio);
                    });
                }).catch(err => {
                    console.error('Error getting channel info:', err);
                });

                // Handle recording stream end
                recordingStream.then(() => {
                    console.log('Recording stream ended');
                    ws.close();
                }).catch(err => {
                    console.error('Error handling recording stream:', err);
                    ws.close();
                });
            }).catch(err => {
                console.error('Error starting recording:', err);
            });

        });

        client.start('my_stasis_app')
            .catch(err => console.error('Error starting Stasis application:', err));
    })
    .catch(err => console.error('Error connecting to ARI:', err));






// WebSocket server URL
//const wsServerUrl = 'ws://localhost:3000'; // Change to your WebSocket server URL

// Create WebSocket client
// const ws = new WebSocket(wsServerUrl);
//
// ws.on('open', function open() {
//     console.log('WebSocket connection established');
//
//     // Watch the .wav file for changes
//
// });
//
// ws.on('close', function close() {
//     console.log('WebSocket connection closed');
// });
//
// ws.on('error', function error(err) {
//     console.error('WebSocket error:', err);
// });

// Function to stream .wav file contents
function streamWavFile(filePath, ws) {
    const readStream = fs.createReadStream(filePath);

    readStream.on('data', (chunk) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(chunk);
        }
    });

    readStream.on('end', () => {
        console.log('Finished streaming .wav file');
    });

    readStream.on('error', (err) => {
        console.error('Error reading .wav file:', err);
    });
}
