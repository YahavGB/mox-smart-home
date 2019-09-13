'use strict';

//==========================================================================================
//  Definitions
//==========================================================================================

const events                = require('events');
const debug                 = require('debug')('mox-home-client');
const path                  = require('path');
const fs                    = require('fs');
const redis                 = require('redis');
const mongoose              = require('mongoose');
const { House, Room, 
    MissingAccessory,
    Accessory }             = require('../models');
const PubSubEvents          = require('../communication').PubSubEvents;

//==========================================================================================
//  MoxLtHomeClient
//==========================================================================================

module.exports = class MoxLtHomeClient extends events.EventEmitter {
    //==========================================================================================
    //  Constructors
    //==========================================================================================

    constructor(homeId, connectionString) {
        /* Super */
        super();

        /* Save iVars */
        this._options = { homeId, connectionString };
        this._publisher = undefined;
        this._subscriber = undefined;
        this._db = undefined;
    }

    //==========================================================================================
    //  Public API
    //==========================================================================================

    /**
     * Connects to the Mox Lt Home Server.
     */
    async connect() {
        /* Connect to the database */
        this._db = await MoxLtHomeClient._connectToDb(this._options.connectionString);
        debug('Connected to MongoDB.');

        /* Create a tunnel to redis */
        /* Connect to the database and to Redis */
        this._publisher = redis.createClient();
        this._subscriber = redis.createClient();
        this._publisher.on("error", e => {
            console.log("Error " + e);
        });
        this._subscriber.on("error", e => {
            console.log("Error " + e);
        });
        debug('Connected to Redis.');
    }

    /**
     * Disconnects from the Mox Lt Home Server.
     */
    async disconnect() {
        if (this._db) {
            this._db.close();
            this._db = undefined;
        }

        if (this._publisher) {
            this._publisher.quit();
            this._publisher = undefined;
        }

        if (this._subscriber) {
            this._subscriber.quit();
            this._subscriber = undefined;
        }
    }

    /**
     * Sets the given light/switch status.
     * @param {int} moduleId The smart-control module id.
     * @param {int} channelId The smart-control channel id.
     * @param {*} status The status.
     */
    async setLightStatus(moduleId, channelId, status) {
        this._publisher.publish(PubSubEvents.SERVER_SUB_INTERACT, JSON.stringify({
            moduleId, channelId, status, type: 'light'
        }));
    }

    /**
     * Gets the light/switch status.
     * @param {int} moduleId The smart-control module id.
     * @param {int} channelId The smart-control channel id.
     */
    async getLightStatus(moduleId, channelId) {
        let accessory = await Accessory.findOne({ moduleId, channelId });
        if (!accessory) {
            throw new Error('Could not find the requested accessory.');
        }

        return accessory.get('status');
    }

    /**
     * Sets the given light/switch status.
     * @param {int} moduleId The smart-control module id.
     * @param {int} channelId The smart-control channel id.
     * @param {*} value The brightness value.
     */
    async setLightBrightness(moduleId, channelId, value) {
        this._publisher.publish(PubSubEvents.SERVER_SUB_INTERACT, JSON.stringify({
            moduleId, channelId, value, type: 'dimmer'
        }));
    }

    /**
     * Gets the dimmer value.
     * @param {int} moduleId The smart-control module id.
     * @param {int} channelId The smart-control channel id.
     */
    async getLightBrightness(moduleId, channelId) {
        let accessory = await Accessory.findOne({ moduleId, channelId });
        if (!accessory) {
            throw new Error('Could not find the requested accessory.');
        }

        return accessory.get('value');
    }

    /**
     * Sets the given curtain status.
     * @param {int} moduleId The smart-control module id.
     * @param {int} channelId The smart-control channel id.
     * @param {*} value The curtain position value.
     */
    async setCurtainPosition(moduleId, channelId, value) {
        this._publisher.publish(PubSubEvents.SERVER_SUB_INTERACT, JSON.stringify({
            moduleId, channelId, value, type: 'window'
        }));
    }

    /**
     * Gets the curtain position.
     * @param {int} moduleId The smart-control module id.
     * @param {int} channelId The smart-control channel id.
     */
    async getCurtainPosition(moduleId, channelId) {
        let accessory = await Accessory.findOne({ moduleId, channelId });
        if (!accessory) {
            throw new Error('Could not find the requested accessory.');
        }

        return accessory.get('value');
    }

    //==========================================================================================
    //  Private API
    //==========================================================================================

    /**
     * Connects to the database.
     * @param {string} connectionString 
     */
    static _connectToDb(connectionString) {
        return new Promise((resolve, reject) => {
            //--------------------------------------------------
            //  Subscribe to events
            //--------------------------------------------------
            mongoose.connect(connectionString, { useNewUrlParser: true });
            
            var db = mongoose.connection;
            db.on('error', e => reject(e));
            db.once('open', () => {
                resolve(db);
            });
        });
    }
};