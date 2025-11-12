import CoreData

final class CoreDataStack {
    static let shared = CoreDataStack()

    let persistentContainer: NSPersistentContainer
    weak var apiClient: APIClient?

    private init() {
        persistentContainer = NSPersistentContainer(name: "FitVision")
        persistentContainer.loadPersistentStores { _, error in
            if let error {
                fatalError("Core Data failed to load: \(error)")
            }
        }
    }

    var context: NSManagedObjectContext { persistentContainer.viewContext }

    func saveContext() {
        guard context.hasChanges else { return }
        do {
            try context.save()
        } catch {
            print("Core Data save error: \(error)")
        }
    }

    func clearAll() async {
        await persistentContainer.performBackgroundTask { context in
            let entities = self.persistentContainer.managedObjectModel.entities
            entities.compactMap { $0.name }.forEach { name in
                let fetch = NSFetchRequest<NSFetchRequestResult>(entityName: name)
                let delete = NSBatchDeleteRequest(fetchRequest: fetch)
                try? context.execute(delete)
            }
        }
    }

    func queueUpload<T: Encodable>(endpoint: String, body: T) async {
        await persistentContainer.performBackgroundTask { context in
            let entity = NSEntityDescription.insertNewObject(forEntityName: "CDUploadQueue", into: context)
            entity.setValue(UUID().uuidString, forKey: "id")
            entity.setValue(endpoint, forKey: "endpoint")
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            let data = try? encoder.encode(body)
            entity.setValue(data, forKey: "body")
            entity.setValue(Date(), forKey: "createdAt")
            entity.setValue(0, forKey: "retryCount")
            try? context.save()
        }
    }

    func flushUploadQueue() async {
        guard let apiClient else { return }
        let pending: [(NSManagedObjectID, String, Data)] = await withCheckedContinuation { continuation in
            persistentContainer.performBackgroundTask { context in
                let fetch = NSFetchRequest<NSManagedObject>(entityName: "CDUploadQueue")
                guard let items = try? context.fetch(fetch) else {
                    continuation.resume(returning: [])
                    return
                }
                let mapped = items.compactMap { item -> (NSManagedObjectID, String, Data)? in
                    guard let endpoint = item.value(forKey: "endpoint") as? String,
                          let data = item.value(forKey: "body") as? Data else { return nil }
                    return (item.objectID, endpoint, data)
                }
                continuation.resume(returning: mapped)
            }
        }

        for (objectID, endpoint, data) in pending {
            let target = UploadQueueTarget(endpoint: endpoint, payload: data)
            do {
                try await apiClient.send(target)
                await persistentContainer.performBackgroundTask { context in
                    if let object = try? context.existingObject(with: objectID) {
                        context.delete(object)
                        try? context.save()
                    }
                }
            } catch {
                await persistentContainer.performBackgroundTask { context in
                    if let object = try? context.existingObject(with: objectID) {
                        var retry = object.value(forKey: "retryCount") as? Int ?? 0
                        retry += 1
                        object.setValue(retry, forKey: "retryCount")
                        try? context.save()
                    }
                }
            }
        }
    }
}

private struct UploadQueueTarget: APITarget {
    let endpoint: String
    let payload: Data

    var path: String { endpoint }
    var method: String { "POST" }
    var queryItems: [URLQueryItem]? { nil }
    var headers: [String : String] { [:] }
    var body: Data? { payload }
}
