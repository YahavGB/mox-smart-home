'use strict';


const MODULE_ID = 0x0000cc;
const CHANNEL_ID = 0x16; // 0x17 main light

const MoxLtHome = require('./index').MoxLtHome;
// const client = MoxLtClient.fromConfigFile('./data.json');
MoxLtHome.createHome('./data.json').then(result => {
    console.log('Done.');
    console.log(result);
});
// const home = new MoxLtHome();
// home.connect().then(() => {
//     console.log('Connected');
// });

// const MoxLtClient = require('./MoxLtClient');
// const process = require('process');

// const client = new MoxLtClient();
// client.on('connect', () => {
//     let state = parseInt(process.argv[2]);
//     if (!state) {
//         client.turnOffLight(MODULE_ID, CHANNEL_ID, () => {
//             // client.disconnect();
//             console.log('here');
//             client.receiveLightStatus(MODULE_ID, CHANNEL_ID, () => {
//             });
//         });
//     } else {
//         client.turnOnLight(MODULE_ID, CHANNEL_ID, () => {
//             // client.disconnect();
//         });
//     }
// })
// client.connect();