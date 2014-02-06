(function (global) {
    'use strict';

    global.TopicGraph = function () {
        this.nodes = [];
    };

    global.TopicGraph.prototype.addNode = function (node) {
        if (this.nodes.indexOf(node) === -1) {
            this.nodes.push(node);
        }
    };

    global.TopicGraph.prototype.getNodeFromXMLId = function (xmlId) {
        var retValue;
        global.jQuery.each(this.nodes, function(index, node) {
            global.jQuery.each(node.xmlIds, function(index, value) {
                if (value === xmlId) {
                    retValue = node;
                    return false;
                }
            });
        });
        return retValue;
    };

    global.TopicGraph.prototype.hasXMLId = function (xmlId) {
        var retValue = false;
        global.jQuery.each(this.nodes, function(index, node) {
            if (node.xmlIds !== undefined) {
                global.jQuery.each(node.xmlIds, function(index, value) {
                    if (value === xmlId) {
                        retValue = true;
                        return false;
                    }
                });
            }
        });
        return retValue;
    };

    global.TopicGraph.prototype.getAllTopicOrContainerIDs = function () {
        var retValue = [];
        global.jQuery.each(this.nodes, function (index, value) {
            global.jQuery.each(value.xmlIds, function (index, xmlId) {
                if (retValue.indexOf(xmlId) === -1) {
                    retValue.push(xmlId);
                }
            });
        });
        return retValue;
    };

    global.TopicGraphNode = function (topicGraph) {
        topicGraph.addNode(this);
        this.topicGraph = topicGraph;
        return this;
    };

    global.TopicGraphNode.prototype.setXml = function (xml, xmlDoc) {
        this.xml = xml;
        this.xrefs = [];

        // find any xrefs in the xml
        var xrefs = xmlDoc.evaluate("//xref", xml, null, global.XPathResult.ANY_TYPE, null);
        var xref;
        while ((xref = xrefs.iterateNext()) !== null) {
            if (xref.hasAttribute("linkend")) {
                var linkend = xref.getAttribute("linkend");
                this.xrefs.push(linkend);
            }
        }

        return this;
    };

    global.TopicGraphNode.prototype.setTitle = function (title) {
        this.title = title;
        return this;
    };

    global.TopicGraphNode.prototype.setSpecLine = function (specLine) {
        this.specLine = specLine;
        return this;
    };

    global.TopicGraphNode.prototype.addXmlId = function (xmlId) {
        if (this.xmlIds === undefined) {
            this.xmlIds = [];
        }

        if (this.xmlIds.indexOf(xmlId) === -1) {
            this.xmlIds.push(xmlId);
        }

        return this;
    };

    global.TopicGraphNode.prototype.setTopicId = function (topicId) {
        this.topicId = topicId;
        return this;
    };

    /**
     * Adds an existing topic id that this topic can assume
     * @param pgId The topic id
     * @param xml The xml of the exiting topic
     * @returns {global.TopicGraphNode}
     */
    global.TopicGraphNode.prototype.addPGId = function (pgId, xml) {
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
     * @returns {global.TopicGraphNode}
     */
    global.TopicGraphNode.prototype.addFixedOutgoingLink = function (pgId, outgoingXmlId, outgoingPGId) {
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

        // setup the incoming link on the other node
        var otherNode = this.topicGraph.getNodeFromXMLId(outgoingXmlId);

        if (otherNode.fixedIncomingLinks === undefined) {
            otherNode.fixedIncomingLinks = {};
        }

        if (otherNode.fixedIncomingLinks[outgoingPGId] === undefined) {
            otherNode.fixedIncomingLinks[outgoingPGId] = [];
        }

        var me = this;
        var existing;
        global.jQuery.each(otherNode.fixedIncomingLinks[outgoingPGId], function(index, value){
            if (value.node === me) {
                existing = value;
                return false;
            }
        });

        if (existing) {
            existing.ids.push(pgId);
        } else {
            otherNode.fixedIncomingLinks[outgoingPGId].push({node: this, ids: [pgId]});
        }

        return this;
    };

    /**
     * Finds any node withing the xref graph that has not already been resolved to a topic. This is useful
     * for determining the nodes that form part of a xref graph that can't be resolved to existing topics.
     * @param validNodes an array of the unresolved nodes that form this xref network
     */
    global.TopicGraphNode.prototype.getUnresolvedGraph = function (validNodes) {
        if (this.pgIds === undefined) {
            return;
        }

        if (validNodes === undefined) {
            validNodes = [];
        }

        if (validNodes.indexOf(this) !== -1) {
            return;
        }

        validNodes.push(this);

        var topicGraph = this.topicGraph;

        if (this.fixedOutgoingLinks) {
            global.jQuery.each(this.fixedOutgoingLinks, function (pgId, outgoingPGIds) {
                global.jQuery.each(outgoingPGIds, function (outgoingXmlId, outgoingPGId) {
                    var node = topicGraph.getNodeFromXMLId(outgoingXmlId);
                    if (node.topicId === undefined) {
                        node.getUnresolvedGraph(validNodes);
                    }
                });

                // the outgoing links resolve to the same topics regardless of the mappings
                // found in the topics in the database, so just loop once
                return false;

            });

        }

        if (this.fixedIncomingLinks) {
            global.jQuery.each(this.fixedIncomingLinks, function (pgId, incomingNodes) {
                global.jQuery.each(incomingNodes, function (index, nodeDetails) {
                    if (nodeDetails.node.topicId === undefined) {
                        nodeDetails.node.getUnresolvedGraph(validNodes);
                    }
                });
            });
        }
    };

    /**
     * If we force this topic to assume the topic id pgId, can it resolve all the outgoing links by matching
     * xrefs to existing topic ids? If so, this will return an array that is filled with nodes
     * whose assumedId can be used as the id of the topic. If not, this will return null.
     * @param pgId The id that we want to assign to this topic
     * @param existingNetwork An array that holds the nodes that were resolved to get to this point
     * @returns {Array}
     */
    global.TopicGraphNode.prototype.isValid = function (pgId, existingNetwork) {
        if (pgId === undefined) {
            throw "pgId should never be undefined";
        }

        if (this.topicId !== undefined && this.topicId === pgId) {
            throw "We should not enter a resolved network again";
        }

        /*
            We have already resolved this topic to a different id, so we can't match it again.
         */
        if (this.topicId !== undefined && this.topicId !== pgId) {
            return null;
        }

        // pgIds being undefined means that this node will be saved as a new topic
        if (this.pgIds === undefined) {

            var ids = "";
            global.jQuery.each(this.xmlIds, function(index, xmlId){
               if (ids.length !== 0) {
                   ids += ", ";
               }
               ids += xmlId;
            });

            console.log("An attempt was made to resolve " + ids + " but it had no matches to existing topics.");

            // because we expected this topic to have an existing id and it didn't
            return null;
        }

        // test that the supplied PG ID one of the possible values we have
        var valid = false;
        global.jQuery.each(this.pgIds, function(index, value) {
            if (index === pgId && value) {
                valid = true;
                return false;
            }
        });

        if (!valid) {
            // because the supplied topic id was not in the list of ids for this topic
            return null;
        }

        // the nodes that make up our addition to the network
        var retValue = existingNetwork.slice(0);

        /*
         We have already processed this node with the given pgid, so the only
         valid request for this node is the same pgId.
         */
        var alreadyProcessed;
        global.jQuery.each(retValue, (function(me) {
            return function(index, existingNode) {
                if (me === existingNode.node) {
                    alreadyProcessed = existingNode.assumedId === pgId;
                }
            };
        }(this)));

        if (alreadyProcessed !== undefined) {
            return alreadyProcessed ? retValue : null;
        }

        if (this.fixedOutgoingLinks !== undefined && this.pgIds === undefined) {
            throw "Nodes that have no possible pressgang ids define can not have any outgoing requirements";
        }

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
            var outgoingRetValue = null;
            global.jQuery.each(this.fixedOutgoingLinks[pgId], function (outgoingXmlId, outgoingPGId) {
                var node = topicGraph.getNodeFromXMLId(outgoingXmlId);
                retValue = node.isValid(outgoingPGId, retValue);

                if (retValue === null) {
                    return false;
                }
            });

            if (retValue === null) {
                return null;
            }
        }

        /*
            fixedIncomingLinks should be read as a dictionary:
                key:            one of the possible ids that this node can take
                object:         array of incoming node definitions
                    [
                        object.ids:     all the potential ids the incoming node can have
                        object.node:    the incoming node itself
                    ]

            Testing incoming links is a little more work, because a node can link to this node
            assuming multiple topic ids.

            So we need to loop over each node with an incoming link, and then loop over every
            topic id it can assume trying to find one that works.
         */
        if (this.fixedIncomingLinks && this.fixedIncomingLinks[pgId]) {
            var incomingRetValue = true;
            /*
                get all the incoming node details for this topic at the particular id it
                is being tested against
             */
            global.jQuery.each(this.fixedIncomingLinks[pgId], function (index, nodeDetails) {
                /*
                    It is possible that our backwards links have already been resolved, so
                    don't try to resolve them again.
                 */
                var alreadyResolved = false;
                global.jQuery.each(retValue, function(index, validNode) {
                    if (nodeDetails.node === validNode.node) {
                        alreadyResolved = true;
                        return false;
                    }
                });

                if (!alreadyResolved) {
                    /*
                        Test every possible id that the incoming node could be looking for one
                        that works the best.
                     */
                    var validIncomingNodesOptions = [];
                    global.jQuery.each(nodeDetails.ids, function (index, incomingPGId) {
                        var validIncomingNodes = nodeDetails.node.isValid(incomingPGId, retValue);
                        if (validIncomingNodes !== null) {
                            /*
                                We have found in incoming node topic id that works, so
                                exit the loop
                             */
                            validIncomingNodesOptions.push(validIncomingNodes);
                        }
                    });

                    if (validIncomingNodesOptions.length === 0) {
                        incomingRetValue = false;
                        return false;
                    }

                    var mostSuccess = undefined;
                    global.jQuery.each(validIncomingNodesOptions, function(index, validIncomingNodesOption){
                        if (mostSuccess === undefined || validIncomingNodesOption.length > mostSuccess.length) {
                            mostSuccess = validIncomingNodesOption;
                        }
                    });

                    global.jQuery.each(mostSuccess, function(index, backtrace) {
                        global.jQuery.each(retValue, function(index, validNode) {
                            if (backtrace.node === validNode.node) {
                                throw "We shouldn't be able to add the same node twice in a backtrace";
                            }
                        });
                    });

                    retValue = mostSuccess;
                }
            });

            if (!incomingRetValue) {
                // because a child node was not valid
                return null;
            }
        }


        return retValue;
    };

}(this));