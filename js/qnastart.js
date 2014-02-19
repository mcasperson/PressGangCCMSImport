define(
    ['zip', 'jquery', 'qna/qna', 'qna/qnazipmodel', 'qna/qnautils', 'publicanimport', 'opendocumentimport', 'generaldocbookimport', 'exports'],
    function (zip, jquery, qna, qnazipmodel, qnautils, publicanimport, opendocumentimport, generaldocbookimport, exports) {
        'use strict';

        // a zip model to be shared
        exports.zipModel = new qnazipmodel.QNAZipModel();

        exports.escapeSpecTitle = function (title) {
            return title.replace(/\[/g, "\\[")
                .replace(/\]/g, "\\]");
        };

        exports.createTopic = function(tryToMatch, format, xml, title, tags, config, successCallback, errorCallback) {

            var postBody = {
                xml: xml,
                locale: "en-US",
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
                    errorCallback("Connection Error", "An error occurred while uploading the topic.");
                }
            });
        };

        exports.getSimilarTopics = function(xml, config, successCallback, errorCallback) {
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
                    errorCallback("Connection Error", "An error occurred while getting similar topics.");
                }
            });
        };

        exports.updateTopic = function(id, xml, title, config, successCallback, errorCallback) {

            var postBody = {
                id: id,
                xml: xml,
                locale: "en-US",
                configuredParameters: [
                    "xml",
                    "locale"
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
                    errorCallback("Connection Error", "An error occurred while uploading a topic.");
                }
            });
        };

        exports.createImage = function(trytomatch, zipfile, image, config, successCallback, errorCallback) {

            exports.zipModel.getByteArrayFromFileName(
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
                                        locale: "en-US",
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
                        url: 'http://' + config.PressGangHost + ':8080/pressgang-ccms/rest/1/image/' + (trytomatch ? 'createormatch' : 'match') + '/json?message=' + encodeURIComponent(config.RevisionMessage) + '&flag=2&userId=89',
                        data: JSON.stringify(postBody),
                        contentType: "application/json",
                        dataType: "json",
                        success: function (data) {
                            successCallback(data);
                        },
                        error: function () {
                            errorCallback("Connection Error", "An error occurred while uploading an image.");
                        }
                    });
                },
                errorCallback
            );
        };

        exports.createContentSpec = function(spec, config, successCallback, errorCallback) {

            var postBody = {
                text: spec,
                configuredParameters: [
                    "text"
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
                    errorCallback("Connection Error", "An error occurred while uploading the content spec.");
                }
            });
        };

        exports.updateContentSpec = function(id, spec, config, successCallback, errorCallback) {
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
                    errorCallback("Connection Error", "An error occurred while uploading the content spec.");
                }
            });
        };

        exports.qnastart = new qna.QNAStep()
            .setTitle("Select import source")
            .setIntro("You can either import an existing Publican DocBook archive, or from an OpenDocument.")
            .setInputs(
                [
                    new qna.QNAVariables()
                        .setVariables([
                            new qna.QNAVariable()
                                .setType(qna.InputEnum.RADIO_BUTTONS)
                                .setIntro(["Publican (Alpha)", "DocBook 5 (Alpha)", "OpenDocument (Super Duper Alpha)"])
                                .setOptions(["Publican", "DocBook5", "OpenDocument"])
                                .setValue("Publican")
                                .setName("ImportOption")
                        ])
                ]
            )
            .setNextStep(function (resultCallback, errorCallback, result, config) {
                resultCallback(askToCreateNewSpecOrOverwriteExistingOne);
            });


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
                "You also have the choice to reuse any images that exactly match those that are being imported. " +
                "It is highly recommended that you reuse existing topics and images.")
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
            .setIntro("You can create the imported content specification on either the production or test PressGang servers. " +
                "Using the test server is recommended for the first import to check the results before adding the content to the production server.")
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
            ])
            .setNextStep(function (resultCallback, errorCallback, result, config) {
                if (config.ImportOption === "Publican") {
                    resultCallback(publicanimport.askForPublicanZipFile);
                } else if (config.ImportOption === "DocBook5") {
                    resultCallback(generaldocbookimport.askForDocBookFile);
                } else {
                    resultCallback(opendocumentimport.askForOpenDocumentFile);
                }
            });

    }
);