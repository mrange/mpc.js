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
