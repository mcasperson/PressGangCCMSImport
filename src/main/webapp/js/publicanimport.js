define(
    ['jquery', 'qna/qna', 'qna/qnautils', 'qna/qnazipmodel', 'qnastart', 'uri/URI', 'specelement', 'fontrule', 'docbookimport', 'exports'],
    function (jquery, qna, qnautils, qnazipmodel, qnastart, URI, specelement, fontrule, docbookimport, exports) {
        'use strict';

        var DEFAULT_LANG = "en-US";

        var IGNORE_PUBLICAN_CFG_SETTINGS = ["xml_lang", "brand", "type", "dtdver", "condition", "docname", "product", "version"];

        // This will be the object that we query for files. It could be a zip or directory
        var inputModel;

        function processInputSource(inputModel, resultCallback, errorCallback, result, config) {
            inputModel.clearCache();
            inputModel.getCachedEntries(config.InputSource, function (entries) {

                var foundPublicanCfg = false;
                jquery.each(entries, function (index, value) {
                    if (qnautils.getFileName(value) === "publican.cfg") {
                        foundPublicanCfg = value;
                        return false;
                    }
                });

                if (!foundPublicanCfg) {
                    errorCallback("Error", "The selected source location file did not contain a publican.cfg file in the root folder.");
                } else {

                    inputModel.getTextFromFileName(config.InputSource, "publican.cfg", function(publicanCfg) {
                        var dtdVersion = qnautils.getValueFromConfigFile(publicanCfg, "dtdver");
                        if (dtdVersion !== undefined) {
                            config.ImportOption = /('|")5\.0('|")/.test(dtdVersion) ? "DocBook5" : "DocBook45";
                        } else {
                            config.ImportOption = "DocBook45";
                        }

                        var brand = qnautils.getValueFromConfigFile(publicanCfg, "brand");
                        if (brand !== undefined) {
                            config.ImportBrand = brand;
                        }

                        var condition = qnautils.getValueFromConfigFile(publicanCfg, "condition");
                        if (condition !== undefined) {
                            config.ImportCondition = condition;
                        }

                        var lang = qnautils.getValueFromConfigFile(publicanCfg, "xml_lang");
                        if (lang !== undefined) {
                            var langMatch = /[^'"]+/.exec(lang.trim());
                            config.ImportLang = langMatch[0];
                        } else {
                            config.ImportLang = DEFAULT_LANG;
                        }

                        /*
                         Find cfg files and add them to the content spec
                         */
                        var contentSpec = [];
                        var configCount = 1;
                        inputModel.getCachedEntries(config.InputSource, function (entries) {
                            function processEntry(index, callback) {
                                if (index >= entries.length) {
                                    callback();
                                } else {
                                    var entry = entries[index];
                                    var uri = new URI(qnautils.getFileName(entry));
                                    if (/\.cfg$/.test(uri.filename())) {
                                        inputModel.getTextFromFileName(config.InputSource, qnautils.getFileName(entry), function(configFile) {

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
                                                    var keyValue = value.split(":");
                                                    if (IGNORE_PUBLICAN_CFG_SETTINGS.indexOf(keyValue[0].trim()) === -1 ||
                                                        value.indexOf("#") === 0) {
                                                        contentSpec.push(value);
                                                    } else {
                                                        contentSpec.push("#" + value);
                                                    }
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
                resultCallback(config.InputType === "Zip" ? askForPublicanZipFile : askForPublicanDir);
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
                                .setName("InputSource")
                        ])
                ]
            )
            .setProcessStep(function (resultCallback, errorCallback, result, config) {
                if (!config.InputSource) {
                    errorCallback("Please select a file", "You need to select a ZIP file before continuing.");
                } else if (config.InputSource.name.lastIndexOf(".zip") !== config.InputSource.name.length - 4) {
                    errorCallback("Please select a file", "You need to select a ZIP file before continuing.");
                } else {
                    processInputSource(inputModel, resultCallback, errorCallback, result, config);
                }
            })
            .setNextStep(function (resultCallback) {
                resultCallback(askForMainXML);
            })
            .setBackStep(function(resultCallback) {
                if (qnautils.isInputDirSupported()) {
                    resultCallback(exports.askForZipOrDir);
                } else {
                    resultCallback(qnastart.specifyTheServer);
                }
            })
            .setEnterStep(function(resultCallback){
                inputModel = qnastart.zipModel;
                inputModel.clearCache();
                resultCallback(false);
            });

        var askForPublicanDir = new qna.QNAStep()
            .setTitle("Select the directory to import")
            .setIntro("Select the directory that contains the valid Publican book that you wish to import into PressGang CCMS. " +
                "The directory must contain the publican.cfg file.")
            .setInputs(
                [
                    new qna.QNAVariables()
                        .setVariables([
                            new qna.QNAVariable()
                                .setType(qna.InputEnum.DIRECTORY)
                                .setIntro("Publican Directory")
                                .setName("InputSource")
                        ])
                ]
            )
            .setProcessStep(function (resultCallback, errorCallback, result, config) {
                if (!config.InputSource) {
                    errorCallback("Please select a directory", "You need to select a directory before continuing.");
                } else {
                    processInputSource(inputModel, resultCallback, errorCallback, result, config);
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
                                inputModel.getCachedEntries(config.InputSource, function (entries) {
                                    var retValue = [];
                                    var foundDir = false;
                                    jquery.each(entries, function (index, value) {
                                        if (RegExp("^" + qnautils.escapeRegExp(config.ImportLang) + "/$").test(qnautils.getFileName(value))) {
                                            foundDir = true;
                                        } else if (new RegExp("^" + qnautils.escapeRegExp(config.ImportLang) + "/.*?\\.xml$").test(qnautils.getFileName(value))) {
                                            if (!/^tmp\//.test(qnautils.getFileName(value))) {
                                                retValue.push(qnautils.getFileName(value));
                                            }
                                        }
                                    });

                                    if (!foundDir) {
                                        errorCallback("No " + config.ImportLang + " directory found", "The source ZIP file has no " + config.ImportLang + " directory", true);
                                    } else if (retValue.length !== 0) {
                                        resultCallback(retValue);
                                    } else {
                                        errorCallback("No XML files found", "The source ZIP file has no XML files under the " + config.ImportLang + " directory", true);
                                    }
                                });
                            })
                            .setValue(function (resultCallback, errorCallback, result, config) {
                                /*
                                    Look for an option called mainfile which will override the default
                                    main XML file.
                                 */
                                inputModel.getTextFromFileName(
                                    config.InputSource,
                                    "publican.cfg",
                                    function(data) {

                                        function mainFileFallback() {
                                            inputModel.getCachedEntries(config.InputSource, function (entries) {
                                                jquery.each(entries, function (index, value) {
                                                    if (new RegExp("^" + qnautils.escapeRegExp(config.ImportLang) + "/(Book)|(Article)_Info\\.xml$").test(qnautils.getFileName(value))) {
                                                        inputModel.getTextFromFile(value, function (textFile) {
                                                            var match = /<title>(.*?)<\/title>/.exec(textFile);
                                                            if (match) {
                                                                var assumedMainXMLFile = config.ImportLang + "/" + match[1].replace(/ /g, "_") + ".xml";

                                                                jquery.each(entries, function (index, value) {
                                                                    if (qnautils.getFileName(value) === assumedMainXMLFile) {
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

                                        var options = data.split("\n");
                                        var foundMainFile = false;
                                        jquery.each(options, function (index, value) {
                                            var keyValue = value.split(":");
                                            if (keyValue.length === 2 && keyValue[0].trim() === "mainfile") {
                                                var mainFile = config.ImportLang + "/" + keyValue[1].trim();
                                                if (!/\.xml$/.test(mainFile)) {
                                                    mainFile += ".xml";
                                                }

                                                var mainFileExists = false;
                                                inputModel.getCachedEntries(config.InputSource, function (entries) {
                                                    jquery.each(entries, function (index, value) {
                                                        if (qnautils.getFileName(value) === mainFile) {
                                                            resultCallback(mainFile);
                                                            mainFileExists = true;
                                                            return false;
                                                        }
                                                    });

                                                    if (!mainFileExists) {
                                                        mainFileFallback();
                                                    }
                                                });

                                                return false;
                                            }
                                        });

                                        if (!foundMainFile) {
                                            mainFileFallback();
                                        }
                                    },
                                    errorCallback);

                                resultCallback(null);
                            })
                    ])
            ])
            .setProcessStep(function(resultCallback, errorCallback, result, config) {
                if (config.MainXMLFile === null || config.MainXMLFile === undefined || config.MainXMLFile.trim().length === 0 ) {
                    errorCallback("Select a XML file", "Please select the main XML file before continuing");
                } else {
                    resultCallback();
                }
            })
            .setNextStep(function (resultCallback) {
                resultCallback(docbookimport.askForRevisionMessage);
            });
    }
);