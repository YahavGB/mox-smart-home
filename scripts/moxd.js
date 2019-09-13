'use strict';

/* Load the packages */
const MoxLtHome     = require('../server').MoxLtHome;
const dotenv        = require('dotenv');
const process       = require('process');

(async () => {
    /* Setup the arguments */
    let homeData = {
        homeId: '',
        dbConnectionString: '',
        redisOptions: {
            host: '',
            port: 6379
        }
    };

    dotenv.config();
    if (!process.env.HOME_ID) {
        console.error("Your environnement hasn't been configured yet.");
        return;
    }

    homeData.homeId = process.env.HOME_ID;
    homeData.dbConnectionString = process.env.DB_CONNECTION_STRING;
    homeData.redisOptions.host = process.env.REDIS_CONNECTION_HOST;
    homeData.redisOptions.port = process.env.REDIS_CONNECTION_PORT;
    
    /* Connect */
    const home = new MoxLtHome(homeData.homeId, homeData);
    const closeHandler = async () => {
        try {
            await home.disconnect();
        } catch (e) {
            console.error('An error occured when trying to close the program.');
            console.error(e);
        }

        console.log('Closing moxd.');
        process.exit(0);
    };

    process.on('SIGINT', closeHandler);
    process.on('exit', closeHandler);

    await home.connect();
})().catch(e => {
    console.error('Error:');
    console.error(e);
});