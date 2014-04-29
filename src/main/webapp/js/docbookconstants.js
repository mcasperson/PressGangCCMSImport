define(
    ['exports'],
    function (exports) {
        'use strict';
        exports.DOCBOOK_50_IMPORT_OPTION = "DocBook5";
        exports.DOCBOOK_45_IMPORT_OPTION = "DocBook45";
        exports.COMMON_CONTENT_PATH_PREFIX = /^Common_Content/;
        // these containers are ignored
        exports.IGNORED_CONTAINERS = ["partintro"];
    }
)