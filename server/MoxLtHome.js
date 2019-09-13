'use strict';

//==========================================================================================
//  Definitions
//==========================================================================================

const MoxLtClient           = require('./MoxLtClient');
const events                = require('events');
const debug                 = require('debug')('mox-home');
const debugIncomeMessage    = require('debug')('mox-income-message');
const debugStatus           = require('debug')('mox-status');
const path                  = require('path');
const fs                    = require('fs');
const mongoose              = require('mongoose');
const redis                 = require('redis');
const { House, Room, 
    MissingAccessory,
    Accessory }             = require('../models');
const PubSubEvents          = require('../communication').PubSubEvents;

//==========================================================================================
//  MoxLtHome
//==========================================================================================

/**
 * Class events:
 * - Connect
 * - Disconnect
 * 
 * Redis Pub:
 * - EVT_CONNECTED
 * - EVT_DISCONNECTED
 * 
 * Redis Sub:
 * - 
 */
class MoxLtHome extends events.EventEmitter {
    //==========================================================================================
    //  Constants
    //==========================================================================================

    static get STATUS_UPDATE_INTERVAL() {
        const seconds = 5;//30;
        return seconds * 1000;
    }

    static get FORCE_STATUS_UPDATE_INTERVAL() {
        const seconds = 30;
        return seconds * 1000;
    }

    //==========================================================================================
    //  Constructors
    //==========================================================================================

    constructor(homeId, options) {
        /* Super */
        super();

        /* Setup the class iVars */
        this._options = Object.assign({
            homeId: homeId,
            dbConnectionString: "",
            redisOptions: { }
        }, options);

        this._publisher = undefined;
        this._subscriber = undefined;
        this._db = undefined;
        this._client = undefined;
        this._house = undefined;
        this._updaterTask = undefined;
        this._accessoryMessageResolvers = {
            "light": this._lightMessageResolver.bind(this),
            "dimmer": this._dimmerMessageResolver.bind(this),
            "switch": this._lightMessageResolver.bind(this),
            "window": this._curtainMessageResolver.bind(this)
        };
    }

    //==========================================================================================
    //  Public API
    //==========================================================================================

    get client() {
        return this._client;
    }

    /**
     * Connects to the home.
     */
    async connect() {
        /* Connect to the database and to Redis */
        this._publisher = redis.createClient(this._options.redisOptions);
        this._subscriber = redis.createClient(this._options.redisOptions);
        this._publisher.on("error", e => {
            console.error("Error " + e);
        });
        this._subscriber.on("error", e => {
            console.error("Error " + e);
        });
        debug('Connected to Redis.');

        /* Connect to MongoDB */
        this._db = await MoxLtHome._connectToDb(this._options.dbConnectionString);
        debug('Connected to MongoDB.');

        /* Fetch the relevant house */
        this._house = await House.findOne({ _id: this._options.homeId });
        if (!this._house) {
            this._db.close();
            this._publisher.quit();
            throw new Error('Could not find the house with the ID ' + this._options.homeId + '. Did you set it up using MoxLtHome::createHome()?');
        }

        debug('Fetched house (id = ' + this._options.homeId + '): ' + this._house.name);
       
        /* Create MOX client */
        this._client = new MoxLtClient(
            /* clientIpAddress: */ this._house.clientIpAddress || "",
            /* clientPort: */ this._house.clientPort || 6666,
            /* serverIpAddress: */ this._house.serverIpAddress,
            /* serverPort: */ this._house.serverPort
        );
        this._client.on('received', this._resolveMessage.bind(this));
        await this._client.connect();
        debug('Connected to MOX Server.');

        /* Schedule an updater task to update the state of our devices */
        this._updaterTask = setInterval(this._updateInvalidatedAccessories.bind(this), MoxLtHome.STATUS_UPDATE_INTERVAL);

        /* Subscribe to Redis events */
        this._subscriber.on("message", this._handleRedisMessage.bind(this));
        this._subscriber.subscribe(PubSubEvents.SERVER_SUB_INTERACT);

        /* Publish events */
        this.emit('connect');
        this._publisher.publish(PubSubEvents.SERVER_PUB_CONNECTED, JSON.stringify(this._options.homeId));
    }

    /**
     * Disconnects from the home.
     */
    async disconnect() {
        if (this._updateInvalidatedAccessories) { // Should come first, as other operations might take some time.
            clearInterval(this._updateInvalidatedAccessories);
            this._updateStatuses = undefined;
        }

        if (this._db) {
            this._db.close();
            this._db = undefined;
        }

        if (this._client) {
            this._client.disconnect();
            this._client = undefined;
        }

        if (this._publisher) {
            this._publisher.publish(PubSubEvents.SERVER_PUB_DISCONNECTED,
                JSON.stringify(this._options.homeId), () => {
                    this._publisher.quit();
                   this._publisher = undefined;
            });
        }

        if (this._subscriber) {
            this._subscriber.unsubscribe(PubSubEvents.SERVER_SUB_INTERACT);
            this._subscriber.quit();
        }

        this._updateStatuses = undefined;
        this.emit('disconnect');
    }

    /**
     * Creates a new home from the given JSON config file.
     * @param {string} filePath 
     */
    static async createHome(filePath) {
        /* Read the seeded file */
        let data = undefined;
        if (typeof(filePath) !== 'object') {
            debug('Seeding new MoxLtHome from config file at: ' +  filePath);
            
            filePath = path.resolve(filePath);
            data = JSON.parse(fs.readFileSync(filePath));
        } else {
            debug('Seeding new MoxLtHome from config object');
            debug(filePath);
            
            data = filePath;
        }

        /* Connect to the DB */
        let db = await MoxLtHome._connectToDb(data.db_connection_string);

        /* Do we have that home already? */
        let existingHome = await House.findOne({ name: data.name });

        if (existingHome) {
            debug('The home ' + data.name + ' already exists, drops it.');
            let result = await existingHome.remove();

            /* Note: we shouldn't remove the indexes here, as there might be other
            houses that use 'hem. But too pain to handle that bug now... */
            await House.collection.dropIndexes();
            await Room.collection.dropIndexes();
            await Accessory.collection.dropIndexes();
            debug("Done.");
        }

        /* Create the home */
        let promises = [];
        let home = new House({
            name: data.name,
            serverIpAddress: data.server_ip_address,
            serverPort: data.server_port_number || 6700,
            clientPort: data.client_port_number || 6666,
            image: data.image || ''
        });

        /* Iterate and create the rooms */
        for (let roomData of data.entries) {
            let room = new Room({
                name: roomData.room_name,
                image: roomData.image || '',
                house: home
            });

            /* Create the accessory */
            for (let accessoryData of roomData.accessories) {
                let accessory = new Accessory({
                    name: accessoryData.name,
                    type: accessoryData.type,
                    room: room,
                    moduleId: parseInt(accessoryData.module_id, 16),
                    channelId: parseInt(accessoryData.channel_id, 16),
                });

                promises.push(accessory.save());
                room.accessories.push(accessory);
            }
            
            /* Add the room */
            promises.push(room.save());
            home.rooms.push(room);
        }

        /* Finalize */
        promises.push(home.save());
        await Promise.all(promises);

        await db.close();
        return {
            homeId: String(home._id),
            dbConnectionString: String(data.db_connection_string),
            redisConnectionOptions: {
                host: String(data.redis_connection_options.host),
                port: String(data.redis_connection_options.port)
            }
        };
    }

    //==========================================================================================
    //  Private API
    //==========================================================================================

    /**
     * Handles an incoming message from MOX.
     * @param {string} message 
     * @param {MoxLtResponseObject} resp 
     */
    async _resolveMessage(message, resp) {
        /* Attempt to find the relevant accessory */
        debugIncomeMessage('Resolving moduleId=' + resp.moduleId + ', channelId=' + resp.channelId);
        let accessory = await Accessory.findOne({ moduleId: resp.moduleId, channelId: resp.channelId });
        if (!accessory) {
            debugIncomeMessage('Could not find the accessory associated with: ' + JSON.stringify({ moduleId: resp.moduleId, channelId: resp.channelId }));
            
            let update = { moduleId: resp.moduleId, channelId: resp.channelId, updatedAt: Date.now };
            let options = { upsert: true, new: true, setDefaultsOnInsert: true };
            await MissingAccessory.findOneAndUpdate({ moduleId: resp.moduleId, channelId: resp.channelId }, update, options);
            return;
        }

        /* Resolve it */
        let resolver = this._accessoryMessageResolvers[accessory.type];
        if (!resolver) {
            debugIncomeMessage('Could not resolve the accessory associated with: ' + JSON.stringify({ moduleId: resp.moduleId, channelId: resp.channelId }) + ' using a resolver function. Missing type: ' + accessory.type);
            return;
        }

        await resolver(accessory, resp);
    }

    /**
     * Resolves a request to update the light status.
     * @param {string} accessory 
     * @param {string} resp 
     */
    async _lightMessageResolver(accessory, resp) {
        /* Make sure this is a light response */
        if (!resp.isLightStatusResponse()) {
            debugIncomeMessage(`The response for ${JSON.stringify({ moduleId: resp.moduleId, channelId: resp.channelId })} isn't a typical light response, even though the accessory has been registered as it. Response: ${resp}. Skipping.`);
            return;
        }

        let status = resp.getLightStatus();
        debugStatus(`Light Set ${JSON.stringify({ moduleId: resp.moduleId, channelId: resp.channelId })} = ${status}`);
        accessory.set('status', status);
        accessory.updatedAt = new Date();
        await accessory.save();
    }

    /**
     * Resolves a request to update the dimmer brightness.
     * @param {string} accessory 
     * @param {string} resp 
     */
    async _dimmerMessageResolver(accessory, resp) {
        /* Make sure this is a light response */
        if (!resp.isLightBrightnessResponse()) {
            debugIncomeMessage(`The response for ${JSON.stringify({ moduleId: resp.moduleId, channelId: resp.channelId })} isn't a typical dimmer response, even though the accessory has been registered as it. Response: ${resp}. Skipping.`);
            return;
        }

        let value = resp.getLightBrightness();
        debugStatus(`Dimmer Set ${JSON.stringify({ moduleId: resp.moduleId, channelId: resp.channelId })} = ${value}`);
        accessory.set('value', value);
        accessory.updatedAt = new Date();
        await accessory.save();
    }


    /**
     * Resolves a request to update the curtain brightness.
     * @param {string} accessory 
     * @param {string} resp 
     */
    async _curtainMessageResolver(accessory, resp) {
        /* Make sure this is a light response */
        if (!resp.isCurtainStatusResponse()) {
            debugIncomeMessage(`The response for ${JSON.stringify({ moduleId: resp.moduleId, channelId: resp.channelId })} isn't a typical window response, even though the accessory has been registered as it. Response: ${resp}. Skipping.`);
            return;
        }

        let value = resp.getCurtainPosition();
        debugStatus(`Window Set ${JSON.stringify({ moduleId: resp.moduleId, channelId: resp.channelId })} = ${value}`);
        accessory.set('value', value);
        accessory.updatedAt = new Date();
        await accessory.save();
    }

    /**
     * A timer callback used to update invalidated accessories.
     */
    async _updateInvalidatedAccessories() {
        /* Create the condition time */
        const d = new Date();
        d.setSeconds(d.getSeconds() - (MoxLtHome.FORCE_STATUS_UPDATE_INTERVAL / 1000));
        
        /* Fetch the old accessories */
        const accessories = await Accessory.find({ updatedAt: { $lt: d }});

        debugStatus('Updating old accessories: TOTAL ' + accessories.length);
        accessories.forEach(async accessory => {
            debugStatus('Asking for status update on ' + JSON.stringify({ moduleId: accessory.moduleId, channelId: accessory.channelId }));

            await this._sendStatusUpdateRequest(accessory);
        });
    }

    /**
     * Sends a status update request for the given accessory.
     * @param {Accessory} accessory The accessory model.
     */
    async _sendStatusUpdateRequest(accessory) {
        switch (accessory.type) {
            case "light":
            case "switch":
                await this._client.sendLightStatusRequest(accessory.moduleId, accessory.channelId);
                break;
            case "dimmer":
                await this._client.sendLightBrightnessRequest(accessory.moduleId, accessory.channelId);
                break;
            case "curtain":
            case "window":
                await this._client.sendCurtainPositionRequest(accessory.moduleId, accessory.channelId);
                break;
            default:
                console.error('Cant resolve status update for ' + accessory.type);
        }
    }

    /**
     * Handles a message from Redis.
     * @param {string} channel 
     * @param {string} data 
     */
    async _handleRedisMessage(channel, data) {
        switch (channel) {
            case PubSubEvents.SERVER_SUB_INTERACT:
                return this._handleInteractRequest(JSON.parse(data));
            default:
                console.error('Could not resolve the Redis message: ' + channel);
        }
    }

    /**
     * Handles an interaction request.
     * @param {Object} data 
     */
    async _handleInteractRequest(data) {
        /* Attempt to find the accessory */
        let accessory = await Accessory.findOne({ moduleId: data.moduleId, channelId: data.channelId, type: data.type });
        if (!accessory) {
            debug('Redis Sub - Could not find the accessory: ' + JSON.stringify(data));
            return;
        }
        
        /* Send the request */
        switch (data.type) {
            case "light":
            case "switch":
                if (typeof(data.status) == 'undefined') {
                    debug('Redis Sub - Packet ' + JSON.stringify(data) + ' missing the "status" required key.');
                    return;
                }

                /* Send */
                await this._client.setLightStatus(data.moduleId, data.channelId, data.status);
                
                /* Update the internal database */
                accessory.set('status', data.status);
                break;
            case "dimmer":
                if (data.status === undefined) {
                    debug('Redis Sub - Packet ' + JSON.stringify(data) + ' missing the "value" required key.');
                    return;
                }

                /* Send */
                await this._client.setLightBrightness(data.moduleId, data.channelId, data.value);
                
                /* Update the internal database */
                accessory.set('value', data.value);
                break;
            case "window":
            case "curtain":
                if (typeof(data.status) == 'undefined') {
                    debug('Redis Sub - Packet ' + JSON.stringify(data) + ' missing the "value" required key.');
                    return;
                }

                /* Send */
                await this._client.setCurtainPositionValue(data.moduleId, data.channelId, data.value);
                
                /* Update the internal database */
                accessory.set('value', data.value);
                break;
        }

        await accessory.save();
        return true;
    }

    /**
     * Connects to the database.
     * @param {string} connectionString 
     */
    static _connectToDb(connectionString) {
        return new Promise((resolve, reject) => {
            //--------------------------------------------------
            //  Subscribe to events
            //--------------------------------------------------
            try {
                mongoose.connect(connectionString, { useNewUrlParser: true }).then(() => {
                    mongoose.set('useCreateIndex', true);
                    resolve(mongoose.connection);
                }).catch(e => {
                    reject(e);
                });
            } catch (e) {
                reject(e);
            }
        });
    }
};

module.exports = MoxLtHome;