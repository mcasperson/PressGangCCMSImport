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

    global.TopicGraphNode.prototype.resetTestId = function () {
        this.setTestId(undefined);

        var topicGraph = this.topicGraph;

        if (this.outgoingLinks) {
            global.jQuery.each(this.outgoingLinks, function (pgId, outgoingXmlIds) {
                global.jQuery.each(outgoingXmlIds, function (outgoingXmlId, outgoingPGId) {
                    var node = topicGraph.getNodeFromXMLId(outgoingXmlId);
                    if (node.testId !== undefined) {
                        node.resetTestId();
                    }
                });
            });
        }

        if (this.incomingLinks) {
            global.jQuery.each(this.incomingLinks, function (pgId, incomingNodes) {
                global.jQuery.each(incomingNodes, function (incomingNode, incomingPGIds) {
                    if (incomingNode.testId !== undefined) {
                        incomingNode.resetTestId();
                    }
                });
            });
        }

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

    global.TopicGraphNode.prototype.addOutgoingLink = function (pgId, outgoingXmlId, outgoingPGId) {
        if (this.outgoingLinks === undefined) {
            this.outgoingLinks = {};
        }

        if (this.outgoingLinks[pgId] === undefined) {
            this.outgoingLinks[pgId] = {};
        }

        /*
            So for some reason this topic expects to point to the same XML ID with different topics. This means it is
            an invalid topic, and need to be removed from the list of potential PG topics
         */
        if (this.outgoingLinks[pgId][outgoingXmlId] !== undefined && this.outgoingLinks[pgId][outgoingXmlId] !== outgoingPGId) {
            this.pgIds[pgId] = false;
        } else {
            this.outgoingLinks[pgId][outgoingXmlId] = outgoingPGId;
        }

        // setup the incoming link on the other node
        var otherNode = this.topicGraph.getNodeFromXMLId(outgoingXmlId);

        if (otherNode.incomingLinks === undefined) {
            otherNode.incomingLinks = {};
        }

        if (otherNode.incomingLinks[outgoingPGId] === undefined) {
            otherNode.incomingLinks[outgoingPGId] = {};
        }

        if (!otherNode.incomingLinks[outgoingPGId][this]) {
            otherNode.incomingLinks[outgoingPGId][this] = [];
        }

        otherNode.incomingLinks[outgoingPGId][this].push(pgId);


        return this;
    };

    global.TopicGraphNode.prototype.getGraph = function (validNodes) {
        if (this.testId === -1) {
            return;
        }

        // mark this topic as processed
        this.setTestId(-1);

        var topicGraph = this.topicGraph;

        if (this.outgoingLinks) {
            global.jQuery.each(this.outgoingLinks, function (pgId, outgoingPGIds) {
                global.jQuery.each(outgoingPGIds, function (outgoingXmlId, outgoingPGId) {
                    var node = topicGraph.getNodeFromXMLId(outgoingXmlId);
                    node.getGraph(validNodes);
                });

                // the outgoing links resolve to the same topics regardless of the mappings
                // found in the topics in the database, so just loop once
                return false;

            });

        }

        if (this.incomingLinks) {
            global.jQuery.each(this.incomingLinks, function (pgId, incomingNodes) {
                global.jQuery.each(incomingNodes, function (incomingNode, incomingPGIds) {
                    incomingNode.getGraph(validNodes);
                });
                return false;
            });
        }
    };

    global.TopicGraphNode.prototype.isValid = function (pgId, validNodes) {
        /*
            We have already processed this node with the given pgid and
            it tested ok, so return true
         */
        if (pgId === this.testId) {
            return true;
        }

        // pgIds being undefined means that this node will be saved as a new topic
        if ((this.pgIds === undefined && pgId !== undefined) ||
            (this.pgIds !== undefined && pgId === undefined)) {
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
                return false;
            }
        }

        /*
            set the id that this node will assume for this test. if we hit this node again asking for
            this id, we will return true and not propagate the testing any further.
         */
        this.setTestId(pgId);

        if (this.outgoingLinks !== undefined && this.pgIds === undefined) {
            throw "Nodes that have no possible pressgang ids define can not have any outgoing requirements";
        }

        var topicGraph = this.topicGraph;

        // check to see if all outgoing links are also valid
        var retValue = false;
        if (this.outgoingLinks && this.outgoingLinks[pgId]) {
            global.jQuery.each(this.outgoingLinks[pgId], function (outgoingXmlId, outgoingPGId) {
                var node = topicGraph.getNodeFromXMLId(outgoingXmlId);
                if (node.isValid(outgoingPGId, validNodes)) {
                    retValue = true;
                    return false;
                }
            });

            if (retValue) {
                return false;
            }
        }

        if (!retValue) {
            return false;
        }


        if (this.incomingLinks && this.incomingLinks[pgId]) {
            global.jQuery.each(this.incomingLinks[pgId], function (incomingXmlId, incomingNodes) {
                retValue = false;
                global.jQuery.each(incomingNodes, function (incomingNode, incomingPGId) {
                    if (incomingNode.isValid(incomingPGId, validNodes)) {
                        retValue = true;
                        return false;
                    }
                }, this);

                if (retValue) {
                    return false;
                }
            });

            if (retValue) {
                return false;
            }
        }

        if (retValue) {
            validNodes.push(this);
            return true;
        }

        return false;
    };

}(this));