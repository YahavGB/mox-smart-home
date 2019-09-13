const mongoose = require('mongoose')

module.exports = mongoose.model('Accessory', new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
    type: {
        type: String,
        enum : ['light', 'dimmer', 'switch', 'window'],
        default: 'light'
    },
    moduleId: { type: Number, required: true },
    channelId: { type: Number, required: true }
}, { timestamps: true, strict: false }));