'use strict';

const helpers = require('./mox-utils');

module.exports = class MoxLtServerResponse {
    constructor(buffer) {
        //--------------------------------------------------
        //  Did we got a valid response?
        //--------------------------------------------------
        
        if (!(buffer instanceof Buffer)) {
            throw new Error('The given buffer arguments must be of type Buffer.');
        }
    
        if (buffer.length < 5) {
            /* 5 = priority + oid_H + oid_M + oid_L + channel */
            throw new Error('The received buffer is invalid.');
        }
    
        /* Save the iVars */
        this._buffer         = buffer;
    };

    /**
     * Gets the response priority.
     */
    get priority() {
        return this._buffer[0];
    }

    /**
     * Gets the module id as an integer.
     */
    get moduleId() {
        // If the module id is 0xABCDEF, then:
        //      0xABCDEF & 0xff = 239 = 0xEF
        //      (0xABCDEF >> 8) & 0xff = 239 = 0xEF
        //      (0xABCDEF >> 16) & 0xff = 171 = 0xAB
        // so the re-composition is:
        // 0xEF + (0xCD << 8) + (0xAB << 16)
        return this._buffer[3] + (this._buffer[2] << 8) + (this._buffer[1] << 16);
    }

    /**
     * Gets the response channel id.
     */
    get channelId() {
        return this._buffer[4];
    }

    /**
     * Tests if the response buffer matches a status update, according to the MOX LT specification.
     */
    isLightStatusResponse() {
        //--------------------------------------------------
        //  We must receive exactly 11 bytes.
        //--------------------------------------------------
        if (this._buffer.length != 11) {
            return false;
        }

        //--------------------------------------------------
        //  Compare the fixed bytes
        //--------------------------------------------------

        return this._buffer[5] == 0x01
            && this._buffer[6] == 0x00
            && this._buffer[7] == 0x00
            && this._buffer[8] == 0x03
            && this._buffer[9] == 0x03;
    };

    /**
     * Tests if the response buffer matches a status update, according to the MOX LT specification.
     */
    isLightBrightnessResponse() {
        //--------------------------------------------------
        //  We must receive exactly 12 bytes.
        //--------------------------------------------------
        if (this._buffer.length != 12) {
            return false;
        }
        
        //--------------------------------------------------
        //  Compare the fixed bytes
        //--------------------------------------------------

        return this._buffer[5] == 0x03
            && this._buffer[6] == 0x00
            && this._buffer[7] == 0x00
            && this._buffer[8] == 0x03
            && this._buffer[9] == 0x04
            && this._buffer[11] == 0x00;
    };

    /**
     * Tests if the response buffer matches a curtain status update, according to the MOX LT specification.
     */
    isCurtainStatusResponse() {
        //--------------------------------------------------
        //  We must receive exactly 11 bytes.
        //--------------------------------------------------
        if (this._buffer.length != 12) {
            return false;
        }

        //--------------------------------------------------
        //  Compare the fixed bytes
        //--------------------------------------------------

        return this._buffer[5] == 0x01
            && this._buffer[6] == 0x00
            && this._buffer[7] == 0x00
            && this._buffer[8] == 0x03
            && this._buffer[9] == 0x04
            && this._buffer[11] == 0x00;
    };

    /**
     * Attemps to get a light status.
     * @return undefined|boolean
     */
    getLightStatus() {
        return this._buffer[10] == 0x01;
    };

    /**
     * Attemps to get a light brightness value.
     * @return undefined|boolean
     */
    getLightBrightness() {
        return this._buffer[10];
    };

    /**
     * Attemps to get a curtain status.
     * @return undefined|boolean
     */
    getCurtainPosition() {
        return this._buffer[10];
    };

    /**
     * Represents the object as a string.
     */
    toString() {
        return `MoxLtServerResponse { buffer = [${this._buffer.join(', ')}], priority = ${this.priority}, moduleId = ${this.moduleId}, channelId = ${this.channelId} }`;
    }
};
