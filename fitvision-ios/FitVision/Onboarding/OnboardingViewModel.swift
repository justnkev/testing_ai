import Foundation

@MainActor
final class OnboardingViewModel: ObservableObject {
    enum Step: Int, CaseIterable {
        case activity
        case sleep
        case lifestyle
    }

    @Published var step: Step = .activity
    @Published var activityLevel: String = "Moderate"
    @Published var sleepHours: Double = 7
    @Published var lifestyle: String = "Balanced"
    @Published var isSubmitting = false
    @Published var error: String?

    private let container: DIContainer

    init(container: DIContainer) {
        self.container = container
    }

    func next() {
        guard let currentIndex = Step.allCases.firstIndex(of: step) else { return }
        if currentIndex < Step.allCases.count - 1 {
            step = Step.allCases[currentIndex + 1]
        }
    }

    func back() {
        guard let currentIndex = Step.allCases.firstIndex(of: step), currentIndex > 0 else { return }
        step = Step.allCases[currentIndex - 1]
    }

    func submit() async -> Plan? {
        isSubmitting = true
        defer { isSubmitting = false }
        let payload = OnboardingPayload(activityLevel: activityLevel, sleepHours: sleepHours, lifestyle: lifestyle)
        do {
            let target = OnboardingTarget(action: .submit(payload))
            let plan: Plan = try await container.apiClient.send(target, decode: Plan.self)
            container.logsRepository.cache(plan: plan)
            return plan
        } catch {
            self.error = "Unable to submit onboarding."
            return nil
        }
    }
}
