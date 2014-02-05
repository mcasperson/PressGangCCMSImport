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

    global.TopicGraph.prototype.resetTestIds = function () {
        var retValue = [];
        global.jQuery.each(this.nodes, function (index, value) {
            if (value.pgIds === undefined && value.testId !== undefined) {
                throw "We should never have tested a topic that had no matches";
            }

            value.setTestId(undefined);
        });
    };

    global.TopicGraphNode = function (topicGraph) {
        topicGraph.addNode(this);
        this.topicGraph = topicGraph;
        return this;
    };

    global.TopicGraphNode.prototype.setXml = function (xml, xmlDoc) {
        this.xml = xml;
        this.xrefs = [];

        // find any
        var xrefsTargets = [];
        var xrefs = xmlDoc.evaluate("//xref", xml, null, global.XPathResult.ANY_TYPE, null);
        var xref;
        while (xref = xrefs.iterateNext()) {
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

    global.TopicGraphNode.prototype.setTestId = function (testId) {
        this.testId = testId;
        return this;
    };

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

    global.TopicGraphNode.prototype.getGraph = function (validNodes) {
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
                    node.getGraph(validNodes);
                });

                // the outgoing links resolve to the same topics regardless of the mappings
                // found in the topics in the database, so just loop once
                return false;

            });

        }

        if (this.fixedIncomingLinks) {
            global.jQuery.each(this.fixedIncomingLinks, function (pgId, incomingNodes) {
                global.jQuery.each(incomingNodes, function (index, nodeDetails) {
                    nodeDetails.node.getGraph(validNodes);
                });
            });
        }
    };

    global.TopicGraphNode.prototype.isValid = function (pgId, validNodes) {

        if (this.topicId !== undefined) {
            throw "We should not encounter a topic that has already been processed";
        }

        if (pgId === undefined) {
            throw "pgId should never be undefined";
        }

        /*
            We have already processed this node with the given pgid, so the only
            valid request for this node is the same pgId.
         */
        if (this.testId !== undefined) {
            return pgId === this.testId;
        }

        // pgIds being undefined means that this node will be saved as a new topic
        if (this.pgIds === undefined) {
            // because we expected this topic to have an existing id and it didn't
            return false;
        }

        if (this.pgIds !== undefined && pgId !== undefined) {
            // is the supplied PG ID one of the possible values we have
            var valid = false;
            global.jQuery.each(this.pgIds, function(index, value) {
                if (index === pgId && value) {
                    valid = true;
                    return false;
                }
            });

            if (!valid) {
                // because the supplied topic id was not in the list of ids for this topic
                return false;
            }
        }

        /*
            set the id that this node will assume for this test. if we hit this node again asking for
            this id, we will return true and not propagate the testing any further.
         */
        this.setTestId(pgId);

        if (this.fixedOutgoingLinks !== undefined && this.pgIds === undefined) {
            throw "Nodes that have no possible pressgang ids define can not have any outgoing requirements";
        }

        var topicGraph = this.topicGraph;

        // check to see if all outgoing links are also valid
        if (this.fixedOutgoingLinks && this.fixedOutgoingLinks[pgId]) {
            var outgoingRetValue = false;
            global.jQuery.each(this.fixedOutgoingLinks[pgId], function (outgoingXmlId, outgoingPGId) {
                var node = topicGraph.getNodeFromXMLId(outgoingXmlId);
                if (node.isValid(outgoingPGId, validNodes)) {
                    outgoingRetValue = true;
                    return false;
                }
            });

            if (!outgoingRetValue) {
                // because a child node was not valid
                this.setTestId(undefined);
                return false;
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
         */
        if (this.fixedIncomingLinks && this.fixedIncomingLinks[pgId]) {
            var incomingRetValue = true;
            /*
                get all the incoming node details for this topic at the particular id it
                is being tested against
             */
            global.jQuery.each(this.fixedIncomingLinks[pgId], function (index, nodeDetails) {
                /*
                    Test every possible id that the incoming node could be looking for one
                    that works.
                 */
                var incomingNodeValid = false;
                global.jQuery.each(nodeDetails.ids, function (index, incomingPGId) {
                    if (nodeDetails.node.isValid(incomingPGId, validNodes)) {
                        /*
                            We have found in incoming node topic id that works, so
                            exit the loop
                         */
                        incomingNodeValid = true;
                        return false;
                    }
                });

                if (!incomingNodeValid) {
                    incomingRetValue = false;
                    return false;
                }
            });

            if (!incomingRetValue) {
                // because a child node was not valid
                this.setTestId(undefined);
                return false;
            }
        }

        if (validNodes.indexOf(this) !== -1) {
            throw "We should not be able to add a topic to the valid nodes twice";
        }

        validNodes.push(this);
        return true;
    };

}(this));