import Foundation

struct HealthSample: Codable {
    let type: String
    let value: Double
    let unit: String
    let startDate: Date
    let endDate: Date
}

struct HealthUploadRequest: Codable {
    let deviceId: String
    let samples: [HealthSample]
}
