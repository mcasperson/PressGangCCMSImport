define (['jquery', 'qna/qnautils', 'exports'], function (jquery, qnautils, exports) {
    'use strict';

    exports.QNADirModel = function () {

    };

    exports.QNADirModel.prototype.cache = {};
    
    exports.QNADirModel.prototype.getTextFromFile = function (entry, onend) {
        var reader = new FileReader();
        reader.addEventListener("load", function (event) {
            var textFile = event.target.result;
            onend(textFile);
        });
        reader.readAsText(entry);
    };

    exports.QNADirModel.prototype.getByteArrayFromFile = function (entry, onend) {
        var reader = new FileReader();
        reader.addEventListener("load", function (event) {
            var arrayBuffer = event.target.result;
            onend(arrayBuffer);
        });
        reader.readAsArrayBuffer(entry);
    };

    exports.QNADirModel.prototype.getTextFromFileName = function (file, filename, onend, onerror, ignorecase) {
        var me = this;
        this.getCachedEntries(file, function (entries) {
            var foundFile = false;
            var caseMismatchEntry;
            jquery.each(entries, function (index, value) {
                if (qnautils.getFileName(value).toLowerCase() === filename.toLowerCase()) {
                    caseMismatchEntry = value;
                }

                if (qnautils.getFileName(value) === filename) {
                    me.getTextFromFile(value, onend);
                    foundFile = true;
                    return false;
                }
            });

            if (!foundFile) {
                if (ignorecase === true && caseMismatchEntry !== undefined) {
                    me.getTextFromFile(caseMismatchEntry, onend);
                } else {
                    onerror("Could not find " + filename);
                }
            }
        }, onerror);
    };

    exports.QNADirModel.prototype.getByteArrayFromFileName = function (file, filename, onend, onerror, ignorecase) {
        var me = this;
        this.getCachedEntries(file, function (entries) {
            var foundFile = false;
            var caseMismatchEntry;
            jquery.each(entries, function (index, value) {
                if (qnautils.getFileName(value).toLowerCase() === filename.toLowerCase()) {
                    caseMismatchEntry = value;
                }

                if (qnautils.getFileName(value) === filename) {
                    me.getByteArrayFromFile(value, onend);
                    foundFile = true;
                    return false;
                }
            });

            if (!foundFile) {
                if (ignorecase === true && caseMismatchEntry !== undefined) {
                    me.getByteArrayFromFile(caseMismatchEntry, onend);
                } else {
                    onerror("Could not find " + filename);
                }
            }
        }, onerror);
    };

    exports.QNADirModel.prototype.getEntries = function (file, onend, onerror) {
        onend(file);
    };

    exports.QNADirModel.prototype.getCachedEntries = function (file, onend, onerror) {
        if (this.cache[file.filename]) {
            onend(this.cache[file.filename]);
        } else {
            this.getEntries(
                file,
                (function (cache) {
                    return function (entries) {
                        entries.sort(function(a,b) {
                            var aFileName = qnautils.getFileName(a).toLowerCase();
                            var bFileName = qnautils.getFileName(b).toLowerCase();
                            var aDepth = aFileName.split("/").length;
                            var bDepth = bFileName.split("/").length;
                            if (aDepth < bDepth) {
                                return -1;
                            } else if (aDepth > bDepth) {
                                return 1
                            } else if (aFileName < bFileName) {
                                return -1;
                            } else if (aFileName > bFileName) {
                                return 1;
                            }

                            return 0;
                        });
                        cache[file.filename] = entries;
                        onend(entries);
                    };
                }(this.cache)),
                onerror
            );
        }
    };

    exports.QNADirModel.prototype.hasFileName = function (file, filename, resultCallback, errorCallback, ignorecase) {
        this.getCachedEntries(
            file,
            function (entries) {
                var found = false;
                var foundCaseMismatch = false;
                jquery.each(entries, function (index, value) {
                    if (qnautils.getFileName(value).toLowerCase() === filename.toLowerCase()) {
                        foundCaseMismatch = true;
                    }

                    if (qnautils.getFileName(value) === filename) {
                        found = true;
                        resultCallback(found);
                        return false;
                    }
                });

                if (!found) {
                    /*
                     Do a second pass
                     */
                    if (ignorecase === true) {
                        resultCallback(foundCaseMismatch);
                    } else {
                        resultCallback(false);
                    }
                }
            },
            errorCallback
        );
    };

    exports.QNADirModel.prototype.clearCache = function () {
        this.cache = {};
    };
});