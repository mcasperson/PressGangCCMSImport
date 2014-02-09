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
                            .setValue("Red Hat")
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
        .setTitle("Processing the ODT file")
        .setIntro("Please wait while the ODT file is processed")
        .setEnterStep(function (resultCallback, errorCallback, result, config) {
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

                        var depth = 0;

                        var processTopic = function (title, outlineLevel) {
                            var content = "";
                            var contentNode;
                            while ((contentNode = contentNodes.iterateNext()) !== null) {

                                var prefix = "";
                                for (var i = 0; i < outlineLevel * 2; ++i) {
                                    prefix += " ";
                                }

                                // headers indicate container or topic boundaries
                                if (contentNode.nodeName === "text:h") {

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

                                    break;
                                } else if (contentNode.nodeName === "text:p") {
                                    if (contentNode.textContent.trim().length !== 0) {
                                        content += "<para>" + contentNode.textContent + "</para>";
                                    }
                                } else if (contentNode.nodeName === "text:list") {
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
                                        content += "<itemizedlist>";
                                        content += listItemsHeaderContent;

                                        do {
                                            content += "<listitem><para>" + listItem.textContent + "</para></listitem>";
                                        } while ((listItem = listItems.iterateNext()) !== null);

                                        content += "</itemizedlist>";
                                    } else {
                                        // we have found a list that contains only a header. this is really just a para
                                        content += listItemsHeaderContent;
                                    }
                                }
                            }
                        };

                        processTopic(null, 0);

                        global.jQuery.each(contentSpec, function(index, value) {
                           console.log(value);
                        });

                        var createTopics = function (index, callback) {
                            if (index >= topicGraph.nodes.length) {
                                callback();
                            } else {
                                var topic = topicGraph.nodes[index];

                                global.createTopic(
                                    true,
                                    global.xmlToString(topic.xml),
                                    topic.title,
                                    null,
                                    config, function (data) {
                                        topic.setTopicId(data.topic.id);
                                        topic.xml = global.jQuery.parseXML(data.topic.xml);

                                        createTopics(index + 1, callback);
                                    },
                                    errorCallback
                                );
                            }
                        };

                        createTopics(0, function(){
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
                                    console.log("Content Spec ID: " + id);
                                },
                                errorCallback
                            );
                        });


                    }
                },
                errorCallback
            );



        });

}(this));