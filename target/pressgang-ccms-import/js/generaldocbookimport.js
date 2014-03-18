define(
    ['jquery', 'languages', 'qna/qna', 'qna/qnautils', 'qna/qnazipmodel', 'qnastart', 'specelement', 'fontrule', 'docbookimport', 'exports'],
    function (jquery, languages, qna, qnautils, qnazipmodel, qnastart, specelement, fontrule, docbookimport, exports) {
        'use strict';
        /*
         STEP 1 - Get the ZIP file
         */
        exports.askForDocBookFile = new qna.QNAStep()
            .setTitle("Select the ZIP file to import")
            .setIntro("Select the ZIP file that contains the valid Docbook content that you wish to import into PressGang CCMS.")
            .setInputs(
                [
                    new qna.QNAVariables()
                        .setVariables([
                            new qna.QNAVariable()
                                .setType(qna.InputEnum.SINGLE_FILE)
                                .setIntro("Docbook ZIP File")
                                .setName("InputSource")
                        ])
                ]
            )
            .setProcessStep(function (resultCallback, errorCallback, result, config) {

                config.InputType = "Zip";

                if (!config.InputSource) {
                    errorCallback("Please select a file", "You need to select a ZIP file before continuing.");
                } else if (config.InputSource.name.lastIndexOf(".zip") !== config.InputSource.name.length - 4) {
                    errorCallback("Please select a file", "You need to select a ZIP file before continuing.");
                } else {
                    resultCallback(null);
                }
            })
            .setEnterStep(function(resultCallback){
                qnastart.zipModel = qnastart.zipModel;
                qnastart.zipModel.clearCache();
                resultCallback(false);
            })
            .setNextStep(function (resultCallback) {
                resultCallback(askForMainXML);
            });

        /*
         STEP 2 - Get the main XML file
         */
        var askForMainXML = new qna.QNAStep()
            .setTitle("Select the main XML file")
            .setIntro("Select the main XML file from the ZIP archive. This is the XML that contains all the content, or contains links to all the content.")
            .setInputs([
                new qna.QNAVariables()
                    .setVariables([
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.LISTBOX)
                            .setName("MainXMLFile")
                            .setOptions(function (resultCallback, errorCallback, result, config) {
                                qnastart.zipModel.getCachedEntries(config.InputSource, function (entries) {
                                    var retValue = [];

                                    jquery.each(entries, function (index, value) {
                                        if (/^.*?\.xml$/.test(value.filename)) {
                                            retValue.push(value.filename);
                                        }
                                    });

                                    resultCallback(retValue);
                                });
                            })
                            .setValue(function (resultCallback, errorCallback, result, config) {
                                qnastart.zipModel.getCachedEntries(config.InputSource, function (entries) {
                                    // don't spend all day trying to find the main file
                                    if (entries.length < 25) {
                                        var mainFile = null;

                                        var processEntry = function(index) {
                                            if (index >= entries.length) {
                                                resultCallback(null);
                                            } else {
                                                qnastart.zipModel.getTextFromFile(entries[index], function (textFile) {
                                                    var match = /<(book)|(article)>/.exec(textFile);
                                                    if (match) {
                                                        resultCallback(entries[index].filename);
                                                    } else {
                                                        processEntry(++index);
                                                    }
                                                });
                                            }
                                        };

                                        processEntry(0);
                                    } else {
                                        resultCallback(null);
                                    }
                                });
                            })
                    ])
            ])
            .setEnterStep(function(resultCallback){
                qnastart.zipModel.clearCache();
                resultCallback(false);
            })
            .setNextStep(function (resultCallback) {
                resultCallback(getSpecDetails);
            });

        var getSpecDetails = new qna.QNAStep()
            .setTitle("Enter content specification details")
            .setIntro("Enter the basic details of the content specification")
            .setInputs(
                [
                    new qna.QNAVariables()
                        .setVariables([
                            new qna.QNAVariable()
                                .setType(qna.InputEnum.TEXTBOX)
                                .setIntro("Product")
                                .setName("ContentSpecProduct")
                                .setValue("Product"),
                            new qna.QNAVariable()
                                .setType(qna.InputEnum.TEXTBOX)
                                .setIntro("Version")
                                .setName("ContentSpecVersion")
                                .setValue("1"),
                            new qna.QNAVariable()
                                .setType(qna.InputEnum.TEXTBOX)
                                .setIntro("Copyright Holder")
                                .setName("ContentSpecCopyrightHolder")
                                .setValue("Red Hat"),
                            new qna.QNAVariable()
                                .setType(qna.InputEnum.COMBOBOX)
                                .setIntro("Brand")
                                .setName("ContentSpecBrand")
                                .setValue(function (resultCallback, errorCallback, result, config){
                                    if (config.ImportOption === "DocBook5") {
                                        resultCallback("RedHat-db5");
                                    } else {
                                        resultCallback("RedHat");
                                    }
                                })
                                .setOptions(function (resultCallback, errorCallback, result, config){
                                    if (config.ImportOption === "DocBook5") {
                                        resultCallback(["RedHat-db5"]);
                                    } else {
                                        resultCallback(["RedHat", "JBoss", "Fedora", "OpenShift"]);
                                    }
                                }),
                            new qna.QNAVariable()
                                .setType(qna.InputEnum.COMBOBOX)
                                .setIntro("Locale")
                                .setName("ImportLang")
                                .setValue("en-US")
                                .setOptions(languages.languages)
                        ])
                ]
            )
            .setNextStep(function (resultCallback, errorCallback, result, config) {
                resultCallback(docbookimport.askForRevisionMessage);
            });
    }
);
