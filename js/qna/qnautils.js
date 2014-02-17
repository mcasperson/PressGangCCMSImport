define (['jquery', 'exports'], function (jquery, exports) {
    'use strict';

    exports.escapeRegExp = function(str) {
        return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
    };

    exports.keys = function(obj)
    {
        var keys = [];
        for(var key in obj) {
            if(obj.hasOwnProperty(key)) {
                keys.push(key);
            }
        }
        keys.sort();
        return keys;
    };

    exports.xmlToString = function(xmlDoc) {
        return (new XMLSerializer()).serializeToString(xmlDoc);
    };

    exports.stringToXML = function(xml) {
        try {
            return jquery.parseXML(xml);
        } catch (error) {
            console.log(error);
        }
    };
});

