var OKDialogInstanceController = function ($scope, $modalInstance, title, content) {
    'use strict';

    $scope.title = title;
    $scope.content = content;

    $scope.ok = function () {
        $modalInstance.close();
    };
};


var QNAController = function ($scope, $modal) {
    'use strict';

    $scope.ok = {
        title: "Click OK to continue",
        content: "Change me"
    };

    $scope.next = function () {
        $scope.ok.content = "New message";
        var modalInstance = $modal.open({
            templateUrl: 'okDialog.html',
            controller: OKDialogInstanceController,
            resolve: {
                title: function () {
                    return $scope.ok.title;
                },
                content: function () {
                    return $scope.ok.content;
                }
            }
        });
    };
};