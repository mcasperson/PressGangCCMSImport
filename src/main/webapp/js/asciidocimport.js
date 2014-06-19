define(
    ['jquery', 'qna/qna', 'qnastart', 'qna/qnautils', 'uri/URI', 'docbookimport', 'processasciidoc', 'processxml', /*'opal', 'asciidoctor',*/ 'constants', 'exports'],
    function (jquery, qna, qnastart, qnautils, URI, docbookimport, processasciidoc, processxml, /*opal, asciidoctor,*/ constants, exports) {
        'use strict';

        var IGNORED_FILE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "svg"];

        // This will be the object that we query for files. It could be a zip or directory
        var inputModel;

        exports.getTopicLevelContainer = new qna.QNAStep()
            .setTitle("Do you want a book or article?")
            .setIntro("The content specification can either be a book or an article.")
            .setInputs(
            [
                new qna.QNAVariables()
                    .setVariables([
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.RADIO_BUTTONS)
                            .setIntro(["Book", "Article"])
                            .setOptions([constants.CHAPTER_TOP_LEVEL_CONTAINER, constants.SECTION_TOP_LEVEL_CONTAINER])
                            .setValue(constants.CHAPTER_TOP_LEVEL_CONTAINER)
                            .setName(constants.TOP_LEVEL_CONTAINER)
                    ])
            ]
        )
        .setNextStep(function (resultCallback, errorCallback, result, config) {
                if (qnautils.isInputDirSupported()) {
                    resultCallback(askForZipOrDir);
                } else {
                    resultCallback(askForAsciidocZipFile);
                }
        });

         var askForZipOrDir = new qna.QNAStep()
            .setTitle("Select the source of the content to import")
            .setIntro("You can import from a ZIP file or from a local directory.")
            .setInputs([
                new qna.QNAVariables()

                    .setVariables([
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.RADIO_BUTTONS)
                            .setIntro(["Zip File", "Zip URL", "Directory"])
                            .setOptions(["Zip", "ZipURL", "Dir"])
                            .setValue("Dir")
                            .setName("InputType")
                    ])
            ])
            .setNextStep(function (resultCallback, errorCallback, result, config) {
                if (config.InputType === "Zip") {
                    resultCallback(askForAsciidocZipFile);
                } else if (config.InputType === "ZipURL") {
                    resultCallback(askForAsciidocZipUrl);
                } else {
                    resultCallback(askForAsciidocDir);
                }
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
        var askForAsciidocZipFile = new qna.QNAStep()
            .setTitle("Select the ZIP file to import")
            .setIntro("Select the ZIP file that contains the Asciidoc content that you wish to import into PressGang CCMS.")
            .setInputs(
            [
                new qna.QNAVariables()
                    .setVariables([
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.SINGLE_FILE)
                            .setIntro("Asciidoc ZIP File")
                            .setName("InputSource")
                            .setOptions("application/zip")
                    ])
            ]
        )
        .setProcessStep(function (resultCallback, errorCallback, result, config) {
            if (!config.InputSource) {
                errorCallback("Please select a file", "You need to select a ZIP file before continuing.");
            } else if (config.InputSource.name.lastIndexOf(".zip") !== config.InputSource.name.length - 4) {
                errorCallback("Please select a file", "You need to select a ZIP file before continuing.");
            } else {
                config.InputType = "Zip";
                resultCallback();
            }
        })
        .setNextStep(function (resultCallback) {
            resultCallback(askForMainXML);
        })
        .setEnterStep(function(resultCallback, errorCallback, result, config){
            inputModel = qnastart.zipModel;
            inputModel.clearCache();
            config.InputSource = undefined;
            resultCallback(false);
        });

        var askForAsciidocDir = new qna.QNAStep()
            .setTitle("Select the directory to import")
            .setIntro("Select the directory that contains the Asciidoc content that you wish to import into PressGang CCMS.")
            .setInputs(
            [
                new qna.QNAVariables()
                    .setVariables([
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.DIRECTORY)
                            .setIntro("Asciidoc Directory")
                            .setName("InputSource")
                    ])
            ]
        )
        .setProcessStep(function (resultCallback, errorCallback, result, config) {
            if (!config.InputSource) {
                errorCallback("Please select a directory", "You need to select a directory before continuing.");
            } else {
                resultCallback();
            }
        })
        .setNextStep(function (resultCallback) {
            resultCallback(askForMainXML);
        })
        .setEnterStep(function(resultCallback, errorCallback, result, config){
            inputModel = qnastart.dirModel;
            inputModel.clearCache();
            config.InputSource = undefined;
            resultCallback(false);
        })
        .setBackStep(function(resultCallback, errorCallback, result, config) {
            config.InputSource = undefined;
            resultCallback(exports.askForZipOrDir);
        });

        var askForAsciidocZipUrl = new qna.QNAStep()
            .setTitle("Enter the URL to the ZIP file to import")
            .setIntro("Enter the URL that references the Asciidoc ZIP archive that you wish to import into PressGang CCMS. \
                Note that the server hosting the file needs to allow cross domain access in order for the import tool to \
                be able to download it. If an error is reported that the file can not be accessed, even if the URL works when \
                entered directly into the browser's address bar, there is a good chance that the remote server doesn't allow \
                cross domain access.")
            .setInputs(
                [
                    new qna.QNAVariables()
                        .setVariables([
                            new qna.QNAVariable()
                                .setType(qna.InputEnum.TEXTBOX)
                                .setIntro("Asciidoc ZIP URL")
                                .setName("SourceURL")
                                .setValue("asciidoc-test.zip")
                        ])
                ]
            )
            .setProcessStep(function (resultCallback, errorCallback, result, config) {
                if (!config.SourceURL) {
                    errorCallback("Please specify a URL", "You need to specify a URL before continuing.");
                } else {

                    var xhr = new XMLHttpRequest();
                    xhr.open('GET', config.SourceURL, true);
                    xhr.responseType = 'blob';

                    xhr.onload = function(e) {
                        if (this.readyState == 4) {
                            if (this.status == 200) {
                                config.InputSource = this.response;
                                resultCallback();
                            } else {
                                errorCallback("Error loading file", "The selected file could not be accessed. \
                                    It either does not exist, or the server hosting the file does not allow cross domain access.");
                            }
                        }
                    };

                    xhr.onerror = function(e) {
                        errorCallback("Error loading file", "The selected file could not be accessed. \
                                    It either does not exist, or the server hosting the file does not allow cross domain access.");
                    }

                    xhr.send();
                }
            })
            .setNextStep(function (resultCallback) {
                resultCallback(askForMainXML);
            })
            .setEnterStep(function(resultCallback, errorCallback, result, config){
                inputModel = qnastart.zipModel;
                inputModel.clearCache();
                config.InputSource = undefined;
                resultCallback(false);
            })
            .setBackStep(function(resultCallback, errorCallback, result, config) {
                config.InputSource = undefined;
                resultCallback(exports.askForZipOrDir);
            });


        /*
         STEP 2 - Get the main XML file
         */
        var askForMainXML = new qna.QNAStep()
            .setTitle("Select the main Asciidoc file")
            .setIntro("Select the main Asciidoc file from the selected location.")
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
                                        var file = new URI(filename);
                                        if (IGNORED_FILE_EXTENSIONS.indexOf(file.suffix()) === -1 &&
                                            file.filename().length !== 0) {
                                            retValue.push(filename);
                                        }
                                    });

                                    resultCallback(retValue);
                                });
                            })
                    ])
            ])
            .setProcessStep(function(resultCallback, errorCallback, result, config) {
                if (config.MainFile === null || config.MainFile === undefined || config.MainFile.trim().length === 0 ) {
                    errorCallback("Select a XML file", "Please select the main Asciidoc file before continuing");
                } else {
                    /*
                     Process the xml and extract the entities
                     */
                    processasciidoc.processAsciidocImports(
                        function(asciidocText) {
                            var doctype = config[constants.TOP_LEVEL_CONTAINER] === constants.CHAPTER_TOP_LEVEL_CONTAINER ? 'book' : 'article';
                            var asciidocOpts = Opal.hash2(['attributes'], {'attributes': ['backend=docbook45', 'doctype=' + doctype]});
                            var docbook = "<" + doctype + ">" + Opal.Asciidoctor.opal$render(asciidocText, asciidocOpts) + "</" + doctype + ">";

                            processxml.processXMLAndExtractEntities(
                                function (result) {
                                    jquery.extend(config, result.config);
                                    resultCallback(JSON.stringify(result));
                                },
                                errorCallback,
                                docbook,
                                config,
                                false
                            );
                        },
                        errorCallback,
                        config
                    )

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
                            .setIntro("Title")
                            .setName("ContentSpecTitle")
                            .setValue(function (resultCallback, errorCallback, result, config) {
                                resultCallback(config.ContentSpecTitle ? config.ContentSpecTitle : "Title");
                            }),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.TEXTBOX)
                            .setIntro("Subtitle")
                            .setName("ContentSpecSubtitle")
                            .setValue(function (resultCallback, errorCallback, result, config) {
                                resultCallback(config.ContentSpecSubtitle ? config.ContentSpecSubtitle : "SubTitle");
                            }),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.TEXTBOX)
                            .setIntro("Product")
                            .setName("ContentSpecProduct")
                            .setValue(function (resultCallback, errorCallback, result, config) {
                                resultCallback(config.ContentSpecProduct ? config.ContentSpecProduct : "Product");
                            }),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.TEXTBOX)
                            .setIntro("Version")
                            .setName("ContentSpecVersion")
                            .setValue(function (resultCallback, errorCallback, result, config) {
                                resultCallback(config.ContentSpecVersion ? config.ContentSpecVersion : "1");
                            }),
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
)