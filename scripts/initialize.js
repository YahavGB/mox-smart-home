'use strict';

/* Load the packages */
const MoxLtHome     = require('../server').MoxLtHome;
const fs            = require('fs');
const path          = require('path');
const process       = require('process');
const argv          = require('yargs').argv;
//const debug         = require('debug')('server-initializer');
const debug = console.log;

(async () => {
    let dataFilePath = argv._[0];
    if (!dataFilePath) {
        console.log("Usage: node initialize.js <init file path>");
        return;
    }
    
    dataFilePath = path.resolve(dataFilePath);
    if (!fs.existsSync(dataFilePath)) {
        console.log("The file " + dataFilePath + " does not exists.");
        return;
    }

    /* Read the config file */
    const data = JSON.parse(fs.readFileSync(dataFilePath));

    let callback = async () => {
        /* Create the new home */
        let homeData = await MoxLtHome.createHome(data);

        /* Update the .env file */
        const updateDotenv = require('update-dotenv');
        await updateDotenv({
            HOME_ID: homeData.homeId,
            DB_CONNECTION_STRING: homeData.dbConnectionString,
            REDIS_CONNECTION_HOST: homeData.redisConnectionOptions.host,
            REDIS_CONNECTION_PORT: homeData.redisConnectionOptions.port
        });

        console.log("Created a new home with the following data:");
        console.log(homeData);
        process.exit(0);
    };

    /* Should we wait for mongodb to start? */
    if (argv.dbConnectionAttempts) {
        const WAIT_BETWEEN_ATTEMPTS = 1000 * 3; // 3 seconds
        let retryIndex = 0;
        let pingAndConnect = async () => {
            debug("Attempting to connect to the database at: " + data.db_connection_string);
            MoxLtHome._connectToDb(data.db_connection_string)
                .then(db => {
                    debug('MongoDb alive!');
                    db.close();
                    callback();
                }).catch(e => {
                    if (++retryIndex <= argv.dbConnectionAttempts) {
                        debug(`Connection to MongoDb failed. Retry ${retryIndex}/${argv.dbConnectionAttempts} in ${WAIT_BETWEEN_ATTEMPTS / 1000} seconds...`);
                        setTimeout(pingAndConnect, WAIT_BETWEEN_ATTEMPTS);
                    } else {
                        debug(`Connection to MongoDb failed after ${argv.dbConnectionAttempts} retries. Terminating.`);
                        process.exit(1);
                    }
                });
        };

        setTimeout(pingAndConnect, 0);
    } else {
        /* Connect immediately */
        await callback()
    }
})().catch(e => {
    console.error('Error:');
    console.error(e);
    process.exit(1);
});