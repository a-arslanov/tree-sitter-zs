package tree_sitter_zs_test

import (
	"testing"

	tree_sitter "github.com/tree-sitter/go-tree-sitter"
	tree_sitter_zs "github.com/tree-sitter/tree-sitter-zs/bindings/go"
)

func TestCanLoadGrammar(t *testing.T) {
	language := tree_sitter.NewLanguage(tree_sitter_zs.Language())
	if language == nil {
		t.Errorf("Error loading Zs grammar")
	}
}
