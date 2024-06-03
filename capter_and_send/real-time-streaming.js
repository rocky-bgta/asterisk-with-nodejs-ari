const AriClient = require('ari-client');
const ffmpeg = require('fluent-ffmpeg');
const WebSocket = require('ws');

// ARI connection parameters
const ariUrl = 'http://192.168.0.181:8088';
const ariUser = 'asterisk';
const ariPassword = 'secret';

// Function to stream audio to WebSocket
function streamAudioToWebSocket(udpPort, wsUrl) {
    const ws = new WebSocket(wsUrl);

    ws.on('open', () => {
        console.log('Connected to WebSocket server');

        const ffmpegProcess = ffmpeg(`udp://localhost:${udpPort}`)
            .inputFormat('wav')
            .audioCodec('pcm_s16le')
            .format('wav')
            .on('error', err => {
                console.error('Error in ffmpeg process:', err);
                ws.close();
            })
            .pipe(ws, { end: true });

        ffmpegProcess.on('end', () => {
            console.log('FFmpeg process ended');
        });

        ffmpegProcess.on('progress', progress => {
            console.log('FFmpeg progress:', progress);
        });
    });

    ws.on('close', () => {
        console.log('WebSocket connection closed');
    });

    ws.on('error', err => {
        console.error('WebSocket error:', err);
    });
}

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

            // Set up external media streaming to WebSocket
            const udpPort = 12345; // Ensure this matches your ffmpeg command
            const wsUrl = 'ws://localhost:8000';
            streamAudioToWebSocket(udpPort, wsUrl);
        });

        client.start('my_stasis_app')
            .catch(err => console.error('Error starting Stasis application:', err));
    })
    .catch(err => console.error('Error connecting to ARI:', err));
