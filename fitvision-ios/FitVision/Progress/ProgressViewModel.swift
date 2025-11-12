import Foundation

@MainActor
final class ProgressViewModel: ObservableObject {
    struct FormState {
        var type: LogEntryType = .workout
        var fields: [String: String] = [:]
    }

    @Published var form = FormState()
    @Published private(set) var logs: [LogEntry] = []
    @Published var isSubmitting = false
    @Published var error: String?
    @Published var isLoading = false
    private var cursor: String?

    private let container: DIContainer

    init(container: DIContainer) {
        self.container = container
    }

    func loadInitial() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let response: LogListResponse = try await container.logsRepository.fetchLogs(cursor: nil)
            logs = response.items
            cursor = response.nextCursor
        } catch {
            self.error = "Failed to load logs"
        }
    }

    func loadMore() async {
        guard let cursor else { return }
        do {
            let response: LogListResponse = try await container.logsRepository.fetchLogs(cursor: cursor)
            logs.append(contentsOf: response.items)
            self.cursor = response.nextCursor
        } catch {
            self.error = "Failed to load more logs"
        }
    }

    func submit() async {
        isSubmitting = true
        defer { isSubmitting = false }
        let request = LogEntryRequest(type: form.type, payload: form.fields)
        do {
            let log = try await container.logsRepository.createLog(request: request)
            logs.insert(log, at: 0)
            form = FormState()
        } catch {
            let optimisticLog = LogEntry(id: UUID(), type: form.type, fields: form.fields, calories: nil, macros: nil, timestamp: Date())
            logs.insert(optimisticLog, at: 0)
            self.error = "Unable to save log. It will sync when online."
        }
    }
}

struct LogListResponse: Codable {
    let items: [LogEntry]
    let nextCursor: String?
}
