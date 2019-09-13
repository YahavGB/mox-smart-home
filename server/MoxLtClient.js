'use strict';

//==========================================================================================
//  Definitions
//==========================================================================================

const DEFAULT_SERVER_IP_ADDRESS   = "172.16.254.254";
const DEFAULT_SERVER_PORT         = 6670;
const DEFAULT_CLIENT_PORT         = 6666;

const dgram                 = require('dgram');
const Buffer                = require('buffer').Buffer;
const events                = require('events');
const debug                 = require('debug')('mox-client');
const moxUtils              = require('./mox-utils');
const MoxLtServerResponse   = require('./MoxLtServerResponse');


/* Available events:
    connect,
    disconnect,
    received(Buffer message, MoxLtServerResponse response)
    send(Buffer message) */

class MoxLtClient extends events.EventEmitter {
    constructor(clientIpAddress, clientPort, serverIpAddress, serverPort) {
        super();
        
        //--------------------------------------------------
        //  iVars setup
        //--------------------------------------------------

        this._clientIpAddress    = clientIpAddress;
        this._clientPort         = clientPort || DEFAULT_CLIENT_PORT;
        this._serverIpAddress    = serverIpAddress || DEFAULT_SERVER_IP_ADDRESS;
        this._serverPort         = serverPort || DEFAULT_SERVER_PORT;
        this._socket             = undefined;
        this._isV6IpAddress      = false;
        this._statusPendingQueue = { };
    }

    //==========================================================================================
    //  Public API
    //==========================================================================================

    /**
     * Opens a connection with the home MOX LT server by binding the client ip address and port.
     */
    connect() {
        return new Promise((resolve, reject) => {
            //--------------------------------------------------
            //  Create a new socket
            //--------------------------------------------------
            this._socket = dgram.createSocket((this._isV6IpAddress ? 'udp6' : 'udp4'));
            
            //--------------------------------------------------
            //  Bind us to socket events
            //--------------------------------------------------
            
            this._socket.on('listening', () => {
                this.emit('connect');
                resolve(this);
            });
        
            this._socket.on('error', e => {
                debug('Could not connect to the MOX LT Server using the given information. ABORTING.');
                debug('Error: ' + e);
                
                this._socket.close();
                reject(e);
            });
            //--------------------------------------------------
            //  Track income messages
            //--------------------------------------------------
        
            this._socket.on('message', this._socketReceivedMessageEvent.bind(this));

            this._socket.bind(this._clientPort, this._clientIpAddress);
        });
    }

    /**
     * Disconnects from the MOX LT server.
     */
    disconnect() {
        if (!this._socket) {
            throw new Error("The socket has not been initialized yet.");
        }

        this._socket.close();
        this.emit('disconnect');
    };

    /**
     * Sets the light status.
     * @param {int} moduleId The smart-control module id.
     * @param {int} channelId The smart-control channel id.
     * @param {bool} status The status to set (on/off).
     */
    setLightStatus(moduleId, channelId, status) {
        /* Parse the module id */
        const moduleIdData = moxUtils.parseModuleId(moduleId);
        
        /* Send */
        return this._sendMessage([
            /* priority: */     0x03,
            /* oid_H: */        moduleIdData[0],
            /* oid_M: */        moduleIdData[1], 
            /* oid_L: */        moduleIdData[2],
            /* channel_id: */   channelId,
            0x01, 0x00, 0x00, 0x02, 0x03,
            /* isOn: */ (status ? 0x01 : 0x00)]);
    };

    /**
     * Request to get a light status update.
     * @param {int} moduleId The smart-control module id.
     * @param {int} channelId The smart-control channel id.
     */
    sendLightStatusRequest(moduleId, channelId) {
        /* Parse the module id */
        const moduleIdData = moxUtils.parseModuleId(moduleId);
        
        return this._sendMessage([
            /* priority: */     0x02,
            /* oid_H: */        moduleIdData[0],
            /* oid_M: */        moduleIdData[1], 
            /* oid_L: */        moduleIdData[2],
            /* channel_id: */   channelId,
        0x01, 0x00, 0x00, 0x01, 0x02]);
    }

    /**
     * Sets the light brightness value.
     * @param {int} moduleId The smart-control module id.
     * @param {int} channelId The smart-control channel id.
     * @param {int} value The value to set.
     */
    setLightBrightness(moduleId, channelId, value) {
        /* Parse the module id */
        const moduleIdData = moxUtils.parseModuleId(moduleId);
        
        return this._sendMessage([
            /* priority: */     0x03,
            /* oid_H: */        moduleIdData[0],
            /* oid_M: */        moduleIdData[1], 
            /* oid_L: */        moduleIdData[2],
            /* channel_id: */   channelId,
            0x02, 0x00, 0x00, 0x02, 0x06,
            /* value: */ value,
            0x00, 0x64, 0x00]);
    };

    /**
     * Request to get a light brightness value status update.
     * @param {int} moduleId The smart-control module id.
     * @param {int} channelId The smart-control channel id.
     */
    sendLightBrightnessRequest(moduleId, channelId) {
        /* Parse the module id */
        const moduleIdData = moxUtils.parseModuleId(moduleId);
        
        return this._sendMessage([
            /* priority: */     0x02,
            /* oid_H: */        moduleIdData[0],
            /* oid_M: */        moduleIdData[1], 
            /* oid_L: */        moduleIdData[2],
            /* channel_id: */   channelId,
            0x03, 0x00, 0x00, 0x01, 0x02]);
    }

    /**
     * Sets the curtain position value.
     * @param {int} moduleId The smart-control module id.
     * @param {int} channelId The smart-control channel id.
     * @param {bool} value The curtain position value.
     */
    setCurtainPositionValue(moduleId, channelId, value) {
        /* Parse the module id */
        const moduleIdData = moxUtils.parseModuleId(moduleId);
        
        /* Send */
        return this._sendMessage([
            /* priority: */     0x03,
            /* oid_H: */        moduleIdData[0],
            /* oid_M: */        moduleIdData[1], 
            /* oid_L: */        moduleIdData[2],
            /* channel_id: */   channelId,
            0x01, 0x00, 0x00, 0x02, 0x04,
            value,
            0x00]);
    };

    /**
     * Request to get a curtain position value status update.
     * @param {int} moduleId The smart-control module id.
     * @param {int} channelId The smart-control channel id.
     */
    sendCurtainPositionRequest(moduleId, channelId) {
        /* Parse the module id */
        const moduleIdData = moxUtils.parseModuleId(moduleId);
        
        return this._sendMessage([
            /* priority: */     0x02,
            /* oid_H: */        moduleId[0],
            /* oid_M: */        moduleId[1], 
            /* oid_L: */        moduleId[2],
            /* channel_id: */   channelId,
            0x01, 0x00, 0x00, 0x01, 0x02]);
    }
    
    //==========================================================================================
    //  Private API
    //==========================================================================================

    _socketReceivedMessageEvent(message, remote) {
        /* Parse */
        const response = new MoxLtServerResponse(message);
        
        /* Emit the event */
        this.emit('received', message, response);
    }

    _sendMessage(buffer) {
        return new Promise((resolve, reject) => {
            //--------------------------------------------------
            //  We've received a valid buffer?
            //--------------------------------------------------
            if (!(buffer instanceof Buffer)) {
                buffer = Buffer.from(buffer);
            }

            //--------------------------------------------------
            //  Send
            //--------------------------------------------------
            this._socket.send(buffer, 0, buffer.length, this._serverPort, this._serverIpAddress, (err, bytes) => {
                if (err) {
                    reject(err);
                    return;
                }

                /* General event */
                this.emit('send', buffer);

                /* Fire the callback */
                resolve(buffer);
            });
        });
    };
};

module.exports = MoxLtClient;