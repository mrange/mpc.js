var exp;
(function (exp) {
    (function (BinaryOperator) {
        BinaryOperator[BinaryOperator["Unknown"] = 0] = "Unknown";
        BinaryOperator[BinaryOperator["Add"] = 1] = "Add";
        BinaryOperator[BinaryOperator["Subtract"] = 2] = "Subtract";
        BinaryOperator[BinaryOperator["Multiply"] = 3] = "Multiply";
        BinaryOperator[BinaryOperator["Divide"] = 4] = "Divide";
        BinaryOperator[BinaryOperator["EqualTo"] = 5] = "EqualTo";
        BinaryOperator[BinaryOperator["NotEqualTo"] = 6] = "NotEqualTo";
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
                case BinaryOperator.EqualTo:
                    this.expr.append(" = ");
                    break;
                case BinaryOperator.NotEqualTo:
                    this.expr.append(" <> ");
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

    var p_whitespaces = mpc.skipSatisfyMany(mpc.satisyWhitespace);

    var p_addLikeOperator = mpc.anyCharOf2("+-", [BinaryOperator.Add, BinaryOperator.Subtract]).keepLeft(p_whitespaces);

    var p_multiplyLikeOperator = mpc.anyCharOf2("*/", [BinaryOperator.Multiply, BinaryOperator.Divide]).keepLeft(p_whitespaces);

    var p_comparisonOperator = mpc.choice(mpc.skipString("=").result(BinaryOperator.EqualTo), mpc.skipString("<>").result(BinaryOperator.NotEqualTo)).keepLeft(p_whitespaces);

    var p_number = mpc.anyStringOf("0123456789").consumedAtLeast(1).keepLeft(p_whitespaces).transform(function (c) {
        return new NumberLiteralExpression(parseFloat(c));
    });

    var p_identifer = mpc.satisfyMany(function (ch, pos) {
        return (ch >= 65 && ch <= 90) || (ch >= 97 && ch <= 122);
    }).consumedAtLeast(1).keepLeft(p_whitespaces).transform(function (c) {
        return new IdentifierExpression(c);
    });

    var p_expression = mpc.circular();

    var p_subExpression = p_expression.inBetween(mpc.skipString("("), mpc.skipString(")")).keepLeft(p_whitespaces);

    function expressionCombiner(l, op, r) {
        return new BinaryExpression(op, l, r);
    }

    var p_term = mpc.choice(p_number, p_identifer, p_subExpression);

    var p_l1 = mpc.chainLeft(p_term, p_multiplyLikeOperator, expressionCombiner);

    var p_l2 = mpc.chainLeft(p_l1, p_addLikeOperator, expressionCombiner);

    var p_l3 = mpc.chainLeft(p_l2, p_comparisonOperator, expressionCombiner);

    var p_complete = (function () {
        p_expression.parse = p_l3.parse;
        return p_l3;
    })();

    function parseExpression(s) {
        return mpc.parse(p_complete, s);
    }
    exp.parseExpression = parseExpression;

    function toString(expr) {
        var visitor = new ExpressionSerializer();
        expr.apply(visitor);
        return visitor.expr.toString();
    }
    exp.toString = toString;
})(exp || (exp = {}));
