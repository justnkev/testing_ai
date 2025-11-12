import Foundation

final class HealthRepository {
    private let apiClient: APIClient
    private let coreDataStack: CoreDataStack

    init(apiClient: APIClient, coreDataStack: CoreDataStack) {
        self.apiClient = apiClient
        self.coreDataStack = coreDataStack
    }

    func enqueue(samples: [HealthSample]) async {
        await coreDataStack.queueUpload(endpoint: "/health/ingest", body: HealthUploadRequest(deviceId: UUID().uuidString, samples: samples))
    }
}
