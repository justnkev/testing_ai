import Foundation

struct User: Codable, Identifiable {
    let id: UUID
    let name: String
    let email: String
    let avatarURL: URL?
}

struct AuthResponse: Codable {
    let jwt: String
    let user: User
}
