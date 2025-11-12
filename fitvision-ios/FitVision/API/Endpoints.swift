import Foundation

struct AuthTarget: APITarget {
    enum Action {
        case apple(identityToken: String)
    }

    let action: Action

    var path: String {
        switch action {
        case .apple:
            return "/auth/apple"
        }
    }

    var method: String { "POST" }

    var queryItems: [URLQueryItem]? { nil }

    var body: Data? {
        switch action {
        case .apple(let identityToken):
            return try? JSONEncoder().encode(["identityToken": identityToken])
        }
    }

    var headers: [String : String] { [:] }
}

struct UserTarget: APITarget {
    enum Action {
        case me
    }

    let action: Action

    var path: String {
        switch action {
        case .me: return "/user/me"
        }
    }

    var method: String { "GET" }
    var queryItems: [URLQueryItem]? { nil }
    var body: Data? { nil }
    var headers: [String : String] { [:] }
}

struct OnboardingTarget: APITarget {
    enum Action {
        case submit(OnboardingPayload)
        case plan
    }

    let action: Action

    var path: String {
        switch action {
        case .submit: return "/onboarding"
        case .plan: return "/plan"
        }
    }

    var method: String {
        switch action {
        case .submit: return "POST"
        case .plan: return "GET"
        }
    }

    var queryItems: [URLQueryItem]? { nil }

    var body: Data? {
        switch action {
        case .submit(let payload):
            return try? JSONEncoder().encode(payload)
        case .plan:
            return nil
        }
    }

    var headers: [String : String] { [:] }
}

struct LogsTarget: APITarget {
    enum Action {
        case list(cursor: String?)
        case create(LogEntryRequest)
    }

    let action: Action

    var path: String { "/logs" }

    var method: String {
        switch action {
        case .list: return "GET"
        case .create: return "POST"
        }
    }

    var queryItems: [URLQueryItem]? {
        switch action {
        case .list(let cursor):
            guard let cursor else { return nil }
            return [URLQueryItem(name: "cursor", value: cursor)]
        case .create:
            return nil
        }
    }

    var body: Data? {
        switch action {
        case .list:
            return nil
        case .create(let request):
            return try? JSONEncoder().encode(request)
        }
    }

    var headers: [String : String] { [:] }
}

struct VisualizationsTarget: APITarget {
    enum Action {
        case list
        case create(VisualizationRequest)
    }

    let action: Action

    var path: String {
        switch action {
        case .list: return "/visualizations"
        case .create: return "/ai/visualize"
        }
    }

    var method: String {
        switch action {
        case .list: return "GET"
        case .create: return "POST"
        }
    }

    var queryItems: [URLQueryItem]? { nil }

    var body: Data? {
        switch action {
        case .list: return nil
        case .create(let request):
            return request.encode()
        }
    }

    var headers: [String : String] {
        switch action {
        case .list: return [:]
        case .create(let request):
            return request.headers
        }
    }
}

struct DashboardTarget: APITarget {
    enum Action {
        case stats(range: String)
    }

    let action: Action

    var path: String { "/dashboard" }

    var method: String { "GET" }

    var queryItems: [URLQueryItem]? {
        switch action {
        case .stats(let range):
            return [URLQueryItem(name: "range", value: range)]
        }
    }

    var body: Data? { nil }
    var headers: [String : String] { [:] }
}

struct HealthTarget: APITarget {
    enum Action {
        case ingest(HealthUploadRequest)
    }

    let action: Action

    var path: String { "/health/ingest" }
    var method: String { "POST" }
    var queryItems: [URLQueryItem]? { nil }

    var body: Data? {
        switch action {
        case .ingest(let payload):
            return try? JSONEncoder().encode(payload)
        }
    }

    var headers: [String : String] { [:] }
}
