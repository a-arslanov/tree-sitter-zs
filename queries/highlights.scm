[
  (line_comment)
  (block_comment)
] @comment

[
  (hex_integer_literal)
  (decimal_integer_literal)
  (octal_integer_literal)
  (decimal_floating_point_literal)
  (hex_floating_point_literal)
  (binary_integer_literal)
] @number

[
  (character_literal)
  (string_literal)
] @string
(escape_sequence) @string

[
  "break"
  "case"
  "class"
  "continue"
  "default"
  "do"
  "else"
  "extends"
  "for"
  "if"
  "return"
  "switch"
  "while"
  "implements"
  "extends"
] @keyword

[
  "#define"
  "#elif"
  "#else"
  "#endif"
  "#if"
  "#ifdef"
  "#ifndef"
  "#include"
] @macro

[
  (void_type)
  (integral_type)
  (floating_point_type)
  (fix_type)
  (str_type)
  (boolean_type)
] @type.modification

(type_identifier) @type

(variable_declarator
  name: (identifier) @variable)

(interface_declaration
  name: (identifier) @class)

(class_declaration
  name: (identifier) @class)

(enum_declaration
  name: (identifier) @enum)

(new_expression
  name: (identifier) @class)

(method_invocation
  name: (identifier) @function)

