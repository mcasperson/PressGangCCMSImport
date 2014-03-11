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
                        resultCallback();
                    }
                }
            })
            .setNextStep(function (resultCallback) {
                resultCallback(askForRevisionMessage);
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
                            .setIntro("Getting Mojo Document")
                            .setName("GotMojoDocument"),
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

                resultObject.contentSpec.push("# Imported from " + config.MojoURL);

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

                        config.GotMojoDocument = true;
                        resultCallback();

                        var topicGraph = new specelement.TopicGraph();
                        var mojoDoc = jquery(data);

                        if (mojoDoc.length < 2 || !/div/i.test(mojoDoc[1].nodeName || !/jive-rendered-content/i.test(mojoDoc[1].className))) {
                            errorCallback("Invalid Mojo document", "Could not find the <body><div class='jive-rendered-content'> element!");
                        } else {
                            var childNodeCount = jquery(mojoDoc[1]).children().length;
                            var images = {};
                            var topicsAdded = 0;

                            var processTopic = function (title, parentLevel, outlineLevel, index, content, successCallback) {
                                if (index >= childNodeCount) {
                                    if (content.length !== 0) {
                                        if (topicsAdded > 0) {
                                            if (outlineLevel > 1) {
                                                /*
                                                    This is a child of an existing container. Add it as a regular topic.
                                                 */
                                                var prefix = generalexternalimport.generateSpacing(outlineLevel);
                                                resultObject.contentSpec.push(prefix + qnastart.escapeSpecTitle(title));
                                            } else {
                                                /*
                                                    This is a chapter with a initial text topic
                                                 */
                                                resultObject.contentSpec.push("Chapter: " + qnastart.escapeSpecTitle(title));
                                            }
                                        } else {
                                            resultObject.contentSpec.push("Type = Article");
                                            resultObject.contentSpec.push("Initial Text:");
                                            resultObject.contentSpec.push("  " + qnastart.escapeSpecTitle(title));
                                        }
                                        generalexternalimport.addTopicToSpec(topicGraph, content, title, resultObject.contentSpec.length - 1);
                                    }

                                    successCallback();
                                } else {
                                    var contentNode = jquery(mojoDoc[1]).children()[index];
                                    if (contentNode !== null) {

                                        config.UploadProgress[1] = progressIncrement * (index / childNodeCount);
                                        resultCallback();

                                        /*
                                            The list of rules here controls the top level content that can be placed in a topic.
                                            This usually means paras, lists, programlisting etc.
                                         */

                                        // headers indicate container or topic boundaries
                                        if (/^h\d$/i.test(contentNode.nodeName)) {

                                            var firstChildIsLink = false;
                                            jquery.each(contentNode.childNodes, function(index, value){
                                                if (value.nodeName !== "#text") {
                                                    firstChildIsLink = /^a$/i.test(value.nodeName);
                                                    return false;
                                                }
                                            });

                                            if (firstChildIsLink) {
                                                /*
                                                    It is possible that a header contains only a link, or a link to an image. We treat this
                                                    like a para. e.g.

                                                    <h2>
                                                    <a href="https://mojo.redhat.com/servlet/JiveServlet/showImage/102-934727-22-934162/drupal_use_case.png">
                                                    <img alt="drupal_use_case.png" class="jive-image" height="953" src="https://mojo.redhat.com/servlet/JiveServlet/downloadImage/102-934727-22-934162/drupal_use_case.png" style="width: 620px; height: 479px;" width="1234"/>
                                                    </a>
                                                    </h2>
                                                 */

                                                processPara(content, contentNode, images);
                                            } else {
                                                processHeader(content, contentNode, title, parentLevel, outlineLevel, index, successCallback);
                                                return;
                                            }
                                        } else if (/^p$/i.test(contentNode.nodeName)) {

                                            processPara(content, contentNode, images);
                                        } else if (/^table$/i.test(contentNode.nodeName)) {
                                            processTable(content, contentNode, images);
                                        } else if (/^ul|ol$/i.test(contentNode.nodeName)) {
                                            processList(content, contentNode, images);
                                        } else if (/^pre$/i.test(contentNode.nodeName)) {
                                            processPre(content, contentNode, images);
                                        }

                                        setTimeout(function() {
                                            processTopic(title, parentLevel, outlineLevel, index + 1, content, successCallback);
                                        }, 0);
                                    }
                                }
                            };

                            /*
                                The list of formatting rules here define how content inside the parent nodes is processed.
                             */
                            var convertNodeToDocbook = function (node, emphasis, imageLinks, lineBreaks) {
                                lineBreaks = lineBreaks === undefined ? true : lineBreaks;

                                var customContainerContent = [];
                                for (var childIndex = 0; childIndex < node.childNodes.length; ++childIndex) {
                                    var childNode = node.childNodes[childIndex];
                                    if (childNode.nodeType === Node.TEXT_NODE) {
                                        /*
                                            We want to get the text in the text node with entities. You can only get
                                            the resolved text from a text node (i.e. textContent will return " " if the
                                            text is "&nbsp;" (see http://stackoverflow.com/a/17583527/157605).

                                            So to work around this we take the text node, clone it, append it to a
                                            html element, and use innerHTML to get the text with entities.
                                         */

                                        var textContentWithEntities = jquery("<div/>").append(jquery(childNode).clone()).html();

                                        if (customContainerContent.length === 0) {
                                            customContainerContent.push(textContentWithEntities);
                                        } else {
                                            customContainerContent[customContainerContent.length - 1] += textContentWithEntities;
                                        }
                                    } else if (/^a$/i.test(childNode.nodeName)) {
                                        var href = childNode.getAttribute("href");
                                        if (href !== null) {

                                            // convert relative to absolute
                                            if (/^\//.test(href)) {
                                                href = "https://mojo.redhat.com" + href;
                                            }

                                            var imgs = jquery(">img", jquery(childNode));
                                            if (imgs.length !== 0) {
                                                imageLinks[href] = null;
                                                customContainerContent.push('<mediaobject>');
                                                customContainerContent.push('<imageobject>');
                                                customContainerContent.push('<imagedata fileref="' + href + '"/>');
                                                customContainerContent.push('</imageobject>');
                                                customContainerContent.push('</mediaobject>');
                                            } else {
                                                customContainerContent.push('<ulink url="' + generalexternalimport.cleanTextContent(href) + '">' + generalexternalimport.cleanTextContent(childNode.textContent) + '</ulink>');
                                            }
                                        } else {
                                            customContainerContent.push(generalexternalimport.cleanTextContent(childNode.textContent));
                                        }
                                    }  else if (/^table$/i.test(childNode.nodeName)) {
                                        processTable(customContainerContent, childNode, images);
                                    } else if (/^(ul|ol)$/i.test(childNode.nodeName)) {
                                        processList(customContainerContent, childNode, images);
                                    } else if (/^br$/i.test(childNode.nodeName) && lineBreaks) {
                                        customContainerContent.push("\n");
                                    } else if (/^(strong|em)$/i.test(childNode.nodeName) && emphasis) {
                                        var emphasisChildren = convertNodeToDocbook(childNode, emphasis, imageLinks, false);

                                        // emphasis elements are limited in what child nodes they can accommodate.
                                        // loop over the children to make sure we are not adding any that might conflict
                                        var useEmphasis = true;
                                        jquery.each(emphasisChildren, function (index, value) {
                                            if (/^<\w+/.test(value) && !/^<ulink/.test(value)) {
                                                useEmphasis = false;
                                                return false;
                                            }
                                        });

                                        if (useEmphasis) {
                                            customContainerContent.push("<emphasis>");
                                        }

                                        jquery.merge(customContainerContent, emphasisChildren);

                                        if (useEmphasis) {
                                            customContainerContent.push("</emphasis>");
                                        }
                                    } else if (/^p$/i.test(childNode.nodeName)) {
                                        processPara(customContainerContent, childNode, images);
                                    } else if (/^pre$/i.test(childNode.nodeName)) {
                                        processPre(customContainerContent, childNode, images);
                                    } else if (!(/^div$/i.test(childNode.nodeName) && /toc/i.test(childNode.className))) {
                                        // we don't import the mojo toc
                                        jquery.merge(customContainerContent, convertNodeToDocbook(childNode, emphasis, imageLinks, lineBreaks));
                                    }
                                }

                                return customContainerContent;
                            };

                            var processPre = function (content, contentNode, imageLinks) {
                                var name = contentNode.getAttribute("name");
                                var elementClass = contentNode.getAttribute("class");

                                if (name === "code") {
                                    if (elementClass !== null) {
                                        content.push('<programlisting language="' + elementClass + '">');
                                    } else {
                                        content.push('<programlisting>');
                                    }

                                    jquery.merge(content, convertNodeToDocbook(contentNode, false, imageLinks, false));

                                    content.push("</programlisting>");
                                } else {
                                    content.push('<screen>');

                                    jquery.merge(content, convertNodeToDocbook(contentNode, false, imageLinks, false));

                                    content.push("</screen>");
                                }
                            };

                            var processPara = function (content, contentNode, imageLinks) {
                                var contentNodeText = convertNodeToDocbook(contentNode, true, imageLinks);

                                var hasContent = false;
                                jquery.each(contentNodeText, function(index, value) {
                                    // replace various space characters with a simple space
                                    var fixedValue = value.replace(/\u00a0/g, " ")
                                        .replace(/&nbsp;/g, " ");
                                    if (fixedValue.trim().length !== 0) {
                                        hasContent = true;
                                        return false;
                                    }
                                });

                                if (!hasContent) {
                                    return;
                                }

                                content.push("<para>");
                                jquery.merge(content, contentNodeText);
                                content.push("</para>");
                            };

                            var processTable = function (content, contentNode, imageLinks) {
                                var trs = jquery(">thead>th, >tbody>tr", jquery(contentNode));
                                var maxCols;
                                jquery.each(trs, function (index, value) {
                                    var tds = jquery(">td, >th", jquery(value));
                                    var entries =  tds.length;
                                    if (maxCols === undefined || entries > maxCols) {
                                        maxCols = entries;
                                    }
                                });

                                if (maxCols !== undefined) {
                                    content.push("<table frame='all'><title></title><tgroup cols='" + maxCols + "'>");

                                    for (var col = 1; col <= maxCols; ++col) {
                                        content.push("<colspec colname='c" + col + "'/>");
                                    }

                                    var processCellContents = function (cells) {

                                        var currentColumn = 1;

                                        jquery.each(cells, function(index, cell) {
                                            var rowSpan = "";
                                            var colSpan = "";

                                            if (cell.getAttribute("rowspan") !== null) {
                                                var numRowsToSpan = parseInt(cell.getAttribute("rowspan"));
                                                rowSpan = " morerows='" + (numRowsToSpan - 1) + "'";
                                            }

                                            if (cell.getAttribute("colspan") !== null) {
                                                var numColsToSpan = parseInt(cell.getAttribute("colspan"));
                                                colSpan = " namest='c" + currentColumn + "' nameend='c" + (currentColumn + numColsToSpan - 1) + "'";
                                                currentColumn += numColsToSpan - 1;
                                            }

                                            ++currentColumn;

                                            var cellContents = convertNodeToDocbook(cell, true, imageLinks);
                                            // nested tables need to be handled specially
                                            if (cellContents.length !== 0 && /^<table/.test(cellContents[0])) {
                                                var nestedMaxCols = /cols='(\d+)'>/.exec(cellContents[0])[1];
                                                var fixedCellContents = ["<entrytbl cols='" + nestedMaxCols + "'>"];
                                                // remove the table element, and the last tgroup element close
                                                jquery.merge(fixedCellContents, cellContents.slice(1, cellContents.length - 1));
                                                fixedCellContents.push("</entrytbl>");

                                                jquery.merge(content, fixedCellContents);
                                            } else {
                                                content.push("<entry" + rowSpan + colSpan + ">");
                                                jquery.merge(content, cellContents);
                                                content.push("</entry>");
                                            }
                                        });
                                    };

                                    var thead = jquery(">thead", jquery(contentNode));
                                    if (thead.length !== 0) {

                                        content.push("<thead>");

                                        var theadTrs = jquery(">tr", jquery(thead[0]));
                                        jquery.each(theadTrs, function(index, tr) {
                                            content.push("<row>");

                                            var ths = jquery(">th", jquery(tr));
                                            processCellContents(ths);

                                            // fill in empty cells
                                            for (var i = ths.length; i < maxCols; ++i) {
                                                content.push("<entry>");
                                                content.push("</entry>");
                                            }

                                            content.push("</row>");
                                        });

                                        content.push("</thead>");
                                    }

                                    var tbody = jquery(">tbody", jquery(contentNode));
                                    if (tbody.length !== 0) {

                                        content.push("<tbody>");

                                        var tbodyTrs = jquery(">tr", jquery(tbody[0]));

                                        jquery.each(tbodyTrs, function(index, tr) {
                                            /*
                                             It is possible to get header rows in the body of a table.
                                             HTML allows this, but DocBook does not. So we need to start a new
                                             table.
                                             */
                                            var ths = jquery(">th", jquery(tr));
                                            if (ths.length !== 0) {
                                                content.push("</tbody>");
                                                content.push("</tgroup></table>");
                                                content.push("<table frame='all'><title></title><tgroup cols='" + maxCols + "'>");
                                                content.push("<thead>");

                                                content.push("<row>");

                                                jquery.each(ths, function(index, td) {
                                                    content.push("<entry>");
                                                    jquery.merge(content, convertNodeToDocbook(td, true, imageLinks));
                                                    content.push("</entry>");
                                                });

                                                content.push("</row>");

                                                content.push("</thead>");

                                                content.push("<tbody>");
                                            } else {
                                                content.push("<row>");

                                                var tds = jquery(">td", jquery(tr));
                                                processCellContents(tds);

                                                content.push("</row>");
                                            }
                                        });

                                        content.push("</tbody>");
                                    }

                                    content.push("</tgroup></table>");
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
                                var style = "";

                                if (/ol/i.test(contentNode.nodeName)) {
                                    listType = "orderedlist";
                                    style= ' numeration="arabic"';
                                }

                                var listItems = jquery(">li", contentNode);
                                content.push("<" + listType + style + ">");
                                jquery.each(listItems, function(key, listItem) {
                                    content.push("<listitem><para>");

                                    var listitemText = convertNodeToDocbook(listItem, true, imageLinks);

                                    jquery.each(listitemText, function(index, value) {
                                        listitemText[index] = value.replace(/\n/g, "</para><para>");
                                    });

                                    jquery.merge(content, listitemText);

                                    content.push("</para></listitem>");
                                });
                                content.push("</" + listType + ">");
                            };

                            var processHeader = function (content, contentNode, title, previousLevel, currentLevel, index, successCallback) {
                                ++topicsAdded;

                                var prefix = generalexternalimport.generateSpacing(currentLevel);

                                /*
                                    This value represents the depth of the topic to be created using the title
                                    of the header we just found, and any sibling content nodes before the next
                                    heading.
                                 */
                                var newOutlineLevel = parseInt(/h(\d)/i.exec(contentNode.nodeName)[1]);

                                /*
                                    A content spec can not skip levels in the toc. So when we skip heading levels
                                    (say a heading 3 under a heading 1) we need to pad the spec out.
                                 */
                                if (currentLevel > previousLevel + 1) {
                                    for (var missedSteps = previousLevel + 1; missedSteps < currentLevel; ++missedSteps) {
                                        if (missedSteps === 1) {
                                            resultObject.contentSpec.push("Chapter: Missing Chapter");
                                        } else {
                                            var myPrefix = generalexternalimport.generateSpacing(missedSteps);
                                            resultObject.contentSpec.push(myPrefix + "Section: Missing Section");
                                        }
                                    }

                                    /*
                                        Thanks to the loop above, levels never jump more than 1 place up.
                                     */
                                    previousLevel = currentLevel - 1;
                                }

                                /*
                                 Some convenient statements about what is going on.
                                 */
                                var thisTopicHasContent =  content.length !== 0;
                                var thisTopicIsChildOfLastLevel = currentLevel > previousLevel;
                                var nextTopicIsChildOfLastLevel = newOutlineLevel > previousLevel;
                                var nextTopicIsChildOfThisTopic = newOutlineLevel > currentLevel;

                                if (!thisTopicHasContent && nextTopicIsChildOfThisTopic) {
                                    /*
                                     Last heading had no content before this heading. We only add a container if
                                     the last heading added a level of depth to the tree, Otherwise it is just
                                     an empty container.
                                    */

                                    if (currentLevel === 1) {
                                        resultObject.contentSpec.push("Chapter: " + qnastart.escapeSpecTitle(title));
                                    } else {
                                        resultObject.contentSpec.push(prefix + "Section: " + qnastart.escapeSpecTitle(title));
                                    }
                                } else if (thisTopicHasContent) {
                                    if (currentLevel === 1) {
                                        resultObject.contentSpec.push("Chapter: " + qnastart.escapeSpecTitle(title));
                                    } else {
                                        /*
                                            Does the topic noe being built exist under this one? If so, this topic is
                                             a container. If not, it is just a topic.
                                         */
                                        if (newOutlineLevel > currentLevel) {
                                            resultObject.contentSpec.push(prefix + "Section: " + qnastart.escapeSpecTitle(title));
                                        } else {
                                            resultObject.contentSpec.push(prefix + qnastart.escapeSpecTitle(title));
                                        }
                                    }

                                    generalexternalimport.addTopicToSpec(topicGraph, content, title, resultObject.contentSpec.length - 1);
                                } else {
                                    /*
                                        If the discarded topic was supposed to a child of the container
                                        above it, and the new topic being created is not, then the
                                        previous topic will need to be changed from a container to a topic.
                                    */
                                    if (thisTopicIsChildOfLastLevel && !nextTopicIsChildOfLastLevel) {
                                        resultObject.contentSpec[resultObject.contentSpec.length - 1] =
                                            resultObject.contentSpec[resultObject.contentSpec.length - 1].replace(/^(\s*)[A-Za-z]+: /, "$1");

                                        /*
                                         We want to unwind any containers without front matter topics that were
                                         added to the toc to accommodate this now discarded topic.

                                         So any line added to the spec that doesn't have an associated topic and
                                         that is not an ancestor of the next topic will be poped off the stack.
                                         */
                                        if (currentLevel > 1) {
                                            while (true) {
                                                var specElementTopic = topicGraph.getNodeFromSpecLine(resultObject.contentSpec.length - 1);
                                                if (specElementTopic === undefined) {
                                                    var specElementLevel = /^(\s*)/.exec(resultObject.contentSpec[resultObject.contentSpec.length - 1]);
                                                    if (specElementLevel[1].length === newOutlineLevel - 2) {
                                                        break;
                                                    } else {
                                                        resultObject.contentSpec.pop();
                                                    }
                                                } else {
                                                    break;
                                                }
                                            }
                                        }
                                    }

                                    /*
                                     Since this topic is being discarded, the parent outline level continues through
                                     */
                                    currentLevel = previousLevel;
                                }

                                var newTitleArray = convertNodeToDocbook(contentNode, false, images, false);
                                var newTitle = "";
                                jquery.each(newTitleArray, function(index, value){
                                   newTitle += value;
                                });
                                if (newTitle.length === 0) {
                                    newTitle = "Untitled";
                                }

                                newTitle = newTitle.replace(/^(\d+)(\.\d+)*\.?\s*/, "");

                                setTimeout(function() {
                                    processTopic(newTitle, currentLevel, newOutlineLevel, index + 1, [], successCallback);
                                }, 0);
                            };

                            processTopic(
                                "Untitled",
                                1,
                                1,
                                0,
                                [],
                                function() {
                                    config.UploadProgress[1] = progressIncrement;
                                    config.ResolvedBookStructure = true;
                                    resultCallback();

                                    uploadImagesLoop(topicGraph, images);
                                }
                            );
                        }
                    },
                    errorCallback
                );

                var uploadImages = function (index, topicGraph, images, imagesKeys, callback) {
                    if (index >= imagesKeys.length) {
                        callback();
                    } else {
                        config.UploadProgress[1] = progressIncrement + (index / imagesKeys.length * progressIncrement);
                        resultCallback();

                        var imagePath = imagesKeys[index];

                        qnastart.createImageFromURL(
                            config.CreateOrResuseImages === "REUSE",
                            imagePath,
                            config,
                            function (data) {
                                var id = config.CreateOrResuseImages === "REUSE" ? data.image.id : data.id;
                                images[imagePath] = "images/" + id + imagePath.substr(imagePath.lastIndexOf("."));

                                config.UploadedImageCount += 1;

                                if (config.CreateOrResuseImages === "REUSE" && data.matchedExistingImage) {
                                    config.MatchedImageCount += 1;
                                }

                                config.NewImagesCreated = (config.UploadedImageCount - config.MatchedImageCount) + " / " + config.MatchedImageCount;
                                resultCallback();

                                uploadImages(index + 1, topicGraph, images, imagesKeys, callback);
                            },
                            errorCallback
                        );
                    }
                };

                var uploadImagesLoop = function(topicGraph, images) {
                    uploadImages(
                        0,
                        topicGraph,
                        images,
                        qnautils.keys(images),
                        function() {
                            config.UploadProgress[1] = progressIncrement * 2;
                            config.UploadedImages = true;
                            resultCallback();

                            jquery.each(topicGraph.nodes, function (index, topic) {
                                var filerefs = qnautils.xPath(".//@fileref", topic.xml);
                                var replacements = [];
                                var fileref;
                                while ((fileref = filerefs.iterateNext()) !== null) {
                                    replacements.push({attr: fileref, value: images[fileref.nodeValue]});
                                }

                                jquery.each(replacements, function (index, replacement) {
                                    replacement.attr.nodeValue = replacement.value;
                                });
                            }
                        );

                        createTopicsLoop(topicGraph);
                    });
                };

                var createTopics = function (index, topicGraph, callback) {
                    if (index >= topicGraph.nodes.length) {
                        callback();
                    } else {
                        config.UploadProgress[1] = progressIncrement * 2  + (index / topicGraph.nodes.length * progressIncrement);
                        resultCallback();

                        var topic = topicGraph.nodes[index];

                        qnastart.createTopic(
                            config.CreateOrResuseTopics === "REUSE",
                            4.5,
                            qnautils.reencode(qnautils.xmlToString(topic.xml), topic.xmlReplacements).trim(),
                            topic.title,
                            null,
                            config, function (data) {

                                var topicId = config.CreateOrResuseTopics === "REUSE" ? data.topic.id : data.id;
                                var topicXML = config.CreateOrResuseTopics === "REUSE" ? data.topic.xml : data.xml;

                                config.UploadedTopicCount += 1;

                                if (config.CreateOrResuseImages === "REUSE" && data.matchedExistingTopic) {
                                    config.MatchedTopicCount += 1;
                                }

                                config.NewTopicsCreated = (config.UploadedTopicCount - config.MatchedTopicCount) + " / " + config.MatchedTopicCount;
                                resultCallback();

                                topic.setTopicId(topicId);
                                topic.setXmlReplacements(qnautils.replaceEntitiesInText(topicXML));

                                createTopics(index + 1, topicGraph, callback);
                            },
                            errorCallback
                        );
                    }
                };

                var createTopicsLoop = function(topicGraph) {
                    createTopics(
                        0,
                        topicGraph,
                        function() {
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
                        }
                    );
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
                                resultCallback(config.MojoURL);
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