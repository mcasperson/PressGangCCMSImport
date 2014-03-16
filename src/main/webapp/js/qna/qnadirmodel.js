define (['jquery', 'exports'], function (jquery, exports) {
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
                if (value.webkitRelativePath.toLowerCase() === filename.toLowerCase()) {
                    caseMismatchEntry = value;
                }

                if (value.webkitRelativePath === filename) {
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
                if (value.webkitRelativePath.toLowerCase() === filename.toLowerCase()) {
                    caseMismatchEntry = value;
                }

                if (value.webkitRelativePath === filename) {
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
        onend(file.files);
    };

    exports.QNADirModel.prototype.getCachedEntries = function (file, onend, onerror) {
        if (this.cache[file.filename]) {
            onend(this.cache[file.filename]);
        } else {
            this.getEntries(
                file,
                (function (cache) {
                    return function (entries) {
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
                    if (value.webkitRelativePath.toLowerCase() === filename.toLowerCase()) {
                        foundCaseMismatch = true;
                    }

                    if (value.webkitRelativePath === filename) {
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