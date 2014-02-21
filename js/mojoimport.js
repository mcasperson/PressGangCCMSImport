define(
    ['jquery', 'qna/qna', 'qna/qnautils', 'qna/qnazipmodel', 'qnastart', 'specelement', 'fontrule', 'generalexternalimport', 'exports'],
    function (jquery, qna, qnautils, qnazipmodel, qnastart, specelement, fontrule, generalexternalimport, exports) {
        'use strict';

        var mojoURLRE = /^https:\/\/mojo.redhat.com\/docs\/DOC-(\d+)$/;

        exports.askForMojoDoc = new qna.QNAStep()
            .setTitle("Specify the Mojo document to import")
            .setIntro("Specify the Mojo document that contains the content you wish to import. This is the URL to the Mojo document in the format https://mojo.redhat.com/docs/DOC-#####.")
            .setInputs(
                [
                    new qna.QNAVariables()
                        .setVariables([
                            new qna.QNAVariable()
                                .setType(qna.InputEnum.TEXTBOX)
                                .setIntro("Mojo URL")
                                .setName("MojoURL")
                                .setValue("https://mojo.redhat.com/docs/DOC-935113")
                        ])
                ]
            )
            .setProcessStep(function (resultCallback, errorCallback, result, config) {
                if (!config.MojoURL) {
                    errorCallback("Please specify a URL", "You need to specify a Mojo URL before continuing.");
                } else {
                    if (window.greaseMonkeyShare === undefined) {
                        errorCallback("User Script Not Installed", "You need to install the PressGang Import user script to import Mojo documents");
                    } else if (!mojoURLRE.test(config.MojoURL.trim())) {
                        errorCallback("URL is not valid", "Please enter a valid Mojo document URL.");
                    } else {
                        resultCallback(null);
                    }
                }
            })
            .setNextStep(function (resultCallback) {
                resultCallback(processHTML);
            });

        /*
         Ask for a revision message
         */
        var askForRevisionMessage = new qna.QNAStep()
            .setTitle("Enter a message for the revision log")
            .setIntro("Each new topic, image and content specification created by this import process will have this revision message in the log.")
            .setInputs([
                new qna.QNAVariables()
                    .setVariables([
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.TEXTBOX)
                            .setIntro("Revision Log Message")
                            .setValue(function (resultCallback, errorCallback, result, config){resultCallback("Imported from " + config.MojoURL);})
                            .setName("RevisionMessage")
                    ])
            ])
            .setNextStep(function (resultCallback, errorCallback, result, config) {
                resultCallback(processHTML);
            })
            .setShowNext("Start Import");

        /*
         STEP 5 - process the ODT file
         */
        var processHTML = new qna.QNAStep()
            .setShowNext(false)
            .setShowPrevious(false)
            .setTitle("Processing the ODT file")
            .setIntro("The list below allows you to monitor the progress of the import process. Steps with an asterisk (*) can take some time to complete, so please be patient.")
            .setOutputs([
                new qna.QNAVariables()
                    .setVariables([
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.CHECKBOX)
                            .setIntro("Getting Mojo Document"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.CHECKBOX)
                            .setIntro("Resolving Book Structure")
                            .setName("ResolvedBookStructure"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.CHECKBOX)
                            .setIntro("Uploading Images*")
                            .setName("UploadedImages"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.CHECKBOX)
                            .setIntro("Uploading Topics*")
                            .setName("UploadedTopics"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.CHECKBOX)
                            .setIntro("Uploading content specification")
                            .setName("UploadedContentSpecification"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.PLAIN_TEXT)
                            .setIntro("Topics Created / Topics Reused")
                            .setName("NewTopicsCreated"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.PLAIN_TEXT)
                            .setIntro("Images Created / Images Reused")
                            .setName("NewImagesCreated"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.PROGRESS)
                            .setIntro("Progress")
                            .setName("UploadProgress")
                            // gotta set this first up because of https://github.com/angular-ui/bootstrap/issues/1547
                            .setValue([100, 0])
                    ])
            ])
            .setEnterStep(function (resultCallback, errorCallback, result, config) {

                window.onbeforeunload=function(){
                    return "The import process is in progress. Are you sure you want to quit?";
                };

                var progressIncrement = 100 / 4;

                var resultObject = JSON.parse(result) || {};
                resultObject.contentSpec = resultObject.contentSpec || [];

                /*
                 Initialize some config values
                 */
                config.UploadedTopicCount = 0;
                config.MatchedTopicCount = 0;
                config.UploadedImageCount = 0;
                config.MatchedImageCount = 0;

                var id = /^.*?(\d+)$/.exec(config.MojoURL);

                window.greaseMonkeyShare.getMojoDoc(
                    id[1],
                    function (data) {
                        var topicGraph = new specelement.TopicGraph();
                        var mojoDoc = jquery(data);

                        if (mojoDoc.length < 2 || !/div/i.test(mojoDoc[1].nodeName || !/jive-rendered-content/i.test(mojoDoc[1].className))) {
                            errorCallback("Invalid Mojo document", "Could not find the <body><div class='jive-rendered-content'> element!");
                        } else {
                            var childNodeCount = jquery(mojoDoc[1]).children().length;
                            var images = {};

                            var processTopic = function (title, outlineLevel, index, content, successCallback) {
                                if (index >= childNodeCount) {
                                    if (content.length !== 0) {
                                        var prefix = generalexternalimport.generateSpacing(outlineLevel);
                                        resultObject.contentSpec.push(prefix + qnastart.escapeSpecTitle(title));
                                        generalexternalimport.addTopicToSpec(content, title, resultObject.contentSpec.length - 1);
                                    }

                                    successCallback();
                                } else {
                                    var contentNode = jquery(mojoDoc[1]).children()[index];
                                    if (contentNode !== null) {

                                        config.UploadProgress[1] = progressIncrement * (index / childNodeCount);
                                        resultCallback();

                                        // headers indicate container or topic boundaries
                                        if (/h\d/i.test(contentNode.nodeName)) {
                                            processHeader(content, contentNode, title, outlineLevel, index, successCallback);
                                            return;
                                        } else if (/p/i.test(contentNode.nodeName)) {
                                            processPara(content, contentNode, images);
                                        }

                                        setTimeout(function() {
                                            processTopic(title, outlineLevel, index + 1, content, successCallback);
                                        }, 0);
                                    }
                                }
                            };

                            var cleanTextContent = function(text) {
                                text = text.replace(/’/g, '&apos;');
                                text = text.replace(/“/g, '&quot;');
                                text = text.replace(/”/g, '&quot;');
                                return text;
                            };

                            /*
                             Expand the text:s elements and remarks.
                             */
                            var convertNodeToDocbook = function (node, emphasis) {
                                var customContainerContent = "";
                                for (var childIndex = 0; childIndex < node.childNodes.length; ++childIndex) {
                                    var childNode = node.childNodes[childIndex];
                                    if (childNode.nodeType === Node.TEXT_NODE) {
                                        customContainerContent += cleanTextContent(childNode.textContent);
                                    } else if (/a/i.test(childNode.nodeName)) {
                                        var href = childNode.getAttribute("href");
                                        if (href !== null) {
                                            customContainerContent += '<ulink url="' + href + '">' + cleanTextContent(childNode.textContent) + '</ulink>';
                                        } else {
                                            customContainerContent += cleanTextContent(childNode.textContent);
                                        }
                                    } else if (!(/div/i.test(childNode.nodeName) && /toc/i.test(childNode.className))) {
                                        // we don't import the mojo toc
                                        customContainerContent += convertNodeToDocbook(childNode);
                                    }
                                }

                                return customContainerContent;
                            };

                            var processPara = function (content, contentNode, imageLinks) {
                                if (contentNode.textContent.trim().length !== 0) {
                                    content.push("<para>" + convertNodeToDocbook(contentNode, true) + "</para>");
                                }
                            };

                            var processList = function (content, contentNode, imageLinks, depth) {
                                if (depth === undefined) {
                                    depth = 1;
                                }

                                /*
                                 Find out if this is a numbered or bullet list
                                 */
                                var listType = "itemizedlist";

                                if (/ol/i.test(contentNode.nodeName)) {
                                    listType = "orderedlist";
                                }

                                var listItems = jquery("li", contentNode);
                                content.push("<" + listType + ">");
                                jquery.each(listItems, function(key, listItem) {
                                    content.push("<listitem>");

                                    jquery.each(jquery(listItem).children(), function (index, childNode) {
                                        if (/p/i.test(childNode.nodeName)) {
                                            processPara(content, childNode, imageLinks);
                                        } else if (/ul|ol/i.test(childNode.nodeName)) {
                                            processList(content, childNode, imageLinks, depth + 1, style);
                                        }
                                    });

                                    content.push("</listitem>");
                                });
                                content.push("</" + listType + ">");
                            };

                            var processHeader = function (content, contentNode, title, outlineLevel, index, successCallback) {
                                var prefix = generalexternalimport.generateSpacing(outlineLevel);

                                var newOutlineLevel = parseInt(/h(\d)/i.exec(contentNode.nodeName)[1]);

                                for (var missedSteps = outlineLevel; missedSteps < newOutlineLevel - 1; ++missedSteps) {
                                    if (missedSteps === 0) {
                                        resultObject.contentSpec.push("Chapter: Missing Chapter");
                                    } else {
                                        var myPrefix = generalexternalimport.generateSpacing(missedSteps);
                                        resultObject.contentSpec.push(myPrefix + "Section: Missing Section");
                                    }
                                }

                                // Last heading had no content before this heading. We only add a container if
                                // the last heading added a level of depth to the tree, Otherwise it is just
                                // an empty container.
                                if (content.length === 0 && title !== null && newOutlineLevel > outlineLevel) {
                                    if (outlineLevel === 0) {
                                        resultObject.contentSpec.push("Chapter: " + qnastart.escapeSpecTitle(title));
                                    } else {
                                        resultObject.contentSpec.push(prefix + "Section: " + qnastart.escapeSpecTitle(title));
                                    }
                                } else if (content.length !== 0) {
                                    /*
                                     We have found some initial text. Put it under an introduction chapter
                                     */
                                    if (title === null) {
                                        title = "Introduction";
                                        resultObject.contentSpec.push("Chapter: " + qnastart.escapeSpecTitle(title));
                                    } else {
                                        if (newOutlineLevel > outlineLevel) {
                                            resultObject.contentSpec.push(prefix + "Section: " + qnastart.escapeSpecTitle(title));
                                        } else {
                                            resultObject.contentSpec.push(prefix + qnastart.escapeSpecTitle(title));
                                        }
                                    }

                                    generalexternalimport.addTopicToSpec(content, title, resultObject.contentSpec.length - 1);
                                }

                                var newTitle = convertNodeToDocbook(contentNode, false);
                                if (newTitle.length === 0) {
                                    newTitle = "Untitled";
                                }

                                newTitle = newTitle.replace(/^(\d+)(\.\d+)*\.?\s*/, "");

                                setTimeout(function() {
                                    processTopic(newTitle, newOutlineLevel, index + 1, [], successCallback);
                                }, 0);
                            };

                            processTopic(null, 0, 0, [], function() {
                                config.UploadProgress[1] = progressIncrement;
                                config.ResolvedBookStructure = true;
                                resultCallback();

                                uploadImagesLoop();
                            });
                        }
                    },
                    errorCallback
                );

                var uploadImages = function (index, imagesKeys, callback) {
                    if (index >= imagesKeys.length) {
                        callback();
                    } else {
                        config.UploadProgress[1] = progressIncrement + (index / topicGraph.nodes.length * progressIncrement);
                        resultCallback();

                        var imagePath = imagesKeys[index];

                        qnastart.createImage(
                            true,
                            config.OdtFile,
                            imagePath,
                            config,
                            function (id, matched) {
                                images[imagePath] = "images/" + id + imagePath.substr(imagePath.lastIndexOf("."));

                                config.UploadedImageCount += 1;
                                if (matched) {
                                    config.MatchedImageCount += 1;
                                }

                                config.NewImagesCreated = (config.UploadedImageCount - config.MatchedImageCount) + " / " + config.MatchedImageCount;
                                resultCallback();

                                uploadImages(index + 1, imagesKeys, callback);
                            },
                            errorCallback
                        );
                    }
                };

                var uploadImagesLoop = function() {
                    uploadImages(0, qnautils.keys(images), function(){
                        config.UploadProgress[1] = progressIncrement * 2;
                        config.UploadedImages = true;
                        resultCallback();

                        jquery.each(topicGraph.nodes, function (index, topic) {
                            var filerefs = contentsXML.evaluate(".//@fileref", topic.xml, resolver, XPathResult.ANY_TYPE, null);
                            var replacements = [];
                            var fileref;
                            while ((fileref = filerefs.iterateNext()) !== null) {
                                replacements.push({attr: fileref, value: images[fileref.nodeValue]});
                            }

                            jquery.each(replacements, function (index, replacement) {
                                replacement.attr.nodeValue = replacement.value;
                            });
                        });

                        createTopicsLoop();
                    });
                };

                var createTopics = function (index, callback) {
                    if (index >= topicGraph.nodes.length) {
                        callback();
                    } else {
                        config.UploadProgress[1] = progressIncrement * 2  + (index / topicGraph.nodes.length * progressIncrement);
                        resultCallback();

                        var topic = topicGraph.nodes[index];

                        qnastart.createTopic(
                            true,
                            4.5,
                            qnautils.xmlToString(topic.xml),
                            topic.title,
                            null,
                            config, function (data) {

                                config.UploadedTopicCount += 1;
                                if (data.matchedExistingTopic) {
                                    config.MatchedTopicCount += 1;
                                }

                                config.NewTopicsCreated = (config.UploadedTopicCount - config.MatchedTopicCount) + " / " + config.MatchedTopicCount;
                                resultCallback();

                                topic.setTopicId(data.topic.id);
                                topic.xml = jquery.parseXML(data.topic.xml);

                                createTopics(index + 1, callback);
                            },
                            errorCallback
                        );
                    }
                };

                var createTopicsLoop = function() {
                    createTopics(0, function(){
                        config.UploadProgress[1] = progressIncrement * 3;
                        config.UploadedTopics = true;
                        resultCallback();

                        jquery.each(topicGraph.nodes, function (index, topic) {
                            resultObject.contentSpec[topic.specLine] += " [" + topic.topicId + "]";

                        });

                        var spec = "";
                        jquery.each(resultObject.contentSpec, function(index, value) {
                            console.log(value);
                            spec += value + "\n";
                        });

                        qnastart.createContentSpec(
                            spec,
                            config,
                            function(id) {
                                config.ContentSpecID = id;

                                config.UploadProgress[1] = progressIncrement * 4;
                                config.UploadedContentSpecification = true;
                                resultCallback(true);

                                console.log("Content Spec ID: " + id);
                            },
                            errorCallback
                        );
                    });
                };


            })
            .setNextStep(function (resultCallback) {
                window.onbeforeunload = undefined;

                resultCallback(summary);
            });


        var summary = new qna.QNAStep()
            .setTitle("Import Summary")
            .setOutputs([
                new qna.QNAVariables()
                    .setVariables([
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.HTML)
                            .setIntro("Content Specification ID")
                            .setName("ContentSpecIDLink")
                            .setValue(function (resultCallback, errorCallback, result, config) {
                                resultCallback("<a href='http://" + config.PressGangHost + ":8080/pressgang-ccms-ui/#ContentSpecFilteredResultsAndContentSpecView;query;contentSpecIds=" + config.ContentSpecID + "'>" + config.ContentSpecID + "</a>");
                            }),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.PLAIN_TEXT)
                            .setIntro("Imported From")
                            .setName("ImportedFrom")
                            .setValue(function (resultCallback, errorCallback, result, config) {
                                resultCallback(config.OdtFile.name);
                            }),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.PLAIN_TEXT)
                            .setIntro("Topics Created / Topics Reused")
                            .setName("NewTopicsCreated"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.PLAIN_TEXT)
                            .setIntro("Images Created / Images Reused")
                            .setName("NewImagesCreated")
                    ])
            ])
            .setShowNext(false)
            .setShowPrevious(false)
            .setShowRestart(true);

    }
);