(function (global) {
    'use strict';

    global.QNAZipModel = function () {
        this.getEntries = function (file, onend, onerror) {
            global.zip.createReader(new global.zip.BlobReader(file), function (zipReader) {
                zipReader.getEntries(onend);
            }, onerror);
        };
    };
}(this));