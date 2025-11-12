import XCTest
@testable import FitVision

final class AuthViewModelTests: XCTestCase {
    func testSignInUpdatesStateOnSuccess() async {
        let session = SessionState(jwt: nil)
        let configuration = EnvironmentConfiguration(baseURL: URL(string: "https://example.com")!, enableSSLPinning: false)
        let apiClient = APIClientSpy(configuration: configuration, session: session)
        let container = DIContainer(apiClient: apiClient, coreDataStack: .shared, keychain: KeychainStorage(), configuration: configuration)
        let viewModel = AuthViewModel(session: session, container: container)
        let expectation = expectation(description: "delegate called")
        let delegate = AuthDelegateMock(expectation: expectation)
        viewModel.delegate = delegate
        apiClient.stubbedResponse = AuthResponse(jwt: "token", user: User(id: UUID(), name: "Test", email: "test@example.com", avatarURL: nil))

        viewModel.handle(identityToken: "token")
        await fulfillment(of: [expectation], timeout: 1.0)
        XCTAssertEqual(session.jwt, "token")
    }
}

private final class AuthDelegateMock: AuthViewModelDelegate {
    let expectation: XCTestExpectation
    init(expectation: XCTestExpectation) { self.expectation = expectation }
    func authViewModel(_ viewModel: AuthViewModel, didUpdate session: SessionState) {
        expectation.fulfill()
    }
}

final class APIClientSpy: APIClient {
    var stubbedResponse: AuthResponse?

    override func send<T>(_ target: APITarget, decode type: T.Type) async throws -> T where T : Decodable {
        if let response = stubbedResponse as? T {
            return response
        }
        throw APIError.server("No stub")
    }
}
