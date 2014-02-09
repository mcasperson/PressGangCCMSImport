(function (global) {
    'use strict';

    // a zip model to be shared
    global.zipModel = new global.QNAZipModel();

    global.QNAStart = new global.QNAStep()
        .setTitle("Select import source")
        .setIntro("You can either import an existing Publican DocBook archive, or from an OpenDocument.")
        .setInputs(
            [
                new global.QNAVariables()
                    .setVariables([
                        new global.QNAVariable()
                            .setType(global.InputEnum.RADIO_BUTTONS)
                            .setIntro(["Publican", "OpenDocument"])
                            .setOptions(["Publican", "OpenDocument"])
                            .setValue("Pubilcan")
                            .setName("ImportOption")
                    ])
            ]
        )
        .setNextStep(function (resultCallback, errorCallback, result, config) {
            resultCallback(config.ImportOption === "Publican" ? global.askForPublicanZipFile : global.askForOpenDocumentFile);
        });
}(this));