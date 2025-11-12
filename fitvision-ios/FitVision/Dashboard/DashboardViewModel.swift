import Foundation
import Combine

@MainActor
final class DashboardViewModel: ObservableObject {
    @Published private(set) var stats: Stats?
    @Published var isLoading = false
    @Published var error: String?
    @Published var selectedRange: RangeOption = .weekly

    private let container: DIContainer

    enum RangeOption: String, CaseIterable, Identifiable {
        case weekly = "7d"
        case monthly = "30d"

        var id: String { rawValue }
        var title: String {
            switch self {
            case .weekly: return "7 Days"
            case .monthly: return "30 Days"
            }
        }
    }

    init(container: DIContainer) {
        self.container = container
    }

    func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            stats = try await container.logsRepository.fetchStats(range: selectedRange.rawValue)
        } catch {
            self.error = "Failed to load dashboard"
        }
    }

    func refresh() async {
        await load()
    }
}
