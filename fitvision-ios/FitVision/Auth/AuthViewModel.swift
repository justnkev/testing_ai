import Foundation
import AuthenticationServices

protocol AuthViewModelDelegate: AnyObject {
    func authViewModel(_ viewModel: AuthViewModel, didUpdate session: SessionState)
}

@MainActor
final class AuthViewModel: ObservableObject {
    enum State {
        case idle
        case loading
        case error(String)
    }

    @Published var state: State = .idle
    let session: SessionState
    private let container: DIContainer
    weak var delegate: AuthViewModelDelegate?
    private let coordinator = AppleSignInCoordinator()

    init(session: SessionState, container: DIContainer) {
        self.session = session
        self.container = container
        coordinator.delegate = self
    }

    func signInWithApple() {
        state = .loading
        coordinator.signIn()
    }

    func handle(identityToken: String) {
        Task { await exchange(token: identityToken) }
    }

    private func exchange(token: String) async {
        do {
            let target = AuthTarget(action: .apple(identityToken: token))
            let response: AuthResponse = try await container.apiClient.send(target, decode: AuthResponse.self)
            container.keychain.saveToken(response.jwt)
            container.userRepository.cache(user: response.user)
            session.update(jwt: response.jwt)
            delegate?.authViewModel(self, didUpdate: session)
            state = .idle
        } catch {
            state = .error("Sign in failed. Please try again.")
        }
    }
}

extension AuthViewModel: AppleSignInCoordinatorDelegate {
    nonisolated func coordinator(_ coordinator: AppleSignInCoordinator, didCompleteWith identityToken: String) {
        Task { await exchange(token: identityToken) }
    }

    nonisolated func coordinator(_ coordinator: AppleSignInCoordinator, didFailWith error: Error) {
        Task { @MainActor in
            self.state = .error(error.localizedDescription)
        }
    }
}
