define(
    ['jquery', 'qna/qna', 'qna/qnautils', 'qna/qnazipmodel', 'qnastart', 'specelement', 'fontrule', 'docbookimport', 'processxml', 'exports'],
    function (jquery, qna, qnautils, qnazipmodel, qnastart, specelement, fontrule, docbookimport, processxml, exports) {
        'use strict';

        var inputModel;

        exports.askForZipOrDir = new qna.QNAStep()
            .setTitle("Select the source of the content to import")
            .setIntro("You can import from a ZIP file or from a local directory.")
            .setInputs([
                new qna.QNAVariables()

                    .setVariables([
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.RADIO_BUTTONS)
                            .setIntro(["Zip File", "Directory"])
                            .setOptions(["Zip", "Dir"])
                            .setValue("Dir")
                            .setName("InputType")
                    ])
            ])
            .setNextStep(function (resultCallback, errorCallback, result, config) {
                resultCallback(config.InputType === "Zip" ? askForDocBookFile : askForDocbookDir);
            })
            .setEnterStep(function(resultCallback, errorCallback, result, config) {
                if (!qnautils.isInputDirSupported()) {
                    config.InputType = "Zip";
                    resultCallback(true);
                } else {
                    resultCallback(false);
                }
            });

        /*
         Get the ZIP file
         */
        var askForDocBookFile = new qna.QNAStep()
            .setTitle("Select the ZIP file to import")
            .setIntro("Select the ZIP file that contains the valid DocBook content that you wish to import into PressGang CCMS.")
            .setInputs(
                [
                    new qna.QNAVariables()
                        .setVariables([
                            new qna.QNAVariable()
                                .setType(qna.InputEnum.SINGLE_FILE)
                                .setIntro("DocBook ZIP File")
                                .setName("InputSource")
                                .setOptions("application/zip")
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
            .setNextStep(function (resultCallback) {
                resultCallback(askForMainXML);
            }).setEnterStep(function(resultCallback){
                inputModel = qnastart.zipModel;
                inputModel.clearCache();
                resultCallback(false);
            });

        var askForDocbookDir = new qna.QNAStep()
            .setTitle("Select the directory to import")
            .setIntro("Select the directory that contains the valid Publican book that you wish to import into PressGang CCMS.")
            .setInputs(
                [
                    new qna.QNAVariables()
                        .setVariables([
                            new qna.QNAVariable()
                                .setType(qna.InputEnum.DIRECTORY)
                                .setIntro("DocBook Directory")
                                .setName("InputSource")
                        ])
                ]
            )
            .setProcessStep(function (resultCallback, errorCallback, result, config) {
                if (!config.InputSource) {
                    errorCallback("Please select a directory", "You need to select a directory before continuing.");
                } else {
                    resultCallback(null);
                }
            })
            .setNextStep(function (resultCallback) {
                resultCallback(askForMainXML);
            })
            .setEnterStep(function(resultCallback){
                inputModel = qnastart.dirModel;
                inputModel.clearCache();
                resultCallback(false);
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
                                inputModel.getCachedEntries(config.InputSource, function (entries) {
                                    var retValue = [];

                                    jquery.each(entries, function (index, value) {
                                        var filename = qnautils.getFileName(value);
                                        if (qnautils.fileHasExtension("xml", filename)) {
                                            retValue.push(filename);
                                        }
                                    });

                                    resultCallback(retValue);
                                });
                            })
                            .setValue(function (resultCallback, errorCallback, result, config) {
                                inputModel.getCachedEntries(config.InputSource, function (entries) {
                                    // don't spend all day trying to find the main file
                                    if (entries.length < 25 || config.InputType === "Dir") {
                                        var mainFile = null;

                                        var processEntry = function(index) {
                                            if (index >= entries.length) {
                                                resultCallback(null);
                                            } else {
                                                var entry = entries[index];
                                                var filename = qnautils.getFileName(entry);
                                                if (qnautils.isNormalFile(filename) && qnautils.fileHasExtension("xml", filename)) {
                                                    inputModel.getTextFromFile(entry, function (textFile) {

                                                        var match = /<(book)|(article)>/.exec(textFile);
                                                        if (match) {
                                                            resultCallback(qnautils.getFileName(entries[index]));
                                                        } else {
                                                            processEntry(++index);
                                                        }
                                                    });
                                                } else {
                                                    processEntry(++index);
                                                }
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
                inputModel.clearCache();
                resultCallback(false);
            })
            .setProcessStep(function(resultCallback, errorCallback, result, config) {
                if (config.MainXMLFile === null || config.MainXMLFile === undefined || config.MainXMLFile.trim().length === 0 ) {
                    errorCallback("Select a XML file", "Please select the main XML file before continuing");
                } else {
                    /*
                        Process the xml and extract the entities
                     */
                    processxml.processXMLAndExtractEntities(
                        function (result) {
                            resultCallback(result);
                        },
                        errorCallback,
                        result,
                        config
                    );
                }
            })
            .setNextStep(function (resultCallback) {
                 resultCallback(getSpecDetails);
            });

        var getSpecDetails = new qna.QNAStep()
            .setTitle("Enter content specification details")
            .setIntro("Enter the basic details of the content specification. If these values are found in the content being imported, the values entered here will be overwritten.")
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
                                .setValue(function (resultCallback, errorCallback, result, config) {
                                    if (config.ImportOption === "DocBook5") {
                                        resultCallback("RedHat-db5");
                                    } else {
                                        resultCallback("RedHat");
                                    }
                                })
                                .setOptions(function (resultCallback, errorCallback, result, config) {
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
                                .setOptions(function (resultCallback) {
                                    resultCallback(qnastart.loadLocales());
                                })
                        ])
                ]
            )
            .setNextStep(function (resultCallback, errorCallback, result, config) {
                resultCallback(docbookimport.askForRevisionMessage);
            });
    }
);
