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
// A simple expression parser that can expressions like: x + 3 * (y + 3*z)
var exp;
(function (exp) {
    // All support operators
    (function (BinaryOperator) {
        BinaryOperator[BinaryOperator["Unknown"] = 0] = "Unknown";
        BinaryOperator[BinaryOperator["Add"] = 1] = "Add";
        BinaryOperator[BinaryOperator["Subtract"] = 2] = "Subtract";
        BinaryOperator[BinaryOperator["Multiply"] = 3] = "Multiply";
        BinaryOperator[BinaryOperator["Divide"] = 4] = "Divide";
    })(exp.BinaryOperator || (exp.BinaryOperator = {}));
    var BinaryOperator = exp.BinaryOperator;

    var BinaryExpression = (function () {
        function BinaryExpression(op, left, right) {
            this.op = op;
            this.left = left;
            this.right = right;
        }
        BinaryExpression.prototype.apply = function (visitor) {
            visitor.visitBinary(this.op, this.left, this.right);
        };
        return BinaryExpression;
    })();
    exp.BinaryExpression = BinaryExpression;

    var NumberLiteralExpression = (function () {
        function NumberLiteralExpression(value) {
            this.value = value;
        }
        NumberLiteralExpression.prototype.apply = function (visitor) {
            visitor.visitNumberLiteral(this.value);
        };
        return NumberLiteralExpression;
    })();
    exp.NumberLiteralExpression = NumberLiteralExpression;

    var IdentifierExpression = (function () {
        function IdentifierExpression(name) {
            this.name = name;
        }
        IdentifierExpression.prototype.apply = function (visitor) {
            visitor.visitIdentifier(this.name);
        };
        return IdentifierExpression;
    })();
    exp.IdentifierExpression = IdentifierExpression;

    // A simple visitor that serializes the Expression AST into a human readable string
    //  This string can be parsed again
    var ExpressionSerializer = (function () {
        function ExpressionSerializer() {
            this.expr = new mpc.StringBuilder();
        }
        ExpressionSerializer.prototype.visitBinary = function (op, left, right) {
            this.expr.append("(");
            left.apply(this);
            switch (op) {
                default:
                    this.expr.append(" <UNK> ");
                    break;
                case BinaryOperator.Add:
                    this.expr.append(" + ");
                    break;
                case BinaryOperator.Subtract:
                    this.expr.append(" - ");
                    break;
                case BinaryOperator.Multiply:
                    this.expr.append(" * ");
                    break;
                case BinaryOperator.Divide:
                    this.expr.append(" / ");
                    break;
            }
            right.apply(this);
            this.expr.append(")");
        };

        ExpressionSerializer.prototype.visitNumberLiteral = function (value) {
            this.expr.append(value.toString());
        };

        ExpressionSerializer.prototype.visitIdentifier = function (name) {
            this.expr.append(name);
        };
        return ExpressionSerializer;
    })();
    exp.ExpressionSerializer = ExpressionSerializer;

    // Define expression grammar
    // Consumes whitespaces
    var p_whitespaces = mpc.skipSatisfyMany(mpc.satisyWhitespace);

    // Parses +- operators and maps it to a BinaryOperator
    var p_addLikeOperator = mpc.anyCharOf("+-", function (i) {
        switch (i) {
            case 0:
                return BinaryOperator.Add;
            case 1:
                return BinaryOperator.Subtract;
            default:
                return BinaryOperator.Unknown;
        }
    }).keepLeft(p_whitespaces);

    // Parses */ operators and maps it to a BinaryOperator
    var p_multiplyLikeOperator = mpc.anyCharOf("*/", function (i) {
        switch (i) {
            case 0:
                return BinaryOperator.Multiply;
            case 1:
                return BinaryOperator.Divide;
            default:
                return BinaryOperator.Unknown;
        }
    }).keepLeft(p_whitespaces);

    // Will be used to combine binary expressions
    function expressionCombiner(l, op, r) {
        return new BinaryExpression(op, l, r);
    }

    // Parses a number
    var p_number = mpc.anyStringOf("0123456789").consumedAtLeast(1).keepLeft(p_whitespaces).transform(function (c) {
        return new NumberLiteralExpression(parseFloat(c));
    });

    // Parses an identifier (basically a sequence of alphanumeric characters)
    var p_identifer = mpc.satisfyMany(function (ch, pos) {
        return (ch >= 65 && ch <= 90) || (ch >= 97 && ch <= 122);
    }).consumedAtLeast(1).keepLeft(p_whitespaces).transform(function (c) {
        return new IdentifierExpression(c);
    });

    // Parses an expressions, as the definition is circular this is a placeholder for now
    var p_expression = mpc.circular();

    // Parses a sub expression ie an expression surrounded with parantheses ()
    var p_subExpression = p_expression.inBetween(mpc.skipString("("), mpc.skipString(")")).keepLeft(p_whitespaces);

    // Parses level 0 : a number, identifier or a sub expression
    var p_l0 = mpc.choice(p_number, p_identifer, p_subExpression);

    // Parses level 1 : Expressions chained by */, this will make */ to bind stronger than +-
    var p_l1 = mpc.chainLeft(p_l0, p_multiplyLikeOperator, expressionCombiner);

    // Parses level 2 : Expressions chained by +-
    var p_l2 = mpc.chainLeft(p_l1, p_addLikeOperator, expressionCombiner);

    // Produces the complete expression parser, sets up the circular parser expression
    var p_complete = (function () {
        p_expression.parse = p_l2.parse;
        return p_l2;
    })();

    // Parses a string and returns a ParseResult
    function parseExpression(s) {
        return mpc.parse(p_complete, s);
    }
    exp.parseExpression = parseExpression;

    // Takes an expression and produces a human readable string
    function toString(expr) {
        var visitor = new ExpressionSerializer();
        expr.apply(visitor);
        return visitor.expr.toString();
    }
    exp.toString = toString;
})(exp || (exp = {}));
//# sourceMappingURL=exp.js.map
