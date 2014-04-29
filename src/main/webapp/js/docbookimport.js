define(
    ['jquery', 'qna/qna', 'qna/qnautils', 'qna/qnazipmodel', 'qnastart', 'specelement', 'uri/URI', 'docbookconstants', 'exports'],
    function (jquery, qna, qnautils, qnazipmodel, qnastart, specelement, URI, docbookconstants, exports) {
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
        // docbook elements whose contents have to match exactly
        var VERBATIM_ELEMENTS = ["date", "screen", "programlisting", "literallayout", "synopsis", "address", "computeroutput"];
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
            "simplesect",
            "sect1",
            "sect2",
            "sect3",
            "sect4",
            "sect5"
        ];



        var INJECTION_RE = /^\s*Inject\s*:\s*T?\d+\s*$/;


        var DOCBOOK_50 = "DOCBOOK_50";
        var DOCBOOK_45 = "DOCBOOK_45";
        var DEAFULT_REV_HISTORY_TITLE = "Revision History";
        var DEAFULT_LEGAL_NOTICE_TITLE = "Legal Notice";

        function getDocumentFormat(config) {
            return config.ImportOption === docbookconstants.DOCBOOK_50_IMPORT_OPTION ? DOCBOOK_50 : DOCBOOK_45;
        }

        function getDocbookVersion(config) {
            return config.ImportOption === docbookconstants.DOCBOOK_50_IMPORT_OPTION ? 5 : 4.5;
        }



        function getIgnoredFiles(lang) {
            // these files are created by csprocessor
            return [lang + "/files/pressgang_website.js"];
        }

        function removeRedundantXmlnsAttribute(xmlString) {
            return xmlString.replace(/(<\s*[A-Za-z0-9]+)\s+(xmlns\s*=\s*("|')http:\/\/docbook.org\/ns\/docbook("|'))(.*?>)/g, "$1$5");
        }



        /*
            Some containers are remaped when placed in a content spec
         */
        function remapContainer(container) {
            for (var index = 0; index < SECTION_CONTAINERS.length; ++index) {
                if (container === SECTION_CONTAINERS[index]) {
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



        function replaceSpecialChars(text) {
            return text.replace(/"/g, "\\\"")
                .replace(/\t/g, "\\t")
                .replace(/\n/g, "\\n");
        }

        function replaceElement (elementName, newElementName, xmlText) {
            if (xmlText.indexOf("<" + elementName) === 0) {
                xmlText = xmlText.replace(new RegExp("^<" + qnautils.escapeRegExp(elementName)), "<" + newElementName);
                xmlText = xmlText.replace(new RegExp("</" + qnautils.escapeRegExp(elementName) + ">$"), "</" + newElementName + ">");
            }

            return xmlText;
        }

        /*
            Replace the top level element with another
         */
        function setDocumentNodeToName (xmlText, newElementName) {
            var match = /\s*<\s*[^\s]+(.*?)>([\s\S]*)<\s*\/[^\s]+\s*>/.exec(xmlText);
            if (match !== null) {
                return "<" + newElementName + match[1] + ">" + match[2] + "</" + newElementName + ">";
            } else {
                return xmlText;
            }
        }

        function fixDocumentNode(topic, xmlText, format) {
            if (topic.infoTopic) {
                if (format === DOCBOOK_50 ) {
                    return setDocumentNodeToName(xmlText, "info");
                } else if (format === DOCBOOK_45) {
                    return setDocumentNodeToName(xmlText, "sectioninfo");
                }
            }

            return setDocumentNodeToName(xmlText, "section");
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
                            .setValue(function (resultCallback, errorCallback, result, config){resultCallback("Imported from " + qnautils.getInputSourceName(config.InputSource));})
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
            .setTitle("Importing Publican Book")
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

                var xmlDoc = qnautils.stringToXML(result);

                var inputModel = config.InputType === "Dir" ? qnastart.dirModel : qnastart.zipModel;

                var thisStep = this;

                window.onbeforeunload=function() {
                    return "The import process is in progress. Are you sure you want to quit?";
                };

                /**
                 * A collection of entity definitions
                 * @type {Array}
                 */

                var replacements = [];

                /*
                 Initialize some config values
                 */
                config.UploadedTopicCount = 0;
                config.MatchedTopicCount = 0;
                config.UploadedImageCount = 0;
                config.MatchedImageCount = 0;
                config.UploadedFileCount = 0;
                config.MatchedFileCount = 0;

                /*
                 There are 17 steps, so this is how far to move the progress bar with each
                 step.
                 */
                var progressIncrement = 100 / 20;

                /*
                    Load the tag ids for various tags used during the import
                 */
                function loadTagIDs() {
                    REVISION_HISTORY_TAG_ID = qnastart.loadEntityID("revisionHistoryTagId");
                    AUTHOR_GROUP_TAG_ID = qnastart.loadEntityID("authorGroupTagId");
                    ABSTRACT_TAG_ID = qnastart.loadEntityID("abstractTagId");
                    LEGAL_NOTICE_TAG_ID = qnastart.loadEntityID("legalNoticeTagId");
                    INFO_TAG_ID = qnastart.loadEntityID("infoTagId");
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

                function buildContentSpec(xmlDoc) {
                    var contentSpec = [];

                    /*
                     These metadata elements are either required or will always have a value
                     */
                    contentSpec.push("Title = " + (config.ContentSpecTitle === undefined ? "Unknown" : config.ContentSpecTitle));
                    contentSpec.push("Product = " + (config.ContentSpecProduct === undefined ? "Unknown" : config.ContentSpecProduct));
                    contentSpec.push("Format = DocBook " + getSpecDocbookVersion(config));
                    if (config.ContentSpecVersion) {
                        contentSpec.push("Version = " + config.ContentSpecVersion);
                    }

                    /*
                     These metadata elements are optional
                     */
                    if (config.ContentSpecSubtitle !== undefined) {
                        contentSpec.push("Subtitle = " + config.ContentSpecSubtitle);
                    }
                    if (config.ContentSpecEdition !== undefined) {
                        contentSpec.push("Edition = " + config.ContentSpecEdition);
                    }
                    if (config.ContentSpecPubsnumber !== undefined) {
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

                    if (xmlDoc.documentElement.nodeName === "book") {
                        if (xmlDoc.documentElement.hasAttribute("status") && xmlDoc.documentElement.attributes["status"].nodeValue.trim() === "draft") {
                            contentSpec.push("Type = Book-Draft");
                        } else {
                            contentSpec.push("Type = Book");
                        }

                    } else if (xmlDoc.documentElement.nodeName === "article") {
                        if (xmlDoc.documentElement.hasAttribute("status") && xmlDoc.documentElement.attributes["status"].nodeValue.trim() === "draft") {
                            contentSpec.push("Type = Article-Draft");
                        } else {
                            contentSpec.push("Type = Article");
                        }
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
                                contentSpec.push(value);
                            }
                        });

                        contentSpec.push("]");
                    }

                    extractRevisionHistory(xmlDoc, contentSpec);
                }

                function extractRevisionHistory (xmlDoc, contentSpec, topics, topicGraph) {
                    if (topics === undefined) {
                        topics = [];
                    }

                    // the graph that holds the topics
                    if (topicGraph === undefined) {
                        topicGraph = new specelement.TopicGraph();
                    }

                    var revHistory = qnautils.xPath("//docbook:revhistory", xmlDoc).iterateNext();

                    if (revHistory) {

                        var parentAppendix = revHistory;
                        while (parentAppendix.parentNode && (parentAppendix = parentAppendix.parentNode).nodeName !== "appendix") {

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

                        var id = parentAppendix.getAttribute ? parentAppendix.getAttribute("id") : null;

                        var revHistoryXML = "<appendix><title>" + revHistoryTitleContents + "</title>";

                        if (config.ImportOption === "DocBook45") {
                            revHistoryXML += "<simpara>";
                        }

                        revHistoryXML += qnautils.xmlToString(removeIdAttribute(revHistory));

                        if (config.ImportOption === "DocBook45") {
                            revHistoryXML += "</simpara>";
                        }

                        revHistoryXML += "</appendix>";

                        var revHistoryFixedXML = qnautils.stringToXML(revHistoryXML);

                        var topic = new specelement.TopicGraphNode(topicGraph)
                            .setXml(revHistoryFixedXML)
                            .setSpecLine(contentSpec.length - 1)
                            .setTitle(revHistoryTitleContents)
                            .addTag(REVISION_HISTORY_TAG_ID);

                        if (id) {
                            topic.addXmlId(id);
                        }

                        topics.push(topic);

                    }

                    config.UploadProgress[1] = 7 * progressIncrement;
                    thisStep.setTitlePrefixPercentage(config.UploadProgress[1]);
                    config.FoundRevisionHistory = true;
                    resultCallback();
                    extractAuthorGroup(xmlDoc, contentSpec, topics, topicGraph);
                }

                function extractAuthorGroup (xmlDoc, contentSpec, topics, topicGraph) {
                    if (topics === undefined) {
                        topics = [];
                    }

                    // the graph that holds the topics
                    if (topicGraph === undefined) {
                        topicGraph = new specelement.TopicGraph();
                    }

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

                    config.UploadProgress[1] = 8 * progressIncrement;
                    thisStep.setTitlePrefixPercentage(config.UploadProgress[1]);
                    config.FoundAuthorGroup = true;
                    resultCallback();

                    extractLegalNotice(xmlDoc, contentSpec, topics, topicGraph);
                }

                function extractLegalNotice (xmlDoc, contentSpec, topics, topicGraph) {
                    if (topics === undefined) {
                        topics = [];
                    }

                    // the graph that holds the topics
                    if (topicGraph === undefined) {
                        topicGraph = new specelement.TopicGraph();
                    }

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

                    config.UploadProgress[1] = 9 * progressIncrement;
                    thisStep.setTitlePrefixPercentage(config.UploadProgress[1]);
                    config.FoundLegalNotice = true;
                    resultCallback();

                    extractAbstract(xmlDoc, contentSpec, topics, topicGraph);
                }

                function extractAbstract (xmlDoc, contentSpec, topics, topicGraph) {
                    if (topics === undefined) {
                        topics = [];
                    }

                    // the graph that holds the topics
                    if (topicGraph === undefined) {
                        topicGraph = new specelement.TopicGraph();
                    }

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

                    config.UploadProgress[1] = 10 * progressIncrement;
                    thisStep.setTitlePrefixPercentage(config.UploadProgress[1]);
                    config.FoundAbstract = true;
                    resultCallback();

                    uploadFiles(xmlDoc, contentSpec, topics, topicGraph);
                }

                /*
                    Publican books can contain a files directory. Every file in this directory
                    needs to be uploaded
                 */
                function uploadFiles (xmlDoc, contentSpec, topics, topicGraph) {
                    var fileIds = [];

                    inputModel.getCachedEntries(
                        config.InputSource,
                        function(entries) {
                            var processEntry = function(index) {
                                if (index >= entries.length) {

                                    if (fileIds.length !== 0) {
                                        contentSpec.push("Files = [" + fileIds.toString() + "]");
                                    }

                                    config.UploadProgress[1] = 11 * progressIncrement;
                                    thisStep.setTitlePrefixPercentage(config.UploadProgress[1]);
                                    config.FoundFiles = true;
                                    resultCallback();

                                    uploadImages (xmlDoc, contentSpec, topics, topicGraph);
                                } else {
                                    var entry = entries[index];
                                    var filename = qnautils.getFileName(entry);
                                    if (new RegExp("^" + qnautils.escapeRegExp(config.ImportLang) + "/files/.+").test(filename) &&
                                        qnautils.isNormalFile(filename) &&
                                        getIgnoredFiles(config.ImportLang).indexOf(filename) === -1) {

                                        var uri = new URI(filename);

                                        qnastart.createFile(
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

                                                config.UploadProgress[1] = (10 * progressIncrement) + (index / entries.length * progressIncrement);
                                                thisStep.setTitlePrefixPercentage(config.UploadProgress[1]);
                                                resultCallback();

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
                }

                function uploadImages (xmlDoc, contentSpec, topics, topicGraph) {
                    // count the number of images we are uploading
                    var images = qnautils.xPath("//@fileref", xmlDoc);
                    var numImages = 0;

                    var image;
                    while ((image = images.iterateNext()) !== null) {
                        ++numImages;
                    }

                    images = qnautils.xPath("//@fileref", xmlDoc);
                    var uploadedImages = {};

                    var processImages = function (image, count) {
                        if (image) {

                            var nodeValue = image.nodeValue;

                            var filename = !docbookconstants.COMMON_CONTENT_PATH_PREFIX.test(nodeValue) ?
                                config.ImportLang + "/" + nodeValue :
                                nodeValue;

                            if (!uploadedImages[nodeValue]) {

                                inputModel.hasFileName(
                                    config.InputSource,
                                    filename,
                                    function (result) {
                                        if (result) {
                                            qnastart.createImage(
                                                inputModel,
                                                config.CreateOrResuseImages === "REUSE",
                                                config.InputSource,
                                                filename,
                                                config.ImportLang,
                                                config,
                                                function (data) {
                                                    var imageId = config.CreateOrResuseImages === "REUSE" ? data.image.id : data.id;

                                                    config.UploadedImageCount += 1;

                                                    if (config.CreateOrResuseImages === "REUSE" && data.matchedExistingImage) {
                                                        config.MatchedImageCount += 1;
                                                    }

                                                    config.NewImagesCreated = (config.UploadedImageCount - config.MatchedImageCount) + " / " + config.MatchedImageCount;
                                                    resultCallback();

                                                    uploadedImages[nodeValue] = imageId + nodeValue.substr(nodeValue.lastIndexOf("."));

                                                    ++count;

                                                    config.UploadProgress[1] = (11 * progressIncrement) + (count / numImages * progressIncrement);
                                                    thisStep.setTitlePrefixPercentage(config.UploadProgress[1]);
                                                    resultCallback();

                                                    processImages(images.iterateNext(), count);
                                                },
                                                errorCallback
                                            );
                                        } else {
                                            console.log("Could not find " + nodeValue);
                                            processImages(images.iterateNext(), ++count);
                                        }
                                    },
                                    errorCallback,
                                    true
                                );
                            }  else {
                                processImages(images.iterateNext(), ++count);
                            }
                        } else {
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

                            config.UploadProgress[1] = 12 * progressIncrement;
                            thisStep.setTitlePrefixPercentage(config.UploadProgress[1]);
                            config.FoundImages = true;
                            resultCallback();

                            resolveBookStructure(xmlDoc, contentSpec, topics, topicGraph);
                        }
                    };

                    processImages(images.iterateNext(), 0);
                }

                function resolveBookStructure (xmlDoc, contentSpec, topics, topicGraph) {
                    // so we can work back to the original source
                    contentSpec.push("# Imported from " + qnautils.getInputSourceName(config.InputSource));

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
                        return qnautils.reencode(title, replacements);
                    }

                    var processXml = function (parentXML, depth) {
                        // loop over the containers under the root element
                        jquery.each(parentXML.childNodes, function (index, value) {
                            if (CONTAINER_TYPES.indexOf(value.nodeName) !== -1) {
                                // take a copy of this container
                                var clone = value.cloneNode(true);

                                // find the title
                                var title = qnautils.xPath("./docbook:title", clone).iterateNext();
                                var titleText = null;
                                if (title !== null) {
                                    titleText = qnautils.replaceWhiteSpace(title.innerHTML);

                                    // remove any redundant namespace attributes
                                    titleText = removeRedundantXmlnsAttribute(titleText);

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
                                    if (CONTAINER_TYPES.indexOf(containerChild.nodeName) !== -1) {
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

                                // what we have left is the contents of a initial text topic
                                var contentSpecLine = "";
                                for (var i = 0; i < depth * 2; ++i) {
                                    contentSpecLine += " ";
                                }

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

                                        if (TOPIC_CONTAINER_TYPES.indexOf(value.nodeName) !== -1) {
                                            /*
                                                This is a plain topic. We don't extract info elements from plain
                                                topics.
                                             */
                                            contentSpec.push(contentSpecLine + titleText);

                                        } else {
                                            /*
                                                This is a container element. We do extract info elements from containers.
                                             */
                                            var infoTitle = extractInfoTopic(xmlDoc, contentSpec.length, clone, topics, topicGraph);

                                            var containerName = remapContainer(value.nodeName);
                                            contentSpec.push(
                                                contentSpecLine +
                                                    containerName.substring(0, 1).toUpperCase() +
                                                    containerName.substring(1, containerName.length) +
                                                    ": " +
                                                    getTitle(titleText, infoTitle));
                                        }

                                        var standaloneContainerTopic = new specelement.TopicGraphNode(topicGraph)
                                            .setXml(removeIdAttribute(clone))
                                            .setSpecLine(contentSpec.length - 1)
                                            .setTitle(titleText);

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

                                    var containerName = remapContainer(value.nodeName);
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
                                            .setTitle((titleText || infoTitle || DEFAULT_TITLE));

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

                    config.UploadProgress[1] = 13 * progressIncrement;
                    thisStep.setTitlePrefixPercentage(config.UploadProgress[1]);
                    config.ResolvedBookStructure = true;
                    resultCallback();

                    matchExistingTopics(xmlDoc, contentSpec, topics, topicGraph);
                }

                /*
                 Resolve the topics either to existing topics in the database, or to new topics
                 */
                function matchExistingTopics (xmlDoc, contentSpec, topics, topicGraph) {
                    /*
                        Remove any non-injection comments
                     */
                    function normalizeComments(xml) {
                        var comments = qnautils.xPath("//docbook:comment()", xml);
                        var commentsCollection = [];
                        var comment;
                        while ((comment = comments.iterateNext()) !== null) {
                            if (!/^Inject[A-Za-z]*\s*:\s*T?\d+/.test(comment.nodeValue.trim())) {
                                commentsCollection.push(comment);
                            }
                        }

                        jquery.each(commentsCollection, function (index, value) {
                            value.parentNode.removeChild(value);
                        });

                        return xml;
                    }

                    /*
                     Take every xref that points to a topic (and not just a place in a topic), and replace it
                     with a injection placeholder. This is done on topics to be imported.
                     */
                    function normalizeXrefs (xml, topicAndContainerIDs) {
                        jquery.each(['xref', 'link'], function(index, linkElement) {
                            var xrefs = qnautils.xPath("//docbook:" + linkElement, xml);
                            var xref;
                            var xrefReplacements = [];
                            while ((xref = xrefs.iterateNext()) !== null) {
                                if (xref.hasAttribute("linkend")) {
                                    var linkend = xref.getAttribute("linkend");
                                    if (topicAndContainerIDs.indexOf(linkend) !== -1) {
                                        var xrefReplacement = xmlDoc.createComment("InjectPlaceholder: 0");
                                        var replacement = {original: xref, replacement: [xrefReplacement]};
                                        xrefReplacements.push(replacement);
                                    }
                                }
                            }

                            jquery.each(xrefReplacements, function (index, value) {
                                for (var replacementIndex = 0; replacementIndex < value.replacement.length; ++replacementIndex) {
                                    if (replacementIndex === value.replacement.length - 1) {
                                        value.original.parentNode.replaceChild(value.replacement[replacementIndex], value.original);
                                    } else {
                                        value.original.parentNode.insertBefore(value.replacement[replacementIndex], value.original);
                                    }
                                }
                            });
                        });

                        return xml;
                    }

                    /*
                        Ensure that all special characters are consistently escaped.
                     */
                    function normalizeXMLEntityCharacters(xml, replacements) {
                        var textNodes = qnautils.xPath(".//text()", xml);
                        var text;
                        var textNodesCollection = [];
                        while ((text = textNodes.iterateNext()) !== null) {
                            textNodesCollection.push(text);
                        }

                        jquery.each(textNodesCollection, function(index, value) {

                            /*
                                First return any entities that we consider equivalent.
                             */
                            jquery.each(replacements, function(index, replacementValue) {
                                if (replacementValue.entity === "&quot;" ) {
                                    value.nodeValue = value.nodeValue.replace(new RegExp(qnautils.escapeRegExp(replacementValue.placeholder), "g"), "#quot#");
                                }

                                if (replacementValue.entity === "&apos;") {
                                    value.nodeValue = value.nodeValue.replace(new RegExp(qnautils.escapeRegExp(replacementValue.placeholder), "g"), "#apos#");
                                }
                            });
                            /*
                                Then replace equivalent characters/entities with a common marker.
                             */
                            value.nodeValue = value.nodeValue
                                /*
                                 Start by returning all entities to their character state
                                 */
                                .replace(/&quot;/g, '"')
                                .replace(/&apos;/g, '\'')
                                /*
                                 Now encode back. Note that we don't want to use any characters that will be
                                 further encoded when the xml is converted to a string. This is just for
                                 equality testing.
                                 */
                                .replace(/’/g, '#apos#')
                                .replace(/'/g, '#apos#')
                                .replace(/“/g, '#quot#')
                                .replace(/”/g, '#quot#')
                                .replace(/"/g, "#quot#");
                        });

                        return xml;
                    }

                    /*
                     Take every injection and replace it with a placeholder. This is done on existing topics
                     from PressGang.
                     */
                    function normalizeInjections (xml) {
                        var comments = qnautils.xPath("//comment()", xml);
                        var comment;
                        var commentReplacements = [];
                        while ((comment = comments.iterateNext()) !== null) {
                            if (INJECTION_RE.test(comment.textContent)) {
                                var commentReplacement = xmlDoc.createComment("InjectPlaceholder: 0");
                                commentReplacements.push({original: comment, replacement: commentReplacement});
                            }
                        }

                        jquery.each(commentReplacements, function (index, value) {
                            value.original.parentNode.replaceChild(value.replacement, value.original);
                        });

                        return xml;
                    }

                    /*
                        This function takes the xml and strips out ignored whitespace. This allows us to compare
                        two xml documents that may have been formatted differently.

                        This is a bit of a hack. Technically, all white space is significant unless otherwise
                        specified by the DTD. We assume here that all whitespace is insignificant.

                        This will cause issues if a topic already exists in the database that has only whitespace
                        changes.

                        To fix this we run a second check against the content of any elements where whitespace is
                        significant.
                     */
                    function removeWhiteSpace(xml) {
                        xml = xml.replace(/\n/gm, " ");                     // replace all existing line breaks
                        xml = xml.replace(/\t/gm, " ");                     // replace all existing tabs
                        xml = xml.replace(/>/gm, ">\n");                    // break after a the end of an element
                        xml = xml.replace(/</gm, "\n<");                    // break before the start of an element
                        xml = xml.replace(/^\s+/gm, "");                  // remove leading whitespace
                        xml = xml.replace(/\s+$/gm, "");                  // remove trailing whitespace
                        xml = xml.replace(/(\S+)([ ]{2,})/gm, "$1 ");       // remove double spaces within text
                        return xml;
                    }


                    /*
                     The order of the attributes is changed by PressGang, so before we do a comparison
                     we order any attributes in any node.
                     */
                    function reorderAttributes(xml) {

                        if (xml.attributes !== undefined) {
                            var attributes = {};
                            jquery.each(xml.attributes, function(index, attr) {
                                attributes[attr.name] = attr.value;
                            });

                            while (xml.attributes.length !== 0) {
                                xml.removeAttribute(xml.attributes[0].name);
                            }

                            var attributeKeys = qnautils.keys(attributes);

                            jquery.each(attributeKeys, function (index, attrName) {
                                /*
                                 Don't add some common attributes. These are either added
                                 by csprocessor when it build a book, by the xml
                                 serialization process, or are not considered important
                                 when comparing XML files for equality.
                                 */
                                if (attrName.indexOf("xmlns") !== 0 &&
                                    attrName.indexOf("version") !== 0 &&
                                    attrName.indexOf("remap") !== 0 ) {
                                    xml.setAttribute(attrName, attributes[attrName]);
                                }
                            });
                        }

                        var allElements = qnautils.xPath(".//docbook:*", xml);
                        var elements = [];
                        var elementIter;
                        while ((elementIter = allElements.iterateNext()) !== null) {
                            elements.push(elementIter);
                        }

                        jquery.each(elements, function (index, element) {
                            reorderAttributes(element);
                        });
                    }

                    var topicOrContainerIDs = topicGraph.getAllTopicOrContainerIDs();

                    /*
                     Step 1: find any potential matches already in the PressGang server
                     */
                    function getPossibleMatches(index, callback) {
                        if (index >= topics.length) {
                            callback();
                        } else {
                            config.UploadProgress[1] = (14 * progressIncrement) + (index / topics.length * progressIncrement);
                            thisStep.setTitlePrefixPercentage(config.UploadProgress[1]);
                            resultCallback();

                            var topic = topics[index];
                            qnastart.getSimilarTopics(
                                qnautils.reencode(qnautils.xmlToString(topic.xml), replacements),
                                config,
                                function (data) {
                                    var format = getDocumentFormat(config);

                                    /*
                                     We start by comparing the topic we are trying to import to the close match in the
                                     database. To do this we normalize whitespace, injections and xrefs. If the two
                                     topics then match we have a potential candidate to reuse.
                                     */
                                    var topicXMLCopy = topic.xml.cloneNode(true);
                                    normalizeXrefs(
                                        normalizeInjections(
                                            normalizeComments(topicXMLCopy)), topicOrContainerIDs);
                                    reorderAttributes(topicXMLCopy);
                                    normalizeXMLEntityCharacters(topicXMLCopy, replacements);

                                    var topicXMLCompare = qnautils.xmlToString(topicXMLCopy);
                                    topicXMLCompare = removeWhiteSpace(topicXMLCompare);
                                    topicXMLCompare = qnautils.reencode(topicXMLCompare, replacements);
                                    topicXMLCompare = removeRedundantXmlnsAttribute(topicXMLCompare);
                                    topicXMLCompare = fixDocumentNode(topic, topicXMLCompare, format);

                                    /*
                                     topicXMLCompare now has injection placeholders that will match the injection
                                     points in existing topics, has any entities put back, has whitespace removed
                                     and the main element is a section.

                                     We are now ready to compare it directly to topics pulled from PressGang and
                                     normalized.
                                     */
                                    data.items.sort(function(a,b){
                                        if (a.item.id < b.item.id) {
                                            return 1;
                                        }

                                        if (a.item.id === b.item.id) {
                                            return 0;
                                        }

                                        return -1;
                                    });
                                    jquery.each(data.items, function(index, matchingTopic) {
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
                                            /*
                                             Remove the comments
                                             */
                                            normalizeComments(matchingTopicXMLCopy);
                                            /*
                                             Normalize injections. We do this against a XML DOM because it is more
                                             robust than doing regexes on strings.
                                             */
                                            normalizeInjections(matchingTopicXMLCopy);
                                            /*
                                             Order the attributes in nodes in a consistent way
                                             */
                                            reorderAttributes(matchingTopicXMLCopy);
                                            /*
                                                Convert characters like " and entities like &quot; to a common marker
                                                for comparasion
                                             */
                                            normalizeXMLEntityCharacters(matchingTopicXMLCopy, replacedTextResult.replacements);
                                            /*
                                             Convert back to a string
                                             */
                                            var matchingTopicXMLCompare = qnautils.xmlToString(matchingTopicXMLCopy);
                                            /*
                                             Strip whitespace
                                             */
                                            matchingTopicXMLCompare = removeWhiteSpace(matchingTopicXMLCompare);
                                            /*
                                             Restore entities
                                             */
                                            matchingTopicXMLCompare = qnautils.reencode(matchingTopicXMLCompare, replacedTextResult.replacements);

                                            if (matchingTopicXMLCompare === topicXMLCompare) {

                                                /*
                                                    This is the second level of checking. If we reach this point we know the
                                                    two XML file have the same structure and content ignoring any whitespace.
                                                    Now we make sure that any elements where whitespace is signifiant also
                                                    match.
                                                 */
                                                var verbatimMatch = true;
                                                jquery.each(VERBATIM_ELEMENTS, function (index, elementName) {
                                                    var originalNodes = qnautils.xPath(".//docbook:" + elementName, topicXMLCopy);
                                                    var matchingNodes = qnautils.xPath(".//docbook:" + elementName, matchingTopicXMLCopy);

                                                    var originalNode;
                                                    var matchingNode;
                                                    while ((originalNode = originalNodes.iterateNext()) !== null) {
                                                        matchingNode = matchingNodes.iterateNext();

                                                        if (matchingNode === null) {
                                                            throw "There was a mismatch between verbatim elements in similar topics!";
                                                        }

                                                        var reencodedOriginal = qnautils.reencode(qnautils.xmlToString(originalNode), replacements);
                                                        var reencodedMatch = qnautils.reencode(qnautils.xmlToString(matchingNode), replacedTextResult.replacements);

                                                        // the original

                                                        if (qnautils.reencodedOriginal !==qnautils.reencodedMatch) {
                                                            verbatimMatch = false;
                                                            return false;
                                                        }
                                                    }

                                                    if ((matchingNode = matchingNodes.iterateNext()) !== null) {
                                                        throw "There was a mismatch between verbatim elements in similar topics!";
                                                    }
                                                });

                                                if (verbatimMatch) {
                                                    topic.addPGId(matchingTopic.item.id, matchingTopic.item.xml);
                                                }
                                            }
                                        } else {
                                            console.log("The XML in topic " + matchingTopic.item.id + " could not be parsed");
                                        }
                                    });

                                    if (topic.pgIds === undefined) {
                                        console.log("Topic " + topic.title + " has no matches in the database.");
                                    }

                                    getPossibleMatches(index + 1, callback);
                                },
                                errorCallback
                            );
                        }
                    }

                    if (config.CreateOrResuseTopics === "REUSE") {
                        getPossibleMatches(0, function() {
                            /*
                                get a report of potentially reused topics. This is really just a convenient
                                place to set a break point.
                             */
                            jquery.each(topics, function(index, value) {
                                if (value.pgIds === undefined) {
                                    console.log(value.title + ": none");
                                } else {
                                    var matchingIds = "";
                                    jquery.each(value.pgIds, function(key, value) {
                                        if (matchingIds.length !== 0) {
                                            matchingIds += ", ";
                                        }
                                        matchingIds += key;
                                    });
                                    console.log(value.title + ": " + matchingIds);
                                }
                            });

                            populateOutgoingLinks();
                        });
                    } else {
                        populateOutgoingLinks();
                    }

                    /*
                     Step 2: Populate outgoing links
                     */
                    function populateOutgoingLinks() {
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

                        config.UploadProgress[1] = 15 * progressIncrement;
                        thisStep.setTitlePrefixPercentage(config.UploadProgress[1]);
                        config.MatchedExistingTopics = true;
                        resultCallback();

                        resolveXrefs(xmlDoc, contentSpec, topics, topicGraph);
                    }
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
                function resolveXrefs (xmlDoc, contentSpec, topics, topicGraph) {
                    /*
                     Return a node without a topic ID (which means it hasn't been resolved) and
                     outgoing or incoming links (which means it is part of a xref graph).
                     */
                    function getUnresolvedNodeWithOutboundXrefs() {
                        var retValue = null;
                        jquery.each(topics, function (index, topic) {
                            if (topic.topicId === undefined &&
                                topic.pgIds !== undefined &&
                                topic.fixedOutgoingLinks !== undefined) {
                                retValue = topic;
                                return false;
                            }
                        });
                        return retValue;
                    }

                    var unresolvedNode;
                    while ((unresolvedNode = getUnresolvedNodeWithOutboundXrefs()) !== null) {
                        /*
                         Loop through each possible topic id that this topic could be
                         and see if all other nodes in the xref graph are also valid with
                         this configuration.
                         */
                        var validNodesOptions = [];
                        jquery.each(unresolvedNode.pgIds, function (pgId, details) {
                            var network = unresolvedNode.isValid(pgId);
                            if (network !== null) {
                                validNodesOptions.push(network);
                            }
                        });

                        if (validNodesOptions.length !== 0) {

                            var mostSuccess = undefined;
                            jquery.each(validNodesOptions, function(index, validNodesOption){
                                if (mostSuccess === undefined || validNodesOption.length > mostSuccess.length) {
                                    mostSuccess = validNodesOption;
                                }
                            });

                            /*
                             Every topic in this xref graph is valid with an existing topic id,
                             so set the topicId to indicate that these nodes have been resolved.
                             */
                            jquery.each(mostSuccess, function (index, topic) {
                                if (topic.node.topicId !== undefined) {
                                    throw "We should not be able to set the topic id twice";
                                }

                                topic.node.setTopicId(topic.assumedId);

                                config.UploadedTopicCount += 1;
                                config.MatchedTopicCount += 1;
                            });
                        } else {
                            /*
                             We could not find a valid xref graph with the possible existing matches,
                             so set all the topic ids to -1 to indicate that these topics have to be created
                             new.
                             */
                            var unresolvedNetwork = [];
                            unresolvedNode.getUnresolvedGraph(unresolvedNetwork);

                            jquery.each(unresolvedNetwork, function (index, topic) {
                                if (topic.topicId !== undefined) {
                                    throw "We should not be able to set the topic id twice";
                                }

                                topic.setTopicId(-1);
                                config.UploadedTopicCount += 1;
                            });
                        }

                        config.NewTopicsCreated = (config.UploadedTopicCount - config.MatchedTopicCount) + " / " + config.MatchedTopicCount;

                        resultCallback();
                    }

                    /*
                     Any that are left are stand alone topics. These can take on the first matching
                     topic id, or -1 is they are new topics.
                     */
                    jquery.each(topics, function (index, topic) {
                        if (topic.topicId === undefined) {
                            if (topic.pgIds !== undefined) {
                                topic.setTopicId(Object.keys(topic.pgIds)[0]);
                                config.UploadedTopicCount += 1;
                                config.MatchedTopicCount += 1;
                            } else {
                                topic.setTopicId(-1);
                                config.UploadedTopicCount += 1;
                            }
                        }
                    });

                    config.NewTopicsCreated = (config.UploadedTopicCount - config.MatchedTopicCount) + " / " + config.MatchedTopicCount;

                    config.UploadProgress[1] = 16 * progressIncrement;
                    thisStep.setTitlePrefixPercentage(config.UploadProgress[1]);
                    config.ResolvedXRefGraphs = true;
                    resultCallback();

                    uploadTopics(xmlDoc, contentSpec, topics, topicGraph);
                }

                function uploadTopics (xmlDoc, contentSpec, topics, topicGraph) {
                    function createTopics(index, callback) {
                        if (index >= topics.length) {
                            callback();
                        } else {
                            config.UploadProgress[1] = (17 * progressIncrement) + (index / topics.length * progressIncrement);
                            thisStep.setTitlePrefixPercentage(config.UploadProgress[1]);
                            resultCallback();

                            var format = getDocumentFormat(config);

                            var topic = topics[index];
                            if (topic.topicId === -1) {
                                qnastart.createTopic(
                                    false,
                                    getDocbookVersion(config),
                                    removeRedundantXmlnsAttribute(
                                        fixDocumentNode(
                                            topic,
                                            qnautils.reencode(qnautils.xmlToString(topic.xml), replacements).trim(),
                                            format
                                        )
                                    ),
                                    topic.title,
                                    topic.tags,
                                    config.ImportLang,
                                    config,
                                    function (data) {
                                        topic.setTopicId(data.id);
                                        topic.createdTopic = true;

                                        var replacedTextResult = qnautils.replaceEntitiesInText(data.xml);

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

                                        createTopics(index + 1, callback);
                                    },
                                    errorCallback
                                );
                            } else {
                                createTopics(index + 1, callback);
                            }
                        }
                    }

                    createTopics(0, function() {

                        config.UploadProgress[1] = 17 * progressIncrement;
                        thisStep.setTitlePrefixPercentage(config.UploadProgress[1]);
                        config.UploadedTopics = true;
                        resultCallback();

                        resolveXrefsInCreatedTopics(xmlDoc, contentSpec, topics, topicGraph);
                    });
                }

                function resolveXrefsInCreatedTopics (xmlDoc, contentSpec, topics, topicGraph) {

                    var format = getDocumentFormat(config);

                    function resolve(index, callback) {
                        if (index >= topics.length) {
                            callback();
                        } else {
                            config.UploadProgress[1] = (17 * progressIncrement) + (index / topics.length * progressIncrement);
                            thisStep.setTitlePrefixPercentage(config.UploadProgress[1]);
                            resultCallback();

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
                                                    (destinationTopic.topicId === undefined || destinationTopic.topicId === -1)) {
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

                                qnastart.updateTopic(
                                    topic.topicId,
                                    removeRedundantXmlnsAttribute(
                                        fixDocumentNode(
                                            topic,
                                            qnautils.reencode(qnautils.xmlToString(topic.xml), topic.replacements),
                                            format
                                        )
                                    ),
                                    topic.title,
                                    config,
                                    function (data) {
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

                        config.UploadProgress[1] = 18 * progressIncrement;
                        thisStep.setTitlePrefixPercentage(config.UploadProgress[1]);
                        config.FixXRefs = true;
                        resultCallback();

                        updateContentSpecWithTopicIDs(xmlDoc, contentSpec, topics, topicGraph);
                    });
                }

                function updateContentSpecWithTopicIDs (xmlDoc, contentSpec, topics, topicGraph) {
                    jquery.each(topics, function (index, topic) {
                        if (topic.infoTopic === undefined || topic.infoTopic === false) {
                            contentSpec[topic.specLine] += " [" + topic.topicId + "]";
                        } else {
                            contentSpec[topic.specLine] += " [Info: " + topic.topicId + "]";
                        }
                    });

                    config.UploadProgress[1] = 19 * progressIncrement;
                    thisStep.setTitlePrefixPercentage(config.UploadProgress[1]);
                    config.UpdatedContentSpec = true;
                    resultCallback();

                    uploadContentSpec(contentSpec);
                }

                function uploadContentSpec (contentSpec) {
                    var compiledContentSpec = "";
                    jquery.each(contentSpec, function(index, value) {
                        compiledContentSpec += value + "\n";
                    });

                    function contentSpecSaveSuccess(id) {
                        config.UploadProgress[1] = 100;
                        thisStep.setTitlePrefix(null);
                        config.UploadedContentSpecification = true;
                        config.ContentSpecID = id;
                        resultCallback(true);
                    }

                    if (config.ExistingContentSpecID) {
                        qnastart.updateContentSpec(
                            config.ExistingContentSpecID,
                            compiledContentSpec,
                            config,
                            contentSpecSaveSuccess,
                            errorCallback
                        );
                    } else {
                        qnastart.createContentSpec(
                            compiledContentSpec,
                            config.ImportLang,
                            config,
                            contentSpecSaveSuccess,
                            errorCallback
                        );
                    }
                }

                // start the process
                loadTagIDs();
                buildContentSpec(xmlDoc);

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
                                resultCallback(config.InputSource.name);
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
                            .setName("NewFilesCreated")
                    ])
            ])
            .setShowNext(false)
            .setShowPrevious(false)
            .setShowRestart("Import another book");
    }
);