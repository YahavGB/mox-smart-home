const mongoose = require('mongoose');
const Room = require('./room');
const debug = require('debug')('models:house');

const schema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    serverIpAddress: {
        type: String,
        required: true,
        trim: true
    },
    serverPort: { type: Number, required: true },
    clientPort: { type: Number, required: true },
    image: String,
    rooms: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Room' }],
     createdAt: {
        type: Date,
        default: Date.now
    }
});

schema.pre('remove', async function(next) {
    debug("Removing house: " + this._id);
    debug(this);
    Room.find({ house: this._id }).then(data => {
        data.forEach(room => room.remove());
    });
    next();
});

module.exports = mongoose.model('House', schema);