'use strict';

/* Load the packages */
const MoxLtHomeClient       = require('./client/index').MoxLtHomeClient;
const dotenv                = require('dotenv');

/* Dummy data */
const MODULE_ID = 0x0000cc;
const CHANNEL_ID = 0x16; // 0x17 main light

/* Load the configurations */
dotenv.config();
if (!process.env.HOME_ID || !process.env.CONNECTION_STRING) {
    throw new Error('MOX server hasnt been initialized.');
}

(async () => {
    let client = new MoxLtHomeClient(process.env.HOME_ID, process.env.CONNECTION_STRING);
    const closeHandler = async () => {
        try {
            await client.disconnect();
        } catch (e) {
            console.error('An error occured when trying to close the program.');
            console.error(e);
        }

        console.log('Closing client.');
        process.exit(0);
    };

    process.on('SIGINT', closeHandler);
    process.on('exit', closeHandler);

    await client.connect();

    let status = await client.getLightStatus(MODULE_ID, CHANNEL_ID);
    console.log('Status : ' + status);

    await client.setLightStatus(MODULE_ID, CHANNEL_ID, !status);
})().catch(e => {
    console.error(e);
})