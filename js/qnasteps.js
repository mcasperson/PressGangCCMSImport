(function (global) {
    'use strict';

    /*
        STEP 1 - Get the ZIP file
     */
    global.QNAStart = new global.QNAStep(
        function (result, config, resultCallback, errorCallback) {resultCallback("Select the ZIP file to import"); },
        function (result, config, resultCallback, errorCallback) {resultCallback("Select the ZIP file that contains the valid Publican book that you wish to import into PressGang CCMS."); },
        function (result, config, resultCallback, errorCallback) {resultCallback([
            new global.QNAVariables(
                null,
                function (result, config, resultCallback, errorCallback) {resultCallback([
                    new global.QNAVariable(
                        function (result, config, resultCallback, errorCallback) {resultCallback(global.InputEnum.SINGLE_FILE); },
                        function (result, config, resultCallback, errorCallback) {resultCallback("Publican ZIP File"); },
                        function (result, config, resultCallback, errorCallback) {resultCallback("ZipFile"); }
                    )
                ]); }
            )
        ]); },
        function (result, config, resultCallback, errorCallback) {
            new global.QNAZipModel().getCachedEntries(config.ZipFile, function (entries) {

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
        function (result, config, resultCallback, errorCallback) {resultCallback("Select the main XML file"); },
        function (result, config, resultCallback, errorCallback) {resultCallback("Select the main XML file from the ZIP archive. Publican conventions mean the file should be named after the book title in the Book_Info.xml file. " +
            "This import tool will attempt to read the Book_Info.xml file to find the book title, and from that select the main XML file. " +
            "You only need to make a manual selection if the import tool could not find the main XML file, or if you want to override the default selection."); },
        function (result, config, resultCallback, errorCallback) {resultCallback([
            new global.QNAVariables(
                null,
                function (result, config, resultCallback, errorCallback) {resultCallback(
                    [
                        new global.QNAVariable(
                            function (result, config, resultCallback, errorCallback) {resultCallback(global.InputEnum.LISTBOX); },
                            null,
                            function (result, config, resultCallback, errorCallback) {resultCallback("MainXMLFile"); },
                            function (result, config, resultCallback, errorCallback) {
                                new global.QNAZipModel().getCachedEntries(config.ZipFile, function (entries) {
                                    var retValue = [];

                                    global.angular.forEach(entries, function (value, key) {
                                        if (/^.*?\.xml$/.test(value.filename)) {
                                            retValue.push(value.filename);
                                        }
                                    });

                                    resultCallback(retValue);
                                });
                            },
                            function (result, config, resultCallback, errorCallback) {
                                new global.QNAZipModel().getCachedEntries(config.ZipFile, function (entries) {
                                    global.angular.forEach(entries, function (value, key) {
                                        if (/^en-US\/Book_Info\.xml$/.test(value.filename)) {
                                            new global.QNAZipModel().getTextFromFile(value, function (textFile) {
                                                var match = /<title>(.*?)<\/title>/.exec(textFile);
                                                if (match) {
                                                    var assumedMainXMLFile = "en-US/" + match[1].replace(/ /g, "_") + ".xml";

                                                    global.angular.forEach(entries, function (value, key) {
                                                        if (value.filename === assumedMainXMLFile) {
                                                            resultCallback(assumedMainXMLFile);
                                                            return;
                                                        }
                                                    });
                                                }
                                            });

                                            return false;
                                        }
                                    });
                                });

                                resultCallback(null);
                            }
                        )
                    ]
                ); }
            )
        ]); },
        null,
        function (result, config, stepCallback, errorCallback) {

        }
    );

}(this));