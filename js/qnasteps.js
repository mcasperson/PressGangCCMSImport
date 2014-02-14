(function (global) {
    'use strict';

    // a zip model to be shared
    global.zipModel = new global.QNAZipModel();

    global.escapeSpecTitle = function (title) {
        return title.replace(/\[/g, "\\[")
            .replace(/\]/g, "\\]");
    };

    global.xmlToString = function(xmlDoc) {
        return (new global.XMLSerializer()).serializeToString(xmlDoc);
    };

    global.createTopic = function(tryToMatch, xml, title, tags, config, successCallback, errorCallback) {

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

            global.jQuery.each(tags, function (index, value) {
                postBody.tags.items.push({
                    item: {
                        id: value
                    },
                    state: 1
                });
            });
        }

        global.jQuery.ajax({
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

    global.getSimilarTopics = function(xml, config, successCallback, errorCallback) {
        global.jQuery.ajax({
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

    global.updateTopic = function(id, xml, title, config, successCallback, errorCallback) {

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

        global.jQuery.ajax({
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

    global.createImage = function(zipfile, image, config, successCallback, errorCallback) {

        global.zipModel.getByteArrayFromFileName(
            zipfile,
            image,
            function (arrayBuffer) {

                var byteArray = [];
                var view = new global.Uint8Array(arrayBuffer);
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

                global.jQuery.ajax({
                    type: 'POST',
                    url: 'http://' + config.PressGangHost + ':8080/pressgang-ccms/rest/1/image/createormatch/json?message=' + encodeURIComponent(config.RevisionMessage) + '&flag=2&userId=89',
                    data: JSON.stringify(postBody),
                    contentType: "application/json",
                    dataType: "json",
                    success: function (data) {
                        successCallback(data.image.id, data.matchedExistingImage);
                    },
                    error: function () {
                        errorCallback("Connection Error", "An error occurred while uploading an image.");
                    }
                });
            },
            errorCallback
        );
    };

    global.createContentSpec = function(spec, config, successCallback, errorCallback) {

        var postBody = {
            text: spec,
            configuredParameters: [
                "text"
            ]
        };

        global.jQuery.ajax({
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

    global.updateContentSpec = function(id, spec, config, successCallback, errorCallback) {
        var postBody = {
            id: id,
            text: "ID = " + id + "\n" + spec,
            configuredParameters: [
                "text"
            ]
        };

        global.jQuery.ajax({
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

    global.QNAStart = new global.QNAStep()
        .setTitle("Select import source")
        .setIntro("You can either import an existing Publican DocBook archive, or from an OpenDocument.")
        .setInputs(
            [
                new global.QNAVariables()
                    .setVariables([
                        new global.QNAVariable()
                            .setType(global.InputEnum.RADIO_BUTTONS)
                            .setIntro(["Publican (Alpha)", "OpenDocument (Super Duper Alpha)"])
                            .setOptions(["Publican", "OpenDocument"])
                            .setValue("Pubilcan")
                            .setName("ImportOption")
                    ])
            ]
        )
        .setNextStep(function (resultCallback, errorCallback, result, config) {
            resultCallback(config.ImportOption === "Publican" ? global.askForPublicanZipFile : global.askForOpenDocumentFile);
        });
}(this));