module.exports.PubSubEvents = class MoxPubSubEvents {
    /**
     * The server sends a Pub event when it connects to all of the services.
     */
    static get SERVER_PUB_CONNECTED() {
        return "com.yahavgindibar.mox-home.pub.connected";
    };

    /**
     * The server sends a Pub event when it disconnects.
     */
    static get SERVER_PUB_DISCONNECTED() {
        return "com.yahavgindibar.mox-home.pub.disconnected";
    };

    /**
     * The server sends a Pub event when it disconnects.
     */
    static get SERVER_SUB_INTERACT() {
        return "com.yahavgindibar.mox-home.sub.interact";
    };

}