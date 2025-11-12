import Foundation
import SwiftUI

struct Stats: Codable {
    let caloriesIn: Double
    let caloriesOut: Double
    let steps: Int
    let sleepHours: Double
    let workoutsCount: Int
    let habitsCount: Int
    let trendlines: [String: [Double]]?
}

struct StatsResponse: Codable {
    let stats: Stats
}
