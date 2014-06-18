define(
    ['jquery', 'async/async', 'qna/qna', 'qna/qnautils', 'qna/qnazipmodel', 'qnastart', 'restcalls', 'specelement', 'uri/URI', 'constants', 'reportsettings', 'moment', 'xmlcompare', 'exports'],
    function (jquery, async, qna, qnautils, qnazipmodel, qnastart, restcalls, specelement, URI, constants, reportsettings, moment, xmlcompare, exports) {
        'use strict';

        /*
         A step in the QNA system is a hierarchy of objects.

         The QNAStep represents one entire step in the wizard.
         Each QNAStep holds zero or more QNAVariables. QNAVariables are collections of QNAVariable objects.
         Each QNAVariables holds one or more QNAVariable objects. A QNAVariable is a UI element that the user is expected to supply a value for.

         You will note that each level in the hierarchy and each value for the objects in the hierarchy are calculated
         via callbacks. If each step in the wizard is known, these callbacks can just return static values. If the
         steps require some kind of processing in order to determine the correct values shown to the user, these callbacks
         can perform any kind of async operation (querying a server, reading a file etc) that they need to.
         */

        var REVISION_HISTORY_TAG_ID;
        var AUTHOR_GROUP_TAG_ID ;
        var ABSTRACT_TAG_ID;
        var LEGAL_NOTICE_TAG_ID;
        var INFO_TAG_ID;
        var DEFAULT_TITLE = "Untitled";
        // These docbook elements represent containers or topics. Anything else is added as the XML of a topic.
        var CONTAINER_TYPES = ["part", "chapter", "appendix", "section", "preface", "simplesect", "sect1", "sect2", "sect3", "sect4", "sect5"];
        // these docbook elements represent topics
        var TOPIC_CONTAINER_TYPES = ["section", "simplesect", "sect1", "sect2", "sect3", "sect4", "sect5"];
        // these elements are changed into info topics. Only info elements that belong to containers are listed here.
        var INFO_TOPIC_ELEMENTS = [
            "articleinfo",
            "bookinfo",
            "info",
            "chapterinfo",
            "appendixinfo",
            "partinfo",
            "sectioninfo",
            "setinfo"];
        // These containers are remapped to sections
        var SECTION_CONTAINERS = [
            "section",
            "simplesect",
            "sect1",
            "sect2",
            "sect3",
            "sect4",
            "sect5"
        ];

        var DEAFULT_REV_HISTORY_TITLE = "Revision History";
        var DEAFULT_LEGAL_NOTICE_TITLE = "Legal Notice";

        var XINCLUDE_NS = "http://www.w3.org/2001/XInclude";
        var XINCLUDE_LOCALNAME = "include";
        var XINCLUDE_HREF_ATTR = "href";

        function xmlDocIsArticle(xmlDoc) {
           return xmlDoc.documentElement.nodeName === "article";
        }

        function xmlDocIsBook(xmlDoc) {
            return xmlDoc.documentElement.nodeName === "book";
        }

        function nodeIsContainer(xmlNode) {
            return CONTAINER_TYPES.indexOf(xmlNode.nodeName) !== -1;
        }

        function nodeIsCommonContentXInclude(xmlNode) {
            if (xmlNode.localName === XINCLUDE_LOCALNAME &&
                xmlNode.namespaceURI === XINCLUDE_NS &&
                xmlNode.hasAttribute(XINCLUDE_HREF_ATTR) &&
                constants.COMMON_CONTENT_PATH_PREFIX.test(xmlNode.getAttribute(XINCLUDE_HREF_ATTR))) {
                return true;
            }

            return false;
        }

        function createContentSpecSpacingPrefix(depth) {
            // what we have left is the contents of a initial text topic
            var contentSpecLine = "";
            for (var i = 0; i < depth * 2; ++i) {
                contentSpecLine += " ";
            }
            return contentSpecLine;
        }

        function getSpecDocbookVersion(config) {
            return config.ImportOption === constants.DOCBOOK_50_IMPORT_OPTION ? "5.0" : "4.5";
        }

        function getDocumentFormat(config) {
            return config.ImportOption === constants.DOCBOOK_50_IMPORT_OPTION ? constants.DOCBOOK_50 : constants.DOCBOOK_45;
        }

        function getDocbookVersion(config) {
            return config.ImportOption === constants.DOCBOOK_50_IMPORT_OPTION ? 5 : 4.5;
        }

        function getIgnoredFiles(lang) {
            // these files are created by csprocessor
            return [lang + "/files/pressgang_website.js"];
        }

        /**
         * Titles in a content spec need to have certain characters, like square brackets, escaped
         * @param title
         */
        function encodeTitle(title) {
            return title.replace(/\[/g, "\\[")
                .replace(/\]/g, "\\]");
        }

        /*
            Some containers are remaped when placed in a content spec. We return a chapter for a section
            at level 0 in a book because some asciidoc conversions don't properly nest sections in chapters
            when building a book.
         */
        function remapContainer(container, depth, article) {
            for (var index = 0; index < SECTION_CONTAINERS.length; ++index) {
                if (container === SECTION_CONTAINERS[index]) {
                    if (article !== undefined && depth !== undefined && article === false && depth === 0) {
                        return "chapter";
                    }

                    return "section";
                }
            }

            return container;
        }

        function loadSetting(file, setting) {
            var retValue;
            var lines = file.split("\n");
            jquery.each(lines, function (index, value) {
                var keyValue = value.split(":");
                if (keyValue.length === 2) {
                    if (new RegExp(qnautils.escapeRegExp(setting.trim())).test(keyValue[0].trim())) {
                        retValue = keyValue[1].trim();
                        return false;
                    }
                }
            });
            return retValue;
        }

        function replaceElement (elementName, newElementName, xmlText) {
            if (xmlText.indexOf("<" + elementName) === 0) {
                xmlText = xmlText.replace(new RegExp("^<" + qnautils.escapeRegExp(elementName)), "<" + newElementName);
                xmlText = xmlText.replace(new RegExp("</" + qnautils.escapeRegExp(elementName) + ">$"), "</" + newElementName + ">");
            }

            return xmlText;
        }



        /*
         Ask for a revision message
         */
        exports.askForRevisionMessage = new qna.QNAStep()
            .setTitle("Enter a message for the revision log")
            .setIntro("Each new topic, image and content specification created by this import process will have this revision message in the log.")
            .setInputs([
                new qna.QNAVariables()
                    .setVariables([
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.TEXTBOX)
                            .setIntro("Revision Log Message")
                            .setValue(function (resultCallback, errorCallback, result, config) {
                                if (config.SourceURL) {
                                    resultCallback("Imported from " + config.SourceURL);
                                } else {
                                    resultCallback("Imported from " + qnautils.getInputSourceName(config.InputSource));
                                }
                            })
                            .setName("RevisionMessage")
                    ])
            ])
            .setNextStep(function (resultCallback, errorCallback, result, config) {
                resultCallback(processZipFile);
            })
            .setShowNext("Start Import");

        /*
         Process the zip file
         */
        var processZipFile = new qna.QNAStep()
            .setTitle("Importing DocBook")
            .setIntro("The list below allows you to monitor the progress of the import process. Steps with an asterisk (*) can take some time to complete, so please be patient.")
            .setOutputs([
                new qna.QNAVariables()
                    .setVariables([
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.CHECKBOX)
                            .setIntro("Finding revision history")
                            .setName("FoundRevisionHistory"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.CHECKBOX)
                            .setIntro("Finding author group")
                            .setName("FoundAuthorGroup"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.CHECKBOX)
                            .setIntro("Finding legal notice")
                            .setName("FoundLegalNotice"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.CHECKBOX)
                            .setIntro("Finding abstract")
                            .setName("FoundAbstract"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.CHECKBOX)
                            .setIntro("Finding and uploading files*")
                            .setName("FoundFiles"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.CHECKBOX)
                            .setIntro("Finding and uploading images*")
                            .setName("FoundImages"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.CHECKBOX)
                            .setIntro("Resolving book structure")
                            .setName("ResolvedBookStructure"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.CHECKBOX)
                            .setIntro("Match existing topics*")
                            .setName("MatchedExistingTopics"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.CHECKBOX)
                            .setIntro("Resolving xref graphs")
                            .setName("ResolvedXRefGraphs"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.CHECKBOX)
                            .setIntro("Uploading Topics*")
                            .setName("UploadedTopics"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.CHECKBOX)
                            .setIntro("Fixing xrefs*")
                            .setName("FixXRefs"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.CHECKBOX)
                            .setIntro("Updating Content Spec")
                            .setName("UpdatedContentSpec"),
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
                            .setType(qna.InputEnum.PLAIN_TEXT)
                            .setIntro("Files Created / Files Reused")
                            .setName("NewFilesCreated"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.PROGRESS)
                            .setIntro("Progress")
                            .setName("UploadProgress")
                            // gotta set this first up because of https://github.com/angular-ui/bootstrap/issues/1547
                            .setValue([100, 0])
                    ])
            ])
            .setEnterStep(function (resultCallback, errorCallback, result, config) {

                var thisStep = this;

                var updateProgress = function(value, setToTrue) {
                    if (setToTrue) {
                        config[setToTrue] = true;
                    }
                    config.UploadProgress[1] = value;
                    thisStep.setTitlePrefixPercentage(value);
                    resultCallback();
                }

                function updatingTopics() {
                    return config.CreateOrResuseTopics !== "CREATE" &&  config[constants.CREATE_OR_OVERWRITE_CONFIG_KEY] === constants.OVERWRITE_SPEC;
                }

                function reusingTopics() {
                    return config.CreateOrResuseTopics !== "CREATE" &&  config[constants.CREATE_OR_OVERWRITE_CONFIG_KEY] === constants.CREATE_SPEC;
                }

                var resultParsed = JSON.parse(result);
                var xmlDetails = qnautils.replaceEntitiesInText(resultParsed.xml);
                var xmlDoc = qnautils.stringToXML(xmlDetails.xml);
                var entities = resultParsed.entities;
                var replacements = xmlDetails.replacements;

                var inputModel = qnastart.getInputModel(config);

                window.onbeforeunload=function() {
                    return "The import process is in progress. Are you sure you want to quit?";
                };

                /*
                 Initialize some config values
                 */
                config.UploadedTopicCount = 0;
                config.MatchedTopicCount = 0;
                config.UploadedImageCount = 0;
                config.MatchedImageCount = 0;
                config.UploadedFileCount = 0;
                config.MatchedFileCount = 0;
                config.OutgoingUrls = "";
                config.ReusedTopics = "";
                config.NewTopics = "";
                config.UpdatedTopics = "";

                function addItemToCommaSeperatedList(string, id) {
                    if (string.indexOf(id) === -1) {
                        if (string.length !== 0) {
                            string += ",";
                        }
                        string += id;
                    }
                    return string;
                }

                function addTopicToReusedTopics(id) {
                    config.ReusedTopics = addItemToCommaSeperatedList(config.ReusedTopics, id);
                }

                function addTopicToNewTopics(id) {
                    config.NewTopics = addItemToCommaSeperatedList(config.NewTopics, id);
                }

                function addTopicToUpdatedTopics(id) {
                    config.UpdatedTopics = addItemToCommaSeperatedList(config.UpdatedTopics, id);
                }

                function setAsNewTopic(topic) {
                    topic.setNewTopic();
                    ++config.UploadedTopicCount;
                }

                function setAsReusedTopic(topic, id) {
                    topic.setTopicId(id);
                    ++config.UploadedTopicCount;
                    ++config.MatchedTopicCount;

                    if (reusingTopics()) {
                        addTopicToReusedTopics(id);
                    }
                }

                function setAsOverwrittenTopic(topic, id, originalXml) {
                    topic.setTopicId(id);
                    topic.setOriginalTopicXML(originalXml);
                    ++config.UploadedTopicCount;
                    ++config.MatchedTopicCount;
                }

                /*
                 There are 17 steps, so this is how far to move the progress bar with each
                 step.
                 */
                var progressIncrement = 100 / 20;

                /*
                    Define the computation steps
                 */
                var computation = [];
                computation.push(function(callback) {loadTagIDs(callback)});
                computation.push(function(callback) {buildContentSpec(xmlDoc, entities, callback)});
                computation.push(function(xmlDoc, contentSpec, topics, topicGraph, callback) {extractRevisionHistory(xmlDoc, contentSpec, topics, topicGraph, callback)});
                computation.push(function(xmlDoc, contentSpec, topics, topicGraph, callback) {extractAuthorGroup(xmlDoc, contentSpec, topics, topicGraph, callback)});
                computation.push(function(xmlDoc, contentSpec, topics, topicGraph, callback) {extractLegalNotice(xmlDoc, contentSpec, topics, topicGraph, callback)});
                computation.push(function(xmlDoc, contentSpec, topics, topicGraph, callback) {extractAbstract(xmlDoc, contentSpec, topics, topicGraph, callback)});
                computation.push(function(xmlDoc, contentSpec, topics, topicGraph, callback) {uploadFiles(xmlDoc, contentSpec, topics, topicGraph, callback)});
                computation.push(function(xmlDoc, contentSpec, topics, topicGraph, callback) {uploadImages(xmlDoc, contentSpec, topics, topicGraph, callback)});
                computation.push(function(xmlDoc, contentSpec, topics, topicGraph, callback) {resolveBookStructure(xmlDoc, contentSpec, topics, topicGraph, callback)});

                /*
                 Which topics we choose to overwrite depends on whether we are overwriting a spec
                 or creating a new one
                 */

                if (updatingTopics()) {
                    computation.push(function (xmlDoc, contentSpec, topics, topicGraph, callback) {
                        matchExistingTopicsInSpec(xmlDoc, contentSpec, topics, topicGraph, callback)
                    });
                } else if (reusingTopics()) {
                    computation.push(function(xmlDoc, contentSpec, topics, topicGraph, callback) {matchExistingTopics(xmlDoc, contentSpec, topics, topicGraph, callback)});
                    computation.push(function(xmlDoc, contentSpec, topics, topicGraph, callback) {populateOutgoingLinks(xmlDoc, contentSpec, topics, topicGraph, callback)});
                    computation.push(function(xmlDoc, contentSpec, topics, topicGraph, callback) {resolveXrefs(xmlDoc, contentSpec, topics, topicGraph, callback)});

                }

                computation.push(function(xmlDoc, contentSpec, topics, topicGraph, callback) {uploadTopics(xmlDoc, contentSpec, topics, topicGraph, callback)});
                computation.push(function(xmlDoc, contentSpec, topics, topicGraph, callback) {identifyOutgoingLinks(xmlDoc, contentSpec, topics, topicGraph, callback)});
                computation.push(function(xmlDoc, contentSpec, topics, topicGraph, callback) {resolveXrefsInCreatedTopics(xmlDoc, contentSpec, topics, topicGraph, callback)});
                computation.push(function(xmlDoc, contentSpec, topics, topicGraph, callback) {updateContentSpecWithTopicIDs(xmlDoc, contentSpec, topics, topicGraph, callback)});
                computation.push(function(contentSpec, callback) {uploadContentSpec(contentSpec, callback)});

                /*
                    Execute the steps
                 */
                async.waterfall(computation, function(err, result) {
                        resultCallback(true);
                    }
                );

                /*
                    Load the tag ids for various tags used during the import
                 */
                function loadTagIDs(callback) {
                    REVISION_HISTORY_TAG_ID = qnastart.loadEntityID("revisionHistoryTagId");
                    AUTHOR_GROUP_TAG_ID = qnastart.loadEntityID("authorGroupTagId");
                    ABSTRACT_TAG_ID = qnastart.loadEntityID("abstractTagId");
                    LEGAL_NOTICE_TAG_ID = qnastart.loadEntityID("legalNoticeTagId");
                    INFO_TAG_ID = qnastart.loadEntityID("infoTagId");
                    callback(null);
                }

                var removeIdAttribute = function (xml) {
                    if (xml.hasAttribute("id")) {
                        xml.removeAttribute("id");
                    }
                    return xml;
                };

                /*
                    Get the first info element under the container, add it as a topic, and return
                    the title.
                 */
                function extractInfoTopic(xmlDoc, contentSpecIndex, parent, topics, topicGraph) {
                    var removeElements = [];
                    var title = null;
                    jquery.each(INFO_TOPIC_ELEMENTS, function (index, value) {
                        var iterator = qnautils.xPath("./docbook:" + value, parent);

                        /*
                            We import the first one
                         */
                        var infoElement = iterator.iterateNext();
                        if (infoElement !== null) {
                            var topic = new specelement.TopicGraphNode(topicGraph)
                                .setXml(removeIdAttribute(infoElement))
                                .setSpecLine(contentSpecIndex)
                                .setTitle("Info")
                                .addTag(INFO_TAG_ID)
                                .setInfoTopic(true);

                            var id = infoElement.getAttribute("id");
                            if (id) {
                                topic.addXmlId(id);
                            }
                            topics.push(topic);
                            removeElements.push(infoElement);

                            /*
                             Grab the first title element of the first info element that we can
                             */
                            var titleElement = qnautils.xPath("./docbook:title", infoElement).iterateNext();
                            if (titleElement !== null) {
                                if (title === null) {
                                    title = titleElement.innerHTML;
                                }

                                /*
                                 All topics and contains must have a title. This means that the
                                 info elements must not (this is a DocBook restriction).

                                 If this is valid docbook, and the info element has a title, it means
                                 the container it is in does not have a title. Here we take the title
                                 of the info element, assign it to the container (that is what the
                                 return value of this function is for), and remove the title from
                                 the info element.
                                 */
                                 removeElements.push(titleElement);
                            }
                        }

                        /*
                            There shouldn't be any more, but we remove any if there are
                         */
                        var otherInfoElements = null;
                        while ((otherInfoElements = iterator.iterateNext()) !== null) {
                            removeElements.push(otherInfoElements);
                        }
                    });

                    jquery.each(removeElements, function(index, removeElement) {
                        removeElement.parentNode.removeChild(removeElement);
                    });

                    return title;
                }

                function buildContentSpec(xmlDoc, entities, callback) {
                    var contentSpec = [];

                    /*
                     These metadata elements are either required or will always have a value
                     */
                    contentSpec.push("Title = " + (config.ContentSpecTitle === undefined ? "Unknown" : config.ContentSpecTitle));
                    contentSpec.push("Product = " + (config.ContentSpecProduct === undefined ? "Unknown" : config.ContentSpecProduct));
                    contentSpec.push("Format = DocBook " + getSpecDocbookVersion(config));
                    if (config.ContentSpecVersion && config.ContentSpecVersion.trim().length !== 0) {
                        contentSpec.push("Version = " + config.ContentSpecVersion);
                    }

                    /*
                     These metadata elements are optional
                     */
                    if (config.ContentSpecSubtitle !== undefined && config.ContentSpecSubtitle.trim().length !== 0) {
                        contentSpec.push("Subtitle = " + config.ContentSpecSubtitle);
                    }
                    if (config.ContentSpecEdition !== undefined && config.ContentSpecEdition.trim().length !== 0) {
                        contentSpec.push("Edition = " + config.ContentSpecEdition);
                    }
                    if (config.ContentSpecPubsnumber !== undefined && config.ContentSpecPubsnumber.trim().length !== 0) {
                        contentSpec.push("Pubsnumber = " + config.ContentSpecPubsnumber);
                    }

                    /*
                     If no brand was specified, let csprocessor use the default
                     */
                    if (config.ImportBrand !== undefined) {
                        // this is the value found from the publican.cfg file
                        contentSpec.push("Brand = " + config.ImportBrand);
                    }  else if (config.ContentSpecBrand !== undefined) {
                        // this is the value specified in the ui
                        contentSpec.push("Brand = " + config.ContentSpecBrand);
                    }

                    if (xmlDocIsBook(xmlDoc)) {
                        if (xmlDoc.documentElement.hasAttribute("status") && xmlDoc.documentElement.attributes["status"].nodeValue.trim() === "draft") {
                            contentSpec.push("Type = Book-Draft");
                        } else {
                            contentSpec.push("Type = Book");
                        }

                    } else if (xmlDocIsArticle(xmlDoc)) {
                        if (xmlDoc.documentElement.hasAttribute("status") && xmlDoc.documentElement.attributes["status"].nodeValue.trim() === "draft") {
                            contentSpec.push("Type = Article-Draft");
                        } else {
                            contentSpec.push("Type = Article");
                        }
                    }

                    // we always populate our own preface
                    contentSpec.push("Default Preface = Off");


                    if (config.Index !== undefined) {
                        contentSpec.push("Index = " + config.Index);
                    }

                    if (resultParsed.contentSpec !== undefined && resultParsed.contentSpec.length !== 0) {
                        contentSpec = jquery.merge(contentSpec, resultParsed.contentSpec);
                    }

                    if (config.ImportCondition !== undefined) {
                        contentSpec.push("[condition = " + config.ImportCondition + "]");
                    }

                    /*
                     Some entities need to be converted to metadata elements
                     */
                    var removedEntities = [];
                    var copyrightYear = null;
                    var copyrightHolder = null;
                    jquery.each(entities, function(index, value){
                        var entityMatch;
                        if ((entityMatch = /<!ENTITY\s+HOLDER\s+('|")(.*?)('|")>/.exec(value)) !== null) {
                            removedEntities.push(index);
                            // save the first one
                            if (!copyrightHolder) {
                                copyrightHolder = "Copyright Holder = " + entityMatch[2];
                            }
                        }

                        if ((entityMatch = /<!ENTITY\s+YEAR\s+('|")(.*?)('|")>/.exec(value)) !== null) {
                            removedEntities.push(index);
                            // save the first one
                            if (!copyrightYear) {
                                copyrightYear = "Copyright Year = " + entityMatch[2];
                            }
                        }
                    });

                    if (!copyrightHolder) {
                        contentSpec.push("Copyright Holder = Red Hat");
                    } else {
                        contentSpec.push(copyrightHolder);
                    }

                    if (copyrightYear) {
                        contentSpec.push(copyrightYear);
                    }

                    // save the remaining entities
                    if (entities.length !== 0) {
                        contentSpec.push("Entities = [");
                        jquery.each(entities, function(index, value){
                            if (removedEntities.indexOf(index) === -1) {
                                contentSpec.push(encodeTitle(value));
                            }
                        });

                        contentSpec.push("]");
                    }

                    callback(null, xmlDoc, contentSpec, [], new specelement.TopicGraph());
                }

                function extractRevisionHistory (xmlDoc, contentSpec, topics, topicGraph, callback) {
                    var revHistory = qnautils.xPath("//docbook:revhistory", xmlDoc).iterateNext();

                    if (revHistory) {

                        var parentAppendix = revHistory;
                        while (parentAppendix.parentNode &&
                            CONTAINER_TYPES.indexOf((parentAppendix = parentAppendix.parentNode).nodeName) === -1) {
                        }

                        var revHistoryTitleContents;
                        var revHistoryTitle = qnautils.xPath("./docbook:title", parentAppendix).iterateNext();
                        if (revHistoryTitle !== null) {
                            var match = /<title\s*.*?>(.*?)<\/title>/.exec(qnautils.xmlToString(revHistoryTitle));
                            if (match !== null) {
                                revHistoryTitleContents = match[1];
                            } else {
                                revHistoryTitleContents = DEAFULT_REV_HISTORY_TITLE;
                            }
                        } else {
                            revHistoryTitleContents = DEAFULT_REV_HISTORY_TITLE;
                        }

                        var replacementNodeDetails = [];

                        // fix any dates. right now we just trim strings, but this could be
                        // a good opportunity to fix common date formats
                        var dates = qnautils.xPath(".//docbook:date", revHistory);
                        var date;

                        while ((date = dates.iterateNext()) !== null) {
                            var dateContents = date.textContent;
                            replacementNodeDetails.push({original: date, replacement: dateContents.trim()});
                        }

                        // fix rev numbers
                        var revnumbers = qnautils.xPath(".//docbook:revnumber", revHistory);
                        var revnumber;
                        while ((revnumber = revnumbers.iterateNext()) !== null) {
                            var revContents = revnumber.textContent;
                            var revMatch = /^(\d+)\.(\d+)$/.exec(revContents.trim());
                            if (revMatch !== null) {
                                replacementNodeDetails.push({original: revnumber, replacement: revContents.replace(/\./g, "-")});
                            }
                        }

                        jquery.each(replacementNodeDetails, function(index, value){
                            value.original.textContent = value.replacement;
                        });

                        contentSpec.push("Revision History = ");

                        /*
                            Check to see if the appendix that holds the revision history also has
                            other containers that we would want to extract.
                         */
                        var revisionAppendixHasOtherChildren = false;
                        jquery.each(CONTAINER_TYPES, function(index, value) {
                            if (qnautils.xPath(".//docbook:" + value, parentAppendix).iterateNext() !== null) {
                                revisionAppendixHasOtherChildren = true;
                                return false;
                            }
                        })

                        var topic = null;
                        if (revisionAppendixHasOtherChildren) {

                            var appendix = xmlDoc.createElement("appendix");
                            var title = xmlDoc.createElement("title");
                            title.textContent = revHistoryTitleContents;
                            appendix.appendChild(title);
                            appendix.appendChild(revHistory);

                            var topic = new specelement.TopicGraphNode(topicGraph)
                                .setXml(appendix)
                                .setSpecLine(contentSpec.length - 1)
                                .setTitle(revHistoryTitleContents)
                                .addTag(REVISION_HISTORY_TAG_ID);
                        } else {
                            var id = parentAppendix.getAttribute ? parentAppendix.getAttribute("id") : null;

                            var topic = new specelement.TopicGraphNode(topicGraph)
                                .setXml(parentAppendix)
                                .setSpecLine(contentSpec.length - 1)
                                .setTitle(revHistoryTitleContents)
                                .addTag(REVISION_HISTORY_TAG_ID);

                            if (id) {
                                topic.addXmlId(id);
                            }

                            /*
                             The appendex holding the revision history is extracted wholesale, and
                             won't be processed again by the rest of this process.
                             */
                            if (parentAppendix.parentNode !== null) {
                                parentAppendix.parentNode.removeChild(parentAppendix);
                            }
                        }

                        topics.push(topic);
                    }

                    updateProgress(7 * progressIncrement, "FoundRevisionHistory");
                    callback(null, xmlDoc, contentSpec, topics, topicGraph);
                }

                function extractAuthorGroup (xmlDoc, contentSpec, topics, topicGraph, callback) {

                    var specAuthorGroup = qnautils.stringToXML("<authorgroup></authorgroup>");
                    var authorGroups = qnautils.xPath("//docbook:authorgroup", xmlDoc);
                    var authorGroupIds = [];
                    var authorGroup;
                    while ((authorGroup = authorGroups.iterateNext()) !== null) {

                        var id = authorGroup.getAttribute("id");
                        if (id !== null) {
                            authorGroupIds.push(id);
                        }

                        jquery.each(authorGroup.childNodes, function (index, value) {
                            specAuthorGroup.documentElement.appendChild(qnautils.getOwnerDoc(specAuthorGroup).importNode(value, true));
                        });

                        // only process the first author group. TODO: do we need to pick up more than one?
                        break;
                    }

                    if (specAuthorGroup.documentElement.childNodes.length !== 0) {
                        contentSpec.push("Author Group = ");

                        var topic = new specelement.TopicGraphNode(topicGraph)
                            .setXml(removeIdAttribute(specAuthorGroup.documentElement))
                            .setSpecLine(contentSpec.length - 1)
                            .setTitle("Author Group")
                            .addTag(AUTHOR_GROUP_TAG_ID);

                        jquery.each(authorGroupIds, function (index, value) {
                            topic.addXmlId(value);
                        });

                        topics.push(topic);
                    }

                    updateProgress(8 * progressIncrement, "FoundAuthorGroup");
                    resultCallback();

                    callback(null, xmlDoc, contentSpec, topics, topicGraph);
                }

                function extractLegalNotice (xmlDoc, contentSpec, topics, topicGraph, callback) {

                    var legalNotice = qnautils.xPath("//docbook:legalnotice", xmlDoc).iterateNext();

                    if (legalNotice) {

                        var legalNoticeTitleContents;
                        var legalNoticeTitle = qnautils.xPath("./docbook:title", legalNotice).iterateNext();
                        if (legalNoticeTitle !== null) {
                            var match = /<title\s*.*?>(.*?)<\/title>/.exec(qnautils.xmlToString(legalNoticeTitle));
                            if (match !== null) {
                                legalNoticeTitleContents = match[1];
                            } else {
                                legalNoticeTitleContents = DEAFULT_LEGAL_NOTICE_TITLE;
                            }
                        } else {
                            legalNoticeTitleContents = DEAFULT_LEGAL_NOTICE_TITLE;
                        }

                        contentSpec.push("Legal Notice = ");

                        var id = legalNotice.getAttribute("id");

                        var topic = new specelement.TopicGraphNode(topicGraph)
                            .setXml(removeIdAttribute(legalNotice))
                            .setSpecLine(contentSpec.length - 1)
                            .setTitle(legalNoticeTitleContents)
                            .addTag(LEGAL_NOTICE_TAG_ID);

                        if (id) {
                            topic.addXmlId(id);
                        }

                        topics.push(topic);
                    }

                    updateProgress(9 * progressIncrement, "FoundLegalNotice");

                    callback(null, xmlDoc, contentSpec, topics, topicGraph);
                }

                function extractAbstract (xmlDoc, contentSpec, topics, topicGraph, callback) {

                    var abstractContent = qnautils.xPath("//docbook:bookinfo/docbook:abstract", xmlDoc).iterateNext();

                    if (abstractContent === null) {
                        abstractContent = qnautils.xPath("//docbook:articleinfo/docbook:abstract", xmlDoc).iterateNext();
                    }

                    if (abstractContent) {
                        contentSpec.push("Abstract = ");

                        var id = abstractContent.getAttribute("id");

                        var topic = new specelement.TopicGraphNode(topicGraph)
                            .setXml(removeIdAttribute(abstractContent))
                            .setSpecLine(contentSpec.length - 1)
                            .setTitle("Abstract")
                            .addTag(ABSTRACT_TAG_ID);

                        if (id) {
                            topic.addXmlId(id);
                        }

                        topics.push(topic);
                    }

                    updateProgress(10 * progressIncrement, "FoundAbstract");

                    callback(null, xmlDoc, contentSpec, topics, topicGraph);
                }

                /*
                    Publican books can contain a files directory. Every file in this directory
                    needs to be uploaded
                 */
                function uploadFiles (xmlDoc, contentSpec, topics, topicGraph, callback) {
                    var fileIds = [];

                    function done() {
                        if (fileIds.length !== 0) {
                            contentSpec.push("Files = [" + fileIds.toString() + "]");
                        }

                        updateProgress(11 * progressIncrement, "FoundFiles");

                        callback(null, xmlDoc, contentSpec, topics, topicGraph);
                    }

                    if (inputModel !== null) {

                        inputModel.getCachedEntries(
                            config.InputSource,
                            function (entries) {
                                var processEntry = function (index) {
                                    if (index >= entries.length) {
                                        done();
                                    } else {
                                        var entry = entries[index];
                                        var filename = qnautils.getFileName(entry);
                                        if (new RegExp("^" + qnautils.escapeRegExp(config.ImportLang) + "/files/.+").test(filename) &&
                                            qnautils.isNormalFile(filename) &&
                                            getIgnoredFiles(config.ImportLang).indexOf(filename) === -1) {

                                            var uri = new URI(filename);

                                            restcalls.createFile(
                                                inputModel,
                                                config.CreateOrResuseFiles === "REUSE",
                                                config.InputSource,
                                                qnautils.getFileName(entry),
                                                uri.filename(),
                                                uri.pathname().replace(config.ImportLang + "/files/", "").replace(uri.filename(), ""),
                                                config.ImportLang,
                                                config,
                                                function (data) {
                                                    var fileId = config.CreateOrResuseFiles === "REUSE" ? data.file.id : data.id;
                                                    fileIds.push(fileId);

                                                    config.UploadedFileCount += 1;

                                                    if (config.CreateOrResuseImages === "REUSE" && data.matchedExistingFile) {
                                                        config.MatchedFileCount += 1;
                                                    }

                                                    config.NewFilesCreated = (config.UploadedFileCount - config.MatchedFileCount) + " / " + config.MatchedFileCount;
                                                    resultCallback();

                                                    updateProgress((10 * progressIncrement) + (index / entries.length * progressIncrement));

                                                    processEntry(++index);
                                                },
                                                errorCallback
                                            );
                                        } else {
                                            processEntry(++index);
                                        }
                                    }
                                };

                                processEntry(0);
                            },
                            errorCallback);
                    } else {
                        done();
                    }
                }

                function uploadImages (xmlDoc, contentSpec, topics, topicGraph, callback) {
                    // count the number of images we are uploading
                    var images = qnautils.xPath("//@fileref", xmlDoc);
                    var numImages = 0;

                    var image;
                    while ((image = images.iterateNext()) !== null) {
                        ++numImages;
                    }

                    images = qnautils.xPath("//@fileref", xmlDoc);
                    var uploadedImages = {};

                    /*
                        Move onto the next step
                     */
                    function done() {
                        updateProgress(12 * progressIncrement, "FoundImages");
                        callback(null, xmlDoc, contentSpec, topics, topicGraph);
                    }

                    /*
                        Remember the details of the uploaded image so it can be used to update the attribues
                     */
                    var processUploadedImage = function(data, nodeValue, count) {
                        var imageId = config.CreateOrResuseImages === "REUSE" ? data.image.id : data.id;

                        config.UploadedImageCount += 1;

                        if (config.CreateOrResuseImages === "REUSE" && data.matchedExistingImage) {
                            config.MatchedImageCount += 1;
                        }

                        config.NewImagesCreated = (config.UploadedImageCount - config.MatchedImageCount) + " / " + config.MatchedImageCount;
                        resultCallback();

                        uploadedImages[nodeValue] = imageId + nodeValue.substr(nodeValue.lastIndexOf("."));

                        ++count;

                        updateProgress((11 * progressIncrement) + (count / numImages * progressIncrement));

                        return count;
                    }

                    var replaceImageReferences = function() {
                        var filerefs = qnautils.xPath("//@fileref", xmlDoc);
                        var updatedRefs = [];
                        var fileref;
                        while ((fileref = filerefs.iterateNext()) !== null) {
                            if (uploadedImages[fileref.nodeValue]) {
                                updatedRefs.push({node: fileref, newImageRef: "images/" + uploadedImages[fileref.nodeValue]});
                            }
                        }

                        jquery.each(updatedRefs, function(index, value){
                            value.node.nodeValue = value.newImageRef;
                        });
                    }

                    var processImagesFromLocalSource = function (image, count) {
                        if (image) {

                            var nodeValue = image.nodeValue;
                            var fixedNodeValue = nodeValue.replace(/^\.\//, "");

                            if (!uploadedImages[nodeValue]) {

                                inputModel.hasFileName(
                                    config.InputSource,
                                    fixedNodeValue,
                                    function (result) {
                                        if (result) {
                                            restcalls.createImage(
                                                inputModel,
                                                config.CreateOrResuseImages === "REUSE",
                                                config.InputSource,
                                                fixedNodeValue,
                                                config.ImportLang,
                                                config,
                                                function (data) {
                                                    processImagesFromLocalSource(images.iterateNext(), processUploadedImage(data, nodeValue, count));
                                                },
                                                errorCallback
                                            );
                                        } else {
                                            console.log("Could not find " + fixedNodeValue);
                                            processImagesFromLocalSource(images.iterateNext(), ++count);
                                        }
                                    },
                                    errorCallback,
                                    true
                                );
                            }  else {
                                processImagesFromLocalSource(images.iterateNext(), ++count);
                            }
                        } else {
                            replaceImageReferences();
                            done();
                        }
                    };

                    var processImagesFromURL = function (image, count) {
                        if (image) {

                            var nodeValue = image.nodeValue;

                            if (!uploadedImages[nodeValue]) {
                                restcalls.createImageFromURL(
                                    config.CreateOrResuseImages === "REUSE",
                                    nodeValue,
                                    config.ImportLang,
                                    config,
                                    function (data) {
                                        processImagesFromURL(images.iterateNext(), processUploadedImage(data, nodeValue, count));
                                    },
                                    errorCallback
                                );

                            }  else {
                                processImagesFromLocalSource(images.iterateNext(), ++count);
                            }
                        } else {
                            replaceImageReferences();
                            done();
                        }
                    };

                    if (config.SourceURL) {
                        processImagesFromURL(images.iterateNext(), 0);
                    } else if (inputModel !== null) {
                        processImagesFromLocalSource(images.iterateNext(), 0);
                    } else {
                        done();
                    }
                }

                function resolveBookStructure (xmlDoc, contentSpec, topics, topicGraph, callback) {
                    // so we can work back to the original source
                    contentSpec.push("# " + config.RevisionMessage);
                    contentSpec.push("# Imported on " + moment().format("dddd, MMMM Do YYYY, h:mm:ss a"));

                    var containerTargetNum = 0;

                    /*
                     Some books will assign an id to the title element of a topic. This import tool
                     redirects these links to the topic itself. But to compare the XML to an existing
                     topic, we need to remove the title id attribute.
                     */
                    function removeTitleAttributes(xml) {
                        var title =  qnautils.xPath("./docbook:title", xml).iterateNext();
                        if (title !== null) {
                            removeAttributes(title);
                        }
                    }


                    function removeAttributes(xml) {
                        while (xml.attributes.length !== 0) {
                            xml.removeAttribute(xml.attributes[0].nodeName);
                        }
                    }

                    function getTitle(directTitle, infoTitle) {
                        var title = directTitle || infoTitle || DEFAULT_TITLE;

                        // When refering to the title text from now on (like adding to the spec or defining the
                        // title of a topic in the graph) we want the version that has the entities
                        var withWithEntities = qnautils.reencode(title, replacements);
                        return encodeTitle(withWithEntities).trim();
                    }

                    var processXml = function (parentXML, depth) {
                        // loop over the containers under the root element
                        jquery.each(parentXML.childNodes, function (index, value) {

                            var contentSpecLine = createContentSpecSpacingPrefix(depth);

                            if (nodeIsCommonContentXInclude(value)) {
                                var href = value.getAttribute(XINCLUDE_HREF_ATTR);
                                var filename = new URI(href).filename();
                                contentSpec.push(contentSpecLine + encodeTitle(filename) + " [Common Content]");
                            } else if (nodeIsContainer(value)) {
                                // take a copy of this container
                                var clone = value.cloneNode(true);

                                // find the title
                                var title = qnautils.xPath("./docbook:title", clone).iterateNext();
                                var titleText = null;
                                if (title !== null) {
                                    titleText = qnautils.replaceWhiteSpace(title.innerHTML);

                                    // remove any redundant namespace attributes
                                    titleText = xmlcompare.removeRedundantXmlnsAttribute(titleText);

                                    /*
                                        Title is mandatory
                                     */
                                    if (titleText.length === 0) {
                                        titleText = DEFAULT_TITLE;
                                    }
                                }

                                // sync the title back to the xml
                                var titleXML = "<title>" + titleText + "</title>";
                                var titleXMLDocument = qnautils.stringToXML(titleXML);
                                var importedTitle =  qnautils.getOwnerDoc(clone).importNode(titleXMLDocument.documentElement);
                                if (title) {
                                    clone.replaceChild(importedTitle, title);
                                } else if (clone.childNodes.length === 0) {
                                    clone.appendChild(importedTitle);
                                } else {
                                    clone.insertBefore(importedTitle, clone.childNodes[0]);
                                }

                                // strip away any child containers
                                var removeChildren = [];
                                jquery.each(clone.childNodes, function (index, containerChild) {
                                    if (nodeIsContainer(containerChild) || nodeIsCommonContentXInclude(containerChild)) {
                                        removeChildren.push(containerChild);
                                    }
                                });
                                jquery.each(removeChildren, function (index, containerChild) {
                                    clone.removeChild(containerChild);
                                });

                                // the id attribute assigned to this container
                                var id = qnautils.xPath("./@id", clone).iterateNext();
                                if (id === null) {
                                    // the docbook 5 version of the id attribute
                                    id = qnautils.xPath("./@xml:id", clone).iterateNext();
                                }

                                // some books have ids in the title. these are not supported, so xrefs to titles
                                // are redirected to the parent element
                                if (title !== null) {
                                    var titleId = qnautils.xPath("./@id", title).iterateNext();
                                    if (titleId === null) {
                                        // the docbook 5 version of the id attribute
                                        titleId = qnautils.xPath("./@xml:id", title).iterateNext();
                                    }
                                }

                                /*
                                 Some books will assign additional attributes to container elements like arch="".
                                 We need to remove these.
                                 */
                                removeAttributes(clone);
                                removeTitleAttributes(clone);

                                // if there were no child container elements to be removed, it
                                // means this element stands alone. It is either a topic,
                                // or a container that has only initial text
                                if (removeChildren.length === 0) {

                                    var isHistoryTopicAppendix = false;
                                    if (clone.nodeName === "appendix") {
                                        var clone2 = clone.cloneNode(true);
                                        var removeNodes = [];

                                        var titles = qnautils.xPath("./docbook:title", clone2);

                                        var titleNode;
                                        while ((titleNode = titles.iterateNext()) !== null) {
                                            removeNodes.push(titleNode);
                                        }

                                        var revHistoryNodes = qnautils.xPath(".//docbook:revhistory", clone2);

                                        var revHistoryNode;
                                        while ((revHistoryNode = revHistoryNodes.iterateNext()) !== null) {
                                            removeNodes.push(revHistoryNode);
                                        }

                                        jquery.each(removeNodes, function (index, value){
                                            value.parentNode.removeChild(value);
                                        });

                                        /*
                                         Once we take out the title and revhistory, is there any content left?
                                         */
                                        isHistoryTopicAppendix = clone2.textContent.trim().length === 0;
                                    }

                                    var isEmptyPrefaceTopic = false;
                                    if (clone.nodeName === "preface") {
                                        var clone2 = clone.cloneNode(true);
                                        var removeNodes = [];

                                        var titles = qnautils.xPath("./docbook:title", clone2);

                                        var titleNode;
                                        while ((titleNode = titles.iterateNext()) !== null) {
                                            removeNodes.push(titleNode);
                                        }

                                        jquery.each(removeNodes, function (index, value){
                                            value.parentNode.removeChild(value);
                                        });

                                        /*
                                         Once we take out the title, is there any content left?
                                         */
                                        isEmptyPrefaceTopic = clone2.textContent.trim().length === 0;
                                    }

                                    if (!isHistoryTopicAppendix && !isEmptyPrefaceTopic) {

                                        /*
                                            Watch out for sections under a book element. This is not valid docbook,
                                            but tools like asciidoctor can create this structure in some cases.
                                         */
                                        if (TOPIC_CONTAINER_TYPES.indexOf(value.nodeName) !== -1 &&
                                            (xmlDocIsArticle(xmlDoc) || depth !== 0)) {
                                            /*
                                                This is a plain topic. We don't extract info elements from plain
                                                topics.
                                             */
                                            contentSpec.push(contentSpecLine + getTitle(titleText));

                                        } else {
                                            /*
                                                This is a container element. We do extract info elements from containers.
                                             */
                                            var infoTitle = extractInfoTopic(xmlDoc, contentSpec.length, clone, topics, topicGraph);

                                            var containerName = remapContainer(value.nodeName, depth, xmlDocIsArticle(xmlDoc));
                                            contentSpec.push(
                                                contentSpecLine +
                                                    containerName.substring(0, 1).toUpperCase() +
                                                    containerName.substring(1, containerName.length) +
                                                    ": " +
                                                    getTitle(titleText, infoTitle));

                                            contentSpec.push(contentSpecLine + "  Initial Text: ");
                                            contentSpec.push(contentSpecLine + "    " + getTitle(titleText));
                                        }

                                        var standaloneContainerTopic = new specelement.TopicGraphNode(topicGraph)
                                            .setXml(removeIdAttribute(clone))
                                            .setSpecLine(contentSpec.length - 1)
                                            .setTitle(getTitle(titleText));

                                        if (id) {

                                            if (topicGraph.hasXMLId(id.nodeValue)) {
                                                throw "The XML id attribute " + id.nodeValue + " has been duplicated. The source book is not valid";
                                            }

                                            standaloneContainerTopic.addXmlId(id.nodeValue);
                                        }

                                        if (titleId) {

                                            if (topicGraph.hasXMLId(titleId.nodeValue)) {
                                                throw "The XML id attribute " + titleId.nodeValue + " has been duplicated. The source book is not valid";
                                            }

                                            standaloneContainerTopic.addXmlId(titleId.nodeValue);
                                        }

                                        topics.push(standaloneContainerTopic);
                                    }
                                } else {
                                    var infoTitle = extractInfoTopic(xmlDoc, contentSpec.length, clone, topics, topicGraph);

                                    var containerName = remapContainer(value.nodeName, depth, xmlDocIsArticle(xmlDoc));
                                    contentSpec.push(
                                        contentSpecLine +
                                            containerName.substring(0, 1).toUpperCase() +
                                            containerName.substring(1, containerName.length) +
                                            ": " +
                                            getTitle(titleText, infoTitle));

                                    if (id) {
                                        ++containerTargetNum;
                                        contentSpec[contentSpec.length - 1] += " [T" + containerTargetNum + "]";
                                    }

                                    var hasIntroText = false;
                                    if (clone.childNodes.length !== 0) {
                                        var containerClone = clone.cloneNode(true);
                                        var containerRemoveNodes = [];

                                        var containerTitles = qnautils.xPath("./docbook:title", containerClone);

                                        var containerTitleNode;
                                        while ((containerTitleNode = containerTitles.iterateNext()) !== null) {
                                            containerRemoveNodes.push(containerTitleNode);
                                        }

                                        var containerRevHistoryNodes = qnautils.xPath(".//docbook:revhistory", containerClone);

                                        var containerRevHistoryNode;
                                        while ((containerRevHistoryNode = containerRevHistoryNodes.iterateNext()) !== null) {
                                            containerRemoveNodes.push(containerRevHistoryNode);
                                        }

                                        jquery.each(containerRemoveNodes, function (index, value){
                                            value.parentNode.removeChild(value);
                                        });

                                        /*
                                         Once we take out the title and revhistory, is there any content left?
                                         */
                                        hasIntroText = containerClone.textContent.trim().length !== 0;
                                    }

                                    /*
                                     If this container has front matter content, create a topic to represent it
                                     */
                                    if (hasIntroText) {

                                        contentSpec.push(contentSpecLine + "  Initial Text: ");
                                        contentSpec.push(contentSpecLine + "    " + getTitle(titleText));

                                        /*
                                            We want any content under partintro to be just content in the
                                            initial text topic.
                                         */
                                        if (/^part$/i.test(containerName)) {
                                            var partintro = qnautils.xPath(".//docbook:partintro", clone).iterateNext();
                                            if (partintro !== null) {
                                                while (partintro.childNodes.length !== 0) {
                                                    clone.insertBefore(partintro.childNodes[0], partintro);
                                                }

                                                clone.removeChild(partintro);
                                            }
                                        }

                                        var initialTextTopic = new specelement.TopicGraphNode(topicGraph)
                                            .setXml(removeIdAttribute(clone))
                                            .setSpecLine(contentSpec.length - 1)
                                            .setTitle(getTitle(titleText, infoTitle));

                                        if (id) {
                                            if (topicGraph.hasXMLId(id.nodeValue)) {
                                                throw "The XML id attribute " + id.nodeValue + " has been duplicated. The source book is not valid";
                                            }

                                            initialTextTopic.addXmlId(id.nodeValue);
                                        }

                                        if (titleId) {

                                            if (topicGraph.hasXMLId(titleId.nodeValue)) {
                                                throw "The XML id attribute " + titleId.nodeValue + " has been duplicated. The source book is not valid";
                                            }

                                            initialTextTopic.addXmlId(titleId.nodeValue);
                                        }

                                        topics.push(initialTextTopic);
                                    } else {
                                        var container = new specelement.TopicGraphContainer(topicGraph)
                                            .setSpecLine(contentSpec.length - 1)
                                            .setContainerTargetNum(containerTargetNum);

                                        if (id) {
                                            if (topicGraph.hasXMLId(id.nodeValue)) {
                                                throw "The XML id attribute " + id.nodeValue + " has been duplicated. The source book is not valid";
                                            }

                                            container.addXmlId(id.nodeValue);
                                        }

                                        if (titleId) {

                                            if (topicGraph.hasXMLId(titleId.nodeValue)) {
                                                throw "The XML id attribute " + titleId.nodeValue + " has been duplicated. The source book is not valid";
                                            }

                                            container.addXmlId(titleId.nodeValue);
                                        }
                                    }

                                    processXml(value, depth + 1);
                                }
                            }
                        });
                    };

                    processXml(xmlDoc.documentElement, 0);

                    updateProgress(13 * progressIncrement, "ResolvedBookStructure");

                    callback(null, xmlDoc, contentSpec, topics, topicGraph);
                }

                /*
                 Here we find any topics currently assigned to the spec that we are overwriting that
                 are similar to the topic we are uploading. Any topic considered similar will
                 be overwritten with the topic being imported.
                 */
                function matchExistingTopicsInSpec (xmlDoc, contentSpec, topics, topicGraph, callback) {
                    // a collection of the topic ids assigned to the spec we are overwriting
                    var availableTopics = [];

                    // a collection of the topic ids we have already earmarked for reuse
                    var resuedTopics = [];

                    // start by getting a list of topics that are assigned to the spec we are overwriting
                    restcalls.getTopicsInSpec(
                        config[constants.EXISTING_CONTENT_SPEC_ID],
                        config,
                        function(specTopics) {

                            jquery.each(specTopics.items, function(index, element) {
                                if (availableTopics.indexOf(element.item.id) === -1) {
                                    availableTopics.push(element.item.id);
                                }
                            });

                            var index = 0;

                            /*
                             First loop - look for exact matches.
                             We do this because books can sometimes have a lot of topics that are
                             similar (i.e. placeholder content) that only differs by something
                             like the title. We want the topics we are importing to overwrite
                             their exact matches if possible.
                             */
                            function firstLoop() {
                                async.eachSeries(topics,
                                    function(topic, callback) {
                                        updateProgress((14 * progressIncrement) + (++index / topics.length * progressIncrement * 0.5));

                                        restcalls.getSimilarTopics(
                                            qnautils.reencode(qnautils.xmlToString(topic.xml), replacements),
                                            config,
                                            function (similarTopics) {


                                                jquery.each(similarTopics.items, function(index, element) {
                                                    // is this a topic assigned to the spec?
                                                    if (availableTopics.indexOf(element.item.id) !== -1) {

                                                        var matchXmlDetails = qnautils.replaceEntitiesInText(element.item.xml);
                                                        var matchXmlDom = qnautils.stringToXML(matchXmlDetails.xml);

                                                        var xmlDocsAreEquivilent = xmlcompare.compareXml(
                                                            topic,
                                                            getDocumentFormat(config),
                                                            topicGraph.getAllTopicOrContainerIDs(),
                                                            topic.xml.cloneNode(true),
                                                            replacements,
                                                            matchXmlDom,
                                                            matchXmlDetails.replacements);

                                                        // is this a topic that has been resued already?
                                                        if (xmlDocsAreEquivilent && resuedTopics.indexOf(element.item.id) === -1) {
                                                            resuedTopics.push(element.item.id);
                                                            topic.setTopicId(element.item.id);
                                                            topic.setOriginalTopicXML(element.item.xml);
                                                            return false;
                                                        }
                                                    }
                                                });

                                                callback(null);

                                            },
                                            errorCallback
                                        )
                                    }, function(err, data) {
                                        secondLoop();
                                    }
                                );
                            }

                            /*
                             Second loop - take the first close match.
                             If topics don't have an exact macth, just grab the first one that
                             is close.
                             */
                            function secondLoop() {
                                async.eachSeries(topics,
                                    function(topic, callback) {
                                        updateProgress((14 * progressIncrement + progressIncrement * 0.5) + (++index / topics.length * progressIncrement));

                                        restcalls.getSimilarTopics(
                                            qnautils.reencode(qnautils.xmlToString(topic.xml), replacements),
                                            config,
                                            function (similarTopics) {


                                                if (topic.topicId === undefined) {
                                                    jquery.each(similarTopics.items, function (index, element) {
                                                        // is this a topic assigned to the spec?
                                                        if (availableTopics.indexOf(element.item.id) !== -1) {
                                                            // is this a topic that has been resued already?
                                                            if (resuedTopics.indexOf(element.item.id) === -1) {
                                                                resuedTopics.push(element.item.id);
                                                                topic.setTopicId(element.item.id);
                                                                topic.setOriginalTopicXML(element.item.xml);
                                                                return false;
                                                            }
                                                        }
                                                    });
                                                }

                                                /*
                                                 This can happen if the existing spec had duplicated topics. This means
                                                 there are fewer topics to choose from than there are being imported.
                                                 In this case check back through the topics looking for any with
                                                 an assigned topic id and the exact same xml, and reuse the id.
                                                 */
                                                if (topic.topicId === undefined) {
                                                    jquery.each(topics, function(index, element) {
                                                        if (element.topicId !== undefined) {
                                                            var xmlDocsAreEquivilent = xmlcompare.compareStrictXml(
                                                                topic,
                                                                getDocumentFormat(config),
                                                                topic.xml.cloneNode(true),
                                                                replacements,
                                                                element.xml.cloneNode(true),
                                                                replacements);

                                                            if (xmlDocsAreEquivilent) {
                                                                setAsOverwrittenTopic(topic, element.topicId, element.originalTopicXML);
                                                                return false;
                                                            }
                                                        }
                                                    });

                                                    /*
                                                     TODO: Really need to define the states a little more explicitly
                                                     instead of a -1 here and a createdTopic there...
                                                     */
                                                    if (topic.topicId === undefined) {
                                                        setAsNewTopic(topic);
                                                    }
                                                }

                                                callback(null);

                                            },
                                            errorCallback
                                        )
                                    }, function(err, data) {
                                        callback(null, xmlDoc, contentSpec, topics, topicGraph);
                                    }
                                );
                            }

                            firstLoop();
                        },
                        errorCallback)
                }

                /*
                 Resolve the topics either to existing topics in the database, or to new topics
                 */
                function matchExistingTopics (xmlDoc, contentSpec, topics, topicGraph, callback) {
                    var topicOrContainerIDs = topicGraph.getAllTopicOrContainerIDs();

                    var index = 0;

                    async.eachSeries(
                        topics,
                        function (topic, callback) {
                            updateProgress((14 * progressIncrement) + (index / topics.length * progressIncrement));
                            ++index;

                            restcalls.getSimilarTopics(
                                qnautils.reencode(qnautils.xmlToString(topic.xml), replacements),
                                config,
                                function (data) {
                                    var format = getDocumentFormat(config);

                                    data.items.sort(function (a, b) {
                                        if (a.item.id < b.item.id) {
                                            return 1;
                                        }

                                        if (a.item.id === b.item.id) {
                                            return 0;
                                        }

                                        return -1;
                                    });
                                    jquery.each(data.items, function (index, matchingTopic) {
                                        /*
                                         The matching topic has to have the same format as the one
                                         we are trying to import.
                                         */
                                        if (matchingTopic.item.xmlFormat !== format) {
                                            return true;
                                        }

                                        /*
                                         The matching topic has to have the same locale as the one
                                         we are trying to import.
                                         */
                                        if (matchingTopic.item.locale !== config.ImportLang) {
                                            return true;
                                        }

                                        /*
                                         Strip out the entities which can cause issues with the XML Parsing
                                         */
                                        var replacedTextResult = qnautils.replaceEntitiesInText(matchingTopic.item.xml);
                                        /*
                                         Parse to XML
                                         */
                                        var matchingTopicXMLCopy = qnautils.stringToXML(replacedTextResult.xml);
                                        /*
                                         Check for invalid XML stored in the database
                                         */
                                        if (matchingTopicXMLCopy !== null) {

                                            var xmlDocsAreEquivilent = xmlcompare.compareXml(
                                                topic,
                                                format,
                                                topicOrContainerIDs,
                                                topic.xml.cloneNode(true),
                                                replacements,
                                                matchingTopicXMLCopy,
                                                replacedTextResult.replacements);

                                            if (xmlDocsAreEquivilent) {
                                                topic.addPGId(matchingTopic.item.id, matchingTopic.item.xml);
                                            }
                                        } else {
                                            console.log("The XML in topic " + matchingTopic.item.id + " could not be parsed");
                                        }
                                    });

                                    if (topic.pgIds === undefined) {
                                        console.log("Topic " + topic.title + " has no matches in the database.");
                                    }

                                    callback(null);
                                },
                                errorCallback
                            );

                        },
                        function (err, data) {
                            /*
                             get a report of potentially reused topics. This is really just a convenient
                             place to set a break point.
                             */
                            jquery.each(topics, function (index, value) {
                                if (value.pgIds === undefined) {
                                    console.log(value.title + ": none");
                                } else {
                                    var matchingIds = "";
                                    jquery.each(value.pgIds, function (key, value) {
                                        if (matchingIds.length !== 0) {
                                            matchingIds += ", ";
                                        }
                                        matchingIds += key;
                                    });
                                    console.log(value.title + ": " + matchingIds);
                                }
                            });

                            callback(null, xmlDoc, contentSpec, topics, topicGraph);
                        }
                    );

                }

                /*
                 Populate outgoing links
                 */
                function populateOutgoingLinks(xmlDoc, contentSpec, topics, topicGraph, callback) {
                    var topicOrContainerIDs = topicGraph.getAllTopicOrContainerIDs();

                    jquery.each(topics, function (index, topic) {

                        // a collection of xrefs that will be replaced by injections.
                        // topic.xrefs is a collection of all xrefs, but some of these
                        // might point to positions inside a topic, and as such is not
                        // a candidate for being replaced with an injection
                        var outgoingXrefs = [];

                        jquery.each(topic.xrefs, function (index, xref) {
                            if (topicOrContainerIDs.indexOf(xref) !== -1) {
                                outgoingXrefs.push(xref);
                            }
                        });

                        /*
                         We are only interested in mapping the relationships between topics
                         that have matching topics in PressGang.
                         */
                        if (topic.pgIds) {
                            jquery.each(topic.pgIds, function (pgid, details) {
                                var InjectionRE = /<!--\s*Inject\s*:\s*(T?\d+)\s*-->/g;
                                var match;
                                var count = 0;
                                while ((match = InjectionRE.exec(details.originalXML)) !== null) {
                                    if (count >= outgoingXrefs.length) {
                                        throw "There is a mismatch between the xrefs and the injects.";
                                    }

                                    var topicIdOrContainerTarget = match[1];
                                    var xref = outgoingXrefs[count];

                                    topic.addFixedOutgoingLink(pgid, xref, topicIdOrContainerTarget);

                                    ++count;
                                }
                            });
                        }
                    });

                    updateProgress(15 * progressIncrement, "MatchedExistingTopics");

                    callback(null, xmlDoc, contentSpec, topics, topicGraph);
                }

                /*
                 This is the trickiest part of the process.

                 When reusing a topic in PressGang, we also reuse any injections it has to other topics. This
                 means that reusing a topic that has 5 injections means that we have to reuse at least 6 topics
                 (the original one with the injections and then the 5 that are pointed to). And these dependencies
                 cascade and create circular references.

                 So what we do here is:

                 1. Find all potentially matching topics from PressGang
                 2. Create a xref graph that defines the dependencies between topics if they assume one of
                 the existing topic ids
                 3. Attempt to resolve a topic to an existing topic, making sure that any cascading dependencies
                 are also resolved
                 4. Create new topics that could not be matched, and reuse those that can be matched
                 */
                function resolveXrefs (xmlDoc, contentSpec, topics, topicGraph, callback) {
                    /*
                     Return alls nodes without a topic ID (which means it hasn't been resolved) and
                     outgoing or incoming links (which means it is part of a xref graph).
                     */
                    function getUnresolvedNodeWithOutboundXrefs() {
                        var retValue = [];
                        jquery.each(topics, function (index, topic) {
                            if (topic.topicId === undefined &&
                                topic.pgIds !== undefined &&
                                topic.fixedOutgoingLinks !== undefined) {
                                retValue.push(topic);
                            }
                        });
                        return retValue;
                    }

                    /*
                     Loop through the list of unresolved nodes, find the largest graph that can be resolved
                     from each of them, assign the topic ids to the nodes in that graph, and repeat until
                     we have no more topics with resolvable graphs.

                     TODO: this really should assign the topic ids to the largest isolated graphs instead of
                     recalculating them each time.

                     */
                    var unresolvedNodes = null;
                    while ((unresolvedNodes = getUnresolvedNodeWithOutboundXrefs()).length !== 0) {
                        var biggestGraph = null;
                        jquery.each(unresolvedNodes, function (index, unresolvedNode) {
                            /*
                             Loop through each possible topic id that this topic could be
                             and see if all other nodes in the xref graph are also valid with
                             this configuration.
                             */
                            var validNodesOptions = [];
                            jquery.each(unresolvedNode.pgIds, function (pgId, details) {
                                var network = unresolvedNode.isValidForwards(pgId);
                                if (network !== null) {
                                    validNodesOptions.push(network);
                                }
                            });

                            if (validNodesOptions.length !== 0) {

                                var mostSuccess = undefined;
                                jquery.each(validNodesOptions, function (index, validNodesOption) {
                                    if (mostSuccess === undefined || validNodesOption.length > mostSuccess.length) {
                                        mostSuccess = validNodesOption;
                                    }
                                });

                                if (biggestGraph == null || mostSuccess.length > biggestGraph.length) {
                                    biggestGraph = mostSuccess;
                                }
                            } else {
                                /*
                                 We could not find a valid xref graph with the possible existing matches,
                                 so set all the topic ids to -1 to indicate that these topics have to be created
                                 new.
                                 */

                                if (unresolvedNode.topicId !== undefined) {
                                    throw "We should not be able to set the topic id twice";
                                }

                                setAsNewTopic(unresolvedNode);
                            }

                            config.NewTopicsCreated = (config.UploadedTopicCount - config.MatchedTopicCount) + " / " + config.MatchedTopicCount;

                            resultCallback();
                        });

                        /*
                         It is possible that none of the graphs could be resolved, in which case biggestGraph is null
                         */
                        if (biggestGraph !== null) {
                            /*
                             Every topic in this xref graph is valid with an existing topic id,
                             so set the topicId to indicate that these nodes have been resolved.
                             */
                            jquery.each(biggestGraph, function (index, topic) {
                                if (topic.node.topicId !== undefined) {
                                    throw "We should not be able to set the topic id twice";
                                }

                                setAsReusedTopic(topic, topic.assumedId);
                            });
                        }
                    }

                    /*
                     Any that are left are stand alone topics. These can take on the first matching
                     topic id, or -1 is they are new topics.
                     */
                    jquery.each(topics, function (index, topic) {
                        if (topic.topicId === undefined) {
                            if (topic.pgIds !== undefined) {
                                setAsReusedTopic(topic, Object.keys(topic.pgIds)[0]);
                            } else {
                                setAsNewTopic(topic);
                            }
                        }
                    });

                    config.NewTopicsCreated = (config.UploadedTopicCount - config.MatchedTopicCount) + " / " + config.MatchedTopicCount;

                    updateProgress(config.UploadProgress[1] = 16 * progressIncrement, "ResolvedXRefGraphs");

                    callback(null, xmlDoc, contentSpec, topics, topicGraph);
                }

                /*
                 This function creates topics that have no existing match, and mark all topics that have been
                 created or will be updated so their xrefs can be resolved.
                 */
                function uploadTopics (xmlDoc, contentSpec, topics, topicGraph, callback) {

                    function cleanTopicXmlForSaving(topic, format) {
                        return xmlcompare.removeRedundantXmlnsAttribute(
                            xmlcompare.fixDocumentNode(
                                topic,
                                qnautils.reencode(qnautils.xmlToString(topic.xml), replacements).trim(),
                                format
                            )
                        )
                    }

                    /**
                     * Configure the topic with the data from the server as a result of a topic update or save
                     */
                    function postCreateTopic(topic, savedTopic) {
                        topic.setTopicId(savedTopic.id);
                        topic.createdTopic = true;

                        var replacedTextResult = qnautils.replaceEntitiesInText(savedTopic.xml);

                        var entityFreeXml = qnautils.stringToXML(replacedTextResult.xml);
                        // this might be null due to bugs like https://bugzilla.redhat.com/show_bug.cgi?id=1066169
                        if (entityFreeXml !== null) {
                            topic.xml = qnautils.stringToXML(replacedTextResult.xml);
                            topic.replacements = replacedTextResult.replacements;
                        } else {
                            // work around this bug by allowing the existing xml to be qnautils.reencoded. The
                            // final book would have invalid topics, but at least it will build.
                            topic.replacements = replacements;
                        }
                    }

                    var index = 0;

                    async.eachSeries(
                        topics,
                        function(topic, callback) {
                            updateProgress((17 * progressIncrement) + (index / topics.length * progressIncrement));
                            ++index;

                            var format = getDocumentFormat(config);

                            if (topic.isNewTopic()) {
                                restcalls.createTopic(
                                    false,
                                    getDocbookVersion(config),
                                    cleanTopicXmlForSaving(topic, format),
                                    topic.title,
                                    topic.tags,
                                    config.ImportLang,
                                    config,
                                    function (data) {
                                        postCreateTopic(topic, data);
                                        addTopicToNewTopics(data.id);
                                        callback(null);
                                    },
                                    errorCallback
                                );
                            } else {
                                /*
                                 We already know the id that a topic will take when we are overwriting a spec, but
                                 these topics still need to be flagged as "created" so their xrefs can be resolved.
                                 */
                                if (updatingTopics()) {
                                    topic.createdTopic = true;
                                    topic.replacements = replacements;
                                }

                                callback(null);
                            }
                        },
                        function(err, data) {
                            updateProgress(17 * progressIncrement, "UploadedTopics");
                            callback(null, xmlDoc, contentSpec, topics, topicGraph);
                        }
                    );
                }

                function identifyOutgoingLinks (xmlDoc, contentSpec, topics, topicGraph, callback) {
                    config.OutgoingUrls = qnastart.identifyOutgoingLinks(topicGraph);
                    callback(null, xmlDoc, contentSpec, topics, topicGraph);
                }

                function resolveXrefsInCreatedTopics (xmlDoc, contentSpec, topics, topicGraph, callback) {

                    var format = getDocumentFormat(config);

                    function resolve(index, callback) {
                        if (index >= topics.length) {
                            callback();
                        } else {
                            updateProgress((17 * progressIncrement) + (index / topics.length * progressIncrement));

                            var topic = topics[index];
                            if (topic.createdTopic) {
                                var xrefReplacements = [];
                                jquery.each(['xref', 'link'], function(index, linkElement) {
                                    var xrefs = qnautils.xPath(".//docbook:" + linkElement, topic.xml);
                                    var xref;
                                    while ((xref = xrefs.iterateNext()) !== null) {
                                        if (xref.hasAttribute("linkend")) {
                                            var linkend = xref.getAttribute("linkend");
                                            // is this an xref to a topic
                                            var destinationTopic = topicGraph.getNodeFromXMLId(linkend);
                                            if (destinationTopic !== undefined) {

                                                if (destinationTopic instanceof specelement.TopicGraphNode &&
                                                    (destinationTopic.topicId === undefined || destinationTopic.isNewTopic())) {
                                                    throw "All topics should be resolved by this point";
                                                }

                                                if (destinationTopic instanceof specelement.TopicGraphNode) {
                                                    // we are pointing to a saved topic, so replace the xref with an injection
                                                    var topicInjection = xmlDoc.createComment("Inject: " + destinationTopic.topicId);
                                                    var replacement = {original: xref, replacement: [topicInjection]};
                                                    xrefReplacements.push(replacement);

                                                    if (linkElement === 'link') {
                                                        replacement.replacement.push(xmlDoc.createComment(qnautils.xmlToString(xref)));
                                                    }
                                                } else {
                                                    // we are pointing to a container, so replace the xref with a target injection
                                                    var containerInjection = xmlDoc.createComment("Inject: T" + destinationTopic.targetNum);
                                                    xrefReplacements.push({original: xref, replacement: [containerInjection]});
                                                }
                                            }
                                        }
                                    }
                                });

                                jquery.each(xrefReplacements, function (index, value) {
                                    for (var replacementIndex = 0; replacementIndex < value.replacement.length; ++replacementIndex) {
                                        if (replacementIndex === value.replacement.length - 1) {
                                            value.original.parentNode.replaceChild(value.replacement[replacementIndex], value.original);
                                        } else {
                                            value.original.parentNode.insertBefore(value.replacement[replacementIndex], value.original);
                                        }
                                    }
                                });

                                restcalls.updateTopic(
                                    topic.topicId,
                                    xmlcompare.removeRedundantXmlnsAttribute(
                                        xmlcompare.fixDocumentNode(
                                            topic,
                                            qnautils.reencode(qnautils.xmlToString(topic.xml), topic.replacements),
                                            format
                                        )
                                    ),
                                    topic.title,
                                    config,
                                    function (data) {
                                        /*
                                         If we were overwriting a topic as part of updating an existing spec, was the
                                         topic actually updated? If so, record it as an updated topic. If not, record
                                         it as a reused topic.
                                         */
                                        if (updatingTopics() && topic.originalTopicXML) {
                                            var originalXMLDetails = qnautils.replaceEntitiesInText(topic.originalTopicXML);
                                            var originalXMLDom = qnautils.stringToXML(originalXMLDetails.xml);

                                            var newXMLDetails = qnautils.replaceEntitiesInText(data.xml);
                                            var newXMLDom = qnautils.stringToXML(newXMLDetails.xml);
                                            var topicWasChanged =
                                                newXMLDom === null ||
                                                originalXMLDom === null ||
                                                !xmlcompare.compareStrictXml(
                                                    topic,
                                                    getDocumentFormat(config),
                                                    originalXMLDom,
                                                    originalXMLDetails.replacements,
                                                    newXMLDom,
                                                    newXMLDetails.replacements);

                                            if (topicWasChanged) {
                                                addTopicToUpdatedTopics(data.id);
                                            } else {
                                                addTopicToReusedTopics(data.id);
                                            }
                                        }

                                        resolve(index + 1, callback);
                                    },
                                    errorCallback
                                );
                            } else {
                                resolve(index + 1, callback);
                            }
                        }
                    }

                    resolve(0, function() {
                        updateProgress(18 * progressIncrement, "FixXRefs");

                        callback(null, xmlDoc, contentSpec, topics, topicGraph);
                    });
                }

                function updateContentSpecWithTopicIDs (xmlDoc, contentSpec, topics, topicGraph, callback) {
                    jquery.each(topics, function (index, topic) {
                        if (topic.infoTopic === undefined || topic.infoTopic === false) {
                            contentSpec[topic.specLine] += " [" + topic.topicId + "]";
                        } else {
                            contentSpec[topic.specLine] += " [Info: " + topic.topicId + "]";
                        }
                    });
                    updateProgress(19 * progressIncrement, "UpdatedContentSpec");

                    callback(null, contentSpec);
                }

                function uploadContentSpec (contentSpec, callback) {

                    var buildSpecString = function(contentSpec) {
                        var compiledContentSpec = "";
                        jquery.each(contentSpec, function(index, value) {
                            compiledContentSpec += value + "\n";
                        });
                        if (config.OutgoingUrls.length !== 0) {
                            compiledContentSpec += "#\n";
                            compiledContentSpec += "# The following lists represent the state of topics at the time of the import (" + moment().format("dddd, MMMM Do YYYY, h:mm:ss a") + ").\n"
                            compiledContentSpec += "# These lists are *not* automatically updated, and do not reflect changes made to topics or the content specification since the import.\n";
                            compiledContentSpec += "#\n";
                            compiledContentSpec += "# The following topics were added to this content specification with links that were not found in the white list.\n";
                            compiledContentSpec += "# " + config.OutgoingUrls + "\n";
                        }

                        if (config.ReusedTopics.length !== 0) {
                            compiledContentSpec += "#\n";
                            compiledContentSpec += "# The following existing topics were reused during the import.\n";
                            compiledContentSpec += "# " + config.ReusedTopics + "\n";
                        }

                        if (config.NewTopics.length !== 0) {
                            compiledContentSpec += "#\n";
                            compiledContentSpec += "# The following new topics were created during the import.\n";
                            compiledContentSpec += "# " + config.NewTopics + "\n";
                        }

                        if (config.UpdatedTopics.length !== 0) {
                            compiledContentSpec += "#\n";
                            compiledContentSpec += "# The following existing topics were updated during the import.\n";
                            compiledContentSpec += "# " + config.UpdatedTopics + "\n";
                        }

                        return compiledContentSpec;
                    }

                    var compiledContentSpec = buildSpecString(contentSpec);

                    function contentSpecSaveSuccess(id) {
                        updateProgress(100);
                        thisStep.setTitlePrefix(null);
                        config.UploadedContentSpecification = true;
                        config.ContentSpecID = id;
                        callback(null);
                    }

                    if (config[constants.EXISTING_CONTENT_SPEC_ID]) {
                        restcalls.updateContentSpec(
                            config[constants.EXISTING_CONTENT_SPEC_ID],
                            compiledContentSpec,
                            config,
                            contentSpecSaveSuccess,
                            errorCallback
                        );
                    } else {
                        restcalls.createContentSpec(
                            compiledContentSpec,
                            config.ImportLang,
                            config,
                            contentSpecSaveSuccess,
                            errorCallback
                        );
                    }
                }
            })
            .setNextStep(function (resultCallback) {
                window.onbeforeunload = undefined;

                resultCallback(summary);
            })
            .setShowNext(false)
            .setShowPrevious(false);

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
                                resultCallback("<a href='http://" + config.PressGangHost + ":8080/pressgang-ccms-ui/#ContentSpecFilteredResultsAndContentSpecView;query;contentSpecIds=" + config.ContentSpecID + "'>" + config.ContentSpecID + "</a> (Click to open in PressGang)");
                            }),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.PLAIN_TEXT)
                            .setIntro("Imported From")
                            .setName("ImportedFrom")
                            .setValue(function (resultCallback, errorCallback, result, config) {
                                if (config.SourceURL) {
                                    resultCallback(config.SourceURL);
                                } else {
                                    resultCallback(qnautils.getInputSourceName(config.InputSource));
                                }
                            }),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.PLAIN_TEXT)
                            .setIntro("Topics Created / Topics Reused")
                            .setName("NewTopicsCreated"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.PLAIN_TEXT)
                            .setIntro("Images Created / Images Reused")
                            .setName("NewImagesCreated"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.PLAIN_TEXT)
                            .setIntro("Files Created / Files Reused")
                            .setName("NewFilesCreated"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.HTML)
                            .setIntro("Topics with outgoing links")
                            .setName("OutgoingUrlsCompiled")
                            .setValue(function (resultCallback, errorCallback, result, config) {
                                if (config.OutgoingUrls.length === 0) {
                                    resultCallback("No topics have outgoing links that were not in the white list");
                                } else {
                                    resultCallback("<a href='http://" + config.PressGangHost + ":8080/pressgang-ccms-ui/#SearchResultsAndTopicView;query;topicIds=" + config.OutgoingUrls + "'</a>Go to topics with outgoing urls</a>");
                                }
                            }),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.HTML)
                            .setIntro("Newly Created Topics")
                            .setName("NewTopicsLink")
                            .setValue(function (resultCallback, errorCallback, result, config) {
                                if (config.NewTopics.length === 0) {
                                    resultCallback("No new topics were created");
                                } else {
                                    resultCallback("<a href='http://" + config.PressGangHost + ":8080/pressgang-ccms-ui/#SearchResultsAndTopicView;query;topicIds=" + config.NewTopics + "'</a>Go to new topics that were created as part of this import</a>");
                                }
                            }),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.HTML)
                            .setIntro("Updated Topics")
                            .setName("UpdatedTopicsLink")
                            .setValue(function (resultCallback, errorCallback, result, config) {
                                if (config.UpdatedTopics.length === 0) {
                                    resultCallback("No existing topics were updated");
                                } else {
                                    resultCallback("<a href='http://" + config.PressGangHost + ":8080/pressgang-ccms-ui/#SearchResultsAndTopicView;query;topicIds=" + config.UpdatedTopics + "'</a>Go to existing topics that were updated as part of this import</a>");
                                }
                            }),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.HTML)
                            .setIntro("Reused Topics")
                            .setName("ReusedTopicsLink")
                            .setValue(function (resultCallback, errorCallback, result, config) {
                                if (config.ReusedTopics.length === 0) {
                                    resultCallback("No existing topics were reused");
                                } else {
                                    resultCallback("<a href='http://" + config.PressGangHost + ":8080/pressgang-ccms-ui/#SearchResultsAndTopicView;query;topicIds=" + config.ReusedTopics + "'</a>Go to existing topics that were reused as part of this import</a>");
                                }
                            })
                    ])
            ])
            .setShowNext(false)
            .setShowPrevious(false)
            .setShowRestart("Import another book");
    }
);