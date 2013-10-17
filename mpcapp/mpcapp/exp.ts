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

module exp {

    // All support operators
    export enum BinaryOperator {
        Unknown ,
        Add     ,
        Subtract,
        Multiply,
        Divide  ,
    }

    // The expression will be used to traverse the AST 
    export interface ExpressionVisitor {
        visitBinary(op : BinaryOperator, left : Expression, right : Expression);
        visitNumberLiteral(value : number);
        visitIdentifier(name : string);
    }


    // Define expression AST (Abstract Syntax Tree)
    export interface Expression {
        apply(visitor : ExpressionVisitor) : void;
    }

    export class BinaryExpression implements Expression {
        constructor (public op : BinaryOperator, public left : Expression, public right : Expression) {
        }

        apply(visitor : ExpressionVisitor) : void
        {
            visitor.visitBinary(this.op, this.left, this.right);
        }
    }

    export class NumberLiteralExpression implements Expression {
        constructor (public value : number) {
        }

        apply(visitor : ExpressionVisitor) : void
        {
            visitor.visitNumberLiteral(this.value);
        }
    }

    export class IdentifierExpression implements Expression {
        constructor (public name : string) {
        }

        apply(visitor : ExpressionVisitor) : void
        {
            visitor.visitIdentifier(this.name);
        }
    }

    // A simple visitor that serializes the Expression AST into a human readable string
    //  This string can be parsed again
    export class ExpressionSerializer implements ExpressionVisitor {
        public expr = new mpc.StringBuilder()

        visitBinary(op : BinaryOperator, left : Expression, right : Expression) {
            this.expr.append("(")
            left.apply(this)
            switch(op) {
            default:
                this.expr.append(" <UNK> ")
                break;
            case BinaryOperator.Add:
                this.expr.append(" + ")
                break;
            case BinaryOperator.Subtract:
                this.expr.append(" - ")
                break;
            case BinaryOperator.Multiply:
                this.expr.append(" * ")
                break;
            case BinaryOperator.Divide:
                this.expr.append(" / ")
                break;
            }
            right.apply(this)
            this.expr.append(")")
        }

        visitNumberLiteral(value : number) {
            this.expr.append(value.toString())
        }

        visitIdentifier(name : string) {
            this.expr.append(name)
        }
    }

    // Define expression grammar

    // Consumes whitespaces
    var p_whitespaces : mpc.Parser<number> = mpc.skipSatisfyMany(mpc.satisyWhitespace)

    // Parses +- operators and maps it to a BinaryOperator
    var p_addLikeOperator : mpc.Parser<BinaryOperator> = mpc.anyCharOf("+-", i => {
                    switch (i)
                    {
                    case 0:
                        return BinaryOperator.Add
                    case 1:
                        return BinaryOperator.Subtract
                    default:
                        return BinaryOperator.Unknown
                    }
                }).keepLeft(p_whitespaces)

    // Parses */ operators and maps it to a BinaryOperator
    var p_multiplyLikeOperator : mpc.Parser<BinaryOperator> = mpc.anyCharOf("*/", i => {
                    switch (i)
                    {
                    case 0:
                        return BinaryOperator.Multiply
                    case 1:
                        return BinaryOperator.Divide
                    default:
                        return BinaryOperator.Unknown
                    }
                }).keepLeft(p_whitespaces)

    // Will be used to combine binary expressions
    function expressionCombiner(l : Expression, op : BinaryOperator, r : Expression) : Expression {
        return new BinaryExpression(op, l, r)
    }

    // Parses a number
    var p_number : mpc.Parser<Expression> = mpc.anyStringOf("0123456789")
        .consumedAtLeast(1)
        .keepLeft(p_whitespaces)
        .transform((c : string) => new NumberLiteralExpression(parseFloat(c)))

    // Parses an identifier (basically a sequence of alphanumeric characters)
    var p_identifer : mpc.Parser<Expression> = mpc.satisfyMany((ch,pos)=> (ch >= 65 && ch <= 90) || (ch >= 97 && ch <= 122))
        .consumedAtLeast(1)
        .keepLeft(p_whitespaces)
        .transform((c : string) => new IdentifierExpression(c))

    // Parses an expressions, as the definition is circular this is a placeholder for now
    var p_expression : mpc.Parser<Expression> = mpc.circular()

    // Parses a sub expression ie an expression surrounded with parantheses ()
    var p_subExpression : mpc.Parser<Expression> = p_expression.inBetween(mpc.skipString("("), mpc.skipString(")")).keepLeft(p_whitespaces)

    // Parses level 0 : a number, identifier or a sub expression
    var p_l0 : mpc.Parser<Expression> = mpc.choice(p_number, p_identifer, p_subExpression)
    // Parses level 1 : Expressions chained by */, this will make */ to bind stronger than +-
    var p_l1 : mpc.Parser<Expression> = mpc.chainLeft(p_l0, p_multiplyLikeOperator, expressionCombiner)
    // Parses level 2 : Expressions chained by +-
    var p_l2 : mpc.Parser<Expression> = mpc.chainLeft(p_l1, p_addLikeOperator, expressionCombiner)

    // Produces the complete expression parser, sets up the circular parser expression
    var p_complete = () => {
        p_expression.parse = p_l2.parse
        return p_l2
        }()

    // Parses a string and returns a ParseResult
    export function parseExpression(s : string) : mpc.ParseResult<Expression> {
        return mpc.parse(p_complete, s)
    }

    // Takes an expression and produces a human readable string
    export function toString (expr : Expression) : string {
        var visitor = new ExpressionSerializer()
        expr.apply(visitor)
        return visitor.expr.toString()
    }
}
