import XCTest
import SwiftTreeSitter
import TreeSitterZs

final class TreeSitterZsTests: XCTestCase {
    func testCanLoadGrammar() throws {
        let parser = Parser()
        let language = Language(language: tree_sitter_zs())
        XCTAssertNoThrow(try parser.setLanguage(language),
                         "Error loading Zs grammar")
    }
}
