define(
    ['zip', 'jquery', 'qna/qna', 'qna/qnazipmodel', 'qna/qnadirmodel', 'qna/qnautils', 'restcalls', 'publicanimport', 'generaldocbookimport', 'generalexternalimport', 'constants', 'asciidocimport', 'reportsettings', 'exports'],
    function (zip, jquery, qna, qnazipmodel, qnadirmodel, qnautils, restcalls, publicanimport, generaldocbookimport, generalexternalimport, constants, asciidocimport, reportsettings, exports) {
        'use strict';

        var RETRY_COUNT = 5;
        
        // a zip model to be shared
        exports.zipModel = new qnazipmodel.QNAZipModel();
        exports.dirModel = new qnadirmodel.QNADirModel();

        exports.identifyOutgoingLinks = function (topicGraph) {
            var retValue = "";

            var processXPath = function (path, topic) {
                var elements = qnautils.xPath(path, topic.xml);
                var element = null;
                while ((element = elements.iterateNext()) !== null) {
                    var link = "";
                    if (element.hasAttribute("url")) {
                        link = element.getAttribute("url");
                    } else if (element.hasAttribute("href")) {
                        link = element.getAttribute("href");
                    }

                    var matches = true;
                    jquery.each(reportsettings.ALLOWED_URLS, function (index, value) {
                        if (!value.test(link)) {
                            matches = false;
                            return false;
                        }
                    });

                    if (!matches && retValue.indexOf(topic.topicId) == -1) {
                        if (retValue.length !== 0) {
                            retValue += ",";
                        }
                        retValue += topic.topicId;
                    }
                }
            }

            jquery.each(topicGraph.nodes, function (index, value) {
                processXPath(".//docbook:ulink[@url]|.//docbook:link[@href]", value);
                processXPath(".//docbook:link[@xlink:href]", value);
            });

            return retValue;
        }

        exports.getInputModel = function(config) {
            if (config.ImportOption === "OpenDocument") {
                return exports.zipModel;
            }

            if (config.InputType === "Dir") {
                return exports.dirModel;
            }

            if (config.InputType === "Zip") {
                return exports.zipModel;
            }

            return null;
        }

        exports.loadEntityID = function (type) {
            if (restcalls.configEntites !== null) {
                return  restcalls.configEntites.entities[type]  ;
            }

            return null;
        };

        exports.loadLocales = function () {
            if (restcalls.configEntites !== null) {
                return restcalls.configEntites.locales;
            }

            return null;
        };

        exports.escapeSpecTitle = function (title) {
            return title.replace(/\[/g, "\\[")
                .replace(/\]/g, "\\]");
        };

        exports.qnastart = new qna.QNAStep()
            .setTitle("Select import source")
            .setIntro("You can import an existing Publican DocBook archive, an OpenDocument file, or a general DocBook 4.5 or 5.0 archive.")
            .setInputs(
                [
                    new qna.QNAVariables()
                        .setVariables([
                            new qna.QNAVariable()
                                .setType(qna.InputEnum.RADIO_BUTTONS)
                                .setIntro(["Publican", "DocBook 4.5", "DocBook 5.0", "OpenDocument", "Mojo", "Asciidoc (Experimental, and can crash the browser)"])
                                .setOptions(["Publican", constants.DOCBOOK_45_IMPORT_OPTION, constants.DOCBOOK_50_IMPORT_OPTION, "OpenDocument", "Mojo", "Asciidoc"])
                                .setValue("Publican")
                                .setName("ImportOption")
                        ])
                    /*new qna.QNAVariables()
                        .setVariables([
                            new qna.QNAVariable()
                                .setType(qna.InputEnum.RADIO_BUTTONS)
                                .setIntro(["Publican", "DocBook 4.5", "DocBook 5.0", "OpenDocument", "Mojo"])
                                .setOptions(["Publican", constants.DOCBOOK_45_IMPORT_OPTION, constants.DOCBOOK_50_IMPORT_OPTION, "OpenDocument", "Mojo"])
                                .setValue("Publican")
                                .setName("ImportOption")
                        ])*/
                ]
            )
            .setNextStep(function (resultCallback, errorCallback, result, config) {
                if (config.ImportOption === "Mojo" && window.greaseMonkeyShare === undefined) {
                    resultCallback(reportNoUserScript);
                } else {
                    resultCallback(askToCreateNewSpecOrOverwriteExistingOne);
                }
            });

        var reportNoUserScript = new qna.QNAStep()
            .setTitle("Install the user script")
            .setOutputs(
                [
                    new qna.QNAVariables()
                        .setVariables([
                            new qna.QNAVariable()
                                .setType(qna.InputEnum.HTML)
                                .setValue("To continue you need to install the PressGang Import Tool user script.<br/>" +
                                            "Firefox users will need to install the <a href='https://addons.mozilla.org/en-US/firefox/addon/greasemonkey/'>GreaseMonkey</a> addon.<br/>" +
                                            "Chrome users will need to install the <a href='https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo?hl=en'>Tampermonkey</a> extension<br/>" +
                                            "Then click <a href='js/pgimport.user.js'>here</a> to install the user script.<br/>" +
                                            "Once the user script is installed, refresh the page to ensure it is active.")
                        ])
                ]
            )
            .setShowNext(false)
            .setShowPrevious(false);



        /*
         Step 3 - Ask about creating a new spec or overwriting an old one
         */
        var askToCreateNewSpecOrOverwriteExistingOne = new qna.QNAStep()
            .setTitle("Create or overwrite a content spec?")
            .setIntro("This wizard can create a new content specification, or overwrite the contents of an existing one. " +
                "You will usually want to create a new content specification, but if you are reimporting a book and want to overwrite the previously imported content spec, " +
                "select the overwrite option.")
            .setInputs([
                new qna.QNAVariables()
                    .setVariables([
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.RADIO_BUTTONS)
                            .setIntro(["Create a new content spec", "Overwrite an existing content spec"])
                            .setName(constants.CREATE_OR_OVERWRITE_CONFIG_KEY)
                            .setOptions([constants.CREATE_SPEC, constants.OVERWRITE_SPEC])
                            .setValue(constants.CREATE_SPEC)
                    ])
            ])
            .setNextStep(function (resultCallback, errorCallback, result, config) {
                resultCallback(config.CreateOrOverwrite === constants.CREATE_SPEC ? askToReuseTopics : getExistingContentSpecID);
            });

        var getExistingContentSpecID = new qna.QNAStep()
            .setTitle("Specify the ID of the content specification to overwrite")
            .setInputs([
                new qna.QNAVariables()
                    .setVariables([
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.TEXTBOX)
                            .setIntro("Existing content specification ID")
                            .setName(constants.EXISTING_CONTENT_SPEC_ID)
                    ])
            ])
            .setProcessStep(function (resultCallback, errorCallback, result, config) {
                if (!/\d+/.test(config[constants.EXISTING_CONTENT_SPEC_ID])) {
                    errorCallback("Invalid Content Specification ID", "You need to enter a valid content specification id. The ID is a sequence of numbers, like 12321.");
                } else {
                    resultCallback(null);
                }
            })
            .setNextStep(function (resultCallback, errorCallback, result, config) {
                resultCallback(askToReuseTopics);
            });

        /*
         Step 3 - Ask about creating a new spec or overwriting an old one
         */
        var askToReuseTopics = new qna.QNAStep()
            .setTitle("Do you want to reuse existing topics and images?")
            .setIntro(function (resultCallback, errorCallback, result, config) {
                if (config[constants.CREATE_OR_OVERWRITE_CONFIG_KEY] === constants.OVERWRITE_SPEC) {
                    resultCallback("This wizard can update the contents of any similar topics already referenced by the content specification "
                        + config[constants.EXISTING_CONTENT_SPEC_ID] + ". This is useful when importing updated external content over a previously imported content specification. " +
                        "You also have the choice to reuse any images and files that exactly match those that are being imported. " +
                        "It is highly recommended that you reuse existing topics, images and files.");
                } else {
                    resultCallback("This wizard can attempt to reuse any existing topics whose contents and xref relationships match those defined in the imported content. " +
                        "You also have the choice to reuse any images and files that exactly match those that are being imported. " +
                        "It is highly recommended that you reuse existing topics, images and files.");
                }
            })
            .setInputs([
                new qna.QNAVariables()
                    .setVariables([
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.RADIO_BUTTONS)
                            .setIntro(["Reuse existing topics", "Create new topics"])
                            .setName("CreateOrResuseTopics")
                            .setOptions(["REUSE", "CREATE"])
                            .setValue("REUSE"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.RADIO_BUTTONS)
                            .setIntro(["Reuse existing images", "Create new images"])
                            .setName("CreateOrResuseImages")
                            .setOptions(["REUSE", "CREATE"])
                            .setValue("REUSE"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.RADIO_BUTTONS)
                            .setIntro(["Reuse existing files", "Create new files"])
                            .setName("CreateOrResuseFiles")
                            .setOptions(["REUSE", "CREATE"])
                            .setValue("REUSE")
                    ])
            ])
            .setNextStep(function (resultCallback, errorCallback, result, config) {
                resultCallback(specifyTheServer);
            });

        /*
         Ask which server this is being uploaded to
         */
        var specifyTheServer = new qna.QNAStep()
            .setTitle("Select the server to import in to")
            /*.setIntro("You can create the imported content specification on either the production or test PressGang servers. " +
                "Using the test server is recommended for the first import to check the results before adding the content to the production server.")*/
            .setIntro("During the alpha you can only import content into the test server. Future releases will allow content to be imported into the production server as well.")
            .setInputs([
                new qna.QNAVariables()
                    /*.setVariables([
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.RADIO_BUTTONS)
                            .setIntro(["Production Server", "Test Server"])
                            .setOptions(["skynet.usersys.redhat.com", "skynet-dev.usersys.redhat.com"])
                            .setValue("skynet-dev.usersys.redhat.com")
                            .setName("PressGangHost")
                    ])*/
                    .setVariables([
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.RADIO_BUTTONS)
                            .setIntro(["Test Server", "LocalHost"])
                            .setOptions(["skynet-dev.usersys.redhat.com", "localhost"])
                            .setValue("skynet-dev.usersys.redhat.com")
                            .setName("PressGangHost")
                    ])
            ])
            .setProcessStep(function (resultCallback, errorCallback, result, config) {
                if (config.PressGangHost === undefined) {
                    errorCallback("Please select a server", "You need to select a server to import in to before continuing.")
                } else {
                    resultCallback();
                }
            })
            .setNextStep(function (resultCallback, errorCallback, result, config) {
                restcalls.loadEntityConfig(
                    config,
                    function() {
                        if (config.ImportOption === "Publican") {
                            if (qnautils.isInputDirSupported()) {
                                resultCallback(publicanimport.askForZipOrDir);
                            } else {
                                resultCallback(publicanimport.askForPublicanZipFile);
                            }
                        } else if (config.ImportOption === constants.DOCBOOK_50_IMPORT_OPTION || config.ImportOption === constants.DOCBOOK_45_IMPORT_OPTION) {
                            resultCallback(generaldocbookimport.askForZipOrDir);
                        } else if (config.ImportOption === "Mojo" || config.ImportOption === "OpenDocument") {
                            resultCallback(generalexternalimport.getSpecDetails);
                        } else if (config.ImportOption === "Asciidoc") {
                            resultCallback(asciidocimport.getTopicLevelContainer);
                        }
                    },
                    errorCallback
                );
            });

    }
);
