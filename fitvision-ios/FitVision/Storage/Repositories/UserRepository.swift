import Foundation
import CoreData

final class UserRepository {
    private let apiClient: APIClient
    private let coreDataStack: CoreDataStack

    init(apiClient: APIClient, coreDataStack: CoreDataStack) {
        self.apiClient = apiClient
        self.coreDataStack = coreDataStack
    }

    func fetchCurrentUser() async throws -> User {
        let target = UserTarget(action: .me)
        let user: User = try await apiClient.send(target, decode: User.self)
        cache(user: user)
        return user
    }

    func cache(user: User) {
        let context = coreDataStack.context
        let fetch = NSFetchRequest<NSManagedObject>(entityName: "CDUser")
        fetch.fetchLimit = 1
        let existing = try? context.fetch(fetch).first
        let entity = existing ?? NSEntityDescription.insertNewObject(forEntityName: "CDUser", into: context)
        entity.setValue(user.id.uuidString, forKey: "id")
        entity.setValue(user.name, forKey: "name")
        entity.setValue(user.email, forKey: "email")
        entity.setValue(user.avatarURL?.absoluteString, forKey: "avatarURL")
        coreDataStack.saveContext()
    }
}
