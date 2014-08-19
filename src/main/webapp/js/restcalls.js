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
    ['zip', 'jquery', 'qna/qna', 'qna/qnazipmodel', 'qna/qnadirmodel', 'qna/qnautils', 'publicanimport', 'generaldocbookimport', 'generalexternalimport', 'constants', 'asciidocimport', 'reportsettings', 'exports'],
    function (zip, jquery, qna, qnazipmodel, qnadirmodel, qnautils, publicanimport, generaldocbookimport, generalexternalimport, constants, asciidocimport, reportsettings, exports) {
        'use strict';

        var RETRY_COUNT = 5;

        exports.configEntites = null;

        exports.loadEntityConfig = function (config, successCallback, errorCallback, retryCount) {

            if (retryCount === undefined) {
                retryCount = 0;
            }

            jquery.ajax({
                type: 'GET',
                url: 'http://' + config.PressGangHost + '/pressgang-ccms/rest/1/settings/get/json?expand=%7B%22branches%22%3A%5B%7B%22trunk%22%3A%7B%22name%22%3A%20%22locales%22%7D%7D%5D%7D',
                dataType: "json",
                success: function (data) {
                    exports.configEntites = data;
                    successCallback();
                },
                error: function () {
                    if (retryCount < RETRY_COUNT) {
                        exports.loadEntityConfig(config, successCallback, errorCallback, ++retryCount);
                    } else {
                        errorCallback("Connection Error", "An error occurred while getting the server settings. This may be caused by an intermittent network failure. Try your import again, and if problem persist log a bug.", true);
                    }
                }
            });
        };

        exports.createTopic = function(tryToMatch, format, xml, title, tags, localeId, config, successCallback, errorCallback, retryCount) {

            if (retryCount === undefined) {
                retryCount = 0;
            }

            var postBody = {
                xml: xml,
                locale: {
                    id: localeId
                },
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
                url: 'http://' + config.PressGangHost + '/pressgang-ccms/rest/1/topic/' + (tryToMatch ? 'createormatch' : 'create') + '/json?message=' + encodeURIComponent(config.RevisionMessage) + '&flag=2&userId=89',
                data: JSON.stringify(postBody),
                contentType: "application/json",
                dataType: "json",
                success: function (data) {
                    successCallback(data);
                },
                error: function () {
                    if (retryCount < RETRY_COUNT) {
                        exports.createTopic(tryToMatch, format, xml, title, tags, localeId, config, successCallback, errorCallback, ++retryCount);
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
                url: 'http://' + config.PressGangHost + '/pressgang-ccms/rest/1/minhashsimilar/get/json?threshold=0.6&expand=%7B%22branches%22%3A%5B%7B%22trunk%22%3A%7B%22name%22%3A%20%22topics%22%7D%7D%5D%7D',
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

        exports.getTopicsInSpec = function(specId, config, successCallback, errorCallback, retryCount) {
            if (retryCount === undefined) {
                retryCount = 0;
            }

            jquery.ajax({
                type: 'GET',
                url: 'http://' + config.PressGangHost + '/pressgang-ccms/rest/1/topics/get/json/query;topicIncludedInSpec=' + specId + ';?expand=%7B%22branches%22%3A%5B%7B%22trunk%22%3A%7B%22name%22%3A%20%22topics%22%7D%2C%20%22branches%22%3A%5B%7B%22trunk%22%3A%7B%22name%22%3A%20%22contentSpecs_OTM%22%7D%7D%5D%7D%5D%7D',
                dataType: "json",
                success: function (data) {
                    successCallback(data);
                },
                error: function () {
                    if (retryCount < RETRY_COUNT) {
                        exports.getTopicsInSpec(specId, config, successCallback, errorCallback, ++retryCount);
                    } else {
                        errorCallback("Connection Error", "An error occurred while getting topics in a content spec. This may be caused by an intermittent network failure. Try your import again, and if problem persist log a bug.", true);
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
                url: 'http://' + config.PressGangHost + '/pressgang-ccms/rest/1/topic/update/json?message=' + encodeURIComponent(config.RevisionMessage) + '&flag=2&userId=89',
                data: JSON.stringify(postBody),
                contentType: "application/json",
                dataType: "json",
                success: function (data) {
                    successCallback(data);
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

        exports.createFile = function(model, trytomatch, zipfile, file, filename, filepath, localeId, config, successCallback, errorCallback, retryCount) {
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
                                        locale: {
                                            id: localeId
                                        },
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
                        url: 'http://' + config.PressGangHost + '/pressgang-ccms/rest/1/file/' + (trytomatch ? 'createormatch' : 'create') + '/json?message=' + encodeURIComponent(config.RevisionMessage) + '&flag=2&userId=89',
                        data: JSON.stringify(postBody),
                        contentType: "application/json",
                        dataType: "json",
                        success: function (data) {
                            successCallback(data);
                        },
                        error: function () {
                            if (retryCount < RETRY_COUNT) {
                                exports.createFile(model, trytomatch, zipfile, file, localeId, config, successCallback, errorCallback, ++retryCount);
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

        exports.createImage = function(model, trytomatch, zipfile, image, localeId, config, successCallback, errorCallback, retryCount) {
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
                                        locale: {
                                            id: localeId
                                        },
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
                        url: 'http://' + config.PressGangHost + '/pressgang-ccms/rest/1/image/' + (trytomatch ? 'createormatch' : 'create') + '/json?message=' + encodeURIComponent(config.RevisionMessage) + '&flag=2&userId=89',
                        data: JSON.stringify(postBody),
                        contentType: "application/json",
                        dataType: "json",
                        success: function (data) {
                            successCallback(data);
                        },
                        error: function () {
                            if (retryCount < RETRY_COUNT) {
                                exports.createImage(model, trytomatch, zipfile, image, localeId, config, successCallback, errorCallback, ++retryCount);
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

        exports.createImageFromURL = function(trytomatch, url, localeId, config, successCallback, errorCallback, retryCount) {
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
                                        locale: {
                                            id: localeId
                                        },
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
                        url: 'http://' + config.PressGangHost + '/pressgang-ccms/rest/1/image/' + (trytomatch ? 'createormatch' : 'create') + '/json?message=' + encodeURIComponent(config.RevisionMessage) + '&flag=2&userId=89',
                        data: JSON.stringify(postBody),
                        contentType: "application/json",
                        dataType: "json",
                        success: function (data) {
                            successCallback(data);
                        },
                        error: function () {
                            if (retryCount < RETRY_COUNT) {
                                exports.createImageFromURL(trytomatch, url, localeId, config, successCallback, errorCallback, ++retryCount);
                            } else {
                                errorCallback("Connection Error", "An error occurred while uploading an image. This may be caused by an intermittent network failure. Try your import again, and if problem persist log a bug.", true);
                            }

                        }
                    });
                },
                errorCallback
            );
        };

        exports.createContentSpec = function(spec, localeId, config, successCallback, errorCallback, retryCount) {
            if (retryCount === undefined) {
                retryCount = 0;
            }

            var postBody = {
                text: spec,
                locale: {
                    id: localeId
                },
                configuredParameters: [
                    "text",
                    "locale"
                ]
            };

            jquery.ajax({
                type: 'POST',
                url: 'http://' + config.PressGangHost + '/pressgang-ccms/rest/1/contentspec/create/json+text?message=' + encodeURIComponent(config.RevisionMessage) + '&flag=2&userId=89',
                data: JSON.stringify(postBody),
                contentType: "application/json",
                dataType: "json",
                success: function (data) {
                    successCallback(data.id);
                },
                error: function () {
                    if (retryCount < RETRY_COUNT) {
                        exports.createContentSpec(spec, localeId, config, successCallback, errorCallback, ++retryCount);
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
                url: 'http://' + config.PressGangHost + '/pressgang-ccms/rest/1/contentspec/update/json+text/?message=' + encodeURIComponent(config.RevisionMessage) + '&flag=2&userId=89',
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
    }
);