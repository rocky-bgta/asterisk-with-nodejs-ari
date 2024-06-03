const AriClient = require('ari-client');
const WebSocket = require('ws');
const ami = require('asterisk-manager');

// ARI connection parameters
const ariUrl = 'http://192.168.0.181:8088';
const ariUser = 'asterisk';
const ariPassword = 'secret';

// AMI connection parameters
const amiConfig = {
    username: 'mediaoffice',
    secret: 'mediaoffice',
    host: '192.168.0.181',
    port: 5038,
    events: 'on'
};

// Destination extension
const destinationExtension = '6001';

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

                // Connect to Asterisk AMI
                const amiConnection = new ami(amiConfig);
                amiConnection.on('connect', () => {
                    console.log('Connected to AMI');

                    // Originate call to extension 6001
                    const originateParams = {
                        Action: 'Originate',
                        Channel: `Local/${destinationExtension}@from-internal`,
                        Context: 'from-internal',
                        Exten: destinationExtension,
                        Priority: 1,
                        Async: true
                    };

                    amiConnection.action(originateParams, response => {
                        console.log('Originate response:', response);
                    });
                });

                amiConnection.on('disconnect', () => {
                    console.log('AMI connection closed');
                });

                amiConnection.connect();
            }).catch(err => {
                console.error('Error starting recording:', err);
            });
        });

        client.start('my_stasis_app')
            .catch(err => console.error('Error starting Stasis application:', err));
    })
    .catch(err => console.error('Error connecting to ARI:', err));
