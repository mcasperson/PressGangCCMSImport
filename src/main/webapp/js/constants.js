/*
 Copyright 2011-2014 Red Hat, Inc

 This file is part of PressGang CCMS.

 PressGang CCMS is free software: you can redistribute it and/or modify
 it under the terms of the GNU Lesser General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 PressGang CCMS is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU Lesser General Public License for more details.

 You should have received a copy of the GNU Lesser General Public License
 along with PressGang CCMS.  If not, see <http://www.gnu.org/licenses/>.
 */

define(
    ['exports'],
    function (exports) {
        'use strict';

        exports.TOP_LEVEL_CONTAINER = "TopLevelContainer";
        exports.SECTION_TOP_LEVEL_CONTAINER = "Section";
        exports.CHAPTER_TOP_LEVEL_CONTAINER = "Chapter";

        exports.DOCBOOK_50 = "DOCBOOK_50";
        exports.DOCBOOK_45 = "DOCBOOK_45";

        exports.IMPORT_OPTION = "ImportOption";

        exports.PUBLICAN_IMPORT_OPTION = "Publican";
        exports.DOCBOOK_50_IMPORT_OPTION = "DocBook5";
        exports.DOCBOOK_45_IMPORT_OPTION = "DocBook45";
        exports.MOJO_IMPORT_OPTION = "Mojo";
        exports.ODT_IMPORT_OPTION = "OpenDocument";
        exports.ASCIIDOC_IMPORT_OPTION = "Asciidoc";
        exports.COMMON_CONTENT_PATH_PREFIX = /^Common_Content/;
        // these containers are ignored
        exports.IGNORED_CONTAINERS = ["partintro"];

        exports.CREATE_OR_OVERWRITE_CONFIG_KEY = "CreateOrOverwrite";
        exports.CREATE_SPEC = "CREATE";
        exports.OVERWRITE_SPEC = "OVERWRITE";
        exports.EXISTING_CONTENT_SPEC_ID = "ExistingContentSpecID";

        exports.CREATE_OR_REUSE_TOPICS = "CreateOrResuseTopics";
        exports.REUSE_TOPICS = "REUSE";
        exports.CREATE_TOPICS = "CREATE";

        exports.CREATE_OR_REUSE_IMAGES = "CreateOrResuseImages";
        exports.REUSE_IMAGES = "REUSE";
        exports.CREATE_IMAGES = "CREATE";

        exports.CREATE_OR_REUSE_FILES = "CreateOrResuseFiles";
        exports.REUSE_FILES = "REUSE";
        exports.CREATE_FILES = "CREATE";

        exports.PRESSGANG_HOST = "PressGangHost";

        exports.INPUT_TYPE = "InputType";
        exports.INPUT_TYPE_DIR = "Dir";
        exports.INPUT_TYPE_ZIP = "Zip";
        exports.INPUT_TYPE_ZIPURL = "ZipURL";

        exports.SOURCE_URL = "SourceURL";
        exports.MAIN_FILE = "MainFile";

        exports.SERVER_JSON_FILE = '/pressgang-ccms-config/servers.json';

        exports.MAXIMUM_SPEC_COMMENT_LINE_LENGTH = 120;
    }
)