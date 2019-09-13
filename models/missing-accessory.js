const mongoose = require('mongoose')

module.exports = mongoose.model('MissingAccessory', new mongoose.Schema({
    moduleId: { type: Number, required: true },
    channelId: { type: Number, required: true },
    bufferData: String,
    createdAt: {
        type: Date,
        default: Date.now
    }
}));