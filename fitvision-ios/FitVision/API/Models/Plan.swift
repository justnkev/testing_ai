import Foundation

struct Plan: Codable, Identifiable {
    let id: UUID
    let title: String
    let summary: String
    let recommendations: [String]
}

struct OnboardingPayload: Codable {
    let activityLevel: String
    let sleepHours: Double
    let lifestyle: String
}
