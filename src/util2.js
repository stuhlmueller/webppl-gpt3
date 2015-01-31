"use strict";

var types = require("ast-types").namedTypes;
var build = require("ast-types").builders;
var keys = require("estraverse").VisitorKeys;
var Syntax = require("estraverse").Syntax;


function fail( message, node ) {
    return function() {
	console.log( node );
	console.log( message );
	throw new Error( message );
    }
}

// a clause matches a node type and calls a destructor with constituents
// a clause is a function from a node and failure thunk to a result
function clause( type, destructor ) {
    return function( node, fail ) {
	if( types.hasOwnProperty( type ) ) {
	    if( types[ type ].check( node ) ) {
		return destructor.apply( this, keys[ type ].map( function( key ) {
		    return node[ key ];
		}));
	    }
	    else return fail();
	}
	else throw new Error( "no type " + type );
    }
}

function match( node, clauses, fail ) {
    function loop( i ) {
	if( i === clauses.length ) {
	    return fail();
	}
	else return clauses[i]( node, function() {
	    return loop( i + 1 );
	});
    }

    return loop( 0 );
}

function functor( node, f, fail ) {
    if( types.Program.check( node ) &&
	node.body.length === 1 &&
	types.ExpressionStatement.check( node.body[0] ) ) {
	return build.program([
	    build.expressionStatement( f( node.body[0].expression ) )
	]);
    }
    else return fail();
}

function returnify( nodes ) {
    if( nodes.length === 0 ) {
	return nodes;
    }
    else {
	nodes[ nodes.length - 1 ] = match( nodes[ nodes.length - 1 ], [
	    clause( Syntax.BlockStatement, function( body ) {
		return build.blockStatement( returnify( body ) );
	    }),
	    clause( Syntax.EmptyStatement, function() {
		return build.emptyStatement();
	    }),
	    clause( Syntax.ExpressionStatement, function( expression ) {
		return build.returnStatement( expression );
	    }),
	    clause( Syntax.IfStatement, function( test, consequent, alternate ) {
		return build.ifStatement( test,
					  build.blockStatement( returnify( consequent.body ) ),
					  alternate === null ? null : build.blockStatement( returnify( alternate.body ) ) );
	    })
	], fail( "returnify", nodes[ nodes.length - 1 ] ) );

	return nodes;
    }
}

function thunkify( node, fail ) {
    if( types.Program.check( node ) ) {
	return build.program([
	    build.expressionStatement(
		build.functionExpression(
		    null,
		    [],
		    build.blockStatement( returnify( node.body ) )
		)
	    )
	]);
    }
    else return fail();
}

exports.fail = fail;
exports.clause = clause;
exports.match = match;
exports.thunkify = thunkify;
exports.functor = functor;
