define(
    ['zip', 'jquery', 'qna/qna', 'qna/qnazipmodel', 'qna/qnadirmodel', 'qna/qnautils', 'publicanimport', 'generaldocbookimport', 'generalexternalimport', 'exports'],
    function (zip, jquery, qna, qnazipmodel, qnadirmodel, qnautils, publicanimport, generaldocbookimport, generalexternalimport, exports) {
        'use strict';

        var RETRY_COUNT = 5;
        
        // a zip model to be shared
        exports.zipModel = new qnazipmodel.QNAZipModel();
        exports.dirModel = new qnadirmodel.QNADirModel();

        exports.loadEntityID = function (type, config, successCallback, errorCallback, retryCount) {

            if (retryCount === undefined) {
                retryCount = 0;
            }

            jquery.ajax({
                type: 'GET',
                url: 'http://' + config.PressGangHost + ':8080/pressgang-ccms/rest/1/settings/get/json',
                dataType: "json",
                success: function (data) {
                    if (data.entities[type] !== undefined) {
                        successCallback(data.entities[type]);
                    } else {
                        errorCallback("Invalid Option", "The type " + type + " is not defined in the server settings", true);
                    }
                },
                error: function () {
                    if (retryCount < RETRY_COUNT) {
                        exports.loadTagID(type, successCallback, errorCallback, ++retryCount);
                    } else {
                        errorCallback("Connection Error", "An error occurred while getting the server settings. This may be caused by an intermittent network failure. Try your import again, and if problem persist log a bug.", true);
                    }
                }
            });
        };

        exports.escapeSpecTitle = function (title) {
            return title.replace(/\[/g, "\\[")
                .replace(/\]/g, "\\]");
        };

        exports.createTopic = function(tryToMatch, format, xml, title, tags, lang, config, successCallback, errorCallback, retryCount) {

            if (retryCount === undefined) {
                retryCount = 0;
            }

            var postBody = {
                xml: xml,
                locale: lang,
                configuredParameters: [
                    "xml",
                    "locale"
                ]
            };

            if (format === 4.5) {
                postBody.xmlFormat = "DOCBOOK_45";
                postBody.configuredParameters.push("format");
            } else if (format === 5.0) {
                postBody.xmlFormat = "DOCBOOK_50";
                postBody.configuredParameters.push("format");
            }

            if (title) {
                postBody.title = title;
                postBody.description = title;
                postBody.configuredParameters.push("title");
                postBody.configuredParameters.push("description");
            }

            if (tags) {
                postBody.tags = {
                    items: []
                };
                postBody.configuredParameters.push("tags");

                jquery.each(tags, function (index, value) {
                    postBody.tags.items.push({
                        item: {
                            id: value
                        },
                        state: 1
                    });
                });
            }

            jquery.ajax({
                type: 'POST',
                url: 'http://' + config.PressGangHost + ':8080/pressgang-ccms/rest/1/topic/' + (tryToMatch ? 'createormatch' : 'create') + '/json?message=' + encodeURIComponent(config.RevisionMessage) + '&flag=2&userId=89',
                data: JSON.stringify(postBody),
                contentType: "application/json",
                dataType: "json",
                success: function (data) {
                    successCallback(data);
                },
                error: function () {
                    if (retryCount < RETRY_COUNT) {
                        exports.createTopic(tryToMatch, format, xml, title, tags, lang, config, successCallback, errorCallback, ++retryCount);
                    } else {
                        errorCallback("Connection Error", "An error occurred while uploading the topic. This may be caused by an intermittent network failure. Try your import again, and if problem persist log a bug.", true);
                    }
                }
            });
        };

        exports.getSimilarTopics = function(xml, config, successCallback, errorCallback, retryCount) {
            if (retryCount === undefined) {
                retryCount = 0;
            }

            jquery.ajax({
                type: 'POST',
                url: 'http://' + config.PressGangHost + ':8080/pressgang-ccms/rest/1/minhashsimilar/get/json?threshold=0.6&expand=%7B%22branches%22%3A%5B%7B%22trunk%22%3A%7B%22name%22%3A%20%22topics%22%7D%7D%5D%7D',
                data: xml,
                contentType: "application/xml",
                dataType: "json",
                success: function (data) {
                    successCallback(data);
                },
                error: function () {
                    if (retryCount < RETRY_COUNT) {
                        exports.getSimilarTopics(xml, config, successCallback, errorCallback, ++retryCount);
                    } else {
                        errorCallback("Connection Error", "An error occurred while getting similar topics. This may be caused by an intermittent network failure. Try your import again, and if problem persist log a bug.", true);
                    }
                }
            });
        };

        exports.updateTopic = function(id, xml, title, config, successCallback, errorCallback, retryCount) {
            if (retryCount === undefined) {
                retryCount = 0;
            }

            var postBody = {
                id: id,
                xml: xml,
                configuredParameters: [
                    "xml"
                ]
            };

            if (title) {
                postBody.title = title;
                postBody.description = title;
                postBody.configuredParameters.push("title");
                postBody.configuredParameters.push("description");
            }

            jquery.ajax({
                type: 'POST',
                url: 'http://' + config.PressGangHost + ':8080/pressgang-ccms/rest/1/topic/update/json',
                data: JSON.stringify(postBody),
                contentType: "application/json",
                dataType: "json",
                success: function (data) {
                    successCallback(data.id);
                },
                error: function () {
                    if (retryCount < RETRY_COUNT) {
                        exports.updateTopic(id, xml, title, config, successCallback, errorCallback, ++retryCount);
                    } else {
                        errorCallback("Connection Error", "An error occurred while uploading a topic. This may be caused by an intermittent network failure. Try your import again, and if problem persist log a bug.", true);
                    }
                }
            });
        };

        exports.createFile = function(model, trytomatch, zipfile, file, filename, filepath, lang, config, successCallback, errorCallback, retryCount) {
            if (retryCount === undefined) {
                retryCount = 0;
            }

            model.getByteArrayFromFileName(
                zipfile,
                file,
                function (arrayBuffer) {

                    var byteArray = [];
                    var view = new Uint8Array(arrayBuffer);
                    for (var i = 0; i < view.length; ++i) {
                        byteArray.push(view[i]);
                    }

                    var postBody = {
                        description: filename,
                        fileName: filename,
                        filePath: filepath,
                        languageFiles_OTM: {
                            items: [
                                {
                                    item: {
                                        fileData: byteArray,
                                        locale: lang,
                                        filename: filename,
                                        configuredParameters: [
                                            "locale",
                                            "fileData",
                                            "filename"
                                        ]
                                    },
                                    state: 1
                                }
                            ]
                        },
                        configuredParameters: [
                            "description",
                            "languageFiles_OTM",
                            "fileName",
                            "filePath"
                        ]
                    };

                    jquery.ajax({
                        type: 'POST',
                        url: 'http://' + config.PressGangHost + ':8080/pressgang-ccms/rest/1/file/' + (trytomatch ? 'createormatch' : 'create') + '/json?message=' + encodeURIComponent(config.RevisionMessage) + '&flag=2&userId=89',
                        data: JSON.stringify(postBody),
                        contentType: "application/json",
                        dataType: "json",
                        success: function (data) {
                            successCallback(data);
                        },
                        error: function () {
                            if (retryCount < RETRY_COUNT) {
                                exports.createFile(inputModel, trytomatch, zipfile, file, lang, config, successCallback, errorCallback, ++retryCount);
                            } else {
                                errorCallback("Connection Error", "An error occurred while uploading an file. This may be caused by an intermittent network failure. Try your import again, and if problem persist log a bug.", true);
                            }

                        }
                    });
                },
                errorCallback,
                true
            );
        };

        exports.createImage = function(model, trytomatch, zipfile, image, lang, config, successCallback, errorCallback, retryCount) {
            if (retryCount === undefined) {
                retryCount = 0;
            }

            model.getByteArrayFromFileName(
                zipfile,
                image,
                function (arrayBuffer) {

                    var byteArray = [];
                    var view = new Uint8Array(arrayBuffer);
                    for (var i = 0; i < view.length; ++i) {
                        byteArray.push(view[i]);
                    }

                    var postBody = {
                        description: image,
                        languageImages_OTM: {
                            items: [
                                {
                                    item: {
                                        imageData: byteArray,
                                        locale: lang,
                                        filename: image,
                                        configuredParameters: [
                                            "locale",
                                            "imageData",
                                            "filename"
                                        ]
                                    },
                                    state: 1
                                }
                            ]
                        },
                        configuredParameters: [
                            "description",
                            "languageImages"
                        ]
                    };

                    jquery.ajax({
                        type: 'POST',
                        url: 'http://' + config.PressGangHost + ':8080/pressgang-ccms/rest/1/image/' + (trytomatch ? 'createormatch' : 'create') + '/json?message=' + encodeURIComponent(config.RevisionMessage) + '&flag=2&userId=89',
                        data: JSON.stringify(postBody),
                        contentType: "application/json",
                        dataType: "json",
                        success: function (data) {
                            successCallback(data);
                        },
                        error: function () {
                            if (retryCount < RETRY_COUNT) {
                                exports.createImage(inputModel, trytomatch, zipfile, image, lang, config, successCallback, errorCallback, ++retryCount);
                            } else {
                                errorCallback("Connection Error", "An error occurred while uploading an image. This may be caused by an intermittent network failure. Try your import again, and if problem persist log a bug.", true);
                            }

                        }
                    });
                },
                errorCallback,
                true
            );
        };

        exports.createImageFromURL = function(trytomatch, url, lang, config, successCallback, errorCallback, retryCount) {
            if (retryCount === undefined) {
                retryCount = 0;
            }

            greaseMonkeyShare.getMojoImage(
                url,
                function(byteArray) {
                    var postBody = {
                        description: url,
                        languageImages_OTM: {
                            items: [
                                {
                                    item: {
                                        imageData: byteArray,
                                        locale: lang,
                                        filename: url,
                                        configuredParameters: [
                                            "locale",
                                            "imageData",
                                            "filename"
                                        ]
                                    },
                                    state: 1
                                }
                            ]
                        },
                        configuredParameters: [
                            "description",
                            "languageImages"
                        ]
                    };

                    jquery.ajax({
                        type: 'POST',
                        url: 'http://' + config.PressGangHost + ':8080/pressgang-ccms/rest/1/image/' + (trytomatch ? 'createormatch' : 'create') + '/json?message=' + encodeURIComponent(config.RevisionMessage) + '&flag=2&userId=89',
                        data: JSON.stringify(postBody),
                        contentType: "application/json",
                        dataType: "json",
                        success: function (data) {
                            successCallback(data);
                        },
                        error: function () {
                            if (retryCount < RETRY_COUNT) {
                                exports.createImageFromURL(trytomatch, url, lang, config, successCallback, errorCallback, ++retryCount);
                            } else {
                                errorCallback("Connection Error", "An error occurred while uploading an image. This may be caused by an intermittent network failure. Try your import again, and if problem persist log a bug.", true);
                            }

                        }
                    });
                },
                errorCallback
            );
        };

        exports.createContentSpec = function(spec, lang, config, successCallback, errorCallback, retryCount) {
            if (retryCount === undefined) {
                retryCount = 0;
            }

            var postBody = {
                text: spec,
                locale: lang,
                configuredParameters: [
                    "text",
                    "locale"
                ]
            };

            jquery.ajax({
                type: 'POST',
                url: 'http://' + config.PressGangHost + ':8080/pressgang-ccms/rest/1/contentspec/create/json+text?message=' + encodeURIComponent(config.RevisionMessage) + '&flag=2&userId=89',
                data: JSON.stringify(postBody),
                contentType: "application/json",
                dataType: "json",
                success: function (data) {
                    successCallback(data.id);
                },
                error: function () {
                    if (retryCount < RETRY_COUNT) {
                        exports.createContentSpec(spec, lang, config, successCallback, errorCallback, ++retryCount);
                    } else {
                        errorCallback("Connection Error", "An error occurred while uploading the content spec. This may be caused by an intermittent network failure. Try your import again, and if problem persist log a bug.", true);
                    }
                   
                }
            });
        };

        exports.updateContentSpec = function(id, spec, config, successCallback, errorCallback, retryCount) {
            if (retryCount === undefined) {
                retryCount = 0;
            }
            
            var postBody = {
                id: id,
                text: "ID = " + id + "\n" + spec,
                configuredParameters: [
                    "text"
                ]
            };

            jquery.ajax({
                type: 'POST',
                url: 'http://' + config.PressGangHost + ':8080/pressgang-ccms/rest/1/contentspec/update/json+text/?message=' + encodeURIComponent(config.RevisionMessage) + '&flag=2&userId=89',
                data: JSON.stringify(postBody),
                contentType: "application/json",
                dataType: "json",
                success: function (data) {
                    successCallback(data.id);
                },
                error: function () {
                    if (retryCount < RETRY_COUNT) {
                        exports.updateContentSpec(id, spec, config, successCallback, errorCallback, ++retryCount);
                    } else {
                        errorCallback("Connection Error", "An error occurred while uploading the content spec. This may be caused by an intermittent network failure. Try your import again, and if problem persist log a bug.", true);
                    }
                    
                }
            });
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
                                .setIntro(["Publican", "Docbook 4.5", "DocBook 5.0", "OpenDocument", "Mojo"])
                                .setOptions(["Publican", "DocBook45", "DocBook5", "OpenDocument", "Mojo"])
                                .setValue("Publican")
                                .setName("ImportOption")
                        ])
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
                            .setName("CreateOrOverwrite")
                            .setOptions(["CREATE", "OVERWRITE"])
                            .setValue("CREATE")
                    ])
            ])
            .setNextStep(function (resultCallback, errorCallback, result, config) {
                resultCallback(config.CreateOrOverwrite === "CREATE" ? askToReuseTopics : getExistingContentSpecID);
            });

        var getExistingContentSpecID = new qna.QNAStep()
            .setTitle("Specify the ID of the content specification to overwrite")
            .setInputs([
                new qna.QNAVariables()
                    .setVariables([
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.TEXTBOX)
                            .setIntro("Existing content specification ID")
                            .setName("ExistingContentSpecID")
                    ])
            ])
            .setProcessStep(function (resultCallback, errorCallback, result, config) {
                if (!/\d+/.test(config.ExistingContentSpecID)) {
                    errorCallback("Invalid Content Specification ID", "You need to enter a valid content specification id. The ID is a sequence of numbers, like 12321.");
                } else {
                    resultCallback(null);
                }
            })
            .setNextStep(function (resultCallback) {
                resultCallback(askToReuseTopics);
            });

        /*
         Step 3 - Ask about creating a new spec or overwriting an old one
         */
        var askToReuseTopics = new qna.QNAStep()
            .setTitle("Do you want to reuse existing topics and images?")
            .setIntro("This wizard can attempt to reuse any existing topics whose contents and xref relationships match those defined in the imported content. " +
                "You also have the choice to reuse any images and files that exactly match those that are being imported. " +
                "It is highly recommended that you reuse existing topics, images and files.")
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
                resultCallback(exports.specifyTheServer);
            });

        /*
         Ask which server this is being uploaded to
         */
        exports.specifyTheServer = new qna.QNAStep()
            .setTitle("Select the server to import in to")
            /*.setIntro("You can create the imported content specification on either the production or test PressGang servers. " +
                "Using the test server is recommended for the first import to check the results before adding the content to the production server.")*/
            .setIntro("During the alpha you can only import content into the test server. Future releases will allow content to be imported into the production server as well.")
            .setInputs([
                new qna.QNAVariables()
                    .setVariables([
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.RADIO_BUTTONS)
                            .setIntro(["Production Server", "Test Server", "Local Server"])
                            .setOptions(["skynet.usersys.redhat.com", "skynet-dev.usersys.redhat.com", "localhost"])
                            .setValue("localhost")
                            .setName("PressGangHost")
                    ])
                    /*.setVariables([
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.RADIO_BUTTONS)
                            .setIntro(["Test Server"])
                            .setOptions(["skynet-dev.usersys.redhat.com"])
                            .setValue("skynet-dev.usersys.redhat.com")
                            .setName("PressGangHost")
                    ])*/
            ])
            .setNextStep(function (resultCallback, errorCallback, result, config) {
                if (config.ImportOption === "Publican") {
                    resultCallback(publicanimport.askForZipOrDir);
                } else if (config.ImportOption === "DocBook5" || config.ImportOption === "DocBook45") {
                    resultCallback(generaldocbookimport.askForZipOrDir);
                } else if (config.ImportOption === "Mojo" || config.ImportOption === "OpenDocument") {
                    resultCallback(generalexternalimport.getSpecDetails);
                }
            });

    }
);