import Foundation

enum LogEntryType: String, Codable, CaseIterable {
    case workout
    case meal
    case sleep
    case habit
}

struct LogEntry: Codable, Identifiable {
    let id: UUID
    let type: LogEntryType
    let fields: [String: String]
    let calories: Double?
    let macros: Macros?
    let timestamp: Date
}

struct Macros: Codable {
    let protein: Double
    let carbs: Double
    let fat: Double
}

struct LogEntryRequest: Codable {
    let type: LogEntryType
    let payload: [String: String]
}
