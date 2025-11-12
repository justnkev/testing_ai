import Foundation
import Combine
import SwiftUI

@MainActor
final class AppEnvironment: ObservableObject {
    @Published private(set) var session: SessionState
    private let keychain: KeychainStorage
    private let apiClient: APIClient
    private let container: DIContainer
    private var cancellables = Set<AnyCancellable>()

    init() {
        let configuration = EnvironmentConfigurationLoader.load()
        let keychain = KeychainStorage()
        let coreDataStack = CoreDataStack.shared
        let sessionToken = keychain.fetchToken()
        let sessionState = SessionState(jwt: sessionToken)
        let apiClient = APIClient(configuration: configuration, session: sessionState)
        let container = DIContainer(apiClient: apiClient, coreDataStack: coreDataStack, keychain: keychain, configuration: configuration)
        self.keychain = keychain
        self.session = sessionState
        self.apiClient = apiClient
        self.container = container
        session.objectWillChange
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in
                self?.objectWillChange.send()
            }
            .store(in: &cancellables)
    }

    func bootstrap() async {
        if session.isAuthenticated {
            await refreshUser()
        }
    }

    func makeAuthViewModel() -> AuthViewModel {
        let viewModel = AuthViewModel(session: session, container: container)
        viewModel.delegate = self
        return viewModel
    }

    func makeOnboardingViewModel() -> OnboardingViewModel {
        OnboardingViewModel(container: container)
    }

    func makePlanViewModel() -> PlanViewModel {
        PlanViewModel(container: container)
    }

    func makeProgressViewModel() -> ProgressViewModel {
        ProgressViewModel(container: container)
    }

    func makeVisualizeViewModel() -> VisualizeViewModel {
        VisualizeViewModel(container: container)
    }

    func makeDashboardViewModel() -> DashboardViewModel {
        DashboardViewModel(container: container)
    }

    func makeSettingsViewModel() -> SettingsViewModel {
        SettingsViewModel(container: container, delegate: self)
    }

    private func refreshUser() async {
        do {
            _ = try await container.userRepository.fetchCurrentUser()
        } catch {
            if case APIError.unauthorized = error {
                await signOut()
            }
        }
    }
}

extension AppEnvironment: AuthViewModelDelegate {
    nonisolated func authViewModel(_ viewModel: AuthViewModel, didUpdate session: SessionState) {
        Task { @MainActor in
            self.session.update(jwt: session.jwt)
        }
    }
}

extension AppEnvironment: SettingsViewModelDelegate {
    func signOutRequested() {
        Task { @MainActor in
            await signOut()
        }
    }

    private func signOut() async {
        keychain.clearToken()
        await container.coreDataStack.clearAll()
        session.update(jwt: nil)
    }
}
