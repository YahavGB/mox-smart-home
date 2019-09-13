const mongoose = require('mongoose');
const Accessory = require('./accessory');
const debug = require('debug')('models:house');

const schema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    house: { type: mongoose.Schema.Types.ObjectId, ref: 'House' },
    accessories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Accessory' }],
    image: String,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

schema.pre('remove', function(next) {
    debug("Removing room: " + this._id);
    Accessory.deleteMany({ room: this._id }).exec();
    next();
});

module.exports = mongoose.model('Room', schema);