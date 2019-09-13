const uuidv5 = require('uuid/v5');

/** Parse the module id hex string and retrieve the actual module number. */
module.exports.parseModuleId  = function(moduleIdStr) {
    /* This is an array? */
    if (typeof(moduleIdStr) == 'array' || typeof(moduleIdStr) == 'object') {
        /* Its okay!! */
        return moduleIdStr;
    }

    /* This is a number? */
    if (typeof(moduleIdStr)) {
        /* Simple parse */
        return [
            (moduleIdStr >> 8) & 0xff,
            (moduleIdStr >> 16) & 0xff,
            (moduleIdStr >> 32) & 0xff
        ];
    }

    if (!module.exports.verifyModuleId(moduleIdStr)) {
        return undefined;
    }

	var moduleH = parseInt(moduleIdStr.substring(2, 4), 16);
    var moduleM = parseInt(moduleIdStr.substring(4, 6), 16);
    var moduleL = parseInt(moduleIdStr.substring(6, 8), 16);
      
    return [moduleH, moduleM, moduleL];
}

/* Creates a unique, consistent, uuid, for the given accessory */
module.exports.uuidForAccessory = function(moduleId, channelId) {
    moduleId = module.exports.parseModuleId(moduleId);
    
    if (typeof(channelId) == 'string') {
        channelId = parseInt(channelId, 16);
    }
    
    const NAMESPACE = '17b8e566-afb6-4884-a77f-4e5e82deefec';
    const identifier = `${moduleId[0].toString(16)}-${moduleId[1].toString(16)}-${moduleId[2].toString(16)}-${channelId.toString(16)}`;
    
    // console.log("");
    // console.log("Creating a new identifier for " + identifier + " : " + uuidv5(identifier, NAMESPACE));
    // console.log("");

    return uuidv5(identifier, NAMESPACE);
};