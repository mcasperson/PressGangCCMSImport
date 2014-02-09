(function (global) {
    'use strict';

    /*
     STEP 1 - Get the ODT file
     */
    global.askForOpenDocumentFile = new global.QNAStep()
        .setTitle("Select the ODT file to import")
        .setIntro("Select the ODT file that contains the content you wish to import.")
        .setInputs(
            [
                new global.QNAVariables()
                    .setVariables([
                        new global.QNAVariable()
                            .setType(global.InputEnum.SINGLE_FILE)
                            .setIntro("OpenDocument ODT File")
                            .setName("OdtFile")
                    ])
            ]
        )
        .setProcessStep(function (resultCallback, errorCallback, result, config) {
            if (!config.OdtFile) {
                errorCallback("Please select a file", "You need to select an ODT file before continuing.");
            } else if (config.OdtFile.name.lastIndexOf(".odt") !== config.OdtFile.name.length - 4) {
                errorCallback("Please select a file", "You need to select an ODT file before continuing.");
            } else {
                global.zipModel.getCachedEntries(config.OdtFile, function (entries) {

                    var foundContentFile = false;
                    global.angular.forEach(entries, function (value, key) {
                        if (value.filename === "content.xml") {
                            foundContentFile = true;
                            return false;
                        }
                    });

                    var foundStyleFile = false;
                    global.angular.forEach(entries, function (value, key) {
                        if (value.filename === "styles.xml") {
                            foundStyleFile = true;
                            return false;
                        }
                    });

                    if (!foundContentFile || !foundStyleFile) {
                        errorCallback("Error", "The ODT file did not contain either a styles.xml or content.xml file. The selected file is not a valid OpenDocument file.");
                    } else {
                        resultCallback(null);
                    }
                }, function (message) {
                    errorCallback("Error", "Could not process the ODT file!");
                });
            }
        })
        .setNextStep(function (resultCallback) {
            resultCallback(getSpecDetails);
        });

    /*
        STEP 2 - Get content spec details
     */
    var getSpecDetails = new global.QNAStep()
        .setTitle("Enter content specification details")
        .setIntro("Enter the basic details of the content specification")
        .setInputs(
            [
                new global.QNAVariables()
                    .setVariables([
                        new global.QNAVariable()
                            .setType(global.InputEnum.TEXTBOX)
                            .setIntro("Title")
                            .setName("ContentSpecTitle")
                            .setValue("Title"),
                        new global.QNAVariable()
                            .setType(global.InputEnum.TEXTBOX)
                            .setIntro("Product")
                            .setName("ContentSpecProduct")
                            .setValue("Product"),
                        new global.QNAVariable()
                            .setType(global.InputEnum.TEXTBOX)
                            .setIntro("Version")
                            .setName("ContentSpecVersion")
                            .setValue("1"),
                        new global.QNAVariable()
                            .setType(global.InputEnum.TEXTBOX)
                            .setIntro("Copyright Holder")
                            .setName("ContentSpecCopyrightHolder")
                            .setValue("Red Hat"),
                        new global.QNAVariable()
                            .setType(global.InputEnum.COMBOBOX)
                            .setIntro("Brand")
                            .setName("ContentSpecBrand")
                            .setValue("RedHat")
                            .setOptions(["RedHat", "JBoss", "Fedora"])
                    ])
            ]
        )
        .setProcessStep(function (resultCallback, errorCallback, result, config) {
            if (!config.ContentSpecTitle) {
                errorCallback("Please enter a title.");
            } else if (!config.ContentSpecProduct) {
                errorCallback("Please enter a product.");
            } else if (!config.ContentSpecVersion) {
                errorCallback("Please enter a version.");
            } else if (!config.ContentSpecCopyrightHolder) {
                errorCallback("Please enter a copyright holder.");
            } else {
                var contentSpec = [];
                contentSpec.push("Title = " + config.ContentSpecTitle);
                contentSpec.push("Product = " + config.ContentSpecProduct);
                contentSpec.push("Version = " + config.ContentSpecVersion);
                contentSpec.push("Copyright Holder = " + config.ContentSpecCopyrightHolder);
                contentSpec.push("Brand = " + config.ContentSpecBrand);
                resultCallback(JSON.stringify(contentSpec));
            }
        })
        .setNextStep(function (resultCallback) {
            resultCallback(specifyTheServer);
        });

    /*
        Step 3 - ask which server this is being uploaded to
     */
    var specifyTheServer = new global.QNAStep()
        .setTitle("Select the server to import in to")
        .setIntro("You can create the imported content specification on either the production or test PressGang servers. " +
            "Using the test server is recommended for the first import to check the results before adding the content to the production server.")
        .setInputs([
            new global.QNAVariables()
                .setVariables([
                    new global.QNAVariable()
                        .setType(global.InputEnum.RADIO_BUTTONS)
                        .setIntro(["Production Server", "Test Server"])
                        .setOptions(["skynet.usersys.redhat.com", "skynet-dev.usersys.redhat.com"])
                        .setValue("skynet-dev.usersys.redhat.com")
                        .setName("PressGangHost")
                ])
        ])
        .setNextStep(function (resultCallback) {
            resultCallback(processOdt);
        });

    /*
        STEP 4 - process the ODT file
     */
    var processOdt = new global.QNAStep()
        .setShowNext(false)
        .setShowPrevious(false)
        .setTitle("Processing the ODT file")
        .setIntro("The list below allows you to monitor the progress of the import process. Steps with an asterisk (*) can take some time to complete, so please be patient.")
        .setOutputs([
            new global.QNAVariables()
                .setVariables([
                    new global.QNAVariable()
                        .setType(global.InputEnum.CHECKBOX)
                        .setIntro("Resolving Book Structure")
                        .setName("ResolvedBookStructure"),
                    new global.QNAVariable()
                        .setType(global.InputEnum.CHECKBOX)
                        .setIntro("Uploading Images*")
                        .setName("UploadedImages"),
                    new global.QNAVariable()
                        .setType(global.InputEnum.CHECKBOX)
                        .setIntro("Uploading Topics*")
                        .setName("UploadedTopics"),
                    new global.QNAVariable()
                        .setType(global.InputEnum.CHECKBOX)
                        .setIntro("Uploading content specification")
                        .setName("UploadedContentSpecification"),
                    new global.QNAVariable()
                        .setType(global.InputEnum.PLAIN_TEXT)
                        .setIntro("Topics Created / Topics Reused")
                        .setName("NewTopicsCreated"),
                    new global.QNAVariable()
                        .setType(global.InputEnum.PLAIN_TEXT)
                        .setIntro("Images Created / Images Reused")
                        .setName("NewImagesCreated"),
                    new global.QNAVariable()
                        .setType(global.InputEnum.PROGRESS)
                        .setIntro("Progress")
                        .setName("UploadProgress")
                        // gotta set this first up because of https://github.com/angular-ui/bootstrap/issues/1547
                        .setValue([100, 0])
                ])
        ])
        .setEnterStep(function (resultCallback, errorCallback, result, config) {

            /*
             There are 17 steps, so this is how far to move the progress bar with each
             step.
             */
            var progressIncrement = 100 / 4;

            /*
             Initialize some config values
             */
            config.UploadedTopicCount = 0;
            config.MatchedTopicCount = 0;
            config.UploadedImageCount = 0;
            config.MatchedImageCount = 0;

            var contentSpec = JSON.parse(result);

            global.zipModel.getTextFromFileName(
                config.OdtFile,
                "content.xml",
                function (contents) {
                    var topicGraph = new global.TopicGraph();
                    var xmlDoc = global.jQuery.parseXML(contents);

                    // http://www.nczonline.net/blog/2009/03/24/xpath-in-javascript-part-2/
                    var evaluator = new global.XPathEvaluator();
                    var resolver = evaluator.createNSResolver(xmlDoc.documentElement);

                    var body = xmlDoc.evaluate("//office:text", xmlDoc, resolver, global.XPathResult.ANY_TYPE, null).iterateNext();
                    if (body === null) {
                        errorCallback("Invalid ODT file", "Could not find the <office:body> element!");
                    } else {
                        // these nodes make up the content that we will import
                        var contentNodes = xmlDoc.evaluate("*", body, resolver, global.XPathResult.ANY_TYPE, null);

                        var images = {};

                        var processTopic = function (title, outlineLevel) {
                            var content = "";
                            var contentNode;
                            while ((contentNode = contentNodes.iterateNext()) !== null) {
                                // headers indicate container or topic boundaries
                                if (contentNode.nodeName === "text:h") {
                                    processHeader(content, contentNode, title, outlineLevel);
                                    break;
                                } else if (contentNode.nodeName === "text:p") {
                                    content = processPara(content, contentNode, images);
                                } else if (contentNode.nodeName === "text:list") {
                                    content = processList(content, contentNode, images);
                                }
                            }
                        };

                        var generateSpacing = function (outlineLevel) {
                            var prefix = "";
                            for (var i = 0; i < outlineLevel * 2; ++i) {
                                prefix += " ";
                            }
                            return prefix;
                        };

                        var processPara = function (content, contentNode, imageLinks) {
                            var images = xmlDoc.evaluate(".//draw:image", contentNode, resolver, global.XPathResult.ANY_TYPE, null);
                            var image;
                            while ((image = images.iterateNext()) !== null) {
                                if (image.getAttribute("xlink:href") !== null) {
                                    var href = image.getAttribute("xlink:href").trim();
                                    // make a not of an image that we need to upload
                                    imageLinks[href] = null;
                                    content += '<mediaobject>';
                                    content += '<imageobject>';
                                    content += '<imagedata fileref="' + href + '"/>';
                                        content += '</imageobject>';
                                    content += '</mediaobject>';
                                }
                            }

                            if (contentNode.textContent.trim().length !== 0) {
                                content += "<para>" + contentNode.textContent + "</para>";
                            }

                            return content;
                        };

                        var processList = function (content, contentNode) {
                            /*
                                Find out if this is a numbered or bullet list
                             */
                            var itemizedList = true;
                            var styleName = contentNode.getAttribute("text:style-name");
                            if (styleName !== null) {
                                var style = xmlDoc.evaluate("//text:list-style[@style:name='" + styleName + "']", xmlDoc, resolver, global.XPathResult.ANY_TYPE, null).iterateNext();
                                if (style !== null) {
                                    var listStyleNumber = xmlDoc.evaluate("./text:list-level-style-number", style, resolver, global.XPathResult.ANY_TYPE, null).iterateNext();
                                    //var listStyleBullet = xmlDoc.evaluate("./text:text:list-level-style-bullet", style, resolver, global.XPathResult.ANY_TYPE, null).iterateNext();
                                    itemizedList = listStyleNumber === null;
                                }
                            }

                            var listItems = xmlDoc.evaluate(".//text:list-item", contentNode, resolver, global.XPathResult.ANY_TYPE, null);
                            var listHeaders = xmlDoc.evaluate(".//text:list-header", contentNode, resolver, global.XPathResult.ANY_TYPE, null);
                            var listItemsHeaderContent = "";

                            var listHeader = listHeaders.iterateNext();
                            if (listHeader !== null) {
                                var paras = xmlDoc.evaluate(".//text:p", listHeader, resolver, global.XPathResult.ANY_TYPE, null);
                                var para;
                                while ((para = paras.iterateNext()) !== null) {
                                    if (para.textContent.trim().length !== 0) {
                                        listItemsHeaderContent += "<para>" + para.textContent + "</para>";
                                    }
                                }
                            }

                            var listItem;
                            if ((listItem = listItems.iterateNext()) !== null) {
                                content += itemizedList ? "<itemizedlist>" : "<orderedlist>";
                                content += listItemsHeaderContent;

                                do {
                                    content += "<listitem>";

                                    var listItemParas = xmlDoc.evaluate(".//text:p", listItem, resolver, global.XPathResult.ANY_TYPE, null);
                                    var listItemPara;
                                    while ((listItemPara = listItemParas.iterateNext()) !== null) {
                                        if (listItemPara.textContent.trim().length !== 0) {
                                            content += "<para>" + listItemPara.textContent + "</para>";
                                        }
                                    }

                                    content += "</listitem>";
                                } while ((listItem = listItems.iterateNext()) !== null);

                                content += itemizedList ? "</itemizedlist>" : "</orderedlist>";
                            } else {
                                // we have found a list that contains only a header. this is really just a para
                                content += listItemsHeaderContent;
                            }

                            return content;
                        };

                        var processHeader = function (content, contentNode, title, outlineLevel) {
                            var prefix = generateSpacing(outlineLevel);

                            var newOutlineLevel = parseInt(contentNode.getAttribute("text:outline-level")) - 1;
                            if (newOutlineLevel > outlineLevel && Math.abs(newOutlineLevel - outlineLevel) > 1) {
                                errorCallback("Outline levels jumped too much");
                                return;
                            }

                            // Last heading had no content before this heading. We only add a container if
                            // the last heading added a level of depth to the tree, Otherwise it is just
                            // an empty container.
                            if (content.length === 0 && title !== null && newOutlineLevel > outlineLevel) {
                                if (outlineLevel === 0) {
                                    contentSpec.push("Chapter: " + global.escapeSpecTitle(title));
                                } else {
                                    contentSpec.push(prefix + "Section: " + global.escapeSpecTitle(title));
                                }
                            } else if (content.length !== 0) {
                                /*
                                 We have found some initial text. Put it under an introduction chapter
                                 */
                                if (title === null) {
                                    title = "Introduction";
                                    contentSpec.push("Chapter: " + global.escapeSpecTitle(title));
                                } else {
                                    if (newOutlineLevel > outlineLevel) {
                                        contentSpec.push(prefix + "Section: " + global.escapeSpecTitle(title));
                                    } else {
                                        contentSpec.push(prefix + global.escapeSpecTitle(title));
                                    }
                                }

                                var xml = global.jQuery.parseXML("<section><title>" + title + "</title>" + content + "</section>");

                                var topic = new global.TopicGraphNode(topicGraph);
                                topic.setXml(xml, xml);
                                topic.setSpecLine(contentSpec.length - 1);
                                topic.setTitle(title);
                            }

                            var newTitle = contentNode.textContent.trim();
                            if (newTitle.length === 0) {
                                newTitle = "Untitled";
                            }

                            newTitle = newTitle.replace(/^(\d+)(\.\d+)*\.?\s*/, "");

                            processTopic(newTitle, newOutlineLevel);
                        };

                        processTopic(null, 0);

                        config.UploadProgress[1] = progressIncrement;
                        config.ResolvedBookStructure = true;
                        resultCallback();

                        var uploadImages = function (index, imagesKeys, callback) {
                            if (index >= imagesKeys.length) {
                                callback();
                            } else {
                                config.UploadProgress[1] = progressIncrement + (index / topicGraph.nodes.length * progressIncrement);
                                resultCallback();

                                var imagePath = imagesKeys[index];

                                global.createImage(
                                    config.OdtFile,
                                    imagePath,
                                    config,
                                    function (id, matched) {
                                        images[imagePath] = id + imagePath.substr(imagePath.lastIndexOf("."));

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
                            uploadImages(0, global.keys(images), function(){
                                config.UploadProgress[1] = progressIncrement * 2;
                                config.UploadedImages = true;
                                resultCallback();

                                global.jQuery.each(topicGraph.nodes, function (index, topic) {
                                    var filerefs = xmlDoc.evaluate(".//@fileref", topic.xml, resolver, global.XPathResult.ANY_TYPE, null);
                                    var replacements = [];
                                    var fileref;
                                    while ((fileref = filerefs.iterateNext()) !== null) {
                                        replacements.push({attr: fileref, value: images[fileref.nodeValue]});
                                    }

                                    global.jQuery.each(replacements, function (index, replacement) {
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

                                global.createTopic(
                                    true,
                                    global.xmlToString(topic.xml),
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
                                        topic.xml = global.jQuery.parseXML(data.topic.xml);

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

                                global.jQuery.each(topicGraph.nodes, function (index, topic) {
                                    contentSpec[topic.specLine] += " [" + topic.topicId + "]";

                                });

                                var spec = "";
                                global.jQuery.each(contentSpec, function(index, value) {
                                    console.log(value);
                                    spec += value + "\n";
                                });

                                global.createContentSpec(
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

                        uploadImagesLoop();
                    }
                },
                errorCallback
            );
        })
        .setNextStep(function (resultCallback) {
            resultCallback(summary);
        });

    var summary = new global.QNAStep()
        .setTitle("Import Summary")
        .setOutputs([
            new global.QNAVariables()
                .setVariables([
                    new global.QNAVariable()
                        .setType(global.InputEnum.HTML)
                        .setIntro("Content Specification ID")
                        .setName("ContentSpecIDLink")
                        .setValue(function (resultCallback, errorCallback, result, config) {
                            resultCallback("<a href='http://" + config.PressGangHost + ":8080/pressgang-ccms-ui/#ContentSpecFilteredResultsAndContentSpecView;query;contentSpecIds=" + config.ContentSpecID + "'>" + config.ContentSpecID + "</a>");
                        }),
                    new global.QNAVariable()
                        .setType(global.InputEnum.PLAIN_TEXT)
                        .setIntro("Imported From")
                        .setName("ImportedFrom")
                        .setValue(function (resultCallback, errorCallback, result, config) {
                            resultCallback(config.OdtFile.name);
                        }),
                    new global.QNAVariable()
                        .setType(global.InputEnum.PLAIN_TEXT)
                        .setIntro("Topics Created / Topics Reused")
                        .setName("NewTopicsCreated"),
                    new global.QNAVariable()
                        .setType(global.InputEnum.PLAIN_TEXT)
                        .setIntro("Images Created / Images Reused")
                        .setName("NewImagesCreated")
                ])
        ])
        .setShowNext(false)
        .setShowPrevious(false)
        .setShowRestart(true);

}(this));