import Foundation
import CoreData

final class VisualizationsRepository {
    private let apiClient: APIClient
    private let coreDataStack: CoreDataStack

    init(apiClient: APIClient, coreDataStack: CoreDataStack) {
        self.apiClient = apiClient
        self.coreDataStack = coreDataStack
    }

    func fetch() async throws -> [Visualization] {
        let target = VisualizationsTarget(action: .list)
        do {
            let response: VisualizationListResponse = try await apiClient.send(target, decode: VisualizationListResponse.self)
            cache(items: response.items)
            return response.items
        } catch {
            return loadCached()
        }
    }

    func create(request: VisualizationRequest) async throws -> Visualization {
        let target = VisualizationsTarget(action: .create(request))
        let response: VisualizationResponse = try await apiClient.send(target, decode: VisualizationResponse.self)
        cache(items: [response.visualization])
        return response.visualization
    }

    private func cache(items: [Visualization]) {
        let context = coreDataStack.context
        items.forEach { item in
            let entity = NSEntityDescription.insertNewObject(forEntityName: "CDVisualization", into: context)
            entity.setValue(item.id.uuidString, forKey: "id")
            entity.setValue(item.url.absoluteString, forKey: "url")
            entity.setValue(item.createdAt, forKey: "createdAt")
            entity.setValue(item.notes, forKey: "notes")
        }
        coreDataStack.saveContext()
    }

    private func loadCached() -> [Visualization] {
        let context = coreDataStack.context
        let fetch = NSFetchRequest<NSManagedObject>(entityName: "CDVisualization")
        fetch.sortDescriptors = [NSSortDescriptor(key: "createdAt", ascending: false)]
        guard let items = try? context.fetch(fetch) else { return [] }
        return items.compactMap { item in
            guard let idString = item.value(forKey: "id") as? String,
                  let id = UUID(uuidString: idString),
                  let urlString = item.value(forKey: "url") as? String,
                  let url = URL(string: urlString),
                  let createdAt = item.value(forKey: "createdAt") as? Date else { return nil }
            let notes = item.value(forKey: "notes") as? String
            return Visualization(id: id, url: url, createdAt: createdAt, notes: notes)
        }
    }
}

struct VisualizationListResponse: Codable {
    let items: [Visualization]
}

struct VisualizationResponse: Codable {
    let visualization: Visualization
}
