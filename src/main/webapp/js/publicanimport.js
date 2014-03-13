define(
    ['jquery', 'qna/qna', 'qna/qnautils', 'qna/qnazipmodel', 'qnastart', 'specelement', 'fontrule', 'docbookimport', 'exports'],
    function (jquery, qna, qnautils, qnazipmodel, qnastart, specelement, fontrule, docbookimport, exports) {
        'use strict';
        /*
         STEP 1 - Get the ZIP file
         */
        exports.askForPublicanZipFile = new qna.QNAStep()
            .setTitle("Select the ZIP file to import")
            .setIntro("Select the ZIP file that contains the valid Publican book that you wish to import into PressGang CCMS. " +
                "The ZIP file must contain the publican.cfg file in the root directory.")
            .setInputs(
                [
                    new qna.QNAVariables()
                        .setVariables([
                            new qna.QNAVariable()
                                .setType(qna.InputEnum.SINGLE_FILE)
                                .setIntro("Publican ZIP File")
                                .setName("ZipFile")
                        ])
                ]
            )
            .setProcessStep(function (resultCallback, errorCallback, result, config) {
                if (!config.ZipFile) {
                    errorCallback("Please select a file", "You need to select a ZIP file before continuing.");
                } else if (config.ZipFile.name.lastIndexOf(".zip") !== config.ZipFile.name.length - 4) {
                    errorCallback("Please select a file", "You need to select a ZIP file before continuing.");
                } else {

                    /*
                        The file
                     */
                    qnastart.zipModel.clearCache();

                    qnastart.zipModel.getCachedEntries(config.ZipFile, function (entries) {

                        var foundPublicanCfg = false;
                        jquery.each(entries, function (index, value) {
                            if (value.filename === "publican.cfg") {
                                foundPublicanCfg = true;

                                var dtdVersion = qnautils.getValueFromConfigFile("dtdver");
                                if (dtdVersion !== undefined) {
                                    config.ImportOption = dtdVersion === "5.0" ? "DocBook5" : "DocBook45";
                                }

                                var brand = qnautils.getValueFromConfigFile("brand");
                                if (brand !== undefined) {
                                    config.ImportBrand = brand;
                                }

                                var condition = qnautils.getValueFromConfigFile("condition");
                                if (condition !== undefined) {
                                    config.ImportCondition = condition;
                                }

                                return false;
                            }
                        });

                        if (!foundPublicanCfg) {
                            errorCallback("Error", "The ZIP file did not contain a publican.cfg file in the root folder of the ZIP archive.");
                        } else {
                            resultCallback(null);
                        }
                    }, function (message) {
                        errorCallback("Error", "Could not process the ZIP file!");
                    });
                }
            })
            .setNextStep(function (resultCallback) {
                resultCallback(askForMainXML);
            })
            .setEnterStep(function(resultCallback){
                qnastart.zipModel.clearCache();
                resultCallback(false);
            });

        /*
         STEP 2 - Get the main XML file
         */
        var askForMainXML = new qna.QNAStep()
            .setTitle("Select the main XML file")
            .setIntro("Select the main XML file from the ZIP archive. Publican conventions mean the file should be named after the book title in the Book_Info.xml file. " +
                "This import tool will attempt to read the Book_Info.xml file to find the book title, and from that select the main XML file. " +
                "You only need to make a manual selection if the import tool could not find the main XML file, or if you want to override the default selection.")
            .setInputs([
                new qna.QNAVariables()
                    .setVariables([
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.LISTBOX)
                            .setName("MainXMLFile")
                            .setOptions(function (resultCallback, errorCallback, result, config) {
                                qnastart.zipModel.getCachedEntries(config.ZipFile, function (entries) {
                                    var retValue = [];

                                    jquery.each(entries, function (index, value) {
                                        if (/^.*?\.xml$/.test(value.filename)) {
                                            if (!/^tmp\//.test(value.filename)) {
                                                retValue.push(value.filename);
                                            }
                                        }
                                    });

                                    resultCallback(retValue);
                                });
                            })
                            .setValue(function (resultCallback, errorCallback, result, config) {
                                qnastart.zipModel.getCachedEntries(config.ZipFile, function (entries) {
                                    jquery.each(entries, function (index, value) {
                                        if (/^en-US\/(Book)|(Article)_Info\.xml$/.test(value.filename)) {
                                            qnastart.zipModel.getTextFromFile(value, function (textFile) {
                                                var match = /<title>(.*?)<\/title>/.exec(textFile);
                                                if (match) {
                                                    var assumedMainXMLFile = "en-US/" + match[1].replace(/ /g, "_") + ".xml";

                                                    jquery.each(entries, function (index, value) {
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
                            })
                    ])
            ])
            .setNextStep(function (resultCallback) {
                resultCallback(docbookimport.askForRevisionMessage);
            });


    }
);