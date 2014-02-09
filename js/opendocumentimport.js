(function (global) {
    'use strict';

    /*
     STEP 1 - Get the ZIP file
     */
    global.askForOpenDocumentFile = new global.QNAStep()
        .setTitle("Select the ODT file to import")
        .setIntro("Select the ODT file that contains the content you wish to import.")
        .setInputs(
            [
                new global.QNAVariables()
                    .setVariables([
                        new global.QNAVariable()
                            .setType(global.InputEnum.SINGLE_FILE)
                            .setIntro("OpenDocument ODT File")
                            .setName("OdtFile")
                    ])
            ]
        )
        .setProcessStep(function (resultCallback, errorCallback, result, config) {
            if (!config.OdtFile) {
                errorCallback("Please select a file", "You need to select an ODT file before continuing.");
            } else if (config.OdtFile.name.lastIndexOf(".odt") !== config.OdtFile.name.length - 4) {
                errorCallback("Please select a file", "You need to select an ODT file before continuing.");
            } else {
                global.zipModel.getCachedEntries(config.OdtFile, function (entries) {

                    var foundContentFile = false;
                    global.angular.forEach(entries, function (value, key) {
                        if (value.filename === "content.xml") {
                            foundContentFile = true;
                            return false;
                        }
                    });

                    var foundStyleFile = false;
                    global.angular.forEach(entries, function (value, key) {
                        if (value.filename === "style.xml") {
                            foundStyleFile = true;
                            return false;
                        }
                    });

                    if (!foundContentFile || !foundStyleFile) {
                        errorCallback("Error", "The ODT file did not contain a style.xml file. The selected file is not a valid OpenDocument file.");
                    } else {
                        resultCallback(null);
                    }
                }, function (message) {
                    errorCallback("Error", "Could not process the ODT file!");
                });
            }
        })
        .setNextStep(function (resultCallback) {
            resultCallback(askForMainXML);
        });
}(this));