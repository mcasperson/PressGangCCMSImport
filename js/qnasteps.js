(function (global) {
    'use strict';

    /*
        STEP 1 - Get the ZIP file
     */
    global.QNAStart = new global.QNAStep(
        "Select the ZIP file to import",
        "Select the ZIP file that contains the valid Publican book that you wish to import into PressGang CCMS.",
        [
            new global.QNAVariables(null, [
                new global.QNAVariable(global.InputEnum.SINGLE_FILE, "Publican ZIP File", "ZipFile")
            ])
        ],
        function (result, config, resultCallback, errorCallback) {
            new global.QNAZipModel().getEntries(config.ZipFile, function (entries) {

                var foundPublicanCfg = false;
                global.angular.forEach(entries, function (value, key) {
                    if (value.filename === "publican.cfg") {
                        foundPublicanCfg = true;
                        return false;
                    }
                });

                if (!foundPublicanCfg) {
                    errorCallback("Error", "The ZIP file did not contain a publican.cfg file.");
                } else {
                    config.ZipFileEntries = entries;
                    resultCallback(null);
                }
            }, function (message) {
                errorCallback("Error", "Could not process the ZIP file!");
            });
        },
        function (result, config, stepCallback, errorCallback) {
            stepCallback(askForMainXML);
        }
    );

    /*
     STEP 2 - Get the main XML file
     */
    var askForMainXML = new global.QNAStep(
        "Select the main XML file",
        "Select the main XML file from the ZIP archive. Publican conventions mean the file should be named after the book title in Book_Info.xml.",
        [
            new global.QNAVariables(null, [
                new global.QNAVariable(global.InputEnum.LISTBOX, null, "MainXMLFile", function (result, config, itemsCallback, valueCallback) {

                    // here we attempt to find a file called Book_Info.xml, look for the title element inside of it,
                    // and use that to work out the main xml file name
                    global.angular.forEach(config.ZipFileEntries, function (value, key) {
                        if (/^en-US\/Book_Info\.xml$/.test(value.filename)) {
                            new global.QNAZipModel().getTextFromFile(value, function (textFile) {
                                var match = /<title>(.*?)<\/title>/.exec(textFile);
                                if (match) {
                                    var assumedMainXMLFile = "en-US/" + match[1].replace(/ /g, "_") + ".xml";

                                    global.angular.forEach(config.ZipFileEntries, function (value, key) {
                                        if (value.filename === assumedMainXMLFile) {
                                            valueCallback(assumedMainXMLFile);
                                            return false;
                                        }
                                    });
                                }
                            });

                            return false;
                        }
                    });

                    // here we get all the files from the zip and list any that might be relevant
                    var retValue = [];

                    global.angular.forEach(config.ZipFileEntries, function (value, key) {
                        if (/^en-US\/.*?\.xml$/.test(value.filename)) {
                            retValue.push(value.filename);
                        }
                    });

                    itemsCallback(retValue);
                })
            ])
        ],
        null,
        function (result, config, stepCallback, errorCallback) {

        }
    );

}(this));