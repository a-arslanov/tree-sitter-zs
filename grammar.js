/**
 * @file ZS grammar for tree-sitter
 * @author Artur Arslanov
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const DIGITS = token(choice('0', seq(/[1-9]/, optional(seq(optional('_'), sep1(/[0-9]+/, /_+/))))));
const DECIMAL_DIGITS = token(sep1(/[0-9]+/, '_'));
const HEX_DIGITS = token(sep1(/[A-Fa-f0-9]+/, '_'));

/* eslint-disable no-multi-spaces */

const PREPROC_PREC = {
  PAREN_DECLARATOR: -10,
  ASSIGNMENT: -2,
  CONDITIONAL: -1,
  DEFAULT: 0,
  LOGICAL_OR: 1,
  LOGICAL_AND: 2,
  INCLUSIVE_OR: 3,
  EXCLUSIVE_OR: 4,
  BITWISE_AND: 5,
  EQUAL: 6,
  RELATIONAL: 7,
  OFFSETOF: 8,
  SHIFT: 9,
  ADD: 10,
  MULTIPLY: 11,
  CAST: 12,
  SIZEOF: 13,
  UNARY: 14,
  CALL: 15,
  FIELD: 16,
  SUBSCRIPT: 17,
};

const PREC = {
  COMMENT: 0,         // //  /*  */
  ASSIGN: 1,          // =  += -=  *=  /=  %=  &=  ^=  |=  <<=  >>=  >>>=
  DECL: 2,
  ELEMENT_VAL: 2,
  TERNARY: 3,         // ?:
  OR: 4,              // ||
  AND: 5,             // &&
  BIT_OR: 6,          // |
  BIT_XOR: 7,         // ^
  BIT_AND: 8,         // &
  EQUALITY: 9,        // ==  !=
  GENERIC: 10,
  REL: 10,            // <  <=  >  >=  instanceof
  SHIFT: 11,          // <<  >>  >>>
  ADD: 12,            // +  -
  MULT: 13,           // *  /  %
  CAST: 14,           // (Type)
  OBJ_INST: 14,       // new
  UNARY: 15,          // ++a  --a  a++  a--  +  -  !  ~
  ARRAY: 16,          // [Index]
  OBJ_ACCESS: 16,     // .
  PARENS: 16,         // (Expression)
};

/* eslint-enable no-multi-spaces */

module.exports = grammar({
  name: 'zs',

  extras: $ => [
    $.line_comment,
    $.line_2_comment,
    $.block_comment,
    /\s/,
  ],

  supertypes: $ => [
    $.expression,
    $.declaration,
    $.statement,
    $.primary_expression,
    $._literal,
    $._simple_type,
    $._unannotated_type,
    $.comment,
  ],

  inline: $ => [
    $._simple_type,
    $._class_body_declaration,
    $._variable_initializer,
  ],

  conflicts: $ => [
    [$._unannotated_type, $.primary_expression],
    [$.expression, $.statement],
    [$.enum_declaration],
    [$.pointer_identifier, $._unannotated_type],
    [$.amazin_void_type, $.formal_parameters],
    [$.parenthesized_expression, $.argument_list],
    [$.field_access, $._unannotated_type],
    [$.new_expression, $.primary_expression],
  ],

  rules: {
    program: $ => repeat($._toplevel_statement),

    _toplevel_statement: $ => choice(
      $.statement,
      $.preproc_if,
      $.preproc_ifdef,
      $.preproc_ifndef,
      $.preproc_include,
      $.preproc_def,
      $.preproc_undef,
      $.preproc_error,
      $.preproc_function_def,
    ),

    _literal: $ => choice(
      $.decimal_integer_literal,
      $.hex_integer_literal,
      $.octal_integer_literal,
      $.binary_integer_literal,
      $.decimal_floating_point_literal,
      $.hex_floating_point_literal,
      $.true,
      $.false,
      $.character_literal,
      $.string_literal,
      $.null_literal,
    ),

    decimal_integer_literal: _ => token(seq(
      DIGITS,
      optional(choice('l', 'L')),
    )),

    hex_integer_literal: _ => token(seq(
      choice('0x', '0X'),
      HEX_DIGITS,
      optional(choice('l', 'L')),
    )),

    octal_integer_literal: _ => token(seq(
      choice('0o', '0O', '0'),
      sep1(/[0-7]+/, '_'),
      optional(choice('l', 'L')),
    )),

    binary_integer_literal: _ => token(seq(
      choice('0b', '0B'),
      sep1(/[01]+/, '_'),
      optional(choice('l', 'L')),
    )),

    decimal_floating_point_literal: _ => token(choice(
      seq(DECIMAL_DIGITS, '.', optional(DECIMAL_DIGITS), optional(seq((/[eE]/), optional(choice('-', '+')), DECIMAL_DIGITS)), optional(/[fFdD]/)),
      seq('.', DECIMAL_DIGITS, optional(seq((/[eE]/), optional(choice('-', '+')), DECIMAL_DIGITS)), optional(/[fFdD]/)),
      seq(DIGITS, /[eEpP]/, optional(choice('-', '+')), DECIMAL_DIGITS, optional(/[fFdD]/)),
      seq(DIGITS, optional(seq((/[eE]/), optional(choice('-', '+')), DECIMAL_DIGITS)), (/[fFdD]/)),
    )),

    hex_floating_point_literal: _ => token(seq(
      choice('0x', '0X'),
      choice(
        seq(HEX_DIGITS, optional('.')),
        seq(optional(HEX_DIGITS), '.', HEX_DIGITS),
      ),
      optional(seq(
        /[eEpP]/,
        optional(choice('-', '+')),
        DIGITS,
        optional(/[fFdD]/),
      )),
    )),

    true: _ => 'true',

    false: _ => 'false',

    character_literal: _ => token(seq(
      '\'',
      repeat1(choice(
        /[^\\'\n]/,
        /\\./,
        /\\\n/,
      )),
      '\'',
    )),

    string_literal: $ => choice(
      alias('"\\\\"', $.escape_sequence),
      seq(
        '"',
        repeat(choice(
          $.escape_sequence,
          $.string_fragment,
          prec(100, $.dqote_escape),
          alias(choice('\\"', '\\\\"'), $.escape_sequence),
          alias(choice('"\\', '"\\\\'), $.escape_sequence),
        )),
        choice('"', '"L'),
      )),

    string_fragment: _ => token.immediate(/[^"\\]+/),

    dqote_escape: _ => prec(100, token.immediate(choice('""', '\\\\""', '\\\\\\"'))),

    escape_sequence: _ => token.immediate(
      choice(
        '\\',
        seq(
          choice(
            /[^xu0-7]/,
            /[0-7]{1,3}/,
            /x[0-9a-fA-F]{2}/,
            /u[0-9a-fA-F]{4}/,
            /u\{[0-9a-fA-F]+\}/,
            /[\r?][\n\u2028\u2029]/,
          ),
        ),
      )),

    null_literal: _ => 'null',

    // Expressions

    expression: $ => choice(
      $.assignment_array_assignment,
      $.assignment_expression,
      $.binary_expression,
      $.lambda_expression,
      $.ternary_expression,
      $.update_expression,
      $.primary_expression,
      $.unary_expression,
      $.switch_expression,
      $.new_expression,
      $.lambda_invocation,
      prec(1000, $.super_invocation),

      prec(10, $.generic_type),

      prec(-10, $.typed_expression),
      alias($.preproc_if_in_expression, $.preproc_if),
      alias($.preproc_ifdef_in_expression, $.preproc_ifdef),
      alias($.preproc_ifndef_in_expression, $.preproc_ifndef),
    ),

    typed_expression: $ => prec.right(-100, seq(
      field('left', $._unannotated_type),
      field('right', $.identifier),
    )),

    new_expression: $ => prec.right(-1, seq(
      field('name', $.identifier),
      '{',
      field('params', commaSep(optional(choice($.pair, $.array, $.expression)))),
      '}',
      field('chain', optional(seq('.', $.expression))),
    )),

    pair: $ => seq(
      field('key', $.identifier),
      ':',
      field('value', $.expression),
    ),

    cast_expression: $ => prec(PREC.CAST, choice(
      seq(
        field('value', $.expression),
        'as',
        field('type', $._unannotated_type),
        // optional(seq('.', $.expression)),
      ),
    )),


    assignment_array_assignment: $ => seq(
      $.identifier,
      $.array,
    ),

    assignment_expression: $ => prec.right(PREC.ASSIGN, seq(
      field('left', choice(
        $.identifier,
        $.field_access,
        $.string_splice_expression,
        $.assignment_array_assignment,
        $.array_access,
      )),
      field('operator', choice('=', '+=', '_=', '-=', '*=', '/=', '&=', '|=', '^=', '%=', '<<=', '>>=', '>>>=')),
      field('right', $.expression),
    )),

    binary_expression: $ => choice(
      ...[
        ['>', PREC.REL],
        ['<', PREC.REL],
        ['>=', PREC.REL],
        ['<=', PREC.REL],
        ['==', PREC.EQUALITY],
        ['!=', PREC.EQUALITY],
        ['&&', PREC.AND],
        ['||', PREC.OR],
        ['+', PREC.ADD],
        ['_', PREC.ADD],
        ['-', PREC.ADD],
        ['*', PREC.MULT],
        ['/', PREC.MULT],
        ['&', PREC.BIT_AND],
        ['|', PREC.BIT_OR],
        ['^', PREC.BIT_XOR],
        ['^=', PREC.BIT_XOR],
        ['%', PREC.MULT],
        ['<<', PREC.SHIFT],
        ['>>', PREC.SHIFT],
        ['>>>', PREC.SHIFT],
      ].map(([operator, precedence]) =>
        prec.left(precedence, seq(
          field('left', $.expression),
          // @ts-ignore
          field('operator', operator),
          field('right', $.expression),
        )),
      )),

    lambda_expression: $ => seq(
      '&',
      $._unannotated_type,
      field('parameters', choice(
        $.identifier, $.formal_parameters,
      )),
      field('body', choice($.expression, $.block)),
    ),

    ternary_expression: $ => prec.right(PREC.TERNARY, seq(
      field('condition', $.expression),
      '?',
      field('consequence', $.expression),
      ':',
      field('alternative', $.expression),
    )),

    unary_expression: $ => choice(...[
      ['+', PREC.UNARY],
      ['-', PREC.UNARY],
      ['!', PREC.UNARY],
      ['~', PREC.UNARY],
    ].map(([operator, precedence]) =>
      prec.left(precedence, seq(
        // @ts-ignore
        field('operator', operator),
        field('operand', $.expression),
      )),
    )),

    update_expression: $ => prec.left(PREC.UNARY, choice(
      seq($.expression, '++'),
      seq($.expression, '--'),
      seq('++', $.expression),
      seq('--', $.expression),
    )),

    primary_expression: $ => prec.left(choice(
      $._literal,
      $.this,
      $.identifier,
      $.parenthesized_expression,
      $.field_access,
      $.array_access,
      $.method_invocation,
      $.template_expression,
      $.pointer_identifier,
      $.array,
      $.string_splice_expression,
      $.array_assignment,
      $.argument_list,
      $.cast_expression,
      $.variable_cast_expression,
    )),

    array: $ => seq(
      '[',
      commaSep(optional($.expression)),
      ']',
    ),

    pointer_identifier: $ => seq(
      '&',
      $.identifier,
    ),

    parenthesized_expression: $ => seq('(', $.expression, ')'),


    field_access: $ => seq(
      field('object', $.primary_expression),
      seq('.', field('ptr', optional('&'))),
      field('field', choice($.identifier, $.this)),
    ),

    template_expression: $ => seq(
      field('template_processor', $.primary_expression),
      '.',
      field('template_argument', $.string_literal),
    ),

    array_access: $ => prec(10, seq(
      field('array', $.primary_expression),
      choice('._[', '['),
      field('index', commaSep($.expression)),
      ']',
    )),

    array_assignment: $ => prec.right(seq(
      $.array_access,
      '=',
      field('value', $.expression),
    )),

    string_splice_expression: $ => prec(11, seq(
      field('name', choice($.primary_expression, $.identifier)),
      '[',
      optional(field('start_index', $.expression)),
      ':',
      optional(field('end_index', $.expression)),
      ']',
    )),

    method_invocation: $ => prec(1, seq(
      choice(
        field('name', $.array_access),
        field('name', $.method_invocation),
        field('name', $.parenthesized_expression),
        field('name',
          choice(
            $.identifier,
            alias('str', $.identifier),
            alias('int', $.identifier),
            alias('long', $.identifier),
            alias('float', $.identifier),
            alias('double', $.identifier),
            alias('bool', $.identifier),
            alias('byte', $.identifier),
          )),
        seq(
          field('object', $.primary_expression),
          '.',
          field('type_arguments', optional($.type_arguments)),
          field('name', $.identifier),
        ),
      ),
      field('arguments', $.argument_list),
    )),

    lambda_invocation: $ => seq(
      field('object', $.primary_expression),
      '.',
      field('function', $.lambda_expression),
    ),

    argument_list: $ => seq('(', commaSep($.expression), ')'),

    type_arguments: $ => seq(
      '<',
      commaSep(choice($._unannotated_type)),
      '>',
    ),

    switch_expression: $ => seq(
      'switch',
      field('condition', $.parenthesized_expression),
      field('body', $.switch_block),
    ),

    switch_block: $ => seq(
      '{',
      choice(
        repeat($.switch_block_statement_group),
        repeat($.switch_rule),
      ),
      '}',
    ),

    switch_block_statement_group: $ => prec.left(seq(
      repeat1(seq($.switch_label, ':')),
      repeat($.statement),
    )),

    switch_rule: $ => seq(
      $.switch_label,
      '->',
      choice($.expression_statement, $.block),
    ),

    switch_label: $ => choice(
      seq('case',
        choice(
          commaSep1($.expression),
        ),
        optional($.guard),
      ),
      'default',
    ),

    guard: $ => seq('when', $.expression),

    statement: $ => choice(
      $.declaration,
      $.expression_statement,
      $.labeled_statement,
      $.if_statement,
      $.while_statement,
      $.for_statement,
      $.enhanced_for_statement,
      $.block,
      ';',
      $.assert_statement,
      $.do_statement,
      $.break_statement,
      $.continue_statement,
      $.return_statement,
      $.switch_expression,
      prec.right(19, $.local_variable_declaration),
      $.local_type_declaration,
      prec(10, $.method_signature_declaration),
    ),

    super_invocation: $ => seq(
      'super',
      $.argument_list,
    ),

    block: $ => seq(
      '{', repeat(choice(
        $.statement,
        alias($.preproc_if_in_block, $.preproc_if),
        alias($.preproc_ifdef_in_block, $.preproc_ifdef),
        alias($.preproc_ifndef_in_block, $.preproc_ifndef),
      )),
      '}',
    ),

    expression_statement: $ => seq(
      $.expression,
      ';',
    ),

    labeled_statement: $ => seq(
      $.identifier, ':', $.statement,
    ),

    assert_statement: $ => choice(
      seq('assert', $.expression, ';'),
      seq('assert', $.expression, ':', $.expression, ';'),
    ),

    do_statement: $ => seq(
      'do',
      field('body', $.statement),
      'while',
      field('condition', $.parenthesized_expression),
      ';',
    ),

    break_statement: $ => seq('break', optional($.identifier), ';'),

    continue_statement: $ => seq('continue', optional($.identifier), ';'),

    return_statement: $ => seq(
      'return',
      optional(repeat($.expression)),
      optional(alias($.preproc_if_in_return_statement, $.preproc_if)),
      optional(alias($.preproc_ifdef_in_return_statement, $.preproc_ifdef)),
      optional(alias($.preproc_ifndef_in_return_statement, $.preproc_ifndef)),
      ';',
    ),

    if_statement: $ => prec.right(seq(
      'if',
      field('condition', $.parenthesized_expression),
      field('consequence', $.statement),
      optional(seq('else', field('alternative', $.statement))),
      optional(alias($.preproc_if_in_if_statement, $.preproc_if)),
      optional(alias($.preproc_ifdef_in_if_statement, $.preproc_ifdef)),
      optional(alias($.preproc_ifndef_in_if_statement, $.preproc_ifndef)),
    )),

    while_statement: $ => seq(
      'while',
      field('condition', $.parenthesized_expression),
      field('body', $.statement),
    ),

    for_statement: $ => seq(
      'for', '(',
      choice(
        field('init', $.local_variable_declaration),
        seq(
          commaSep(field('init', $.expression)),
          ';',
        ),
      ),
      field('condition', optional($.expression)), ';',
      commaSep(field('update', $.expression)), ')',
      field('body', $.statement),
    ),

    enhanced_for_statement: $ => seq(
      'for',
      '(',
      optional($.modifiers),
      field('type', $._unannotated_type),
      $._variable_declarator_id,
      ':',
      field('value', $.expression),
      ')',
      field('body', $.statement),
    ),

    declaration: $ => prec(PREC.DECL, choice(
      $.class_declaration,
      $.interface_declaration,
      $.enum_declaration,
      $.function_declaration,
    )),

    enum_declaration: $ => seq(
      optional($.modifiers),
      'enum',
      choice(
        seq(
          field('name', $.identifier),
          optional(seq(':', field('underlying_type', $._unannotated_type))),
          field('body', optional($.enumerator_list)),
        ),
        field('body', $.enumerator_list),
      ),
    ),

    enumerator_list: $ => seq(
      '{',
      repeat(choice(
        seq($.enumerator, ','),
        alias($.preproc_if_in_enumerator_list, $.preproc_if),
        alias($.preproc_ifdef_in_enumerator_list, $.preproc_ifdef),
        alias($.preproc_ifndef_in_enumerator_list, $.preproc_ifndef),
      )),
      optional(seq(
        choice(
          $.enumerator,
          alias($.preproc_if_in_enumerator_list_no_comma, $.preproc_if),
          alias($.preproc_ifdef_in_enumerator_list_no_comma, $.preproc_ifdef),
          alias($.preproc_ifndef_in_enumerator_list_no_comma, $.preproc_ifndef),
        ),
      )),
      '}',
    ),

    enumerator: $ => seq(
      field('name', $.identifier),
      optional(seq('=', field('value', $.expression))),
    ),

    class_declaration: $ => seq(
      optional($.modifiers),
      'class',
      field('name', $.identifier),
      optional(seq(':', field('underlying_type', $._unannotated_type))),
      optional(field('type_parameters', $.type_parameters)),
      optional(field('superclass', $.superclass)),
      optional(field('interfaces', $.super_interfaces)),
      field('body', $.class_body),
    ),

    modifiers: $ => repeat1(choice(
      'public',
      'protected',
      'private',
      'abstract',
      'final',
      'native',
    )),

    generic_type: $ => seq(
      field('name', $.identifier),
      '<',
      field('type', $._unannotated_type),
      '>',
    ),

    type_parameters: $ => seq(
      '<', commaSep1($.type_parameter), '>',
    ),

    type_parameter: $ => seq(
      alias($.identifier, $.type_identifier),
      $.identifier,
    ),

    superclass: $ => seq(
      'extends',
      $._unannotated_type,
    ),

    super_interfaces: $ => seq(
      'implements',
      $.type_list,
    ),

    type_list: $ => seq(
      $._unannotated_type,
      repeat(seq(',', $._unannotated_type)),
    ),

    class_body: $ => seq(
      '{',
      repeat(choice(
        $._class_body_declaration,
        alias($.preproc_if_in_class_body, $.preproc_if),
        alias($.preproc_ifdef_in_class_body, $.preproc_ifdef),
        alias($.preproc_ifndef_in_class_body, $.preproc_ifndef),
      )),
      '}',
    ),

    _class_body_declaration: $ => choice(
      $.field_declaration,
      $.method_declaration,
      $.method_signature_declaration,
      $.class_declaration,
      $.interface_declaration,
      $.enum_declaration,
      $.block,
      $.array_of,
      $.constructor_declaration,
      ';',
    ),

    constructor_declaration: $ => seq(
      optional($.modifiers),
      $._constructor_declarator,
      field('body', $.constructor_body),
    ),

    _constructor_declarator: $ => seq(
      field('type_parameters', optional($.type_parameters)),
      field('name', $.identifier),
      field('parameters', $.formal_parameters),
    ),

    constructor_body: $ => seq(
      '{',
      repeat($.statement),
      '}',
    ),


    field_declaration: $ => seq(
      optional('const'),
      optional($.modifiers),
      optional($.ptr_type),
      choice(field('type', $._unannotated_type), $.amazin_void_type),
      $._variable_declarator_list,
      ';',
    ),

    interface_declaration: $ => prec.right(seq(
      optional(field('type', $.modifiers)),
      'interface',
      field('name', $.identifier),
      choice(
        optional(seq(':', field('parent_interface', $._unannotated_type))),
        optional($.type_parameters),
      ),
      choice(field('body', $.interface_body), ';'),
    )),

    interface_body: $ => seq(
      '{',
      repeat(choice(
        $.method_interface,
        prec.right(10, $.get_declaration),
        prec.right(10, $.set_declaration),
        alias($.preproc_if_in_interface_body, $.preproc_if),
        alias($.preproc_ifdef_in_interface_body, $.preproc_ifdef),
        alias($.preproc_ifndef_in_interface_body, $.preproc_ifndef),
        ';',
      )),
      '}',
    ),

    get_declaration: $ => seq(
      field('type', $._unannotated_type),
      seq(field('name', $.identifier), optional($.typed_array)),
      ';',
    ),

    set_declaration: $ => seq(
      seq(optional($._unannotated_type), field('name', $.identifier), optional($.typed_array)),
      '=',
      field('type', choice($._unannotated_type, $.expression)),
      ';',
    ),

    typed_array: $ => seq(
      '[',
      commaSep(
        seq(
          field('type', $._unannotated_type),
          optional($.identifier),
        ),
      ),
      ']',
    ),

    array_of: $ => seq(
      seq(
        field('type', $._unannotated_type),
        choice(field('array', '[]'), field('ptr_array', '*[]')),
        field('name', $.identifier),
      ),
    ),

    get_set_declaration: $ => seq(
      $.set_declaration,
      $.get_declaration,
    ),

    constant_declaration: $ => seq(
      optional($.modifiers),
      field('type', $._unannotated_type),
      $._variable_declarator_list,
      ';',
    ),

    _variable_declarator_list: $ => commaSep1(
      field('declarator', $.variable_declarator),
    ),

    variable_cast: $ => seq('(', $._unannotated_type, ')'),

    variable_cast_expression: $ => prec(-100, seq(
      field('type', $.variable_cast),
      field('value', seq('(', $.identifier, ')')),
    )),

    variable_declarator: $ => seq(
      $._variable_declarator_id,
      optional(seq('=', optional($.variable_cast), field('value', $._variable_initializer))),
    ),

    _variable_declarator_id: $ => prec(1, seq(
      field('name', $.identifier),
    )),

    _variable_initializer: $ => choice(
      $.expression,
    ),

    _unannotated_type: $ => choice(
      $._simple_type,
      prec(1, $.void_type),
    ),

    amazin_void_type: $ => prec(-1, seq(
      field('amazing_type', $._simple_type),
      '(',
      commaSep($.formal_parameter),
      ')',
    )),

    _simple_type: $ => choice(
      $.void_type,
      $.integral_type,
      $.floating_point_type,
      $.fix_type,
      $.str_type,
      $.boolean_type,
      alias($.identifier, $.type_identifier),
    ),

    integral_type: _ => choice(
      'byte',
      'int',
      'long',
    ),

    floating_point_type: _ => choice(
      'float',
      'double',
    ),

    boolean_type: _ => 'bool',

    void_type: _ => 'void',

    ptr_type: _ => 'ptr',

    str_type: _ => 'str',

    fix_type: _ => 'fix',

    formal_parameters: $ => seq(
      '(',
      seq(
        optional($.receiver_parameter),
        commaSep(choice($.formal_parameter)),
      ),
      ')',
    ),

    formal_parameter: $ => seq(
      optional(choice(
        seq(
          optional($.modifiers),
          field('type', $._unannotated_type),
        ),
        $.amazin_void_type,
      )),
      choice($._variable_declarator_id, field('type', $._unannotated_type)),
    ),

    receiver_parameter: $ => seq(
      $.this,
    ),

    local_variable_declaration: $ => prec(100, choice(
      seq(
        choice($.identifier,
          alias('str', $.identifier),
          alias('int', $.identifier),
          alias('long', $.identifier),
          alias('float', $.identifier),
          alias('double', $.identifier),
          alias('bool', $.identifier),
        ),
        field('accepts', $.argument_list),
        $.variable_declarator,
      ),
      seq(
        seq(optional(field('native_type', 'native')), optional('const'), optional($.ptr_type), field('type', ($.amazin_void_type, $._unannotated_type))),
        optional(field('accepts', $.argument_list)),
        $._variable_declarator_list,
        ';',
      ),
    )),

    local_type_declaration: $ => seq(
      optional($.modifiers),
      'type',
      $.typed_variable_declarator_list,
      ';',
    ),

    typed_variable_declarator_list: $ => commaSep1(
      field('declarator', $.typed_variable_declarator),
    ),

    typed_variable_declarator: $ => seq(
      $._variable_declarator_id,
      choice(
        optional(seq('=', field('value', choice($.generic_type, $.typed_variable_initializer)))),
        optional(seq('=', 'event', field('value', seq(field('type', $._unannotated_type), field('arguments', $.formal_parameters))))),
      ),
    ),

    typed_variable_initializer: $ => seq(
      field('type', $._unannotated_type),
      $.expression,
    ),

    function_declaration: $ => seq(
      optional($.modifiers),
      field('type', choice($._unannotated_type)),
      field('name', $.identifier),
      field('parameters', $.formal_parameters),
      field('body', $.block),
    ),

    method_interface: $ => seq(
      seq(
        optional(field('type', $._unannotated_type)),
        seq(
          field('name', $.identifier),
          field('parameters', choice($.formal_parameters)),
        ),
      ),
      ';',
    ),

    method_declaration: $ => seq(
      optional($.modifiers),
      seq(
        optional(
          field('type_parameters', $.type_parameters),
        ),
        field('type', choice($._unannotated_type, $.amazin_void_type)),
        seq(
          field('name', $.identifier),
          field('parameters', $.formal_parameters),
        ),
      ),
      field('body', $.block),
    ),

    method_signature_declaration: $ => seq(
      optional($.modifiers),
      seq(
        optional(
          field('type_parameters', $.type_parameters),
        ),
        field('type', $._unannotated_type),
        seq(
          field('name', $.identifier),
          field('parameters', $.formal_parameters),
        ),
      ),
      ';',
    ),

    this: _ => 'this',

    // @ts-ignore
    identifier: _ => /[\p{XID_Start}_$][\p{XID_Continue}\u00A2_$]*/,

    comment: $ => choice(
      $.line_comment,
      $.line_2_comment,
      $.block_comment,
    ),

    line_comment: _ => token(prec(PREC.COMMENT, seq('//', /[^\n]*/))),

    line_2_comment: _ => token(prec(PREC.COMMENT, seq('# ', /\d[^\n]*/))),

    block_comment: _ => token(prec(PREC.COMMENT,
      seq(
        '/*',
        /[^*]*\*+([^/*][^*]*\*+)*/,
        '/',
      ),
    )),

    system_lib_string: _ => token(seq(
      '<',
      repeat(choice(/[^>\n]/, '\\>')),
      '>',
    )),

    preproc_call_expression: $ => prec(20, seq(
      field('function', $.identifier),
      field('arguments', alias($.preproc_argument_list, $.argument_list)),
    )),

    preproc_argument_list: $ => prec(1, seq(
      '(',
      commaSep($._preproc_expression),
      ')',
    )),

    preproc_binary_expression: $ => {
      const table = [
        ['+', PREPROC_PREC.ADD],
        ['-', PREPROC_PREC.ADD],
        ['*', PREPROC_PREC.MULTIPLY],
        ['/', PREPROC_PREC.MULTIPLY],
        ['%', PREPROC_PREC.MULTIPLY],
        ['||', PREPROC_PREC.LOGICAL_OR],
        ['&&', PREPROC_PREC.LOGICAL_AND],
        ['|', PREPROC_PREC.INCLUSIVE_OR],
        ['^', PREPROC_PREC.EXCLUSIVE_OR],
        ['&', PREPROC_PREC.BITWISE_AND],
        ['==', PREPROC_PREC.EQUAL],
        ['!=', PREPROC_PREC.EQUAL],
        ['>', PREPROC_PREC.RELATIONAL],
        ['>=', PREPROC_PREC.RELATIONAL],
        ['<=', PREPROC_PREC.RELATIONAL],
        ['<', PREPROC_PREC.RELATIONAL],
        ['<<', PREPROC_PREC.SHIFT],
        ['>>', PREPROC_PREC.SHIFT],
      ];

      return choice(...table.map(([operator, precedence]) => {
        return prec.left(precedence, seq(
          field('left', $._preproc_expression),
          // @ts-ignore
          field('operator', operator),
          field('right', $._preproc_expression),
        ));
      }));
    },

    _preproc_expression: $ => prec(1, choice(
      $.identifier,
      alias($.preproc_call_expression, $.call_expression),
      $.decimal_integer_literal,
      $.string_literal,
      $.preproc_defined,
      $.unary_expression,
      $.parenthesized_expression,
      alias($.preproc_binary_expression, $.binary_expression),
    )),

    preproc_defined: $ => choice(
      prec(PREC.DECL, seq('defined', '(', $.identifier, ')')),
      seq('defined', $.identifier),
    ),

    preproc_arg: _ => token(prec.left(-10000, /\S([^/\n]|\/[^*]|\\\r?\n)*/)),

    preproc_include: $ => seq(
      preprocessor('include'),
      field('path', choice(
        $.string_literal,
        $.system_lib_string,
        $.identifier,
        alias($.preproc_call_expression, $.call_expression),
      )),
      token.immediate(/\r?\n/),
    ),

    preproc_def: $ => seq(
      preprocessor('define'),
      field('name', $.identifier),
      field('value', optional($.preproc_arg)),
      token.immediate(/\r?\n/),
    ),

    preproc_undef: $ => seq(
      preprocessor('undef'),
      field('name', $.identifier),
      token.immediate(/\r?\n/),
    ),

    preproc_error: $ => seq(
      preprocessor('error'),
      field('value', optional($.preproc_arg)),
      token.immediate(/\r?\n/),
    ),

    preproc_function_def: $ => seq(
      preprocessor('define'),
      field('name', $.identifier),
      field('parameters', $.preproc_params),
      field('value', optional($.preproc_arg)),
      token.immediate(/\r?\n/),
    ),

    preproc_directive: _ => /#[ \t]*[a-zA-Z0-9]\w*/,

    preproc_params: $ => seq(
      token.immediate('('), commaSep(choice($.identifier, '...')), ')',
    ),

    preproc_call: $ => prec(-10, seq(
      field('directive', $.preproc_directive),
      field('argument', optional($.preproc_arg)),
      token.immediate(/\r?\n/),
    )),

    preproc_return: $ => prec(1, choice(
      field('or', seq(optional('||'), $.expression)),
    )),

    ...preprocIf('', $ => $._toplevel_statement, 100),
    ...preprocIf('_in_enumerator_list', $ => seq($.enumerator, ','), 10),
    ...preprocIf('_in_enumerator_list_no_comma', $ => $.enumerator, -1),
    ...preprocIf('_in_class_body', $ => $._class_body_declaration, 10),
    ...preprocIf('_in_expression', $ => $.expression, 11),
    ...preprocIf('_in_return_statement', $ => $.preproc_return, -1),
    ...preprocIf('_in_block', $ => $.statement, 100),
    ...preprocIf('_in_if_statement', $ => $.statement, 200),
    ...preprocIf('_in_interface_body', $ => seq(choice(
      $.method_declaration,
      $.method_signature_declaration,
      prec.right(10, $.get_declaration),
      prec.right(10, $.set_declaration),
    )), 10),
  },
});

/**
 * Creates a rule to match one or more of the rules separated by `separator`
 *
 * @param {RuleOrLiteral} rule
 *
 * @param {RuleOrLiteral} separator
 *
 * @return {SeqRule}
 *
 */
function sep1(rule, separator) {
  return seq(rule, repeat(seq(separator, rule)));
}

/**
 * Creates a rule to match one or more of the rules separated by a comma
 *
 * @param {RuleOrLiteral} rule
 *
 * @return {SeqRule}
 *
 */
function commaSep1(rule) {
  return seq(rule, repeat(seq(',', rule)));
}

/**
 * Creates a rule to optionally match one or more of the rules separated by a comma
 *
 * @param {RuleOrLiteral} rule
 *
 * @return {ChoiceRule}
 *
 */
function commaSep(rule) {
  return optional(commaSep1(rule));
}

/**
 *
 * @param {string} suffix
 *
 * @param {any} content
 *
 * @param {number} precedence
 *
 * @return {RuleBuilders<string, string>}
 */
function preprocIf(suffix, content, precedence = 0) {
  /**
   *
   * @param {GrammarSymbols<string>} $
   *
   * @return {ChoiceRule}
   */
  function alternativeBlock($) {
    return choice(
      suffix ? alias($['preproc_else' + suffix], $.preproc_else) : $.preproc_else,
      suffix ? alias($['preproc_elif' + suffix], $.preproc_elif) : $.preproc_elif,
      suffix ? alias($['preproc_elifdef' + suffix], $.preproc_elifdef) : $.preproc_elifdef,
    );
  }

  return {
    ['preproc_if' + suffix]: $ => prec(precedence, seq(
      preprocessor('if'),
      field('condition', $._preproc_expression),
      '\n',
      repeat(content($)),
      field('alternative', optional(alternativeBlock($))),
      preprocessor('endif'),
    )),

    ['preproc_ifdef' + suffix]: $ => prec(precedence, seq(
      preprocessor('ifdef'),
      field('name', $.identifier),
      repeat(content($)),
      field('alternative', optional(alternativeBlock($))),
      preprocessor('endif'),
    )),


    ['preproc_ifndef' + suffix]: $ => prec(precedence, seq(
      preprocessor('ifndef'),
      field('name', $.identifier),
      repeat(content($)),
      field('alternative', optional(alternativeBlock($))),
      preprocessor('endif'),
    )),

    ['preproc_else' + suffix]: $ => prec(precedence + 1, seq(
      preprocessor('else'),
      '\n',
      repeat(content($)),
    )),

    ['preproc_elif' + suffix]: $ => prec(precedence, seq(
      preprocessor('elif'),
      field('condition', $._preproc_expression),
      '\n',
      repeat(content($)),
      field('alternative', optional(alternativeBlock($))),
    )),

    ['preproc_elifdef' + suffix]: $ => prec(precedence, seq(
      choice(preprocessor('elifdef'), preprocessor('elifndef')),
      field('name', $.identifier),
      repeat(content($)),
      field('alternative', optional(alternativeBlock($))),
    )),
  };
}

/**
 * Creates a preprocessor regex rule
 *
 * @param {RegExp | Rule | string} command
 *
 * @return {AliasRule}
 */
function preprocessor(command) {
  return alias(new RegExp('#[ \t]*' + command), '#' + command);
}
