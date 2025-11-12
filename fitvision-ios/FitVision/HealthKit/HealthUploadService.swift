import Foundation
import UIKit

final class HealthUploadService {
    private let apiClient: APIClient
    private let deviceId = UIDevice.current.identifierForVendor?.uuidString ?? UUID().uuidString

    init(apiClient: APIClient) {
        self.apiClient = apiClient
    }

    func upload(samples: [HealthSample]) async {
        guard !samples.isEmpty else { return }
        let payload = HealthUploadRequest(deviceId: deviceId, samples: samples)
        do {
            let target = HealthTarget(action: .ingest(payload))
            try await apiClient.send(target)
        } catch {
            // Add retry via upload queue if needed
            await CoreDataStack.shared.queueUpload(endpoint: "/health/ingest", body: payload)
        }
    }
}
