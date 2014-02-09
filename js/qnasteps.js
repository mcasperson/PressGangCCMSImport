(function (global) {
    'use strict';

    // a zip model to be shared
    global.zipModel = new global.QNAZipModel();

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
                    url: 'http://' + config.PressGangHost + ':8080/pressgang-ccms/rest/1/image/createormatch/json?message=Initial+Image+Creation&flag=2&userId=89',
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
            url: 'http://' + config.PressGangHost + ':8080/pressgang-ccms/rest/1/contentspec/create/json+text?message=Initial+Topic+Creation&flag=2&userId=89',
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
            url: 'http://' + config.PressGangHost + ':8080/pressgang-ccms/rest/1/contentspec/update/json+text/?message=Initial+Topic+Creation&flag=2&userId=89',
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
                            .setIntro(["Publican", "OpenDocument"])
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