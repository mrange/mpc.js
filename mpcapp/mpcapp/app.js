// ----------------------------------------------------------------------------------------------
// Copyright (c) Mårten Rånge.
// ----------------------------------------------------------------------------------------------
// This source code is subject to terms and conditions of the Microsoft Public License. A
// copy of the license can be found in the License.html file at the root of this distribution.
// If you cannot locate the  Microsoft Public License, please send an email to
// dlr@microsoft.com. By using this source code in any fashion, you are agreeing to be bound
//  by the terms of the Microsoft Public License.
// ----------------------------------------------------------------------------------------------
// You must not remove this notice, or any other, from this software.
// ----------------------------------------------------------------------------------------------
window.onload = function () {
    var button = document.getElementById("clickme");
    button.onclick = function () {
        var expression = document.getElementById("expression");

        var pr = exp.parseExpression(expression.innerText);

        if (pr.success) {
            alert(exp.toString(pr.value));
        } else {
            alert("Invalid expression");
        }
    };
};
//# sourceMappingURL=app.js.map
