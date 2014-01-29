(function (global) {
    'use strict';

    var file = new global.QNAVariable(global.InputEnum.SINGLE_FILE, "Publican ZIP File", "ZipFile");
    var inputs = new global.QNAVariables(null, [file]);


    global.QNAStart = new global.QNAStep(
        "Select the ZIP file to import",
        "Select the ZIP file that contains the valid Publican book that you wish to import into PressGang CCMS.",
        [inputs],
        null,
        function (result, config, alert) {
            new global.QNAZipModel().getEntries(config.ZipFile, function (entries) {
                return null;
            }, function (message) {
                alert("Error", "Could not process the ZIP file!");
                return null;
            });
        }
    );

}(this));