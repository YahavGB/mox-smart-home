const http = require('http');
const mongoose = require('mongoose');

const MONGO_CONN_STRING = "mongodb://mongo:27017/mox-home";

http.createServer((req, res) => {
    res.write('Hello, World!');
    res.end();
}).listen(3000, () => {
    mongoose.connect(MONGO_CONN_STRING, { useNewUrlParser: true });

    var db = mongoose.connection;
    db.on('error', e => console.error("MongoDb Connection Error: " + e));
    db.once('open', () => console.info("Connected to MongoDb"));
    console.log("server start at port 3000");
});