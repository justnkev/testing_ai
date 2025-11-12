import Foundation

@MainActor
final class PlanViewModel: ObservableObject {
    @Published private(set) var plan: Plan?
    @Published var isLoading = false
    @Published var error: String?

    private let container: DIContainer

    init(container: DIContainer) {
        self.container = container
    }

    func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let target = OnboardingTarget(action: .plan)
            let plan: Plan = try await container.apiClient.send(target, decode: Plan.self)
            self.plan = plan
            container.logsRepository.cache(plan: plan)
        } catch {
            self.error = "Failed to load plan"
        }
    }
}
