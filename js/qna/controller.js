var OKDialogInstanceController = function ($scope, $modalInstance, title, content) {
    'use strict';

    $scope.title = title;
    $scope.content = content;

    $scope.ok = function () {
        $modalInstance.close();
    };
};

var QNAController = function ($scope, $modal, $rootScope) {
    'use strict';

    /*
        A callback that displays the ok dialog box
     */
    var alert = function (title, content) {
        var modalInstance = $modal.open({
            templateUrl: 'okDialog.html',
            controller: OKDialogInstanceController,
            resolve: {
                title: function () {
                    return title;
                },
                content: function () {
                    return content;
                }
            }
        });
    };

    var initializeQna = function (qna) {
        qna.initialize(
            function (qna) {
                $scope.qna = qna;
                $rootScope.$apply();

                if (qna.step.enterStep) {
                    $scope.disabled = true;
                    $rootScope.$apply();
                    var result = qna.results[qna.results.length - 1];
                    var config = qna.config;
                    qna.step.enterStep(
                        function (result) {
                            if (result === undefined) {
                                $rootScope.$apply();
                            } else {
                                $scope.disabled = false;
                                if (result) {
                                    $scope.next();
                                }
                            }
                        },
                        function (title, message) {
                            alert(title, message);
                        },
                        result,
                        config
                    );
                }
            },
            function (title, error) {
                alert(title, error);
            }
        );
    };

    $scope.getNumber = function (num) {
        return new Array(num);
    };

    $scope.inputTypes = InputEnum;
    initializeQna(new QNA(QNAStart, null, null, null));

    $scope.onFileSelect = function (name, files) {
        if (files.length !== 0) {
            $scope.qna.config[name] = files[0];
        } else {
            $scope.qna.config[name] = null;
        }
    };

    $scope.next = function () {
        $scope.qna.next(function (qna) {
            initializeQna(qna);
        }, function (title, message) {
            alert(title, message);
        });
    };

    $scope.previous = function () {
        $scope.qna.previous(function (qna) {
            initializeQna(qna);
        }, function (title, message) {
            alert(title, message);
        });
    };
};