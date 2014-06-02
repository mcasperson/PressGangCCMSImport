define(
    ['exports'],
    function (exports) {
        'use strict';

        exports.DOCBOOK_50 = "DOCBOOK_50";
        exports.DOCBOOK_45 = "DOCBOOK_45";

        exports.DOCBOOK_50_IMPORT_OPTION = "DocBook5";
        exports.DOCBOOK_45_IMPORT_OPTION = "DocBook45";
        exports.COMMON_CONTENT_PATH_PREFIX = /^Common_Content/;
        // these containers are ignored
        exports.IGNORED_CONTAINERS = ["partintro"];

        exports.CREATE_OR_OVERWRITE_CONFIG_KEY = "CreateOrOverwrite";
        exports.CREATE_SPEC = "CREATE";
        exports.OVERWRITE_SPEC = "OVERWRITE";
        exports.EXISTING_CONTENT_SPEC_ID = "ExistingContentSpecID";
    }
)