import XCTest

final class MainFlowUITests: XCTestCase {
    func testLaunch() throws {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.staticTexts["Welcome to FitVision"].exists)
    }
}
