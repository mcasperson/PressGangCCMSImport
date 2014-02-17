define(
    ['zip', 'jquery', 'qna/qna', 'qna/qnazipmodel', 'qna/qnautils', 'publicanimport', 'opendocumentimport', 'exports'],
    function (zip, jquery, qna, qnazipmodel, qnautils, publicanimport, opendocumentimport, exports) {
        'use strict';

        // a zip model to be shared
        exports.zipModel = new qnazipmodel.QNAZipModel();

        exports.escapeSpecTitle = function (title) {
            return title.replace(/\[/g, "\\[")
                .replace(/\]/g, "\\]");
        };

        exports.createTopic = function(tryToMatch, xml, title, tags, config, successCallback, errorCallback) {

            var postBody = {
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
                                .setIntro(["Publican (Alpha)", "OpenDocument (Super Duper Alpha)"])
                                .setOptions(["Publican", "OpenDocument"])
                                .setValue("Pubilcan")
                                .setName("ImportOption")
                        ])
                ]
            )
            .setNextStep(function (resultCallback, errorCallback, result, config) {
                resultCallback(config.ImportOption === "Publican" ? publicanimport.askForPublicanZipFile : opendocumentimport.askForOpenDocumentFile);
            });
    }
);