import Foundation
import CoreData

final class LogsRepository {
    private let apiClient: APIClient
    private let coreDataStack: CoreDataStack

    init(apiClient: APIClient, coreDataStack: CoreDataStack) {
        self.apiClient = apiClient
        self.coreDataStack = coreDataStack
    }

    func fetchLogs(cursor: String?) async throws -> LogListResponse {
        let target = LogsTarget(action: .list(cursor: cursor))
        do {
            let response: LogListResponse = try await apiClient.send(target, decode: LogListResponse.self)
            cache(logs: response.items)
            return response
        } catch {
            return LogListResponse(items: loadCachedLogs(), nextCursor: nil)
        }
    }

    func createLog(request: LogEntryRequest) async throws -> LogEntry {
        let target = LogsTarget(action: .create(request))
        do {
            let log: LogEntry = try await apiClient.send(target, decode: LogEntry.self)
            cache(logs: [log])
            return log
        } catch {
            try await queueLog(request: request)
            throw error
        }
    }

    func fetchStats(range: String) async throws -> Stats {
        let target = DashboardTarget(action: .stats(range: range))
        do {
            let response: StatsResponse = try await apiClient.send(target, decode: StatsResponse.self)
            cache(stats: response.stats, range: range)
            return response.stats
        } catch {
            return loadCachedStats(range: range)
        }
    }

    func cache(plan: Plan) {
        // placeholder for storing plan if needed
    }

    private func cache(logs: [LogEntry]) {
        let context = coreDataStack.context
        logs.forEach { log in
            let entity = NSEntityDescription.insertNewObject(forEntityName: "CDLogEntry", into: context)
            entity.setValue(log.id.uuidString, forKey: "id")
            entity.setValue(log.type.rawValue, forKey: "type")
            entity.setValue(try? JSONEncoder().encode(log.fields), forKey: "payload")
            entity.setValue(log.timestamp, forKey: "timestamp")
            entity.setValue(log.calories, forKey: "calories")
            entity.setValue(try? JSONEncoder().encode(log.macros), forKey: "macros")
            entity.setValue(1, forKey: "status")
        }
        coreDataStack.saveContext()
    }

    private func loadCachedLogs() -> [LogEntry] {
        let context = coreDataStack.context
        let fetch = NSFetchRequest<NSManagedObject>(entityName: "CDLogEntry")
        let sort = NSSortDescriptor(key: "timestamp", ascending: false)
        fetch.sortDescriptors = [sort]
        guard let items = try? context.fetch(fetch) else { return [] }
        return items.compactMap { item in
            guard let idString = item.value(forKey: "id") as? String,
                  let id = UUID(uuidString: idString),
                  let typeString = item.value(forKey: "type") as? String,
                  let type = LogEntryType(rawValue: typeString),
                  let timestamp = item.value(forKey: "timestamp") as? Date else { return nil }
            let fieldsData = item.value(forKey: "payload") as? Data
            let macrosData = item.value(forKey: "macros") as? Data
            let fields = (try? JSONDecoder().decode([String: String].self, from: fieldsData ?? Data())) ?? [:]
            let macros = macrosData.flatMap { try? JSONDecoder().decode(Macros.self, from: $0) }
            let calories = item.value(forKey: "calories") as? Double
            return LogEntry(id: id, type: type, fields: fields, calories: calories, macros: macros, timestamp: timestamp)
        }
    }

    private func cache(stats: Stats, range: String) {
        let context = coreDataStack.context
        let entity = NSEntityDescription.insertNewObject(forEntityName: "CDStatsSnapshot", into: context)
        entity.setValue(UUID().uuidString, forKey: "id")
        entity.setValue(range, forKey: "range")
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        entity.setValue(try? encoder.encode(stats), forKey: "payload")
        entity.setValue(Date(), forKey: "createdAt")
        coreDataStack.saveContext()
    }

    private func loadCachedStats(range: String) -> Stats {
        let context = coreDataStack.context
        let fetch = NSFetchRequest<NSManagedObject>(entityName: "CDStatsSnapshot")
        fetch.predicate = NSPredicate(format: "range == %@", range)
        fetch.sortDescriptors = [NSSortDescriptor(key: "createdAt", ascending: false)]
        fetch.fetchLimit = 1
        guard let snapshot = try? context.fetch(fetch).first,
              let data = snapshot.value(forKey: "payload") as? Data,
              let stats = try? JSONDecoder().decode(Stats.self, from: data) else {
            return Stats(caloriesIn: 0, caloriesOut: 0, steps: 0, sleepHours: 0, workoutsCount: 0, habitsCount: 0, trendlines: nil)
        }
        return stats
    }

    private func queueLog(request: LogEntryRequest) async throws {
        await coreDataStack.queueUpload(endpoint: "/logs", body: request)
    }
}
