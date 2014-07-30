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
    ['jquery', 'async/async', 'qna/qna', 'qna/qnautils', 'qna/qnazipmodel', 'qnastart', 'specelement', 'fontrule', 'docbookimport', 'processxml', 'exports'],
    function (jquery, async, qna, qnautils, qnazipmodel, qnastart, specelement, fontrule, docbookimport, processxml, exports) {
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
                            .setName("MainFile")
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

                                        async.eachSeries(entries,
                                            function(entry, callback) {
                                                var filename = qnautils.getFileName(entry);
                                                if (qnautils.isNormalFile(filename) && qnautils.fileHasExtension("xml", filename)) {
                                                    inputModel.getTextFromFile(entry, function (textFile) {

                                                        var match = /<\s*(book|article)(\s+|>)/.exec(textFile);
                                                        if (match) {
                                                            resultCallback(qnautils.getFileName(entry));
                                                            callback(true);
                                                        } else {
                                                            callback(null);
                                                        }
                                                    });
                                                } else {
                                                    callback(null);
                                                }
                                            }, function (err) {
                                                if (!err) {
                                                    resultCallback(null);
                                                }
                                            }
                                        );
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
                if (config.MainFile === null || config.MainFile === undefined || config.MainFile.trim().length === 0 ) {
                    errorCallback("Select a XML file", "Please select the main XML file before continuing");
                } else {
                    /*
                        Process the xml and extract the entities
                     */
                    processxml.resolveXiIncludes(
                        function(xmlText) {
                            processxml.processXMLAndExtractEntities(
                                function (result) {
                                    jquery.extend(config, result.config);
                                    resultCallback(JSON.stringify(result));
                                },
                                errorCallback,
                                xmlText,
                                config
                            );
                        },
                        errorCallback,
                        config
                    )
                }
            })
            .setNextStep(function (resultCallback) {
                 resultCallback(exports.getSpecDetails);
            });

        exports.getSpecDetails = new qna.QNAStep()
            .setTitle("Enter content specification details")
            .setIntro("Enter the basic details of the content specification. If these values are found in the content being imported, the values entered here will be overwritten.")
            .setInputs(
                [
                    new qna.QNAVariables()
                        .setVariables([
                            new qna.QNAVariable()
                                .setType(qna.InputEnum.TEXTBOX)
                                .setIntro("Title")
                                .setName("ContentSpecTitle"),
                            new qna.QNAVariable()
                                .setType(qna.InputEnum.TEXTBOX)
                                .setIntro("Subtitle")
                                .setName("ContentSpecSubtitle"),
                            new qna.QNAVariable()
                                .setType(qna.InputEnum.TEXTBOX)
                                .setIntro("Product")
                                .setName("ContentSpecProduct"),
                            new qna.QNAVariable()
                                .setType(qna.InputEnum.TEXTBOX)
                                .setIntro("Version")
                                .setName("ContentSpecVersion"),
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
