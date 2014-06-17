define(['jquery', 'qna/qnautils', 'exports'], function(jquery, qnautils, exports) {
    'use strict';

    var ValidOrProcessed = {
        INVALID: 0,
        VALID: 1,
        PROCESSED: 2
    }

    exports.TopicGraph = function () {
        this.nodes = [];
        this.conatiners = [];
    };

    exports.TopicGraph.prototype.addNode = function (node) {
        if (this.nodes.indexOf(node) === -1) {
            this.nodes.push(node);
        }
    };

    exports.TopicGraph.prototype.addContainer = function (container) {
        if (this.conatiners.indexOf(container) === -1) {
            this.conatiners.push(container);
        }
    };

    exports.TopicGraph.prototype.getNodeFromXMLId = function (xmlId) {
        var retValue;
        jquery.each(this.nodes, function(index, node) {
            if (node.xmlIds !== undefined) {
                jquery.each(node.xmlIds, function(index, value) {
                    if (value === xmlId) {
                        retValue = node;
                        return false;
                    }
                });
            }
        });

        if (retValue === undefined) {
            jquery.each(this.conatiners, function(index, conatiner) {
                if (conatiner.xmlIds !== undefined) {
                    jquery.each(conatiner.xmlIds, function(index, value) {
                        if (value === xmlId) {
                            retValue = conatiner;
                            return false;
                        }
                    });
                }
            });
        }
        return retValue;
    };

    exports.TopicGraph.prototype.getNodeFromSpecLine = function (specLine) {
        var retValue;
        jquery.each(this.nodes, function(index, node) {
            if (node.specLine === specLine) {
                retValue = node;
                return false;
            }
        });

        return retValue;
    };

    exports.TopicGraph.prototype.hasXMLId = function (xmlId) {
        var retValue = false;
        jquery.each(this.nodes, function(index, node) {
            if (node.xmlIds !== undefined) {
                jquery.each(node.xmlIds, function(index, value) {
                    if (value === xmlId) {
                        retValue = true;
                        return false;
                    }
                });
            }
        });

        if (retValue) {
            return retValue;
        }

        jquery.each(this.conatiners, function(index, conatiner) {
            if (conatiner.xmlIds !== undefined) {
                jquery.each(conatiner.xmlIds, function(index, value) {
                    if (value === xmlId) {
                        retValue = true;
                        return false;
                    }
                });
            }
        });

        return retValue;
    };

    exports.TopicGraph.prototype.getAllTopicOrContainerIDs = function () {
        var retValue = [];
        jquery.each(this.nodes, function (index, value) {
            if (value.xmlIds !== undefined) {
                jquery.each(value.xmlIds, function (index, xmlId) {
                    if (retValue.indexOf(xmlId) === -1) {
                        retValue.push(xmlId);
                    }
                });
            }
        });

        jquery.each(this.conatiners, function(index, conatiner) {
            if (conatiner.xmlIds !== undefined) {
                jquery.each(conatiner.xmlIds, function(index, xmlId) {
                    if (retValue.indexOf(xmlId) === -1) {
                        retValue.push(xmlId);
                    }
                });
            }
        });

        return retValue;
    };

    exports.TopicGraphContainer = function (topicGraph) {
        topicGraph.addContainer(this);
        this.topicGraph = topicGraph;
        return this;
    };

    exports.TopicGraphContainer.prototype.addXmlId = function (xmlId) {
        if (this.xmlIds === undefined) {
            this.xmlIds = [];
        }

        if (this.xmlIds.indexOf(xmlId) === -1) {
            this.xmlIds.push(xmlId);
        }

        return this;
    };

    exports.TopicGraphContainer.prototype.setSpecLine = function (specLine) {
        this.specLine = specLine;
        return this;
    };

    exports.TopicGraphContainer.prototype.setContainerTargetNum = function (targetNum) {
        this.targetNum = targetNum;
        return this;
    };

    /**
     * The big challenge for this import application is to map the xref graph (which is to say the
     * relationships between topics defined by xref links) in the imported book to any collection
     * of existing topics on the server that also have the same xref graph topology.
     *
     * We can reuse topics from the server only if they have the same content and if their xref
     * graph maps to the same topics. If even one xref in a xref graph is not the same, all the
     * nodes in the graph can not be reused.
     *
     * The TopicGraphNode class represents a topic in the imported book. But more importantly, it
     * represents a node in a xref graph (even if it is a stand alone node with no outgoing xrefs
     * and none coming in)
     *
     * The topics listed in pgIds are potential duplicate existing topics. The relationships in
     * fixedOutgoingLinks define what topic IDs this node expects to find on the other end
     * of an xref.
     *
     * isValid() is used to test if a topic reusing a particular existing topic id can resolve
     * all of the other nodes in its xref graph.
     *
     * @param topicGraph The graph that will hold this node
     * @returns {exports.TopicGraphNode} this
     * @constructor
     */
    exports.TopicGraphNode = function (topicGraph) {
        topicGraph.addNode(this);
        this.topicGraph = topicGraph;
        return this;
    };

    /**
     * @param info True if this topic is an info topic that should be assigned to a container
     * @returns {exports}
     */
    exports.TopicGraphNode.prototype.setInfoTopic = function (info) {
        this.infoTopic = info;
        return this;
    };

    /**
     * @param info True if this topic is an abstract topic that should be assigned to a metadata element
     * @returns {exports}
     */
    exports.TopicGraphNode.prototype.setAbstractTopic = function (info) {
        this.abstractTopic = info;
        return this;
    };

    /**
     * Use this to define the XML associated with a topic when the XML has already been
     * stripped of any entities. This is the case when importing existing docbook books.
     * @param xml
     * @returns {exports}
     */
    exports.TopicGraphNode.prototype.setXml = function (xml) {
        this.xml = xml;
        this.xrefs = [];
        this.findXRefs();
        return this;
    };

    /**
     * Use this when importing content from other formats, like HTML or ODT. This is because sources like HTML
     * may contain useful entities (like nbsp) that we want to preserve.
     * @param xmlReplacements
     * @returns {exports}
     */
    exports.TopicGraphNode.prototype.setXmlReplacements = function (xmlReplacements) {
        this.xmlReplacements = xmlReplacements.replacements;
        this.xml = jquery.parseXML(xmlReplacements.xml);
        this.xrefs = [];
        this.findXRefs();
        return this;
    };

    exports.TopicGraphNode.prototype.findXRefs = function() {
        var thisStep = this;
        /*
            This is a little more complicated because we need to get the xrefs and links in order.
            A single or (qnautils.xPath(".//docbook:xref | .//docbook:link", thisStep.xml)) would
            return the elements, but not in the order they are found in the source xml.
         */
        var xrefs = qnautils.xPath(".//*[self::docbook:xref or self::docbook:link]", thisStep.xml)
        var xref;
        while ((xref = xrefs.iterateNext()) !== null) {
            if (xref.hasAttribute("linkend")) {
                var xrefLinkend = xref.getAttribute("linkend");
                thisStep.xrefs.push(xrefLinkend);
            }
        }

    };

    exports.TopicGraphNode.prototype.setTitle = function (title) {
        this.title = title;
        return this;
    };

    exports.TopicGraphNode.prototype.addTag = function (tag) {
        if (this.tags === undefined) {
            this.tags = [];
        }
        this.tags.push(tag);
        return this;
    };

    exports.TopicGraphNode.prototype.setSpecLine = function (specLine) {
        this.specLine = specLine;
        return this;
    };

    exports.TopicGraphNode.prototype.addXmlId = function (xmlId) {
        if (this.xmlIds === undefined) {
            this.xmlIds = [];
        }

        if (this.xmlIds.indexOf(xmlId) === -1) {
            this.xmlIds.push(xmlId);
        }

        return this;
    };

    exports.TopicGraphNode.prototype.setTopicId = function (topicId) {
        this.topicId = topicId;
        return this;
    };

    exports.TopicGraphNode.prototype.setNewTopic = function () {
        this.topicId = -1;
        return this;
    };

    exports.TopicGraphNode.prototype.isNewTopic = function () {
        return this.topicId === -1;
    };

    exports.TopicGraphNode.prototype.setOriginalTopicXML = function (topicXML) {
        this.originalTopicXML = topicXML;
        return this;
    };

    /**
     * Adds an existing topic id that this topic can assume
     * @param pgId The topic id
     * @param xml The xml of the exiting topic
     * @returns {exports.TopicGraphNode}
     */
    exports.TopicGraphNode.prototype.addPGId = function (pgId, xml) {
        // A mapping of PG IDs to a true/false value indicating if this topic is valid
        if (this.pgIds === undefined) {
            this.pgIds = {};
        }

        if (this.pgIds[pgId] === undefined) {
            this.pgIds[pgId] = {valid: true, originalXML: xml};
        }

        return this;
    };

    /**
     * An outgoing link is a requirement to match a topic with a given xref id to an existing topic id.
     * What this means is that when this topic assumes the existing topic id pdId it must be able to resolve
     * the xml id outgoingXmlId to a topic that can assume the topic id of outgoingPGId.
     * @param pgId The topic id that this topic can assume
     * @param outgoingXmlId The xml id that needs to be resolved
     * @param outgoingPGId The topic id that the topic with the xml id of outgoingXmlId must be able to assume
     * @returns {exports.TopicGraphNode}
     */
    exports.TopicGraphNode.prototype.addFixedOutgoingLink = function (pgId, outgoingXmlId, outgoingPGId) {
        if (this.fixedOutgoingLinks === undefined) {
            this.fixedOutgoingLinks = {};
        }

        if (this.fixedOutgoingLinks[pgId] === undefined) {
            this.fixedOutgoingLinks[pgId] = {};
        }

        /*
            So for some reason this topic expects to point to the same XML ID with different topics. This means it is
            an invalid topic, and need to be removed from the list of potential PG topics
         */
        if (this.fixedOutgoingLinks[pgId][outgoingXmlId] !== undefined && this.fixedOutgoingLinks[pgId][outgoingXmlId] !== outgoingPGId) {
            this.pgIds[pgId] = false;
        } else {
            this.fixedOutgoingLinks[pgId][outgoingXmlId] = outgoingPGId;
        }

        return this;
    };

    /**
     * If we force this topic to assume the topic id pgId, can it resolve all the outgoing links by matching
     * xrefs to existing topic ids? If so, this will return an array that is filled with objects mapping nodes
     * to assumedId which be used as the id of the topic. If not, this will return null.
     *
     * @param pgId              The ID that this node will assume and use to resolve other references
     * @param existingNetwork   A collection of the existing resolved nodes
     * @param resolutionStack   A stack that is used for debugging
     * @returns {*}
     */
    exports.TopicGraphNode.prototype.isValidForwards = function(pgId, existingNetwork, resolutionStack) {

        if (pgId === undefined) {
            throw "pgId should never be undefined";
        }

        var thisResolutionStack = resolutionStack === undefined ? [] : resolutionStack.slice(0);
        thisResolutionStack.push(pgId);

        /*
         By default there is no existing network
         */
        if (existingNetwork === undefined) {
            existingNetwork = [];
        }

        switch (this.isValidOrProcessed(pgId, existingNetwork, thisResolutionStack)) {
            case ValidOrProcessed.INVALID:
                return null;
            case ValidOrProcessed.PROCESSED:
                return existingNetwork;
        }

        if (this.fixedOutgoingLinks !== undefined && this.pgIds === undefined) {
            throw "Nodes that have no possible pressgang ids define can not have any outgoing requirements";
        }

        // the nodes that make up our addition to the network
        var retValue = existingNetwork.slice(0);

        var topicGraph = this.topicGraph;

        /*
         Add ourselves to the network as we see it
         */
        retValue.push({node: this, assumedId: pgId});

        /*
         Check to see if all outgoing links are also valid. This is pretty easy
         because each outgoing link can match only one node assuming one topic id.
         */
        if (this.fixedOutgoingLinks && this.fixedOutgoingLinks[pgId]) {
            jquery.each(this.fixedOutgoingLinks[pgId], function (outgoingXmlId, outgoingPGId) {
                var node = topicGraph.getNodeFromXMLId(outgoingXmlId);

                if (node === undefined) {
                    throw "All outgoing links should resolve to a topic or container.";
                }

                if (node instanceof exports.TopicGraphNode) {
                    // if the outgoing link is another topic, we need to see if that
                    // topic can be resolved it it assumes an id of outgoingPGId
                    retValue = node.isValidForwards(outgoingPGId, retValue, thisResolutionStack);
                } else {
                    // if the outgoing link is a container, it needs to have the same target number
                    if ("T" + node.targetNum !== outgoingPGId) {
                        retValue = null;
                    }
                }

                if (retValue === null) {
                    return false;
                }
            });

            if (retValue === null) {
                return null;
            }
        }

        return retValue;

    }

    /**
     * If we force this topic to assume the topic id pgId, can it resolve all the outgoing links by matching
     * xrefs to existing topic ids? If so, this will return an array that is filled with objects mapping nodes
     * to assumedId which be used as the id of the topic. If not, this will return null.
     * @param pgId The id that we want to assign to this topic
     * @param existingNetwork An array that holds the nodes that were resolved to get to this point
     * @returns
     */
    exports.TopicGraphNode.prototype.isValidOrProcessed = function (pgId, existingNetwork, resolutionStack) {

        /*
            We have entered a section of the graph that has already been processed.
         */
        if (this.topicId !== undefined) {
            if (this.topicId === pgId) {
                /*
                    This outgoing link already has the desired topic id. We can assume that all
                    links from this point have been resolved.
                 */
                return ValidOrProcessed.PROCESSED;
            } else {
                /*
                    This outgoing link points to a topic that has assumed a different topic id.
                    All links leading up to this point are invalid.
                 */
                return ValidOrProcessed.INVALID;
            }
        }

        // pgIds being undefined means that this node will be saved as a new topic
        if (this.pgIds === undefined) {

            var ids = "";
            jquery.each(this.xmlIds, function(index, xmlId){
               if (ids.length !== 0) {
                   ids += ", ";
               }
               ids += xmlId;
            });

            // if we see this and we know that a topic should be matched, the logic comparing two
            // xml documents needs to be checked
            console.log("An attempt was made to resolve " + ids + " but it had no matches to existing topics.");

            // because we expected this topic to have an existing id and it didn't
            return ValidOrProcessed.INVALID;
        }

        // test that the supplied PG ID one of the possible values we have
        var valid = false;
        jquery.each(this.pgIds, function(index, value) {
            if (index === pgId && value) {
                valid = true;
                return false;
            }
        });

        if (!valid) {
            // because the supplied topic id was not in the list of ids for this topic
            var pgIdsString = Object.keys(this.pgIds).join();
            console.log(pgId + " was not in the list of existing topics. Options were " + pgIdsString);
            return ValidOrProcessed.INVALID;
        }

        /*
            Test to see if we have already processed this node with the given pgid. If so, the only
            valid request for this node is the same pgId.
         */
        var alreadyProcessed;
        jquery.each(existingNetwork, (function(me) {
            return function(index, existingNode) {
                if (me === existingNode.node) {
                    alreadyProcessed = existingNode.assumedId === pgId;
                    if (!alreadyProcessed) {
                        console.log("This node was already processed with a different id. Trying to use " + pgId + " when the node has assumed " + existingNode.assumedId);
                        console.log(resolutionStack.toString());
                    }
                }
            };
        }(this)));

        if (alreadyProcessed !== undefined) {
            // if this topic has already been processed with the requested pgid, return the
            // network with no changes. If this topic is being requested with a new pgid,
            // return null because that is not valid.
            if (alreadyProcessed === true) {
                return ValidOrProcessed.PROCESSED;
            }

            return ValidOrProcessed.INVALID;
        }

        return ValidOrProcessed.VALID;
    };

});