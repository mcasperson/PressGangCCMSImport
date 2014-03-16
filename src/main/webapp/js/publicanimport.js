define(
    ['jquery', 'qna/qna', 'qna/qnautils', 'qna/qnazipmodel', 'qnastart', 'uri/URI', 'specelement', 'fontrule', 'docbookimport', 'exports'],
    function (jquery, qna, qnautils, qnazipmodel, qnastart, URI, specelement, fontrule, docbookimport, exports) {
        'use strict';

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
                            .setName("InputSource")
                    ])
            ])
            .setProcessStep(function (resultCallback, errorCallback, result, config) {
                resultCallback(null);
            })
            .setNextStep(function (resultCallback) {
                resultCallback(askForPublicanZipFile);
            })
            .setEnterStep(function(resultCallback, errorCallback, result, config) {
                if (!qnautils.isInputDirSupported()) {
                    config.InputSource = "Zip";
                    resultCallback(true);
                } else {
                    resultCallback();
                }
            });

        /*
         Get the ZIP file
         */
        var askForPublicanZipFile = new qna.QNAStep()
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
                                foundPublicanCfg = value;
                                return false;
                            }
                        });

                        if (!foundPublicanCfg) {
                            errorCallback("Error", "The ZIP file did not contain a publican.cfg file in the root folder of the ZIP archive.");
                        } else {

                            qnastart.zipModel.getTextFromFileName(config.ZipFile, "publican.cfg", function(publicanCfg) {
                                var dtdVersion = qnautils.getValueFromConfigFile(publicanCfg, "dtdver");
                                if (dtdVersion !== undefined) {
                                    config.ImportOption = /('|")5\.0('|")/.test(dtdVersion) ? "DocBook5" : "DocBook45";
                                }

                                var brand = qnautils.getValueFromConfigFile(publicanCfg, "brand");
                                if (brand !== undefined) {
                                    config.ImportBrand = brand;
                                }

                                var condition = qnautils.getValueFromConfigFile(publicanCfg, "condition");
                                if (condition !== undefined) {
                                    config.ImportCondition = condition;
                                }

                                /*
                                    Find cfg files and add them to the content spec
                                 */
                                var contentSpec = [];
                                var configCount = 1;
                                qnastart.zipModel.getCachedEntries(config.ZipFile, function (entries) {
                                    function processEntry(index, callback) {
                                        if (index >= entries.length) {
                                            callback();
                                        } else {
                                            var entry = entries[index];
                                            var uri = new URI(entry.filename);
                                            if (/\.cfg$/.test(uri.filename())) {
                                                qnastart.zipModel.getTextFromFileName(config.ZipFile, entry.filename, function(configFile) {

                                                    var fixedFileName = uri.filename();

                                                    /*
                                                        Multiple publican config files need to have special names in order
                                                        to be added to the content spec. See https://bugzilla.redhat.com/show_bug.cgi?id=1011904.
                                                        The format is: <PREFIX>-publican.cfg
                                                     */
                                                    if (!/^publican.cfg$/.test(fixedFileName) &&
                                                        !/^\S+-publican.cfg$/.test(fixedFileName)) {
                                                        /*
                                                            If this config file does not conform, then rename it.
                                                         */
                                                        var prefix = fixedFileName.substring(0, fixedFileName.length - 4).replace(/publican/g, "");

                                                        /*
                                                            If our renaming does not produce a valid prefix, fall back to a default name
                                                         */
                                                        if (!/^[A-Za-z]+[A-Za-z0-9]*$/.test(prefix)) {
                                                            prefix = "config" + configCount;
                                                            ++configCount;
                                                        }

                                                        fixedFileName = prefix + "-publican.cfg";
                                                    }

                                                    contentSpec.push(fixedFileName + " = [");
                                                    contentSpec.push("# Contents from " + uri.filename());
                                                    jquery.each(configFile.split("\n"), function(index, value){
                                                        if (value.trim().length !== 0) {
                                                            contentSpec.push(value);
                                                        }
                                                    });
                                                    contentSpec.push("]");

                                                    processEntry(++index, callback);
                                                });
                                            } else {
                                                processEntry(++index, callback);
                                            }
                                        }
                                    }

                                    processEntry(0, function() {
                                        resultCallback(JSON.stringify({contentSpec: contentSpec}));
                                    });
                                });
                            });
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
                                /*
                                    Look for an option called mainfile which will override the default
                                    main XML file.
                                 */
                                qnastart.zipModel.getTextFromFileName(
                                    config.ZipFile,
                                    "publican.cfg",
                                    function(data) {
                                        var options = data.split("\n");
                                        var foundMainFile = false;
                                        jquery.each(options, function (index, value) {
                                            var keyValue = value.split(":");
                                            if (keyValue.length === 2 && keyValue[0].trim() === "mainfile") {
                                                resultCallback("en-US/" + keyValue[1].trim());
                                                foundMainFile = true;
                                                return false;
                                            }
                                        });

                                        if (!foundMainFile) {
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
                                                                        return false;
                                                                    }
                                                                });
                                                            }
                                                        });

                                                        return false;
                                                    }
                                                });
                                            });
                                        }
                                    },
                                    errorCallback);

                                resultCallback(null);
                            })
                    ])
            ])
            .setNextStep(function (resultCallback) {
                resultCallback(docbookimport.askForRevisionMessage);
            });
    }
);